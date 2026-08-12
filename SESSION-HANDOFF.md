# NetQuest — Session Handoff

**Living document.** Update this file at the end of every session: mark what shipped, refresh test counts, and rewrite "Next session" from whatever is actually next. The README points here.

Last updated: 2026-08-12

---

## 1. Where we are

- **Phase 1 (prototype) is complete** — The VLAN That Vanished with React Flow topology, Framer Motion packet animation, CLI, event log, XP, and persistence.
- **Phase 2 (MVP) content is complete** — all **14 field arcs + 3 beginner missions** are built and playable; the ENCOR v1.2 blueprint is **47/47 objectives, 100% exam weight covered**. The **mastery system** (per-objective scores, weak-topic derivation, recommended-next engine) is live.
- **Validation baseline: 283/283 tests green (24 files), `tsc --noEmit` clean.** (ESLint hangs in this environment — see §5.)

## 2. Done so far (milestones)

| When | What shipped |
| --- | --- |
| Phase 1 | **The VLAN That Vanished** (3.1.a) — full CLI mission: `enable` → `show vlan brief` / `show interfaces trunk` → `interface g0/1` → `switchport trunk allowed vlan add 20` → `ping 10.20.0.1`. Deterministic engine in `lib/mission.ts`, React Flow topology, packet animation, event log, 150 XP, localStorage resume. |
| Sessions A–E | **The STP Storm** (3.1.c), **The Bundled Bottleneck** (3.1.b), **Area Zero Hero** (3.2.b, grew to 6 phases incl. summarize + filter), **The Edge Has Opinions** (3.2.a/c/d, first multi-objective arc, typed eBGP fix) — clicker/CLI arcs with misconception feedback and 100–150 XP. |
| Session E | **ENCOR catalog** — `lib/encor-catalog.ts` maps the full v1.2 blueprint (6 domains, 47 objectives, exact weights 15/10/30/10/20/15) to 14 mission arcs; dashboard shows the blueprint map. |
| Session F | **Gateway at Dawn** (1.1.a/b, 3.3.c) — two-tier design + HSRP pair, typed HSRP config, failover drill, VRRP contrast. 150 XP. |
| Session F | **Edge Services** (1.4, 3.3.a/b/d) — QoS/NTP interpret, typed NAT/PAT configure + translation drill, multicast. 150 XP. |
| Session G | **The Overlay Heist arc completed**: **Tunnel Vision** (2.2.a/b — typed VRF/GRE/IPsec/crypto-map walk, 150 XP), **The Fabric Express** (2.1.a/b/c, 2.3.b — multi-device HOST-1/LEAF-1 typed inspections, 100 XP), **SD-WAN: The WAN Overlay** (1.2.a/b — researcher-verified vEdge CLI, 100 XP), **The Campus Fabric** (1.3.a/b, 2.3.a — LISP inspection on CP-1, 100 XP). |
| Session H | **The Signal Detective** (4.1–4.6) — biggest arc: four typed-CLI walks (diagnostic ladder w/ conditional debug reveal, SPAN, IP SLA, RESTCONF). Assurance domain fully covered. 150 XP. |
| Session I | **Lock the Control Plane** (5.1.a–5.4.d) — two typed CLI walks (local auth + AAA/RADIUS) plus four security MCQs. Security domain fully covered. 200 XP. |
| Session I | **Automator Prime** (6.1–6.7) — **the finale**: typed Python REPL probe, typed JSON payloads, YANG/API/response MCQs, typed EEM applet walk, agent-vs-agentless. Automation domain fully covered → **47/47, 100% weight**. 200 XP. |
| Session J | **Rescue engine** — `lib/rescue.ts` + `lib/rescues.ts` (**46 rescue mini-lessons** keyed to mission phases) + `HintLadder`; every phase of every mission has a stuck-player rescue. |
| Session J | **Glossary** — 34 networking terms (`lib/glossary.ts`) with clickable inline terms (`GlossaryText`) across mission briefs and hints. |
| Session J | **Beginner track** — Console Basics, Show & Ping, The Packet Trail (3 guided 50 XP missions for newcomers). |
| Session J | **Coverage dashboard** — `components/coverage-dashboard.tsx`: per-domain progress against the blueprint, exam-weight percentages. |
| Session K | **Mastery & recommendations (Slice A)** — `lib/mastery.ts` engine: per-objective scores on the PRD bands (25/50/70/85/95), best-result-wins recording from wrong attempts, weak-objective detection, `recommendNext` (unplayed arc → weakest arc → exam-ready); `recordMissionResult` in the store derives `weakTopics`; `MasteryPanel` recommended-next card; CoverageDashboard shows per-objective mastery chips + per-domain averages. |

## 3. Current state (code map)

