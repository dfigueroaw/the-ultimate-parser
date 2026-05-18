import { END, EPSILON } from "./constants";
import { symbolMatches, tokenizeInput } from "./input";
import type { Grammar, LlRuleTable, LRModel, TreeNode } from "./types";

export function buildLlParseTree(grammar: Grammar, table: LlRuleTable, input: string): TreeNode | undefined {
  const remaining = tokenizeInput(input);
  const root: TreeNode = { label: grammar.start, children: [] };
  const stack: Array<{ symbol: string; node: TreeNode }> = [{ symbol: grammar.start, node: root }];

  for (let guard = 0; guard < 1000; guard += 1) {
    const entry = stack.pop();
    const lookahead = remaining[0] ?? END;

    if (!entry && !remaining.length) return root;
    if (!entry) return undefined;

    const { symbol, node } = entry;
    if (!grammar.nonTerminals.includes(symbol)) {
      if (symbol === EPSILON) continue;
      if (!remaining[0] || !symbolMatches(symbol, remaining[0])) return undefined;
      node.label = remaining[0];
      remaining.shift();
      continue;
    }

    const tableEntry = table[symbol]?.[lookahead] ?? [];
    if (tableEntry.length !== 1) return undefined;

    const production = tableEntry[0];
    const rhs = production.rhs.length ? production.rhs : [EPSILON];
    const children = rhs.map((part) => ({ label: part }));
    node.children = children;

    children
      .map((child, index) => ({ symbol: rhs[index], node: child }))
      .filter((child) => child.symbol !== EPSILON)
      .reverse()
      .forEach((child) => stack.push(child));
  }

  return undefined;
}

export function buildLrParseTree(grammar: Grammar, model: LRModel | undefined, input: string): TreeNode | undefined {
  if (!model) return undefined;

  const stateStack = [0];
  const nodeStack: TreeNode[] = [];
  const remaining = [...tokenizeInput(input), END];

  for (let guard = 0; guard < 1000; guard += 1) {
    const state = stateStack[stateStack.length - 1];
    const lookahead = remaining[0] ?? END;
    const actions = model.table.action[state]?.[lookahead] ?? [];

    if (actions.length !== 1) return undefined;
    const action = actions[0];

    if (action.kind === "accept") {
      return nodeStack[nodeStack.length - 1];
    }

    if (action.kind === "shift") {
      nodeStack.push({ label: lookahead });
      stateStack.push(action.to);
      remaining.shift();
      continue;
    }

    const rhs = action.production.rhs;
    const children = rhs.length
      ? nodeStack.splice(Math.max(0, nodeStack.length - rhs.length), rhs.length)
      : [{ label: EPSILON }];
    stateStack.splice(Math.max(1, stateStack.length - rhs.length), rhs.length);

    const parent: TreeNode = { label: action.production.lhs, children };
    const next = model.table.goTo[stateStack[stateStack.length - 1]]?.[action.production.lhs];
    if (next === undefined) return undefined;

    nodeStack.push(parent);
    stateStack.push(next);
  }

  return undefined;
}
