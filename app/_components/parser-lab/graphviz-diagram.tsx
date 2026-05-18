"use client";

import { instance } from "@viz-js/viz";
import { Maximize2, Minus, Move, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AutomataGraph } from "@/lib/parser-lab";
import { cn } from "@/lib/utils";

type GraphvizDiagramProps = {
  title: string;
  description: string;
  graph: AutomataGraph;
  rankdir?: "LR" | "TB";
};

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

const DIAGRAM_HEIGHT = 560;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;
const DEFAULT_VIEWPORT: Viewport = { scale: 1, x: 24, y: 24 };

export function GraphvizDiagram({ title, description, graph, rankdir = "LR" }: GraphvizDiagramProps) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(DEFAULT_VIEWPORT.scale);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; viewport: Viewport } | null>(null);
  const dot = useMemo(() => toDot(graph, rankdir), [graph, rankdir]);

  useEffect(() => {
    scaleRef.current = viewport.scale;
  }, [viewport.scale]);

  useEffect(() => {
    let cancelled = false;

    instance()
      .then((viz) => {
        const element = viz.renderSVGElement(dot, { engine: "dot" });
        if (cancelled) return;
        element.setAttribute("class", "block max-w-none select-none");
        setSvg(element.outerHTML);
        setError("");
        setViewport(DEFAULT_VIEWPORT);
      })
      .catch((renderError: unknown) => {
        if (cancelled) return;
        setSvg("");
        setError(renderError instanceof Error ? renderError.message : "Unable to render automata graph.");
      });

    return () => {
      cancelled = true;
    };
  }, [dot]);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const container = viewportRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const originX = clientX - rect.left;
    const originY = clientY - rect.top;

    setViewport((current) => {
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      const appliedFactor = nextScale / current.scale;
      return {
        scale: nextScale,
        x: originX - (originX - current.x) * appliedFactor,
        y: originY - (originY - current.y) * appliedFactor,
      };
    });
  }, []);

  const zoomFromCenter = useCallback((factor: number) => {
    const container = viewportRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }, [zoomAt]);

  const fitToView = useCallback(() => {
    const container = viewportRef.current;
    const svgElement = contentRef.current?.querySelector("svg");
    if (!container || !(svgElement instanceof SVGSVGElement)) return;

    const bounds = svgElement.getBoundingClientRect();
    const contentWidth = bounds.width / scaleRef.current;
    const contentHeight = bounds.height / scaleRef.current;
    if (!contentWidth || !contentHeight) return;

    const padding = 48;
    const nextScale = clamp(
      Math.min(
        (container.clientWidth - padding) / contentWidth,
        (container.clientHeight - padding) / contentHeight,
      ),
      MIN_SCALE,
      MAX_SCALE,
    );

    setViewport({
      scale: nextScale,
      x: (container.clientWidth - contentWidth * nextScale) / 2,
      y: (container.clientHeight - contentHeight * nextScale) / 2,
    });
  }, []);

  useEffect(() => {
    if (!svg || error) return;
    const frame = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(frame);
  }, [error, fitToView, svg]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(event.clientX, event.clientY, factor);
  }, [zoomAt]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      viewport,
    };
    setIsPanning(true);
  }, [viewport]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) return;

    setViewport({
      ...panStart.viewport,
      x: panStart.viewport.x + event.clientX - panStart.x,
      y: panStart.viewport.y + event.clientY - panStart.y,
    });
  }, []);

  const stopPanning = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    if (panStart?.pointerId === event.pointerId) {
      panStartRef.current = null;
      setIsPanning(false);
    }
  }, []);

  return (
    <div className="rounded-md border border-zinc-800 bg-black">
      <div className="flex flex-col gap-3 border-b border-zinc-800 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1">
          <Move className="mx-1 size-3.5 text-zinc-500" />
          <GraphButton label="Zoom out" onClick={() => zoomFromCenter(1 / ZOOM_STEP)}>
            <Minus />
          </GraphButton>
          <GraphButton label="Zoom in" onClick={() => zoomFromCenter(ZOOM_STEP)}>
            <Plus />
          </GraphButton>
          <GraphButton label="Fit to view" onClick={fitToView}>
            <Maximize2 />
          </GraphButton>
        </div>
      </div>
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        className={cn(
          "relative overflow-hidden bg-zinc-950 touch-none",
          isPanning ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ height: DIAGRAM_HEIGHT }}
      >
        {error ? (
          <pre className="p-4 whitespace-pre-wrap font-mono text-xs text-red-200">{error}</pre>
        ) : svg ? (
          <div
            ref={contentRef}
            className="absolute left-0 top-0 will-change-transform [&_svg]:max-w-none [&_text]:font-mono"
            style={{
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
              transformOrigin: "0 0",
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="m-4 h-40 animate-pulse rounded-md bg-black" />
        )}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-zinc-800 bg-black/80 px-2 py-1 font-mono text-[10px] text-zinc-500">
          {Math.round(viewport.scale * 100)}%
        </div>
      </div>
    </div>
  );
}

function GraphButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClick} className="text-zinc-300 hover:text-white">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function toDot(graph: AutomataGraph, rankdir: "LR" | "TB") {
  return `digraph Automata {
  graph [
    rankdir=${rankdir},
    bgcolor="transparent",
    color="#27272a",
    fontcolor="#e4e4e7",
    fontname="monospace",
    margin="0.08",
    nodesep="0.45",
    ranksep="0.7"
  ];
  node [
    shape=box,
    style="rounded,filled",
    fillcolor="#09090b",
    color="#3f3f46",
    fontcolor="#f4f4f5",
    fontname="monospace",
    fontsize=10,
    margin="0.08,0.05"
  ];
  edge [
    color="#a1a1aa",
    fontcolor="#d4d4d8",
    fontname="monospace",
    fontsize=10,
    arrowsize=0.7
  ];

${graph.nodes.map((node) => {
  const colorAttrs = node.color
    ? `, fillcolor="${node.color}33", color="${node.color}", penwidth=2`
    : "";
  const shapeAttrs = node.shape ? `, shape="${node.shape}"` : "";
  return `  ${quote(node.id)} [label=${quote(node.label)}${colorAttrs}${shapeAttrs}];`;
}).join("\n")}

${graph.edges
  .map((edge) => {
    const style = edge.kind === "epsilon" ? ', style="dashed", color="#f59e0b", fontcolor="#fbbf24"' : "";
    const label = edge.label ? `label=${quote(edge.label)}` : 'label=""';
    return `  ${quote(edge.from)} -> ${quote(edge.to)} [${label}${style}];`;
  })
  .join("\n")}
}`;
}

function quote(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n")}"`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
