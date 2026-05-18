import { END } from "./constants";
import { displaySymbol } from "./format";

export const PARSE_GUARD_LIMIT = 1000;
export const LR_SIMULATION_GUARD_LIMIT = 80;

export class ParserLabError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParserLabError";
  }
}

export function parserErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to analyze grammar.";
}

export function expectedTokenMessage(
  expected: string,
  tokenIndex: number,
  actual?: string,
) {
  return actual
    ? `Expected "${expected}" near token ${tokenIndex}, found ${displaySymbol(actual)}.`
    : `Expected "${expected}" near token ${tokenIndex}.`;
}

export function invalidGrammarTokenMessage(character: string, index: number) {
  return `Unexpected character ${JSON.stringify(character)} at position ${index}.`;
}

export function noRulesMessage() {
  return "No ISO14977 rules were found.";
}

export function attemptLimitMessage() {
  return "Parsing stopped after 1000 attempts. This grammar likely causes infinite recursion for this parser.";
}

export function attemptLimitAction() {
  return "Error: parse attempt limit reached. The grammar may contain infinite recursion for this parser.";
}

export function recursiveDescentAttemptLimitAction() {
  return "Error: recursive-descent attempt limit reached. The grammar may contain infinite recursion.";
}

export function simulationGuardAction() {
  return "Error: simulation guard reached";
}

export function startProcedureRemainderAction() {
  return "Error: input remains after the start procedure returned";
}

export function endDisplay(value: string | undefined) {
  return value ?? "end";
}

export function noGroupAlternativeAction(lookahead: string) {
  return `Error: no group alternative for lookahead ${displaySymbol(lookahead ?? END)}`;
}
