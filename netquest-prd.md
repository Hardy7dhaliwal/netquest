# NetQuest PRD

Version: 0.1  
Date: 2026-08-02  
Product: Interactive CCNP ENCOR learning platform  
Working name: NetQuest

## 1. Executive Summary

NetQuest is an interactive networking education platform for Cisco CCNP ENCOR preparation. It replaces passive study with visual simulations, Cisco-style CLI practice, troubleshooting missions, packet animations, spaced repetition, and AI tutoring.

The product should feel closer to Duolingo, Brilliant, Packet Tracer, and an RPG than to a traditional online course.

The initial exam target is Cisco 350-401 ENCOR, which Cisco describes as testing core enterprise network technologies including dual stack IPv4/IPv6 architecture, virtualization, infrastructure, network assurance, security, and automation. Cisco currently lists the exam as a 120-minute exam for CCNP Enterprise, CCIE Enterprise Infrastructure, and Cisco Certified Specialist - Enterprise Core credit.

Primary source references:

- Cisco 350-401 ENCOR exam page: https://www.cisco.com/site/us/en/learn/training-certifications/exams/encor.html
- Cisco ENCOR training page: https://www.cisco.com/site/us/en/learn/training-certifications/training/courses/encor.html
- Cisco current exams list: https://www.cisco.com/site/us/en/learn/training-certifications/exams/list.html
- Cisco Press Official Cert Guide: https://www.pearson.com/en-us/subject-catalog/p/ccnp-and-ccie-enterprise-core-encor-350-401-official-cert-guide/P200000011247/9780138216986

## 2. Product Vision

Build the most engaging enterprise networking learning platform on the internet.

NetQuest helps learners understand networking by doing:

- Build topologies.
- Watch packets move.
- Configure devices.
- Break and fix networks.
- Predict protocol behavior.
- Practice recall over time.
- Get coached when they make mistakes.

The long-term product vision is an AI-assisted networking lab world where users can learn, simulate, troubleshoot, and prepare for certifications and interviews.

## 3. Problem Statement

Most CCNP study resources are passive:

- Long videos.
- Dense books.
- Static diagrams.
- Multiple-choice quizzes.
- Labs that require separate tools.

This creates several learner problems:

- Learners memorize commands without understanding packet flow.
- Protocols like STP, OSPF, BGP, HSRP, and QoS feel abstract.
- Troubleshooting skill is hard to build without repeated realistic scenarios.
- Study progress is difficult to measure beyond "chapter completed."
- Learners often lack feedback that explains why an answer is wrong.

NetQuest solves this by making every concept interactive, visual, testable, and reinforced over time.

## 4. Goals

Product goals:

- Help learners pass CCNP ENCOR.
- Build practical network engineering intuition, not just exam recall.
- Make complex protocols visible through simulation and animation.
- Turn mistakes into useful feedback.
- Make daily study feel rewarding and sustainable.

Learning goals:

- Improve retention through active recall and spaced repetition.
- Improve protocol understanding through state machines and packet animation.
- Improve troubleshooting confidence through guided missions.
- Improve CLI fluency through simulated IOS-style practice.

Business goals:

- Create a product strong enough to become a paid learning platform.
- Support future certifications such as CCNA, ENARSI, SD-WAN, DevNet, and cybersecurity.
- Support eventual enterprise/team learning features.

## 5. Non-Goals

MVP non-goals:

- Full Packet Tracer replacement.
- Full IOS emulator.
- Real router/switch virtualization.
- User-generated marketplace.
- Multiplayer labs.
- Official Cisco exam dump content.
- Claims of official Cisco affiliation unless a partnership exists.

## 6. Target Users

### Persona A: Visual Beginner

Profile:

- Has basic networking knowledge.
- May not have CCNA.
- Wants CCNP ENCOR but finds textbooks overwhelming.

Needs:

- Visual explanations.
- Guided labs.
- Simpler explanations on demand.
- Confidence-building progression.

### Persona B: Working Network Engineer

Profile:

- Works with routers, switches, firewalls, or cloud networks.
- Needs structured CCNP review.

Needs:

- Practical labs.
- Troubleshooting scenarios.
- Fast review mode.
- Realistic CLI and show command outputs.