- **Engines** (all deterministic, no React): `lib/mission.ts` (VLAN), `lib/{stp,etherchannel,ospf,edge,gateway,edge-services,tunnel-vision,fabric-express,sdwan,signal-detective,campus-fabric,lock-control-plane,automator-prime}-mission.ts` + beginner engines `lib/{cli-basics,show-and-ping,packet-trail}-mission.ts`. Each has `startX`/`resetX`, per-phase choice/command functions, `X_EXPECTED` constants, attempt counting, and event-log feedback.
- **Mastery**: `lib/mastery.ts` (bands, recording, weak detection, recommendations) + `lib/mastery.test.ts`.
- **Rescue/glossary**: `lib/rescue.ts` (RescueDefinition + steps types), `lib/rescues.ts` (46 entries, phase-keyed), `lib/glossary.ts` (34 terms).
- **UI**: 17 mission renderers in `components/` + shared `topology.tsx`, `console-panel.tsx`, `command-reference.tsx`, `hint-ladder.tsx`, `glossary-text.tsx`, `coverage-dashboard.tsx`, `mastery-panel.tsx`. Dark slate/cyan theme, `role="group"`/`aria-pressed` options, `aria-live` logs.
- **Dashboard**: `app/page.tsx` — hero, XP/level/streak/weak-topic cards, MasteryPanel (recommended next), beginner track, one card per arc (Play/resume · XP), CoverageDashboard with mastery chips, streak review button.
- **Persistence**: zustand `persist` for progress (`netquest-progress` — xp, streak, weakTopics, completedMissions, **mastery**); per-mission localStorage keys with validated snapshot guards. Invalid saves are discarded.
- **Catalog**: `lib/encor-catalog.ts` — all 14 arcs `available`/`complete`; `getCoverageByDomain`/`getWeightedCoverage` report 47/47 and 100%.

## 4. Proven build pattern (follow for every new feature — ponytail: no new deps, no new abstractions)

1. `lib/<feature>.ts` — deterministic engine; mirror an existing engine exactly.
2. `lib/<feature>.test.ts` — transitions, wrong-answer feedback, immutability, completion tests.
3. `components/<feature>.tsx` — UI wiring.
4. Register in the catalog / store / page (`app/page.tsx`): state + reset, snapshot validator, open/exit, award effect, dashboard card, render branch.
5. Validate: targeted tests → full suite → `tsc --noEmit` → code-reviewer pass → fix → re-validate.

**XP rules:** clicker/interpretation missions = 100 XP; missions with a typed CLI configure+verify pass = 150 XP; the two finale arcs (Lock the Control Plane, Automator Prime) = 200 XP. Beginner missions = 50 XP each. Total available ≈ 2050 XP (+ 5 XP per review). `awardMission` is idempotent; `recordMissionResult` (mastery) fires on **every** completion so clean replays can raise a score (best result wins).

**Snapshot changes:** additive fields are backward-compatible (`?? null`/`?? {}` defaults — mastery map merges to `{}` for old saves). Format changes (e.g., clicker → CLI) intentionally reset old saves — comment the reason.

## 5. Known environment issues

- **ESLint hangs silently** — `npm run lint` never returns/emits diagnostics in this dev machine. Use `tsc --noEmit` + `vitest` + `next build` for validation instead.
- **`next build` + `tsc` concurrently corrupt `.next/types/`** — produces stale `*. 2.ts` duplicates; `.next/` is gitignored. Run them sequentially; `rm -f '.next/types/* 2.ts'` if they appear.
- **Vitest boot is slow** — target single files (`./node_modules/.bin/vitest run lib/x.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --no-isolate`); give the full suite a long timeout.
- **Repo state**: no git commits yet — everything is untracked. `350-401-ENCORE-v1.2.pdf` and `CCNP-350-401-ENCOR-v1.2-Learning-Matrix.xlsx` (the curriculum source docs) sit untracked at the root; decide whether to commit or gitignore them.

## 6. Next session — priorities

1. **Commit the current state** (initial commit) so progress is recoverable, and decide on the two curriculum binaries (commit vs `.gitignore`).
2. **Slice B — quizzes & flashcards**: per-arc mini-quizzes (reuse the vetted rescue `checkpoint` steps — unique options + correct + explanations already exist) and an SM-2-lite flashcard deck (≥3 cards/arc) with a review screen and 5 XP per card. This closes the curriculum "Required Content Per Mission Arc" items #7–#8.
3. **Slice C — daily challenge & boss battles**: a date-seeded 50 XP mixed set plus one cross-domain boss-battle scenario; boss battles are the natural way to unlock the 95 "underPressure" mastery band (currently reserved, unreachable).
4. **Slice D — badges & exam-readiness report**: achievements over mastery + an "exam-ready vs introduced" view (data model tables `achievements`/`user_achievements` in the PRD).
5. **Auth / cross-device persistence** — the last big Phase 2 MVP item (PRD §9); deferred until the local learning loop is proven.

## 7. Deferred / open decisions

- **Mastery model** — implemented (Slice A); quiz/flashcard/boss-battle inputs and the 95 band are the remaining pieces.
- **Quiz/flashcard content source** — rescue checkpoints are the natural quiz pool; decide whether flashcards are derived or hand-written per arc.
- **Auth / cross-device persistence** — deferred (localStorage only today), per curriculum Phase 2 boundary.
- **AI tutor** — only after the verified content model exists (per PRD §15 and curriculum); the rescue engine is the deterministic stand-in today.
- **Static EtherChannel** (`mode on`) troubleshooting — explicitly skipped; add a static-mismatch variant when the arc grows.
