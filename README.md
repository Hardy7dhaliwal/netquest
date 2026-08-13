# NetQuest

Interactive, game-style CCNP ENCOR learning platform.

Current phase: **Phase 2 MVP + "learn and pass" upgrade** — the full ENCOR v1.2 blueprint is playable (**47/47 objectives, 100% exam weight** across 17 missions) with evidence-based coverage states, per-assessment-type mastery, a diagnostic exam + two full-length timed mocks, a five-dimension readiness report, a **21-lab hands-on library covering every 4.x and 6.x objective**, and the whole learning loop: rescue engine, glossary, arc quizzes, flashcards, badges, daily challenge, boss battles with difficulty tiers, streak calendar, and **cross-device cloud sync** via Supabase. **Live on Vercel** — deploy note in Development below.

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

## Hands-on labs — 21 labs, 2 variants each

The **labs panel** (dashboard → Hands-on labs) runs text-simulated IOS-style labs through the inspect → diagnose → configure → verify loop. Every lab has **2 variants** (different addressing, interfaces, symptoms, distractors — so memorizing one solution path fails), accepts **alternate valid commands**, gates fixes by protocol/variant to prevent cross-variant leakage, and notes simulator limits with pointers to CML/EVE-NG/Cisco DevNet sandboxes for real-device behavior. Clean runs across ≥2 variants feed the **Independent** mastery band.

### Core — 4 labs

| Lab | Objective | Fault scenario |
| --- | --- | --- |
| OSPF adjacency that won't form | 3.2.b | MTU mismatch → stuck EXSTART |
| PAT overload not translating | 3.3.b | Missing/reversed inside/outside |
| VLAN missing across the trunk | 3.1.a | VLAN pruned from allowed list |
| Infrastructure ACL letting probes through | 5.2.a | Permit-any ordering / application |

### Gap topics — 7 labs

| Lab | Objective | Fault scenario |
| --- | --- | --- |
| eBGP session stuck in Active | 3.2.c | Wrong remote-as → Active |
| First-hop failover never happens | 3.3.c | Missing preempt — HSRP (A) vs VRRP (B), protocol-gated |
| NetFlow records never exported | 4.2 | Flow monitor never applied to ingress |
| SPAN session captures nothing | 4.3 | Session has a source but no destination port |
| AAA login fails when the server is down | 5.1.b | Method list has no `local` fallback (RADIUS vs TACACS+) |
| CoPP dropping routing protocols | 5.2.b | Routing class misses the protocol (OSPF vs EIGRP) |
| Controller can't manage the device | 4.6 | NETCONF/RESTCONF never enabled |

### Assurance & automation — 10 labs (completes 4.x and 6.x)

| Lab | Objective | Fault scenario |
| --- | --- | --- |
| Ping works but the app times out | 4.1 | MTU black hole — 1500-byte df-bit probes fail, 1400 pass |
| Remote mirroring never arrives | 4.3 | RSPAN missing `remote-span` (A) vs ERSPAN missing `erspan-id` (B) |
| IP SLA probe never reports | 4.4 | Probe never scheduled → track stays down |
| Device never appears in Catalyst Center | 4.5 | SNMP community/version mismatch blocks discovery |
| The status script crashes | 6.1 | Python IndexError on the trailing blank line — fix with a guard |
| RESTCONF rejects the payload | 6.2, 6.5 | Malformed JSON → HTTP 400 `malformed-message` |
| The YANG path returns 404 | 6.3 | Missing module prefix / list key in the RESTCONF path |
| The controller API returns 401 | 6.4 | No auth token — Catalyst Center `X-Auth-Token` vs vManage `jSID` |
| The EEM applet never fires | 6.6 | Syslog pattern doesn't match real messages |
| The wrong orchestration tool was chosen | 6.7 | Agent vs agentless model mismatch |

## Mock exams

The **exam hall** (dashboard → Exam hall) runs blueprint-aligned practice exams, never real exam items:

- **Diagnostic exam** — 15 questions, untimed, for before study begins.
- **Mock exam A / B** — 40 questions, 55-minute timed mode with auto-submit; question counts are allocated to Cisco's domain weights (Architecture 15% / Virtualization 10% / Infrastructure 30% / Network Assurance 10% / Security 20% / Automation & AI 15%) via largest-remainder.
- Score report by objective + **remediation links** back to the arcs, labs, and flashcards that cover each miss.

## Learning systems

