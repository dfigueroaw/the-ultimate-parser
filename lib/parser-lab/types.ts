export type ParserType = "RD" | "LL(1)" | "LR(0)" | "SLR(1)" | "LALR(1)" | "LR(1)";

export type Production = { id: number; lhs: string; rhs: string[] };

export type Grammar = {
  start: string;
  augmentedStart: string;
  productions: Production[];
  nonTerminals: string[];
  terminals: string[];
  transformed: string;
  notes: string[];
};

export type FirstFollow = {
  first: Record<string, Set<string>>;
  follow: Record<string, Set<string>>;
};

export type Item = { prod: number; dot: number; lookahead?: string };

export type State = { id: number; items: Item[]; transitions: Record<string, number> };

export type AutomataEdge = {
  from: string;
  to: string;
  label: string;
  kind?: "epsilon" | "symbol";
};

export type AutomataGraph = {
  nodes: { id: string; label: string; color?: string; shape?: "box" | "ellipse" | "circle" | "point" }[];
  edges: AutomataEdge[];
};

export type TableAction =
  | { kind: "shift"; to: number }
  | { kind: "reduce"; production: Production }
  | { kind: "accept" };

export type ParseTable = {
  action: Record<string, Record<string, TableAction[]>>;
  goTo: Record<string, Record<string, number>>;
  conflicts: Conflict[];
};

export type Conflict = {
  parser: ParserType;
  state?: number;
  subject?: string;
  symbol: string;
  actions: string[];
  explanation: string;
  suggestion: string;
};

export type LRModel = {
  states: State[];
  table: ParseTable;
  afn: string[];
  nfa: AutomataGraph;
  dfa: AutomataGraph;
  mergedDfa?: AutomataGraph;
  kernelGroups?: number[][];
};

export type TreeNode = { label: string; children?: TreeNode[] };

export type EbnfTerm =
  | { kind: "symbol"; value: string }
  | { kind: "group"; alternatives: EbnfAlternative[] }
  | { kind: "optional"; alternatives: EbnfAlternative[] }
  | { kind: "repeat"; alternatives: EbnfAlternative[] };

export type EbnfAlternative = EbnfTerm[];

export type EbnfRule = {
  lhs: string;
  alternatives: EbnfAlternative[];
};

export type EbnfGrammar = {
  start: string;
  rules: EbnfRule[];
  nonTerminals: string[];
  terminals: string[];
  transformed: string;
};

export type LlTraceRow = {
  stack: string[];
  input: string[];
  action: string;
  crossedStack?: string;
  crossedInput?: string;
  isError?: boolean;
};

export type LrTraceRow = {
  stack: string[];
  input: string[];
  action: string;
  isError?: boolean;
};

export type RdTraceRow = {
  stack: string[];
  input: string[];
  action: string;
  crossedInput?: string;
  isError?: boolean;
};

export type LlRuleTable = Record<string, Record<string, Production[]>>;

export type SimulationResult = {
  ok: boolean;
  steps: string[];
  tree?: TreeNode;
  error?: string;
};

export type GrammarSuggestion = {
  kind: "left-recursion" | "left-factorization";
  title: string;
  body: string;
  details: string;
  rewrite?: string[];
  references?: string[];
};

export type ParserAnalysis = {
  grammar?: Grammar;
  rdGrammar?: EbnfGrammar;
  rdFf?: FirstFollow;
  ff?: FirstFollow;
  lrModels: Partial<Record<ParserType, LRModel>>;
  statuses: Partial<Record<ParserType, Conflict[]>>;
  error: string;
};
