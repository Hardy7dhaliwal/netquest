import { describe, expect, it } from "vitest";
import {
  chooseMulticast,
  chooseMulticastDrill,
  chooseNtp,
  chooseQos,
  edgeServicesPromptFor,
  natConfigured,
  resetEdgeServicesMission,
  runEdgeServicesCommand,
  startEdgeServicesMission,
} from "./edge-services-mission";

describe("Edge Services mission", () => {
  it("starts in the QoS phase and records a mission-started event", () => {
    const state = startEdgeServicesMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("qos");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  it("advances from QoS to NTP on the right interpretation", () => {
    const next = chooseQos(startEdgeServicesMission(), "voice-ef");
    expect(next.phase).toBe("ntp");
    expect(next.selectedQos).toBe("voice-ef");
    expect(next.attempts).toBe(1);
    expect(next.eventLog.at(-1)?.tone).toBe("success");
  });

  it("holds on QoS with misconception feedback after a wrong answer", () => {
    const next = chooseQos(startEdgeServicesMission(), "policy-marks");
    expect(next.phase).toBe("qos");
    expect(next.attempts).toBe(1);
    expect(next.eventLog.at(-1)?.message).toContain("never sets it");
  });

  it("moves from NTP to the NAT console phase on the right answer", () => {
    const atNtp = chooseQos(startEdgeServicesMission(), "voice-ef");
    const next = chooseNtp(atNtp, "source-lo");
    expect(next.phase).toBe("nat-config");
    expect(next.selectedNtp).toBe("source-lo");
    expect(next.eventLog.at(-1)?.message).toContain("source address");
  });

  it("rejects wrong NTP answers with PTP-aware feedback", () => {
    const atNtp = chooseQos(startEdgeServicesMission(), "voice-ef");
    const next = chooseNtp(atNtp, "ptp-config");
    expect(next.phase).toBe("ntp");
    expect(next.eventLog.at(-1)?.message).toContain("boundary and transparent clocks");
  });

  describe("NAT/PAT CLI configure phase", () => {
    function atConsole() {
      const state = startEdgeServicesMission();
      const atNtp = chooseQos(state, "voice-ef");
      return chooseNtp(atNtp, "source-lo");
    }

    it("walks the CLI modes and builds all four NAT pieces", () => {
      let state = atConsole();
      expect(state.phase).toBe("nat-config");
      state = runEdgeServicesCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runEdgeServicesCommand(state, "configure terminal");
      expect(state.cliMode).toBe("config");
      state = runEdgeServicesCommand(state, "interface gi0/0");
      expect(state.cliMode).toBe("config-if");
      state = runEdgeServicesCommand(state, "ip nat inside");
      expect(state.natInsideSet).toBe(true);
      state = runEdgeServicesCommand(state, "exit");
      expect(state.cliMode).toBe("config");
      state = runEdgeServicesCommand(state, "interface gi0/1");
      state = runEdgeServicesCommand(state, "ip nat outside");
      expect(state.natOutsideSet).toBe(true);
      state = runEdgeServicesCommand(state, "exit");
      state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
      expect(state.natAclSet).toBe(true);
      state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
      expect(state.natOverloadSet).toBe(true);
      expect(natConfigured(state)).toBe(true);
    });

    it("advances to the drill only after verifying with show ip nat statistics", () => {
      let state = atConsole();
      state = runEdgeServicesCommand(state, "enable");
      state = runEdgeServicesCommand(state, "configure terminal");
      state = runEdgeServicesCommand(state, "interface gi0/0");
      state = runEdgeServicesCommand(state, "ip nat inside");
      state = runEdgeServicesCommand(state, "exit");
      state = runEdgeServicesCommand(state, "interface gi0/1");
      state = runEdgeServicesCommand(state, "ip nat outside");
      state = runEdgeServicesCommand(state, "exit");
      state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
      state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
      state = runEdgeServicesCommand(state, "end");
      const verified = runEdgeServicesCommand(state, "show ip nat statistics");
      expect(verified.natVerified).toBe(true);
      expect(verified.phase).toBe("nat-drill");
      expect(verified.cliMode).toBe("user");
      expect(verified.cliHistory.at(-1)?.output).toContain("Total active translations: 4");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports 'NAT is not active' until the configuration is complete", () => {
      let state = atConsole();
      state = runEdgeServicesCommand(state, "enable");
      const early = runEdgeServicesCommand(state, "show ip nat statistics");
      expect(early.cliHistory.at(-1)?.output).toContain("NAT is not active");
      expect(early.phase).toBe("nat-config");
    });

    it("guides interface commands typed from the wrong mode", () => {
      let state = atConsole();
      state = runEdgeServicesCommand(state, "enable");
      state = runEdgeServicesCommand(state, "configure terminal");
      const wrongMode = runEdgeServicesCommand(state, "ip nat inside");
      expect(wrongMode.cliHistory.at(-1)?.output).toContain("Mark the interfaces first");
      expect(wrongMode.phase).toBe("nat-config");
    });

    it("ignores commands when the state is not in a CLI phase", () => {
      const next = runEdgeServicesCommand(startEdgeServicesMission(), "enable");
      expect(next.cliHistory).toHaveLength(0);
    });
  });

  describe("NAT/PAT translation drill", () => {
    function atDrill() {
      let state = startEdgeServicesMission();
      state = chooseQos(state, "voice-ef");
      state = chooseNtp(state, "source-lo");
      state = runEdgeServicesCommand(state, "enable");
      state = runEdgeServicesCommand(state, "configure terminal");
      state = runEdgeServicesCommand(state, "interface gi0/0");
      state = runEdgeServicesCommand(state, "ip nat inside");
      state = runEdgeServicesCommand(state, "exit");
      state = runEdgeServicesCommand(state, "interface gi0/1");
      state = runEdgeServicesCommand(state, "ip nat outside");
      state = runEdgeServicesCommand(state, "exit");
      state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
      state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
      state = runEdgeServicesCommand(state, "end");
      return runEdgeServicesCommand(state, "show ip nat statistics");
    }

    it("reads the PAT table and advances to multicast", () => {
      let state = atDrill();
      expect(state.phase).toBe("nat-drill");
      expect(state.cliMode).toBe("user");
      state = runEdgeServicesCommand(state, "enable");
      const verified = runEdgeServicesCommand(state, "show ip nat translations");
      expect(verified.natDrillVerified).toBe(true);
      expect(verified.phase).toBe("multicast");
      expect(verified.cliHistory.at(-1)?.output).toContain("10.0.1.10:52110");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("asks for enable before show ip nat translations in user mode", () => {
      const state = atDrill();
      const guided = runEdgeServicesCommand(state, "show ip nat translations");
      expect(guided.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(guided.phase).toBe("nat-drill");
    });
  });

  it("guards the multicast choice until the drill phase", () => {
    let state = startEdgeServicesMission();
    state = chooseQos(state, "voice-ef");
    state = chooseNtp(state, "source-lo");
    const guarded = chooseMulticast(state, "rpf-check");
    expect(guarded.phase).toBe("nat-config");
    expect(guarded.attempts).toBe(2);
  });

  it("keeps the player in the multicast phase after the RPF answer for the family drill", () => {
    let state = startEdgeServicesMission();
    state = chooseQos(state, "voice-ef");
    state = chooseNtp(state, "source-lo");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "configure terminal");
    state = runEdgeServicesCommand(state, "interface gi0/0");
    state = runEdgeServicesCommand(state, "ip nat inside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "interface gi0/1");
    state = runEdgeServicesCommand(state, "ip nat outside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
    state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
    state = runEdgeServicesCommand(state, "end");
    state = runEdgeServicesCommand(state, "show ip nat statistics");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "show ip nat translations");
    const afterRpf = chooseMulticast(state, "rpf-check");
    expect(afterRpf.status).toBe("in_progress");
    expect(afterRpf.phase).toBe("multicast");
    expect(afterRpf.selectedMulticast).toBe("rpf-check");
    expect(afterRpf.selectedMulticastDrill).toBeNull();
  });

  it("completes the mission after the multicast family drill (MSDP)", () => {
    let state = startEdgeServicesMission();
    state = chooseQos(state, "voice-ef");
    state = chooseNtp(state, "source-lo");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "configure terminal");
    state = runEdgeServicesCommand(state, "interface gi0/0");
    state = runEdgeServicesCommand(state, "ip nat inside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "interface gi0/1");
    state = runEdgeServicesCommand(state, "ip nat outside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
    state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
    state = runEdgeServicesCommand(state, "end");
    state = runEdgeServicesCommand(state, "show ip nat statistics");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "show ip nat translations");
    state = chooseMulticast(state, "rpf-check");
    const done = chooseMulticastDrill(state, "msdp-peers");
    expect(done.status).toBe("complete");
    expect(done.phase).toBe("complete");
    expect(done.selectedMulticastDrill).toBe("msdp-peers");
    expect(done.eventLog.at(-1)?.message).toContain("MSDP");
  });

  it("rejects bidir/SSM misconceptions on the family drill", () => {
    let state = startEdgeServicesMission();
    state = chooseQos(state, "voice-ef");
    state = chooseNtp(state, "source-lo");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "configure terminal");
    state = runEdgeServicesCommand(state, "interface gi0/0");
    state = runEdgeServicesCommand(state, "ip nat inside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "interface gi0/1");
    state = runEdgeServicesCommand(state, "ip nat outside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
    state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
    state = runEdgeServicesCommand(state, "end");
    state = runEdgeServicesCommand(state, "show ip nat statistics");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "show ip nat translations");
    const atMulticast = chooseMulticast(state, "rpf-check");
    const bidir = chooseMulticastDrill(atMulticast, "bidir-flood");
    expect(bidir.phase).toBe("multicast");
    expect(bidir.eventLog.at(-1)?.message).toContain("shared tree");
    const ssm = chooseMulticastDrill(atMulticast, "ssm-many");
    expect(ssm.phase).toBe("multicast");
    expect(ssm.eventLog.at(-1)?.message).toContain("MSDP");
  });

  it("lets a wrong Q1 be retried before the drill unlocks", () => {
    let state = startEdgeServicesMission();
    state = chooseQos(state, "voice-ef");
    state = chooseNtp(state, "source-lo");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "configure terminal");
    state = runEdgeServicesCommand(state, "interface gi0/0");
    state = runEdgeServicesCommand(state, "ip nat inside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "interface gi0/1");
    state = runEdgeServicesCommand(state, "ip nat outside");
    state = runEdgeServicesCommand(state, "exit");
    state = runEdgeServicesCommand(state, "access-list 1 permit 10.0.1.0 0.0.0.255");
    state = runEdgeServicesCommand(state, "ip nat inside source list 1 interface gi0/1 overload");
    state = runEdgeServicesCommand(state, "end");
    state = runEdgeServicesCommand(state, "show ip nat statistics");
    state = runEdgeServicesCommand(state, "enable");
    state = runEdgeServicesCommand(state, "show ip nat translations");
    const wrong = chooseMulticast(state, "spm-flood");
    expect(wrong.phase).toBe("multicast");
    expect(wrong.selectedMulticast).toBe("spm-flood");
    const retried = chooseMulticast(wrong, "rpf-check");
    expect(retried.selectedMulticast).toBe("rpf-check");
    expect(retried.status).toBe("in_progress");
    const done = chooseMulticastDrill(retried, "msdp-peers");
    expect(done.status).toBe("complete");
  });

  it("guards the family drill until RPF is answered", () => {
    let state = startEdgeServicesMission();
    state = chooseQos(state, "voice-ef");
    state = chooseNtp(state, "source-lo");
    const before = JSON.stringify(state);
    const guarded = chooseMulticastDrill(state, "msdp-peers");
    expect(JSON.stringify(guarded)).toBe(before);
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startEdgeServicesMission();
    const before = JSON.stringify(state);
    chooseQos(state, "policy-shapes");
    runEdgeServicesCommand(state, "enable");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders device-scoped prompts", () => {
    expect(edgeServicesPromptFor("user")).toBe("R-EDGE>");
    expect(edgeServicesPromptFor("privileged")).toBe("R-EDGE#");
    expect(edgeServicesPromptFor("config")).toBe("R-EDGE(config)#");
    expect(edgeServicesPromptFor("config-if")).toBe("R-EDGE(config-if)#");
  });

  it("resets to a clean slate", () => {
    const next = resetEdgeServicesMission();
    expect(next).toEqual(resetEdgeServicesMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
