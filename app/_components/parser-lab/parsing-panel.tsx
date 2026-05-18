import { AlertTriangle, Check, Download, Play } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ParserType, SimulationResult } from "@/lib/parser-lab";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

export function ParsingPanel({
  canGenerateParsing,
  draftInput,
  hasGeneratedParsing,
  parser,
  sim,
  onDraftInputChange,
  onExportDerivation,
  onGenerateParsing,
}: {
  canGenerateParsing: boolean;
  draftInput: string;
  hasGeneratedParsing: boolean;
  parser: ParserType;
  sim?: SimulationResult;
  onDraftInputChange: (value: string) => void;
  onExportDerivation: () => void;
  onGenerateParsing: () => void;
}) {
  return (
    <Panel title="String Parsing" icon={Play}>
      <div className="rounded-md border border-zinc-800 bg-black p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={draftInput}
            onChange={(event) => onDraftInputChange(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />
          <Button
            size="lg"
            disabled={!canGenerateParsing}
            onClick={onGenerateParsing}
            className="sm:w-32"
          >
            Generate
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!hasGeneratedParsing}
            onClick={onExportDerivation}
            className="sm:w-32"
          >
            <Download />
            Export
          </Button>
        </div>
        {!canGenerateParsing && (
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Generation is enabled only when the current grammar is valid for{" "}
            {parser}.
          </p>
        )}
        {canGenerateParsing && !hasGeneratedParsing && (
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Enter a string and generate its parsing to create the step-by-step
            table and parse tree.
          </p>
        )}
        {sim && <SimulationAlert sim={sim} />}
      </div>
    </Panel>
  );
}

function SimulationAlert({ sim }: { sim: SimulationResult }) {
  const description =
    sim.error ?? sim.steps[sim.steps.length - 1] ?? "No steps generated.";

  return (
    <Alert
      className={cn(
        "mt-3 border-zinc-800 bg-zinc-950",
        sim.error && "border-red-950 bg-red-950/20",
      )}
    >
      {sim.ok ? (
        <Check className="size-4" />
      ) : (
        <AlertTriangle className="size-4" />
      )}
      <AlertTitle>
        {sim.ok
          ? "Accepted"
          : sim.error
            ? "Possible infinite recursion"
            : "Stopped at conflict or error"}
      </AlertTitle>
      <AlertDescription className="text-zinc-400">
        {description}
      </AlertDescription>
    </Alert>
  );
}
