import { Fragment } from "react";

import {
  displaySymbol,
  type Conflict,
  type GrammarSuggestion,
  type ParserType,
} from "@/lib/parser-lab";
import { cn } from "@/lib/utils";

type NotificationTone = "normalization" | "conflict" | "left-recursion" | "left-factorization" | "clear";
type InlineSegment = { text: string; highlight?: boolean };
type NotificationBlock =
  | { kind: "paragraph"; content: InlineSegment[] }
  | { kind: "rule-list"; title: string; items: InlineSegment[][] };

type ParserNotification = {
  id: string;
  tone: NotificationTone;
  title: InlineSegment[];
  body: NotificationBlock[];
};

const NOTIFICATION_STYLES: Record<NotificationTone, { card: string; marker: string; highlight: string; list: string }> = {
  normalization: {
    card: "border-teal-900/80 bg-teal-950/25",
    marker: "bg-teal-400 shadow-[0_0_18px_rgba(45,212,191,0.35)]",
    highlight: "border-teal-500/30 bg-teal-300/10 text-teal-100",
    list: "border-teal-900/80 bg-teal-950/30",
  },
  conflict: {
    card: "border-rose-900/80 bg-rose-950/25",
    marker: "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.35)]",
    highlight: "border-rose-500/30 bg-rose-300/10 text-rose-100",
    list: "border-rose-900/80 bg-rose-950/30",
  },
  "left-recursion": {
    card: "border-amber-900/80 bg-amber-950/25",
    marker: "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.35)]",
    highlight: "border-amber-500/30 bg-amber-300/10 text-amber-100",
    list: "border-amber-900/80 bg-amber-950/30",
  },
  "left-factorization": {
    card: "border-cyan-900/80 bg-cyan-950/25",
    marker: "bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.35)]",
    highlight: "border-cyan-500/30 bg-cyan-300/10 text-cyan-100",
    list: "border-cyan-900/80 bg-cyan-950/30",
  },
  clear: {
    card: "border-emerald-900/80 bg-emerald-950/25",
    marker: "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.35)]",
    highlight: "border-emerald-500/30 bg-emerald-300/10 text-emerald-100",
    list: "border-emerald-900/80 bg-emerald-950/30",
  },
};

