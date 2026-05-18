import {
  analyzeGrammar,
  buildAstGraph,
  buildEbnfRecursiveDescentGraph,
  buildLlParseTree,
  buildLlRuleTable,
  buildLlTrace,
  buildLrParseTree,
  buildLrTrace,
  getLeftFactorSuggestions,
  getLeftRecursionSuggestions,
  getParserScore,
  parseEbnfRecursiveDescent,
  simulate,
  type Conflict,
  type LRModel,
  type ParserType,
} from "@/lib/parser-lab";
import { isLrParser } from "@/lib/parser-lab/format";

const MIN_GRAMMAR_ROWS = 4;

export type GeneratedParsing = {
  input: string;
  grammarText: string;
  parser: ParserType;
};

export function buildParserLabState({
  generatedParsing,
  grammarText,
  parser,
}: {
  generatedParsing: GeneratedParsing | null;
  grammarText: string;
  parser: ParserType;
}) {
  const analysis = analyzeGrammar(grammarText, parser);
  const selectedModel = analysis.lrModels[parser] as LRModel | undefined;
  const activeConflicts = analysis.statuses[parser] ?? [];
  const parserHasSimulationModel =
    parser === "RD" || parser === "LL(1)" || Boolean(selectedModel);
  const canGenerateParsing = Boolean(
    analysis.grammar &&
    analysis.ff &&
    !activeConflicts.length &&
    parserHasSimulationModel,
  );
  const hasGeneratedParsing = Boolean(
    generatedParsing &&
    generatedParsing.grammarText === grammarText &&
    generatedParsing.parser === parser &&
    canGenerateParsing,
  );
  const parsingInput = hasGeneratedParsing
    ? (generatedParsing?.input ?? "")
    : "";

  const rdSim =
    parser === "RD" &&
    hasGeneratedParsing &&
    analysis.rdGrammar &&
    analysis.rdFf
      ? parseEbnfRecursiveDescent(
          analysis.rdGrammar,
          analysis.rdFf,
          parsingInput,
        )
      : undefined;
  const sim = hasGeneratedParsing
    ? parser === "RD"
      ? rdSim
      : analysis.grammar
        ? simulate(analysis.grammar, selectedModel, parser, parsingInput)
        : undefined
    : undefined;

  const llRuleTable =
    analysis.grammar && analysis.ff
      ? buildLlRuleTable(analysis.grammar, analysis.ff)
      : {};
  const llTrace =
    hasGeneratedParsing && analysis.grammar && analysis.ff
      ? buildLlTrace(analysis.grammar, analysis.ff, llRuleTable, parsingInput)
      : [];
  const lrTrace =
    hasGeneratedParsing && analysis.grammar
      ? buildLrTrace(analysis.grammar, selectedModel, parsingInput)
      : [];
  const rdTransitionGraph = analysis.rdGrammar
    ? buildEbnfRecursiveDescentGraph(analysis.rdGrammar)
    : undefined;
  const astGraph = sim?.tree ? buildAstGraph(sim.tree) : undefined;
  const llParseTree =
    hasGeneratedParsing && analysis.grammar
      ? buildLlParseTree(analysis.grammar, llRuleTable, parsingInput)
      : undefined;
  const llParseTreeGraph = llParseTree ? buildAstGraph(llParseTree) : undefined;
  const lrParseTree =
    hasGeneratedParsing && analysis.grammar
      ? buildLrParseTree(analysis.grammar, selectedModel, parsingInput)
      : undefined;
  const lrParseTreeGraph = lrParseTree ? buildAstGraph(lrParseTree) : undefined;
  const llSuggestions = analysis.grammar
    ? [
        ...getLeftRecursionSuggestions(analysis.grammar),
        ...getLeftFactorSuggestions(analysis.grammar),
      ]
    : [];
  const grammarRows = Math.max(
    MIN_GRAMMAR_ROWS,
    grammarText.split("\n").length + 1,
  );
  const parserScore = getParserScore(
    analysis.statuses,
    Boolean(analysis.grammar),
  );
  const parserConflicts = (kind: ParserType): Conflict[] =>
    analysis.statuses[kind] ?? [];

  return {
    activeConflicts,
    analysis,
    astGraph,
    canGenerateParsing,
    grammarRows,
    hasGeneratedParsing,
    llParseTreeGraph,
    llRuleTable,
    llSuggestions,
    llTrace,
    lrParseTreeGraph,
    lrTrace,
    parserConflicts,
    parserScore,
    parsingInput,
    rdSim,
    rdTrace: rdSim?.rows ?? [],
    rdTransitionGraph,
    selectedModel,
    showLrViews: isLrParser(parser),
    sim,
  };
}
