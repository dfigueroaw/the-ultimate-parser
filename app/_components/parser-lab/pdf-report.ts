"use client";

import { instance } from "@viz-js/viz";
import type {
  Content,
  ContentCanvas,
  ContextPageSize,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from "pdfmake/interfaces";

import {
  actionLabel,
  displaySymbol,
  END,
  formatProduction,
  formatSet,
  PARSERS,
  type AutomataGraph,
  type Conflict,
  type FirstFollow,
  type Grammar,
  type GrammarSuggestion,
  type LlRuleTable,
  type LRModel,
  type LlTraceRow,
  type LrTraceRow,
  type ParserAnalysis,
  type ParserType,
  type RdTraceRow,
  type SimulationResult,
} from "@/lib/parser-lab";
import { isLrParser } from "@/lib/parser-lab/format";

type PdfMake = typeof import("pdfmake/build/pdfmake");
type PdfMakeImport = PdfMake & { default?: PdfMake };
type PdfFontsImport = TVirtualFileSystem & { default?: TVirtualFileSystem };

export type GrammarReportInput = {
  activeConflicts: Conflict[];
  analysis: ParserAnalysis;
  grammarText: string;
  llRuleTable: LlRuleTable;
  llSuggestions: GrammarSuggestion[];
  parser: ParserType;
  parserScore: number;
  rdTransitionGraph?: AutomataGraph;
  selectedModel?: LRModel;
};

export type StringDerivationReportInput = {
  grammar: Grammar;
  grammarText: string;
  input: string;
  normalizedGrammar: string;
  parser: ParserType;
  sim?: SimulationResult;
  traceRows: LlTraceRow[] | LrTraceRow[] | RdTraceRow[];
  treeGraph?: AutomataGraph;
};

type GraphRender = {
  title: string;
  description: string;
  graph: AutomataGraph;
  rankdir: "LR" | "TB";
  svg: string;
};

const PAGE_MARGIN: [number, number, number, number] = [34, 42, 34, 38];
const LANDSCAPE_CONTENT_WIDTH = 773;
const LANDSCAPE_CONTENT_HEIGHT = 515;
const MAX_LL_TERMINALS_PER_TABLE = 7;
const MAX_LR_SYMBOLS_PER_TABLE = 9;

const COLORS = {
  page: "#000000",
  panel: "#09090b",
  panelSoft: "#111113",
  rowAlt: "#050505",
  border: "#27272a",
  borderStrong: "#3f3f46",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  faint: "#71717a",
  accent: "#e5e7eb",
  danger: "#fecaca",
  dangerBg: "#450a0a",
  ok: "#bbf7d0",
  okBg: "#052e16",
  warn: "#fde68a",
  warnBg: "#451a03",
};

const tableLayout: CustomTableLayout = {
  fillColor(rowIndex) {
    if (rowIndex === 0) return COLORS.panelSoft;
    return rowIndex % 2 === 0 ? COLORS.rowAlt : COLORS.panel;
  },
  hLineColor() {
    return COLORS.border;
  },
  vLineColor() {
    return COLORS.border;
  },
  hLineWidth() {
    return 0.55;
  },
  vLineWidth() {
    return 0.55;
  },
  paddingLeft() {
    return 5;
  },
  paddingRight() {
    return 5;
  },
  paddingTop() {
    return 4;
  },
  paddingBottom() {
    return 4;
  },
};

export async function exportGrammarReport(input: GrammarReportInput) {
  if (!input.analysis.grammar || !input.analysis.ff) return;

  const pdfMake = await getPdfMake();
  const graphs = await buildGraphSvgs(input);
  const document = buildGrammarDocument(input, graphs);
  pdfMake
    .createPdf(document)
    .download(`ultimate-parser-${slugify(input.parser)}-grammar-report.pdf`);
}

export async function exportStringDerivationReport(
  input: StringDerivationReportInput,
) {
  const pdfMake = await getPdfMake();
  const tree = input.treeGraph
    ? await renderGraphSvg({
        title: `${input.parser} Derivation Tree`,
        description:
          "Parse tree generated from the selected input string and grammar.",
        graph: input.treeGraph,
        rankdir: "TB",
      })
    : undefined;
  const document = buildStringDerivationDocument(input, tree);

  pdfMake
    .createPdf(document)
    .download(`ultimate-parser-${slugify(input.parser)}-string-derivation.pdf`);
}

async function getPdfMake(): Promise<PdfMake> {
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = normalizePdfMakeModule(pdfMakeModule as PdfMakeImport);
  const pdfFonts = normalizePdfFontsModule(pdfFontsModule as PdfFontsImport);

  pdfMake.addVirtualFileSystem(pdfFonts);
  return pdfMake;
}

function normalizePdfMakeModule(module: PdfMakeImport): PdfMake {
  return module.default ?? module;
}

function normalizePdfFontsModule(module: PdfFontsImport): TVirtualFileSystem {
  return module.default ?? module;
}

async function buildGraphSvgs(
  input: GrammarReportInput,
): Promise<GraphRender[]> {
  const graphSpecs: Omit<GraphRender, "svg">[] = [];

  if (input.parser === "RD" && input.rdTransitionGraph) {
    graphSpecs.push({
      title: "Recursive Descent Transition Graph",
      description: "Procedure expansion graph generated from the grammar.",
      graph: input.rdTransitionGraph,
      rankdir: "TB",
    });
  }

  if (isLrParser(input.parser) && input.selectedModel) {
    graphSpecs.push(
      {
        title: `${input.parser} NFA`,
        description:
          "Complete item NFA. Dashed edges represent epsilon expansions.",
        graph: input.selectedModel.nfa,
        rankdir: "LR",
      },
      {
        title:
          input.parser === "LALR(1)"
            ? "LR(1) DFA Before Merge"
            : `${input.parser} DFA`,
        description:
          input.parser === "LALR(1)"
            ? "Canonical LR(1) states before equivalent LR(0) cores are merged."
            : "Subset construction result with items grouped by DFA state.",
        graph: input.selectedModel.dfa,
        rankdir: "LR",
      },
    );

    if (input.parser === "LALR(1)" && input.selectedModel.mergedDfa) {
      graphSpecs.push({
        title: "Merged LALR(1) DFA",
        description:
          "DFA after merging states with identical LR(0) cores and preserving lookaheads.",
        graph: input.selectedModel.mergedDfa,
        rankdir: "LR",
      });
    }
  }

  if (!graphSpecs.length) return [];

  const viz = await instance();
  return graphSpecs.map((spec) => ({
    ...spec,
    svg: viz.renderSVGElement(toDot(spec.graph, spec.rankdir)).outerHTML,
  }));
}

async function renderGraphSvg(
  spec: Omit<GraphRender, "svg">,
): Promise<GraphRender> {
  const viz = await instance();
  return {
    ...spec,
    svg: viz.renderSVGElement(toDot(spec.graph, spec.rankdir)).outerHTML,
  };
}

function buildGrammarDocument(
  input: GrammarReportInput,
  graphs: GraphRender[],
): TDocumentDefinitions {
  const grammar = input.analysis.grammar;
  const ff = selectedFirstFollow(input);

  if (!grammar || !ff) return { content: [] };

  const normalizedGrammar = selectedNormalizedGrammar(input, grammar);
  const firstFollowSymbols = selectedFirstFollowSymbols(input, grammar);
  const content: Content[] = [
    cover(input, grammar),
    overviewSection(input, grammar, normalizedGrammar),
    notesSection(input, grammar),
    parserStatusSection(input),
    firstFollowSection(firstFollowSymbols, ff),
    ...wideTableSections(input, grammar, ff),
    ...graphSections(graphs),
  ];

  return reportDocument(content);
}

function buildStringDerivationDocument(
  input: StringDerivationReportInput,
  tree?: GraphRender,
): TDocumentDefinitions {
  const content: Content[] = [
    derivationCover(input),
    sectionTitle("Input"),
    codePanel(input.input || "Empty input", 9),
    codeBlock("Original Grammar", input.grammarText),
    codeBlock("Normalized Grammar", input.normalizedGrammar),
    derivationTraceSection(input),
    ...(tree ? graphSections([tree]) : []),
  ];

  return reportDocument(content);
}

function reportDocument(content: Content[]): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGIN,
    background: (_currentPage, size) => pageBackground(size),
    footer: (currentPage, pageCount) => ({
      margin: [PAGE_MARGIN[0], 0, PAGE_MARGIN[2], 18],
      columns: [
        {
          text: "The Ultimate Parser",
          color: COLORS.faint,
          fontSize: 8,
        },
        {
          text: `${currentPage} / ${pageCount}`,
          alignment: "right",
          color: COLORS.faint,
          fontSize: 8,
        },
      ],
    }),
    defaultStyle: {
      font: "Roboto",
      color: COLORS.text,
      fontSize: 9,
      lineHeight: 1.14,
    },
    styles: {
      title: { fontSize: 28, bold: true, color: COLORS.text },
      subtitle: { fontSize: 11, color: COLORS.muted },
      section: {
        fontSize: 15,
        bold: true,
        color: COLORS.text,
        margin: [0, 18, 0, 8],
      },
      tableHeader: {
        bold: true,
        color: COLORS.text,
        fillColor: COLORS.panelSoft,
      },
      code: {
        font: "Roboto",
        fontSize: 8,
        color: COLORS.text,
        lineHeight: 1.13,
      },
      small: { fontSize: 7, color: COLORS.muted },
    },
    content,
  };
}

