import { END, EPSILON } from "./constants";
import {
  firstOfEbnfAlternatives,
  firstOfEbnfSequence,
  formatTerm,
} from "./ebnf";
import {
  attemptLimitMessage,
  noGroupAlternativeAction,
  PARSE_GUARD_LIMIT,
  startProcedureRemainderAction,
} from "./errors";
import { displaySymbol, displaySymbols, formatProduction } from "./format";
import { symbolMatches, tokenizeInput } from "./input";
import type {
  AutomataGraph,
  EbnfAlternative,
  EbnfGrammar,
  EbnfRule,
  EbnfTerm,
  FirstFollow,
  Grammar,
  Production,
  TreeNode,
} from "./types";

export function buildEbnfRecursiveDescentGraph(
  grammar: EbnfGrammar,
): AutomataGraph {
  const nodes: AutomataGraph["nodes"] = [];
  const edges: AutomataGraph["edges"] = [];
  let nextId = 0;

  grammar.rules.forEach((rule) => {
    const entry = addNode(`start ${rule.lhs}`, "#71717a", "circle");
    const exit = addNode(`end ${rule.lhs}`, "#71717a", "circle");
    addAlternatives(rule.alternatives, [entry], [exit]);
  });

  function addAlternatives(
    alternatives: EbnfAlternative[],
    entries: string[],
    exits: string[],
  ) {
    alternatives.forEach((alternative) =>
      addSequence(alternative, entries, exits),
    );
  }

  function addSequence(
    sequence: EbnfAlternative,
    entries: string[],
    exits: string[],
  ) {
    if (!sequence.length) {
      connect(entries, exits);
      return;
    }

    let currentEntries = entries;
    sequence.forEach((term, index) => {
      const nextExits =
        index === sequence.length - 1 ? exits : [addPassthrough()];
      addTerm(term, currentEntries, nextExits);
      currentEntries = nextExits;
    });
  }

  function addTerm(term: EbnfTerm, entries: string[], exits: string[]) {
    if (term.kind === "symbol") {
      const isProcedureCall = grammar.nonTerminals.includes(term.value);
      const symbol = addNode(
        isProcedureCall ? term.value : `"${term.value}"`,
        isProcedureCall ? "#2563eb" : undefined,
        isProcedureCall ? "box" : "ellipse",
      );
      connect(entries, [symbol]);
      connect([symbol], exits);
      return;
    }

    if (term.kind === "group") {
      addAlternatives(term.alternatives, entries, exits);
      return;
    }

    const split = addPassthrough();
    connect(entries, [split]);

    if (term.kind === "optional") {
      connect([split], exits);
      addAlternatives(term.alternatives, [split], exits);
      return;
    }

    connect([split], exits);
    addAlternatives(term.alternatives, [split], [split]);
  }

  function addNode(
    label: string,
    color?: string,
    shape: "box" | "ellipse" | "circle" | "point" = "box",
  ) {
    const id = `rail_${nextId++}`;
    nodes.push({ id, label, color, shape });
    return id;
  }

  function addPassthrough() {
    return addNode("", "#52525b", "point");
  }

  function connect(from: string[], to: string[]) {
    from.forEach((source) =>
      to.forEach((target) =>
        edges.push({ from: source, to: target, label: "" }),
      ),
    );
  }

  return { nodes, edges };
}

