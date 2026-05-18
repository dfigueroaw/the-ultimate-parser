import { PARSERS } from "./constants";
import { buildLlConflicts, getLeftRecursionSuggestions } from "./diagnostics";
import { computeEbnfFirstFollow, parseEbnf } from "./ebnf";
import { parserErrorMessage } from "./errors";
import { computeFirstFollow, parseIsoEbnf } from "./grammar";
import { buildLrModel } from "./lr";
import type { Conflict, LRModel, ParserAnalysis, ParserType } from "./types";

const LR_PARSERS: ParserType[] = ["LR(0)", "SLR(1)", "LR(1)", "LALR(1)"];

export function analyzeGrammar(
  grammarText: string,
  parser: ParserType,
): ParserAnalysis {
  try {
    const grammar = parseIsoEbnf(grammarText, parser);
    const rdGrammar = parseEbnf(grammarText);
    const rdFf = computeEbnfFirstFollow(rdGrammar);
    const ff = computeFirstFollow(grammar);
    const lrModels = buildLrModels(grammarText);
    const llConflicts = buildLlConflicts(grammar, ff);
    const leftRecursionSuggestions = getLeftRecursionSuggestions(grammar);
    const statuses: Record<ParserType, Conflict[]> = {
      RD: leftRecursionSuggestions.length
        ? [
            {
              parser: "RD",
              subject: grammar.start,
              symbol: grammar.start,
              actions: ["direct left recursion"],
              explanation: `${grammar.start} has direct left recursion, so recursive descent would call the same rule before consuming input.`,
              suggestion: leftRecursionSuggestions
                .map((item) => `${item.body}\n${item.details}`)
                .join("\n\n"),
            },
          ]
        : [],
      "LL(1)": llConflicts,
      "LR(0)": lrModels["LR(0)"]?.table.conflicts ?? [],
      "SLR(1)": lrModels["SLR(1)"]?.table.conflicts ?? [],
      "LALR(1)": lrModels["LALR(1)"]?.table.conflicts ?? [],
      "LR(1)": lrModels["LR(1)"]?.table.conflicts ?? [],
    };

    return { grammar, rdGrammar, rdFf, ff, lrModels, statuses, error: "" };
  } catch (error) {
    return { lrModels: {}, statuses: {}, error: parserErrorMessage(error) };
  }
}

export function getParserScore(
  statuses: Partial<Record<ParserType, Conflict[]>>,
  hasGrammar: boolean,
) {
  if (!hasGrammar) return 0;
  return (
    (PARSERS.filter((kind) => !(statuses[kind] ?? []).length).length /
      PARSERS.length) *
    100
  );
}

function buildLrModels(grammarText: string) {
  return LR_PARSERS.reduce<Partial<Record<ParserType, LRModel>>>(
    (models, kind) => {
      const grammar = parseIsoEbnf(grammarText, kind);
      models[kind] = buildLrModel(grammar, computeFirstFollow(grammar), kind);
      return models;
    },
    {},
  );
}
