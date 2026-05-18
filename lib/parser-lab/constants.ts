import type { ParserType } from "./types";

export const EPSILON = "epsilon";
export const EPSILON_SYMBOL = "ε";
export const END = "$";

export const PARSERS: ParserType[] = ["RD", "LL(1)", "LR(0)", "SLR(1)", "LALR(1)", "LR(1)"];