function pageBackground(size: ContextPageSize): ContentCanvas {
  return {
    canvas: [
      {
        type: "rect",
        x: 0,
        y: 0,
        w: size.width,
        h: size.height,
        color: COLORS.page,
      },
    ],
  };
}

function cover(input: GrammarReportInput, grammar: Grammar): Content {
  return {
    stack: [
      { text: "The Ultimate Parser", style: "title" },
      {
        text: "Grammar Analysis Report",
        style: "subtitle",
        margin: [0, 4, 0, 20],
      },
      statGrid([
        statCell("Selected parser", input.parser),
        statCell("Deterministic coverage", `${Math.round(input.parserScore)}%`),
        statCell(
          "Status",
          input.activeConflicts.length ? "Has conflicts" : "No conflicts",
          input.activeConflicts.length ? COLORS.warn : COLORS.ok,
        ),
      ]),
      {
        text: "This PDF contains grammar-dependent information only: productions, normalization, FIRST/FOLLOW sets, compatibility checks, rule tables, and automata. It excludes input strings, parsing traces, and parse trees generated from input.",
        color: COLORS.muted,
        fontSize: 9,
        margin: [0, 16, 0, 0],
      },
      {
        text: `Start symbol: ${grammar.start}`,
        color: COLORS.faint,
        fontSize: 8,
        margin: [0, 10, 0, 0],
      },
    ],
    margin: [0, 28, 0, 12],
  };
}

