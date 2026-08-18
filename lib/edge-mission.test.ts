import { describe, expect, it } from "vitest";
import {
  chooseBgpState,
  chooseConvergence,
  chooseIgp,
  chooseLocal,
  choosePbr,
  EDGE_EXPECTED,
  resetEdgeMission,
  runEdgeCommand,
  startEdgeMission,
} from "./edge-mission";

function toBgpState() {
  return chooseConvergence(chooseIgp(startEdgeMission(), "hybrid-vs-linkstate"), "fs-vs-spf");
}

function toBgpFix() {
  return chooseBgpState(toBgpState(), "not-established");
}

function cli(initial: ReturnType<typeof toBgpFix>, ...commands: string[]) {
  return commands.reduce(runEdgeCommand, initial);
}

function toPbr() {
  return cli(
    toBgpFix(),
    "enable",
    "configure terminal",
    "router bgp 65100",
    "neighbor 203.0.113.2 ebgp-multihop 2",
    "end",
    "show ip bgp summary",
  );
}

describe("The Edge Has Opinions mission", () => {
  it("starts in the igp phase with the expected answers", () => {
    const state = startEdgeMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("igp");
    expect(EDGE_EXPECTED.igp).toBe("hybrid-vs-linkstate");
    expect(state.selectedIgp).toBeNull();
  });

  it("gives feedback for a wrong IGP comparison and advances on the correct one", () => {
    const wrong = chooseIgp(startEdgeMission(), "classes-reversed");
    expect(wrong.phase).toBe("igp");
    expect(wrong.attempts).toBe(1);
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseIgp(wrong, "hybrid-vs-linkstate");
    expect(next.phase).toBe("convergence");
    expect(next.eventLog.at(-1)?.tone).toBe("success");
  });

  it("advances from convergence to the BGP state reading", () => {
    const state = chooseIgp(startEdgeMission(), "hybrid-vs-linkstate");
    const wrong = chooseConvergence(state, "holddown");
    expect(wrong.phase).toBe("convergence");
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseConvergence(wrong, "fs-vs-spf");
    expect(next.phase).toBe("bgp-state");
    expect(next.selectedConvergence).toBe("fs-vs-spf");
  });

  it("reads the Active BGP state correctly", () => {
    const state = toBgpState();
    const wrong = chooseBgpState(state, "established");
    expect(wrong.phase).toBe("bgp-state");
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = chooseBgpState(wrong, "not-established");
    expect(next.phase).toBe("bgp-fix");
    expect(next.selectedBgpState).toBe("not-established");
    expect(next.cliMode).toBe("user");
    expect(next.bgpConfigured).toBe(false);
  });

  it("walks the CLI mode ladder to BGP router configuration", () => {
    const state = cli(toBgpFix(), "enable", "configure terminal", "router bgp 65100");

    expect(state.cliMode).toBe("config-router");
    expect(state.cliHistory.map((entry) => entry.input)).toEqual(["enable", "configure terminal", "router bgp 65100"]);
    expect(state.cliHistory[1].output).toContain("CNTL/Z");
  });

  it("rejects the neighbor command outside router mode with guidance", () => {
    const state = cli(toBgpFix(), "enable", "neighbor 203.0.113.2 ebgp-multihop 2");

    expect(state.bgpConfigured).toBe(false);
    expect(state.cliHistory.at(-1)?.output).toContain("Enter BGP router configuration first");
  });

  it("shows Active until configured and does not advance", () => {
    const state = cli(toBgpFix(), "enable", "show ip bgp summary");

    expect(state.phase).toBe("bgp-fix");
    expect(state.bgpVerified).toBe(false);
    expect(state.cliHistory.at(-1)?.output).toContain("Active");
  });

  it("configures ebgp-multihop then verifies Established to advance to pbr", () => {
    const state = toPbr();

    expect(state.bgpConfigured).toBe(true);
    expect(state.bgpVerified).toBe(true);
    expect(state.phase).toBe("pbr");
    expect(state.eventLog.at(-1)?.message).toContain("Established");
    expect(state.cliHistory.at(-1)?.output).toContain("00:02:11");
  });

  it("reports the multihop command as already applied on re-entry", () => {
    const state = cli(toBgpFix(), "enable", "configure terminal", "router bgp 65100", "neighbor 203.0.113.2 ebgp-multihop 2");
    const again = runEdgeCommand(state, "neighbor 203.0.113.2 ebgp-multihop 2");
    expect(again.bgpConfigured).toBe(true);
    expect(again.phase).toBe("bgp-fix");
    expect(again.cliHistory.at(-1)?.output).toContain("already enabled");
  });

  it("guides show ip bgp summary back to privileged EXEC", () => {
    const state = cli(toBgpFix(), "enable", "configure terminal", "router bgp 65100", "neighbor 203.0.113.2 ebgp-multihop 2", "show ip bgp summary");

    expect(state.bgpVerified).toBe(false);
    expect(state.cliHistory.at(-1)?.output).toContain("Type end to return to privileged EXEC");
  });

  it("rejects invalid commands without changing state", () => {
    const before = cli(toBgpFix(), "enable");
    const after = runEdgeCommand(before, "delete everything");

    expect(after.cliMode).toBe(before.cliMode);
    expect(after.bgpConfigured).toBe(before.bgpConfigured);
    expect(after.cliHistory.at(-1)?.output).toContain("Invalid input");
  });

  it("interprets PBR as overriding the routing table", () => {
    const state = toPbr();
    const wrong = choosePbr(state, "changes-table");
    expect(wrong.phase).toBe("pbr");
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");

    const next = choosePbr(wrong, "overrides-lookup");
    expect(next.phase).toBe("local");
    expect(next.selectedPbr).toBe("overrides-lookup");
  });

  it("completes only after choosing ip local policy", () => {
    const state = choosePbr(toPbr(), "overrides-lookup");
    const wrong = chooseLocal(state, "default-route");
    expect(wrong.status).toBe("in_progress");
    expect(wrong.phase).toBe("local");

    const complete = chooseLocal(wrong, "local-policy");
    expect(complete.status).toBe("complete");
    expect(complete.phase).toBe("complete");
    expect(complete.selectedLocal).toBe("local-policy");
    expect(complete.eventLog.at(-1)?.tone).toBe("success");
  });

  it("does not change a completed mission", () => {
    const complete = chooseLocal(choosePbr(toPbr(), "overrides-lookup"), "local-policy");
    expect(chooseIgp(complete, "hybrid-vs-linkstate")).toEqual(complete);
    expect(runEdgeCommand(complete, "show ip bgp summary")).toEqual(complete);
    expect(resetEdgeMission().status).toBe("not_started");
  });
});
