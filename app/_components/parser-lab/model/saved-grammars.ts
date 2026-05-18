import type { ParserExample } from "@/lib/parser-lab";

const SAVED_GRAMMARS_KEY = "parser-lab.saved-grammars";
const DEFAULT_SAVED_GRAMMAR_NAME = "Saved grammar";
const SAVED_GRAMMAR_TOPIC = "Saved locally";

type SavedGrammarRecord = {
  id: string;
  name: string;
  grammar: string;
};

export function readSavedGrammarExamples(): ParserExample[] {
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

export function writeSavedGrammarExamples(examples: ParserExample[]) {
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

export function upsertSavedGrammar(
  current: ParserExample[],
  requestedName: string,
  grammar: string,
) {
  const name = requestedName.trim() || DEFAULT_SAVED_GRAMMAR_NAME;
  const id = `saved-${slugify(name) || "grammar"}`;
  const nextExample: ParserExample = {
    id,
    name,
    topic: SAVED_GRAMMAR_TOPIC,
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
      topic: SAVED_GRAMMAR_TOPIC,
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
