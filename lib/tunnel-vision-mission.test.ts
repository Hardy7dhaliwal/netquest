import { describe, expect, it } from "vitest";
import {
  chooseCheckpoint,
  cryptoMapDone,
  isakmpDone,
  resetTunnelVisionMission,
  runTunnelCommand,
  startTunnelVisionMission,
  tunnelPromptFor,
  vrfDone,
} from "./tunnel-vision-mission";

describe("Tunnel Vision mission", () => {
  it("starts in the vrf phase and records a mission-started event", () => {
    const state = startTunnelVisionMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("vrf");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("VRF drill", () => {
    it("walks the CLI modes and isolates the guest LAN, teaching the IP-strip gotcha", () => {
      let state = startTunnelVisionMission();
      state = runTunnelCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runTunnelCommand(state, "configure terminal");
      expect(state.cliMode).toBe("config");
      state = runTunnelCommand(state, "vrf definition GUEST");
      expect(state.cliMode).toBe("config-vrf");
      state = runTunnelCommand(state, "rd 65000:20");
      expect(state.vrfDefined).toBe(true);
      state = runTunnelCommand(state, "exit");
      expect(state.cliMode).toBe("config");
      state = runTunnelCommand(state, "interface gi0/1");
      expect(state.cliMode).toBe("config-if");
      const forwarded = runTunnelCommand(state, "vrf forwarding GUEST");
      expect(forwarded.vrfForwarded).toBe(true);
      expect(forwarded.cliHistory.at(-1)?.output).toContain("IPv4 disabled and address(es) removed");
      state = runTunnelCommand(forwarded, "ip address 192.168.20.1 255.255.255.0");
      expect(state.ipReadded).toBe(true);
      state = runTunnelCommand(state, "end");
      expect(state.cliMode).toBe("privileged");
      const verified = runTunnelCommand(state, "show vrf brief");
      expect(verified.vrfVerified).toBe(true);
      expect(vrfDone(verified)).toBe(true);
      expect(verified.phase).toBe("gre");
      expect(verified.cliMode).toBe("user");
      expect(verified.cliHistory.at(-1)?.output).toContain("GUEST");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("warns that vrf forwarding must come before the IP address", () => {
      let state = startTunnelVisionMission();
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "interface gi0/1");
      const early = runTunnelCommand(state, "ip address 192.168.20.1 255.255.255.0");
      expect(early.cliHistory.at(-1)?.output).toContain("vrf forwarding GUEST first");
      expect(early.phase).toBe("vrf");
    });

    it("shows GUEST as incomplete until the bind and address are restored", () => {
      let state = startTunnelVisionMission();
      state = runTunnelCommand(state, "enable");
      const early = runTunnelCommand(state, "show vrf brief");
      expect(early.cliHistory.at(-1)?.output).toContain("GUEST is incomplete");
      expect(early.phase).toBe("vrf");
    });
  });

  describe("GRE drill", () => {
    function atGre() {
      let state = startTunnelVisionMission();
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "vrf definition GUEST");
      state = runTunnelCommand(state, "rd 65000:20");
      state = runTunnelCommand(state, "exit");
      state = runTunnelCommand(state, "interface gi0/1");
      state = runTunnelCommand(state, "vrf forwarding GUEST");
      state = runTunnelCommand(state, "ip address 192.168.20.1 255.255.255.0");
      state = runTunnelCommand(state, "end");
      return runTunnelCommand(state, "show vrf brief");
    }

    it("builds Tunnel0 with all four commands and verifies it is up", () => {
      let state = atGre();
      expect(state.phase).toBe("gre");
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "interface tunnel 0");
      expect(state.cliMode).toBe("config-if");
      state = runTunnelCommand(state, "ip address 10.99.0.2 255.255.255.252");
      state = runTunnelCommand(state, "tunnel source gi0/0");
      state = runTunnelCommand(state, "tunnel destination 203.0.113.1");
      state = runTunnelCommand(state, "tunnel mode gre ip");
      expect(state.tunnelModeSet).toBe(true);
      state = runTunnelCommand(state, "end");
      const verified = runTunnelCommand(state, "show interface tunnel 0");
      expect(verified.tunnelVerified).toBe(true);
      expect(verified.phase).toBe("ipsec");
      expect(verified.cliMode).toBe("user");
      expect(verified.cliHistory.at(-1)?.output).toContain("GRE/IP");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports the tunnel down until all commands run", () => {
      let state = atGre();
      state = runTunnelCommand(state, "enable");
      const early = runTunnelCommand(state, "show interface tunnel 0");
      expect(early.cliHistory.at(-1)?.output).toContain("Tunnel0 is down");
      expect(early.phase).toBe("gre");
    });
  });

  describe("IKEv1 IPsec drill", () => {
    function atIpsec() {
      let state = startTunnelVisionMission();
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "vrf definition GUEST");
      state = runTunnelCommand(state, "rd 65000:20");
      state = runTunnelCommand(state, "exit");
      state = runTunnelCommand(state, "interface gi0/1");
      state = runTunnelCommand(state, "vrf forwarding GUEST");
      state = runTunnelCommand(state, "ip address 192.168.20.1 255.255.255.0");
      state = runTunnelCommand(state, "end");
      state = runTunnelCommand(state, "show vrf brief");
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "interface tunnel 0");
      state = runTunnelCommand(state, "ip address 10.99.0.2 255.255.255.252");
      state = runTunnelCommand(state, "tunnel source gi0/0");
      state = runTunnelCommand(state, "tunnel destination 203.0.113.1");
      state = runTunnelCommand(state, "tunnel mode gre ip");
      state = runTunnelCommand(state, "end");
      return runTunnelCommand(state, "show interface tunnel 0");
    }

    it("configures the ISAKMP policy, key, and transform set, then advances", () => {
      let state = atIpsec();
      expect(state.phase).toBe("ipsec");
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "crypto isakmp policy 10");
      expect(state.cliMode).toBe("config-isakmp");
      state = runTunnelCommand(state, "encryption aes 256");
      state = runTunnelCommand(state, "authentication pre-share");
      state = runTunnelCommand(state, "hash sha256");
      state = runTunnelCommand(state, "group 14");
      state = runTunnelCommand(state, "exit");
      expect(state.cliMode).toBe("config");
      state = runTunnelCommand(state, "crypto isakmp key c1scoHQ address 203.0.113.1");
      expect(state.keySet).toBe(true);
      state = runTunnelCommand(state, "crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac");
      expect(state.transformSet).toBe(true);
      expect(isakmpDone(state)).toBe(true);
      expect(state.phase).toBe("cryptomap");
      expect(state.cliMode).toBe("user");
      expect(state.eventLog.at(-1)?.tone).toBe("success");
    });

    it("accepts commands case-insensitively (c1scoHQ → c1scohq)", () => {
      let state = atIpsec();
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "crypto isakmp policy 10");
      state = runTunnelCommand(state, "encryption aes 256");
      state = runTunnelCommand(state, "authentication pre-share");
      state = runTunnelCommand(state, "hash sha256");
      state = runTunnelCommand(state, "group 14");
      state = runTunnelCommand(state, "exit");
      state = runTunnelCommand(state, "crypto isakmp key c1scohq address 203.0.113.1");
      expect(state.keySet).toBe(true);
    });
  });

  describe("crypto map drill", () => {
    function atCryptomap() {
      let state = startTunnelVisionMission();
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "vrf definition GUEST");
      state = runTunnelCommand(state, "rd 65000:20");
      state = runTunnelCommand(state, "exit");
      state = runTunnelCommand(state, "interface gi0/1");
      state = runTunnelCommand(state, "vrf forwarding GUEST");
      state = runTunnelCommand(state, "ip address 192.168.20.1 255.255.255.0");
      state = runTunnelCommand(state, "end");
      state = runTunnelCommand(state, "show vrf brief");
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "interface tunnel 0");
      state = runTunnelCommand(state, "ip address 10.99.0.2 255.255.255.252");
      state = runTunnelCommand(state, "tunnel source gi0/0");
      state = runTunnelCommand(state, "tunnel destination 203.0.113.1");
      state = runTunnelCommand(state, "tunnel mode gre ip");
      state = runTunnelCommand(state, "end");
      state = runTunnelCommand(state, "show interface tunnel 0");
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "crypto isakmp policy 10");
      state = runTunnelCommand(state, "encryption aes 256");
      state = runTunnelCommand(state, "authentication pre-share");
      state = runTunnelCommand(state, "hash sha256");
      state = runTunnelCommand(state, "group 14");
      state = runTunnelCommand(state, "exit");
      state = runTunnelCommand(state, "crypto isakmp key c1scoHQ address 203.0.113.1");
      return runTunnelCommand(state, "crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac");
    }

    it("builds the crypto map, applies it to the WAN, and verifies the SA", () => {
      let state = atCryptomap();
      expect(state.phase).toBe("cryptomap");
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "access-list 101 permit gre host 198.51.100.2 host 203.0.113.1");
      expect(state.aclSet).toBe(true);
      state = runTunnelCommand(state, "crypto map CMAP 10 ipsec-isakmp");
      expect(state.cliMode).toBe("config-crypto-map");
      state = runTunnelCommand(state, "set peer 203.0.113.1");
      state = runTunnelCommand(state, "set transform-set TS");
      state = runTunnelCommand(state, "match address 101");
      expect(state.matchSet).toBe(true);
      state = runTunnelCommand(state, "exit");
      state = runTunnelCommand(state, "interface gi0/0");
      expect(state.cliMode).toBe("config-if");
      state = runTunnelCommand(state, "crypto map CMAP");
      expect(state.mapAppliedSet).toBe(true);
      state = runTunnelCommand(state, "end");
      const verified = runTunnelCommand(state, "show crypto ipsec sa");
      expect(verified.ipsecVerified).toBe(true);
      expect(cryptoMapDone(verified)).toBe(true);
      expect(verified.phase).toBe("checkpoint");
      expect(verified.cliHistory.at(-1)?.output).toContain("47/0");
      expect(verified.cliHistory.at(-1)?.output).toContain("ACTIVE(ACTIVE)");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports no active SA until the map is complete", () => {
      let state = atCryptomap();
      state = runTunnelCommand(state, "enable");
      const early = runTunnelCommand(state, "show crypto ipsec sa");
      expect(early.cliHistory.at(-1)?.output).toContain("No active SA");
      expect(early.phase).toBe("cryptomap");
    });

    it("does not fake an established ISAKMP SA before the map is complete", () => {
      let state = atCryptomap();
      state = runTunnelCommand(state, "enable");
      const early = runTunnelCommand(state, "show crypto isakmp sa");
      expect(early.cliHistory.at(-1)?.output).toContain("No ISAKMP SA yet");
      expect(early.cliHistory.at(-1)?.output).not.toContain("QM_IDLE");
      expect(early.phase).toBe("cryptomap");
    });

    it("guides access-list typed from interface mode instead of a bare INVALID", () => {
      let state = atCryptomap();
      state = runTunnelCommand(state, "enable");
      state = runTunnelCommand(state, "configure terminal");
      state = runTunnelCommand(state, "interface gi0/0");
      expect(state.cliMode).toBe("config-if");
      const guided = runTunnelCommand(state, "access-list 101 permit gre host 198.51.100.2 host 203.0.113.1");
      expect(guided.cliHistory.at(-1)?.output).toContain("Access lists are global commands");
      expect(guided.aclSet).toBe(false);
      expect(guided.phase).toBe("cryptomap");
    });
  });

  it("guards the checkpoint choice until the cryptomap phase", () => {
    let state = startTunnelVisionMission();
    const guarded = chooseCheckpoint(state, "outer-gre");
    expect(guarded.phase).toBe("vrf");
    expect(guarded.attempts).toBe(0);
  });

  it("completes the mission after the correct checkpoint answer", () => {
    let state = startTunnelVisionMission();
    state = runTunnelCommand(state, "enable");
    state = runTunnelCommand(state, "configure terminal");
    state = runTunnelCommand(state, "vrf definition GUEST");
    state = runTunnelCommand(state, "rd 65000:20");
    state = runTunnelCommand(state, "exit");
    state = runTunnelCommand(state, "interface gi0/1");
    state = runTunnelCommand(state, "vrf forwarding GUEST");
    state = runTunnelCommand(state, "ip address 192.168.20.1 255.255.255.0");
    state = runTunnelCommand(state, "end");
    state = runTunnelCommand(state, "show vrf brief");
    state = runTunnelCommand(state, "enable");
    state = runTunnelCommand(state, "configure terminal");
    state = runTunnelCommand(state, "interface tunnel 0");
    state = runTunnelCommand(state, "ip address 10.99.0.2 255.255.255.252");
    state = runTunnelCommand(state, "tunnel source gi0/0");
    state = runTunnelCommand(state, "tunnel destination 203.0.113.1");
    state = runTunnelCommand(state, "tunnel mode gre ip");
    state = runTunnelCommand(state, "end");
    state = runTunnelCommand(state, "show interface tunnel 0");
    state = runTunnelCommand(state, "enable");
    state = runTunnelCommand(state, "configure terminal");
    state = runTunnelCommand(state, "crypto isakmp policy 10");
    state = runTunnelCommand(state, "encryption aes 256");
    state = runTunnelCommand(state, "authentication pre-share");
    state = runTunnelCommand(state, "hash sha256");
    state = runTunnelCommand(state, "group 14");
    state = runTunnelCommand(state, "exit");
    state = runTunnelCommand(state, "crypto isakmp key c1scoHQ address 203.0.113.1");
    state = runTunnelCommand(state, "crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac");
    state = runTunnelCommand(state, "enable");
    state = runTunnelCommand(state, "configure terminal");
    state = runTunnelCommand(state, "access-list 101 permit gre host 198.51.100.2 host 203.0.113.1");
    state = runTunnelCommand(state, "crypto map CMAP 10 ipsec-isakmp");
    state = runTunnelCommand(state, "set peer 203.0.113.1");
    state = runTunnelCommand(state, "set transform-set TS");
    state = runTunnelCommand(state, "match address 101");
    state = runTunnelCommand(state, "exit");
    state = runTunnelCommand(state, "interface gi0/0");
    state = runTunnelCommand(state, "crypto map CMAP");
    state = runTunnelCommand(state, "end");
    state = runTunnelCommand(state, "show crypto ipsec sa");
    const done = chooseCheckpoint(state, "outer-gre");
    expect(done.status).toBe("complete");
    expect(done.phase).toBe("complete");
    expect(done.selectedCheckpoint).toBe("outer-gre");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startTunnelVisionMission();
    const before = JSON.stringify(state);
    runTunnelCommand(state, "enable");
    chooseCheckpoint(state, "outer-gre");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders prompts for every CLI mode", () => {
    expect(tunnelPromptFor("user")).toBe("R-BR>");
    expect(tunnelPromptFor("privileged")).toBe("R-BR#");
    expect(tunnelPromptFor("config")).toBe("R-BR(config)#");
    expect(tunnelPromptFor("config-if")).toBe("R-BR(config-if)#");
    expect(tunnelPromptFor("config-vrf")).toBe("R-BR(config-vrf)#");
    expect(tunnelPromptFor("config-isakmp")).toBe("R-BR(config-isakmp)#");
    expect(tunnelPromptFor("config-crypto-map")).toBe("R-BR(config-crypto-map)#");
  });

  it("resets to a clean slate", () => {
    const next = resetTunnelVisionMission();
    expect(next).toEqual(resetTunnelVisionMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
