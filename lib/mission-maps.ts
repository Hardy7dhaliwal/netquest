/**
 * Static "network map" data for missions that require typing exact values
 * (IPs, subnets, peers). The player should never have to guess an address —
 * every value they must type is visible on the map. Coordinates are in a
 * 0–100 percent space and are rendered by components/network-map.tsx.
 */
export type MapDeviceKind = "pc" | "switch" | "router";

export type MapDevice = {
  id: string;
  kind: MapDeviceKind;
  /** Short label shown under the icon, e.g. "R1 · core". */
  label: string;
  /** Address/role line, e.g. "10.0.2.1 · Gi0/1". */
  detail: string;
  x: number;
  y: number;
};

export type MapLink = {
  from: string;
  to: string;
  label: string;
  dashed?: boolean;
};

export type MissionMap = {
  devices: MapDevice[];
  links: MapLink[];
};

export const MISSION_MAPS: Record<string, MissionMap> = {
  // ─── Area Zero Hero (OSPF) ─────────────────────────────────────────────
  "area-zero-hero": {
    devices: [
      { id: "r1", kind: "router", label: "R1 · core", detail: "10.0.2.1 · Gi0/1 · area 0", x: 16, y: 50 },
      { id: "r2", kind: "router", label: "R2 · dist", detail: "10.0.2.2 · Gi0/1 · ABR", x: 48, y: 50 },
      { id: "area1", kind: "switch", label: "Area 1 campus", detail: "172.16.0.0/22 · 24 × /30", x: 84, y: 26 },
      { id: "lab", kind: "pc", label: "Lab", detail: "192.168.50.0/24", x: 84, y: 78 },
    ],
    links: [
      { from: "r1", to: "r2", label: "10.0.2.0/24 · area 0" },
      { from: "r2", to: "area1", label: "172.16.0.0/22 · area 1" },
      { from: "r2", to: "lab", label: "192.168.50.0/24 · filter out", dashed: true },
    ],
  },

  // ─── Tunnel Vision (VRF / GRE / IPsec) ─────────────────────────────────
  "tunnel-vision": {
    devices: [
      { id: "guest", kind: "pc", label: "Guests", detail: "192.168.20.0/24", x: 16, y: 18 },
      { id: "rbranch", kind: "router", label: "R-BR · branch", detail: "WAN 198.51.100.2", x: 20, y: 62 },
      { id: "internet", kind: "router", label: "Internet", detail: "transit path", x: 52, y: 62 },
      { id: "hq", kind: "router", label: "HQ", detail: "WAN 203.0.113.1", x: 84, y: 62 },
    ],
    links: [
      { from: "rbranch", to: "guest", label: "192.168.20.1 · VRF GUEST" },
      { from: "rbranch", to: "internet", label: "198.51.100.2" },
      { from: "internet", to: "hq", label: "203.0.113.1" },
      { from: "rbranch", to: "hq", label: "GRE 10.99.0.0/30 · IPsec", dashed: true },
    ],
  },

  // ─── The Signal Detective (assurance) ──────────────────────────────────
  "signal-detective": {
    devices: [
      { id: "core", kind: "router", label: "R-CORE", detail: "10.20.0.1", x: 22, y: 50 },
      { id: "edge", kind: "router", label: "R-EDGE", detail: "edge", x: 50, y: 50 },
      { id: "app", kind: "pc", label: "App server", detail: "203.0.113.1", x: 82, y: 26 },
      { id: "collector", kind: "pc", label: "NetFlow collector", detail: "203.0.113.50", x: 82, y: 76 },
    ],
    links: [
      { from: "core", to: "edge", label: "core link" },
      { from: "core", to: "app", label: "203.0.113.1 · IP SLA" },
      { from: "core", to: "collector", label: "203.0.113.50 · UDP 2055" },
    ],
  },

  // ─── Lock the Control Plane (AAA) ──────────────────────────────────────
  "lock-the-control-plane": {
    devices: [
      { id: "rbranch", kind: "router", label: "R-BR", detail: "local users · SSH", x: 26, y: 50 },
      { id: "ise", kind: "router", label: "ISE", detail: "10.1.1.10 · RADIUS 1812", x: 74, y: 50 },
    ],
    links: [
      { from: "rbranch", to: "ise", label: "RADIUS · 10.1.1.10" },
    ],
  },

  // ─── Gateway at Dawn (HSRP / VRRP) ─────────────────────────────────────
  "gateway-at-dawn": {
    devices: [
      { id: "gw1", kind: "router", label: "GW1 · Active", detail: "priority 110", x: 24, y: 30 },
      { id: "gw2", kind: "router", label: "GW2 · Standby", detail: "priority 100", x: 24, y: 76 },
      { id: "hosts", kind: "pc", label: "Hosts", detail: "GW 10.30.0.1", x: 80, y: 52 },
    ],
    links: [
      { from: "gw1", to: "gw2", label: "HSRP group 1" },
      { from: "gw1", to: "hosts", label: "10.30.0.1 · virtual IP" },
      { from: "gw2", to: "hosts", label: "10.30.0.1 · virtual IP", dashed: true },
    ],
  },

  // ─── Edge Services (NAT / PAT) ─────────────────────────────────────────
  "edge-services": {
    devices: [
      { id: "lan", kind: "pc", label: "LAN hosts", detail: "10.0.1.0/24", x: 18, y: 50 },
      { id: "redge", kind: "router", label: "R-EDGE", detail: "Gi0/0 in · Gi0/1 out", x: 50, y: 50 },
      { id: "internet", kind: "router", label: "Internet", detail: "203.0.113.5", x: 82, y: 50 },
    ],
    links: [
      { from: "lan", to: "redge", label: "10.0.1.0/24 · inside" },
      { from: "redge", to: "internet", label: "203.0.113.5 · PAT" },
    ],
  },

  // ─── The Edge Has Opinions (eBGP) ──────────────────────────────────────
  "edge-has-opinions": {
    devices: [
      { id: "redge", kind: "router", label: "R-EDGE · AS 65100", detail: "198.51.100.1", x: 20, y: 50 },
      { id: "transit", kind: "router", label: "transit ISP", detail: "2-hop path", x: 52, y: 50 },
      { id: "ispr", kind: "router", label: "ISP-R · AS 65001", detail: "203.0.113.2", x: 82, y: 50 },
    ],
    links: [
      { from: "redge", to: "transit", label: "eBGP · 2 hops" },
      { from: "transit", to: "ispr", label: "203.0.113.2" },
    ],
  },
};
