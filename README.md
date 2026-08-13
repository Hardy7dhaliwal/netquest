# NetQuest

Interactive, game-style CCNP ENCOR learning platform.

Current phase: **Phase 2 MVP complete** — the full ENCOR v1.2 blueprint is playable (**47/47 objectives, 100% exam weight** across 17 missions) and the entire learning loop is live: per-objective mastery, rescue engine, glossary, arc quizzes, flashcards, badges, exam-readiness report, daily challenge, boss battles with difficulty tiers, a streak calendar, and **cross-device cloud sync** via Supabase.

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

- **Mastery** — every objective carries a score on the PRD bands: 25 Introduced → 50 Recognized → 70 Guided → 85 Independent → **95 Under Pressure** (earned by winning a boss battle). Completing a mission raises its objectives' scores from wrong-attempt count; best result wins, so clean replays matter. The dashboard derives **weak topics** and a **recommended-next engine** (`lib/mastery.ts`).
- **Rescue engine** — 46 mini-lessons keyed to mission phases, shown when a player is stuck (`lib/rescues.ts` + `HintLadder` + `rescue-panel`). Every phase of every mission is covered (enforced by tests).
- **Glossary** — 34 networking terms with clickable inline references in mission briefs and hints (`lib/glossary.ts` + `GlossaryText`).
- **Coverage dashboard** — per-domain progress and exam-weight percentages against the 47-objective blueprint, with per-objective mastery chips.
- **Arc quizzes** — per-arc checkpoint quizzes over the arc's full vetted rescue-question bank (+25 XP perfect / +10 partial, once per arc).
- **Flashcards** — SM-2-lite spaced repetition over a per-arc deck (+5 XP per due card remembered).
- **Badges & exam-readiness** — achievement badges over the mastery map (+20 XP each) and a readiness report grading each domain on the mastery bands.
- **Training grounds** — a deterministic **daily challenge** (3 questions, 20s each, +40 XP + a streak day, one per calendar day) and **boss battles** (one per arc, win at ≥80% accuracy to push that arc to the Under Pressure band) with **Rookie / Veteran / Elite** tiers (4q/25s, 6q/15s, 8q/10s — +50/75/100 XP win).
- **Streak calendar** — a rolling 9-week chain of claimed challenge days on the dashboard, with current and best runs derived from the claimed-day history.
- **Cloud sync** — Supabase-backed cross-device backup of mastery, badges, streaks, and challenge history. Magic-link sign-in, a per-user RLS-protected row, monotonic merge (fetch → merge → push, so a stale device can never overwrite newer data), manual **Sync now / Pull latest**, and debounced auto-sync while signed in.

## Architecture

```
lib/mastery.ts               Mastery engine: bands, recording, weak topics, recommendations
lib/rescue.ts, rescues.ts    Rescue mini-lesson types + 46-entry phase-keyed catalog
lib/glossary.ts              Networking term glossary
lib/quiz.ts                  Per-arc checkpoint quizzes (bank shared with rescues/boss)
lib/flashcards.ts            SM-2-lite card scheduling
lib/badges.ts                Achievement badges over the mastery map
lib/readiness.ts             Exam-readiness bands per domain
lib/boss.ts                  Seeded PRNG: daily challenge, boss fights, difficulty tiers
lib/streak.ts                Current/best run math for the streak calendar
lib/sync.ts                  Transport-agnostic monotonic sync engine (fetch-merge-push)
lib/sync-supabase.ts         Supabase row transport (RLS-protected per-user blob)
lib/supabase.ts              Cookie-based browser client (@supabase/ssr)
lib/supabase-server.ts       Server client for the magic-link callback route
lib/encor-catalog.ts         ENCOR v1.2 blueprint: 6 domains, 47 objectives, 14 arcs
lib/progress-store.ts        zustand + localStorage: XP, streak, mastery, badges, sync fields
lib/<arc>-mission.ts         14 field-mission engines + 3 beginner engines (deterministic)
lib/*.test.ts                373 unit tests across 31 files
components/*.tsx             Mission renderers + topology, console-panel, hint-ladder, glossary,
                             coverage-dashboard, mastery-panel, badges-panel, readiness-report,
                             arc-quiz, flashcard-review, gauntlet, training-grounds,
                             streak-calendar, sync-panel, rescue-launcher/panel
app/page.tsx                 Dashboard, mission wiring, persistence, award effects
app/auth/callback/route.ts   Magic-link PKCE exchange → session cookies → home
```

Conventions (keep these when adding features):

- Simulation/validation logic lives in `lib/` engines, never inside React components.
- Every engine has a deterministic unit test file in `lib/`.
- New arcs are registered in `lib/encor-catalog.ts`; coverage is honest — a mission earns 150 XP only with a typed CLI pass (200 XP for the two finale arcs).
- Dashboard wiring requires: state + reset, localStorage snapshot validator, `openXxxMission`/`exitXxxMission`, an `awardMission` effect, and `recordMissionResult` for mastery.
- New persisted fields flow through: `ProgressData` type → `INITIAL_PROGRESS` → `partialize` → backward-compatible `merge` → `buildSnapshot`/`mergeProgress` in `lib/sync.ts` (so they ride the cloud blob).

## Development

```bash
npm install
npm run dev       # start dev server
npm test          # vitest (373 unit tests)
npm run build     # production build
npm run lint      # eslint (see known notes)
```

**Cloud sync setup** (once): create a free Supabase project, put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (gitignored), run the `progress` table SQL from `lib/sync-supabase.ts` in the Supabase SQL editor, and add `http://localhost:3015/auth/callback` to Auth → URL Configuration → Redirect URLs (Site URL = `http://localhost:3015`). The app runs fully offline until then.

## Testing

373 deterministic unit tests across 31 files:

| Area | Files | Tests |
| --- | --- | ---: |
| Beginner missions | cli-basics, show-and-ping, packet-trail | 17 |
| Field engines | mission (VLAN), stp, etherchannel, ospf, edge, gateway, edge-services | 93 |
| Overlay arcs | tunnel-vision, fabric-express, sdwan, campus-fabric | 66 |
| Assurance + finale | signal-detective, lock-control-plane, automator-prime | 60 |
| Learning systems | rescue, rescues, glossary, mastery, quiz, flashcards, badges, readiness, boss, streak | 90 |
| Core + sync | progress-store, encor-catalog, sync, smoke | 47 |

## Known notes

- **Audit / attribution:** the topology uses React Flow with attribution hidden via `proOptions.hideAttribution` for this internal prototype; restore it before any public deployment if the library license or product review requires it.
- **ESLint:** `npm run lint` hangs silently in this dev environment (no diagnostics emitted) — run `tsc --noEmit` and `vitest` instead; the production build also typechecks.
- **Vitest boot:** the full suite can be slow to start; use `./node_modules/.bin/vitest run lib/<file>.test.ts` to target a single engine.
- **Stale `.next/` artifacts:** don't run `next build` and `tsc` concurrently — concurrent writes to `.next/types/` can produce stale `*. 2.ts` duplicates. They are gitignored; delete and rerun sequentially if they appear.
- **`*.tsbuildinfo` is gitignored** (`tsconfig.tsbuildinfo` will not be committed).
- **Shell env shadowing:** Next.js never lets `.env` files override vars already exported in the shell. If the sync panel shows "off" despite keys in `.env.local`, check `env | grep SUPABASE` in that terminal for stale empty exports (the dev-daemon script `scripts/start-dev-server.py` purges them automatically).
- **Node version:** supabase-js warns that Node 20 is deprecated — upgrade to Node 22+ when convenient.
