"use client";
import { Wordmark } from "@/components/wordmark";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { GlossaryText } from "@/components/glossary-text";
import { DEVICE_ICONS, PacketIcon, type DeviceKind } from "@/components/device-icons";

import {
  answerCheckpoint,
  nextStep,
  PACKET_TRAIL_STOPS,
  prevStep,
  type PacketTrailMissionState,
  type PacketTrailOption,
} from "@/lib/packet-trail-mission";

const DEVICES: { id: string; kind: DeviceKind; label: string; detail: string }[] = [
  { id: "pc-sales", kind: "pc", label: "PC-Sales", detail: "10.20.0.10 · VLAN 20" },
  { id: "sw1", kind: "switch", label: "SW1", detail: "access port" },
  { id: "sw2", kind: "switch", label: "SW2", detail: "access + trunk" },
  { id: "gw1", kind: "router", label: "GW1", detail: "10.20.0.1 · VLAN 20" },
];

const LINKS = [
  { id: "pc-sw1", label: "access · VLAN 20" },
  { id: "sw1-sw2", label: "trunk · VLAN 10, 20" },
  { id: "sw2-gw1", label: "access · VLAN 20" },
];

const STOPS = [
  {
    title: "The goal",
    icon: "🎯",
    activeDevices: ["pc-sales", "sw1", "sw2", "gw1"],
    activeLinks: [] as string[],
    focusLink: null as string | null,
    body: "PC-Sales (10.20.0.10) needs to reach the gateway GW1 (10.20.0.1), and a ping will prove the path. Both are on the same VLAN 20 — but they are not on the same switch, so the packet has a journey to make.",
  },
  {
    title: "The access port",
    icon: "🔌",
    activeDevices: ["pc-sales", "sw1"],
    activeLinks: ["pc-sw1"],
    focusLink: "pc-sw1",
    body: "The frame leaves PC-Sales and enters SW1's access port. An access port belongs to exactly one VLAN — VLAN 20 here. That is how the switch knows which broadcast domain PC-Sales belongs to.",
  },
  {
    title: "The trunk",
    icon: "🌉",
    activeDevices: ["sw1", "sw2"],
    activeLinks: ["sw1-sw2"],
    focusLink: "sw1-sw2",
    body: "SW1 is not directly connected to the gateway, so the frame must cross to SW2. The link between the switches is a trunk: it carries many VLANs at once, tagging each frame with 802.1Q so SW2 knows this one is VLAN 20.",
  },
  {
    title: "Arrival at SW2",
    icon: "📨",
    activeDevices: ["sw2", "gw1"],
    activeLinks: ["sw2-gw1"],
    focusLink: "sw2-gw1",
    body: "SW2 reads the VLAN 20 tag, strips it, and forwards the frame out its access port toward GW1. The gateway also lives in VLAN 20 — the same broadcast domain — so it can answer.",
  },
  {
    title: "The reply",
    icon: "↩️",
    activeDevices: ["pc-sales", "sw1", "sw2", "gw1"],
    activeLinks: ["pc-sw1", "sw1-sw2", "sw2-gw1"],
    focusLink: "sw2-gw1",
    body: "GW1 replies and the packet returns the same way it came — across the trunk, back through SW1, to PC-Sales. A successful ping means every link did its job: access ports placed both devices in VLAN 20, and the trunk carried the frame between switches.",
  },
];

const CHECKPOINT_OPTIONS: { value: PacketTrailOption; title: string; note: string }[] = [
  { value: "trunk-carries-many", title: "A trunk carries frames from many VLANs between switches.", note: "802.1Q tags tell the far switch which VLAN each frame belongs to." },
  { value: "trunk-one-vlan", title: "A trunk only ever carries a single VLAN.", note: "That is an access port — a trunk carries many VLANs at once." },
  { value: "access-between-switches", title: "Switches connect to each other with access ports.", note: "Inter-switch links become trunks when more than one VLAN must cross." },
];