### Persona C: Interview Candidate

Profile:

- Preparing for network engineering interviews.

Needs:

- Scenario questions.
- Explain-your-thinking prompts.
- Troubleshooting drills.
- Protocol comparison exercises.

## 7. Product Principles

- Never make users read when they could interact.
- Every protocol should be visualized.
- Every major lesson should include a simulation or challenge.
- Every mistake should explain the underlying misconception.
- Lessons should be short, but practice should be deep.
- Progress should measure mastery, not page completion.
- The app should reward consistency without punishing users harshly for missing a day.
- The simulation engine should be deterministic and explainable.
- AI should coach, generate, and adapt, but core correctness should come from verified curriculum and rules.

## 8. Core Experience

The user opens the dashboard and sees:

- Current mission.
- XP and level.
- Streak.
- Weak topics.
- Recommended review.
- Daily challenge.
- Recent lab progress.

The user starts a mission:

1. Short scenario.
2. Interactive topology.
3. Prediction challenge.
4. CLI task.
5. Packet or protocol animation.
6. Troubleshooting step.
7. Mini quiz.
8. Summary.
9. Flashcards scheduled for review.

Example mission:

Title: The VLAN That Vanished  
Scenario: Sales users cannot reach their gateway after a switch upgrade.  
Skills: VLANs, trunks, native VLANs, allowed VLAN lists, show commands.  
Challenge: Inspect topology, run show commands, identify missing VLAN on trunk, fix config.  
Reward: XP, VLAN badge progress, one new flashcard, one unlocked harder mission.

## 9. MVP Scope

The MVP should prove the core learning loop.

MVP features:

- Dashboard.
- Course map.
- Mission-based lessons.
- Basic XP and level system.
- Topic mastery tracking.
- Interactive topology viewer.
- Basic drag-enabled topology nodes.
- Packet animation for ARP and ICMP.
- Basic Cisco-style CLI simulator.
- VLAN/trunk mission.
- STP root bridge prediction challenge.
- OSPF neighbor state visualizer.
- Flashcards with spaced repetition.
- AI tutor chat constrained to lesson context.
- User progress persistence.

MVP exclusions:

- Full topology builder.
- Full BGP simulation.
- Multiplayer.
- Payment system.
- Advanced analytics.
- Mobile-native app.

## 10. Course Architecture

NetQuest content should align to Cisco ENCOR topic areas and Cisco's published training objectives.

Top-level course tracks:

- Enterprise architecture.
- Switching and Layer 2.
- Routing and Layer 3.
- Redundancy and high availability.
- Virtualization and overlays.
- Wireless concepts.
- Network services.
- Network assurance.
- Security.
- Automation and programmability.

Initial MVP modules:

1. Network planes and forwarding.
2. CAM, TCAM, CEF, RIB, FIB, adjacency table.
3. VLANs and trunks.
4. STP and RSTP.
5. EtherChannel.
6. Inter-VLAN routing.
7. OSPF fundamentals.
8. HSRP/VRRP fundamentals.
9. Network assurance basics.
10. REST/JSON/Python basics.

Each module should define:

- Prerequisites.
- Learning objectives.
- Concepts.
- Required interactions.
- Labs.
- Misconceptions.
- Flashcards.
- Assessment criteria.

## 11. Learning Methodology

NetQuest uses:

- Active recall.
- Spaced repetition.
- Interleaving.
- Scenario-based learning.
- Immediate feedback.
- Mastery-based progression.
- Prediction before explanation.
- Worked examples followed by fading hints.

Mastery model:

- 0%: unseen.
- 25%: introduced.
- 50%: can recognize.
- 70%: can solve guided tasks.
- 85%: can solve independently.
- 95%: can troubleshoot under pressure.

Users should not be blocked harshly, but the app should recommend review when mastery is below threshold.

## 12. Gamification

Core mechanics:

- XP.
- Levels.
- Streaks.
- Badges.
- Topic mastery.
- Daily challenge.
- Boss battles.
- Unlockable missions.

XP sources:

- Complete lesson: 50 XP.
- Complete lab: 100 XP.
- Perfect quiz: 25 bonus XP.
- Fix troubleshooting mission: 150 XP.
- Daily challenge: 50 XP.
- Review flashcards: 5 XP each.