function derivationCover(input: StringDerivationReportInput): Content {
  return {
    stack: [
      { text: "The Ultimate Parser", style: "title" },
      {
        text: "String Derivation Report",
        style: "subtitle",
        margin: [0, 4, 0, 20],
      },
      statGrid([
        statCell("Selected parser", input.parser),
        statCell("Start symbol", input.grammar.start),
        statCell("Trace steps", String(input.traceRows.length)),
        statCell(
          "Result",
          input.sim?.ok ? "Accepted" : input.sim ? "Stopped" : "Generated",
          input.sim?.ok ? COLORS.ok : input.sim ? COLORS.warn : COLORS.text,
        ),
      ]),
      {
        text: "This PDF summarizes the derivation for the generated input string, including the step-by-step derivation table and derivation tree when available.",
        color: COLORS.muted,
        fontSize: 9,
        margin: [0, 16, 0, 0],
      },
      input.sim
        ? {
            text:
              input.sim.error ??
              input.sim.steps[input.sim.steps.length - 1] ??
              "No simulation summary was produced.",
            color: input.sim.ok ? COLORS.ok : COLORS.warn,
            fontSize: 8,
            margin: [0, 10, 0, 0],
          }
        : {
            text: "No simulation summary was produced.",
            color: COLORS.faint,
            fontSize: 8,
            margin: [0, 10, 0, 0],
          },
    ],
    margin: [0, 28, 0, 12],
  };
}

function overviewSection(
  input: GrammarReportInput,
  grammar: Grammar,
  normalizedGrammar: string,
): Content {
  return {
    stack: [
      sectionTitle("Grammar Summary"),
      statGrid([
        statCell("Productions", String(grammar.productions.length)),
        statCell("Non-terminals", String(grammar.nonTerminals.length)),
        statCell("Terminals", String(grammar.terminals.length)),
        statCell("Active conflicts", String(input.activeConflicts.length)),
      ]),
      codeBlock("Original Grammar", input.grammarText),
      codeBlock("Normalized Grammar", normalizedGrammar),
    ],
  };
}

