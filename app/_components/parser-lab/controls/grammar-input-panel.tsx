import { BookOpen, Bookmark, Code2, Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CodeExportSettings } from "../model/code-export";
import { CodeExportDialog } from "./code-export-dialog";
import { EbnfGuideDialog } from "./ebnf-guide-dialog";

export function GrammarInputPanel({
  grammarText,
  grammarRows,
  onGrammarChange,
  onCodeExport,
  onGrammarExport,
  onSaveGrammar,
}: {
  grammarText: string;
  grammarRows: number;
  onGrammarChange: (value: string) => void;
  onCodeExport: (settings: CodeExportSettings) => void;
  onGrammarExport: () => void;
  onSaveGrammar: (name: string) => void;
}) {
  const [codeExportOpen, setCodeExportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
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
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setGuideOpen(true)}
              >
                <BookOpen />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open ISO 14977 EBNF guide</TooltipContent>
          </Tooltip>
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
                onClick={() => setCodeExportOpen(true)}
              >
                <Code2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export executable parser code</TooltipContent>
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
      {codeExportOpen && (
        <CodeExportDialog
          grammarText={grammarText}
          onClose={() => setCodeExportOpen(false)}
          onExport={(settings) => {
            onCodeExport(settings);
            setCodeExportOpen(false);
          }}
        />
      )}
      {guideOpen && <EbnfGuideDialog onClose={() => setGuideOpen(false)} />}
    </section>
  );
}
