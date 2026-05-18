import { Fragment } from "react";

import type { Conflict, GrammarSuggestion, ParserType } from "@/lib/parser-lab";
import { cn } from "@/lib/utils";
import {
  buildParserNotifications,
  type InlineSegment,
  type NotificationBlock,
  type NotificationTone,
  type ParserNotification,
} from "./model/parser-notifications";

const NOTIFICATION_STYLES: Record<
  NotificationTone,
  { card: string; marker: string; highlight: string }
> = {
  normalization: {
    card: "border-teal-900/80 bg-teal-950/25",
    marker: "bg-teal-400 shadow-[0_0_18px_rgba(45,212,191,0.35)]",
    highlight: "border-teal-500/30 bg-teal-300/10 text-teal-100",
  },
  conflict: {
    card: "border-rose-900/80 bg-rose-950/25",
    marker: "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.35)]",
    highlight: "border-rose-500/30 bg-rose-300/10 text-rose-100",
  },
  "left-recursion": {
    card: "border-amber-900/80 bg-amber-950/25",
    marker: "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.35)]",
    highlight: "border-amber-500/30 bg-amber-300/10 text-amber-100",
  },
  "left-factorization": {
    card: "border-cyan-900/80 bg-cyan-950/25",
    marker: "bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.35)]",
    highlight: "border-cyan-500/30 bg-cyan-300/10 text-cyan-100",
  },
  clear: {
    card: "border-emerald-900/80 bg-emerald-950/25",
    marker: "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.35)]",
    highlight: "border-emerald-500/30 bg-emerald-300/10 text-emerald-100",
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
  const notifications = buildParserNotifications({
    notes,
    activeConflicts,
    parser,
    llSuggestions,
  });

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <WarningCard key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function WarningCard({ notification }: { notification: ParserNotification }) {
  const styles = NOTIFICATION_STYLES[notification.tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border p-3 sm:p-4",
        styles.card,
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", styles.marker)} />
      <p className="pl-2 text-sm font-medium text-zinc-100">
        <InlineText
          segments={notification.title}
          highlightClassName={styles.highlight}
        />
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
        <InlineText
          segments={block.content}
          highlightClassName={highlightClassName}
        />
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        {block.title}
      </p>
      <ul className="space-y-1.5">
        {block.items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
            <code className="min-w-0 font-mono text-xs text-zinc-200">
              <InlineText
                segments={item}
                highlightClassName={highlightClassName}
              />
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
            className={cn(
              "rounded border px-1 py-0.5 font-mono text-[0.95em]",
              highlightClassName,
            )}
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
