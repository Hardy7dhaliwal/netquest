"use client";

import { useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { MotionConfig, motion, useAnimationControls } from "framer-motion";
import type { PacketStatus } from "@/lib/mission";

type DeviceData = {
  icon: string;
  label: string;
  detail: string;
};

type DeviceNode = Node<DeviceData, "device">;

const NODES: DeviceNode[] = [
  {
    id: "pc-sales",
    type: "device",
    position: { x: 20, y: 120 },
    data: { icon: "▣", label: "PC-Sales", detail: "10.20.0.10 · VLAN 20" },
  },
  {
    id: "sw1",
    type: "device",
    position: { x: 220, y: 120 },
    data: { icon: "◇", label: "SW1", detail: "Gi0/1 trunk" },
  },
  {
    id: "sw2",
    type: "device",
    position: { x: 420, y: 120 },
    data: { icon: "◇", label: "SW2", detail: "Gi0/1 trunk" },
  },
  {
    id: "gw1",
    type: "device",
    position: { x: 620, y: 120 },
    data: { icon: "◎", label: "GW1", detail: "10.20.0.1" },
  },
];

const EDGES: Edge[] = [
  { id: "pc-sw1", source: "pc-sales", target: "sw1", label: "access · VLAN 20", animated: true },
  { id: "sw1-sw2", source: "sw1", target: "sw2", label: "trunk · VLAN 10 only", animated: true },
  { id: "sw2-gw1", source: "sw2", target: "gw1", label: "gateway path", animated: true },
];

const SUCCESS_PATH = [8, 35, 63, 90];
const BLOCKED_PATH = [8, 35, 49];

function DeviceNode({ data }: NodeProps<DeviceNode>) {
  return (
    <>
      <Handle className="!h-2 !w-2 !border-cyan-200 !bg-cyan-400" position={Position.Left} type="target" />
      <div className="min-w-[120px] rounded-2xl border border-cyan-300/30 bg-slate-950 px-3 py-3 text-center shadow-[0_0_25px_rgba(103,232,249,0.08)]">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-xl text-cyan-200">{data.icon}</div>
        <p className="mt-2 text-xs font-bold text-slate-100">{data.label}</p>
        <p className="mt-1 whitespace-nowrap text-[10px] text-slate-500">{data.detail}</p>
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
    controls.set({ left: `${path[0]}%`, opacity: packetStatus === "idle" ? 0 : 1 });
    return () => {
      runId.current += 1;
      controls.stop();
    };
  }, [controls, packetStatus, path]);

  useEffect(() => {
    if (!isPlaying || stepIndex >= path.length - 1) return;
    const currentRun = ++runId.current;
    void controls.start({ left: `${path[stepIndex + 1]}%` }, { duration: 0.7, ease: "easeInOut" }).then(() => {
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
    void controls.start({ left: `${path[nextIndex]}%` }, { duration: 0.45, ease: "easeInOut" }).then(() => {
      if (runId.current === currentRun) setStepIndex(nextIndex);
    });
  }

  function reset() {
    runId.current += 1;
    controls.stop();
    controls.set({ left: `${path[0]}%`, opacity: 1 });
    setStepIndex(0);
    setIsPlaying(false);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-[#07101f]">
        <div className="relative h-[360px] min-w-[760px]">
          <ReactFlow
            nodes={NODES}
            edges={EDGES.map((edge) => edge.id === "sw1-sw2" ? { ...edge, label: packetStatus === "success" ? "trunk · VLAN 10, 20" : "trunk · VLAN 10 only" } : edge)}
            nodeTypes={NODE_TYPES}
            nodesConnectable={false}
            nodesDraggable={false}
            panOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={24} size={1} />
            <Controls showZoom={false} showFitView={false} showInteractive={false} />
          </ReactFlow>
          {packetStatus !== "idle" && (
            <motion.div
              animate={controls}
              className={`pointer-events-none absolute top-[calc(50%-6px)] z-10 h-3 w-3 rounded-full shadow-[0_0_16px_currentColor] ${packetStatus === "success" ? "text-emerald-300" : "text-rose-300"}`}
              initial={{ left: `${path[0]}%`, opacity: 1 }}
              title={packetStatus === "success" ? "Packet reached GW1" : "Packet stopped at the trunk"}
            >
              <span className={`block h-full w-full rounded-full ${packetStatus === "success" ? "bg-emerald-300" : "bg-rose-300"}`} />
            </motion.div>
          )}
        </div>
      </div>
      <PacketControls packetStatus={packetStatus} isPlaying={isPlaying} stepIndex={stepIndex} stepCount={path.length} onPlay={play} onPause={pause} onStep={step} onReset={reset} />
    </MotionConfig>
  );
}