function notesSection(input: GrammarReportInput, grammar: Grammar): Content {
  const items = [
    ...grammar.notes.map((note) => ({
      title: "Normalization",
      body: note,
      color: COLORS.muted,
    })),
    ...input.activeConflicts.map((conflict) => ({
      title: conflictTitle(conflict),
      body: `${conflict.explanation}\nSuggestion: ${conflict.suggestion}`,
      color: COLORS.warn,
    })),
    ...input.llSuggestions.map((suggestion) => ({
      title: suggestion.title,
      body: `${suggestion.body}\n${suggestion.details}`,
      color: suggestion.kind === "left-recursion" ? COLORS.danger : COLORS.warn,
    })),
  ];

  return {
    stack: [
      sectionTitle("Notes"),
      items.length
        ? {
            ul: items.map((item) => ({
              text: [
                { text: `${item.title}: `, bold: true, color: item.color },
                { text: item.body, color: COLORS.muted },
              ],
              margin: [0, 0, 0, 5],
            })),
          }
        : {
            text: "No relevant warnings were detected for the selected grammar.",
            color: COLORS.muted,
          },
    ],
    margin: [0, 0, 0, 8],
  };
}

function parserStatusSection(input: GrammarReportInput): Content {
  return tableSection(
    "Parser Compatibility",
    ["Parser", "Result", "Details"],
    PARSERS.map((parser) => {
      const conflicts = input.analysis.statuses[parser] ?? [];
      return [
        cell(parser, { bold: true, color: COLORS.text }),
        statusCell(
          conflicts.length ? `${conflicts.length} conflict(s)` : "Acceptable",
          !conflicts.length,
        ),
        cell(
          conflicts.map((conflict) => conflictTitle(conflict)).join("\n") ||
            "No conflicts detected",
        ),
      ];
    }),
    ["auto", "auto", "*"],
  );
}

function firstFollowSection(symbols: string[], ff: FirstFollow): Content {
  return tableSection(
    "FIRST / FOLLOW Sets",
    ["Non-terminal", "FIRST", "FOLLOW"],
    symbols.map((symbol) => [
      cell(symbol, { bold: true, color: COLORS.text }),
      cell(formatSet(ff.first[symbol])),
      cell(formatSet(ff.follow[symbol])),
    ]),
    [86, "*", "*"],
  );
}

function wideTableSections(
  input: GrammarReportInput,
  grammar: Grammar,
  ff: FirstFollow,
): Content[] {
  if (input.parser === "LL(1)") {
    return llRuleTableSections(grammar, ff, input.llRuleTable);
  }

  if (isLrParser(input.parser) && input.selectedModel) {
    return lrTableSections(grammar, input.selectedModel, input.parser);
  }

  return [];
}

function llRuleTableSections(
  grammar: Grammar,
  ff: FirstFollow,
  table: LlRuleTable,
): Content[] {
  const terminals = [...grammar.terminals, END];
  return chunk(terminals, MAX_LL_TERMINALS_PER_TABLE).map(
    (terminalChunk, index, chunks): Content => ({
      stack: [
        sectionTitle(
          chunks.length > 1
            ? `LL(1) Rule Table (${index + 1}/${chunks.length})`
            : "LL(1) Rule Table",
        ),
        {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [88, ...terminalChunk.map(() => "*")],
            body: [
              [
                headerCell("Non-terminal"),
                ...terminalChunk.map((terminal) =>
                  headerCell(displaySymbol(terminal)),
                ),
              ],
              ...grammar.nonTerminals.map((nonTerminal) => [
                cell(nonTerminal, { bold: true, color: COLORS.text }),
                ...terminalChunk.map((terminal) => {
                  const entries = table[nonTerminal]?.[terminal] ?? [];
                  const recoveryAction = ff.follow[nonTerminal]?.has(terminal)
                    ? "Extract"
                    : "Explore";
                  return cell(
                    entries.length
                      ? entries.map(formatProduction).join("\n")
                      : recoveryAction,
                    {
                      color:
                        entries.length > 1
                          ? COLORS.danger
                          : entries.length
                            ? COLORS.muted
                            : COLORS.warn,
                    },
                  );
                }),
              ]),
            ],
          },
          layout: tableLayout,
          fontSize: 6.5,
        },
      ],
      pageBreak: "before",
      pageOrientation: "landscape",
    }),
  );
}

