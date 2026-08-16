"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  MissionState,
  MissionStatus,
  promptFor,
  resetMission,
  runCommand,
  startMission,
} from "@/lib/mission";
import Topology from "@/components/topology";
import { getLevel, useProgressStore } from "@/lib/progress-store";
import StpMission from "@/components/stp-mission";
import EtherchannelMission from "@/components/etherchannel-mission";
import OspfMission from "@/components/ospf-mission";
import EdgeMission from "@/components/edge-mission";
import GatewayMission from "@/components/gateway-mission";
import EdgeServicesMission from "@/components/edge-services-mission";
import TunnelVisionMission from "@/components/tunnel-vision-mission";
import FabricExpressMission from "@/components/fabric-express-mission";
import SdwanMission from "@/components/sdwan-mission";
import SignalDetectiveMission from "@/components/signal-detective-mission";
import CampusFabricMission from "@/components/campus-fabric-mission";
import LockControlPlaneMission from "@/components/lock-control-plane-mission";
import AutomatorPrimeMission from "@/components/automator-prime-mission";
import FieldMissionCard from "@/components/field-mission-card";
import CoverageDashboard from "@/components/coverage-dashboard";
import MasteryPanel from "@/components/mastery-panel";
import ReadinessReport from "@/components/readiness-report";
import ExamHall from "@/components/exam-hall";
import LabsPanel from "@/components/labs-panel";
import AdaptiveReview from "@/components/adaptive-review";
import { getReadinessReportV2 } from "@/lib/readiness";
import BadgesPanel from "@/components/badges-panel";
import TrainingGrounds from "@/components/training-grounds";
import SyncPanel from "@/components/sync-panel";
import AccountButton from "@/components/account-button";
import AuthBanner from "@/components/auth-banner";
import ArcQuiz from "@/components/arc-quiz";
import FlashcardReview from "@/components/flashcard-review";
import RescueLauncher from "@/components/rescue-launcher";
import { resetStpMission, startStpMission, type StpMissionState } from "@/lib/stp-mission";
import { resetEcMission, startEcMission, type EcMissionState } from "@/lib/etherchannel-mission";
import { resetOspfMission, startOspfMission, type OspfMissionState } from "@/lib/ospf-mission";
import { resetEdgeMission, startEdgeMission, type EdgeMissionState } from "@/lib/edge-mission";
import { resetGatewayMission, startGatewayMission, type GatewayMissionState } from "@/lib/gateway-mission";
import { resetEdgeServicesMission, startEdgeServicesMission, type EdgeServicesMissionState } from "@/lib/edge-services-mission";
import { resetTunnelVisionMission, startTunnelVisionMission, type TunnelVisionMissionState } from "@/lib/tunnel-vision-mission";
import { resetFabricExpressMission, startFabricExpressMission, type FabricExpressMissionState } from "@/lib/fabric-express-mission";
import { resetSdwanMission, startSdwanMission, type SdwanMissionState } from "@/lib/sdwan-mission";
import { resetSignalDetectiveMission, startSignalDetectiveMission, type SignalDetectiveMissionState } from "@/lib/signal-detective-mission";
import { resetCampusFabricMission, startCampusFabricMission, type CampusFabricMissionState } from "@/lib/campus-fabric-mission";
import { resetLockControlPlaneMission, startLockControlPlaneMission, type LockControlPlaneMissionState } from "@/lib/lock-control-plane-mission";
import { resetAutomatorPrimeMission, startAutomatorPrimeMission, type AutomatorPrimeMissionState } from "@/lib/automator-prime-mission";
import { advanceQuiz as advanceQuizStep, answerQuiz as answerQuizStep, getArcQuiz, quizScore, startQuiz, type QuizSessionState } from "@/lib/quiz";
import { dueCards, getFlashcardDeck } from "@/lib/flashcards";
import { buildReviewQueue, dueReviewCount, type ReviewItem, type ReviewLabItem, type ReviewQuestionItem } from "@/lib/review";
import { getBadgeStatus } from "@/lib/badges";
import { rescueFor } from "@/lib/rescues";
import CliBasicsMission from "@/components/cli-basics-mission";
import ShowAndPingMission from "@/components/show-and-ping-mission";
import PacketTrailMission from "@/components/packet-trail-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { NextMissionButton, type NextMission } from "@/components/next-mission-button";
import { GlossaryText } from "@/components/glossary-text";
import { Wordmark } from "@/components/wordmark";
import { CLI_BASICS_STEPS, resetCliBasicsMission, startCliBasicsMission, type CliBasicsMissionState } from "@/lib/cli-basics-mission";
import { SHOW_PING_STEPS, resetShowAndPingMission, startShowAndPingMission, type ShowAndPingMissionState } from "@/lib/show-and-ping-mission";
import { PACKET_TRAIL_STOPS, resetPacketTrailMission, startPacketTrailMission, type PacketTrailMissionState } from "@/lib/packet-trail-mission";

const FLASHCARD_DECK = getFlashcardDeck();

type MissionCatalogEntry = {
  id: string;
  title: string;
  desc: string;
  xp: number;
  tier: "beginner" | "field";
};

/** All 17 missions in the recommended play order — the dashboard uses this to point players at the next one. */
const MISSION_CATALOG: MissionCatalogEntry[] = [
  { id: "console-basics", title: "Console Basics", desc: "Your first five commands: help, enable, config mode, end, show version.", xp: 50, tier: "beginner" },
  { id: "show-and-ping", title: "Show & Ping", desc: "Read a healthy network with show commands and prove it with ping.", xp: 50, tier: "beginner" },
  { id: "packet-trail", title: "The Packet Trail", desc: "A visual tour: how a packet crosses a two-switch network, access ports, and trunks.", xp: 50, tier: "beginner" },
  { id: "vlan-that-vanished", title: "The VLAN That Vanished", desc: "After a switch upgrade, Sales users on VLAN 20 cannot reach their gateway. The access port and gateway are configured, but traffic crossing the inter-switch trunk is failing.", xp: 150, tier: "field" },
  { id: "stp-storm", title: "The STP Storm", desc: "Predict the root bridge before the loop takes down the campus.", xp: 100, tier: "field" },
  { id: "bundled-bottleneck", title: "The Bundled Bottleneck", desc: "Only one of two LACP links ever bundles. Find the mismatch and restore the 2 Gbps path.", xp: 100, tier: "field" },
  { id: "area-zero-hero", title: "Area Zero Hero", desc: "R2 never reaches FULL OSPF adjacency. Fix the area fault, verify convergence, summarize — then filter the lab out of area 0.", xp: 100, tier: "field" },
  { id: "edge-has-opinions", title: "The Edge Has Opinions", desc: "Pick the IGP, type the eBGP fix on the console, and steer special traffic with PBR at the border.", xp: 150, tier: "field" },
  { id: "gateway-at-dawn", title: "Gateway at Dawn", desc: "Design the campus, then configure HSRP on the distribution pair — and prove the virtual gateway survives when the active router dies.", xp: 150, tier: "field" },
  { id: "edge-services", title: "Edge Services", desc: "Read the WAN QoS and clock configs, then build PAT so the whole LAN shares one public address — and prove it with the translation table.", xp: 150, tier: "field" },
  { id: "tunnel-vision", title: "Tunnel Vision", desc: "The wire is tapped. Isolate the guests with a VRF, then build an encrypted GRE-over-IPsec tunnel so the branch reaches HQ safely.", xp: 150, tier: "field" },
  { id: "fabric-express", title: "The Fabric Express", desc: "Workloads went virtual. Read the VM, inspect the vSwitch inside the hypervisor, then trace the VXLAN overlay from the VTEP to its peers.", xp: 100, tier: "field" },
  { id: "sdwan-overlay", title: "SD-WAN: The WAN Overlay", desc: "The branch joins a Catalyst SD-WAN fabric. Map the planes, read what OMP carries, verify the vEdge's TLOCs and BFD — then weigh the benefit against the cost.", xp: 100, tier: "field" },
  { id: "signal-detective", title: "The Signal Detective", desc: "The finance app is crawling. Work the diagnostic ladder on R-CORE to catch the culprit, then build the watch: NetFlow, SPAN, IP SLA, and a programmatic interface.", xp: 150, tier: "field" },
  { id: "campus-fabric", title: "The Campus Fabric", desc: "The new campus runs SD-Access. Map the fabric roles, read the LISP EID-to-RLOC database on the control plane node, then predict how the legacy network reaches fabric hosts.", xp: 100, tier: "field" },
  { id: "lock-the-control-plane", title: "Lock the Control Plane", desc: "A guessed VTY password got someone in. Lock the branch router down layer by layer: local auth and SSH-only VTY lines, AAA against ISE, an infrastructure ACL, CoPP, a secure REST API — then the defense-in-depth picture.", xp: 200, tier: "field" },
  { id: "automator-prime", title: "Automator Prime", desc: "The ops team is going full automation. Write the Python probe, craft the JSON payloads, decode the YANG model, call the SD-WAN Manager API, read the responses, build the EEM config-save applet — then pick the orchestration model for the fleet.", xp: 200, tier: "field" },
];