Badge examples:

- VLAN Initiate.
- STP Survivor.
- OSPF Neighbor.
- Packet Detective.
- CLI Apprentice.
- Troubleshooting Specialist.

Boss battle examples:

- Branch Office Down.
- The STP Loop.
- OSPF Area Mismatch.
- Gateway Redundancy Failure.
- ACL Mystery.

## 13. Simulation Engine Requirements

The simulation engine should model networking concepts at an educational level rather than emulate every IOS detail.

Core abstractions:

- Device.
- Interface.
- Link.
- Packet.
- Frame.
- Event.
- Protocol state machine.
- Routing table.
- MAC address table.
- ARP table.
- VLAN database.

Engine requirements:

- Deterministic event queue.
- Pause, play, rewind, and step controls.
- Human-readable event log.
- Packet path visualization.
- Protocol state visualization.
- Scenario seed data.
- Validation hooks for lab objectives.

Initial supported behavior:

- Ethernet frame forwarding.
- MAC learning.
- ARP request/reply.
- ICMP echo request/reply.
- VLAN membership.
- 802.1Q trunk tagging.
- STP root bridge election, simplified.
- OSPF neighbor state progression, simplified.
- HSRP active/standby election, simplified.

## 14. CLI Simulator Requirements

The CLI should feel familiar to Cisco learners without pretending to be a complete IOS implementation.

Required modes:

- User EXEC: `Router>`
- Privileged EXEC: `Router#`
- Global config: `Router(config)#`
- Interface config: `Router(config-if)#`
- Router protocol config: `Router(config-router)#`

MVP commands:

- `enable`
- `configure terminal`
- `hostname`
- `interface`
- `shutdown`
- `no shutdown`
- `show running-config`
- `show ip interface brief`
- `show vlan brief`
- `show interfaces trunk`
- `show mac address-table`
- `show spanning-tree`
- `show ip route`
- `show ip ospf neighbor`
- `ping`
- `exit`
- `end`

CLI feedback:

- Syntax hints.
- Invalid command messages.
- Context-aware autocomplete.
- Objective validation.
- Optional hint button.

## 15. AI System

AI should enhance learning but not be the source of truth for protocol correctness.

AI roles:

- Tutor: explains concepts and mistakes.
- Hint generator: gives progressive hints.
- Lab generator: creates scenario drafts.
- Quiz generator: creates practice questions from vetted objectives.
- Reviewer: checks user explanations.

AI constraints:

- Must cite internal lesson objectives or approved sources when explaining official exam scope.
- Must avoid exam dump content.
- Must not invent Cisco commands.
- Must prefer verified simulation state over free-form guesses.
- Must offer simpler explanations when requested.

Future RAG sources:

- Internal curriculum.
- Cisco public documentation.
- RFCs.
- User notes.
- Approved book references entered by the user.

## 16. Data Model

Core tables:

- `users`
- `courses`
- `modules`
- `lessons`
- `missions`
- `labs`
- `lab_steps`
- `questions`
- `flashcards`
- `user_progress`
- `user_mastery`
- `user_flashcard_reviews`
- `achievements`
- `user_achievements`
- `simulation_snapshots`
- `ai_conversations`

Important entities:

Course:

- id
- title
- certification
- version
- source_notes

Lesson:

- id
- module_id
- title
- objectives
- content_blocks
- interactions
- assessment

Mission:

- id
- title
- scenario
- topology_json
- objectives
- validation_rules
- reward_xp

User mastery:

- user_id
- topic_id
- mastery_score
- confidence
- last_practiced_at
- next_review_at

## 17. Recommended Tech Stack

Frontend:

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.

Interaction and visualization:

- React Flow for topology diagrams.
- Framer Motion for UI and packet animations.
- XState for protocol state machines.
- D3 only where graph algorithms need specialized visualization.

State:

- Zustand for client interaction state.
- Server actions or API routes for persistence.

Backend:

- Supabase or Postgres.
- Supabase Auth or Clerk.

AI:

- OpenAI API behind a provider interface.
- Prompt templates stored as versioned files.

Testing:

- Vitest for unit tests.
- Playwright for user flows and visual smoke tests.
- Simulation engine fixtures for deterministic protocol behavior.

