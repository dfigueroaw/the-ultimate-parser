import { END, EPSILON } from "./constants";
import {
  PARSE_GUARD_LIMIT,
  recursiveDescentAttemptLimitAction,
  simulationGuardAction,
  startProcedureRemainderAction,
} from "./errors";
import { actionLabel, displaySymbol, formatProduction } from "./format";
import { firstOfSequence } from "./grammar";
import { symbolMatches, tokenizeInput } from "./input";
import type {
  FirstFollow,
  Grammar,
  LlRuleTable,
  LlTraceRow,
  LRModel,
  LrTraceRow,
  Production,
  RdTraceRow,
} from "./types";

function chooseRdProduction(
  grammar: Grammar,
  ff: FirstFollow,
  nonTerminal: string,
  lookahead: string,
) {
  const productions = grammar.productions.filter(
    (prod) => prod.lhs === nonTerminal,
  );
  return (
    productions.find((prod) => {
      const first = firstOfSequence(prod.rhs, ff.first);
      return (
        first.has(lookahead) ||
        (first.has(EPSILON) && ff.follow[nonTerminal]?.has(lookahead))
      );
    }) ??
    productions[0] ??
    null
  );
}

export function buildRdTrace(
  grammar: Grammar,
  ff: FirstFollow,
  input: string,
): RdTraceRow[] {
  const remaining = tokenizeInput(input);
  const rows: RdTraceRow[] = [];
  const callStack: string[] = [];
  let attempts = 0;
  let stopped = false;

  function callProcedure(nonTerminal: string): boolean {
    attempts += 1;
    callStack.push(nonTerminal);

    if (attempts > PARSE_GUARD_LIMIT) {
      rows.push({
        stack: [...callStack],
        input: [...remaining],
        action: recursiveDescentAttemptLimitAction(),
        isError: true,
      });
      stopped = true;
      callStack.pop();
      return false;
    }

    const lookahead = remaining[0] ?? END;
    const production = chooseRdProduction(grammar, ff, nonTerminal, lookahead);
    if (!production) {
      rows.push({
        stack: [...callStack],
        input: [...remaining],
        action: `Error: no production for ${nonTerminal}`,
        isError: true,
      });
      callStack.pop();
      return false;
    }

    rows.push({
      stack: [...callStack],
      input: [...remaining],
      action: `Choose ${formatProduction(production)}`,
    });

    for (const symbol of production.rhs) {
      if (stopped) break;
      if (symbol === EPSILON) continue;

      if (grammar.nonTerminals.includes(symbol)) {
        rows.push({
          stack: [...callStack],
          input: [...remaining],
          action: `Call procedure ${symbol}()`,
        });
        if (!callProcedure(symbol)) {
          callStack.pop();
          return false;
        }
        continue;
      }

      if (remaining[0] && symbolMatches(symbol, remaining[0])) {
        rows.push({
          stack: [...callStack],
          input: [...remaining],
          crossedInput: remaining[0],
          action: `Match ${displaySymbol(symbol)} and advance input`,
        });
        remaining.shift();
      } else {
        rows.push({
          stack: [...callStack],
          input: [...remaining],
          action: `Error: expected ${displaySymbol(symbol)}, found ${displaySymbol(remaining[0] ?? "end")}`,
          isError: true,
        });
        callStack.pop();
        return false;
      }
    }

    callStack.pop();
    return !stopped;
  }

  const ok = callProcedure(grammar.start);
  if (ok && remaining.length) {
    rows.push({
      stack: [],
      input: [...remaining],
      action: startProcedureRemainderAction(),
      isError: true,
    });
  } else if (ok && !remaining.length) {
    rows.push({ stack: [], input: [], action: "Accept" });
  }

  return rows;
}

