"use client";

import { useMemo, useState } from "react";

import {
  analyzeGrammar,
  buildAstGraph,
  buildEbnfRecursiveDescentGraph,
  buildLlParseTree,
  buildLlRuleTable,
  buildLlTrace,
  buildLrParseTree,
  buildLrTrace,
  EXAMPLES,
  getLeftFactorSuggestions,
  getLeftRecursionSuggestions,
  getParserScore,
  parseEbnfRecursiveDescent,
  simulate,
  type Conflict,
  type LRModel,
  type ParserExample,
  type ParserType,
} from "@/lib/parser-lab";
import { isLrParser } from "@/lib/parser-lab/format";

type GeneratedParsing = {
  input: string;
  grammarText: string;
  parser: ParserType;
};

const SAVED_GRAMMARS_KEY = "parser-lab.saved-grammars";

type SavedGrammarRecord = {
  id: string;
  name: string;
  grammar: string;
};

export function useParserLab() {
  const [grammarText, setGrammarText] = useState(EXAMPLES[0].grammar);
  const [draftInput, setDraftInput] = useState(EXAMPLES[0].input);
  const [generatedParsing, setGeneratedParsing] =
    useState<GeneratedParsing | null>(null);
  const [parser, setParser] = useState<ParserType>("LL(1)");
  const [savedGrammars, setSavedGrammars] = useState<ParserExample[]>(
    readSavedGrammarExamples,
  );

  const analysis = useMemo(
    () => analyzeGrammar(grammarText, parser),
    [grammarText, parser],
  );

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
  const grammarRows = Math.max(4, grammarText.split("\n").length + 1);
  const parserScore = getParserScore(
    analysis.statuses,
    Boolean(analysis.grammar),
  );
  const parserConflicts = (kind: ParserType): Conflict[] =>
    analysis.statuses[kind] ?? [];
  const showLrViews = isLrParser(parser);

  return {
    actions: {
      generateParsing: () =>
        setGeneratedParsing({ input: draftInput, grammarText, parser }),
      loadExample: (example: ParserExample) => {
        setGrammarText(example.grammar);
        setDraftInput(example.input);
      },
      removeSavedGrammar: (id: string) => {
        const next = savedGrammars.filter((example) => example.id !== id);
        setSavedGrammars(next);
        writeSavedGrammarExamples(next);
      },
      saveCurrentGrammar: (name: string) => {
        const next = upsertSavedGrammar(savedGrammars, name, grammarText);
        setSavedGrammars(next);
        writeSavedGrammarExamples(next);
      },
      setDraftInput,
      setGrammarText,
      setParser,
    },
    state: {
      activeConflicts,
      analysis,
      astGraph,
      canGenerateParsing,
      draftInput,
      grammarRows,
      grammarText,
      hasGeneratedParsing,
      llParseTreeGraph,
      llRuleTable,
      llSuggestions,
      llTrace,
      lrParseTreeGraph,
      lrTrace,
      parser,
      parserConflicts,
      parserScore,
      parsingInput,
      rdSim,
      rdTrace: rdSim?.rows ?? [],
      rdTransitionGraph,
      savedGrammars,
      selectedModel,
      showLrViews,
      sim,
    },
  };
}

function readSavedGrammarExamples(): ParserExample[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_GRAMMARS_KEY);
    if (!raw) return [];
    const records = JSON.parse(raw) as SavedGrammarRecord[];
    if (!Array.isArray(records)) return [];
    return records.flatMap(savedRecordToExample);
  } catch {
    return [];
  }
}

function writeSavedGrammarExamples(examples: ParserExample[]) {
  if (typeof window === "undefined") return;

  const records = examples.map(
    (example): SavedGrammarRecord => ({
      id: example.id,
      name: example.name,
      grammar: example.grammar,
    }),
  );
  window.localStorage.setItem(SAVED_GRAMMARS_KEY, JSON.stringify(records));
}

function upsertSavedGrammar(
  current: ParserExample[],
  requestedName: string,
  grammar: string,
) {
  const name = requestedName.trim() || "Saved grammar";
  const id = `saved-${slugify(name) || "grammar"}`;
  const nextExample: ParserExample = {
    id,
    name,
    topic: "Saved locally",
    grammar,
    input: "",
  };
  return [nextExample, ...current.filter((example) => example.id !== id)];
}

function savedRecordToExample(record: SavedGrammarRecord): ParserExample[] {
  if (
    !record ||
    typeof record.name !== "string" ||
    typeof record.grammar !== "string"
  ) {
    return [];
  }

  return [
    {
      id:
        typeof record.id === "string"
          ? record.id
          : `saved-${slugify(record.name) || "grammar"}`,
      name: record.name,
      topic: "Saved locally",
      grammar: record.grammar,
      input: "",
    },
  ];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