Deployment:

- Vercel for frontend.
- Supabase for database/auth during MVP.

## 18. UX Requirements

Style:

- Dark mode first.
- Clean, focused, technical.
- Polished but not cluttered.
- Avoid giant marketing pages inside the app.
- Use visual assets and actual topology diagrams.

Layout:

- Dashboard first.
- Persistent navigation for course, labs, reviews, and stats.
- Mission workspace optimized for desktop.
- Mobile supports review, flashcards, quizzes, and lightweight lessons.

Mission workspace:

- Left: objectives and hints.
- Center: topology/simulation.
- Right or bottom: CLI and packet/event inspector.
- Top: mission progress, XP, reset, play/pause.

Accessibility:

- Keyboard-accessible controls.
- Visible focus states.
- Reduced motion mode.
- Color-blind-safe packet/status colors.
- Text alternatives for animations.

## 19. Acceptance Criteria

MVP acceptance criteria:

- User can create an account and resume progress.
- User can complete at least 5 missions.
- User can interact with a topology and watch packet movement.
- User can use CLI commands to inspect and modify lab state.
- User can answer quizzes and receive explanations.
- User can review flashcards scheduled by spaced repetition.
- System tracks mastery by topic.
- Dashboard recommends next activity based on progress.
- AI tutor can explain current lesson mistakes using context.
- Simulation engine behavior is covered by deterministic tests.

Quality criteria:

- No lesson is a wall of text.
- Every MVP module has at least one interactive element.
- Every command taught has a verification command.
- Every troubleshooting mission has symptoms, root cause, hints, and solution.
- Packet animations can be paused and inspected.

## 20. Roadmap

### Phase 1: Prototype

- Static dashboard.
- One VLAN mission.
- Basic topology renderer.
- Basic CLI shell.
- ARP/ICMP packet animation.

### Phase 2: MVP

- Auth and persistence.
- 5-10 missions.
- XP and mastery.
- Flashcards.
- AI tutor.
- Simulation test suite.

### Phase 3: Beta

- OSPF visualizer.
- STP visualizer.
- HSRP mission.
- Lab generator.
- Adaptive review.
- Better analytics.

### Phase 4: v1

- Full ENCOR course coverage.
- Robust CLI scenarios.
- Advanced troubleshooting.
- Exportable progress reports.
- Subscription/payment system.

### Phase 5: Expansion

- CCNA track.
- ENARSI track.
- Team/admin accounts.
- Instructor-created labs.
- Multiplayer troubleshooting events.

## 21. Coding-Agent Build Prompt

Use this prompt with a coding agent after creating a repository:

```text
You are building NetQuest, an interactive CCNP ENCOR learning platform.

Read netquest-prd.md as the product source of truth.
Read phase-1-spec.md as the Phase 1 implementation contract.

Build the Phase 1 prototype:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible component structure
- React Flow topology canvas
- Framer Motion packet animation
- Zustand state
- A basic Cisco-style CLI simulator

The first mission is "The VLAN That Vanished."

Required screen:

- App dashboard
- Mission workspace
- Objectives panel
- Topology canvas with 2 switches and 2 PCs
- CLI panel
- Packet/event log
- XP completion modal

Required interactions:

- User can inspect VLAN/trunk state through CLI show commands.
- User can identify that VLAN 20 is missing from a trunk.
- User can fix the issue with a simplified CLI command.
- User can send a ping and watch packet animation succeed.
- User receives XP and mission completion.

Engineering rules:

- Keep simulation logic separate from UI components.
- Write deterministic tests for VLAN/trunk validation.
- Use typed data structures for devices, interfaces, packets, VLANs, and events.
- Do not hardcode behavior directly in React components.
- Keep the prototype polished, responsive, and easy to extend.
```

## 22. Open Questions

- Final product name: NetQuest, PacketQuest, RouteQuest, or another name?
- Should MVP require login, or start as local-only?
- Should initial audience be beginners without CCNA or engineers already working in networking?
- Should the first prototype be a web app only, or desktop-friendly PWA?
- Should AI be included in MVP, or added after core simulations prove useful?
- Should curriculum follow ENCOR official guide chapter order or mission-based dependency order?
