import { EPSILON, END, EPSILON_SYMBOL } from "./constants";
import {
  expectedTokenMessage,
  invalidGrammarTokenMessage,
  noRulesMessage,
  ParserLabError,
} from "./errors";
import { formatProduction } from "./format";
import type { FirstFollow, Grammar, ParserType, Production } from "./types";

export function tokenizeGrammar(input: string) {
  const tokens: string[] = [];
  const re = /\s+|::=|[A-Za-z_][A-Za-z0-9_]*|ε|'[^']*'|"[^"]*"|[=;|,()[\]{}]/g;
  let cursor = 0;

  for (const match of input.matchAll(re)) {
    const matchIndex = match.index ?? cursor;
    if (input.slice(cursor, matchIndex).trim()) {
      throw new ParserLabError(
        invalidGrammarTokenMessage(input[cursor], cursor),
      );
    }
    const token = match[0];
    cursor = matchIndex + token.length;
    if (!token.trim()) continue;
    tokens.push(token === "::=" ? "=" : token);
  }

  if (input.slice(cursor).trim()) {
    throw new ParserLabError(invalidGrammarTokenMessage(input[cursor], cursor));
  }

  return tokens;
}

export function parseIsoEbnf(input: string, parser: ParserType): Grammar {
  const tokens = tokenizeGrammar(input);
  let index = 0;
  let aux = 0;
  const productions: Omit<Production, "id">[] = [];
  const loweredProductions: Omit<Production, "id">[] = [];
  const nonTerminals = new Set<string>();
  const notes: string[] = [];

  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (token: string) => {
    const actual = take();
    if (actual !== token)
      throw new ParserLabError(expectedTokenMessage(token, index, actual));
  };
  const clean = (token: string) => {
    if (token === EPSILON_SYMBOL) return EPSILON;
    return (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('"') && token.endsWith('"'))
      ? token.slice(1, -1)
      : token;
  };
  const fresh = (base: string, label: string) => {
    aux += 1;
    const name = `${base}_${label}_${aux}`;
    notes.push(`Created ${name} to lower ISO14977 ${label} syntax into BNF.`);
    return name;
  };

  function parseExpression(owner: string, stops: string[]): string[][] {
    const choices = [parseSequence(owner, stops.concat("|"))];
    while (peek() === "|") {
      take();
      choices.push(parseSequence(owner, stops.concat("|")));
    }
    return choices;
  }

  function parseSequence(owner: string, stops: string[]): string[] {
    const seq: string[] = [];
    while (peek() && !stops.includes(peek())) {
      const token = take();
      if (token === ",") continue;
      if (token === "(") {
        const name = fresh(owner, "group");
        parseExpression(owner, [")"]).forEach((rhs) =>
          loweredProductions.push({ lhs: name, rhs }),
        );
        expect(")");
        nonTerminals.add(name);
        seq.push(name);
      } else if (token === "[") {
        const name = fresh(owner, "optional");
        parseExpression(owner, ["]"]).forEach((rhs) =>
          loweredProductions.push({ lhs: name, rhs }),
        );
        loweredProductions.push({ lhs: name, rhs: [] });
        expect("]");
        nonTerminals.add(name);
        seq.push(name);
      } else if (token === "{") {
        const name = fresh(owner, "loop");
        const choices = parseExpression(owner, ["}"]);
        choices.forEach((rhs) =>
          loweredProductions.push({ lhs: name, rhs: [...rhs, name] }),
        );
        loweredProductions.push({ lhs: name, rhs: [] });
        expect("}");
        nonTerminals.add(name);
        seq.push(name);
      } else {
        const symbol = clean(token);
        if (symbol !== EPSILON) seq.push(symbol);
      }
    }
    return seq;
  }

  while (index < tokens.length) {
    const lhs = clean(take());
    if (!lhs) break;
    nonTerminals.add(lhs);
    expect("=");
    parseExpression(lhs, [";"]).forEach((rhs) =>
      productions.push({ lhs, rhs }),
    );
    expect(";");
  }

  if (!productions.length) throw new ParserLabError(noRulesMessage());

  const orderedProductions = [...productions, ...loweredProductions];
  orderedProductions.forEach((prod) => nonTerminals.add(prod.lhs));
  const originalStart = productions[0].lhs;
  const augmentedStart = `${originalStart}'`;
  const withAugment =
    parser.startsWith("LR") || parser === "SLR(1)" || parser === "LALR(1)";
  const start = withAugment ? augmentedStart : originalStart;
  const numbered = [
    ...(withAugment ? [{ lhs: augmentedStart, rhs: [originalStart] }] : []),
    ...orderedProductions,
  ].map((prod, id) => ({ ...prod, id }));
  if (withAugment) {
    nonTerminals.add(augmentedStart);
    notes.unshift(
      `Added ${augmentedStart} = ${originalStart} and set ${augmentedStart} as the LR initial state.`,
    );
  }

  const terminalSet = new Set<string>();
  numbered.forEach((prod) =>
    prod.rhs.forEach((symbol) => {
      if (!nonTerminals.has(symbol)) terminalSet.add(symbol);
    }),
  );
  const orderedNonTerminals = numbered.reduce<string[]>((acc, prod) => {
    if (!acc.includes(prod.lhs)) acc.push(prod.lhs);
    return acc;
  }, []);

  return {
    start,
    augmentedStart,
    productions: numbered,
    nonTerminals: orderedNonTerminals,
    terminals: [...terminalSet].sort(),
    transformed: numbered.map(formatProduction).join("\n"),
    notes,
  };
}

export function computeFirstFollow(grammar: Grammar): FirstFollow {
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
  follow[grammar.augmentedStart]?.add(END);

  let changed = true;
  while (changed) {
    changed = false;
    grammar.productions.forEach((prod) => {
      const target = first[prod.lhs] ?? new Set<string>();
      const before = target.size;
      first[prod.lhs] = target;
      firstOfSequence(prod.rhs, first).forEach((item) => target.add(item));
      changed ||= target.size !== before;
    });
  }

  changed = true;
  while (changed) {
    changed = false;
    grammar.productions.forEach((prod) => {
      prod.rhs.forEach((symbol, pos) => {
        if (!grammar.nonTerminals.includes(symbol)) return;
        const beta = prod.rhs.slice(pos + 1);
        const firstBeta = firstOfSequence(beta, first);
        const before = follow[symbol].size;
        firstBeta.forEach(
          (item) => item !== EPSILON && follow[symbol].add(item),
        );
        if (!beta.length || firstBeta.has(EPSILON)) {
          follow[prod.lhs].forEach((item) => follow[symbol].add(item));
        }
        changed ||= follow[symbol].size !== before;
      });
    });
  }

  return { first, follow };
}

export function firstOfSequence(
  seq: string[],
  first: Record<string, Set<string>>,
) {
  const out = new Set<string>();
  if (!seq.length) {
    out.add(EPSILON);
    return out;
  }
  for (const symbol of seq) {
    const values = first[symbol] ?? new Set([symbol]);
    values.forEach((value) => value !== EPSILON && out.add(value));
    if (!values.has(EPSILON)) return out;
  }
  out.add(EPSILON);
  return out;
}