export function parseEbnfRecursiveDescent(
  grammar: EbnfGrammar,
  ff: FirstFollow,
  input: string,
) {
  const tokens = tokenizeInput(input);
  const steps: string[] = [];
  const rows: {
    stack: string[];
    input: string[];
    action: string;
    crossedInput?: string;
    isError?: boolean;
  }[] = [];
  const callStack: string[] = [];
  const ruleByLhs = new Map(grammar.rules.map((rule) => [rule.lhs, rule]));
  let attempts = 0;
  const result = parseRule(
    ruleByLhs.get(grammar.start),
    0,
    0,
    ff.follow[grammar.start] ?? new Set(),
  );
  const ok = Boolean(result?.ok && result.pos === tokens.length);
  if (ok) {
    rows.push({ stack: [], input: [], action: "Accept" });
  } else if (result?.pos !== undefined && result.pos < tokens.length) {
    rows.push({
      stack: [],
      input: tokens.slice(result.pos),
      action: startProcedureRemainderAction(),
      isError: true,
    });
  }

  return {
    ok,
    steps,
    rows,
    tree: result?.node,
    error: attempts > PARSE_GUARD_LIMIT ? attemptLimitMessage() : undefined,
  };

  function parseRule(
    rule: EbnfRule | undefined,
    pos: number,
    depth: number,
    contextFollow: Set<string>,
  ): { ok: boolean; pos: number; node: TreeNode } | undefined {
    if (!rule) return undefined;
    attempts += 1;
    if (attempts > PARSE_GUARD_LIMIT)
      return { ok: false, pos, node: { label: rule.lhs } };

    callStack.push(rule.lhs);
    rows.push({
      stack: [...callStack],
      input: tokens.slice(pos),
      action: `Call ${rule.lhs}()`,
    });
    steps.push(`${"  ".repeat(depth)}call ${rule.lhs}()`);

    const follow = new Set([...(ff.follow[rule.lhs] ?? []), ...contextFollow]);
    const selected = selectAlternative(
      rule.alternatives,
      tokens[pos] ?? END,
      follow,
    );
    if (!selected) {
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        action: `Error: no ${rule.lhs} alternative for lookahead ${displaySymbol(tokens[pos] ?? END)}`,
        isError: true,
      });
      callStack.pop();
      return { ok: false, pos, node: { label: rule.lhs } };
    }

    rows.push({
      stack: [...callStack],
      input: tokens.slice(pos),
      action: `Predict ${rule.lhs} = ${formatAlternative(selected)}`,
    });
    steps.push(
      `${"  ".repeat(depth)}predict ${rule.lhs} = ${formatAlternative(selected)}`,
    );
    if (isPlainCompoundAlternative(selected)) {
      const parsed = parseBranch(selected, pos, depth + 1, follow);
      callStack.pop();
      return parsed.ok
        ? {
            ok: true,
            pos: parsed.pos,
            node: { label: rule.lhs, children: parsed.children },
          }
        : {
            ok: false,
            pos,
            node: { label: rule.lhs, children: parsed.children },
          };
    }

    const parsed = parseSequence(selected, pos, depth + 1, follow);
    callStack.pop();
    return parsed.ok
      ? {
          ok: true,
          pos: parsed.pos,
          node: { label: rule.lhs, children: parsed.children },
        }
      : {
          ok: false,
          pos,
          node: { label: rule.lhs, children: parsed.children },
        };
  }

  function parseSequence(
    sequence: EbnfAlternative,
    pos: number,
    depth: number,
    follow: Set<string>,
  ) {
    let cursor = pos;
    const children: TreeNode[] = [];

    if (!sequence.length) return { ok: true, pos: cursor, children: [] };

    for (let index = 0; index < sequence.length; index += 1) {
      const term = sequence[index];
      const termFollow = followForRest(sequence.slice(index + 1), follow);
      const parsed = parseTerm(term, cursor, depth, termFollow);
      children.push(...parsed.children);
      if (!parsed.ok) return { ok: false, pos, children };
      cursor = parsed.pos;
    }
    return { ok: true, pos: cursor, children };
  }

  function parseTerm(
    term: EbnfTerm,
    pos: number,
    depth: number,
    follow: Set<string>,
  ): { ok: boolean; pos: number; children: TreeNode[] } {
    const lookahead = tokens[pos] ?? END;
    if (term.kind === "symbol") {
      if (grammar.nonTerminals.includes(term.value)) {
        const parsed = parseRule(
          ruleByLhs.get(term.value),
          pos,
          depth + 1,
          follow,
        );
        return parsed
          ? { ok: parsed.ok, pos: parsed.pos, children: [parsed.node] }
          : { ok: false, pos, children: [{ label: term.value }] };
      }
      const actual = tokens[pos];
      const ok = Boolean(actual && symbolMatches(term.value, actual));
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        crossedInput: ok ? actual : undefined,
        action: `Match ${term.value} with ${actual ?? "end"}: ${ok ? "ok" : "error"}`,
        isError: !ok,
      });
      steps.push(
        `${"  ".repeat(depth)}match ${term.value} with ${actual ?? "end"}: ${ok ? "ok" : "error"}`,
      );
      return {
        ok,
        pos: ok ? pos + 1 : pos,
        children: [{ label: ok ? actual : term.value }],
      };
    }

    if (term.kind === "optional") {
      const selected = selectAlternative(term.alternatives, lookahead, follow);
      if (selected && !isEpsilonAlternative(selected)) {
        rows.push({
          stack: [...callStack],
          input: tokens.slice(pos),
          action: `Enter optional branch: ${formatAlternative(selected)}`,
        });
        const parsed = parseBranch(selected, pos, depth + 1, follow);
        return { ok: parsed.ok, pos: parsed.pos, children: parsed.children };
      }
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        action: "Omit optional branch with ε",
      });
      return { ok: true, pos, children: [] };
    }

    if (term.kind === "repeat") {
      let cursor = pos;
      const children: TreeNode[] = [];
      for (let guard = 0; guard < PARSE_GUARD_LIMIT; guard += 1) {
        const selected = selectAlternative(
          term.alternatives,
          tokens[cursor] ?? END,
          follow,
        );
        if (!selected || isEpsilonAlternative(selected)) break;
        rows.push({
          stack: [...callStack],
          input: tokens.slice(cursor),
          action: `Repeat branch: ${formatAlternative(selected)}`,
        });
        const parsed = parseBranch(
          selected,
          cursor,
          depth + 1,
          new Set([...follow, ...firstWithoutEpsilon(term.alternatives)]),
        );
        if (!parsed.ok || parsed.pos === cursor) break;
        children.push(...parsed.children);
        cursor = parsed.pos;
      }
      rows.push({
        stack: [...callStack],
        input: tokens.slice(cursor),
        action: "Stop repetition with ε",
      });
      return { ok: true, pos: cursor, children };
    }

    const selected = selectAlternative(term.alternatives, lookahead, follow);
    if (!selected) {
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        action: noGroupAlternativeAction(lookahead),
        isError: true,
      });
      return { ok: false, pos, children: [] };
    }
    rows.push({
      stack: [...callStack],
      input: tokens.slice(pos),
      action: `Enter group branch: ${formatAlternative(selected)}`,
    });
    const parsed = parseBranch(selected, pos, depth + 1, follow);
    return {
      ok: parsed.ok,
      pos: parsed.ok ? parsed.pos : pos,
      children: parsed.ok ? parsed.children : [],
    };
  }

  function parseBranch(
    alternative: EbnfAlternative,
    pos: number,
    depth: number,
    follow: Set<string>,
  ) {
    const parsed = parseBranchParts(alternative, pos, depth, follow);
    if (!parsed.ok) return { ok: false, pos, children: parsed.children };
    return {
      ok: true,
      pos: parsed.pos,
      children: parsed.children,
    };
  }

  function parseBranchParts(
    alternative: EbnfAlternative,
    pos: number,
    depth: number,
    follow: Set<string>,
  ) {
    let cursor = pos;
    const children: TreeNode[] = [];

    if (!alternative.length) {
      return { ok: true, pos: cursor, children };
    }

    for (let index = 0; index < alternative.length; index += 1) {
      const term = alternative[index];
      const termFollow = followForRest(alternative.slice(index + 1), follow);
      const parsed = parseTermForBranch(term, cursor, depth, termFollow);
      children.push(...parsed.children);
      if (!parsed.ok) return { ok: false, pos, children };
      cursor = parsed.pos;
    }

    return { ok: true, pos: cursor, children };
  }

  function parseTermForBranch(
    term: EbnfTerm,
    pos: number,
    depth: number,
    follow: Set<string>,
  ): { ok: boolean; pos: number; children: TreeNode[] } {
    const lookahead = tokens[pos] ?? END;

    if (term.kind === "symbol") {
      if (grammar.nonTerminals.includes(term.value)) {
        const parsed = parseRule(
          ruleByLhs.get(term.value),
          pos,
          depth + 1,
          follow,
        );
        return parsed
          ? { ok: parsed.ok, pos: parsed.pos, children: [parsed.node] }
          : { ok: false, pos, children: [{ label: term.value }] };
      }

      const actual = tokens[pos];
      const ok = Boolean(actual && symbolMatches(term.value, actual));
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        crossedInput: ok ? actual : undefined,
        action: `Match ${term.value} with ${actual ?? "end"}: ${ok ? "ok" : "error"}`,
        isError: !ok,
      });
      steps.push(
        `${"  ".repeat(depth)}match ${term.value} with ${actual ?? "end"}: ${ok ? "ok" : "error"}`,
      );
      return {
        ok,
        pos: ok ? pos + 1 : pos,
        children: [{ label: ok ? actual : term.value }],
      };
    }

    if (term.kind === "optional") {
      const selected = selectAlternative(term.alternatives, lookahead, follow);
      if (selected && !isEpsilonAlternative(selected)) {
        rows.push({
          stack: [...callStack],
          input: tokens.slice(pos),
          action: `Enter optional branch: ${formatAlternative(selected)}`,
        });
        return parseBranchParts(selected, pos, depth + 1, follow);
      }
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        action: "Omit optional branch with ε",
      });
      return { ok: true, pos, children: [] };
    }

    if (term.kind === "repeat") {
      let cursor = pos;
      const children: TreeNode[] = [];
      for (let guard = 0; guard < PARSE_GUARD_LIMIT; guard += 1) {
        const selected = selectAlternative(
          term.alternatives,
          tokens[cursor] ?? END,
          follow,
        );
        if (!selected || isEpsilonAlternative(selected)) break;
        rows.push({
          stack: [...callStack],
          input: tokens.slice(cursor),
          action: `Repeat branch: ${formatAlternative(selected)}`,
        });
        const parsed = parseBranchParts(
          selected,
          cursor,
          depth + 1,
          new Set([...follow, ...firstWithoutEpsilon(term.alternatives)]),
        );
        if (!parsed.ok || parsed.pos === cursor) break;
        children.push(...parsed.children);
        cursor = parsed.pos;
      }
      rows.push({
        stack: [...callStack],
        input: tokens.slice(cursor),
        action: "Stop repetition with ε",
      });
      return { ok: true, pos: cursor, children };
    }

    const selected = selectAlternative(term.alternatives, lookahead, follow);
    if (!selected) {
      rows.push({
        stack: [...callStack],
        input: tokens.slice(pos),
        action: noGroupAlternativeAction(lookahead),
        isError: true,
      });
      return { ok: false, pos, children: [] };
    }
    rows.push({
      stack: [...callStack],
      input: tokens.slice(pos),
      action: `Enter group branch: ${formatAlternative(selected)}`,
    });
    return parseBranchParts(selected, pos, depth + 1, follow);
  }

  function selectAlternative(
    alternatives: EbnfAlternative[],
    lookahead: string,
    follow: Set<string>,
  ) {
    for (const alternative of alternatives) {
      const first = firstOfEbnfSequence(alternative, ff.first, grammar);
      if (
        [...first].some(
          (symbol) => symbol !== EPSILON && symbolMatches(symbol, lookahead),
        )
      )
        return alternative;
    }
    return (
      alternatives.find((alternative) => {
        const first = firstOfEbnfSequence(alternative, ff.first, grammar);
        return first.has(EPSILON) && follow.has(lookahead);
      }) ?? null
    );
  }

  function followForRest(rest: EbnfAlternative, parentFollow: Set<string>) {
    const first = firstOfEbnfSequence(rest, ff.first, grammar);
    const follow = new Set([...first].filter((symbol) => symbol !== EPSILON));
    if (first.has(EPSILON))
      parentFollow.forEach((symbol) => follow.add(symbol));
    return follow;
  }

  function firstWithoutEpsilon(alternatives: EbnfAlternative[]) {
    return [...firstOfEbnfAlternatives(alternatives, ff.first, grammar)].filter(
      (symbol) => symbol !== EPSILON,
    );
  }

  function isEpsilonAlternative(alternative: EbnfAlternative) {
    return (
      firstOfEbnfSequence(alternative, ff.first, grammar).has(EPSILON) &&
      !alternative.length
    );
  }

  function isPlainCompoundAlternative(alternative: EbnfAlternative) {
    return (
      alternative.length > 1 &&
      alternative.every((term) => term.kind === "symbol")
    );
  }

  function formatAlternative(alternative: EbnfAlternative) {
    return alternative.map(formatTerm).join(" , ") || displaySymbol(EPSILON);
  }
}

