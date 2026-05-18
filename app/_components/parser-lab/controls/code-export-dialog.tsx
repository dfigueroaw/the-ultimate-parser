import { AlertTriangle, Code2, Download, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseEbnf } from "@/lib/parser-lab";
import {
  DEFAULT_CODE_EXPORT_SETTINGS,
  type CodeExportSettings,
} from "../model/code-export";

type CodeExportDialogProps = {
  grammarText: string;
  onClose: () => void;
  onExport: (settings: CodeExportSettings) => void;
};

const FIELD_CLASS =
  "w-full rounded-md border border-zinc-800 bg-black px-2 py-1.5 text-xs text-zinc-100 outline-none ring-zinc-500 focus:ring-2";
const CHECKBOX_CLASS = "size-4 accent-white";

export function CodeExportDialog({
  grammarText,
  onClose,
  onExport,
}: CodeExportDialogProps) {
  const grammar = useMemo(() => {
    try {
      return { value: parseEbnf(grammarText), error: "" };
    } catch (error) {
      return {
        value: undefined,
        error:
          error instanceof Error ? error.message : "Unable to parse grammar.",
      };
    }
  }, [grammarText]);
  const [settings, setSettings] = useState<CodeExportSettings>(() => ({
    ...DEFAULT_CODE_EXPORT_SETTINGS,
    startRule: grammar.value?.start ?? "",
  }));

  const startRules = grammar.value?.nonTerminals ?? [];
  const resolvedSettings = {
    ...settings,
    startRule: settings.startRule || grammar.value?.start || "",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">
                Export Executable Parser
              </h3>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-zinc-700 text-zinc-300"
              >
                JavaScript
              </Badge>
              <Badge
                variant="outline"
                className="border-zinc-700 text-zinc-300"
              >
                Recursive descent
              </Badge>
              {grammar.value && (
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-zinc-300"
                >
                  {grammar.value.rules.length} rules
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {grammar.error ? (
            <Alert
              variant="destructive"
              className="border-red-950 bg-red-950/20"
            >
              <AlertTriangle className="size-4" />
              <AlertTitle>Grammar cannot be exported</AlertTitle>
              <AlertDescription>{grammar.error}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <SettingsGroup title="Code Shape">
                <Field label="Parser class">
                  <input
                    value={settings.parserName}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        parserName: event.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Module format">
                  <select
                    value={settings.moduleFormat}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        moduleFormat: event.target
                          .value as CodeExportSettings["moduleFormat"],
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="standalone">Standalone script</option>
                    <option value="commonjs">CommonJS module</option>
                    <option value="esm">ES module</option>
                  </select>
                </Field>
                <Field label="Start rule">
                  <select
                    value={resolvedSettings.startRule}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        startRule: event.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    {startRules.map((rule) => (
                      <option key={rule} value={rule}>
                        {rule}
                      </option>
                    ))}
                  </select>
                </Field>
              </SettingsGroup>

              <SettingsGroup title="Input Handling">
                <Field label="Input mode">
                  <select
                    value={settings.inputMode}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        inputMode: event.target
                          .value as CodeExportSettings["inputMode"],
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="tokens">Whitespace-separated tokens</option>
                    <option value="characters">Character stream</option>
                  </select>
                </Field>
                <CheckField
                  label="Case-sensitive terminal matching"
                  checked={settings.caseSensitive}
                  onChange={(caseSensitive) =>
                    setSettings({ ...settings, caseSensitive })
                  }
                />
                <CheckField
                  label="Skip whitespace in character mode"
                  checked={settings.skipWhitespace}
                  onChange={(skipWhitespace) =>
                    setSettings({ ...settings, skipWhitespace })
                  }
                />
                <CheckField
                  label="Require the parser to consume all input"
                  checked={settings.strictEnd}
                  onChange={(strictEnd) =>
                    setSettings({ ...settings, strictEnd })
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="Runtime Output">
                <CheckField
                  label="Include parse tree in parse results"
                  checked={settings.includeParseTree}
                  onChange={(includeParseTree) =>
                    setSettings({ ...settings, includeParseTree })
                  }
                />
                <CheckField
                  label="Print AST derivation tree in CLI output"
                  checked={settings.printAstTree}
                  onChange={(printAstTree) =>
                    setSettings({ ...settings, printAstTree })
                  }
                />
                <CheckField
                  label="Include trace collection"
                  checked={settings.includeTrace}
                  onChange={(includeTrace) =>
                    setSettings({ ...settings, includeTrace })
                  }
                />
                <Field label="Error messages">
                  <select
                    value={settings.errorFormat}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        errorFormat: event.target
                          .value as CodeExportSettings["errorFormat"],
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="detailed">Detailed position</option>
                    <option value="compact">Compact</option>
                  </select>
                </Field>
              </SettingsGroup>

              <SettingsGroup title="Generated File">
                <CheckField
                  label="Include command-line runner"
                  checked={settings.includeCli}
                  onChange={(includeCli) =>
                    setSettings({ ...settings, includeCli })
                  }
                />
                <CheckField
                  label="Include usage example comments"
                  checked={settings.includeExample}
                  onChange={(includeExample) =>
                    setSettings({ ...settings, includeExample })
                  }
                />
                <CheckField
                  label="Include generated-file header comments"
                  checked={settings.includeComments}
                  onChange={(includeComments) =>
                    setSettings({ ...settings, includeComments })
                  }
                />
                <Field label="Maximum repeat iterations">
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={settings.maxRepeatIterations}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        maxRepeatIterations: Number(event.target.value) || 1,
                      })
                    }
                    className={FIELD_CLASS}
                  />
                </Field>
              </SettingsGroup>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 p-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(grammar.error)}
            onClick={() => onExport(resolvedSettings)}
          >
            <Download />
            Export JS
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-md border border-zinc-800 bg-black p-3">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function CheckField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={CHECKBOX_CLASS}
      />
      <span>{label}</span>
    </label>
  );
}
