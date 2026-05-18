import { END, EPSILON, EPSILON_SYMBOL } from "./constants";
import type { Grammar, Item, Production, TableAction } from "./types";

export function formatSet(set?: Set<string>) {
  return `{ ${[...(set ?? [])].map(displaySymbol).join(", ") || "empty"} }`;
}

export function displaySymbol(symbol: string) {
  return symbol === EPSILON ? EPSILON_SYMBOL : symbol;
}

export function displaySymbols(symbols: string[]) {
  return symbols.length ? symbols.map(displaySymbol).join(" ") : EPSILON_SYMBOL;
}

export function formatProduction(prod: Pick<Production, "lhs" | "rhs">) {
  return `${prod.lhs} -> ${displaySymbols(prod.rhs)}`;
}

export function formatItem(item: Item, source: Grammar | Production[]) {
  const productions = Array.isArray(source) ? source : source.productions;
  const prod = productions[item.prod];
  const rhs = [...prod.rhs];
  rhs.splice(item.dot, 0, "•");
  return `${prod.lhs} -> ${rhs.map(displaySymbol).join(" ") || "•"}${item.lookahead ? `, ${displaySymbol(item.lookahead)}` : ""}`;
}

export function actionLabel(action: TableAction) {
  if (action.kind === "shift") return `s${action.to}`;
  if (action.kind === "accept") return "acc";
  return `r${action.production.id}`;
}

export function isLrParser(parser: string) {
  return parser.startsWith("LR") || parser === "SLR(1)" || parser === "LALR(1)";
}

export { END };
