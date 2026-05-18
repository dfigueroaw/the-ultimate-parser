import { Bookmark, Check, Download, Library, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EXAMPLES,
  PARSERS,
  type Conflict,
  type ParserExample,
  type ParserType,
} from "@/lib/parser-lab";
import { cn } from "@/lib/utils";

export function GrammarInputPanel({
  grammarText,
  grammarRows,
  onGrammarChange,
  onGrammarExport,
  onSaveGrammar,
}: {
  grammarText: string;
  grammarRows: number;
  onGrammarChange: (value: string) => void;
  onGrammarExport: () => void;
  onSaveGrammar: (name: string) => void;
}) {
  const handleSave = () => {
    const name = window.prompt("Name this grammar");
    if (name === null) return;
    onSaveGrammar(name);
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Grammar Input</h2>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={handleSave}>
                <Bookmark />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save grammar locally</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onGrammarExport}
              >
                <Download />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export grammar report as PDF</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Textarea
        value={grammarText}
        onChange={(event) => onGrammarChange(event.target.value)}
        rows={grammarRows}
        spellCheck={false}
        className="resize-none border-zinc-800 bg-black font-mono text-xs leading-5 text-zinc-100"
      />
    </section>
  );
}

export function ExamplePanel({
  onExampleSelect,
  onSavedExampleRemove,
  savedExamples,
}: {
  onExampleSelect: (example: ParserExample) => void;
  onSavedExampleRemove: (id: string) => void;
  savedExamples: ParserExample[];
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const featuredExamples = useMemo(
    () => EXAMPLES.filter((example) => example.featured).slice(0, 8),
    [],
  );
  const libraryExamples = useMemo(
    () => EXAMPLES.filter((example) => !featuredExamples.includes(example)),
    [featuredExamples],
  );

  const handleSelect = (example: ParserExample) => {
    onExampleSelect(example);
    setLibraryOpen(false);
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Examples</h2>
      <div className="grid grid-cols-3 gap-2">
        {featuredExamples.map((example) => (
          <ExampleButton
            key={example.id}
            example={example}
            onClick={() => handleSelect(example)}
          />
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLibraryOpen(true)}
          className="min-w-0 justify-start border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
        >
          <Library className="text-zinc-300" />
          <span className="truncate">More</span>
        </Button>
      </div>
      {libraryOpen && (
        <ExampleLibraryDialog
          examples={libraryExamples}
          savedExamples={savedExamples}
          onClose={() => setLibraryOpen(false)}
          onExampleSelect={handleSelect}
          onSavedExampleRemove={onSavedExampleRemove}
        />
      )}
    </section>
  );
}

function ExampleButton({
  example,
  onClick,
}: {
  example: ParserExample;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="min-w-0 justify-start border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800"
      title={example.topic}
    >
      <span className="truncate">{example.name}</span>
    </Button>
  );
}

function ExampleLibraryDialog({
  examples,
  savedExamples,
  onClose,
  onExampleSelect,
  onSavedExampleRemove,
}: {
  examples: ParserExample[];
  savedExamples: ParserExample[];
  onClose: () => void;
  onExampleSelect: (example: ParserExample) => void;
  onSavedExampleRemove: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 p-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Example Library
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Curated grammars for parser conflicts, recursion, lists, and
              language fragments.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          {savedExamples.length > 0 && (
            <ExampleSection
              title="Saved locally"
              examples={savedExamples}
              onExampleSelect={onExampleSelect}
              onSavedExampleRemove={onSavedExampleRemove}
              saved
            />
          )}
          <ExampleSection
            title="Grammar examples"
            examples={examples}
            onExampleSelect={onExampleSelect}
            onSavedExampleRemove={onSavedExampleRemove}
          />
        </div>
      </div>
    </div>
  );
}

function ExampleSection({
  examples,
  onExampleSelect,
  onSavedExampleRemove,
  saved = false,
  title,
}: {
  examples: ParserExample[];
  onExampleSelect: (example: ParserExample) => void;
  onSavedExampleRemove: (id: string) => void;
  saved?: boolean;
  title: string;
}) {
  if (!examples.length) return null;

  return (
    <section className="mb-5 last:mb-0">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
        {title}
      </h4>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {examples.map((example) => (
          <article
            key={example.id}
            className="rounded-md border border-zinc-800 bg-black p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h5 className="truncate text-sm font-medium text-white">
                  {example.name}
                </h5>
                <p className="mt-1 text-xs text-zinc-500">{example.topic}</p>
              </div>
              {saved && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onSavedExampleRemove(example.id)}
                  className="text-zinc-500 hover:text-red-200"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <pre className="mt-3 line-clamp-5 whitespace-pre-wrap rounded border border-zinc-900 bg-zinc-950 p-2 font-mono text-[11px] leading-4 text-zinc-400">
              {example.grammar}
            </pre>
            <div className="mt-3 flex items-center justify-between gap-3">
              <code className="min-w-0 truncate text-[11px] text-zinc-500">
                {example.input || "No saved input"}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExampleSelect(example)}
                className="border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Load
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ParserCoveragePanel({
  parser,
  parserScore,
  parserConflicts,
  onParserChange,
}: {
  parser: ParserType;
  parserScore: number;
  parserConflicts: (parser: ParserType) => Conflict[];
  onParserChange: (parser: ParserType) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">
            Determinism coverage
          </p>
          <p className="text-xs text-zinc-500">
            Computed after every grammar edit
          </p>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-zinc-200">
          {Math.round(parserScore)}%
        </Badge>
      </div>
      <Progress value={parserScore} className="mt-4 h-2 bg-zinc-900" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PARSERS.map((kind) => {
          const conflicts = parserConflicts(kind);
          return (
            <button
              key={kind}
              onClick={() => onParserChange(kind)}
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                parser === kind
                  ? "border-white bg-white text-black"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600",
              )}
            >
              {kind}
              {conflicts.length ? (
                <X className="size-3.5 text-red-400" />
              ) : (
                <Check className="size-3.5 text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
