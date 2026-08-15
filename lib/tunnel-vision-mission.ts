import { iosHelpForMode } from "./ios-help";
import { tryRunDo } from "./ios-do";
import { normalizeIosCommand } from "./ios-abbrev";

export type TunnelStatus = "not_started" | "in_progress" | "complete";
export type TunnelPhase = "vrf" | "gre" | "ipsec" | "cryptomap" | "checkpoint" | "complete";
export type TunnelCliMode = "user" | "privileged" | "config" | "config-if" | "config-vrf" | "config-isakmp" | "config-crypto-map";
export type TunnelCheckpointOption = "outer-gre" | "inner-ip" | "auto-all";

export type TunnelEvent = {
  message: string;
  tone: "info" | "success" | "error";
};

export type TunnelCliEntry = {
  input: string;
  output: string;
  prompt: string;
};

/** Phases the player can be stuck in (excludes "complete"). */
export const TUNNEL_VISION_PHASES: Exclude<TunnelPhase, "complete">[] = ["vrf", "gre", "ipsec", "cryptomap", "checkpoint"];

export type TunnelVisionMissionState = {
  status: TunnelStatus;
  phase: TunnelPhase;
  cliMode: TunnelCliMode;
  cliHistory: TunnelCliEntry[];
  // vrf phase
  vrfDefined: boolean;
  vrfForwarded: boolean;
  ipReadded: boolean;
  vrfVerified: boolean;
  // gre phase
  tunnelIpSet: boolean;
  tunnelSourceSet: boolean;
  tunnelDestSet: boolean;
  tunnelModeSet: boolean;
  tunnelVerified: boolean;
  // ipsec phase
  encSet: boolean;
  authSet: boolean;
  hashSet: boolean;
  groupSet: boolean;
  keySet: boolean;
  transformSet: boolean;
  // cryptomap phase
  aclSet: boolean;
  peerSet: boolean;
  tsSet: boolean;
  matchSet: boolean;
  mapAppliedSet: boolean;
  ipsecVerified: boolean;
  selectedCheckpoint: TunnelCheckpointOption | null;
  attempts: number;
  eventLog: TunnelEvent[];
};

export const TUNNEL_EXPECTED = {
  checkpoint: "outer-gre",
} as const;

export const INITIAL_TUNNEL_VISION_MISSION: TunnelVisionMissionState = {
  status: "not_started",
  phase: "vrf",
  cliMode: "user",
  cliHistory: [],
  vrfDefined: false,
  vrfForwarded: false,
  ipReadded: false,
  vrfVerified: false,
  tunnelIpSet: false,
  tunnelSourceSet: false,
  tunnelDestSet: false,
  tunnelModeSet: false,
  tunnelVerified: false,
  encSet: false,
  authSet: false,
  hashSet: false,
  groupSet: false,
  keySet: false,
  transformSet: false,
  aclSet: false,
  peerSet: false,
  tsSet: false,
  matchSet: false,
  mapAppliedSet: false,
  ipsecVerified: false,
  selectedCheckpoint: null,
  attempts: 0,
  eventLog: [],
};

const INVALID = "% Invalid input detected at '^' marker.";

export function tunnelPromptFor(mode: TunnelCliMode) {
  if (mode === "user") return "R-BR>";
  if (mode === "privileged") return "R-BR#";
  if (mode === "config") return "R-BR(config)#";
  if (mode === "config-if") return "R-BR(config-if)#";
  if (mode === "config-vrf") return "R-BR(config-vrf)#";
  if (mode === "config-isakmp") return "R-BR(config-isakmp)#";
  return "R-BR(config-crypto-map)#";
}

export function vrfDone(state: TunnelVisionMissionState) {
  return state.vrfDefined && state.vrfForwarded && state.ipReadded && state.vrfVerified;
}

export function greDone(state: TunnelVisionMissionState) {
  return state.tunnelIpSet && state.tunnelSourceSet && state.tunnelDestSet && state.tunnelModeSet && state.tunnelVerified;
}

export function isakmpDone(state: TunnelVisionMissionState) {
  return state.encSet && state.authSet && state.hashSet && state.groupSet && state.keySet && state.transformSet;
}

export function cryptoMapDone(state: TunnelVisionMissionState) {
  return state.aclSet && state.peerSet && state.tsSet && state.matchSet && state.mapAppliedSet && state.ipsecVerified;
}

