import { EPSILON } from "./constants";
import { firstOfSequence } from "./grammar";
import type { FirstFollow, Grammar, LlRuleTable } from "./types";

export function buildLlRuleTable(grammar: Grammar, ff: FirstFollow): LlRuleTable {
  const table: LlRuleTable = {};
  grammar.nonTerminals.forEach((nonTerminal) => {
    table[nonTerminal] = {};
  });

  grammar.productions.forEach((prod) => {
    const first = firstOfSequence(prod.rhs, ff.first);
    const lookaheads = [...first].filter((symbol) => symbol !== EPSILON);
    if (first.has(EPSILON)) {
      lookaheads.push(...(ff.follow[prod.lhs] ?? []));
    }
    lookaheads.forEach((lookahead) => {
      table[prod.lhs][lookahead] ??= [];
      table[prod.lhs][lookahead].push(prod);
    });
  });

  return table;
}