- **Curriculum coverage** — all 47 ENCOR v1.2 objectives carry teaching plans (subskills, lessons, guided scenarios, misconceptions) and an **evidence-based coverage state**: `planned / partial / complete / verified` (`lib/curriculum.ts`), shown as status chips on the coverage dashboard.
- **Mastery** — every objective carries a score on the PRD bands: 25 Introduced → 50 Recognized → 70 Guided → 85 Independent → **95 Under Pressure** (earned by winning a boss battle). Completing a mission raises its objectives' scores from wrong-attempt count; best result wins, so clean replays matter.
- **Skills** — per-objective scores split by assessment type (recall / output interpretation / configuration / troubleshooting / timed). **Independent** needs ≥2 no-hint clean runs across ≥2 lab variants; **Under Pressure** needs a timed mixed-variant pass (`lib/skills.ts`).
- **Rescue engine** — 46 mini-lessons keyed to mission phases, shown when a player is stuck (`lib/rescues.ts` + `HintLadder` + `rescue-panel`). Every phase of every mission is covered (enforced by tests).
- **Glossary** — 34 networking terms with clickable inline references in mission briefs and hints (`lib/glossary.ts` + `GlossaryText`).
- **Coverage dashboard** — per-domain progress and exam-weight percentages against the 47-objective blueprint, with evidence-based status chips + per-objective mastery.
- **Arc quizzes** — per-arc checkpoint quizzes over the arc's full vetted rescue-question bank (+25 XP perfect / +10 partial, once per arc).
- **Flashcards** — SM-2-lite spaced repetition over a per-arc deck (+5 XP per due card remembered).
- **Badges & exam readiness** — achievement badges over the mastery map (+20 XP each) and a **five-dimension readiness report** (blueprint coverage, knowledge, configuration, troubleshooting, timed exam) with confidence level, weakest objectives, and remaining requirements. **"Exam-ready" is only claimed when verified coverage + independent mastery everywhere + passing mock scores + recent timed-lab success + no high-risk Infrastructure/Security gaps** (`lib/readiness.ts`).
- **Training grounds** — a deterministic **daily challenge** (3 questions, 20s each, +40 XP + a streak day, one per calendar day) and **boss battles** (one per arc, win at ≥80% accuracy to push that arc to the Under Pressure band) with **Rookie / Veteran / Elite** tiers (4q/25s, 6q/15s, 8q/10s — +50/75/100 XP win).
- **Streak calendar** — a rolling 9-week chain of claimed challenge days on the dashboard, with current and best runs derived from the claimed-day history.
- **Cloud sync** — Supabase-backed cross-device backup of mastery, badges, streaks, exam/lab results, and challenge history. Magic-link sign-in, a per-user RLS-protected row, monotonic merge (fetch → merge → push, so a stale device can never overwrite newer data), manual **Sync now / Pull latest**, and debounced auto-sync while signed in.

## Architecture

```
lib/encor-catalog.ts         ENCOR v1.2 blueprint: 6 domains, 47 objectives, 14 arcs
lib/curriculum.ts            Teaching plans + evidence-based coverage states + audit matrix
lib/mastery.ts               Mastery engine: bands, recording, weak topics, recommendations
lib/skills.ts                Per-assessment-type mastery (recall/interpret/configure/troubleshoot/timed)
lib/exams.ts                 Diagnostic + 2 mock exams, domain-weighted, timed sessions
lib/labs.ts                  Variant lab engine (inspect-diagnose-configure-verify, alternate commands)
lib/lab-templates.ts         Core labs (4) + spreads of lab-templates-extra.ts (7) and -extra2.ts (10) = 21
lib/rescue.ts, rescues.ts    Rescue mini-lesson types + 46-entry phase-keyed catalog
lib/glossary.ts              Networking term glossary
lib/quiz.ts                  Per-arc checkpoint quizzes (bank shared with rescues/boss)
lib/flashcards.ts            SM-2-lite card scheduling
lib/badges.ts                Achievement badges over the mastery map
lib/readiness.ts             Five-dimension readiness report + strict exam-ready gate
lib/boss.ts                  Seeded PRNG: daily challenge, boss fights, difficulty tiers
lib/streak.ts                Current/best run math for the streak calendar
lib/sync.ts                  Transport-agnostic monotonic sync engine (fetch-merge-push)
lib/sync-supabase.ts         Supabase row transport (RLS-protected per-user blob)
lib/supabase.ts              Cookie-based browser client (@supabase/ssr)
lib/supabase-server.ts       Server client for the magic-link callback route
lib/progress-store.ts        zustand + localStorage: XP, streak, mastery, skills, exam/lab results, sync fields
lib/<arc>-mission.ts         14 field-mission engines + 3 beginner engines (deterministic)
lib/*.test.ts                484 unit tests across 35 files
components/*.tsx             Mission renderers + topology, console-panel, hint-ladder, glossary,
                             coverage-dashboard, mastery-panel, badges-panel, readiness-report,
                             arc-quiz, flashcard-review, gauntlet, training-grounds, streak-calendar,
                             sync-panel, rescue-launcher/panel, exam-hall, labs-panel
app/page.tsx                 Dashboard, mission wiring, persistence, award effects
app/auth/callback/route.ts   Magic-link PKCE exchange → session cookies → home
```

