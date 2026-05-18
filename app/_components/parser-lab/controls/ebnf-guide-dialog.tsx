import type React from "react";
import { BookOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const EXAMPLES = [
  {
    title: "Alternatives",
    grammar: "expression = term | expression , '+' , term ;",
  },
  {
    title: "Grouping",
    grammar: "factor = identifier | '(' , expression , ')' ;",
  },
  {
    title: "Optional sequence",
    grammar: "parameter = identifier , [ ':' , type ] ;",
  },
  {
    title: "Repetition",
    grammar: "list = item , { ',' , item } ;",
  },
];

const SUPPORTED_RULES = [
  "Each rule is written as a meta-identifier, an equals sign, one expression, and a semicolon.",
  "Use single or double quotes for terminal symbols.",
  "Use a comma to concatenate symbols in a sequence.",
  "Use a vertical bar to separate alternatives.",
  "Use parentheses for grouping, square brackets for optional parts, and braces for repetition.",
];

const LIMITATIONS = [
  "Use simple identifiers such as expression, term, or statement_list for rule names.",
  "ISO comments, special sequences, exception syntax, and repetition counts are not parsed by this app.",
  "The app also accepts ::=, but = is the ISO-style form used in the examples.",
];

export function EbnfGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">
                ISO 14977 EBNF Guide
              </h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              This editor recognizes a practical ISO 14977-style subset for
              grammar rules, terminals, alternatives, grouping, optionals, and
              repetitions.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <GuideSection title="Accepted Form">
              <ul className="space-y-2 text-xs leading-5 text-zinc-300">
                {SUPPORTED_RULES.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </GuideSection>

            <GuideSection title="Canonical Shape">
              <pre className="whitespace-pre-wrap rounded-md border border-zinc-900 bg-black p-3 font-mono text-xs leading-5 text-zinc-200">
                {
                  "rule_name = symbol , 'terminal' | [ optional ] | { repeated } ;"
                }
              </pre>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                A terminal is literal text wrapped in quotes. An unquoted name
                is treated as another rule when it appears on the left side of a
                rule.
              </p>
            </GuideSection>

            <GuideSection title="Examples">
              <div className="space-y-3">
                {EXAMPLES.map((example) => (
                  <div key={example.title}>
                    <p className="mb-1 text-xs font-medium text-zinc-400">
                      {example.title}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-md border border-zinc-900 bg-black p-3 font-mono text-xs leading-5 text-zinc-200">
                      {example.grammar}
                    </pre>
                  </div>
                ))}
              </div>
            </GuideSection>

            <GuideSection title="Notes">
              <ul className="space-y-2 text-xs leading-5 text-zinc-300">
                {LIMITATIONS.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </GuideSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideSection({
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
      {children}
    </section>
  );
}
