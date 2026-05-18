import { END, EPSILON } from "./constants";
import { actionLabel, formatItem } from "./format";
import { firstOfSequence } from "./grammar";
import type { AutomataGraph, FirstFollow, Grammar, Item, LRModel, ParseTable, ParserType, State, TableAction } from "./types";

export function itemKey(item: Item) {
  return `${item.prod}.${item.dot}.${item.lookahead ?? ""}`;
}

function coreKey(items: Item[]) {
  return items
    .map((item) => `${item.prod}.${item.dot}`)
    .sort()
    .join("|");
}

function stateKey(items: Item[], withLookahead: boolean) {
  return items
    .map((item) => (withLookahead ? itemKey(item) : `${item.prod}.${item.dot}`))
    .sort()
    .join("|");
}

function closure(
  items: Item[],
  grammar: Grammar,
  ff: FirstFollow,
  withLookahead: boolean,
) {
  const out = [...items];
  const seen = new Set(out.map((item) => itemKey(item)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...out]) {
      const prod = grammar.productions[item.prod];
      const symbol = prod.rhs[item.dot];
      if (!grammar.nonTerminals.includes(symbol)) continue;
      const lookaheads = withLookahead
        ? [
            ...firstOfSequence(
              [...prod.rhs.slice(item.dot + 1), item.lookahead ?? END],
              ff.first,
            ),
          ].filter((value) => value !== EPSILON)
        : [""];
      grammar.productions
        .filter((candidate) => candidate.lhs === symbol)
        .forEach((candidate) => {
          lookaheads.forEach((lookahead) => {
            const next = { prod: candidate.id, dot: 0, lookahead };
            const key = itemKey(next);
            if (!seen.has(key)) {
              seen.add(key);
              out.push(next);
              changed = true;
            }
          });
        });
    }
  }
  return out;
}

function goTo(
  items: Item[],
  symbol: string,
  grammar: Grammar,
  ff: FirstFollow,
  withLookahead: boolean,
) {
  const shifted = items
    .filter((item) => grammar.productions[item.prod].rhs[item.dot] === symbol)
    .map((item) => ({ ...item, dot: item.dot + 1 }));
  return shifted.length ? closure(shifted, grammar, ff, withLookahead) : [];
}

export function buildLrModel(grammar: Grammar, ff: FirstFollow, parser: ParserType): LRModel {
  const withLookahead = parser === "LR(1)" || parser === "LALR(1)";
  const symbols = [...grammar.terminals, ...grammar.nonTerminals];
  const states: State[] = [
    {
      id: 0,
      items: closure([{ prod: 0, dot: 0, lookahead: END }], grammar, ff, withLookahead),
      transitions: {},
    },
  ];
  const seen = new Map([[stateKey(states[0].items, withLookahead), 0]]);

  for (let cursor = 0; cursor < states.length; cursor += 1) {
    symbols.forEach((symbol) => {
      const targetItems = goTo(states[cursor].items, symbol, grammar, ff, withLookahead);
      if (!targetItems.length) return;
      const key = stateKey(targetItems, withLookahead);
      let target = seen.get(key);
      if (target === undefined) {
        target = states.length;
        seen.set(key, target);
        states.push({ id: target, items: targetItems, transitions: {} });
      }
      states[cursor].transitions[symbol] = target;
    });
  }

  let finalStates = states;
  let kernelGroups: number[][] | undefined;
  let preMergeDfaGroups: number[][] | undefined;
  if (parser === "LALR(1)") {
    const groups = new Map<string, State[]>();
    states.forEach((state) => {
      const key = coreKey(state.items);
      groups.set(key, [...(groups.get(key) ?? []), state]);
    });
    preMergeDfaGroups = [...groups.values()]
      .map((group) => group.map((state) => state.id))
      .filter((group) => group.length > 1);
    const remap = new Map<number, number>();
    finalStates = [...groups.values()].map((group, id) => {
      group.forEach((state) => remap.set(state.id, id));
      const itemMap = new Map<string, Item>();
      group.flatMap((state) => state.items).forEach((item) => itemMap.set(itemKey(item), item));
      return { id, items: [...itemMap.values()], transitions: {} };
    });
    [...groups.values()].forEach((group) => {
      const source = finalStates[remap.get(group[0].id) ?? 0];
      Object.entries(group[0].transitions).forEach(([symbol, target]) => {
        source.transitions[symbol] = remap.get(target) ?? target;
      });
    });
    kernelGroups = [...groups.values()].map((group) => group.map((state) => state.id));
  }

  const table = buildParseTable(finalStates, grammar, ff, parser);
  const afn = grammar.productions.flatMap((prod) =>
    Array.from({ length: prod.rhs.length + 1 }, (_, dot) => formatItem({ prod: prod.id, dot }, grammar.productions)),
  );
  const nfa = withLookahead ? buildLr1Nfa(states, grammar, ff) : buildLr0Nfa(grammar);
  const dfa = parser === "LALR(1)"
    ? buildDfaGraph(states, grammar, preMergeDfaGroups)
    : buildDfaGraph(finalStates, grammar);
  const mergedDfa = parser === "LALR(1)" ? buildDfaGraph(finalStates, grammar) : undefined;
  return { states: finalStates, table, afn, nfa, dfa, mergedDfa, kernelGroups };
}

