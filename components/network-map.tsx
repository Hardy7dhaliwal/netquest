"use client";

import { useState } from "react";
import { DEVICE_ICONS } from "@/components/device-icons";
import { MISSION_MAPS } from "@/lib/mission-maps";

/**
 * A compact static network map shown on missions that require typing exact
 * values (IPs, subnets, peers). The player should never have to guess an
 * address — every value they must type appears on this map. Rendered as plain
 * HTML/CSS (device cards + labeled links) so it is always readable in the
 * mission sidebar, without the fragile stretched-SVG approach.
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
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {map.devices.map((device) => {
              const Icon = DEVICE_ICONS[device.kind];
              return (
                <div
                  className="rounded-lg border border-cyan-300/25 bg-slate-950 px-2 py-2 text-center"
                  key={device.id}
                >
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-1.5 text-[11px] font-bold leading-tight text-slate-100">{device.label}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-cyan-200/80">{device.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5 border-t border-slate-800 pt-2">
            {map.links.map((link) => {
              const a = byId.get(link.from);
              const b = byId.get(link.to);
              if (!a || !b) return null;
              return (
                <p className="flex items-center gap-1.5 text-[10px] leading-tight text-slate-400" key={`${link.from}-${link.to}`}>
                  <span className="shrink-0 font-semibold text-slate-300">{a.label.split(" · ")[0]}</span>
                  <span className="text-cyan-300">—</span>
                  <span className={`min-w-0 flex-1 truncate rounded bg-slate-800 px-1.5 py-0.5 text-center font-semibold ${link.dashed ? "text-slate-400" : "text-cyan-200"}`}>{link.label}</span>
                  <span className="text-cyan-300">—</span>
                  <span className="shrink-0 font-semibold text-slate-300">{b.label.split(" · ")[0]}</span>
                </p>
              );
            })}
          </div>
          <p className="text-center text-[10px] leading-4 text-slate-500">
            These are the addresses you&rsquo;ll type in the console below.
          </p>
        </div>
      )}
    </section>
  );
}