export default function PacketTrailMission({
  mission,
  onChange,
  onExit,
}: {
  mission: PacketTrailMissionState;
  onChange: (next: PacketTrailMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const atCheckpoint = mission.stepIndex >= PACKET_TRAIL_STOPS;
  const stop = STOPS[Math.min(mission.stepIndex, STOPS.length - 1)];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Beginner track" />
            <h1 className="mt-2 text-xl font-bold">The Packet Trail</h1>
            <p className="mt-1 text-xs text-slate-500">How a packet crosses a network · 50 XP</p>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 p-5 lg:p-8">
        {complete && (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Tour complete</p>
            <p className="mt-2 text-2xl font-black">You can read the map now. +50 XP</p>
            <p className="mt-2 text-sm text-slate-400"><GlossaryText text="Access ports place devices in one VLAN · trunks carry many VLANs between switches · ping proves the whole path." /></p>
          </div>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{atCheckpoint ? "Checkpoint" : `Stop ${mission.stepIndex + 1} of ${PACKET_TRAIL_STOPS}`}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{atCheckpoint ? "Did it stick?" : `${stop.icon} ${stop.title}`}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {STOPS.map((item, index) => (
                <span className={`h-1.5 w-6 rounded-full transition ${index < mission.stepIndex || complete ? "bg-emerald-300" : index === mission.stepIndex && !atCheckpoint ? "bg-cyan-300" : "bg-slate-700"}`} key={item.title} />
              ))}
            </div>
          </div>

          {/* Network diagram */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800 bg-[#07101f] p-5">
            <div className="flex min-w-[620px] items-center gap-2">
              {DEVICES.map((device, index) => {
                const DeviceIcon = DEVICE_ICONS[device.kind];
                return (
                  <Fragment key={device.id}>
                    <div className={`min-w-[128px] rounded-2xl border px-3 py-3 text-center transition ${stop.activeDevices.includes(device.id) ? "border-cyan-300/50 bg-cyan-300/5 shadow-[0_0_25px_rgba(103,232,249,0.12)]" : "border-slate-700 bg-slate-950/70 opacity-50"}`}>
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                        <DeviceIcon className="h-7 w-7" />
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-100">{device.label}</p>
                      <p className="mt-1 whitespace-nowrap text-[10px] text-slate-500">{device.detail}</p>
                    </div>
                    {index < DEVICES.length - 1 && (
                      <div className="relative flex-1">
                        <div className={`border-t-2 border-dashed transition ${stop.activeLinks.includes(LINKS[index].id) ? "border-cyan-300/70" : "border-slate-700"}`} />
                        <span className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider transition ${stop.activeLinks.includes(LINKS[index].id) ? "text-cyan-200" : "text-slate-600"}`}>{LINKS[index].label}</span>
                        {stop.focusLink === LINKS[index].id && (
                          <motion.div
                            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.9)]"
                            layoutId="trail-dot"
                            transition={{ type: "spring", stiffness: 300, damping: 24 }}
                          >
                            <PacketIcon className="h-5 w-5" />
                          </motion.div>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>

          {/* Step explanation or checkpoint */}
          {!complete && (atCheckpoint ? (
            <div className="mt-8">
              <p className="max-w-2xl text-sm leading-6 text-slate-400"><GlossaryText text="You just watched a packet cross a two-switch network. Which statement about the link between SW1 and SW2 is correct?" /></p>
              <div className="mt-5 grid gap-4 md:grid-cols-3" role="group" aria-label="Choose the correct statement about trunks">
                {CHECKPOINT_OPTIONS.map((option) => {
                  const selected = mission.checkpointAnswer === option.value;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected && option.value === "trunk-carries-many" ? "border-emerald-300/60 bg-emerald-300/10" : selected ? "border-rose-300/60 bg-rose-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`}
                      key={option.value}
                      onClick={() => onChange(answerCheckpoint(mission, option.value))}
                      type="button"
                    >
                      <p className="text-sm font-bold leading-5">{option.title}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{option.note}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300"><GlossaryText text={stop.body} /></p>
          ))}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={mission.stepIndex === 0 || complete}
              onClick={() => onChange(prevStep(mission))}
              type="button"
            >
              ← Back
            </button>
            {!atCheckpoint && !complete && (
              <button
                className="rounded-lg bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                onClick={() => onChange(nextStep(mission))}
                type="button"
              >
                {mission.stepIndex === PACKET_TRAIL_STOPS - 1 ? "Answer the checkpoint →" : "Next stop →"}
              </button>
            )}
          </div>
        </section>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <span className="text-xs text-slate-600">your trail</span>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto p-4" aria-live="polite">
            {mission.eventLog.length === 0 ? <p className="text-sm text-slate-600">Tour events will appear here.</p> : mission.eventLog.map((entry, index) => (
              <div className="flex gap-3 text-xs" key={`${entry.message}-${index}`}>
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} />
                <span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
