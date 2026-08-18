import { describe, expect, it } from "vitest";
import {
  chooseController,
  chooseFlow,
  chooseNetconf,
  diagnoseDone,
  resetSignalDetectiveMission,
  runSignalCommand,
  SIGNAL_PHASES,
  signalPromptFor,
  slaDone,
  spanDone,
  startSignalDetectiveMission,
} from "./signal-detective-mission";

function atFlow() {
  let state = startSignalDetectiveMission();
  state = runSignalCommand(state, "enable");
  state = runSignalCommand(state, "ping 10.20.0.1");
  state = runSignalCommand(state, "traceroute 10.20.0.1");
  state = runSignalCommand(state, "show interface gi0/1");
  state = runSignalCommand(state, "debug ip packet access-list 150");
  return runSignalCommand(state, "show ip access-lists 150");
}

function atSpan() {
  let state = atFlow();
  return chooseFlow(state, "fnf-export");
}

function atSla() {
  let state = atSpan();
  state = runSignalCommand(state, "enable");
  state = runSignalCommand(state, "configure terminal");
  state = runSignalCommand(state, "monitor session 1 source interface gi0/1 both");
  state = runSignalCommand(state, "monitor session 1 destination interface gi0/2");
  state = runSignalCommand(state, "end");
  return runSignalCommand(state, "show monitor session 1");
}

function atController() {
  let state = atSla();
  state = runSignalCommand(state, "enable");
  state = runSignalCommand(state, "configure terminal");
  state = runSignalCommand(state, "ip sla 10");
  state = runSignalCommand(state, "icmp-echo 203.0.113.1");
  state = runSignalCommand(state, "frequency 60");
  state = runSignalCommand(state, "ip sla schedule 10 life forever start-time now");
  state = runSignalCommand(state, "end");
  return runSignalCommand(state, "show ip sla statistics");
}

function atNetconf() {
  let state = atController();
  return chooseController(state, "design-comply");
}

function atFinalCheck() {
  let state = atNetconf();
  state = runSignalCommand(state, "enable");
  state = runSignalCommand(state, "configure terminal");
  state = runSignalCommand(state, "restconf");
  state = runSignalCommand(state, "end");
  return runSignalCommand(state, "show restconf interface gigabitethernet0/1");
}

