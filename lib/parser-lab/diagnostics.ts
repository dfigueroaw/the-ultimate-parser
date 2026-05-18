import { EPSILON, EPSILON_SYMBOL } from "./constants";
import { displaySymbols, formatProduction } from "./format";
import { firstOfSequence } from "./grammar";
import type { Conflict, FirstFollow, Grammar, GrammarSuggestion } from "./types";

export function buildLlConflicts(grammar: Grammar, ff: FirstFollow): Conflict[] {
  return grammar.nonTerminals.flatMap((lhs) => {
    const bySymbol = new Map<string, typeof grammar.productions>();
    grammar.productions
      .filter((prod) => prod.lhs === lhs)
      .forEach((prod) => {
        const first = firstOfSequence(prod.rhs, ff.first);
        const lookaheads = [...first].filter((item) => item !== EPSILON);
        if (first.has(EPSILON)) lookaheads.push(...(ff.follow[lhs] ?? []));
        lookaheads.forEach((symbol) => bySymbol.set(symbol, [...(bySymbol.get(symbol) ?? []), prod]));
      });
    return [...bySymbol.entries()]
      .filter(([, prods]) => prods.length > 1)
      .map(([symbol, prods]) => ({
        parser: "LL(1)" as const,
        subject: lhs,
        symbol,
        actions: prods.map(formatProduction),
        explanation:
          `When the next input symbol is ${displaySymbols([symbol])}, ${lhs} has more than one matching production.`,
        suggestion: `A predictive parser only has one token of lookahead, so it cannot choose between ${prods.map(formatProduction).join(" and ")}. Rewrite ${lhs} so these alternatives start with different FIRST symbols, or factor the shared prefix into a new helper rule.`,
      }));
  });
}

export function getLeftRecursionSuggestions(grammar: Grammar): GrammarSuggestion[] {
  return grammar.productions
    .filter((prod) => prod.rhs[0] === prod.lhs)
    .map((prod) => {
      const alpha = displaySymbols(prod.rhs.slice(1));
      const betas = grammar.productions
        .filter((candidate) => candidate.lhs === prod.lhs && candidate.id !== prod.id)
        .map((candidate) => displaySymbols(candidate.rhs));
      const tail = `${prod.lhs}'`;
      const rewrite = [
        `${prod.lhs} = ${betas.length ? betas.map((beta) => `${beta} ${tail}`).join(" | ") : tail}`,
        `${tail} = ${alpha} ${tail} | ${EPSILON_SYMBOL}`,
      ];
      return {
        kind: "left-recursion" as const,
        title: `${prod.lhs} recurses before consuming input`,
        body: `${formatProduction(prod)} calls ${prod.lhs} as its first symbol, so recursive descent would enter the same rule again before reading a token. Move the repeated suffix into ${tail} and let ${prod.lhs} start with the non-recursive alternatives.`,
        details: `Suggested rewrite:\n${rewrite.join("\n")}`,
        rewrite,
        references: [formatProduction(prod), prod.lhs, tail],
      };
    });
}

export function getLeftFactorSuggestions(grammar: Grammar): GrammarSuggestion[] {
  return grammar.nonTerminals.flatMap((lhs) => {
    const productions = grammar.productions.filter((prod) => prod.lhs === lhs && prod.rhs.length);
    const groups = new Map<string, typeof grammar.productions>();
    productions.forEach((prod) => {
      const prefix = prod.rhs[0];
      groups.set(prefix, [...(groups.get(prefix) ?? []), prod]);
    });
    return [...groups.entries()]
      .filter(([, prods]) => prods.length > 1)
      .map(([prefix, prods]) => {
        const suffixes = prods.map((prod) => displaySymbols(prod.rhs.slice(1)));
        const tail = `${lhs}'`;
        const rewrite = [
          `${lhs} = ${prefix} ${tail}`,
          `${tail} = ${suffixes.join(" | ")}`,
        ];
        return {
          kind: "left-factorization" as const,
          title: `${lhs} has alternatives with the same opening symbol`,
          body: `${prods.map(formatProduction).join(" and ")} both begin with ${displaySymbols([prefix])}. A one-token predictive parser sees the same start for each alternative, so move the shared prefix into ${lhs} and choose the remaining suffix in ${tail}.`,
          details: `Suggested rewrite:\n${rewrite.join("\n")}`,
          rewrite,
          references: [...prods.map(formatProduction), displaySymbols([prefix]), lhs, tail],
        };
      });
  });
}
