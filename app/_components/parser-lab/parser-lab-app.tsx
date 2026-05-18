"use client";

import {
  ExamplePanel,
  GrammarInputPanel,
  ParserCoveragePanel,
} from "./controls";
import { exportParserCode } from "./model/code-export";
import { exportGrammarReport } from "./pdf-report";
import { ParserResults } from "./parser-results";
import { useParserLab } from "./use-parser-lab";

export function ParserLabApp() {
  const { actions, state } = useParserLab();

  return (
    <main className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5 px-4 py-5 lg:px-6">
        <header className="py-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            The Ultimate Parser
          </h1>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <GrammarInputPanel
            grammarText={state.grammarText}
            grammarRows={state.grammarRows}
            onGrammarChange={actions.setGrammarText}
            onCodeExport={(settings) =>
              exportParserCode(state.grammarText, settings)
            }
            onGrammarExport={() =>
              exportGrammarReport({
                activeConflicts: state.activeConflicts,
                analysis: state.analysis,
                grammarText: state.grammarText,
                llRuleTable: state.llRuleTable,
                llSuggestions: state.llSuggestions,
                parser: state.parser,
                parserScore: state.parserScore,
                rdTransitionGraph: state.rdTransitionGraph,
                selectedModel: state.selectedModel,
              })
            }
            onSaveGrammar={actions.saveCurrentGrammar}
          />
          <ExamplePanel
            savedExamples={state.savedGrammars}
            onExampleSelect={actions.loadExample}
            onSavedExampleRemove={actions.removeSavedGrammar}
          />
          <ParserCoveragePanel
            parser={state.parser}
            parserScore={state.parserScore}
            parserConflicts={state.parserConflicts}
            onParserChange={actions.setParser}
          />
        </section>

        <ParserResults
          activeConflicts={state.activeConflicts}
          analysis={state.analysis}
          astGraph={state.astGraph}
          canGenerateParsing={state.canGenerateParsing}
          draftInput={state.draftInput}
          grammarText={state.grammarText}
          hasGeneratedParsing={state.hasGeneratedParsing}
          llParseTreeGraph={state.llParseTreeGraph}
          llRuleTable={state.llRuleTable}
          llSuggestions={state.llSuggestions}
          llTrace={state.llTrace}
          lrParseTreeGraph={state.lrParseTreeGraph}
          lrTrace={state.lrTrace}
          parser={state.parser}
          parsingInput={state.parsingInput}
          rdTrace={state.rdTrace}
          rdTransitionGraph={state.rdTransitionGraph}
          selectedModel={state.selectedModel}
          showLrViews={state.showLrViews}
          sim={state.sim}
          onDraftInputChange={actions.setDraftInput}
          onGenerateParsing={actions.generateParsing}
        />
      </div>
    </main>
  );
}