describe("The Signal Detective mission", () => {
  it("starts in the diagnose phase and records a mission-started event", () => {
    const state = startSignalDetectiveMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("diagnose");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("diagnose phase (4.1)", () => {
    it("walks the evidence ladder: ping, traceroute, interface, debug, then the ACL reveal", () => {
      let state = startSignalDetectiveMission();
      state = runSignalCommand(state, "enable");
      expect(state.cliMode).toBe("privileged");
      state = runSignalCommand(state, "ping 10.20.0.1");
      expect(state.pinged).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("100 percent");
      state = runSignalCommand(state, "traceroute 10.20.0.1");
      expect(state.traced).toBe(true);
      state = runSignalCommand(state, "show interface gi0/1");
      expect(state.ifChecked).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("Input errors: 48213");
      state = runSignalCommand(state, "debug ip packet access-list 150");
      expect(state.debugSeen).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("dropped by ACL 150");
      const revealed = runSignalCommand(state, "show ip access-lists 150");
      expect(revealed.aclSeen).toBe(true);
      expect(diagnoseDone(revealed)).toBe(true);
      expect(revealed.phase).toBe("flow");
      expect(revealed.cliMode).toBe("user");
      expect(revealed.cliHistory.at(-1)?.output).toContain("48213 matches");
      expect(revealed.eventLog.at(-1)?.tone).toBe("success");
    });

    it("stays in diagnose until the ACL reveal confirms the culprit", () => {
      let state = startSignalDetectiveMission();
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "ping 10.20.0.1");
      state = runSignalCommand(state, "traceroute 10.20.0.1");
      state = runSignalCommand(state, "show interface gi0/1");
      state = runSignalCommand(state, "debug ip packet access-list 150");
      expect(state.phase).toBe("diagnose");
      expect(diagnoseDone(state)).toBe(false);
    });

    it("guides diagnostics typed before enable", () => {
      const early = runSignalCommand(startSignalDetectiveMission(), "ping 10.20.0.1");
      expect(early.cliHistory.at(-1)?.output).toContain("Type enable");
      expect(early.pinged).toBe(false);
    });
  });

  describe("flow phase (4.2)", () => {
    it("reads Flexible NetFlow as flow records exported to a collector", () => {
      let state = atFlow();
      expect(state.phase).toBe("flow");
      const correct = chooseFlow(state, "fnf-export");
      expect(correct.selectedFlow).toBe("fnf-export");
      expect(correct.phase).toBe("span");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("distinguishes NetFlow from packet capture", () => {
      let state = atFlow();
      const wrong = chooseFlow(state, "packet-capture");
      expect(wrong.phase).toBe("flow");
      expect(wrong.attempts).toBe(1);
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("span phase (4.3)", () => {
    it("configures monitor session 1 and verifies it", () => {
      let state = atSpan();
      expect(state.phase).toBe("span");
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "configure terminal");
      state = runSignalCommand(state, "monitor session 1 source interface gi0/1 both");
      expect(state.spanSource).toBe(true);
      state = runSignalCommand(state, "monitor session 1 destination interface gi0/2");
      expect(state.spanDest).toBe(true);
      state = runSignalCommand(state, "end");
      const verified = runSignalCommand(state, "show monitor session 1");
      expect(verified.spanVerified).toBe(true);
      expect(spanDone(verified)).toBe(true);
      expect(verified.phase).toBe("sla");
      expect(verified.cliHistory.at(-1)?.output).toContain("Gi0/1");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports no session before the source and destination are set", () => {
      let state = atSpan();
      state = runSignalCommand(state, "enable");
      const early = runSignalCommand(state, "show monitor session 1");
      expect(early.cliHistory.at(-1)?.output).toContain("incomplete");
      expect(early.phase).toBe("span");
    });

    it("refuses to verify until BOTH the source and destination ports are set", () => {
      let state = atSpan();
      expect(state.phase).toBe("span");
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "configure terminal");
      state = runSignalCommand(state, "monitor session 1 source interface gi0/1 both");
      state = runSignalCommand(state, "end");
      const early = runSignalCommand(state, "show monitor session 1");
      expect(early.spanVerified).toBe(false);
      expect(early.phase).toBe("span");
      expect(early.cliHistory.at(-1)?.output).toContain("BOTH");
      expect(spanDone(early)).toBe(false);
    });
  });

  describe("sla phase (4.4)", () => {
    it("defines the ICMP probe, schedules it, and reads the statistics", () => {
      let state = atSla();
      expect(state.phase).toBe("sla");
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "configure terminal");
      state = runSignalCommand(state, "ip sla 10");
      expect(state.slaEntry).toBe(true);
      state = runSignalCommand(state, "icmp-echo 203.0.113.1");
      expect(state.slaEcho).toBe(true);
      state = runSignalCommand(state, "frequency 60");
      expect(state.slaFreq).toBe(true);
      state = runSignalCommand(state, "ip sla schedule 10 life forever start-time now");
      state = runSignalCommand(state, "end");
      const verified = runSignalCommand(state, "show ip sla statistics");
      expect(verified.slaVerified).toBe(true);
      expect(slaDone(verified)).toBe(true);
      expect(verified.phase).toBe("controller");
      expect(verified.cliHistory.at(-1)?.output).toContain("Latest RTT: 3");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports no operations before the probe is scheduled", () => {
      let state = atSla();
      state = runSignalCommand(state, "enable");
      const early = runSignalCommand(state, "show ip sla statistics");
      expect(early.cliHistory.at(-1)?.output).toContain("No complete IPSLA operation");
      expect(early.phase).toBe("sla");
    });

    it("refuses to verify until the full probe sequence is in place", () => {
      let state = atSla();
      expect(state.phase).toBe("sla");
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "configure terminal");
      state = runSignalCommand(state, "ip sla 10");
      state = runSignalCommand(state, "icmp-echo 203.0.113.1");
      state = runSignalCommand(state, "end");
      const early = runSignalCommand(state, "show ip sla statistics");
      expect(early.slaVerified).toBe(false);
      expect(early.phase).toBe("sla");
      expect(early.cliHistory.at(-1)?.output).toContain("No complete IPSLA operation");
      expect(slaDone(early)).toBe(false);
    });
  });

  describe("controller phase (4.5)", () => {
    it("identifies the design/provision/compliance workflow", () => {
      let state = atController();
      expect(state.phase).toBe("controller");
      const correct = chooseController(state, "design-comply");
      expect(correct.selectedController).toBe("design-comply");
      expect(correct.phase).toBe("netconf");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("distinguishes configuration from Assurance monitoring", () => {
      let state = atController();
      const wrong = chooseController(state, "assurance");
      expect(wrong.phase).toBe("controller");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("netconf phase (4.6)", () => {
    it("enables RESTCONF and reads the interface over YANG JSON", () => {
      let state = atNetconf();
      expect(state.phase).toBe("netconf");
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "configure terminal");
      state = runSignalCommand(state, "restconf");
      state = runSignalCommand(state, "end");
      const read = runSignalCommand(state, "show restconf interface gigabitethernet0/1");
      expect(read.netconfRead).toBe(true);
      expect(read.phase).toBe("final-check");
      expect(read.cliHistory.at(-1)?.output).toContain("yang-data+json");
      expect(read.cliHistory.at(-1)?.output).toContain("200 OK");
      expect(read.eventLog.at(-1)?.tone).toBe("success");
    });

    it("refuses the GET until the restconf service is enabled", () => {
      let state = atNetconf();
      expect(state.phase).toBe("netconf");
      state = runSignalCommand(state, "enable");
      const early = runSignalCommand(state, "show restconf interface gigabitethernet0/1");
      expect(early.netconfRead).toBe(false);
      expect(early.phase).toBe("netconf");
      expect(early.cliHistory.at(-1)?.output).toContain("not enabled");
    });

    it("confirms the restconf service is enabled before the GET", () => {
      let state = atNetconf();
      state = runSignalCommand(state, "enable");
      state = runSignalCommand(state, "configure terminal");
      state = runSignalCommand(state, "restconf");
      state = runSignalCommand(state, "end");
      const service = runSignalCommand(state, "show restconf");
      expect(service.cliHistory.at(-1)?.output).toContain("RESTCONF service is enabled");
      expect(service.phase).toBe("netconf");
    });

    it("completes when RESTCONF is read as the YANG-over-HTTPS API", () => {
      let state = atFinalCheck();
      expect(state.phase).toBe("final-check");
      const done = chooseNetconf(state, "restconf-yang");
      expect(done.status).toBe("complete");
      expect(done.phase).toBe("complete");
      expect(done.selectedNetconf).toBe("restconf-yang");
    });

    it("explains the NETCONF-vs-RESTCONF distinction", () => {
      let state = atFinalCheck();
      const wrong = chooseNetconf(state, "netconf-ssh-only");
      expect(wrong.phase).toBe("final-check");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  it("guards every choice behind its own phase", () => {
    let state = startSignalDetectiveMission();
    expect(chooseFlow(state, "fnf-export").phase).toBe("diagnose");
    expect(chooseController(state, "design-comply").phase).toBe("diagnose");
    expect(chooseNetconf(state, "restconf-yang").phase).toBe("diagnose");
  });

  it("lists exactly the seven in-progress phases", () => {
    expect(SIGNAL_PHASES).toEqual(["diagnose", "flow", "span", "sla", "controller", "netconf", "final-check"]);
  });

  it("renders the R-CORE prompts", () => {
    expect(signalPromptFor("user")).toBe("R-CORE>");
    expect(signalPromptFor("privileged")).toBe("R-CORE#");
    expect(signalPromptFor("config")).toBe("R-CORE(config)#");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startSignalDetectiveMission();
    const before = JSON.stringify(state);
    runSignalCommand(state, "enable");
    chooseFlow(state, "fnf-export");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resets to a clean slate", () => {
    const next = resetSignalDetectiveMission();
    expect(next).toEqual(resetSignalDetectiveMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
