# NetQuest ENCOR v1.2 Curriculum Blueprint

Version: 0.1  
Date: 2026-08-05  
Source documents:

- `netquest-prd.md`
- `phase-1-spec.md`
- `350-401-ENCORE-v1.2.pdf`
- `CCNP-350-401-ENCOR-v1.2-Learning-Matrix.xlsx`

## Purpose

This document is the curriculum source of truth for building NetQuest toward Cisco 350-401 ENCOR v1.2 coverage. It is a coverage plan, not a promise that completing the app alone guarantees a passing exam result. Cisco objectives and exam versions can change; the blueprint must be reviewed against Cisco's current official exam page before each major release.

NetQuest must teach the objectives through verified explanations, deterministic simulations, CLI practice, prediction challenges, troubleshooting, quizzes, and spaced-repetition cards. It must not reproduce exam dumps or imply Cisco affiliation.

## ENCOR v1.2 Domain Weights

| Domain | Weight | NetQuest learning emphasis |
| --- | ---: | --- |
| 1. Architecture | 15% | Design tradeoffs, HA, SD-WAN, SD-Access, QoS |
| 2. Virtualization | 10% | Device, data-path, and network virtualization |
| 3. Infrastructure | 30% | Layer 2, Layer 3, and IP services; largest track |
| 4. Network Assurance | 10% | Diagnosis, telemetry, capture, probes, and controller workflows |
| 5. Security | 20% | Access control, infrastructure protection, API security, and design |
| 6. Automation | 15% | Python, JSON, YANG, APIs, EEM, and orchestration |

The application should allocate assessment opportunities approximately in proportion to these weights, while still enforcing prerequisites. Infrastructure should receive the largest number of labs because it is the largest exam domain and supports many other skills.

## Objective Coverage Inventory

The labels below are transcribed from the v1.2 learning matrix. Each objective must eventually map to at least one lesson, one active interaction, one assessment item, and one review card or misconception note.

### 1. Architecture — 15%

- Enterprise design principles: two-tier, three-tier, fabric, and cloud
- High availability: redundancy, FHRP, and SSO
- Catalyst SD-WAN control-plane and data-plane elements
- Benefits and limitations of Catalyst SD-WAN
- SD-Access control-plane and data-plane elements
- Traditional campus interoperability with SD-Access
- QoS configurations

### 2. Virtualization — 10%

- Type 1 and Type 2 hypervisors
- Virtual machines
- Virtual switching
- VRF
- GRE and IPsec tunneling
- LISP
- VXLAN

### 3. Infrastructure — 30%

#### Layer 2

- Static and dynamic 802.1Q trunking troubleshooting
- Static and dynamic EtherChannel troubleshooting
- RSTP and MST configuration and verification
- STP enhancements including root guard and BPDU guard

#### Layer 3

- EIGRP versus OSPF: architecture, load balancing, path selection, operations, and metrics
- Simple OSPF: multiple normal areas, summarization, filtering, adjacency, point-to-point and broadcast network types, passive interfaces
- Directly connected eBGP: neighbor relationships and best-path selection
- Policy-Based Routing

#### IP Services

- NTP and PTP configuration interpretation
- NAT/PAT configuration and verification
- HSRP and VRRP
- Multicast concepts: RPF, PIM, and IGMPv2/v3

### 4. Network Assurance — 10%

- Debugs and conditional debugs
- Traceroute and ping diagnosis
- SNMP and syslog
- Flexible NetFlow
- SPAN, RSPAN, and ERSPAN
- IP SLA
- Cisco Catalyst Center (formerly DNA Center) workflows for configuration, monitoring, and management, including AI-powered workflows
- NETCONF and RESTCONF

### 5. Security — 20%

- Device access control: lines and local user authentication
- AAA authentication and authorization
- Infrastructure security features including ACLs and CoPP
- REST API security
- Security design components
- Endpoint security
- Next-generation firewalls
- TrustSec and MACsec

### 6. Automation and Artificial Intelligence — 15%

- Basic Python components and scripts
- Valid JSON files
- Data-modeling concepts and YANG
- Cisco Catalyst Center and SD-WAN Manager (formerly vManage) APIs
- REST API response codes and payload interpretation using Cisco Catalyst Center and RESTCONF
- EEM applets for configuration, troubleshooting, and data collection
- Agent versus agentless orchestration (concept-level comparison)

## Phase 2 Mission Arcs

Phase 2 should launch with ten mission arcs. A mission arc is not one screen: it is a short sequence of interactive scenes, CLI tasks, prediction checks, a mini-quiz, and review cards. This preserves the PRD's 5–10 mission target while providing enough content breadth to cover the full v1.2 blueprint progressively.

