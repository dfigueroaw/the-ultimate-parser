import { displaySymbols } from "./format";
import { tokenizeGrammar } from "./grammar";
import { END, EPSILON, EPSILON_SYMBOL } from "./constants";
import { expectedTokenMessage, noRulesMessage, ParserLabError } from "./errors";
import type {
  EbnfAlternative,
  EbnfGrammar,
  EbnfTerm,
  FirstFollow,
} from "./types";

export function parseEbnf(input: string): EbnfGrammar {
  const tokens = tokenizeGrammar(input);
  let index = 0;
  const parsedRules: EbnfGrammar["rules"] = [];
  const nonTerminals = new Set<string>();

  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (token: string) => {
    const actual = take();
    if (actual !== token)
      throw new ParserLabError(expectedTokenMessage(token, index, actual));
  };

  while (index < tokens.length) {
    const lhs = clean(take());
    if (!lhs) break;
    nonTerminals.add(lhs);
    expect("=");
    parsedRules.push({ lhs, alternatives: parseExpression([";"]) });
    expect(";");
  }

  if (!parsedRules.length) throw new ParserLabError(noRulesMessage());

  const rules = mergeRulesByLhs(parsedRules);

  const terminals = new Set<string>();
  rules.forEach((rule) => {
    walkAlternatives(rule.alternatives, (term) => {
      if (term.kind === "symbol" && !nonTerminals.has(term.value))
        terminals.add(term.value);
    });
  });

  function parseExpression(stops: string[]): EbnfAlternative[] {
    const alternatives = [parseSequence(stops.concat("|"))];
    while (peek() === "|") {
      take();
      alternatives.push(parseSequence(stops.concat("|")));
    }
    return alternatives;
  }

  function parseSequence(stops: string[]): EbnfAlternative {
    const sequence: EbnfAlternative = [];
    while (peek() && !stops.includes(peek())) {
      const token = take();
      if (token === ",") continue;
      if (token === "(") {
        const alternatives = parseExpression([")"]);
        expect(")");
        sequence.push({ kind: "group", alternatives });
      } else if (token === "[") {
        const alternatives = parseExpression(["]"]);
        expect("]");
        sequence.push({ kind: "optional", alternatives });
      } else if (token === "{") {
        const alternatives = parseExpression(["}"]);
        expect("}");
        sequence.push({ kind: "repeat", alternatives });
      } else {
        const symbol = clean(token);
        if (symbol !== EPSILON)
          sequence.push({ kind: "symbol", value: symbol });
      }
    }
    return sequence;
  }

  return {
    start: rules[0].lhs,
    rules,
    nonTerminals: rules.map((rule) => rule.lhs),
    terminals: [...terminals].sort(),
    transformed: rules
      .map((rule) => `${rule.lhs} = ${formatAlternatives(rule.alternatives)} ;`)
      .join("\n"),
  };
}

function mergeRulesByLhs(rules: EbnfGrammar["rules"]): EbnfGrammar["rules"] {
  const byLhs = new Map<string, EbnfGrammar["rules"][number]>();

  rules.forEach((rule) => {
    const existing = byLhs.get(rule.lhs);
    if (existing) {
      existing.alternatives.push(...rule.alternatives);
      return;
    }
    byLhs.set(rule.lhs, {
      lhs: rule.lhs,
      alternatives: [...rule.alternatives],
    });
  });

  return [...byLhs.values()];
}

export function computeEbnfFirstFollow(grammar: EbnfGrammar): FirstFollow {
  const first: Record<string, Set<string>> = {};
  const follow: Record<string, Set<string>> = {};
  [...grammar.nonTerminals, ...grammar.terminals, END].forEach((symbol) => {
    first[symbol] = new Set(
      grammar.terminals.includes(symbol) || symbol === END ? [symbol] : [],
    );
    follow[symbol] = new Set();
  });
  first[EPSILON] = new Set([EPSILON]);
  follow[grammar.start]?.add(END);

  let changed = true;
  while (changed) {
    changed = false;
    grammar.rules.forEach((rule) => {
      const before = first[rule.lhs]?.size ?? 0;
      first[rule.lhs] ??= new Set();
      firstOfAlternatives(rule.alternatives, first, grammar).forEach((symbol) =>
        first[rule.lhs].add(symbol),
      );
      changed ||= first[rule.lhs].size !== before;
    });
  }

  changed = true;
  while (changed) {
    changed = false;
    grammar.rules.forEach((rule) => {
      rule.alternatives.forEach((alternative) => {
        const before = snapshot(follow);
        propagateFollowInSequence(
          alternative,
          follow[rule.lhs] ?? new Set(),
          first,
          follow,
          grammar,
        );
        changed ||= before !== snapshot(follow);
      });
    });
  }

  return { first, follow };
}