function buildLr0Nfa(grammar: Grammar): AutomataGraph {
  const nodes: AutomataGraph["nodes"] = [];
  const edges: AutomataGraph["edges"] = [];
  const nodeIds = new Set<string>();

  const addNode = (item: Item) => {
    const id = itemId(item);
    if (nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push({ id, label: formatItem(item, grammar.productions) });
  };

  grammar.productions.forEach((prod) => {
    for (let dot = 0; dot <= prod.rhs.length; dot += 1) {
      addNode({ prod: prod.id, dot });
    }
  });

  grammar.productions.forEach((prod) => {
    for (let dot = 0; dot < prod.rhs.length; dot += 1) {
      const symbol = prod.rhs[dot];
      const from = { prod: prod.id, dot };
      const shifted = { prod: prod.id, dot: dot + 1 };
      edges.push({
        from: itemId(from),
        to: itemId(shifted),
        label: symbol,
        kind: "symbol",
      });

      if (grammar.nonTerminals.includes(symbol)) {
        grammar.productions
          .filter((candidate) => candidate.lhs === symbol)
          .forEach((candidate) => {
            edges.push({
              from: itemId(from),
              to: itemId({ prod: candidate.id, dot: 0 }),
              label: "ε",
              kind: "epsilon",
            });
          });
      }
    }
  });

  return { nodes, edges };
}

function buildLr1Nfa(states: State[], grammar: Grammar, ff: FirstFollow): AutomataGraph {
  const reachableItems = new Map<string, Item>();
  states.forEach((state) => state.items.forEach((item) => reachableItems.set(itemKey(item), item)));

  const nodes: AutomataGraph["nodes"] = [...reachableItems.values()].map((item) => ({
    id: lr1ItemId(item),
    label: formatItem(item, grammar.productions),
  }));
  const edges: AutomataGraph["edges"] = [];
  const edgeKeys = new Set<string>();

  const addEdge = (from: Item, to: Item, label: string, kind: "epsilon" | "symbol") => {
    if (!reachableItems.has(itemKey(to))) return;
    const key = `${lr1ItemId(from)}>${lr1ItemId(to)}>${label}>${kind}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from: lr1ItemId(from), to: lr1ItemId(to), label, kind });
  };

  reachableItems.forEach((item) => {
    const prod = grammar.productions[item.prod];
    const symbol = prod.rhs[item.dot];
    if (!symbol) return;

    addEdge(item, { ...item, dot: item.dot + 1 }, symbol, "symbol");

    if (!grammar.nonTerminals.includes(symbol)) return;
    const lookaheads = [
      ...firstOfSequence([...prod.rhs.slice(item.dot + 1), item.lookahead ?? END], ff.first),
    ].filter((value) => value !== EPSILON);

    grammar.productions
      .filter((candidate) => candidate.lhs === symbol)
      .forEach((candidate) => {
        lookaheads.forEach((lookahead) => {
          addEdge(item, { prod: candidate.id, dot: 0, lookahead }, "ε", "epsilon");
        });
      });
  });

  return { nodes, edges };
}

function buildDfaGraph(states: State[], grammar: Grammar, colorGroups: number[][] = []): AutomataGraph {
  const colorsByState = new Map<number, string>();
  colorGroups.forEach((group, index) => {
    const color = GROUP_COLORS[index % GROUP_COLORS.length];
    group.forEach((stateId) => colorsByState.set(stateId, color));
  });

  return {
    nodes: states.map((state) => ({
      id: `I${state.id}`,
      label: [`I${state.id}`, ...state.items.map((item) => formatItem(item, grammar.productions))].join("\n"),
      color: colorsByState.get(state.id),
    })),
    edges: states.flatMap((state) =>
      Object.entries(state.transitions).map(([symbol, target]) => ({
        from: `I${state.id}`,
        to: `I${target}`,
        label: symbol,
        kind: "symbol" as const,
      })),
    ),
  };
}

function itemId(item: Item) {
  return `p${item.prod}d${item.dot}`;
}

function lr1ItemId(item: Item) {
  return `p${item.prod}d${item.dot}l${sanitizeId(item.lookahead ?? END)}`;
}

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, (char) => char.charCodeAt(0).toString(16));
}

const GROUP_COLORS = [
  "#0f766e",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#2563eb",
  "#15803d",
  "#a21caf",
  "#ca8a04",
];

function addAction(
  action: Record<string, Record<string, TableAction[]>>,
  state: number,
  symbol: string,
  entry: TableAction,
) {
  action[state] ??= {};
  action[state][symbol] ??= [];
  const label = actionLabel(entry);
  if (!action[state][symbol].some((existing) => actionLabel(existing) === label)) {
    action[state][symbol].push(entry);
  }
}

function buildParseTable(
  states: State[],
  grammar: Grammar,
  ff: FirstFollow,
  parser: ParserType,
): ParseTable {
  const action: ParseTable["action"] = {};
  const goToTable: ParseTable["goTo"] = {};
  states.forEach((state) => {
    Object.entries(state.transitions).forEach(([symbol, target]) => {
      if (grammar.terminals.includes(symbol)) {
        addAction(action, state.id, symbol, { kind: "shift", to: target });
      } else {
        goToTable[state.id] ??= {};
        goToTable[state.id][symbol] = target;
      }
    });
    state.items.forEach((item) => {
      const prod = grammar.productions[item.prod];
      if (item.dot !== prod.rhs.length) return;
      if (prod.lhs === grammar.augmentedStart) {
        addAction(action, state.id, END, { kind: "accept" });
        return;
      }
      const reduceOn =
        parser === "LR(0)"
          ? [...grammar.terminals, END]
          : parser === "LR(1)" || parser === "LALR(1)"
            ? [item.lookahead ?? END]
            : [...(ff.follow[prod.lhs] ?? new Set<string>())];
      reduceOn.forEach((symbol) =>
        addAction(action, state.id, symbol, { kind: "reduce", production: prod }),
      );
    });
  });
  const conflicts = Object.entries(action).flatMap(([state, row]) =>
    Object.entries(row)
      .filter(([, entries]) => entries.length > 1)
      .map(([symbol, entries]) => ({
        parser,
        state: Number(state),
        symbol,
        actions: entries.map(actionLabel),
        explanation:
          `${parser} state ${state} has more than one valid table action when the lookahead is ${symbol}.`,
        suggestion:
          entries.some((entry) => entry.kind === "shift")
            ? "Because one action shifts and another action reduces, the grammar needs clearer structure at this point. Inspect common prefixes, precedence, or dangling optional branches; try left factorization or a more powerful LR variant."
            : "Because multiple completed productions reduce on the same lookahead, split the grammar context or encode a clearer separator before this state is reached.",
      })),
  );
  return { action, goTo: goToTable, conflicts };
}
