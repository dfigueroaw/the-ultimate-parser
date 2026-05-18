import { END, EPSILON } from "./constants";
import {
  attemptLimitAction,
  attemptLimitMessage,
  LR_SIMULATION_GUARD_LIMIT,
  PARSE_GUARD_LIMIT,
} from "./errors";
import {
  actionLabel,
  displaySymbol,
  formatProduction,
  isLrParser,
} from "./format";
import { tokenizeInput } from "./input";
import type {
  Grammar,
  LRModel,
  ParserType,
  SimulationResult,
  TreeNode,
} from "./types";

export function simulate(
  grammar: Grammar,
  model: LRModel | undefined,
  parser: ParserType,
  input: string,
): SimulationResult {
  const tokens = [...tokenizeInput(input), END];
  if (isLrParser(parser)) {
    if (!model)
      return { ok: false, steps: ["No LR model available."], tree: undefined };
    const stack = [0];
    const steps: string[] = [];
    let cursor = 0;
    for (let guard = 0; guard < LR_SIMULATION_GUARD_LIMIT; guard += 1) {
      const state = stack[stack.length - 1];
      const lookahead = tokens[cursor];
      const actions = model.table.action[state]?.[lookahead] ?? [];
      steps.push(
        `state ${state}, lookahead ${displaySymbol(lookahead)}: ${actions.map(actionLabel).join(" / ") || "error"}`,
      );
      if (actions.length !== 1) return { ok: false, steps, tree: undefined };
      const action = actions[0];
      if (action.kind === "accept") return { ok: true, steps, tree: undefined };
      if (action.kind === "shift") {
        stack.push(action.to);
        cursor += 1;
      } else {
        const pop = action.production.rhs.length;
        stack.splice(Math.max(1, stack.length - pop), pop);
        const next =
          model.table.goTo[stack[stack.length - 1]]?.[action.production.lhs];
        if (next === undefined)
          return {
            ok: false,
            steps: [...steps, "missing goto"],
            tree: undefined,
          };
        stack.push(next);
      }
    }
    return {
      ok: false,
      steps: [...steps, "simulation guard reached"],
      tree: undefined,
    };
  }
  const result = parseTopDown(
    grammar,
    tokens.filter((token) => token !== END),
  );
  return result.ok
    ? { ok: true, steps: result.steps, tree: result.tree }
    : {
        ok: false,
        steps: result.steps,
        tree: result.tree,
        error: result.error,
      };
}

function parseTopDown(grammar: Grammar, tokens: string[]) {
  const byLhs = new Map<string, typeof grammar.productions>();
  grammar.productions.forEach((prod) =>
    byLhs.set(prod.lhs, [...(byLhs.get(prod.lhs) ?? []), prod]),
  );
  const steps: string[] = [];
  let attempts = 0;
  let recursionLimitHit = false;

  function parseSymbol(
    symbol: string,
    pos: number,
    depth: number,
  ): { ok: boolean; pos: number; node: TreeNode } {
    attempts += 1;
    if (attempts > PARSE_GUARD_LIMIT) {
      recursionLimitHit = true;
      steps.push(attemptLimitAction());
      return { ok: false, pos, node: { label: symbol } };
    }
    if (!grammar.nonTerminals.includes(symbol)) {
      const ok =
        tokens[pos] === symbol ||
        (symbol === "number" && /^\d+$/.test(tokens[pos] ?? ""));
      steps.push(
        `${"  ".repeat(depth)}match ${symbol} with ${tokens[pos] ?? "end"}: ${ok ? "ok" : "error"}`,
      );
      return { ok, pos: ok ? pos + 1 : pos, node: { label: symbol } };
    }
    for (const prod of byLhs.get(symbol) ?? []) {
      let cursor = pos;
      const children: TreeNode[] = [];
      steps.push(`${"  ".repeat(depth)}try ${formatProduction(prod)}`);
      const parts = prod.rhs.length ? prod.rhs : [EPSILON];
      let ok = true;
      for (const part of parts) {
        if (part === EPSILON) {
          children.push({ label: EPSILON });
          continue;
        }
        const parsed = parseSymbol(part, cursor, depth + 1);
        children.push(parsed.node);
        cursor = parsed.pos;
        if (!parsed.ok || recursionLimitHit) {
          ok = false;
          break;
        }
      }
      if (recursionLimitHit) break;
      if (ok)
        return { ok: true, pos: cursor, node: { label: symbol, children } };
    }
    return { ok: false, pos, node: { label: symbol } };
  }

  const parsed = parseSymbol(grammar.start, 0, 0);
  return {
    ok: !recursionLimitHit && parsed.ok && parsed.pos === tokens.length,
    steps,
    tree: parsed.node,
    error: recursionLimitHit ? attemptLimitMessage() : undefined,
  };
}
