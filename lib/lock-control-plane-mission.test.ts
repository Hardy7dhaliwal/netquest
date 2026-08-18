import { describe, expect, it } from "vitest";
import {
  aaaDone,
  chooseCopp,
  chooseDesign,
  chooseIacl,
  chooseRest,
  LOCK_PHASES,
  lockPromptFor,
  localDone,
  resetLockControlPlaneMission,
  runLockCommand,
  startLockControlPlaneMission,
} from "./lock-control-plane-mission";

function atAaa() {
  let state = startLockControlPlaneMission();
  state = runLockCommand(state, "enable");
  state = runLockCommand(state, "configure terminal");
  state = runLockCommand(state, "username admin secret C1scoBranch!");
  state = runLockCommand(state, "line vty 0 4");
  state = runLockCommand(state, "login local");
  state = runLockCommand(state, "transport input ssh");
  state = runLockCommand(state, "end");
  return runLockCommand(state, "show running-config | include line vty");
}

function atIacl() {
  let state = atAaa();
  state = runLockCommand(state, "enable");
  state = runLockCommand(state, "configure terminal");
  state = runLockCommand(state, "aaa new-model");
  state = runLockCommand(state, "radius server ISE");
  state = runLockCommand(state, "address ipv4 10.1.1.10");
  state = runLockCommand(state, "key c1scoRADIUS");
  state = runLockCommand(state, "aaa authentication login default group radius local");
  state = runLockCommand(state, "end");
  return runLockCommand(state, "show aaa servers");
}

