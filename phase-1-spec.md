# NetQuest Phase 1 Spec

Version: 0.1
Date: 2026-08-02
Source PRD: `netquest-prd.md`

## 1. Purpose

Phase 1 proves the core NetQuest loop with one polished prototype mission:

1. Read a short network outage scenario.
2. Inspect a topology.
3. Use Cisco-style CLI commands.
4. Find that VLAN 20 is missing from a trunk.
5. Fix the trunk.
6. Send a ping.
7. Watch packet flow succeed.
8. Receive XP and completion feedback.

This phase is local-only. No auth, database, payments, AI tutor, full course map, or real IOS emulation.

## 2. Experience Requirement

Phase 1 should feel like a playable learning mission, not a static lab worksheet. The user should receive narrative context, visible progress, immediate feedback, packet animation, XP reward, and a clear sense of accomplishment after fixing the network.

The prototype must teach CCNP ENCOR concepts through interaction first: inspect, predict, configure, verify, and watch the network behavior change.

## 3. Target Build

Build a desktop-first web prototype using:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible component structure
- React Flow for topology
- Framer Motion for packet animation
- Zustand for client state
- Vitest for simulation and CLI tests

Keep simulation logic outside React components.

## 4. Required Screens

### Dashboard

The dashboard is the first screen.

Required content:

- Product name: NetQuest
- Current mission card: The VLAN That Vanished
- XP summary
- Level summary
- Streak summary
- Weak topic summary: VLANs and trunks
- Button to start or resume the mission

The dashboard can use static data.

### Mission Workspace

The mission workspace contains:

- Top bar with mission title, XP reward, reset button, and progress state
- Left panel with scenario, objectives, hints, and completion checklist
- Center topology canvas
- Right or bottom CLI panel
- Event log
- Packet animation controls: send ping, pause/play, step/reset if simple to support
- Completion modal or panel after success

## 5. First Mission

Title: The VLAN That Vanished

Scenario:

Sales users on VLAN 20 cannot reach their gateway after a switch upgrade. The access port and gateway are configured, but traffic crossing the inter-switch trunk is failing.

Topology:

- PC-Sales
- SW1
- SW2
- GW1

Links:

- PC-Sales to SW1 access port in VLAN 20
- SW1 to SW2 trunk
- SW2 to GW1 access or routed edge for the simplified gateway path

Root cause:

- VLAN 20 is missing from the allowed VLAN list on the SW1 to SW2 trunk.

Expected fix:

- User enters a simplified CLI command that allows VLAN 20 on the trunk.

Success condition:

- `ping 10.20.0.1` succeeds after the trunk allows VLAN 20.

## 6. Mission Objectives

Required objectives:

- Inspect VLAN state.
- Inspect trunk state.
- Identify that VLAN 20 is blocked on the trunk.
- Apply the trunk fix.
- Verify the fix with a ping.

Optional hints:

1. Check whether the access VLAN exists.
2. Check the trunk allowed VLAN list.
3. VLAN 20 must be allowed between SW1 and SW2.

## 7. CLI Scope

The CLI only needs enough behavior for the first mission.

Required modes:

- `SW1>`
- `SW1#`
- `SW1(config)#`
- `SW1(config-if)#`

Required commands:

- `enable`
- `configure terminal`
- `interface g0/1`
- `switchport trunk allowed vlan add 20`
- `show vlan brief`
- `show interfaces trunk`
- `show running-config`
- `ping 10.20.0.1`
- `exit`
- `end`
- `help` or `?`

Invalid commands should return a Cisco-like error without crashing.

## 8. Simulation Rules

Initial state:

- VLAN 10 exists.
- VLAN 20 exists.
- PC-Sales is in VLAN 20.
- SW1 to SW2 trunk allows VLAN 10 only.
- Gateway IP is `10.20.0.1`.
- PC-Sales IP is `10.20.0.10`.

Before fix:

- Ping fails.
- Event log shows VLAN 20 is not allowed on the trunk.
- Packet animation stops at the trunk.

After fix:

- SW1 to SW2 trunk allows VLAN 10 and VLAN 20.
- Ping succeeds.
- Packet animation travels from PC-Sales to GW1 and back.
- Mission completion is unlocked.

The simulation should be deterministic from a static initial state.

## 9. State Model

Minimum client state:

- Current screen: dashboard or mission
- Mission status: not started, in progress, fixed, complete
- CLI mode
- CLI history
- Selected device
- Trunk allowed VLANs
- Last ping result
- Event log
- Packet animation status
- XP earned

## 10. Event Log

Required events:

- Mission started
- User inspected VLANs
- User inspected trunk
- Ping attempted before fix
- Ping failed because VLAN 20 is missing from trunk
- VLAN 20 added to trunk
- Ping attempted after fix
- Ping succeeded
- Mission completed

## 11. Acceptance Criteria

Phase 1 is complete when:

- Dashboard renders as the first screen.
- User can open The VLAN That Vanished.
- Topology shows PC-Sales, SW1, SW2, and GW1.
- User can run the required show commands.
- Pre-fix ping fails for the correct reason.
- User can add VLAN 20 to the trunk from CLI.
- Post-fix ping succeeds.
- Packet animation visibly changes between failed and successful ping.
- Event log explains each major step.
- Completion feedback awards XP.
- Simulation and CLI behavior have deterministic unit tests.

## 12. Test Cases

Required Vitest coverage:

- Initial trunk does not allow VLAN 20.
- Ping fails before VLAN 20 is allowed.
- CLI command adds VLAN 20 to the trunk.
- Ping succeeds after VLAN 20 is allowed.
- Invalid command returns an error and preserves state.
- Mission completion triggers only after successful post-fix ping.

## 13. Explicit Non-Goals

Do not build these in Phase 1:

- Login
- Database persistence
- AI tutor
- Flashcards
- Full course map
- STP visualizer
- OSPF visualizer
- Real router or switch emulation
- Payment or subscription features
- User-created topologies
