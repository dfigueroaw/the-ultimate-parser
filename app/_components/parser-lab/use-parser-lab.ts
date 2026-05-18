"use client";

import { useMemo, useState } from "react";

import {
  EXAMPLES,
  type ParserExample,
  type ParserType,
} from "@/lib/parser-lab";
import {
  buildParserLabState,
  type GeneratedParsing,
} from "./model/parser-lab-state";
import {
  readSavedGrammarExamples,
  upsertSavedGrammar,
  writeSavedGrammarExamples,
} from "./model/saved-grammars";

export function useParserLab() {
  const [grammarText, setGrammarText] = useState(EXAMPLES[0].grammar);
  const [draftInput, setDraftInput] = useState(EXAMPLES[0].input);
  const [generatedParsing, setGeneratedParsing] =
    useState<GeneratedParsing | null>(null);
  const [parser, setParser] = useState<ParserType>("LL(1)");
  const [savedGrammars, setSavedGrammars] = useState<ParserExample[]>(
    readSavedGrammarExamples,
  );

  const parserState = useMemo(
    () => buildParserLabState({ generatedParsing, grammarText, parser }),
    [generatedParsing, grammarText, parser],
  );

  const state = useMemo(
    () => ({
      ...parserState,
      draftInput,
      grammarText,
      parser,
      savedGrammars,
    }),
    [draftInput, grammarText, parser, parserState, savedGrammars],
  );

  const actions = useMemo(
    () => ({
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
    }),
    [draftInput, grammarText, parser, savedGrammars],
  );

  return { actions, state };
}
