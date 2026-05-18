import type React from "react";

import {
  actionLabel,
  displaySymbol,
  END,
  formatProduction,
  formatSet,
  type FirstFollow,
  type Grammar,
  type LlRuleTable,
  type LlTraceRow,
  type LRModel,
  type LrTraceRow,
  type RdTraceRow,
} from "@/lib/parser-lab";
import { cn } from "@/lib/utils";

const TABLE_HEAD_CELL = "border-b border-zinc-800 p-2 text-left text-zinc-500";
const TABLE_HEAD_MONO_CELL = `${TABLE_HEAD_CELL} font-mono`;
const TABLE_BODY_CELL = "border-b border-zinc-900 p-2 font-mono text-zinc-400";
const TABLE_BODY_WHITE_CELL =
  "border-b border-zinc-900 p-2 font-mono text-white";

function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-max border-collapse bg-black text-xs">
        {children}
      </table>
    </div>
  );
}

function HeaderCell({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <th className={mono ? TABLE_HEAD_MONO_CELL : TABLE_HEAD_CELL}>
      {children}
    </th>
  );
}

export function FirstFollowTable({
  symbols,
  ff,
}: {
  symbols: string[];
  ff: FirstFollow;
}) {
  return (
    <TableFrame>
      <thead className="bg-zinc-950">
        <tr>
          <HeaderCell>Non-terminal</HeaderCell>
          <HeaderCell>Firsts</HeaderCell>
          <HeaderCell>Follows</HeaderCell>
        </tr>
      </thead>
      <tbody>
        {symbols.map((symbol) => (
          <tr key={symbol}>
            <td className={TABLE_BODY_WHITE_CELL}>{symbol}</td>
            <td className={TABLE_BODY_CELL}>{formatSet(ff.first[symbol])}</td>
            <td className={TABLE_BODY_CELL}>{formatSet(ff.follow[symbol])}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

export function LlRuleTableView({
  grammar,
  ff,
  table,
}: {
  grammar: Grammar;
  ff: FirstFollow;
  table: LlRuleTable;
}) {
  const terminals = [...grammar.terminals, END];
  return (
    <TableFrame>
      <thead className="bg-zinc-950">
        <tr>
          <HeaderCell>Non-terminal</HeaderCell>
          {terminals.map((terminal) => (
            <HeaderCell key={terminal} mono>
              {displaySymbol(terminal)}
            </HeaderCell>
          ))}
        </tr>
      </thead>
      <tbody>
        {grammar.nonTerminals.map((nonTerminal) => (
          <tr key={nonTerminal}>
            <td className={TABLE_BODY_WHITE_CELL}>{nonTerminal}</td>
            {terminals.map((terminal) => {
              const entries = table[nonTerminal]?.[terminal] ?? [];
              const recoveryAction = ff.follow[nonTerminal]?.has(terminal)
                ? "Extract"
                : "Explore";
              return (
                <td
                  key={terminal}
                  className={cn(
                    `${TABLE_BODY_CELL} align-top`,
                    entries.length > 1 && "bg-red-950/30 text-red-100",
                    !entries.length &&
                      recoveryAction === "Extract" &&
                      "bg-amber-950/20 text-amber-200",
                    !entries.length &&
                      recoveryAction === "Explore" &&
                      "bg-sky-950/20 text-sky-200",
                  )}
                >
                  {entries.length
                    ? entries.map((prod) => (
                        <div key={prod.id}>{formatProduction(prod)}</div>
                      ))
                    : recoveryAction}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

function TraceTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: {
    stack: string[];
    input: string[];
    action: string;
    isError?: boolean;
    crossedStack?: string;
    crossedInput?: string;
  }[];
}) {
  return (
    <TableFrame>
      <thead className="bg-zinc-950">
        <tr>
          {columns.map((column) => (
            <HeaderCell key={column}>{column}</HeaderCell>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={`${row.action}-${index}`}
            className={cn(row.isError && "bg-red-950/20")}
          >
            <td className="border-b border-zinc-900 p-2 font-mono text-zinc-300">
              <SymbolSequence
                symbols={row.stack}
                crossedIndex={
                  row.crossedStack ? row.stack.length - 1 : undefined
                }
              />
            </td>
            <td className="border-b border-zinc-900 p-2 font-mono text-zinc-300">
              <SymbolSequence
                symbols={row.input}
                crossedIndex={row.crossedInput ? 0 : undefined}
              />
            </td>
            <td className={cn(TABLE_BODY_CELL, row.isError && "text-red-200")}>
              {row.action}
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

export function LlTraceTable({ rows }: { rows: LlTraceRow[] }) {
  return <TraceTable columns={["Stack", "Input", "Action"]} rows={rows} />;
}

export function LrTraceTable({ rows }: { rows: LrTraceRow[] }) {
  return <TraceTable columns={["Stack", "Input", "Action"]} rows={rows} />;
}

export function RdTraceTable({ rows }: { rows: RdTraceRow[] }) {
  return (
    <TraceTable columns={["Procedure stack", "Input", "Action"]} rows={rows} />
  );
}

function SymbolSequence({
  symbols,
  crossedIndex,
}: {
  symbols: string[];
  crossedIndex?: number;
}) {
  if (!symbols.length) return <span className="text-zinc-700">&nbsp;</span>;
  return (
    <>
      {symbols.map((symbol, index) => (
        <span
          key={`${symbol}-${index}`}
          className={cn(
            index === crossedIndex &&
              "text-zinc-500 line-through decoration-red-400 decoration-2",
          )}
        >
          {index > 0 ? " " : ""}
          {displaySymbol(symbol)}
        </span>
      ))}
    </>
  );
}

export function LrTable({
  model,
  grammar,
}: {
  model?: LRModel;
  grammar: Grammar;
}) {
  if (!model) return null;
  const terminals = [...grammar.terminals, END];
  const gotoColumns = grammar.nonTerminals.filter(
    (symbol) => symbol !== grammar.augmentedStart,
  );
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-max border-collapse bg-black text-xs">
        <thead className="sticky top-0 bg-zinc-950">
          <tr>
            <HeaderCell>State</HeaderCell>
            {terminals.map((terminal) => (
              <HeaderCell key={terminal} mono>
                {displaySymbol(terminal)}
              </HeaderCell>
            ))}
            {gotoColumns.map((nonTerminal) => (
              <HeaderCell key={nonTerminal} mono>
                {nonTerminal}
              </HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.states.map((state) => (
            <tr key={state.id}>
              <td className={TABLE_BODY_WHITE_CELL}>I{state.id}</td>
              {terminals.map((terminal) => {
                const entries = model.table.action[state.id]?.[terminal] ?? [];
                return (
                  <td
                    key={terminal}
                    className={cn(
                      TABLE_BODY_CELL,
                      entries.length > 1 && "bg-red-950/30 text-red-100",
                    )}
                  >
                    {entries.map(actionLabel).join(" / ")}
                  </td>
                );
              })}
              {gotoColumns.map((nonTerminal) => (
                <td key={nonTerminal} className={TABLE_BODY_CELL}>
                  {model.table.goTo[state.id]?.[nonTerminal] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