export function resetTunnelVisionMission(): TunnelVisionMissionState {
  return { ...INITIAL_TUNNEL_VISION_MISSION, cliHistory: [], eventLog: [] };
}

export function startTunnelVisionMission(): TunnelVisionMissionState {
  return {
    ...resetTunnelVisionMission(),
    status: "in_progress",
    eventLog: [
      { message: "Mission started. The branch talks to HQ across the internet in plaintext — anyone on the path can read it — and guest traffic shares the corporate segment. Build the isolation and the secure overlay.", tone: "info" },
    ],
  };
}

function recordChoice(
  state: TunnelVisionMissionState,
  message: string,
  tone: TunnelEvent["tone"],
  updates: Partial<TunnelVisionMissionState> = {},
): TunnelVisionMissionState {
  return {
    ...state,
    ...updates,
    attempts: state.attempts + 1,
    eventLog: [...state.eventLog, { message, tone }],
  };
}

function showVrfBrief(): string {
  return [
    "Name                             Default RD          Protocols     Interfaces",
    "GUEST                            65000:20            ipv4          Gi0/1",
  ].join("\n");
}

function showTunnel(): string {
  return [
    "Tunnel0 is up, line protocol is up",
    "  Hardware is Tunnel",
    "  Internet address is 10.99.0.2/30",
    "  MTU 1476 bytes, BW 100 Kbit/sec, DLY 50000 usec",
    "     reliability 255/255, txload 1/255, rxload 1/255",
    "  Encapsulation TUNNEL, loopback not set",
    "  Keepalive not set",
    "  Tunnel source 198.51.100.2 (GigabitEthernet0/0), destination 203.0.113.1",
    "  Tunnel protocol/transport GRE/IP",
  ].join("\n");
}

function showCryptoIpsecSa(): string {
  return [
    "interface: GigabitEthernet0/0",
    "    Crypto map tag: CMAP, local addr 198.51.100.2",
    "",
    "   protected vrf: (none)",
    "   local ident (addr/mask/prot/port): (198.51.100.2/255.255.255.255/47/0)",
    "   remote ident (addr/mask/prot/port): (203.0.113.1/255.255.255.255/47/0)",
    "   current_peer 203.0.113.1 port 500",
    "     PERMIT, flags={origin_is_acl,}",
    "   #pkts encaps: 24, #pkts encrypt: 24, #pkts digest: 24",
    "   #pkts decaps: 24, #pkts decrypt: 24, #pkts verify: 24",
    "   local crypto endpt.: 198.51.100.2, remote crypto endpt.: 203.0.113.1",
    "   path mtu 1500, ip mtu 1500",
    "   current outbound spi: 0x8D72E11B(2372252955)",
    "   PFS (Y/N): N, DH group: none",
    "",
    "   inbound esp sas:",
    "      spi: 0x3A1F9C44(975296580)",
    "      transform: esp-256-aes esp-sha-hmac",
    "      in use settings ={Tunnel, }",
    "      conn id: 2003, flow_id: CSR:3, status: ACTIVE(ACTIVE)",
    "",
    "   outbound esp sas:",
    "      spi: 0x8D72E11B(2372252955)",
    "      transform: esp-256-aes esp-sha-hmac",
    "      in use settings ={Tunnel, }",
    "      conn id: 2004, flow_id: CSR:4, status: ACTIVE(ACTIVE)",
  ].join("\n");
}