export function buildRecursiveDescentGraph(grammar: Grammar): AutomataGraph {
  const nodes: AutomataGraph["nodes"] = [];
  const edges: AutomataGraph["edges"] = [];

  grammar.nonTerminals.forEach((nonTerminal) => {
    const procedureId = procedureNodeId(nonTerminal);
    nodes.push({ id: procedureId, label: `${nonTerminal}()` });

    grammar.productions
      .filter((prod) => prod.lhs === nonTerminal)
      .forEach((prod, productionIndex) => {
        const productionId = productionNodeId(prod);
        nodes.push({ id: productionId, label: formatProduction(prod) });
        edges.push({
          from: procedureId,
          to: productionId,
          label:
            grammar.productions.filter(
              (candidate) => candidate.lhs === nonTerminal,
            ).length > 1
              ? `alt ${productionIndex + 1}`
              : "",
        });

        if (!prod.rhs.length) {
          const epsilonId = `${productionId}_epsilon`;
          nodes.push({ id: epsilonId, label: "ε" });
          edges.push({ from: productionId, to: epsilonId, label: "" });
          return;
        }

        prod.rhs.forEach((symbol, symbolIndex) => {
          const symbolId = `${productionId}_s${symbolIndex}`;
          const isProcedureCall = grammar.nonTerminals.includes(symbol);
          nodes.push({
            id: symbolId,
            label: isProcedureCall ? `${symbol}()` : symbol,
            color: isProcedureCall ? "#2563eb" : undefined,
          });
          edges.push({
            from: productionId,
            to: symbolId,
            label: String(symbolIndex + 1),
          });
        });
      });
  });

  return { nodes, edges };
}

export function buildAstGraph(tree: TreeNode): AutomataGraph {
  const nodes: AutomataGraph["nodes"] = [];
  const edges: AutomataGraph["edges"] = [];
  let nextId = 0;

  const visit = (node: TreeNode, parentId?: string) => {
    const id = `ast_${nextId}`;
    nextId += 1;
    nodes.push({ id, label: displaySymbol(node.label) });
    if (parentId) edges.push({ from: parentId, to: id, label: "" });
    node.children?.forEach((child) => visit(child, id));
  };

  visit(tree);
  return { nodes, edges };
}

function procedureNodeId(nonTerminal: string) {
  return `procedure_${sanitizeId(nonTerminal)}`;
}

function productionNodeId(production: Production) {
  return `production_${production.id}_${sanitizeId(production.lhs)}_${sanitizeId(displaySymbols(production.rhs))}`;
}

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, (char) =>
    char.charCodeAt(0).toString(16),
  );
}
