import { Bookmark, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
