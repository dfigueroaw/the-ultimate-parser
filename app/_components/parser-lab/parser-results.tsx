import {
  AlertTriangle,
  FileText,
  Network,
  Play,
  Sparkles,
  Table2,
  TreePine,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  AutomataGraph,
  Conflict,
  FirstFollow,
  Grammar,
  GrammarSuggestion,
  LlRuleTable,
  LlTraceRow,
  LRModel,
  LrTraceRow,
  ParserAnalysis,
  ParserType,
  RdTraceRow,
  SimulationResult,
} from "@/lib/parser-lab";
import { GraphvizDiagram } from "./graphviz-diagram";
import { Panel } from "./panel";
import { exportStringDerivationReport } from "./pdf-report";
import { ParsingPanel } from "./parsing-panel";
import {
  FirstFollowTable,
  LlRuleTableView,
  LlTraceTable,
  LrTable,
  LrTraceTable,
  RdTraceTable,
} from "./tables";
import { WarningExplorer } from "./warning-explorer";

type ParserResultsProps = {
  activeConflicts: Conflict[];
  analysis: ParserAnalysis;
  astGraph?: AutomataGraph;
  canGenerateParsing: boolean;
  draftInput: string;
  grammarText: string;
  hasGeneratedParsing: boolean;
  llParseTreeGraph?: AutomataGraph;
  llRuleTable: LlRuleTable;
  llSuggestions: GrammarSuggestion[];
  llTrace: LlTraceRow[];
  lrParseTreeGraph?: AutomataGraph;
  lrTrace: LrTraceRow[];
  parser: ParserType;
  parsingInput: string;
  rdTrace: RdTraceRow[];
  rdTransitionGraph?: AutomataGraph;
  selectedModel?: LRModel;
  showLrViews: boolean;
  sim?: SimulationResult;
  onDraftInputChange: (value: string) => void;
  onGenerateParsing: () => void;
};

export function ParserResults(props: ParserResultsProps) {
  const { analysis } = props;

  return (
    <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      {analysis.error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Grammar error</AlertTitle>
          <AlertDescription>{analysis.error}</AlertDescription>
        </Alert>
      )}

      {analysis.grammar && analysis.ff && (
        <ValidParserResults
          {...props}
          grammar={analysis.grammar}
          ff={analysis.ff}
        />
      )}
    </section>
  );
}

function ValidParserResults({
  activeConflicts,
  analysis,
  astGraph,
  canGenerateParsing,
  draftInput,
  ff,
  grammar,
  grammarText,
  hasGeneratedParsing,
  llParseTreeGraph,
  llRuleTable,
  llSuggestions,
  llTrace,
  lrParseTreeGraph,
  lrTrace,
  onDraftInputChange,
  onGenerateParsing,
  parser,
  parsingInput,
  rdTrace,
  rdTransitionGraph,
  selectedModel,
  showLrViews,
  sim,
}: ParserResultsProps & { grammar: Grammar; ff: FirstFollow }) {
  const handleExportDerivation = () => {
    const { traceRows, treeGraph } = getDerivationArtifacts({
      astGraph,
      llParseTreeGraph,
      llTrace,
      lrParseTreeGraph,
      lrTrace,
      parser,
      rdTrace,
    });

    exportStringDerivationReport({
      grammar,
      grammarText,
      input: parsingInput,
      normalizedGrammar:
        parser === "RD" && analysis.rdGrammar
          ? analysis.rdGrammar.transformed
          : grammar.transformed,
      parser,
      sim,
      traceRows,
      treeGraph,
    });
  };

  const parsingPanel = (
    <ParsingPanel
      canGenerateParsing={canGenerateParsing}
      draftInput={draftInput}
      hasGeneratedParsing={hasGeneratedParsing}
      parser={parser}
      sim={sim}
      onDraftInputChange={onDraftInputChange}
      onExportDerivation={handleExportDerivation}
      onGenerateParsing={onGenerateParsing}
    />
  );

  return (
    <div className="space-y-6">
      <NormalizedGrammarPanel
        activeConflicts={activeConflicts}
        analysis={analysis}
        grammar={grammar}
        llSuggestions={llSuggestions}
        parser={parser}
      />

      <Panel title="First and Follow Tables" icon={Sparkles}>
        <FirstFollowTable
          symbols={
            parser === "RD" && analysis.rdGrammar
              ? analysis.rdGrammar.nonTerminals
              : grammar.nonTerminals
          }
          ff={parser === "RD" && analysis.rdFf ? analysis.rdFf : ff}
        />
      </Panel>

      {parser === "RD" && (
        <Panel title="Recursive Descent Analysis" icon={TreePine}>
          {rdTransitionGraph && (
            <GraphvizDiagram
              title="Recursive descent transition tree"
              description="General procedure expansion tree for the normalized grammar. Blue nodes represent calls to non-terminal procedures."
              graph={rdTransitionGraph}
              rankdir="TB"
            />
          )}
        </Panel>
      )}

      {parser === "RD" && parsingPanel}

      {parser === "LL(1)" && (
        <Panel title="LL(1) Rule Table" icon={Table2}>
          <LlRuleTableView grammar={grammar} ff={ff} table={llRuleTable} />
        </Panel>
      )}

      {parser === "LL(1)" && parsingPanel}

      {parser === "LL(1)" && hasGeneratedParsing && (
        <Panel title="LL(1) Input Derivation Table" icon={Play}>
          <LlTraceTable rows={llTrace} />
        </Panel>
      )}

      {parser === "LL(1)" && hasGeneratedParsing && (
        <ParseTreePanel
          title="LL(1) Parse Tree"
          graphTitle="LL(1) parse tree"
          description="Parse tree generated from the current input string, including explicit epsilon leaves for empty derivations."
          graph={llParseTreeGraph}
          emptyText="The current input does not produce a complete LL(1) parse tree."
        />
      )}

      {showLrViews && (
        <LrAutomataPanel
          grammar={grammar}
          parser={parser}
          selectedModel={selectedModel}
        />
      )}

      {showLrViews && parsingPanel}

      {showLrViews && hasGeneratedParsing && (
        <Panel title={`${parser} Input Derivation Table`} icon={Play}>
          <LrTraceTable rows={lrTrace} />
        </Panel>
      )}

      {showLrViews && hasGeneratedParsing && (
        <ParseTreePanel
          title={`${parser} Parse Tree`}
          graphTitle={`${parser} parse tree`}
          description="Parse tree generated from the current input string, including explicit epsilon leaves for empty reductions."
          graph={lrParseTreeGraph}
          emptyText={`The current input does not produce a complete ${parser} parse tree.`}
        />
      )}

      {parser === "RD" && hasGeneratedParsing && (
        <Panel title="Step-by-step Simulation" icon={Play}>
          <RdTraceTable rows={rdTrace} />
        </Panel>
      )}

      {parser === "RD" && hasGeneratedParsing && (
        <ParseTreePanel
          title="AST Parse Tree"
          graphTitle="AST / derivation tree"
          description="Parse tree generated from the current input string, including explicit epsilon leaves for empty derivations."
          graph={astGraph}
          emptyText="Enter a string to generate a tree."
        />
      )}
    </div>
  );
}