Conventions (keep these when adding features):

- Simulation/validation logic lives in `lib/` engines, never inside React components.
- Every engine has a deterministic unit test file in `lib/`.
- New arcs are registered in `lib/encor-catalog.ts`; coverage is honest — a mission earns 150 XP only with a typed CLI pass (200 XP for the two finale arcs).
- Dashboard wiring requires: state + reset, localStorage snapshot validator, `openXxxMission`/`exitXxxMission`, an `awardMission` effect, and `recordMissionResult` for mastery.
- New persisted fields flow through: `ProgressData` type → `INITIAL_PROGRESS` → `partialize` → backward-compatible `merge` → `buildSnapshot`/`mergeProgress` in `lib/sync.ts` (so they ride the cloud blob).
- New labs: add the template to `lib/lab-templates-extra*.ts` (or the core file), keep commands variant-aware where the two variants differ by protocol, and extend the coverage assertion in `lib/labs.test.ts`.

## Development

```bash
npm install
npm run dev       # start dev server
npm test          # vitest (484 unit tests)
npm run build     # production build
npm run lint      # eslint (see known notes)
```

**Live deployment:** the app auto-deploys to **Vercel** from `main` (`https://netquest-six.vercel.app`). The Vercel project has its own `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars, and Supabase's Site URL + Redirect URLs point at the production domain (plus `http://localhost:3015/auth/callback` for local dev). Node 22 is pinned via `engines` so the production build is deterministic.

**Cloud sync setup** (once, for a fresh Supabase project): create a free Supabase project, put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (gitignored), run the `progress` table SQL from `lib/sync-supabase.ts` in the Supabase SQL editor, and add `http://localhost:3015/auth/callback` to Auth → URL Configuration → Redirect URLs (Site URL = `http://localhost:3015`). The app runs fully offline until then.

## Testing

484 deterministic unit tests across 35 files:

| Area | Files | Tests |
| --- | --- | ---: |
| Beginner missions | cli-basics, show-and-ping, packet-trail | 17 |
| Field engines | mission (VLAN), stp, etherchannel, ospf, edge, gateway, edge-services | 93 |
| Overlay arcs | tunnel-vision, fabric-express, sdwan, campus-fabric | 66 |
| Assurance + finale | signal-detective, lock-control-plane, automator-prime | 60 |
| Learning systems | rescue, rescues, glossary, mastery, quiz, flashcards, badges, readiness, boss, streak | 101 |
| Learn-and-pass engines | curriculum, skills, exams, labs (incl. full 4.x/6.x lab-coverage assertion) | 91 |
| Core + sync | progress-store, encor-catalog, sync, smoke | 56 |

## Known notes

- **Audit / attribution:** the topology uses React Flow with attribution hidden via `proOptions.hideAttribution` for this internal prototype; restore it before any public release if the library license or product review requires it (the app is currently deployed publicly on Vercel).
- **ESLint:** `npm run lint` hangs silently in this dev environment (no diagnostics emitted) — run `tsc --noEmit` and `vitest` instead; the production build also typechecks.
- **Vitest boot:** the full suite can be slow to start; use `./node_modules/.bin/vitest run lib/<file>.test.ts` to target a single engine.
- **Stale `.next/` artifacts:** don't run `next build` and `tsc` concurrently — concurrent writes to `.next/types/` can produce stale `*. 2.ts` duplicates. They are gitignored; delete and rerun sequentially if they appear.
- **`*.tsbuildinfo` is gitignored** (`tsconfig.tsbuildinfo` will not be committed).
- **Shell env shadowing:** Next.js never lets `.env` files override vars already exported in the shell. If the sync panel shows "off" despite keys in `.env.local`, check `env | grep SUPABASE` in that terminal for stale empty exports (the dev-daemon script `scripts/start-dev-server.py` purges them automatically).
- **Node version:** the repo pins **Node 22** via `engines` (supabase-js deprecates Node ≤20).