| # | Mission arc | Primary domains | Interactive centerpiece | Main objective coverage |
| ---: | --- | --- | --- | --- |
| 1 | The VLAN That Vanished | Infrastructure | CLI troubleshooting and packet path | 802.1Q trunking; existing Phase 1 foundation |
| 2 | The STP Storm | Infrastructure | Root election and blocked-port prediction | RSTP, MST, root guard, BPDU guard |
| 3 | The Bundled Bottleneck | Infrastructure | Build and troubleshoot an EtherChannel | Static/dynamic EtherChannel |
| 4 | Area Zero Hero | Infrastructure | OSPF neighbor state machine | OSPF adjacency, areas, network types, passive interfaces, filtering, summarization |
| 5 | The Edge Has Opinions | Infrastructure | Route-choice prediction and repair | EIGRP/OSPF comparison, eBGP, PBR |
| 6 | Gateway at Dawn | Infrastructure + Architecture | HA failover simulation | HSRP/VRRP, redundancy, SSO, NAT/PAT, NTP/PTP |
| 7 | The Overlay Heist | Architecture + Virtualization | Choose and trace an overlay path | SD-WAN, SD-Access, VRF, GRE/IPsec, LISP, VXLAN, virtual switching |
| 8 | The Signal Detective | Network Assurance | Diagnose evidence from tools and telemetry | ping, traceroute, debug, SNMP, syslog, NetFlow, SPAN/RSPAN/ERSPAN, IP SLA, Catalyst Center, NETCONF/RESTCONF |
| 9 | Lock the Control Plane | Security | Secure a compromised branch | local access, AAA, ACLs, CoPP, REST API security, endpoint security, NGFW, TrustSec, MACsec |
| 10 | Automator Prime | Automation and AI | Repair a network using data and code | Python, JSON, YANG, Catalyst Center/SD-WAN Manager APIs, REST responses, EEM, agent vs agentless orchestration |

## Required Content Per Mission Arc

Every mission arc must contain:

1. **Scenario** — a short operational incident or design decision.
2. **Concept reveal** — less than one screen of explanation before interaction.
3. **Prediction** — the learner commits to an outcome before seeing the simulation.
4. **Hands-on interaction** — topology, packet path, state machine, CLI, API payload, or code editor.
5. **Verification** — a command, observation, or test that proves the change.
6. **Misconception feedback** — explain why the wrong action failed.
7. **Mini-quiz** — deterministic questions tied to the objective labels.
8. **Review cards** — at least three cards tagged to the mission's topics.
9. **Mastery update** — topic-level score based on independent success, hints, retries, and quiz performance.
10. **Completion summary** — skills practiced, common mistakes, XP, and next recommended activity.

## Mastery and Exam Coverage Rules

- Track mastery by objective/topic, not only by mission completion.
- A completed mission marks a topic as introduced or practiced; it does not automatically mark mastery as exam-ready.
- Suggested mastery bands follow the PRD: 0% unseen, 25% introduced, 50% recognized, 70% guided, 85% independent, 95% troubleshooting under pressure.
- A domain is not considered covered until every objective has at least one interactive activity and assessment item.
- A topic should require success without a hint at least once before reaching the independent band.
- Mixed review and boss battles should combine objectives from multiple domains after the learner completes the relevant arcs.
- Exam-readiness reporting should show uncovered objectives, weak objectives, and confidence separately from XP.

## Suggested Assessment Distribution

Use the exam weights as a planning guide, not as an exact prediction of Cisco's scored item distribution:

- Architecture: 15% of objective-linked assessment opportunities
- Virtualization: 10%
- Infrastructure: 30%
- Network Assurance: 10%
- Security: 20%
- Automation: 15%

Each objective should have multiple item forms over time:

- Recall card
- Explain-the-output question
- Prediction question
- Configuration or code task
- Troubleshooting task

## Phase Boundaries

### Phase 2 MVP

- Auth and cross-device persistence
- The ten mission arcs above, delivered incrementally
- Objective-linked content catalog
- Deterministic simulation fixtures for supported protocols
- Quizzes and flashcards
- Topic mastery and dashboard recommendations
- First constrained tutor experience only after the verified content model exists

### Later Beta

- Deeper OSPF, STP, and HSRP visualizers
- More mission variants per objective
- Adaptive review and richer analytics
- Lab generation from vetted templates
- More complete assurance, security, and automation sandboxes

### Explicit limits

NetQuest is an educational simulator, not an IOS emulator, Packet Tracer replacement, official Cisco product, or guarantee of exam success. Users should pair it with Cisco's current blueprint, official training/documentation, and realistic practice.