function lrTableSections(
  grammar: Grammar,
  model: LRModel,
  parser: ParserType,
): Content[] {
  const terminals = [...grammar.terminals, END];
  const gotoColumns = grammar.nonTerminals.filter(
    (symbol) => symbol !== grammar.augmentedStart,
  );
  const actionColumns = terminals.map((symbol) => ({
    kind: "action" as const,
    symbol,
    label: displaySymbol(symbol),
  }));
  const gotoSymbols = gotoColumns.map((symbol) => ({
    kind: "goto" as const,
    symbol,
    label: symbol,
  }));
  const columns = [...actionColumns, ...gotoSymbols];
  const tablePages = chunk(columns, MAX_LR_SYMBOLS_PER_TABLE).map(
    (columnChunk, index, chunks): Content => ({
      stack: [
        sectionTitle(
          chunks.length > 1
            ? `${parser} Parse Table (${index + 1}/${chunks.length})`
            : `${parser} Parse Table`,
        ),
        {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [48, ...columnChunk.map(() => "*")],
            body: [
              [
                headerCell("State"),
                ...columnChunk.map((col) => headerCell(col.label)),
              ],
              ...model.states.map((state) => [
                cell(`I${state.id}`, { bold: true, color: COLORS.text }),
                ...columnChunk.map((col) => {
                  if (col.kind === "goto") {
                    return cell(
                      String(model.table.goTo[state.id]?.[col.symbol] ?? ""),
                    );
                  }
                  const entries =
                    model.table.action[state.id]?.[col.symbol] ?? [];
                  return cell(entries.map(actionLabel).join(" / "), {
                    color: entries.length > 1 ? COLORS.danger : COLORS.muted,
                  });
                }),
              ]),
            ],
          },
          layout: tableLayout,
          fontSize: 6.3,
        },
      ],
      pageBreak: "before",
      pageOrientation: "landscape",
    }),
  );

  return tablePages;
}

function derivationTraceSection(input: StringDerivationReportInput): Content {
  const stackHeader = input.parser === "RD" ? "Procedure stack" : "Stack";
  return {
    stack: [
      sectionTitle("Step-by-step Derivation"),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [160, 150, "*"],
          body: [
            [
              headerCell(stackHeader),
              headerCell("Input"),
              headerCell("Action"),
            ],
            ...input.traceRows.map((row) => [
              cell(formatSymbolSequence(row.stack)),
              cell(formatSymbolSequence(row.input)),
              cell(row.action, {
                color: row.isError ? COLORS.danger : COLORS.muted,
              }),
            ]),
          ],
        },
        layout: tableLayout,
        fontSize: 6.8,
      },
    ],
    pageBreak: "before",
  };
}

function graphSections(graphs: GraphRender[]): Content[] {
  return graphs.map(
    (graph): Content => ({
      stack: [
        sectionTitle(graph.title),
        {
          text: graph.description,
          color: COLORS.muted,
          fontSize: 8,
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: ["*"],
            body: [
              [
                {
                  svg: graph.svg,
                  fit: [
                    LANDSCAPE_CONTENT_WIDTH - 20,
                    LANDSCAPE_CONTENT_HEIGHT - 84,
                  ],
                  alignment: "center",
                  margin: [8, 8, 8, 8],
                },
              ],
            ],
          },
          layout: {
            fillColor: () => COLORS.panel,
            hLineColor: () => COLORS.border,
            vLineColor: () => COLORS.border,
            hLineWidth: () => 0.7,
            vLineWidth: () => 0.7,
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          },
        },
      ],
      pageBreak: "before",
      pageOrientation: "landscape",
    }),
  );
}

function statGrid(cells: TableCell[]): Content {
  return {
    table: {
      widths: cells.map(() => "*"),
      body: [cells],
    },
    layout: tableLayout,
    margin: [0, 0, 0, 12],
  };
}

function statCell(
  label: string,
  value: string,
  color = COLORS.text,
): TableCell {
  return {
    stack: [
      {
        text: label.toUpperCase(),
        color: COLORS.faint,
        fontSize: 6,
        bold: true,
      },
      { text: value, color, fontSize: 13, bold: true, margin: [0, 3, 0, 0] },
    ],
    fillColor: COLORS.panel,
  };
}

