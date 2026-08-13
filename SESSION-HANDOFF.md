# NetQuest — Session Handoff

**Living document.** Update this file at the end of every session: mark what shipped, refresh test counts, and rewrite "Next session" from whatever is actually next. The README points here.

Last updated: 2026-08-12

---

## 1. Where we are

- **Phase 1 (prototype) is complete** — The VLAN That Vanished with React Flow topology, Framer Motion packet animation, CLI, event log, XP, and persistence.
- **Phase 2 (MVP) is complete** — all **14 field arcs + 3 beginner missions** are built and playable; the ENCOR v1.2 blueprint is **47/47 objectives, 100% exam weight covered**. The full learning loop is live: mastery (incl. the previously-unreachable 95 "Under Pressure" band, now earned by boss wins), rescue engine, glossary, arc quizzes, flashcards, badges, exam-readiness report, daily challenge, boss battles with tiers, streak calendar, and **cross-device cloud sync** (Supabase magic-link auth).
- **Validation baseline: 373/373 tests green (31 files), `tsc --noEmit` clean.** (ESLint hangs in this environment — see §5.)
- **Repo: 7 commits on `main`, pushed to GitHub** (`github.com/Hardy7dhaliwal/netquest`). Working tree clean.

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
| Slice B | **Arc quizzes + flashcards** — per-arc quizzes over the arc's full vetted rescue checkpoint bank (`lib/quiz.ts`, +25/10 XP once per arc) and an SM-2-lite deck (`lib/flashcards.ts`, +5 XP per due card). Closes PRD items #7–#8. |
| Slice D | **Badges + exam-readiness (Slice D)** — achievement badges over the mastery map (+20 XP each, `lib/badges.ts`) and a per-domain readiness report on the mastery bands (`lib/readiness.ts`). |
| Slice C | **Daily challenge + boss battles (Slice C)** — date-seeded daily challenge (3 questions, 20s each, +40 XP + streak day, once per calendar day) and 14 seeded boss fights (win at ≥80% to push an arc's objectives to the 95 Under Pressure band). Shared timed runner `components/gauntlet.tsx`; **plus UI stacking fixes** (the rescue button was hidden under the global glossary FAB — now stacked above it; overlays raised above the FAB). |
| Slice C | **Boss difficulty tiers** — Rookie (4q/25s, +50/10), Veteran (6q/15s, +75/15), Elite (8q/10s, +100/20) via `BOSS_TIERS`; tier picker in the Training Grounds; store accepts tier XP (backward compatible). |
| Final slice | **Cross-device sync (Supabase)** — transport-agnostic monotonic sync engine `lib/sync.ts` (fetch → merge → push so a stale device can never overwrite newer cloud data; 15 tests), RLS-protected per-user row transport `lib/sync-supabase.ts`, cookie-based browser client `lib/supabase.ts` (@supabase/ssr — the PKCE verifier must live in cookies for the server exchange), magic-link callback `app/auth/callback/route.ts` + `lib/supabase-server.ts`, and `components/sync-panel.tsx` (sign-in, Sync now / Pull latest, last-synced status, 4s debounced auto-sync). Also `scripts/start-dev-server.py` (detached dev server that purges stale shell SUPABASE vars). |
| Final slice | **Streak calendar** — rolling 9-week chain of claimed challenge days in the Training Grounds (`components/streak-calendar.tsx`), current/best runs derived from a new persisted `dailyHistory` (`lib/streak.ts`); the history rides the sync blob so the chain survives device switches. |

## 3. Current state (code map)

- **Engines** (all deterministic, no React): `lib/mission.ts` (VLAN), `lib/{stp,etherchannel,ospf,edge,gateway,edge-services,tunnel-vision,fabric-express,sdwan,signal-detective,campus-fabric,lock-control-plane,automator-prime}-mission.ts` + beginner engines `lib/{cli-basics,show-and-ping,packet-trail}-mission.ts`. Each has `startX`/`resetX`, per-phase choice/command functions, `X_EXPECTED` constants, attempt counting, and event-log feedback.
- **Learning systems**: `lib/mastery.ts`, `lib/quiz.ts`, `lib/flashcards.ts`, `lib/badges.ts`, `lib/readiness.ts`, `lib/boss.ts` (seeded PRNG: daily + boss tiers), `lib/streak.ts`, `lib/rescue.ts` + `lib/rescues.ts` (46 entries), `lib/glossary.ts` (34 terms).
- **Sync**: `lib/sync.ts` (merge engine), `lib/sync-supabase.ts` (transport), `lib/supabase.ts` (browser client), `lib/supabase-server.ts` (callback client), `app/auth/callback/route.ts`.
- **UI**: 17 mission renderers + `topology.tsx`, `console-panel.tsx`, `command-reference.tsx`, `hint-ladder.tsx`, `glossary-text.tsx`, `coverage-dashboard.tsx`, `mastery-panel.tsx`, `badges-panel.tsx`, `readiness-report.tsx`, `arc-quiz.tsx`, `flashcard-review.tsx`, `gauntlet.tsx`, `training-grounds.tsx`, `streak-calendar.tsx`, `sync-panel.tsx`, `rescue-launcher.tsx`/`rescue-panel.tsx`. Dark slate/cyan theme, `role="group"`/`aria-pressed` options, `aria-live` logs.
- **Dashboard**: `app/page.tsx` — hero, XP/level/streak/weak-topic cards, MasteryPanel (recommended next), beginner track, one card per arc (Play/resume · XP), CoverageDashboard, ArcQuiz + FlashcardReview, BadgesPanel, ReadinessReport, TrainingGrounds (daily + boss + streak calendar), SyncPanel.
- **Persistence**: zustand `persist` for progress (`netquest-progress` — xp, streak, weakTopics, completedMissions, mastery, quizResults, cardReviews, badges, daily, dailyHistory, bossRecords, lastSyncedAt); per-mission localStorage keys with validated snapshot guards. Invalid saves are discarded. Every persisted field flows through `buildSnapshot`/`mergeProgress` so it rides the cloud blob.
- **Catalog**: `lib/encor-catalog.ts` — all 14 arcs `available`/`complete`; `getCoverageByDomain`/`getWeightedCoverage` report 47/47 and 100%.

## 4. Proven build pattern (follow for every new feature — ponytail: no new deps, no new abstractions)

1. `lib/<feature>.ts` — deterministic engine; mirror an existing engine exactly.
2. `lib/<feature>.test.ts` — transitions, wrong-answer feedback, immutability, completion tests.
3. `components/<feature>.tsx` — UI wiring.
4. Register in the catalog / store / page (`app/page.tsx`): state + reset, snapshot validator, open/exit, award effect, dashboard card, render branch.
5. New persisted fields: `ProgressData` type → `INITIAL_PROGRESS` → `partialize` → backward-compatible `merge` → `buildSnapshot`/`mergeProgress` in `lib/sync.ts`.
6. Validate: targeted tests → full suite → `tsc --noEmit` → code-reviewer pass → fix → re-validate.

**XP rules:** clicker/interpretation missions = 100 XP; missions with a typed CLI configure+verify pass = 150 XP; the two finale arcs (Lock the Control Plane, Automator Prime) = 200 XP. Beginner missions = 50 XP. Plus: review +5, quiz +25 perfect/+10 partial (once per arc), flashcard +5 per due card, badge +20 each, daily challenge +40, boss win +50/75/100 by tier (defeat +10/15/20). `awardMission` is idempotent; `recordMissionResult` (mastery) fires on **every** completion so clean replays can raise a score (best result wins).

**Snapshot changes:** additive fields are backward-compatible (`?? null`/`?? {}`/`?? []` defaults — mastery map merges to `{}`, dailyHistory to `[]` for old saves). Format changes (e.g., clicker → CLI) intentionally reset old saves — comment the reason.

**Sync merge:** every merged field is monotonic (max XP/streak/mastery, unions for missions/badges/dailyHistory, freshest flashcard schedule, best quiz). Fetch happens **before** push — a stale device that pulls and re-pushes the union never loses data.

## 5. Known environment issues

- **ESLint hangs silently** — `npm run lint` never returns/emits diagnostics in this dev machine. Use `tsc --noEmit` + `vitest` + `next build` for validation instead.
- **`next build` + `tsc` concurrently corrupt `.next/types/`** — produces stale `*. 2.ts` duplicates; `.next/` is gitignored. Run them sequentially; `rm -f '.next/types/* 2.ts'` if they appear.
- **Vitest boot is slow** — target single files (`./node_modules/.bin/vitest run lib/x.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism --no-isolate`); give the full suite a long timeout.
- **Shell env shadowing** — Next.js won't let `.env.local` override vars already exported in the shell; the dev shell here exports empty `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, which hid the sync panel until `scripts/start-dev-server.py` started purging them. If the panel shows "off", check `env | grep SUPABASE` in the launching terminal.
- **Node 20 deprecation** — supabase-js warns Node ≤20 is deprecated; upgrade to Node 22+ when convenient.
- **Repo state**: 7 commits pushed to `github.com/Hardy7dhaliwal/netquest`. `350-401-ENCORE-v1.2.pdf` and `CCNP-350-401-ENCOR-v1.2-Learning-Matrix.xlsx` (the curriculum source docs) sit untracked at the root; `.env.local` (Supabase keys) is gitignored.
- **Browser QA agent unavailable** in this environment — UI fixes are verified by code-level checks + curl of the dev server, not pixels.

## 6. Next session — priorities

1. **Deploy** — the MVP is feature-complete; put it on Vercel (or similar) and flip the Supabase Site URL / Redirect URLs to the production domain. Before public release: restore the React Flow attribution (see README known notes) and re-check the license.
2. **Full playtest pass** — desktop + mobile browser QA of every screen (missions, dashboard, gauntlet, sync panel, calendar). This has never been done end-to-end in a real browser in this environment.
3. **Content depth** — more questions per arc in the quiz/boss bank (small arcs yield short Elite battles), more flashcards per arc, and the deferred Static EtherChannel (`mode on`) troubleshooting variant.
4. **AI tutor (PRD §15)** — the last big deferred item; the rescue engine is the deterministic stand-in. Only sensible after the verified content model + deployment.
5. **Optional polish** — streak reminders (email/push when a daily challenge goes unclaimed), boss-battle leaderboard (note: the sync blob is client-controlled, so competitive features need server-side validation), and fixing the ESLint environment issue.

## 7. Deferred / open decisions

- **Quiz/flashcard content source** — RESOLVED: rescue checkpoints are the pool (`ARC_TO_MISSION` in `lib/quiz.ts`).
- **95 Under Pressure band** — RESOLVED: boss wins raise objectives to 95.
- **Auth / cross-device persistence** — DONE (Supabase magic link + RLS row + monotonic merge).
- **Sync tampering** — the cloud blob is client-controlled and unvalidated (a tampered client could inflate XP); acceptable single-player, but revisit before any leaderboard/competitive feature.
- **AI tutor** — still deferred (PRD §15); rescue engine remains the deterministic stand-in.
- **Static EtherChannel** (`mode on`) troubleshooting — explicitly skipped; add a static-mismatch variant when the arc grows.