describe("Lock the Control Plane mission", () => {
  it("starts in the local phase and records a mission-started event", () => {
    const state = startLockControlPlaneMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("local");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("local auth phase (5.1.a)", () => {
    it("creates the secret user, locks the VTY lines to local+SSH, and verifies", () => {
      let state = startLockControlPlaneMission();
      state = runLockCommand(state, "enable");
      state = runLockCommand(state, "configure terminal");
      expect(state.cliMode).toBe("config");
      state = runLockCommand(state, "username admin secret C1scoBranch!");
      expect(state.userCreated).toBe(true);
      state = runLockCommand(state, "line vty 0 4");
      state = runLockCommand(state, "login local");
      expect(state.vtyLocal).toBe(true);
      state = runLockCommand(state, "transport input ssh");
      expect(state.vtySsh).toBe(true);
      state = runLockCommand(state, "end");
      expect(state.cliMode).toBe("privileged");
      const verified = runLockCommand(state, "show running-config | include line vty");
      expect(verified.localVerified).toBe(true);
      expect(localDone(verified)).toBe(true);
      expect(verified.phase).toBe("aaa");
      expect(verified.cliMode).toBe("user");
      expect(verified.cliHistory.at(-1)?.output).toContain("login local");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("guides config typed before configure terminal", () => {
      let state = startLockControlPlaneMission();
      state = runLockCommand(state, "enable");
      const early = runLockCommand(state, "username admin secret C1scoBranch!");
      expect(early.cliHistory.at(-1)?.output).toContain("configure terminal");
      expect(early.userCreated).toBe(false);
    });

    it("shows the VTY lines as still open until the local auth is configured", () => {
      let state = startLockControlPlaneMission();
      state = runLockCommand(state, "enable");
      const early = runLockCommand(state, "show running-config | include line vty");
      expect(early.localVerified).toBe(false);
      expect(early.phase).toBe("local");
      expect(early.cliHistory.at(-1)?.output).toContain("still open");
      expect(localDone(early)).toBe(false);
    });

    it("does not verify with only some of the local-auth steps done", () => {
      let state = startLockControlPlaneMission();
      state = runLockCommand(state, "enable");
      state = runLockCommand(state, "configure terminal");
      state = runLockCommand(state, "username admin secret C1scoBranch!");
      state = runLockCommand(state, "line vty 0 4");
      state = runLockCommand(state, "login local");
      state = runLockCommand(state, "end");
      const partial = runLockCommand(state, "show running-config | include line vty");
      expect(partial.localVerified).toBe(false);
      expect(partial.phase).toBe("local");
      expect(partial.cliHistory.at(-1)?.output).toContain("still open");
    });
  });

  describe("AAA phase (5.1.b)", () => {
    it("enables AAA, points RADIUS at ISE, and verifies the server", () => {
      let state = atAaa();
      expect(state.phase).toBe("aaa");
      state = runLockCommand(state, "enable");
      state = runLockCommand(state, "configure terminal");
      state = runLockCommand(state, "aaa new-model");
      expect(state.aaaNewModel).toBe(true);
      state = runLockCommand(state, "radius server ISE");
      state = runLockCommand(state, "address ipv4 10.1.1.10");
      expect(state.radiusServerSet).toBe(true);
      state = runLockCommand(state, "key c1scoRADIUS");
      expect(state.radiusKeySet).toBe(true);
      state = runLockCommand(state, "aaa authentication login default group radius local");
      expect(state.aaaLoginSet).toBe(true);
      state = runLockCommand(state, "end");
      const verified = runLockCommand(state, "show aaa servers");
      expect(verified.aaaVerified).toBe(true);
      expect(aaaDone(verified)).toBe(true);
      expect(verified.phase).toBe("iacl");
      expect(verified.cliHistory.at(-1)?.output).toContain("Status: ALIVE");
      expect(verified.eventLog.at(-1)?.tone).toBe("success");
    });

    it("reports no RADIUS server before it is configured", () => {
      let state = atAaa();
      state = runLockCommand(state, "enable");
      const early = runLockCommand(state, "show aaa servers");
      expect(early.cliHistory.at(-1)?.output).toContain("No AAA RADIUS server");
      expect(early.phase).toBe("aaa");
    });

    it("requires defining the RADIUS server before verification succeeds", () => {
      let state = atAaa();
      state = runLockCommand(state, "enable");
      state = runLockCommand(state, "configure terminal");
      state = runLockCommand(state, "aaa new-model");
      // Skip 'radius server ISE' — set the address, key, and login method anyway.
      state = runLockCommand(state, "address ipv4 10.1.1.10");
      state = runLockCommand(state, "key c1scoRADIUS");
      state = runLockCommand(state, "aaa authentication login default group radius local");
      state = runLockCommand(state, "end");
      const skipped = runLockCommand(state, "show aaa servers");
      expect(skipped.cliHistory.at(-1)?.output).toContain("No AAA RADIUS server");
      expect(skipped.aaaVerified).toBe(false);
      expect(skipped.phase).toBe("aaa");
    });
  });

  describe("iacl phase (5.2.a)", () => {
    it("reads the iACL as permit-management-then-deny and advances", () => {
      let state = atIacl();
      expect(state.phase).toBe("iacl");
      const correct = chooseIacl(state, "permit-mgmt-deny");
      expect(correct.selectedIacl).toBe("permit-mgmt-deny");
      expect(correct.phase).toBe("copp");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects the permit-all read", () => {
      let state = atIacl();
      const wrong = chooseIacl(state, "permit-all");
      expect(wrong.phase).toBe("iacl");
      expect(wrong.attempts).toBe(1);
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("copp phase (5.2.b)", () => {
    it("reads CoPP as control-plane policing and advances", () => {
      let state = atIacl();
      state = chooseIacl(state, "permit-mgmt-deny");
      const correct = chooseCopp(state, "copp-protects");
      expect(correct.selectedCopp).toBe("copp-protects");
      expect(correct.phase).toBe("rest");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("explains CoPP does not replace the iACL", () => {
      let state = atIacl();
      state = chooseIacl(state, "permit-mgmt-deny");
      const wrong = chooseCopp(state, "copp-replaces-acl");
      expect(wrong.phase).toBe("copp");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("rest phase (5.3)", () => {
    it("names TLS + API keys as the REST security baseline and advances", () => {
      let state = atIacl();
      state = chooseIacl(state, "permit-mgmt-deny");
      state = chooseCopp(state, "copp-protects");
      const correct = chooseRest(state, "api-key-https");
      expect(correct.selectedRest).toBe("api-key-https");
      expect(correct.phase).toBe("design");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects plaintext API calls", () => {
      let state = atIacl();
      state = chooseIacl(state, "permit-mgmt-deny");
      state = chooseCopp(state, "copp-protects");
      const wrong = chooseRest(state, "api-plaintext");
      expect(wrong.phase).toBe("rest");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("design phase (5.4.a–d)", () => {
    it("completes the mission with the defense-in-depth read", () => {
      let state = atIacl();
      state = chooseIacl(state, "permit-mgmt-deny");
      state = chooseCopp(state, "copp-protects");
      state = chooseRest(state, "api-key-https");
      expect(state.phase).toBe("design");
      const done = chooseDesign(state, "layered-defense");
      expect(done.status).toBe("complete");
      expect(done.phase).toBe("complete");
      expect(done.selectedDesign).toBe("layered-defense");
    });

    it("distinguishes MACsec (L2) from the L3 firewall role", () => {
      let state = atIacl();
      state = chooseIacl(state, "permit-mgmt-deny");
      state = chooseCopp(state, "copp-protects");
      state = chooseRest(state, "api-key-https");
      const wrong = chooseDesign(state, "macsec-l3");
      expect(wrong.phase).toBe("design");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  it("guards every choice behind its own phase", () => {
    let state = startLockControlPlaneMission();
    expect(chooseIacl(state, "permit-mgmt-deny").phase).toBe("local");
    expect(chooseCopp(state, "copp-protects").phase).toBe("local");
    expect(chooseRest(state, "api-key-https").phase).toBe("local");
    expect(chooseDesign(state, "layered-defense").phase).toBe("local");
  });

  it("lists exactly the six in-progress phases", () => {
    expect(LOCK_PHASES).toEqual(["local", "aaa", "iacl", "copp", "rest", "design"]);
  });

  it("renders the R-BR prompts", () => {
    expect(lockPromptFor("user")).toBe("R-BR>");
    expect(lockPromptFor("privileged")).toBe("R-BR#");
    expect(lockPromptFor("config")).toBe("R-BR(config)#");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startLockControlPlaneMission();
    const before = JSON.stringify(state);
    runLockCommand(state, "enable");
    chooseIacl(state, "permit-mgmt-deny");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resets to a clean slate", () => {
    const next = resetLockControlPlaneMission();
    expect(next).toEqual(resetLockControlPlaneMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