function codeBlock(title: string, value: string): Content {
  return {
    stack: [sectionTitle(title), codePanel(value.trim() || "No content", 8)],
    margin: [0, 0, 0, 8],
  };
}

function codePanel(value: string, fontSize: number): Content {
  return {
    table: {
      widths: ["*"],
      body: [[{ text: value, style: "code", fontSize }]],
    },
    layout: tableLayout,
  };
}

function tableSection(
  title: string,
  headers: string[],
  rows: TableCell[][],
  widths: (string | number)[],
): Content {
  return {
    stack: [
      sectionTitle(title),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths,
          body: [headers.map(headerCell), ...rows],
        },
        layout: tableLayout,
      },
    ],
    margin: [0, 0, 0, 8],
  };
}

function sectionTitle(text: string): Content {
  return {
    text,
    style: "section",
  };
}

function headerCell(text: string): TableCell {
  return {
    text,
    style: "tableHeader",
    fontSize: 7,
    noWrap: false,
  };
}

function cell(
  text: string,
  options: { bold?: boolean; color?: string; fillColor?: string } = {},
): TableCell {
  return {
    text: text || " ",
    color: options.color ?? COLORS.muted,
    bold: options.bold,
    fillColor: options.fillColor,
    fontSize: 7,
    noWrap: false,
  };
}

function statusCell(text: string, ok: boolean): TableCell {
  return cell(text, {
    bold: true,
    color: ok ? COLORS.ok : COLORS.warn,
    fillColor: ok ? COLORS.okBg : COLORS.warnBg,
  });
}

function selectedFirstFollow(input: GrammarReportInput) {
  if (input.parser === "RD" && input.analysis.rdFf) return input.analysis.rdFf;
  return input.analysis.ff;
}

function selectedNormalizedGrammar(
  input: GrammarReportInput,
  grammar: Grammar,
) {
  if (input.parser === "RD" && input.analysis.rdGrammar) {
    return input.analysis.rdGrammar.transformed;
  }
  return grammar.transformed;
}

function selectedFirstFollowSymbols(
  input: GrammarReportInput,
  grammar: Grammar,
) {
  if (input.parser === "RD" && input.analysis.rdGrammar) {
    return input.analysis.rdGrammar.nonTerminals;
  }
  return grammar.nonTerminals;
}

function conflictTitle(conflict: Conflict) {
  const where = conflict.state === undefined ? "" : ` state I${conflict.state}`;
  return `${conflict.parser}${where} on ${displaySymbol(conflict.symbol)}`;
}

function toDot(graph: AutomataGraph, rankdir: "LR" | "TB") {
  return `digraph Automata {
  graph [
    rankdir=${rankdir},
    bgcolor="${COLORS.panel}",
    color="${COLORS.border}",
    fontcolor="${COLORS.text}",
    fontname="Roboto",
    margin="0.08",
    nodesep="0.45",
    ranksep="0.7",
    pad="0.18"
  ];
  node [
    shape=box,
    style="rounded,filled",
    fillcolor="${COLORS.panelSoft}",
    color="${COLORS.borderStrong}",
    fontcolor="${COLORS.text}",
    fontname="Roboto",
    fontsize=9,
    margin="0.08,0.05"
  ];
  edge [
    color="${COLORS.muted}",
    fontcolor="${COLORS.muted}",
    fontname="Roboto",
    fontsize=9,
    arrowsize=0.7
  ];

${graph.nodes
  .map((node) => {
    const colorAttrs = node.color
      ? `, color="${node.color}", penwidth=1.6`
      : "";
    const shapeAttrs = node.shape ? `, shape="${node.shape}"` : "";
    return `  ${quote(node.id)} [label=${quote(node.label)}${colorAttrs}${shapeAttrs}];`;
  })
  .join("\n")}

${graph.edges
  .map((edge) => {
    const style =
      edge.kind === "epsilon"
        ? ', style="dashed", color="#f59e0b", fontcolor="#fbbf24"'
        : "";
    const label = edge.label ? `label=${quote(edge.label)}` : 'label=""';
    return `  ${quote(edge.from)} -> ${quote(edge.to)} [${label}${style}];`;
  })
  .join("\n")}
}`;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function formatSymbolSequence(symbols: string[]) {
  return symbols.length ? symbols.map(displaySymbol).join(" ") : " ";
}

function quote(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
