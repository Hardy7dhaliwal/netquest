# NetQuest

Interactive, game-style CCNP ENCOR learning platform.

Current phase: **Phase 2 MVP in progress** — the full ENCOR v1.2 blueprint is playable (**47/47 objectives, 100% exam weight** across 17 missions), with a per-objective mastery system, rescue engine, and glossary. Remaining MVP work is the learning-loop layer (quizzes, flashcards, daily challenge, boss battles, auth).

## Product docs

- `netquest-prd.md` — product requirements (source of truth)
- `phase-1-spec.md` — Phase 1 implementation contract
- `encor-curriculum.md` — ENCOR v1.2 blueprint + mission-arc coverage plan + mastery rules
- `SESSION-HANDOFF.md` — **living session doc**: what has been done and what is next

## Playable missions (built)

### Beginner track — 50 XP each

| Mission | Teaches |
| --- | --- |
| Console Basics | First commands: help, enable, config mode, end, show version |
| Show & Ping | Reading a healthy network + proving it with ping |
| The Packet Trail | Visual tour: a packet crossing access ports and trunks |

### Field arcs — 100–200 XP each

| Arc | Objective(s) | XP | Format |
| --- | --- | ---: | --- |
| The VLAN That Vanished | 3.1.a (802.1Q trunking) | 150 | Full CLI troubleshooting (type commands, fix trunk, ping) |
| The STP Storm | 3.1.c (RSTP, MST, root guard, BPDU guard) | 100 | Prediction clicker + misconception feedback |
| The Bundled Bottleneck | 3.1.b (EtherChannel) | 100 | Clicker (evidence → cause → config → verify) |
| Area Zero Hero | 3.2.b (OSPF areas, adjacency, summarization, filtering) | 100 | 6-phase clicker + typed fixes |
| The Edge Has Opinions | 3.2.a/c/d (EIGRP vs OSPF, eBGP, PBR) | 150 | Clicker + **typed eBGP console** |
| Gateway at Dawn | 1.1.a/b, 3.3.c (design, HA, HSRP/VRRP) | 150 | **Typed HSRP config** + failover drill |
| Edge Services | 1.4, 3.3.a/b/d (QoS, NTP, NAT/PAT, multicast) | 150 | **Typed NAT/PAT walk** + drills |
| Tunnel Vision | 2.2.a/b (VRF, GRE-over-IPsec) | 150 | **Typed VRF/GRE/IPsec/crypto-map walk** |
| The Fabric Express | 2.1.a/b/c, 2.3.b (hypervisors, VMs, vSwitch, VXLAN) | 100 | Multi-device **typed inspections** (esxcli, nve1) |
| SD-WAN: The WAN Overlay | 1.2.a/b (planes, OMP/TLOC, benefits) | 100 | **Typed vEdge CLI** (verified output formats) |
| The Signal Detective | 4.1–4.6 (debug, NetFlow, SPAN, IP SLA, Catalyst Center, NETCONF/RESTCONF) | 150 | **Four typed-CLI walks** |
| The Campus Fabric | 1.3.a/b, 2.3.a (SD-Access, LISP) | 100 | **Typed LISP inspection** on CP-1 |
| Lock the Control Plane | 5.1.a–5.4.d (lines/AAA, iACL, CoPP, REST, TrustSec/MACsec) | 200 | Two **typed CLI walks** + security MCQs |
| Automator Prime | 6.1–6.7 (Python, JSON, YANG, APIs, REST responses, EEM, orchestration) | 200 | **Typed Python/JSON/EEM** + MCQs |

Every mission tracks attempts, logs misconception feedback, persists progress to `localStorage` (validated snapshot guards on resume), awards XP (idempotent), and **records per-objective mastery**.

## Learning systems

- **Mastery** — every objective carries a score on the PRD bands (25 Introduced → 50 Recognized → 70 Guided → 85 Independent; 95 underPressure reserved). Completing a mission raises its objectives' scores from wrong-attempt count; best result wins, so clean replays matter. The dashboard derives **weak topics** and a **recommended-next engine** (`lib/mastery.ts`).
- **Rescue engine** — 46 mini-lessons keyed to mission phases, shown when a player is stuck (`lib/rescues.ts` + `HintLadder`). Every phase of every mission is covered (enforced by tests).
- **Glossary** — 34 networking terms with clickable inline references in mission briefs and hints (`lib/glossary.ts` + `GlossaryText`).
- **Coverage dashboard** — per-domain progress and exam-weight percentages against the 47-objective blueprint, with per-objective mastery chips.

## Architecture

```
lib/mastery.ts               Mastery engine: bands, recording, weak topics, recommendations
lib/rescue.ts, rescues.ts    Rescue mini-lesson types + 46-entry phase-keyed catalog
lib/glossary.ts              Networking term glossary
lib/encor-catalog.ts         ENCOR v1.2 blueprint: 6 domains, 47 objectives, 14 arcs
lib/progress-store.ts        zustand + localStorage: XP, streak, weak topics, mastery
lib/<arc>-mission.ts         14 field-mission engines + 3 beginner engines (deterministic)
lib/*.test.ts                283 unit tests across 24 files
components/*.tsx             Mission renderers + topology, console-panel, hint-ladder,
                             glossary-text, coverage-dashboard, mastery-panel
app/page.tsx                 Dashboard, mission wiring, persistence, award effects
```

Conventions (keep these when adding features):

- Simulation/validation logic lives in `lib/` engines, never inside React components.
- Every engine has a deterministic unit test file in `lib/`.
- New arcs are registered in `lib/encor-catalog.ts`; coverage is honest — clicker-only missions are `partial`, a mission earns 150 XP only with a typed CLI pass (200 XP for the two finale arcs).
- Dashboard wiring requires: state + reset, localStorage snapshot validator, `openXxxMission`/`exitXxxMission`, an `awardMission` effect, and `recordMissionResult` for mastery.

## Development

```bash
npm install
npm run dev       # start dev server
npm test          # vitest (283 unit tests)
npm run build     # production build
npm run lint      # eslint (see known notes)
```

## Testing

283 deterministic unit tests across 24 files:

| Area | Files | Tests |
| --- | --- | ---: |
| Beginner missions | cli-basics, show-and-ping, packet-trail | 17 |
| Field engines | mission (VLAN), stp, etherchannel, ospf, edge, gateway, edge-services | 89 |
| Overlay arcs | tunnel-vision, fabric-express, sdwan, campus-fabric | 66 |
| Assurance + finale | signal-detective, lock-control-plane, automator-prime | 60 |
| Learning systems | rescue, rescues, glossary, mastery | 36 |
| Core | progress-store, encor-catalog, smoke | 15 |

## Known notes

- **Audit / attribution:** the topology uses React Flow with attribution hidden via `proOptions.hideAttribution` for this internal prototype; restore it before any public deployment if the library license or product review requires it.
- **ESLint:** `npm run lint` hangs silently in this dev environment (no diagnostics emitted) — run `tsc --noEmit` and `vitest` instead; the production build also typechecks.
- **Vitest boot:** the full suite can be slow to start; use `./node_modules/.bin/vitest run lib/<file>.test.ts` to target a single engine.
- **Stale `.next/` artifacts:** don't run `next build` and `tsc` concurrently — concurrent writes to `.next/types/` can produce stale `*. 2.ts` duplicates. They are gitignored; delete and rerun sequentially if they appear.
- **`*.tsbuildinfo` is gitignored** (`tsconfig.tsbuildinfo` will not be committed).