export function firstOfEbnfSequence(
  sequence: EbnfAlternative,
  first: Record<string, Set<string>>,
  grammar: EbnfGrammar,
) {
  const out = new Set<string>();
  if (!sequence.length) {
    out.add(EPSILON);
    return out;
  }
  for (const term of sequence) {
    const values = firstOfTerm(term, first, grammar);
    values.forEach((value) => value !== EPSILON && out.add(value));
    if (!values.has(EPSILON)) return out;
  }
  out.add(EPSILON);
  return out;
}

export function firstOfEbnfAlternatives(
  alternatives: EbnfAlternative[],
  first: Record<string, Set<string>>,
  grammar: EbnfGrammar,
) {
  return firstOfAlternatives(alternatives, first, grammar);
}

export function formatAlternatives(alternatives: EbnfAlternative[]): string {
  return alternatives.map(formatSequence).join(" | ");
}

export function formatTerm(term: EbnfTerm): string {
  if (term.kind === "symbol") return term.value;
  if (term.kind === "group")
    return `( ${formatAlternatives(term.alternatives)} )`;
  if (term.kind === "optional")
    return `[ ${formatAlternatives(term.alternatives)} ]`;
  return `{ ${formatAlternatives(term.alternatives)} }`;
}

function formatSequence(sequence: EbnfAlternative): string {
  return sequence.length
    ? sequence.map(formatTerm).join(" , ")
    : displaySymbols([]);
}

export function walkAlternatives(
  alternatives: EbnfAlternative[],
  visit: (term: EbnfTerm) => void,
) {
  alternatives.forEach((alternative) => {
    alternative.forEach((term) => {
      visit(term);
      if (term.kind !== "symbol") walkAlternatives(term.alternatives, visit);
    });
  });
}

function firstOfAlternatives(
  alternatives: EbnfAlternative[],
  first: Record<string, Set<string>>,
  grammar: EbnfGrammar,
) {
  const out = new Set<string>();
  alternatives.forEach((alternative) =>
    firstOfEbnfSequence(alternative, first, grammar).forEach((symbol) =>
      out.add(symbol),
    ),
  );
  return out;
}

function firstOfTerm(
  term: EbnfTerm,
  first: Record<string, Set<string>>,
  grammar: EbnfGrammar,
) {
  if (term.kind === "symbol") return first[term.value] ?? new Set([term.value]);
  const values = firstOfAlternatives(term.alternatives, first, grammar);
  if (term.kind === "optional" || term.kind === "repeat") values.add(EPSILON);
  return values;
}

function propagateFollowInSequence(
  sequence: EbnfAlternative,
  trailer: Set<string>,
  first: Record<string, Set<string>>,
  follow: Record<string, Set<string>>,
  grammar: EbnfGrammar,
) {
  for (let index = 0; index < sequence.length; index += 1) {
    const term = sequence[index];
    const restFirst = firstOfEbnfSequence(
      sequence.slice(index + 1),
      first,
      grammar,
    );
    const nextFollow = new Set(
      [...restFirst].filter((symbol) => symbol !== EPSILON),
    );
    if (restFirst.has(EPSILON))
      trailer.forEach((symbol) => nextFollow.add(symbol));

    if (term.kind === "symbol" && grammar.nonTerminals.includes(term.value)) {
      follow[term.value] ??= new Set();
      nextFollow.forEach((symbol) => follow[term.value].add(symbol));
      continue;
    }

    if (term.kind !== "symbol") {
      const innerTrailer = new Set(nextFollow);
      if (term.kind === "repeat") {
        firstOfAlternatives(term.alternatives, first, grammar).forEach(
          (symbol) => {
            if (symbol !== EPSILON) innerTrailer.add(symbol);
          },
        );
      }
      term.alternatives.forEach((alternative) =>
        propagateFollowInSequence(
          alternative,
          innerTrailer,
          first,
          follow,
          grammar,
        ),
      );
    }
  }
}

function snapshot(follow: Record<string, Set<string>>) {
  return Object.entries(follow)
    .map(([symbol, values]) => `${symbol}:${[...values].sort().join(",")}`)
    .sort()
    .join("|");
}

function clean(token: string) {
  if (token === EPSILON_SYMBOL) return EPSILON;
  return (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'))
    ? token.slice(1, -1)
    : token;
}