const OBJECTIVES = [
  "Inspect VLAN state",
  "Inspect the trunk state",
  "Identify VLAN 20 is blocked",
  "Allow VLAN 20 on the trunk",
  "Verify with a successful ping — type ping 10.20.0.1",
];

const VLAN_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC mode.", mode: "user EXEC" },
  { command: "show vlan brief", description: "List VLANs and their ports.", mode: "privileged" },
  { command: "show interfaces trunk", description: "Inspect the trunk and its allowed VLANs.", mode: "privileged" },
  { command: "show running-config", description: "Read the live switch configuration.", mode: "privileged" },
  { command: "ping 10.20.0.1", description: "Test the path to the gateway.", mode: "privileged" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "interface g0/1", description: "Enter interface GigabitEthernet0/1.", mode: "config" },
  { command: "switchport trunk allowed vlan add 20", description: "Add VLAN 20 to the trunk.", mode: "interface" },
];

function statusLabel(status: MissionStatus) {
  return status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Ready";
}

function MissionWorkspace({
  mission,
  onChange,
  onReset,
  onExit,
  next,
}: {
  mission: MissionState;
  onChange: (next: MissionState) => void;
  onReset: () => void;
  onExit: () => void;
  next?: NextMission | null;
}) {
  const [command, setCommand] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectiveState = [
    mission.inspectedVlans,
    mission.inspectedTrunk,
    mission.identifiedBlock,
    mission.trunkAllowedVlans.includes(20),
    mission.lastPingResult === "success",
  ];

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!command.trim()) return;
    onChange(runCommand(mission, command));
    setCommand("");
    inputRef.current?.focus();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Wordmark onHome={onExit} />
            <span className="hidden h-5 w-px bg-slate-700 sm:block" />
            <div>
              <p className="text-sm font-bold">The VLAN That Vanished</p>
              <p className="text-xs text-slate-500">Troubleshooting mission · 150 XP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${mission.status === "complete" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
              {statusLabel(mission.status)}
            </span>
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">
              Back to dashboard
            </button>
            {confirmReset ? (
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold text-rose-300">Reset progress?</span>
                <button className="rounded-lg bg-rose-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-rose-200" onClick={() => { setConfirmReset(false); onReset(); }} type="button">
                  Yes, reset
                </button>
                <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={() => setConfirmReset(false)} type="button">
                  Cancel
                </button>
              </span>
            ) : (
              <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={() => setConfirmReset(true)} type="button">
                Reset mission
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)_390px] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h1 className="mt-3 text-xl font-bold tracking-tight">Sales is offline.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              <GlossaryText text="After a switch upgrade, Sales users on VLAN 20 cannot reach their gateway. The access port and gateway are configured, but traffic crossing the inter-switch trunk is failing." />
            </p>
          </section>
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Objectives</p>
              <span className="text-xs text-slate-500">{objectiveState.filter(Boolean).length}/5</span>
            </div>
            <div className="mt-4 space-y-3">
              {OBJECTIVES.map((objective, index) => (
                <div className="flex items-start gap-3 text-sm" key={objective}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${objectiveState[index] ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-slate-600 text-transparent"}`}>✓</span>
                  <span className={objectiveState[index] ? "text-slate-200" : "text-slate-500"}>{objective}</span>
                </div>
              ))}
            </div>
          </section>
          <HintLadder
            hints={[
              "Traffic fails because it cannot cross between the two switches.",
              "Look at the inter-switch link: which VLANs is it allowed to carry?",
              "The trunk between SW1 and SW2 only permits VLAN 10 — VLAN 20 is missing.",
              "On interface Gi0/1 in config mode, type: switchport trunk allowed vlan add 20",
              "Back in privileged mode, prove it: type ping 10.20.0.1 — 5/5 replies is the proof.",
            ]}
          />
        </aside>

        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Network map</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Find the broken path</h2>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">Packet state</p>
              <p className={`mt-1 text-sm font-bold ${mission.packetStatus === "success" ? "text-emerald-300" : mission.packetStatus === "blocked" ? "text-rose-300" : "text-slate-400"}`}>
                {mission.packetStatus === "success" ? "Delivered" : mission.packetStatus === "blocked" ? "Stopped at trunk" : "Awaiting ping"}
              </p>
            </div>
          </div>
          <Topology packetStatus={mission.packetStatus} />
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400">
            <span className="font-semibold text-slate-200">Lab note:</span> <GlossaryText text="VLAN 20 exists on both switches. The inter-switch trunk currently permits only VLAN 10." />
          </div>
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
              <span className="text-xs text-slate-600">deterministic simulation</span>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto p-4" aria-live="polite">
              {mission.eventLog.length === 0 ? <p className="text-sm text-slate-600">Mission events will appear here.</p> : mission.eventLog.map((entry, index) => (
                <div className="flex gap-3 text-xs" key={`${entry.message}-${index}`}>
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} />
                  <span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#030914] shadow-2xl shadow-cyan-950/10">
          <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs font-bold text-slate-200">SW1 · console</p>
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> connected</span>
            </div>
            <p className="mt-2 font-mono text-xs text-slate-500">Type <span className="text-cyan-300">help</span> for available commands.</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 font-mono text-xs leading-5" aria-live="polite">
            {mission.cliHistory.length === 0 && <p className="text-slate-600">Welcome to SW1. Start with <span className="text-slate-400">enable</span>, inspect with <span className="text-slate-400">show vlan brief</span> and <span className="text-slate-400">show interfaces trunk</span>, fix the trunk, then prove it with <span className="text-slate-400">ping 10.20.0.1</span>.</p>}
            {mission.cliHistory.map((entry, index) => (
              <div key={`${entry.input}-${index}`}>
                <p><span className="text-cyan-300">{entry.prompt}</span> <span className="text-slate-200">{entry.input}</span></p>
                {entry.output && <pre className="mt-1 whitespace-pre-wrap text-slate-400">{entry.output}</pre>}
              </div>
            ))}
          </div>
          <form className="border-t border-slate-800 p-3" onSubmit={submitCommand}>
            <label className="sr-only" htmlFor="cli-command">Enter a CLI command</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-cyan-300/70">
              <span className="font-mono text-xs text-cyan-300">{promptFor(mission.cliMode)}</span>
              <input ref={inputRef} autoComplete="off" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-700" id="cli-command" onChange={(event) => setCommand(event.target.value)} placeholder="enter command" value={command} />
              <button className="text-xs font-bold text-cyan-300 hover:text-cyan-100" type="submit">Run</button>
            </div>
          </form>
        </section>
        <CommandReference commands={VLAN_COMMANDS} />
      </div>

      {mission.status === "complete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-emerald-300/30 bg-slate-900 p-8 text-center shadow-2xl shadow-emerald-950/40">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300 text-3xl text-slate-950">✓</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Mission complete</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">The path is restored.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="You found the missing allowed VLAN, repaired the trunk, and verified the gateway path." /></p>
            <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/5 py-4 text-xl font-black text-emerald-200">+150 XP</div>
            <button className="mt-6 w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-200" onClick={onReset} type="button">Run it again</button>
            <NextMissionButton next={next} />
            <button className="mt-3 w-full rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  const { xp, streak, weakTopics, completedMissions, completeReview, awardMission, mastery, recordMissionResult, cardReviews, recordQuizResult, reviewFlashcard, quizResults, syncBadges, skills, examResults, examSeen, reviewSchedule, reviewSeen, labResults, recordExamResult, recordExamSeen, recordReviewQuestion, recordLabResult } = useProgressStore();
  const [mission, setMission] = useState<MissionState>(resetMission);
  const [stpMission, setStpMission] = useState<StpMissionState>(resetStpMission);
  const [ecMission, setEcMission] = useState<EcMissionState>(resetEcMission);
  const [ospfMission, setOspfMission] = useState<OspfMissionState>(resetOspfMission);
  const [edgeMission, setEdgeMission] = useState<EdgeMissionState>(resetEdgeMission);
  const [gatewayMission, setGatewayMission] = useState<GatewayMissionState>(resetGatewayMission);
  const [edgeServicesMission, setEdgeServicesMission] = useState<EdgeServicesMissionState>(resetEdgeServicesMission);
  const [tunnelVisionMission, setTunnelVisionMission] = useState<TunnelVisionMissionState>(resetTunnelVisionMission);
  const [fabricExpressMission, setFabricExpressMission] = useState<FabricExpressMissionState>(resetFabricExpressMission);
  const [sdwanMission, setSdwanMission] = useState<SdwanMissionState>(resetSdwanMission);
  const [signalDetectiveMission, setSignalDetectiveMission] = useState<SignalDetectiveMissionState>(resetSignalDetectiveMission);
  const [campusFabricMission, setCampusFabricMission] = useState<CampusFabricMissionState>(resetCampusFabricMission);
  const [lockControlPlaneMission, setLockControlPlaneMission] = useState<LockControlPlaneMissionState>(resetLockControlPlaneMission);
  const [automatorPrimeMission, setAutomatorPrimeMission] = useState<AutomatorPrimeMissionState>(resetAutomatorPrimeMission);
  const [quizArc, setQuizArc] = useState<string | null>(null);
  const [quizSession, setQuizSession] = useState<QuizSessionState | null>(null);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [examHallOpen, setExamHallOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [labsPreselect, setLabsPreselect] = useState<{ labId: string; variantId: string } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [cliBasics, setCliBasics] = useState<CliBasicsMissionState>(resetCliBasicsMission);
  const [showAndPing, setShowAndPing] = useState<ShowAndPingMissionState>(resetShowAndPingMission);
  const [packetTrail, setPacketTrail] = useState<PacketTrailMissionState>(resetPacketTrailMission);
  const missionCompleted = completedMissions.includes("vlan-that-vanished");
  const stpCompleted = completedMissions.includes("stp-storm");
  const ecCompleted = completedMissions.includes("bundled-bottleneck");
  const ospfCompleted = completedMissions.includes("area-zero-hero");
  const edgeCompleted = completedMissions.includes("edge-has-opinions");
  const gatewayCompleted = completedMissions.includes("gateway-at-dawn");
  const edgeServicesCompleted = completedMissions.includes("edge-services");
  const tunnelVisionCompleted = completedMissions.includes("tunnel-vision");
  const fabricExpressCompleted = completedMissions.includes("fabric-express");
  const sdwanCompleted = completedMissions.includes("sdwan-overlay");
  const signalDetectiveCompleted = completedMissions.includes("signal-detective");
  const campusFabricCompleted = completedMissions.includes("campus-fabric");
  const lockControlPlaneCompleted = completedMissions.includes("lock-the-control-plane");
  const automatorPrimeCompleted = completedMissions.includes("automator-prime");
  const cliBasicsCompleted = completedMissions.includes("console-basics");
  const showAndPingCompleted = completedMissions.includes("show-and-ping");
  const packetTrailCompleted = completedMissions.includes("packet-trail");

  // Map every mission id to its launcher so the "Up next" guidance can dispatch.
  const OPENERS: Record<string, () => void> = {
    "console-basics": openCliBasicsMission,
    "show-and-ping": openShowAndPingMission,
    "packet-trail": openPacketTrailMission,
    "vlan-that-vanished": openMission,
    "stp-storm": openStpMission,
    "bundled-bottleneck": openEcMission,
    "area-zero-hero": openOspfMission,
    "edge-has-opinions": openEdgeMission,
    "gateway-at-dawn": openGatewayMission,
    "edge-services": openEdgeServicesMission,
    "tunnel-vision": openTunnelVisionMission,
    "fabric-express": openFabricExpressMission,
    "sdwan-overlay": openSdwanMission,
    "signal-detective": openSignalDetectiveMission,
    "campus-fabric": openCampusFabricMission,
    "lock-the-control-plane": openLockControlPlaneMission,
    "automator-prime": openAutomatorPrimeMission,
  };

  // The single next mission to play: the first one in play order the player hasn't finished.
  const nextMission = MISSION_CATALOG.find((m) => !completedMissions.includes(m.id)) ?? null;
  const nextMissionIndex = nextMission ? MISSION_CATALOG.indexOf(nextMission) + 1 : null;

  // Map every mission id to its exit (reset-to-not_started) so the "Next
  // mission" button can unblock the render guard before opening a target.
  const EXITS: Record<string, (() => void) | undefined> = {
    "console-basics": exitCliBasicsMission,
    "show-and-ping": exitShowAndPingMission,
    "packet-trail": exitPacketTrailMission,
    "vlan-that-vanished": exitVlanMission,
    "stp-storm": exitStpMission,
    "bundled-bottleneck": exitEcMission,
    "area-zero-hero": exitOspfMission,
    "edge-has-opinions": exitEdgeMission,
    "gateway-at-dawn": exitGatewayMission,
    "edge-services": exitEdgeServicesMission,
    "tunnel-vision": exitTunnelVisionMission,
    "fabric-express": exitFabricExpressMission,
    "sdwan-overlay": exitSdwanMission,
    "signal-detective": exitSignalDetectiveMission,
    "campus-fabric": exitCampusFabricMission,
    "lock-the-control-plane": exitLockControlPlaneMission,
    "automator-prime": exitAutomatorPrimeMission,
  };

  // The mission after a given one in play order that is still unplayed — the
  // target for a completion banner's "Next mission" button. Searching forward
  // from the current mission keeps the target stable even before the
  // completion award lands in `completedMissions`.
  function nextAfter(id: string): NextMission | null {
    const index = MISSION_CATALOG.findIndex((m) => m.id === id);
    const exitCurrent = EXITS[id];
    for (let i = index + 1; i < MISSION_CATALOG.length; i++) {
      const candidate = MISSION_CATALOG[i];
      if (!completedMissions.includes(candidate.id)) {
        return {
          title: candidate.title,
          onOpen: () => {
            // The view guard renders the first mission whose status is not
            // "not_started" (catalog order), so the completed mission we're
            // standing on would keep blocking the target from mounting.
            // Reset it first, then open the next mission.
            exitCurrent?.();
            OPENERS[candidate.id]();
          },
        };
      }
    }
    return null;
  }

  useEffect(() => {
    void useProgressStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (mission.status === "complete") {
      if (!missionCompleted) awardMission("vlan-that-vanished");
      recordMissionResult("vlan-that-vanished", 0);
    }
    if (stpMission.status === "complete") {
      if (!stpCompleted) awardMission("stp-storm", 100);
      recordMissionResult("stp-storm", stpMission.attempts);
    }
    if (ecMission.status === "complete") {
      if (!ecCompleted) awardMission("bundled-bottleneck", 100);
      recordMissionResult("bundled-bottleneck", ecMission.attempts);
    }
    if (ospfMission.status === "complete") {
      if (!ospfCompleted) awardMission("area-zero-hero", 100);
      recordMissionResult("area-zero-hero", ospfMission.attempts);
    }
    if (edgeMission.status === "complete") {
      if (!edgeCompleted) awardMission("edge-has-opinions", 150);
      recordMissionResult("edge-has-opinions", edgeMission.attempts);
    }
    if (gatewayMission.status === "complete") {
      if (!gatewayCompleted) awardMission("gateway-at-dawn", 150);
      recordMissionResult("gateway-at-dawn", gatewayMission.attempts);
    }
    if (edgeServicesMission.status === "complete") {
      if (!edgeServicesCompleted) awardMission("edge-services", 150);
      recordMissionResult("edge-services", edgeServicesMission.attempts);
    }
    if (tunnelVisionMission.status === "complete") {
      if (!tunnelVisionCompleted) awardMission("tunnel-vision", 150);
      recordMissionResult("tunnel-vision", tunnelVisionMission.attempts);
    }
    if (fabricExpressMission.status === "complete") {
      if (!fabricExpressCompleted) awardMission("fabric-express", 100);
      recordMissionResult("fabric-express", fabricExpressMission.attempts);
    }
    if (sdwanMission.status === "complete") {
      if (!sdwanCompleted) awardMission("sdwan-overlay", 100);
      recordMissionResult("sdwan-overlay", sdwanMission.attempts);
    }
    if (signalDetectiveMission.status === "complete") {
      if (!signalDetectiveCompleted) awardMission("signal-detective", 150);
      recordMissionResult("signal-detective", signalDetectiveMission.attempts);
    }
    if (campusFabricMission.status === "complete") {
      if (!campusFabricCompleted) awardMission("campus-fabric", 100);
      recordMissionResult("campus-fabric", campusFabricMission.attempts);
    }
    if (lockControlPlaneMission.status === "complete") {
      if (!lockControlPlaneCompleted) awardMission("lock-the-control-plane", 200);
      recordMissionResult("lock-the-control-plane", lockControlPlaneMission.attempts);
    }
    if (automatorPrimeMission.status === "complete") {
      if (!automatorPrimeCompleted) awardMission("automator-prime", 200);
      recordMissionResult("automator-prime", automatorPrimeMission.attempts);
    }
    if (cliBasics.status === "complete" && !cliBasicsCompleted) {
      awardMission("console-basics", 50);
    }
    if (showAndPing.status === "complete" && !showAndPingCompleted) {
      awardMission("show-and-ping", 50);
    }
    if (packetTrail.status === "complete" && !packetTrailCompleted) {
      awardMission("packet-trail", 50);
    }
  }, [awardMission, recordMissionResult, mission.status, missionCompleted, stpMission.status, stpCompleted, ecMission.status, ecCompleted, ospfMission.status, ospfCompleted, edgeMission.status, edgeCompleted, gatewayMission.status, gatewayCompleted, edgeServicesMission.status, edgeServicesCompleted, tunnelVisionMission.status, tunnelVisionCompleted, fabricExpressMission.status, fabricExpressCompleted, sdwanMission.status, sdwanCompleted, signalDetectiveMission.status, signalDetectiveCompleted, campusFabricMission.status, campusFabricCompleted, lockControlPlaneMission.status, lockControlPlaneCompleted, automatorPrimeMission.status, automatorPrimeCompleted, cliBasics.status, cliBasicsCompleted,      showAndPing.status, showAndPingCompleted, packetTrail.status, packetTrailCompleted]);

  // Award badges (+BADGE_XP) the moment their milestones are reached. Declared
  // after the award effect so badge XP lands in the same commit as the milestone.
  useEffect(() => {
    syncBadges();
  }, [syncBadges, xp, streak, completedMissions, mastery, quizResults, cardReviews]);

  function updateMission(next: MissionState) {
    setMission(next);
    localStorage.setItem("netquest-vlan-mission", JSON.stringify(next));
  }

  function openMission() {
    try {
      const saved = localStorage.getItem("netquest-vlan-mission");
      if (saved) {
        setMission(JSON.parse(saved) as MissionState);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-vlan-mission");
    }
    updateMission(startMission());
  }

  function resetCurrentMission() {
    // startMission() restarts the mission in place (status "in_progress"), so
    // the console stays mounted — resetMission() would flip status back to
    // "not_started" and kick the player to the dashboard.
    setMission(startMission());
    localStorage.removeItem("netquest-vlan-mission");
  }

  // Leave the VLAN mission without wiping saved progress (matches the other
  // missions: the snapshot stays in localStorage so Play / resume continues it).
  function exitVlanMission() {
    setMission(resetMission());
  }

  function updateStpMission(next: StpMissionState) {
    setStpMission(next);
    localStorage.setItem("netquest-stp-mission", JSON.stringify(next));
  }

  function isStpSnapshot(value: unknown): value is StpMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<StpMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["root_election", "bpdu_guard", "root_guard", "mst_concept", "complete"];
    const cliModes = ["user", "privileged", "config", "config-if"];
    const protocols = [null, "rstp", "pvst", "mst"];
    // The guard phases are now typed CLI drills; pre-CLI clicker snapshots fail
    // the cliMode/cliHistory checks and are intentionally reset so the player
    // redoes the typed fix.
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.bpduGuardSet === "boolean"
      && typeof snapshot.bpduGuardVerified === "boolean"
      && typeof snapshot.rootGuardSet === "boolean"
      && typeof snapshot.rootGuardVerified === "boolean"
      && (snapshot.selectedRoot === null || snapshot.selectedRoot === "SW1" || snapshot.selectedRoot === "SW2")
      && (snapshot.expectedRoot === "SW1" || snapshot.expectedRoot === "SW2")
      && typeof snapshot.blockedPort === "string"
      && protocols.includes(snapshot.selectedProtocol ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openStpMission() {
    try {
      const saved = localStorage.getItem("netquest-stp-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      // Snapshots from before the multi-phase format (or any invalid shape) are
      // intentionally discarded: the mission is short enough to restart cleanly.
      if (isStpSnapshot(snapshot) && snapshot.status !== "not_started") {
        setStpMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-stp-mission");
    }
    updateStpMission(startStpMission());
  }

  function exitStpMission() {
    setStpMission(resetStpMission());
  }

  function updateEcMission(next: EcMissionState) {
    setEcMission(next);
    localStorage.setItem("netquest-etherchannel-mission", JSON.stringify(next));
  }

  function isEcSnapshot(value: unknown): value is EcMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<EcMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["evidence", "cause", "config", "verify", "complete"];
    const cliModes = ["user", "privileged", "config", "config-if"];
    const options = [null, "missing-link", "healthy-bundle", "no-lacp", "passive-passive", "group-mismatch", "access-mode"];
    // The config/verify phases are now typed CLI drills; pre-CLI clicker snapshots
    // fail the cliMode/cliHistory checks and are intentionally reset.
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.ecConfigured === "boolean"
      && typeof snapshot.ecVerified === "boolean"
      && options.includes(snapshot.selectedEvidence ?? null)
      && options.includes(snapshot.selectedCause ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openEcMission() {
    try {
      const saved = localStorage.getItem("netquest-etherchannel-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isEcSnapshot(snapshot) && snapshot.status !== "not_started") {
        setEcMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-etherchannel-mission");
    }
    updateEcMission(startEcMission());
  }

  function exitEcMission() {
    setEcMission(resetEcMission());
  }

  function updateOspfMission(next: OspfMissionState) {
    setOspfMission(next);
    localStorage.setItem("netquest-ospf-mission", JSON.stringify(next));
  }

  function isOspfSnapshot(value: unknown): value is OspfMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<OspfMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["evidence", "cause", "config", "verify", "summarize", "filter", "complete"];
    const cliModes = ["user", "privileged", "config", "config-router"];
    const options = [null, "stuck-adjacency", "full-converged", "process-down", "area-mismatch", "router-id-conflict", "process-id-diff"];
    // The config/verify/summarize/filter phases are now typed CLI drills; pre-CLI
    // clicker snapshots fail the cliMode/cliHistory checks and are intentionally reset.
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.areaFixed === "boolean"
      && typeof snapshot.areaVerified === "boolean"
      && typeof snapshot.summarySet === "boolean"
      && typeof snapshot.filterSet === "boolean"
      && options.includes(snapshot.selectedEvidence ?? null)
      && options.includes(snapshot.selectedCause ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openOspfMission() {
    try {
      const saved = localStorage.getItem("netquest-ospf-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isOspfSnapshot(snapshot) && snapshot.status !== "not_started") {
        setOspfMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-ospf-mission");
    }
    updateOspfMission(startOspfMission());
  }

  function exitOspfMission() {
    setOspfMission(resetOspfMission());
  }

  function updateEdgeMission(next: EdgeMissionState) {
    setEdgeMission(next);
    localStorage.setItem("netquest-edge-mission", JSON.stringify(next));
  }

  function isEdgeSnapshot(value: unknown): value is EdgeMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<EdgeMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["igp", "convergence", "bgp-state", "bgp-fix", "pbr", "local", "complete"];
    const cliModes = ["user", "privileged", "config", "config-router"];
    const options = [null, "hybrid-vs-linkstate", "classes-reversed", "both-linkstate", "fs-vs-spf", "holddown", "lsa-flood", "not-established", "established", "low-localpref", "overrides-lookup", "changes-table", "local-only", "local-policy", "outbound-policy", "default-route"];
    // The bgp-fix phase is now a CLI console; pre-CLI clicker snapshots fail this
    // check and are intentionally reset so the player redoes the typed fix.
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.bgpConfigured === "boolean"
      && typeof snapshot.bgpVerified === "boolean"
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && options.includes(snapshot.selectedIgp ?? null)
      && options.includes(snapshot.selectedConvergence ?? null)
      && options.includes(snapshot.selectedBgpState ?? null)
      && options.includes(snapshot.selectedPbr ?? null)
      && options.includes(snapshot.selectedLocal ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openEdgeMission() {
    try {
      const saved = localStorage.getItem("netquest-edge-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isEdgeSnapshot(snapshot) && snapshot.status !== "not_started") {
        setEdgeMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-edge-mission");
    }
    updateEdgeMission(startEdgeMission());
  }

  function exitEdgeMission() {
    setEdgeMission(resetEdgeMission());
  }

  function updateGatewayMission(next: GatewayMissionState) {
    setGatewayMission(next);
    localStorage.setItem("netquest-gateway-mission", JSON.stringify(next));
  }

  function isGatewaySnapshot(value: unknown): value is GatewayMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<GatewayMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["design", "ha", "hsrp-config", "failover", "vrrp", "complete"];
    const devices = ["GW1", "GW2"];
    const cliModes = ["user", "privileged", "config", "config-if"];
    const designOptions = [null, "collapsed-core-pair", "three-tier-single", "flat-single"];
    const haOptions = [null, "fhrp", "stp", "ecmp"];
    const vrrpOptions = [null, "virtual-mac", "same-mac", "vrrp-no-preempt"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && devices.includes(snapshot.device ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.standbyIpSet === "boolean"
      && typeof snapshot.standbyPrioritySet === "boolean"
      && typeof snapshot.standbyPreemptSet === "boolean"
      && typeof snapshot.hsrpVerified === "boolean"
      && typeof snapshot.gw1ShutDown === "boolean"
      && typeof snapshot.gw2Active === "boolean"
      && designOptions.includes(snapshot.selectedDesign ?? null)
      && haOptions.includes(snapshot.selectedHa ?? null)
      && vrrpOptions.includes(snapshot.selectedVrrp ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openGatewayMission() {
    try {
      const saved = localStorage.getItem("netquest-gateway-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isGatewaySnapshot(snapshot) && snapshot.status !== "not_started") {
        setGatewayMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-gateway-mission");
    }
    updateGatewayMission(startGatewayMission());
  }

  function exitGatewayMission() {
    setGatewayMission(resetGatewayMission());
  }

  function updateEdgeServicesMission(next: EdgeServicesMissionState) {
    setEdgeServicesMission(next);
    localStorage.setItem("netquest-edge-services-mission", JSON.stringify(next));
  }

  function isEdgeServicesSnapshot(value: unknown): value is EdgeServicesMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<EdgeServicesMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["qos", "ntp", "nat-config", "nat-drill", "multicast", "complete"];
    const cliModes = ["user", "privileged", "config", "config-if"];
    const qosOptions = [null, "voice-ef", "policy-marks", "policy-shapes"];
    const ntpOptions = [null, "source-lo", "steps-clock", "ptp-config"];
    const multicastOptions = [null, "rpf-check", "spm-flood", "igmpv3-any"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.natInsideSet === "boolean"
      && typeof snapshot.natOutsideSet === "boolean"
      && typeof snapshot.natAclSet === "boolean"
      && typeof snapshot.natOverloadSet === "boolean"
      && typeof snapshot.natVerified === "boolean"
      && typeof snapshot.natDrillVerified === "boolean"
      && qosOptions.includes(snapshot.selectedQos ?? null)
      && ntpOptions.includes(snapshot.selectedNtp ?? null)
      && multicastOptions.includes(snapshot.selectedMulticast ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openEdgeServicesMission() {
    try {
      const saved = localStorage.getItem("netquest-edge-services-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isEdgeServicesSnapshot(snapshot) && snapshot.status !== "not_started") {
        setEdgeServicesMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-edge-services-mission");
    }
    updateEdgeServicesMission(startEdgeServicesMission());
  }

  function exitEdgeServicesMission() {
    setEdgeServicesMission(resetEdgeServicesMission());
  }

  function updateTunnelVisionMission(next: TunnelVisionMissionState) {
    setTunnelVisionMission(next);
    localStorage.setItem("netquest-tunnel-vision-mission", JSON.stringify(next));
  }

  function isTunnelVisionSnapshot(value: unknown): value is TunnelVisionMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<TunnelVisionMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["vrf", "gre", "ipsec", "cryptomap", "checkpoint", "complete"];
    const cliModes = ["user", "privileged", "config", "config-if", "config-vrf", "config-isakmp", "config-crypto-map"];
    const checkpointOptions = [null, "outer-gre", "inner-ip", "auto-all"];
    const booleans = [
      "vrfDefined", "vrfForwarded", "ipReadded", "vrfVerified",
      "tunnelIpSet", "tunnelSourceSet", "tunnelDestSet", "tunnelModeSet", "tunnelVerified",
      "encSet", "authSet", "hashSet", "groupSet", "keySet", "transformSet",
      "aclSet", "peerSet", "tsSet", "matchSet", "mapAppliedSet", "ipsecVerified",
    ];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && booleans.every((field) => typeof snapshot[field as keyof TunnelVisionMissionState] === "boolean")
      && checkpointOptions.includes(snapshot.selectedCheckpoint ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openTunnelVisionMission() {
    try {
      const saved = localStorage.getItem("netquest-tunnel-vision-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isTunnelVisionSnapshot(snapshot) && snapshot.status !== "not_started") {
        setTunnelVisionMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-tunnel-vision-mission");
    }
    updateTunnelVisionMission(startTunnelVisionMission());
  }

  function exitTunnelVisionMission() {
    setTunnelVisionMission(resetTunnelVisionMission());
  }

  function updateFabricExpressMission(next: FabricExpressMissionState) {
    setFabricExpressMission(next);
    localStorage.setItem("netquest-fabric-express-mission", JSON.stringify(next));
  }

  function isFabricExpressSnapshot(value: unknown): value is FabricExpressMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<FabricExpressMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["hypervisor", "vm", "vswitch", "vswitch-check", "vxlan", "vxlan-check", "complete"];
    const cliModes = ["user", "privileged"];
    const hypervisorOptions = [null, "type1", "type2", "hosted"];
    const vmOptions = [null, "virtual-hardware", "physical-risc", "vmdk-physical"];
    const vswitchOptions = [null, "uplink-needed", "no-uplink", "uplink-unused"];
    const vxlanOptions = [null, "l2-segment", "vlan-number", "vrf-name"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.vsListed === "boolean"
      && typeof snapshot.uplinkListed === "boolean"
      && typeof snapshot.nveInspected === "boolean"
      && typeof snapshot.vniListed === "boolean"
      && typeof snapshot.nvePeersSeen === "boolean"
      && hypervisorOptions.includes(snapshot.selectedHypervisor ?? null)
      && vmOptions.includes(snapshot.selectedVm ?? null)
      && vswitchOptions.includes(snapshot.selectedVswitch ?? null)
      && vxlanOptions.includes(snapshot.selectedVxlan ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openFabricExpressMission() {
    try {
      const saved = localStorage.getItem("netquest-fabric-express-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isFabricExpressSnapshot(snapshot) && snapshot.status !== "not_started") {
        setFabricExpressMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-fabric-express-mission");
    }
    updateFabricExpressMission(startFabricExpressMission());
  }

  function exitFabricExpressMission() {
    setFabricExpressMission(resetFabricExpressMission());
  }

  function updateSdwanMission(next: SdwanMissionState) {
    setSdwanMission(next);
    localStorage.setItem("netquest-sdwan-mission", JSON.stringify(next));
  }

  function isSdwanSnapshot(value: unknown): value is SdwanMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<SdwanMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["planes", "omp", "tlocs", "tlocs-check", "benefit", "complete"];
    const cliModes = ["user", "privileged"];
    const planesOptions = [null, "control-omp", "data-vsmart", "mgmt-vbond"];
    const ompOptions = [null, "omp-tloc-attr", "full-table", "transit-traffic"];
    const tlocsOptions = [null, "tlocs-forward", "tlocs-routes", "bfd-replaces-omp"];
    const benefitOptions = [null, "benefit-transport", "limit-complexity", "limit-no-overlay"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.ompTlocsSeen === "boolean"
      && typeof snapshot.bfdSeen === "boolean"
      && typeof snapshot.controlSeen === "boolean"
      && planesOptions.includes(snapshot.selectedPlanes ?? null)
      && ompOptions.includes(snapshot.selectedOmp ?? null)
      && tlocsOptions.includes(snapshot.selectedTlocs ?? null)
      && benefitOptions.includes(snapshot.selectedBenefit ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openSdwanMission() {
    try {
      const saved = localStorage.getItem("netquest-sdwan-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isSdwanSnapshot(snapshot) && snapshot.status !== "not_started") {
        setSdwanMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-sdwan-mission");
    }
    updateSdwanMission(startSdwanMission());
  }

  function exitSdwanMission() {
    setSdwanMission(resetSdwanMission());
  }

  function updateSignalDetectiveMission(next: SignalDetectiveMissionState) {
    setSignalDetectiveMission(next);
    localStorage.setItem("netquest-signal-detective-mission", JSON.stringify(next));
  }

  function isSignalDetectiveSnapshot(value: unknown): value is SignalDetectiveMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<SignalDetectiveMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["diagnose", "flow", "span", "sla", "controller", "netconf", "final-check", "complete"];
    const cliModes = ["user", "privileged", "config"];
    const flowOptions = [null, "fnf-export", "packet-capture", "snmp-polling"];
    const controllerOptions = [null, "design-comply", "assurance", "ipsla-ctrl"];
    const netconfOptions = [null, "restconf-yang", "netconf-ssh-only", "cli-only"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.pinged === "boolean"
      && typeof snapshot.traced === "boolean"
      && typeof snapshot.ifChecked === "boolean"
      && typeof snapshot.debugSeen === "boolean"
      && typeof snapshot.aclSeen === "boolean"
      && typeof snapshot.spanConfigured === "boolean"
      && typeof snapshot.spanVerified === "boolean"
      && typeof snapshot.slaConfigured === "boolean"
      && typeof snapshot.slaVerified === "boolean"
      && typeof snapshot.netconfRead === "boolean"
      && flowOptions.includes(snapshot.selectedFlow ?? null)
      && controllerOptions.includes(snapshot.selectedController ?? null)
      && netconfOptions.includes(snapshot.selectedNetconf ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openSignalDetectiveMission() {
    try {
      const saved = localStorage.getItem("netquest-signal-detective-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isSignalDetectiveSnapshot(snapshot) && snapshot.status !== "not_started") {
        setSignalDetectiveMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-signal-detective-mission");
    }
    updateSignalDetectiveMission(startSignalDetectiveMission());
  }

  function exitSignalDetectiveMission() {
    setSignalDetectiveMission(resetSignalDetectiveMission());
  }

  function updateCampusFabricMission(next: CampusFabricMissionState) {
    setCampusFabricMission(next);
    localStorage.setItem("netquest-campus-fabric-mission", JSON.stringify(next));
  }

  function isCampusFabricSnapshot(value: unknown): value is CampusFabricMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<CampusFabricMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["roles", "lisp", "lisp-check", "interop", "complete"];
    const cliModes = ["user", "privileged"];
    const rolesOptions = [null, "cp-lisp", "edge-hosts", "edge-border"];
    const lispOptions = [null, "eid-rloc", "rloc-route", "lisp-bgp"];
    const interopOptions = [null, "border-fusion", "vxlan-only", "no-access"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.sessionSeen === "boolean"
      && typeof snapshot.mapCacheSeen === "boolean"
      && typeof snapshot.siteSeen === "boolean"
      && rolesOptions.includes(snapshot.selectedRoles ?? null)
      && lispOptions.includes(snapshot.selectedLisp ?? null)
      && interopOptions.includes(snapshot.selectedInterop ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openCampusFabricMission() {
    try {
      const saved = localStorage.getItem("netquest-campus-fabric-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isCampusFabricSnapshot(snapshot) && snapshot.status !== "not_started") {
        setCampusFabricMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-campus-fabric-mission");
    }
    updateCampusFabricMission(startCampusFabricMission());
  }

  function exitCampusFabricMission() {
    setCampusFabricMission(resetCampusFabricMission());
  }

  function updateLockControlPlaneMission(next: LockControlPlaneMissionState) {
    setLockControlPlaneMission(next);
    localStorage.setItem("netquest-lock-control-plane-mission", JSON.stringify(next));
  }

  function isLockControlPlaneSnapshot(value: unknown): value is LockControlPlaneMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<LockControlPlaneMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["local", "aaa", "iacl", "copp", "rest", "design", "complete"];
    const cliModes = ["user", "privileged", "config"];
    const iaclOptions = [null, "permit-mgmt-deny", "permit-all", "only-bgp"];
    const coppOptions = [null, "copp-protects", "copp-blocks-https", "copp-replaces-acl"];
    const restOptions = [null, "api-key-https", "api-plaintext", "api-open"];
    const designOptions = [null, "layered-defense", "macsec-l3", "trustsec-8021x"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.userCreated === "boolean"
      && typeof snapshot.vtyLocal === "boolean"
      && typeof snapshot.vtySsh === "boolean"
      && typeof snapshot.localVerified === "boolean"
      && typeof snapshot.aaaNewModel === "boolean"
      && typeof snapshot.radiusServerDefined === "boolean"
      && typeof snapshot.radiusServerSet === "boolean"
      && typeof snapshot.radiusKeySet === "boolean"
      && typeof snapshot.aaaLoginSet === "boolean"
      && typeof snapshot.aaaVerified === "boolean"
      && iaclOptions.includes(snapshot.selectedIacl ?? null)
      && coppOptions.includes(snapshot.selectedCopp ?? null)
      && restOptions.includes(snapshot.selectedRest ?? null)
      && designOptions.includes(snapshot.selectedDesign ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openLockControlPlaneMission() {
    try {
      const saved = localStorage.getItem("netquest-lock-control-plane-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isLockControlPlaneSnapshot(snapshot) && snapshot.status !== "not_started") {
        setLockControlPlaneMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-lock-control-plane-mission");
    }
    updateLockControlPlaneMission(startLockControlPlaneMission());
  }

  function exitLockControlPlaneMission() {
    setLockControlPlaneMission(resetLockControlPlaneMission());
  }

  function updateAutomatorPrimeMission(next: AutomatorPrimeMissionState) {
    setAutomatorPrimeMission(next);
    localStorage.setItem("netquest-automator-prime-mission", JSON.stringify(next));
  }

  function isAutomatorPrimeSnapshot(value: unknown): value is AutomatorPrimeMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<AutomatorPrimeMissionState>;
    const attempts = snapshot.attempts;
    const phases = ["python", "json", "yang", "apis", "rest", "eem", "agent", "complete"];
    const cliModes = ["user", "privileged", "config", "repl"];
    const yangOptions = [null, "data-model-tree", "scripting-language", "yaml-cli"];
    const apisOptions = [null, "rest-xsrf", "soap-xml", "snmp-get"];
    const restOptions = [null, "created", "not-found", "server-error"];
    const agentOptions = [null, "agentless-ssh", "agentless-install", "agent-no-software"];
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && phases.includes(snapshot.phase ?? "")
      && cliModes.includes(snapshot.cliMode ?? "")
      && typeof snapshot.pyImport === "boolean"
      && typeof snapshot.pyGet === "boolean"
      && typeof snapshot.pyRead === "boolean"
      && typeof snapshot.jsonEnv === "boolean"
      && typeof snapshot.jsonDevice === "boolean"
      && typeof snapshot.eemApplet === "boolean"
      && typeof snapshot.eemEvent === "boolean"
      && typeof snapshot.eemAction1 === "boolean"
      && typeof snapshot.eemAction2 === "boolean"
      && typeof snapshot.eemVerified === "boolean"
      && yangOptions.includes(snapshot.selectedYang ?? null)
      && apisOptions.includes(snapshot.selectedApis ?? null)
      && restOptions.includes(snapshot.selectedRest ?? null)
      && agentOptions.includes(snapshot.selectedAgent ?? null)
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.phase === "complete" : snapshot.phase !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openAutomatorPrimeMission() {
    try {
      const saved = localStorage.getItem("netquest-automator-prime-mission");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      if (isAutomatorPrimeSnapshot(snapshot) && snapshot.status !== "not_started") {
        setAutomatorPrimeMission(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-automator-prime-mission");
    }
    updateAutomatorPrimeMission(startAutomatorPrimeMission());
  }

  function exitAutomatorPrimeMission() {
    setAutomatorPrimeMission(resetAutomatorPrimeMission());
  }

  const quizQuestions = quizArc ? getArcQuiz(quizArc) : [];
  const dueFlashcards = dueCards(FLASHCARD_DECK, cardReviews, Date.now());
  const badgeStatuses = getBadgeStatus({ xp, streak, completedMissions, mastery, quizResults, cardReviews });
  const quizFirstCompletion = quizArc ? !(quizResults[quizArc] ?? false) : false;
  const quizAwardedXp = quizFirstCompletion && quizSession ? (quizScore(quizSession, quizQuestions).perfect ? 25 : 10) : 0;

  function openQuiz(arcId: string) {
    setQuizArc(arcId);
    setQuizSession(startQuiz(arcId));
  }

  function exitQuiz() {
    setQuizArc(null);
    setQuizSession(null);
  }

  function finishQuiz() {
    if (!quizArc || !quizSession) return;
    const score = quizScore(quizSession, quizQuestions);
    recordQuizResult(quizArc, score.correct, score.total);
    exitQuiz();
  }

  function openFlashcards() {
    setFlashcardsOpen(true);
  }

  function exitFlashcards() {
    setFlashcardsOpen(false);
  }

  const dueReviews = dueReviewCount(skills, reviewSchedule);

  function openReview() {
    setReviewIndex(0);
    setReviewAnswers({});
    setReviewItems(
      buildReviewQueue({
        skills,
        schedules: reviewSchedule,
        reviewSeen,
        labResults,
        seed: `review:v${Math.floor(Math.random() * 1e6)}`,
      }).items,
    );
    setReviewOpen(true);
  }

  function exitReview() {
    setReviewOpen(false);
    setReviewItems([]);
    setReviewIndex(0);
    setReviewAnswers({});
  }

  function answerReviewQuestion(item: ReviewQuestionItem, value: string) {
    recordReviewQuestion(item.objectiveId, item.questionKind, value === item.correct, item.questionId);
    setReviewAnswers((map) => ({ ...map, [item.id]: value }));
  }

  function advanceReview() {
    setReviewIndex((index) => index + 1);
  }

  function launchReviewLab(item: ReviewLabItem) {
    setLabsPreselect({ labId: item.labId, variantId: item.variantId });
    setLabsOpen(true);
  }

  function openArc(arcId: string) {
    switch (arcId) {
      case "vlan-that-vanished":
        openMission();
        break;
      case "stp-storm":
        openStpMission();
        break;
      case "bundled-bottleneck":
        openEcMission();
        break;
      case "area-zero-hero":
        openOspfMission();
        break;
      case "edge-has-opinions":
        openEdgeMission();
        break;
      case "gateway-at-dawn":
        openGatewayMission();
        break;
      case "edge-services":
        openEdgeServicesMission();
        break;
      case "tunnel-vision":
        openTunnelVisionMission();
        break;
      case "fabric-express":
        openFabricExpressMission();
        break;
      case "sdwan-overlay":
        openSdwanMission();
        break;
      case "signal-detective":
        openSignalDetectiveMission();
        break;
      case "campus-fabric":
        openCampusFabricMission();
        break;
      case "lock-the-control-plane":
        openLockControlPlaneMission();
        break;
      case "automator-prime":
        openAutomatorPrimeMission();
        break;
    }
  }

  function updateCliBasics(next: CliBasicsMissionState) {
    setCliBasics(next);
    localStorage.setItem("netquest-cli-basics", JSON.stringify(next));
  }

  function isCliBasicsSnapshot(value: unknown): value is CliBasicsMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<CliBasicsMissionState>;
    const attempts = snapshot.attempts;
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && CLI_BASICS_STEPS.includes(snapshot.step as (typeof CLI_BASICS_STEPS)[number])
      && (snapshot.cliMode === "exec" || snapshot.cliMode === "privileged" || snapshot.cliMode === "config")
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.step === "complete" : snapshot.step !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openCliBasicsMission() {
    try {
      const saved = localStorage.getItem("netquest-cli-basics");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      // Only resume an in-progress run — a completed mission starts fresh (Replay).
      if (isCliBasicsSnapshot(snapshot) && snapshot.status === "in_progress") {
        setCliBasics(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-cli-basics");
    }
    updateCliBasics(startCliBasicsMission());
  }

  function exitCliBasicsMission() {
    setCliBasics(resetCliBasicsMission());
  }

  function updateShowAndPing(next: ShowAndPingMissionState) {
    setShowAndPing(next);
    localStorage.setItem("netquest-show-and-ping", JSON.stringify(next));
  }

  function isShowAndPingSnapshot(value: unknown): value is ShowAndPingMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<ShowAndPingMissionState>;
    const attempts = snapshot.attempts;
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && SHOW_PING_STEPS.includes(snapshot.step as (typeof SHOW_PING_STEPS)[number])
      && (snapshot.cliMode === "exec" || snapshot.cliMode === "privileged" || snapshot.cliMode === "config")
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.step === "complete" : snapshot.step !== "complete")
      && Array.isArray(snapshot.cliHistory)
      && snapshot.cliHistory.every((entry) => entry && typeof entry.input === "string" && typeof entry.output === "string" && typeof entry.prompt === "string")
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openShowAndPingMission() {
    try {
      const saved = localStorage.getItem("netquest-show-and-ping");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      // Only resume an in-progress run — a completed mission starts fresh (Replay).
      if (isShowAndPingSnapshot(snapshot) && snapshot.status === "in_progress") {
        setShowAndPing(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-show-and-ping");
    }
    updateShowAndPing(startShowAndPingMission());
  }

  function exitShowAndPingMission() {
    setShowAndPing(resetShowAndPingMission());
  }

  function updatePacketTrail(next: PacketTrailMissionState) {
    setPacketTrail(next);
    localStorage.setItem("netquest-packet-trail", JSON.stringify(next));
  }

  function isPacketTrailSnapshot(value: unknown): value is PacketTrailMissionState {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<PacketTrailMissionState>;
    const attempts = snapshot.attempts;
    return (snapshot.status === "not_started" || snapshot.status === "in_progress" || snapshot.status === "complete")
      && typeof snapshot.stepIndex === "number"
      && Number.isInteger(snapshot.stepIndex)
      && snapshot.stepIndex >= 0
      && snapshot.stepIndex <= PACKET_TRAIL_STOPS
      && (snapshot.checkpointAnswer === null || snapshot.checkpointAnswer === "trunk-carries-many" || snapshot.checkpointAnswer === "trunk-one-vlan" || snapshot.checkpointAnswer === "access-between-switches")
      && typeof attempts === "number"
      && Number.isInteger(attempts)
      && attempts >= 0
      && (snapshot.status === "complete" ? snapshot.stepIndex === PACKET_TRAIL_STOPS : true)
      && Array.isArray(snapshot.eventLog)
      && snapshot.eventLog.every((entry) => entry && typeof entry.message === "string" && (entry.tone === "info" || entry.tone === "success" || entry.tone === "error"));
  }

  function openPacketTrailMission() {
    try {
      const saved = localStorage.getItem("netquest-packet-trail");
      const snapshot: unknown = saved ? JSON.parse(saved) : null;
      // Only resume an in-progress run — a completed tour starts fresh (Replay).
      if (isPacketTrailSnapshot(snapshot) && snapshot.status === "in_progress") {
        setPacketTrail(snapshot);
        return;
      }
    } catch {
      localStorage.removeItem("netquest-packet-trail");
    }
    updatePacketTrail(startPacketTrailMission());
  }

  function exitPacketTrailMission() {
    setPacketTrail(resetPacketTrailMission());
  }

  if (examHallOpen) {
    return (
      <ExamHall
        examResults={examResults}
        examSeen={examSeen}
        onRecordResult={recordExamResult}
        onRecordSeen={recordExamSeen}
        onOpenArc={openArc}
        onExit={() => setExamHallOpen(false)}
      />
    );
  }

  if (labsOpen) {
    return (
      <LabsPanel
        labResults={labResults}
        onRecordResult={recordLabResult}
        onExit={() => {
          setLabsOpen(false);
          setLabsPreselect(null);
        }}
        preselect={labsPreselect}
      />
    );
  }

  if (reviewOpen) {
    return (
      <AdaptiveReview
        items={reviewItems}
        index={reviewIndex}
        answers={reviewAnswers}
        onAnswer={answerReviewQuestion}
        onAdvance={advanceReview}
        onLaunchLab={launchReviewLab}
        onExit={exitReview}
        onFinish={exitReview}
      />
    );
  }

  if (quizArc && quizSession) {
    return (
      <ArcQuiz
        arcId={quizArc}
        questions={quizQuestions}
        session={quizSession}
        onAnswer={(value) => setQuizSession((session) => (session ? answerQuizStep(session, value) : session))}
        onAdvance={() => setQuizSession((session) => (session ? advanceQuizStep(session, quizQuestions.length) : session))}
        onFinish={finishQuiz}
        onExit={exitQuiz}
        firstCompletion={quizFirstCompletion}
        xpAward={quizAwardedXp}
      />
    );
  }

  if (flashcardsOpen) {
    return <FlashcardReview cards={FLASHCARD_DECK} reviews={cardReviews} onReview={reviewFlashcard} onExit={exitFlashcards} />;
  }

  if (cliBasics.status !== "not_started") {
    return <CliBasicsMission mission={cliBasics} onChange={updateCliBasics} onExit={exitCliBasicsMission} next={nextAfter("console-basics")} />;
  }

  if (showAndPing.status !== "not_started") {
    return <ShowAndPingMission mission={showAndPing} onChange={updateShowAndPing} onExit={exitShowAndPingMission} next={nextAfter("show-and-ping")} />;
  }

  if (packetTrail.status !== "not_started") {
    return <PacketTrailMission mission={packetTrail} onChange={updatePacketTrail} onExit={exitPacketTrailMission} next={nextAfter("packet-trail")} />;
  }

  if (stpMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={stpMission.status === "complete" ? null : rescueFor("stp", stpMission.phase)}>
        <StpMission mission={stpMission} onChange={updateStpMission} onExit={exitStpMission} next={nextAfter("stp-storm")} />
      </RescueLauncher>
    );
  }

  if (ecMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={ecMission.status === "complete" ? null : rescueFor("ec", ecMission.phase)}>
        <EtherchannelMission mission={ecMission} onChange={updateEcMission} onExit={exitEcMission} next={nextAfter("bundled-bottleneck")} />
      </RescueLauncher>
    );
  }

  if (ospfMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={ospfMission.status === "complete" ? null : rescueFor("ospf", ospfMission.phase)}>
        <OspfMission mission={ospfMission} onChange={updateOspfMission} onExit={exitOspfMission} next={nextAfter("area-zero-hero")} />
      </RescueLauncher>
    );
  }

  if (edgeMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={edgeMission.status === "complete" ? null : rescueFor("edge", edgeMission.phase)}>
        <EdgeMission mission={edgeMission} onChange={updateEdgeMission} onExit={exitEdgeMission} next={nextAfter("edge-has-opinions")} />
      </RescueLauncher>
    );
  }

  if (gatewayMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={gatewayMission.status === "complete" ? null : rescueFor("gateway", gatewayMission.phase)}>
        <GatewayMission mission={gatewayMission} onChange={updateGatewayMission} onExit={exitGatewayMission} next={nextAfter("gateway-at-dawn")} />
      </RescueLauncher>
    );
  }

  if (edgeServicesMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={edgeServicesMission.status === "complete" ? null : rescueFor("edge-services", edgeServicesMission.phase)}>
        <EdgeServicesMission mission={edgeServicesMission} onChange={updateEdgeServicesMission} onExit={exitEdgeServicesMission} next={nextAfter("edge-services")} />
      </RescueLauncher>
    );
  }

  if (tunnelVisionMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={tunnelVisionMission.status === "complete" ? null : rescueFor("tunnel-vision", tunnelVisionMission.phase)}>
        <TunnelVisionMission mission={tunnelVisionMission} onChange={updateTunnelVisionMission} onExit={exitTunnelVisionMission} next={nextAfter("tunnel-vision")} />
      </RescueLauncher>
    );
  }

  if (fabricExpressMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={fabricExpressMission.status === "complete" ? null : rescueFor("fabric-express", fabricExpressMission.phase)}>
        <FabricExpressMission mission={fabricExpressMission} onChange={updateFabricExpressMission} onExit={exitFabricExpressMission} next={nextAfter("fabric-express")} />
      </RescueLauncher>
    );
  }

  if (sdwanMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={sdwanMission.status === "complete" ? null : rescueFor("sdwan", sdwanMission.phase)}>
        <SdwanMission mission={sdwanMission} onChange={updateSdwanMission} onExit={exitSdwanMission} next={nextAfter("sdwan-overlay")} />
      </RescueLauncher>
    );
  }

  if (signalDetectiveMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={signalDetectiveMission.status === "complete" ? null : rescueFor("signal-detective", signalDetectiveMission.phase)}>
        <SignalDetectiveMission mission={signalDetectiveMission} onChange={updateSignalDetectiveMission} onExit={exitSignalDetectiveMission} next={nextAfter("signal-detective")} />
      </RescueLauncher>
    );
  }

  if (campusFabricMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={campusFabricMission.status === "complete" ? null : rescueFor("campus-fabric", campusFabricMission.phase)}>
        <CampusFabricMission mission={campusFabricMission} onChange={updateCampusFabricMission} onExit={exitCampusFabricMission} next={nextAfter("campus-fabric")} />
      </RescueLauncher>
    );
  }

  if (lockControlPlaneMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={lockControlPlaneMission.status === "complete" ? null : rescueFor("lock-the-control-plane", lockControlPlaneMission.phase)}>
        <LockControlPlaneMission mission={lockControlPlaneMission} onChange={updateLockControlPlaneMission} onExit={exitLockControlPlaneMission} next={nextAfter("lock-the-control-plane")} />
      </RescueLauncher>
    );
  }

  if (automatorPrimeMission.status !== "not_started") {
    return (
      <RescueLauncher rescue={automatorPrimeMission.status === "complete" ? null : rescueFor("automator-prime", automatorPrimeMission.phase)}>
        <AutomatorPrimeMission mission={automatorPrimeMission} onChange={updateAutomatorPrimeMission} onExit={exitAutomatorPrimeMission} next={nextAfter("automator-prime")} />
      </RescueLauncher>
    );
  }

  if (mission.status !== "not_started") {
    return (
      <RescueLauncher rescue={mission.status === "complete" ? null : rescueFor("vlan")}>
        <MissionWorkspace mission={mission} onChange={updateMission} onReset={resetCurrentMission} onExit={exitVlanMission} next={nextAfter("vlan-that-vanished")} />
      </RescueLauncher>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Phase 1 · Playable prototype</p>
            <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">NetQuest</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Learn enterprise networking by inspecting, configuring, and watching a broken network come back to life.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
              onClick={() => (nextMission ? OPENERS[nextMission.id]() : openMission())}
              type="button"
            >
              {nextMission ? "Continue your path" : "Start / resume mission"} <span aria-hidden="true">→</span>
            </button>
            {nextMission && (
              <button
                className="rounded-lg border border-cyan-300/40 px-5 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/10"
                onClick={() => openQuiz(nextMission.id)}
                type="button"
              >
                {quizResults[nextMission.id]?.perfect ? "★ " : ""}{nextMission.title} quiz
              </button>
            )}
            <AccountButton />
          </div>
        </div>
        <AuthBanner />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-5">
            <p className="text-sm text-slate-400">Next up</p>
            <p className="mt-2 font-bold">{nextMission ? nextMission.title : "All missions complete"}</p>
            <p className="mt-2 text-sm text-cyan-300">{nextMission ? `${nextMission.xp} XP available` : "Replay any mission"}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Your progress</p><p className="mt-2 font-bold">Level {getLevel(xp)}</p><p className="mt-2 text-sm text-slate-300">{xp} XP · {streak}-day streak</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">Weak topics</p><p className="mt-2 font-bold">{weakTopics.length > 0 ? weakTopics[0] : "None below Guided"}</p><p className="mt-2 text-sm text-slate-300">{weakTopics.length > 1 ? `${weakTopics.length} topics need practice` : weakTopics.length === 1 ? "Recommended for practice" : "All objectives at Guided or better"}</p></div>
        </div>

        {nextMission ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-cyan-300/10 via-slate-900/70 to-slate-900/40 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Up next · Mission {nextMissionIndex} of {MISSION_CATALOG.length}
                </p>
                <p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{nextMission.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  <GlossaryText text={nextMission.desc} />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-1.5 text-sm font-black text-cyan-200">{nextMission.xp} XP</span>
                <button
                  className="rounded-lg bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                  onClick={() => OPENERS[nextMission.id]()}
                  type="button"
                >
                  Start / continue <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">All missions complete</p>
            <p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">You cleared the whole path 🎉</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">Replay any mission below to push your mastery higher, or keep the streak alive in the Training Grounds.</p>
          </div>
        )}
        <MasteryPanel mastery={mastery} weakTopics={weakTopics} onOpen={openArc} />
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold">Flashcard review</p>
            <p className="mt-1 text-sm text-slate-400">{dueFlashcards.length} card{dueFlashcards.length === 1 ? "" : "s"} due · 5 XP each · spaced repetition</p>
          </div>
          <button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={openFlashcards} type="button">
            Review ({dueFlashcards.length} due)
          </button>
        </div>
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-violet-300/30 bg-violet-300/5 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-violet-100">Adaptive review</p>
            <p className="mt-1 text-sm text-slate-400">{dueReviews} weak objective{dueReviews === 1 ? "" : "s"} due · fresh questions + lab variants · spaced repetition</p>
          </div>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-black transition ${dueReviews > 0 ? "bg-violet-300 text-slate-950 hover:bg-violet-200" : "cursor-default border border-slate-700 text-slate-500"}`}
            disabled={dueReviews === 0}
            onClick={openReview}
            type="button"
          >
            {dueReviews > 0 ? `Review weak spots (${dueReviews})` : "All caught up"}
          </button>
        </div>
        <div className="mt-10">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Start here · Beginner track</p>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <p className="mt-2 text-sm text-slate-400"><GlossaryText text="New to networking? These three guided missions teach the console and the concepts every mission below assumes — each takes a few minutes." /></p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {MISSION_CATALOG.filter((m) => m.tier === "beginner").map((m, index) => (
              <FieldMissionCard
                key={m.id}
                title={m.title}
                desc={m.desc}
                xp={m.xp}
                chipLabel={`Beginner mission ${index + 1}/3`}
                state={completedMissions.includes(m.id) ? "complete" : m.id === nextMission?.id ? "next" : "available"}
                onPlay={() => OPENERS[m.id]()}
              />
            ))}
          </div>
        </div>

        <div className="mt-10 flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Field missions</p>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          {MISSION_CATALOG.filter((m) => m.tier === "field").map((m) => (
            <FieldMissionCard
              key={m.id}
              title={m.title}
              desc={m.desc}
              xp={m.xp}
              state={completedMissions.includes(m.id) ? "complete" : m.id === nextMission?.id ? "next" : "available"}
              quizPerfect={quizResults[m.id]?.perfect}
              onPlay={() => OPENERS[m.id]()}
              onQuiz={() => openQuiz(m.id)}
            />
          ))}
        </div>

        <section className="mt-10">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Exam hall</p>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold">Diagnostic + 2 full-length mock exams</p>
              <p className="mt-1 text-sm text-slate-400">Mixed-domain, timed, aligned to the real ENCOR domain weights. Pass a mock to unlock the timed-mastery band.</p>
            </div>
            <button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200" onClick={() => setExamHallOpen(true)} type="button">Open exam hall</button>
          </div>
        </section>
        <section className="mt-6">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Hands-on labs</p>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold">Randomized multi-step IOS-style labs</p>
              <p className="mt-1 text-sm text-slate-400">Inspect → diagnose → configure → verify with variants and alternate valid commands. Repeated clean runs across variants build Independent mastery.</p>
            </div>
            <button className="rounded-lg border border-cyan-300/50 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/10" onClick={() => setLabsOpen(true)} type="button">Open labs</button>
          </div>
        </section>
        <CoverageDashboard mastery={mastery} />
        <ReadinessReport mastery={mastery} skills={skills} examResults={examResults} />
        <BadgesPanel statuses={badgeStatuses} />
        <TrainingGrounds />
        <SyncPanel />
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center"><div><p className="font-bold">Keep your streak alive</p><p className="mt-1 text-sm text-slate-400">A quick review is worth 5 XP while you warm up.</p></div><button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200" onClick={completeReview} type="button">Log 5 XP review</button></div>
        <footer className="mt-4 text-center text-xs text-slate-600">NetQuest</footer>
      </section>
    </main>
  );
}
