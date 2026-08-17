"use client";

import { useState } from "react";
import { DEVICE_ICONS } from "@/components/device-icons";
import { MISSION_MAPS } from "@/lib/mission-maps";

/**
 * A compact static network map shown on missions that require typing exact
 * values (IPs, subnets, peers). The player should never have to guess an
 * address — every value they must type appears on this map. Rendered as a
 * lightweight SVG (no React Flow dependency) so it fits the mission sidebar.
 */
export function NetworkMap({ missionId }: { missionId: string }) {
  const [open, setOpen] = useState(true);
  const map = MISSION_MAPS[missionId];
  if (!map) return null;

  const byId = new Map(map.devices.map((device) => [device.id, device]));

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Network map</p>
        <span aria-hidden="true" className="text-cyan-300">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <svg className="h-44 w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Network topology with device addresses">
            {map.links.map((link) => {
              const a = byId.get(link.from);
              const b = byId.get(link.to);
              if (!a || !b) return null;
              return (
                <line
                  className={link.dashed ? "stroke-slate-500" : "stroke-cyan-400/50"}
                  key={`${link.from}-${link.to}`}
                  strokeDasharray={link.dashed ? "2 2" : undefined}
                  strokeWidth={0.5}
                  x1={a.x}
                  x2={b.x}
                  y1={a.y}
                  y2={b.y}
                />
              );
            })}
            {map.links.map((link) => {
              const a = byId.get(link.from);
              const b = byId.get(link.to);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              return (
                <text
                  className="fill-slate-400"
                  dominantBaseline="middle"
                  fontSize={3.2}
                  key={`${link.from}-${link.to}-label`}
                  textAnchor="middle"
                  x={mx}
                  y={my}
                >
                  {link.label}
                </text>
              );
            })}
            {map.devices.map((device) => {
              const Icon = DEVICE_ICONS[device.kind];
              return (
                <g key={device.id}>
                  <rect
                    className="fill-slate-950 stroke-cyan-300/30"
                    height={18}
                    rx={2.5}
                    strokeWidth={0.4}
                    width={22}
                    x={device.x - 11}
                    y={device.y - 9}
                  />
                  <g transform={`translate(${device.x - 2.6}, ${device.y - 8.2}) scale(0.22)`}>
                    <Icon className="text-cyan-200" />
                  </g>
                  <text className="fill-slate-100" dominantBaseline="middle" fontSize={3.3} fontWeight={700} textAnchor="middle" x={device.x} y={device.y + 2}>
                    {device.label}
                  </text>
                  <text className="fill-slate-500" dominantBaseline="middle" fontSize={2.9} textAnchor="middle" x={device.x} y={device.y + 5.6}>
                    {device.detail}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-1 text-center text-[10px] leading-4 text-slate-500">
            These are the addresses you&rsquo;ll type in the console below.
          </p>
        </div>
      )}
    </section>
  );
}