function NormalizedGrammarPanel({
  activeConflicts,
  analysis,
  grammar,
  llSuggestions,
  parser,
}: {
  activeConflicts: Conflict[];
  analysis: ParserAnalysis;
  grammar: Grammar;
  llSuggestions: GrammarSuggestion[];
  parser: ParserType;
}) {
  return (
    <Panel title="Normalized Grammar" icon={FileText}>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <pre className="whitespace-pre-wrap rounded-md bg-black p-3 font-mono text-xs leading-6 text-zinc-200 sm:p-4">
          {parser === "RD" && analysis.rdGrammar
            ? analysis.rdGrammar.transformed
            : grammar.transformed}
        </pre>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
            <AlertTriangle className="size-3.5" />
            Parser notifications
          </div>
          <WarningExplorer
            notes={parser === "RD" ? [] : grammar.notes}
            activeConflicts={activeConflicts}
            parser={parser}
            llSuggestions={llSuggestions}
          />
        </div>
      </div>
    </Panel>
  );
}

function getDerivationArtifacts({
  astGraph,
  llParseTreeGraph,
  llTrace,
  lrParseTreeGraph,
  lrTrace,
  parser,
  rdTrace,
}: {
  astGraph?: AutomataGraph;
  llParseTreeGraph?: AutomataGraph;
  llTrace: LlTraceRow[];
  lrParseTreeGraph?: AutomataGraph;
  lrTrace: LrTraceRow[];
  parser: ParserType;
  rdTrace: RdTraceRow[];
}) {
  if (parser === "RD") {
    return { traceRows: rdTrace, treeGraph: astGraph };
  }

  if (parser === "LL(1)") {
    return { traceRows: llTrace, treeGraph: llParseTreeGraph };
  }

  return { traceRows: lrTrace, treeGraph: lrParseTreeGraph };
}

function LrAutomataPanel({
  grammar,
  parser,
  selectedModel,
}: {
  grammar: Grammar;
  parser: ParserType;
  selectedModel?: LRModel;
}) {
  return (
    <Panel title={`${parser} Automata and Table`} icon={Network}>
      {selectedModel && (
        <div className="space-y-4">
          <GraphvizDiagram
            title={`${parser} NFA`}
            description={
              parser === "LR(0)" || parser === "SLR(1)"
                ? "Complete LR item NFA. Solid edges consume grammar symbols; dashed edges are epsilon expansions into non-terminal productions."
                : "Complete LR(1) item NFA with lookahead tokens in each item. Solid edges consume grammar symbols; dashed edges are lookahead-aware epsilon expansions."
            }
            graph={selectedModel.nfa}
          />
          <GraphvizDiagram
            title={
              parser === "LALR(1)"
                ? "LR(1) DFA before LALR merge"
                : `${parser} DFA`
            }
            description={
              parser === "LALR(1)"
                ? "Canonical LR(1) DFA. States with matching colors have the same LR(0) core and will be combined for LALR(1)."
                : "Subset construction result: each merged DFA state contains the LR items shown inside the node."
            }
            graph={selectedModel.dfa}
          />
          {parser === "LALR(1)" && selectedModel.mergedDfa && (
            <GraphvizDiagram
              title="LALR(1) combined DFA"
              description="Combined LALR(1) DFA after merging states with identical LR(0) cores and preserving their lookahead items."
              graph={selectedModel.mergedDfa}
            />
          )}
          <LrTable model={selectedModel} grammar={grammar} />
        </div>
      )}
    </Panel>
  );
}

function ParseTreePanel({
  description,
  emptyText,
  graph,
  graphTitle,
  title,
}: {
  description: string;
  emptyText: string;
  graph?: AutomataGraph;
  graphTitle: string;
  title: string;
}) {
  return (
    <Panel title={title} icon={TreePine}>
      {graph ? (
        <GraphvizDiagram
          title={graphTitle}
          description={description}
          graph={graph}
          rankdir="TB"
        />
      ) : (
        <p className="rounded-md border border-zinc-800 bg-black p-3 text-sm text-zinc-500 sm:p-4">
          {emptyText}
        </p>
      )}
    </Panel>
  );
}
