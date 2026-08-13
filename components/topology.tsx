"use client";

import { useEffect, useRef, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import { MotionConfig, motion, useAnimationControls } from "framer-motion";
import type { PacketStatus } from "@/lib/mission";
import { DEVICE_ICONS, PacketIcon, type DeviceKind } from "@/components/device-icons";

type DeviceData = {
  kind: DeviceKind;
  label: string;
  detail: string;
  hover: { role: string; lines: string[] };
};

type DeviceNode = Node<DeviceData, "device">;

const NODES: DeviceNode[] = [
  {
    id: "pc-sales",
    type: "device",
    position: { x: 20, y: 120 },
    data: {
      kind: "pc",
      label: "PC-Sales",
      detail: "10.20.0.10 · VLAN 20",
      hover: {
        role: "Workstation",
        lines: ["10.20.0.10 · VLAN 20", "Sales desktop — needs the gateway", "Access port on SW1"],
      },
    },
  },
  {
    id: "sw1",
    type: "device",
    position: { x: 220, y: 120 },
    data: {
      kind: "switch",
      label: "SW1",
      detail: "Gi0/1 trunk",
      hover: {
        role: "Access switch",
        lines: ["Serves the Sales access port", "Gi0/1 trunk toward SW2", "Trunk allows only VLAN 10 — VLAN 20 missing"],
      },
    },
  },
  {
    id: "sw2",
    type: "device",
    position: { x: 420, y: 120 },
    data: {
      kind: "switch",
      label: "SW2",
      detail: "Gi0/1 trunk",
      hover: {
        role: "Access switch",
        lines: ["Gi0/1 trunk back to SW1", "Gateway path toward GW1", "Would forward VLAN 20 once the trunk allows it"],
      },
    },
  },
  {
    id: "gw1",
    type: "device",
    position: { x: 620, y: 120 },
    data: {
      kind: "router",
      label: "GW1",
      detail: "10.20.0.1",
      hover: {
        role: "Default gateway",
        lines: ["10.20.0.1 — the Sales gateway", "Answers ARP for VLAN 20", "Unreachable while the trunk blocks VLAN 20"],
      },
    },
  },
];

type LinkData = {
  label: string;
  explain: string[];
};

type LinkEdge = Edge<LinkData, "link">;

function buildEdges(packetStatus: PacketStatus): LinkEdge[] {
  const trunkOpen = packetStatus === "success";
  return [
    {
      id: "pc-sw1",
      type: "link",
      source: "pc-sales",
      target: "sw1",
      animated: true,
      data: {
        label: "access · VLAN 20",
        explain: ["Access port on SW1", "Carries untagged frames for VLAN 20", "PC-Sales connects here"],
      },
    },
    {
      id: "sw1-sw2",
      type: "link",
      source: "sw1",
      target: "sw2",
      animated: true,
      data: trunkOpen
        ? { label: "trunk · VLAN 10, 20", explain: ["Inter-switch trunk", "Now carries VLAN 20 after the fix", "Gateway path restored"] }
        : { label: "trunk · VLAN 10 only", explain: ["Inter-switch trunk", "Allowed list: VLAN 10 only", "VLAN 20 frames are dropped here — the fault"] },
    },
    {
      id: "sw2-gw1",
      type: "link",
      source: "sw2",
      target: "gw1",
      animated: true,
      data: {
        label: "gateway path",
        explain: ["SW2 to GW1 uplink", "Routed gateway link for VLAN 20", "Only reachable once the trunk allows VLAN 20"],
      },
    },
  ];
}

function LinkLabel({
  data,
  labelX,
  labelY,
  open,
  onToggle,
}: {
  data: LinkData;
  labelX: number;
  labelY: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <button
        aria-expanded={open}
        aria-label={`Explain this link: ${data.label}`}
        className={`nodrag nopan pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${open ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-200" : "border-slate-700 bg-[#0a1628] text-slate-400 hover:border-cyan-300/50 hover:text-cyan-200"}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        style={{ left: labelX, top: labelY }}
        type="button"
      >
        {data.label}
      </button>
      {open && (
        <div
          className="pointer-events-none absolute z-50 w-56 rounded-lg border border-cyan-300/25 bg-[#0a1628] p-3 text-left shadow-2xl shadow-black/50"
          style={{ left: labelX, top: labelY - 12, transform: "translate(-50%, -100%)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{data.label}</p>
          <ul className="mt-2 space-y-1.5">
            {data.explain.map((line) => (
              <li className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-300" key={line}>
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/60" />
                {line}
              </li>
            ))}
          </ul>
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-cyan-300/25 bg-[#0a1628]" />
        </div>
      )}
    </>
  );
}

function LinkEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<LinkEdge>) {
  const [open, setOpen] = useState(false);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        {data && <LinkLabel data={data} labelX={labelX} labelY={labelY} open={open} onToggle={() => setOpen((value) => !value)} />}
      </EdgeLabelRenderer>
    </>
  );
}

const EDGE_TYPES: EdgeTypes = { link: LinkEdge };

// Packet path in React Flow coordinates (node-center X positions), so the dot
// lives inside the viewport and stays glued to the links at any zoom level.
const NODE_CENTER_X = { pc: 80, sw1: 280, sw2: 480, gw1: 680 } as const;
const LINK_Y = 170;
const SUCCESS_PATH = [NODE_CENTER_X.pc, NODE_CENTER_X.sw1, NODE_CENTER_X.sw2, NODE_CENTER_X.gw1];
const BLOCKED_PATH = [NODE_CENTER_X.pc, NODE_CENTER_X.sw1, NODE_CENTER_X.sw2];

// The mission remounts <Topology> (keyed on the event-log length) after every
// console command. The viewport is kept here, outside the component, so the
// player's zoom/pan survives those remounts instead of snapping back to fit.
let lastViewport: Viewport | null = null;

function DeviceNode({ data }: NodeProps<DeviceNode>) {
  const Icon = DEVICE_ICONS[data.kind];
  return (
    <>
      <Handle className="!h-2 !w-2 !border-cyan-200 !bg-cyan-400" position={Position.Left} type="target" />
      <div className="group relative">
        <div className="min-w-[120px] rounded-2xl border border-cyan-300/30 bg-slate-950 px-3 py-3 text-center shadow-[0_0_25px_rgba(103,232,249,0.08)] transition-colors duration-150 group-hover:border-cyan-300/60">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 transition-colors duration-150 group-hover:bg-cyan-300/20">
            <Icon className="h-7 w-7" />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-100">{data.label}</p>
          <p className="mt-1 whitespace-nowrap text-[10px] text-slate-500">{data.detail}</p>
        </div>
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-52 -translate-x-1/2 scale-95 rounded-lg border border-cyan-300/25 bg-[#0a1628] p-3 text-left opacity-0 shadow-2xl shadow-black/50 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{data.hover.role}</p>
          <ul className="mt-2 space-y-1.5">
            {data.hover.lines.map((line) => (
              <li className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-300" key={line}>
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/60" />
                {line}
              </li>
            ))}
          </ul>
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-cyan-300/25 bg-[#0a1628]" />
        </div>
      </div>
      <Handle className="!h-2 !w-2 !border-cyan-200 !bg-cyan-400" position={Position.Right} type="source" />
    </>
  );
}

const NODE_TYPES: NodeTypes = { device: DeviceNode };

function PacketControls({
  packetStatus,
  isPlaying,
  stepIndex,
  stepCount,
  onPlay,
  onPause,
  onStep,
  onReset,
}: {
  packetStatus: PacketStatus;
  isPlaying: boolean;
  stepIndex: number;
  stepCount: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
}) {
  const disabled = packetStatus === "idle";
  const complete = disabled || stepIndex >= stepCount - 1;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
      <div className="text-xs text-slate-500">
        Packet playback <span className="text-slate-300">{disabled ? "awaiting ping" : `${stepIndex}/${stepCount - 1} hops`}</span>
      </div>
      <div className="flex items-center gap-2">
        <button aria-label="Reset packet animation" className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={onReset} type="button">↺ Reset</button>
        {isPlaying ? (
          <button aria-label="Pause packet animation" className="rounded-md border border-cyan-300/30 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10" onClick={onPause} type="button">Ⅱ Pause</button>
        ) : (
          <button aria-label="Play packet animation" className="rounded-md border border-cyan-300/30 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || complete} onClick={onPlay} type="button">▶ Play</button>
        )}
        <button aria-label="Step packet animation" className="rounded-md bg-cyan-300 px-2.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || complete} onClick={onStep} type="button">Step →</button>
      </div>
    </div>
  );
}

export default function Topology({ packetStatus }: { packetStatus: PacketStatus }) {
  const controls = useAnimationControls();
  const runId = useRef(0);
  const [isPlaying, setIsPlaying] = useState(packetStatus !== "idle");
  const [stepIndex, setStepIndex] = useState(0);
  const path = packetStatus === "blocked" ? BLOCKED_PATH : SUCCESS_PATH;

  useEffect(() => {
    controls.set({ left: `${path[0]}px`, opacity: packetStatus === "idle" ? 0 : 1 });
    return () => {
      runId.current += 1;
      controls.stop();
    };
  }, [controls, packetStatus, path]);

  useEffect(() => {
    if (!isPlaying || stepIndex >= path.length - 1) return;
    const currentRun = ++runId.current;
    void controls.start({ left: `${path[stepIndex + 1]}px` }, { duration: 0.7, ease: "easeInOut" }).then(() => {
      if (runId.current === currentRun) {
        setStepIndex((value) => value + 1);
      }
    });
    return () => {
      runId.current += 1;
      controls.stop();
    };
  }, [controls, isPlaying, path, stepIndex]);

  function play() {
    if (stepIndex < path.length - 1) setIsPlaying(true);
  }

  function pause() {
    runId.current += 1;
    controls.stop();
    setIsPlaying(false);
  }

  function step() {
    if (stepIndex >= path.length - 1) return;
    pause();
    const nextIndex = stepIndex + 1;
    const currentRun = ++runId.current;
    void controls.start({ left: `${path[nextIndex]}px` }, { duration: 0.45, ease: "easeInOut" }).then(() => {
      if (runId.current === currentRun) setStepIndex(nextIndex);
    });
  }

  function reset() {
    runId.current += 1;
    controls.stop();
    controls.set({ left: `${path[0]}px`, opacity: 1 });
    setStepIndex(0);
    setIsPlaying(false);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-800 bg-[#07101f]">
        <div className="relative h-[360px] w-full">
          <ReactFlow
            nodes={NODES}
            edges={buildEdges(packetStatus)}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            nodesConnectable={false}
            nodesDraggable={false}
            panOnDrag
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            zoomOnPinch
            minZoom={0.35}
            maxZoom={2.5}
            defaultViewport={lastViewport ?? undefined}
            fitView={lastViewport === null}
            fitViewOptions={{ padding: 0.15 }}
            onMoveEnd={(_, viewport) => {
              lastViewport = viewport;
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={24} size={1} />
            <Controls position="bottom-right" showInteractive={false} />
            {packetStatus !== "idle" && (
              <motion.div
                animate={controls}
                className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_8px_currentColor] ${packetStatus === "success" ? "text-emerald-300" : "text-rose-300"}`}
                initial={{ left: `${path[0]}px`, opacity: 1 }}
                style={{ top: `${LINK_Y}px` }}
                title={packetStatus === "success" ? "Packet reached GW1" : "Packet stopped at the trunk"}
              >
                <PacketIcon className="h-5 w-5" />
              </motion.div>
            )}
          </ReactFlow>
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-[10px] text-slate-500">
            drag to pan · pinch / + − to zoom
          </div>
        </div>
      </div>
      <PacketControls packetStatus={packetStatus} isPlaying={isPlaying} stepIndex={stepIndex} stepCount={path.length} onPlay={play} onPause={pause} onStep={step} onReset={reset} />
    </MotionConfig>
  );
}
