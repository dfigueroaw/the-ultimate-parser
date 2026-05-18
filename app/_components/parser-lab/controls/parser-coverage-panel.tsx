import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PARSERS, type Conflict, type ParserType } from "@/lib/parser-lab";
import { cn } from "@/lib/utils";

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