export function buildLlTrace(
  grammar: Grammar,
  ff: FirstFollow,
  llRuleTable: LlRuleTable,
  input: string,
): LlTraceRow[] {
  const inputTokens = tokenizeInput(input);
  const stack: string[] = [grammar.start];
  const remaining = [...inputTokens];
  const rows: LlTraceRow[] = [];

  for (let guard = 0; guard < PARSE_GUARD_LIMIT; guard += 1) {
    const top = stack[stack.length - 1];
    const lookahead = remaining[0] ?? END;

    if (!top && !remaining.length) {
      rows.push({ stack: [], input: [], action: "Accept" });
      return rows;
    }

    if (!top) {
      rows.push({
        stack: [],
        input: [...remaining],
        action: "Error: stack is empty before input is consumed",
        isError: true,
      });
      return rows;
    }

    if (!grammar.nonTerminals.includes(top)) {
      if (remaining[0] && symbolMatches(top, remaining[0])) {
        rows.push({
          stack: [...stack],
          input: [...remaining],
          crossedStack: top,
          crossedInput: remaining[0],
          action: `Match ${top}`,
        });
        stack.pop();
        remaining.shift();
        continue;
      }
      rows.push({
        stack: [...stack],
        input: [...remaining],
        action: `Error: expected ${top}, found ${remaining[0] ?? "end"}`,
        isError: true,
      });
      return rows;
    }

    const tableEntry = llRuleTable[top]?.[lookahead] ?? [];
    if (!tableEntry.length) {
      if (ff.follow[top]?.has(lookahead)) {
        rows.push({
          stack: [...stack],
          input: [...remaining],
          action: `Extract ${top}: M[${top}, ${displaySymbol(lookahead)}] is empty and ${displaySymbol(lookahead)} ∈ FOLLOW(${top})`,
        });
        stack.pop();
        continue;
      }
      if (lookahead !== END) {
        rows.push({
          stack: [...stack],
          input: [...remaining],
          crossedInput: remaining[0],
          action: `Explore ${displaySymbol(lookahead)}: M[${top}, ${displaySymbol(lookahead)}] is empty and ${displaySymbol(lookahead)} ∉ FOLLOW(${top})`,
        });
        remaining.shift();
        continue;
      }
      rows.push({
        stack: [...stack],
        input: [...remaining],
        action: `Error: no recovery action in M[${top}, ${displaySymbol(lookahead)}]`,
        isError: true,
      });
      return rows;
    }
    if (tableEntry.length > 1) {
      rows.push({
        stack: [...stack],
        input: [...remaining],
        action: `Conflict in M[${top}, ${displaySymbol(lookahead)}]: ${tableEntry.map(formatProduction).join(" | ")}`,
        isError: true,
      });
      return rows;
    }

    const production = tableEntry[0];

    rows.push({
      stack: [...stack],
      input: [...remaining],
      action: `Reduction M[${production.lhs}, ${displaySymbol(lookahead)}] = ${formatProduction(production)}`,
    });
    stack.pop();
    production.rhs
      .filter((symbol) => symbol !== EPSILON)
      .slice()
      .reverse()
      .forEach((symbol) => stack.push(symbol));
  }

  rows.push({
    stack: [...stack],
    input: [...remaining],
    action: simulationGuardAction(),
    isError: true,
  });
  return rows;
}

export function buildLrTrace(
  grammar: Grammar,
  model: LRModel | undefined,
  input: string,
): LrTraceRow[] {
  if (!model) {
    return [
      {
        stack: ["0"],
        input: tokenizeInput(input),
        action: "No LR model available.",
        isError: true,
      },
    ];
  }

  const stack = ["0"];
  const remaining = [...tokenizeInput(input), END];
  const rows: LrTraceRow[] = [];

  for (let guard = 0; guard < PARSE_GUARD_LIMIT; guard += 1) {
    const state = Number(stack[stack.length - 1]);
    const lookahead = remaining[0] ?? END;
    const actions = model.table.action[state]?.[lookahead] ?? [];

    if (actions.length > 1) {
      rows.push({
        stack: [...stack],
        input: [...remaining],
        action: `Conflict in state ${state} with ${displaySymbol(lookahead)}: ${actions.map(actionLabel).join(" / ")}`,
        isError: true,
      });
      return rows;
    }

    if (!actions.length) {
      rows.push({
        stack: [...stack],
        input: [...remaining],
        action: `Error: no action for state ${state} with ${displaySymbol(lookahead)}`,
        isError: true,
      });
      return rows;
    }

    const action = actions[0];
    if (action.kind === "accept") {
      rows.push({ stack: [...stack], input: [...remaining], action: "Accept" });
      return rows;
    }

    if (action.kind === "shift") {
      rows.push({
        stack: [...stack],
        input: [...remaining],
        action: `Shift ${displaySymbol(lookahead)} and go to state ${action.to}`,
      });
      stack.push(lookahead, String(action.to));
      remaining.shift();
      continue;
    }

    pushReduction(grammar, stack, remaining, rows, action.production, model);
    if (rows[rows.length - 1]?.isError) return rows;
  }

  rows.push({
    stack: [...stack],
    input: [...remaining],
    action: simulationGuardAction(),
    isError: true,
  });
  return rows;
}

function pushReduction(
  grammar: Grammar,
  stack: string[],
  remaining: string[],
  rows: LrTraceRow[],
  production: Production,
  model: LRModel,
) {
  const popCount = production.rhs.length * 2;
  rows.push({
    stack: [...stack],
    input: [...remaining],
    action: `Reduce using ${formatProduction(production)}`,
  });
  if (popCount) stack.splice(Math.max(1, stack.length - popCount), popCount);
  const gotoSource = Number(stack[stack.length - 1]);
  const target = model.table.goTo[gotoSource]?.[production.lhs];
  if (target === undefined) {
    rows.push({
      stack: [...stack],
      input: [...remaining],
      action: `Error: missing goto from state ${gotoSource} on ${production.lhs}`,
      isError: true,
    });
    return;
  }
  stack.push(production.lhs, String(target));
}