export function runTunnelCommand(state: TunnelVisionMissionState, rawCommand: string): TunnelVisionMissionState {
  const command = normalizeIosCommand(rawCommand);
  const cliPhase = state.phase === "vrf" || state.phase === "gre" || state.phase === "ipsec" || state.phase === "cryptomap";
  if (!command || state.status === "complete" || !cliPhase) return state;

  const didDo = tryRunDo(state, rawCommand, tunnelPromptFor(state.cliMode), runTunnelCommand);
  if (didDo) return didDo;

  let output = "";
  let nextMode = state.cliMode;
  let next = state;

  if (command === "?") {
    output = iosHelpForMode(state.cliMode);
  } else if (command === "help") {
    output =
      state.phase === "vrf"
        ? "Commands: enable, configure terminal, vrf definition GUEST, rd 65000:20, interface gi0/1, vrf forwarding GUEST, ip address 192.168.20.1 255.255.255.0, show vrf brief, end, exit, help"
        : state.phase === "gre"
          ? "Commands: enable, configure terminal, interface tunnel 0, ip address 10.99.0.2 255.255.255.252, tunnel source gi0/0, tunnel destination 203.0.113.1, tunnel mode gre ip, show interface tunnel 0, end, exit, help"
          : state.phase === "ipsec"
            ? "Commands: enable, configure terminal, crypto isakmp policy 10, encryption aes 256, authentication pre-share, hash sha256, group 14, crypto isakmp key c1scoHQ address 203.0.113.1, crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac, end, exit, help"
            : "Commands: enable, configure terminal, access-list 101 permit gre host 198.51.100.2 host 203.0.113.1, crypto map CMAP 10 ipsec-isakmp, set peer 203.0.113.1, set transform-set TS, match address 101, interface gi0/0, crypto map CMAP, show crypto isakmp sa, show crypto ipsec sa, end, exit, help";
  } else if (command === "end") {
    nextMode = "privileged";
  } else if (command === "exit") {
    nextMode =
      state.cliMode === "config-if" || state.cliMode === "config-vrf" || state.cliMode === "config-isakmp" || state.cliMode === "config-crypto-map"
        ? "config"
        : state.cliMode === "config"
          ? "privileged"
          : "user";
  } else if (state.cliMode === "user" && command === "enable") {
    nextMode = "privileged";
  } else if (state.cliMode === "privileged" && (command === "configure terminal" || command === "conf t")) {
    nextMode = "config";
    output = "Enter configuration commands, one per line. End with CNTL/Z.";
  } else if (state.phase === "vrf" && state.cliMode === "config" && command === "vrf definition guest") {
    nextMode = "config-vrf";
  } else if (state.phase === "vrf" && state.cliMode === "config-vrf" && command === "rd 65000:20") {
    output = state.vrfDefined ? "Route distinguisher already set." : "Route distinguisher 65000:20 set for VRF GUEST.";
    next = { ...state, vrfDefined: true };
  } else if (state.phase === "vrf" && state.cliMode === "config" && command === "interface gi0/1") {
    nextMode = "config-if";
  } else if (state.phase === "vrf" && state.cliMode === "config-if" && command === "vrf forwarding guest") {
    if (state.vrfForwarded) {
      output = "Gi0/1 is already bound to VRF GUEST.";
    } else {
      output = "% Interface GigabitEthernet0/1 IPv4 disabled and address(es) removed due to enabling VRF GUEST\nRestore the address inside the VRF: ip address 192.168.20.1 255.255.255.0";
      next = { ...state, vrfForwarded: true, ipReadded: false };
    }
  } else if (state.phase === "vrf" && state.cliMode === "config-if" && command === "ip address 192.168.20.1 255.255.255.0") {
    if (!state.vrfForwarded) {
      output = "Apply vrf forwarding GUEST first — it strips the port's IP address, so set it after.";
    } else {
      output = state.ipReadded ? "Address already restored in VRF GUEST." : "Address 192.168.20.1/24 restored inside VRF GUEST.";
      next = { ...state, ipReadded: true };
    }
  } else if (state.phase === "vrf" && state.cliMode === "privileged" && command === "show vrf brief") {
    if (state.vrfDefined && state.vrfForwarded && state.ipReadded) {
      output = showVrfBrief();
      next = { ...state, vrfVerified: true };
    } else {
      output = "GUEST is incomplete.\nDefine it (vrf definition GUEST, rd 65000:20), bind Gi0/1 (vrf forwarding GUEST), and restore its IP address first.";
    }
  } else if (state.phase === "gre" && state.cliMode === "config" && command === "interface tunnel 0") {
    nextMode = "config-if";
  } else if (state.phase === "gre" && state.cliMode === "config-if" && command === "ip address 10.99.0.2 255.255.255.252") {
    output = state.tunnelIpSet ? "Tunnel IP already set." : "Tunnel0 now has 10.99.0.2/30.";
    next = { ...state, tunnelIpSet: true };
  } else if (state.phase === "gre" && state.cliMode === "config-if" && command === "tunnel source gi0/0") {
    output = state.tunnelSourceSet ? "Tunnel source already set." : "Tunnel source set to GigabitEthernet0/0 (198.51.100.2).";
    next = { ...state, tunnelSourceSet: true };
  } else if (state.phase === "gre" && state.cliMode === "config-if" && command === "tunnel destination 203.0.113.1") {
    output = state.tunnelDestSet ? "Tunnel destination already set." : "Tunnel destination set to HQ at 203.0.113.1.";
    next = { ...state, tunnelDestSet: true };
  } else if (state.phase === "gre" && state.cliMode === "config-if" && command === "tunnel mode gre ip") {
    output = state.tunnelModeSet ? "Tunnel mode already GRE/IP." : "Tunnel mode set to GRE over IPv4.";
    next = { ...state, tunnelModeSet: true };
  } else if (state.phase === "gre" && state.cliMode === "privileged" && command === "show interface tunnel 0") {
    if (!(state.tunnelIpSet && state.tunnelSourceSet && state.tunnelDestSet && state.tunnelModeSet)) {
      output = "Tunnel0 is down, line protocol is down\nConfigure ip address, tunnel source, tunnel destination, and tunnel mode gre ip first.";
    } else {
      output = showTunnel();
      next = { ...state, tunnelVerified: true };
    }
  } else if (state.phase === "ipsec" && state.cliMode === "config" && command === "crypto isakmp policy 10") {
    nextMode = "config-isakmp";
  } else if (state.phase === "ipsec" && state.cliMode === "config-isakmp" && command === "encryption aes 256") {
    output = "ISAKMP policy 10 will use AES-256.";
    next = { ...state, encSet: true };
  } else if (state.phase === "ipsec" && state.cliMode === "config-isakmp" && command === "authentication pre-share") {
    output = "ISAKMP policy 10 will authenticate with pre-shared keys.";
    next = { ...state, authSet: true };
  } else if (state.phase === "ipsec" && state.cliMode === "config-isakmp" && command === "hash sha256") {
    output = "ISAKMP policy 10 will use SHA-256 integrity.";
    next = { ...state, hashSet: true };
  } else if (state.phase === "ipsec" && state.cliMode === "config-isakmp" && command === "group 14") {
    output = "ISAKMP policy 10 will use Diffie-Hellman group 14.";
    next = { ...state, groupSet: true };
  } else if (state.phase === "ipsec" && state.cliMode === "config" && command === "crypto isakmp key c1scohq address 203.0.113.1") {
    output = state.keySet ? "Pre-shared key already set for 203.0.113.1." : "Pre-shared key configured for the HQ peer 203.0.113.1.";
    next = { ...state, keySet: true };
  } else if (state.phase === "ipsec" && state.cliMode === "config" && command === "crypto ipsec transform-set ts esp-aes 256 esp-sha-hmac") {
    output = state.transformSet ? "Transform set TS already defined." : "Transform set TS created: esp-aes 256 with esp-sha-hmac integrity.";
    next = { ...state, transformSet: true };
  } else if (state.phase === "cryptomap" && state.cliMode === "config" && command === "access-list 101 permit gre host 198.51.100.2 host 203.0.113.1") {
    output = state.aclSet ? "ACL 101 already permits GRE to HQ." : "ACL 101 permits GRE (protocol 47) from R-BR to the HQ WAN address.";
    next = { ...state, aclSet: true };
  } else if (state.phase === "cryptomap" && state.cliMode === "config" && command === "crypto map cmap 10 ipsec-isakmp") {
    nextMode = "config-crypto-map";
  } else if (state.phase === "cryptomap" && state.cliMode === "config-crypto-map" && command === "set peer 203.0.113.1") {
    output = state.peerSet ? "Peer already set." : "Crypto map CMAP will tunnel to peer 203.0.113.1.";
    next = { ...state, peerSet: true };
  } else if (state.phase === "cryptomap" && state.cliMode === "config-crypto-map" && command === "set transform-set ts") {
    output = state.tsSet ? "Transform set already referenced." : "Crypto map CMAP will use transform set TS.";
    next = { ...state, tsSet: true };
  } else if (state.phase === "cryptomap" && state.cliMode === "config-crypto-map" && command === "match address 101") {
    output = state.matchSet ? "Match already set." : "Crypto map CMAP protects the traffic ACL 101 matches.";
    next = { ...state, matchSet: true };
  } else if (state.phase === "cryptomap" && state.cliMode === "config" && command === "interface gi0/0") {
    nextMode = "config-if";
  } else if (state.phase === "cryptomap" && state.cliMode === "config-if" && command === "crypto map cmap") {
    output = state.mapAppliedSet ? "Crypto map already applied." : "Crypto map CMAP applied to the WAN interface GigabitEthernet0/0.";
    next = { ...state, mapAppliedSet: true };
  } else if (state.phase === "cryptomap" && state.cliMode === "privileged" && command === "show crypto ipsec sa") {
    if (!(state.aclSet && state.peerSet && state.tsSet && state.matchSet && state.mapAppliedSet)) {
      output = "No active SA — complete the crypto map (ACL 101, set peer, set transform-set, match address) and apply it to the WAN interface first.";
    } else {
      output = showCryptoIpsecSa();
      next = { ...state, ipsecVerified: true };
    }
  } else if (state.phase === "cryptomap" && state.cliMode === "privileged" && command === "show crypto isakmp sa") {
    if (!(state.aclSet && state.peerSet && state.tsSet && state.matchSet && state.mapAppliedSet)) {
      output = "No ISAKMP SA yet — phase 1 only establishes once the crypto map is complete and applied to the WAN interface. Finish the map first.";
    } else {
      output = [
        "IPv4 Crypto ISAKMP SA",
        "dst             src             state          conn-id status",
        "203.0.113.1     198.51.100.2     QM_IDLE             2003 ACTIVE",
        "",
        "IPv6 Crypto ISAKMP SA",
      ].join("\n");
    }
  } else if (state.phase === "cryptomap" && (command === "show crypto ipsec sa" || command === "show crypto isakmp sa")) {
    output = "Type end to return to privileged EXEC, then run the show command.";
  } else if (state.phase === "cryptomap" && state.cliMode === "config-if" && command.startsWith("access-list")) {
    output = "Access lists are global commands — exit to global configuration (exit) first, then enter the ACL.";
  } else {
    output = INVALID;
  }

  const history = [...state.cliHistory, { input: rawCommand, output, prompt: tunnelPromptFor(state.cliMode) }];

  if (next.phase === "vrf" && vrfDone(next)) {
    return {
      ...next,
      phase: "gre",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "GUEST is isolated in its own routing table — guest traffic no longer shares the corporate segment. Next: the GRE tunnel that carries the overlay.", tone: "success" },
      ],
    };
  }

  if (next.phase === "gre" && greDone(next)) {
    return {
      ...next,
      phase: "ipsec",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "Tunnel0 is up — the private overlay can cross the internet, but it is still plaintext inside the tunnel. Next: encrypt it with IPsec.", tone: "success" },
      ],
    };
  }

  if (next.phase === "ipsec" && isakmpDone(next)) {
    return {
      ...next,
      phase: "cryptomap",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "IKE phase 1 is configured — the peers can negotiate. Next: the crypto map that decides WHAT gets encrypted and locks it to the WAN interface.", tone: "success" },
      ],
    };
  }

  if (next.phase === "cryptomap" && cryptoMapDone(next)) {
    return {
      ...next,
      phase: "checkpoint",
      cliMode: "user",
      cliHistory: history,
      eventLog: [
        ...state.eventLog,
        { message: "The crypto map is live — GRE traffic is encrypted end to end. One last check: what exactly does the map protect?", tone: "success" },
      ],
    };
  }

  return { ...next, cliMode: nextMode, cliHistory: history, eventLog: state.eventLog };
}

export function chooseCheckpoint(state: TunnelVisionMissionState, selectedCheckpoint: TunnelCheckpointOption): TunnelVisionMissionState {
  if (state.status === "complete" || state.phase !== "checkpoint") return state;

  return selectedCheckpoint === TUNNEL_EXPECTED.checkpoint
    ? recordChoice(
        state,
        "Correct. With GRE-over-IPsec, the crypto map's ACL matches the GRE flow (protocol 47) between the WAN endpoints — so IPsec encrypts the whole tunnel. The inner private IPs ride safely inside the encrypted GRE payload.",
        "success",
        { phase: "complete", status: "complete", selectedCheckpoint },
      )
    : recordChoice(
        state,
        selectedCheckpoint === "inner-ip"
          ? "Matching the inner private subnets is the pattern for plain crypto-map VPNs without GRE. Here the encapsulated traffic IS GRE — the ACL must match the GRE flow between the WAN IPs."
          : "A crypto map protects only the traffic its ACL matches — nothing is automatic. Without the right match, the tunnel stays plaintext.",
        "error",
        { selectedCheckpoint },
      );
}