export function WarningExplorer({
  notes,
  activeConflicts,
  parser,
  llSuggestions,
}: {
  notes: string[];
  activeConflicts: Conflict[];
  parser: ParserType;
  llSuggestions: GrammarSuggestion[];
}) {
  const notifications = buildNotifications({ notes, activeConflicts, parser, llSuggestions });

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <WarningCard key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function buildNotifications({
  notes,
  activeConflicts,
  parser,
  llSuggestions,
}: {
  notes: string[];
  activeConflicts: Conflict[];
  parser: ParserType;
  llSuggestions: GrammarSuggestion[];
}): ParserNotification[] {
  const normalizationNotification = buildNormalizationNotification(notes);
  const conflictNotifications = activeConflicts.map(conflictToNotification);
  const shouldShowLlSuggestions = parser === "LL(1)" && !activeConflicts.length;
  const suggestionNotifications = shouldShowLlSuggestions ? llSuggestions.map(suggestionToNotification) : [];

  const notifications = [
    ...(normalizationNotification ? [normalizationNotification] : []),
    ...conflictNotifications,
    ...suggestionNotifications,
  ];

  if (notifications.length) return notifications;

  return [
    {
      id: `clear-${parser}`,
      tone: "clear",
      title: [text(parser), text(" has no parser notifications")],
      body: [
        paragraph(
          text("No normalization changes, conflicts, or grammar-shape issues were detected for "),
          text(parser),
          text("."),
        ),
      ],
    },
  ];
}

function buildNormalizationNotification(notes: string[]): ParserNotification | undefined {
  if (!notes.length) return undefined;

  return {
    id: `normalization-${notes.join("|")}`,
    tone: "normalization",
    title: [text("The grammar was normalized before analysis")],
    body: [
      paragraph(text("The parser builders use plain BNF internally, so ISO14977 syntax is expanded before the tables and automata are built.")),
      segmentList("Normalization changes", notes.map(normalizationNoteToSegments)),
    ],
  };
}

function normalizationNoteToSegments(note: string): InlineSegment[] {
  const helperMatch = note.match(/^Created (.+) to lower ISO14977 (.+) syntax into BNF\.$/);
  if (helperMatch) {
    const [, helper, syntax] = helperMatch;
    return [
      ref(helper),
      text(` represents the ${syntax} part of the original grammar in the normalized model.`),
    ];
  }

  const lrStartMatch = note.match(/^Added (.+) = (.+) and set (.+) as the LR initial state\.$/);
  if (lrStartMatch) {
    const [, augmentedStart, originalStart] = lrStartMatch;
    return [
      ref(`${augmentedStart} -> ${originalStart}`),
      text(" is added so LR automata have a single accepting start rule."),
    ];
  }

  return [text(note)];
}

function conflictToNotification(conflict: Conflict): ParserNotification {
  if (conflict.parser === "LL(1)") {
    const subject = conflict.subject ?? "A rule";
    return {
      id: `conflict-${conflict.parser}-${subject}-${conflict.symbol}`,
      tone: "conflict",
      title: [ref(subject), text(" is ambiguous on "), ref(displaySymbol(conflict.symbol))],
      body: [
        paragraph(
          text("When the next input symbol is "),
          ref(displaySymbol(conflict.symbol)),
          text(", "),
          ref(subject),
          text(" has more than one matching production. A predictive parser only has one token of lookahead, so it cannot choose deterministically."),
        ),
        ruleList("Conflicting productions", conflict.actions),
        paragraph(
          text("Rewrite "),
          ref(subject),
          text(" so these alternatives start with different FIRST symbols, or factor the shared prefix into a new helper rule."),
        ),
      ],
    };
  }

  if (conflict.parser === "RD") {
    const subject = conflict.subject ?? conflict.symbol;
    return {
      id: `conflict-${conflict.parser}-${subject}`,
      tone: "left-recursion",
      title: [ref(subject), text(" cannot be parsed by direct recursive descent")],
      body: [
        ...suggestionTextToBlocks(conflict.suggestion),
      ],
    };
  }

  const state = conflict.state === undefined ? "the grammar" : `state ${conflict.state}`;
  return {
    id: `conflict-${conflict.parser}-${conflict.state ?? "grammar"}-${conflict.symbol}`,
    tone: "conflict",
    title: [text(conflict.parser), text(" has a conflict in "), ref(state)],
    body: [
      paragraph(
        text(conflict.parser),
        text(" "),
        ref(state),
        text(" has more than one valid table action when the lookahead is "),
        ref(displaySymbol(conflict.symbol)),
        text("."),
      ),
      ruleList("Competing table actions", conflict.actions),
      paragraph(text(conflict.suggestion)),
    ],
  };
}

function suggestionToNotification(suggestion: GrammarSuggestion): ParserNotification {
  const titleMatch = suggestion.title.match(/^(.+?) (recurses|has alternatives)/);
  const subject = titleMatch?.[1];

  return {
    id: `suggestion-${suggestion.kind}-${suggestion.title}-${suggestion.details}`,
    tone: suggestion.kind,
    title: subject ? replaceFirstReference(suggestion.title, subject) : [text(suggestion.title)],
    body: [
      paragraph(...highlightKnownReferences(suggestion.body, suggestion)),
      ruleList("Suggested rewrite", suggestion.rewrite ?? rewriteFromDetails(suggestion.details)),
    ],
  };
}

function suggestionTextToBlocks(value: string): NotificationBlock[] {
  return value
    .split(/\n\n+/)
    .flatMap((chunk): NotificationBlock[] => {
      const rewrite = rewriteFromDetails(chunk);
      const prose = chunk.replace(/\n?Suggested rewrite:\n[\s\S]*$/, "").trim();
      return [
        ...(prose ? [paragraph(...highlightRulesInText(prose))] : []),
        ...(rewrite.length ? [ruleList("Suggested rewrite", rewrite)] : []),
      ];
    });
}

function WarningCard({ notification }: { notification: ParserNotification }) {
  const styles = NOTIFICATION_STYLES[notification.tone];

  return (
    <div className={cn("relative overflow-hidden rounded-md border p-3 sm:p-4", styles.card)}>
      <div className={cn("absolute left-0 top-0 h-full w-1", styles.marker)} />
      <p className="pl-2 text-sm font-medium text-zinc-100">
        <InlineText segments={notification.title} highlightClassName={styles.highlight} />
      </p>
      <div className="mt-2 space-y-3 pl-2 text-xs leading-5 text-zinc-300">
        {notification.body.map((block, index) => (
          <NotificationBlockView
            key={index}
            block={block}
            highlightClassName={styles.highlight}
          />
        ))}
      </div>
    </div>
  );
}

function NotificationBlockView({
  block,
  highlightClassName,
}: {
  block: NotificationBlock;
  highlightClassName: string;
}) {
  if (block.kind === "paragraph") {
    return (
      <p>
        <InlineText segments={block.content} highlightClassName={highlightClassName} />
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-500">{block.title}</p>
      <ul className="space-y-1.5">
        {block.items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
            <code className="min-w-0 font-mono text-xs text-zinc-200">
              <InlineText segments={item} highlightClassName={highlightClassName} />
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineText({
  segments,
  highlightClassName,
}: {
  segments: InlineSegment[];
  highlightClassName: string;
}) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.highlight ? (
          <span
            key={`${segment.text}-${index}`}
            className={cn("rounded border px-1 py-0.5 font-mono text-[0.95em]", highlightClassName)}
          >
            {segment.text}
          </span>
        ) : (
          <Fragment key={`${segment.text}-${index}`}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

function paragraph(...content: InlineSegment[]): NotificationBlock {
  return { kind: "paragraph", content };
}

function ruleList(title: string, items: string[]): NotificationBlock {
  return segmentList(title, items.map((item) => [ref(item)]));
}

function segmentList(title: string, items: InlineSegment[][]): NotificationBlock {
  return { kind: "rule-list", title, items };
}

function text(value: string): InlineSegment {
  return { text: value };
}

function ref(value: string): InlineSegment {
  return { text: value, highlight: true };
}

function replaceFirstReference(value: string, reference: string) {
  const index = value.indexOf(reference);
  if (index < 0) return [text(value)];
  return [
    text(value.slice(0, index)),
    ref(reference),
    text(value.slice(index + reference.length)),
  ].filter((segment) => segment.text);
}

function highlightKnownReferences(value: string, suggestion: GrammarSuggestion) {
  const rewrite = suggestion.rewrite ?? rewriteFromDetails(suggestion.details);
  const candidates = [
    ...(suggestion.references ?? []),
    ...rewrite,
  ].filter((candidate) => candidate && candidate.length > 1);

  return splitByReferences(value, candidates);
}

function highlightRulesInText(value: string) {
  const productionReferences = value.match(/[A-Za-z_][A-Za-z0-9_']*\s+->\s+.+?(?=\s+calls\b|\s+both\b|\.|$)/g) ?? [];
  const symbolReferences = [
    ...value.matchAll(/\b(?:calls|into|let)\s+([A-Za-z_][A-Za-z0-9_']*)/g),
  ].map((match) => match[1]);

  return splitByReferences(value, [...productionReferences, ...symbolReferences]);
}

function splitByReferences(value: string, references: string[]) {
  const ordered = [...new Set(references)].sort((left, right) => right.length - left.length);
  if (!ordered.length) return [text(value)];

  const pattern = ordered.map(referenceToPattern).join("|");
  const re = new RegExp(pattern, "g");
  const segments: InlineSegment[] = [];
  let cursor = 0;

  for (const match of value.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push(text(value.slice(cursor, index)));
    segments.push(ref(match[0]));
    cursor = index + match[0].length;
  }

  if (cursor < value.length) segments.push(text(value.slice(cursor)));
  return segments;
}

function rewriteFromDetails(details: string) {
  const [, rewrite = ""] = details.split("Suggested rewrite:\n");
  return rewrite.split("\n").map((line) => line.trim()).filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referenceToPattern(value: string) {
  const escaped = escapeRegExp(value);
  const startsWithWord = /^\w/.test(value);
  const endsWithWord = /\w$/.test(value);
  return `${startsWithWord ? "(?<![A-Za-z0-9_'])" : ""}${escaped}${endsWithWord ? "(?![A-Za-z0-9_'])" : ""}`;
}
