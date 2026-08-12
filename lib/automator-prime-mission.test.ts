import { describe, expect, it } from "vitest";
import {
  AUTOMATOR_PHASES,
  automatorPromptFor,
  chooseAgent,
  chooseApis,
  chooseRest,
  chooseYang,
  eemDone,
  jsonDone,
  pythonDone,
  resetAutomatorPrimeMission,
  runAutomatorCommand,
  startAutomatorPrimeMission,
} from "./automator-prime-mission";

function atYang() {
  let state = startAutomatorPrimeMission();
  state = runAutomatorCommand(state, "import requests");
  state = runAutomatorCommand(state, `r = requests.get("https://198.51.100.10/restconf/data/interfaces", auth=("admin", "C1scoBranch!"), verify=False)`);
  return runAutomatorCommand(state, `print(r.status_code, r.json()["ietf-interfaces:interfaces"]["interface"][0]["name"])`);
}

function atApis() {
  let state = atYang();
  state = runAutomatorCommand(state, `{"ietf-interfaces:interfaces": {"interface": [{"name": "Loopback100", "type": "ianaift:softwareLoopback", "enabled": true}]}}`);
  return runAutomatorCommand(state, `{"name": "BR-1", "description": "branch router", "siteId": "site-42", "deviceType": "vedge-cloud"}`);
}

function atRest() {
  let state = atApis();
  return chooseYang(state, "data-model-tree");
}

function atEem() {
  let state = atRest();
  return chooseApis(state, "rest-xsrf");
}

function atAgent() {
  let state = atEem();
  return chooseRest(state, "created");
}

describe("Automator Prime mission", () => {
  it("starts in the python phase and records a mission-started event", () => {
    const state = startAutomatorPrimeMission();
    expect(state.status).toBe("in_progress");
    expect(state.phase).toBe("python");
    expect(state.cliMode).toBe("repl");
    expect(state.attempts).toBe(0);
    expect(state.eventLog[0].tone).toBe("info");
  });

  describe("python phase (6.1)", () => {
    it("walks the three-line RESTCONF probe and advances to json", () => {
      let state = startAutomatorPrimeMission();
      state = runAutomatorCommand(state, "import requests");
      expect(state.pyImport).toBe(true);
      state = runAutomatorCommand(state, `r = requests.get("https://198.51.100.10/restconf/data/interfaces", auth=("admin", "C1scoBranch!"), verify=False)`);
      expect(state.pyGet).toBe(true);
      expect(state.cliHistory.at(-1)?.output).toContain("200 OK");
      const done = runAutomatorCommand(state, `print(r.status_code, r.json()["ietf-interfaces:interfaces"]["interface"][0]["name"])`);
      expect(done.pyRead).toBe(true);
      expect(pythonDone(done)).toBe(true);
      expect(done.phase).toBe("json");
      expect(done.cliMode).toBe("repl");
      expect(done.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects a malformed probe line", () => {
      let state = startAutomatorPrimeMission();
      const bad = runAutomatorCommand(state, "print(r.status_code)");
      expect(bad.cliHistory.at(-1)?.output).toContain("Invalid input");
      expect(bad.pyRead).toBe(false);
      expect(bad.phase).toBe("python");
    });

    it("accepts whitespace variations in Python and JSON", () => {
      let state = startAutomatorPrimeMission();
      // Python is whitespace-insensitive: extra spacing still matches.
      state = runAutomatorCommand(state, "import   requests");
      expect(state.pyImport).toBe(true);
      state = runAutomatorCommand(state, `r = requests.get("https://198.51.100.10/restconf/data/interfaces", auth=("admin", "C1scoBranch!"), verify=False)`);
      expect(state.pyGet).toBe(true);
      state = runAutomatorCommand(state, `print(r.status_code, r.json()["ietf-interfaces:interfaces"]["interface"][0]["name"])`);
      expect(state.phase).toBe("json");
      // JSON formatted with different spacing still validates.
      state = runAutomatorCommand(state, `{ "ietf-interfaces:interfaces" : { "interface" : [ { "name" : "Loopback100", "type" : "ianaift:softwareLoopback", "enabled" : true } ] } }`);
      expect(state.jsonEnv).toBe(true);
    });
  });

  describe("json phase (6.2)", () => {
    it("accepts the two JSON documents and advances to yang", () => {
      let state = atYang();
      expect(state.phase).toBe("json");
      state = runAutomatorCommand(state, `{"ietf-interfaces:interfaces": {"interface": [{"name": "Loopback100", "type": "ianaift:softwareLoopback", "enabled": true}]}}`);
      expect(state.jsonEnv).toBe(true);
      const done = runAutomatorCommand(state, `{"name": "BR-1", "description": "branch router", "siteId": "site-42", "deviceType": "vedge-cloud"}`);
      expect(done.jsonDevice).toBe(true);
      expect(jsonDone(done)).toBe(true);
      expect(done.phase).toBe("yang");
      expect(done.eventLog.at(-1)?.tone).toBe("success");
    });
  });

  describe("yang phase (6.3)", () => {
    it("reads YANG as a data-modeling tree and advances", () => {
      let state = atApis();
      expect(state.phase).toBe("yang");
      const correct = chooseYang(state, "data-model-tree");
      expect(correct.selectedYang).toBe("data-model-tree");
      expect(correct.phase).toBe("apis");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects the scripting-language read", () => {
      let state = atApis();
      const wrong = chooseYang(state, "scripting-language");
      expect(wrong.phase).toBe("yang");
      expect(wrong.attempts).toBe(1);
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("apis phase (6.4)", () => {
    it("names the SD-WAN Manager REST API and advances", () => {
      let state = atRest();
      const correct = chooseApis(state, "rest-xsrf");
      expect(correct.selectedApis).toBe("rest-xsrf");
      expect(correct.phase).toBe("rest");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects the SOAP read", () => {
      let state = atRest();
      const wrong = chooseApis(state, "soap-xml");
      expect(wrong.phase).toBe("apis");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("rest phase (6.5)", () => {
    it("reads 201 as Created and advances into the eem walk", () => {
      let state = atEem();
      const correct = chooseRest(state, "created");
      expect(correct.selectedRest).toBe("created");
      expect(correct.phase).toBe("eem");
      expect(correct.cliMode).toBe("user");
      expect(correct.eventLog.at(-1)?.tone).toBe("success");
    });

    it("rejects the 404 read", () => {
      let state = atEem();
      const wrong = chooseRest(state, "not-found");
      expect(wrong.phase).toBe("rest");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  describe("eem phase (6.6)", () => {
    it("builds the config-save applet and verifies it", () => {
      let state = atAgent();
      expect(state.phase).toBe("eem");
      state = runAutomatorCommand(state, "enable");
      state = runAutomatorCommand(state, "configure terminal");
      expect(state.cliMode).toBe("config");
      state = runAutomatorCommand(state, "event manager applet save-config");
      expect(state.eemApplet).toBe(true);
      state = runAutomatorCommand(state, `event syslog pattern "CONFIG_I"`);
      expect(state.eemEvent).toBe(true);
      state = runAutomatorCommand(state, `action 1.0 cli command "enable"`);
      expect(state.eemAction1).toBe(true);
      state = runAutomatorCommand(state, `action 2.0 cli command "write memory"`);
      expect(state.eemAction2).toBe(true);
      state = runAutomatorCommand(state, "end");
      expect(state.cliMode).toBe("privileged");
      const done = runAutomatorCommand(state, "show running-config | include event manager applet");
      expect(done.eemVerified).toBe(true);
      expect(eemDone(done)).toBe(true);
      expect(done.phase).toBe("agent");
      expect(done.cliMode).toBe("user");
      expect(done.cliHistory.at(-1)?.output).toContain("action 2.0 cli command");
      expect(done.eventLog.at(-1)?.tone).toBe("success");
    });

    it("blocks verification before the applet is complete", () => {
      let state = atAgent();
      state = runAutomatorCommand(state, "enable");
      state = runAutomatorCommand(state, "configure terminal");
      state = runAutomatorCommand(state, "event manager applet save-config");
      state = runAutomatorCommand(state, "end");
      const early = runAutomatorCommand(state, "show running-config | include event manager applet");
      expect(early.cliHistory.at(-1)?.output).toContain("No complete EEM applet");
      expect(early.phase).toBe("eem");
    });
  });

  describe("agent phase (6.7)", () => {
    it("completes the mission with the agentless read", () => {
      let state = atAgent();
      state = runAutomatorCommand(state, "enable");
      state = runAutomatorCommand(state, "configure terminal");
      state = runAutomatorCommand(state, "event manager applet save-config");
      state = runAutomatorCommand(state, `event syslog pattern "CONFIG_I"`);
      state = runAutomatorCommand(state, `action 1.0 cli command "enable"`);
      state = runAutomatorCommand(state, `action 2.0 cli command "write memory"`);
      state = runAutomatorCommand(state, "end");
      state = runAutomatorCommand(state, "show running-config | include event manager applet");
      expect(state.phase).toBe("agent");
      const done = chooseAgent(state, "agentless-ssh");
      expect(done.status).toBe("complete");
      expect(done.phase).toBe("complete");
      expect(done.selectedAgent).toBe("agentless-ssh");
    });

    it("rejects the agentless-install mixup", () => {
      let state = atAgent();
      state = runAutomatorCommand(state, "enable");
      state = runAutomatorCommand(state, "configure terminal");
      state = runAutomatorCommand(state, "event manager applet save-config");
      state = runAutomatorCommand(state, `event syslog pattern "CONFIG_I"`);
      state = runAutomatorCommand(state, `action 1.0 cli command "enable"`);
      state = runAutomatorCommand(state, `action 2.0 cli command "write memory"`);
      state = runAutomatorCommand(state, "end");
      state = runAutomatorCommand(state, "show running-config | include event manager applet");
      const wrong = chooseAgent(state, "agentless-install");
      expect(wrong.phase).toBe("agent");
      expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    });
  });

  it("guards every choice behind its own phase", () => {
    let state = startAutomatorPrimeMission();
    expect(chooseYang(state, "data-model-tree").phase).toBe("python");
    expect(chooseApis(state, "rest-xsrf").phase).toBe("python");
    expect(chooseRest(state, "created").phase).toBe("python");
    expect(chooseAgent(state, "agentless-ssh").phase).toBe("python");
  });

  it("lists exactly the seven in-progress phases", () => {
    expect(AUTOMATOR_PHASES).toEqual(["python", "json", "yang", "apis", "rest", "eem", "agent"]);
  });

  it("renders the workspace prompts", () => {
    expect(automatorPromptFor("python", "repl")).toBe(">>>");
    expect(automatorPromptFor("json", "repl")).toBe("json> ");
    expect(automatorPromptFor("eem", "user")).toBe("R-CORE>");
    expect(automatorPromptFor("eem", "privileged")).toBe("R-CORE#");
    expect(automatorPromptFor("eem", "config")).toBe("R-CORE(config)#");
  });

  it("is immutable: actions never mutate the input state", () => {
    const state = startAutomatorPrimeMission();
    const before = JSON.stringify(state);
    runAutomatorCommand(state, "import requests");
    chooseYang(state, "data-model-tree");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resets to a clean slate", () => {
    const next = resetAutomatorPrimeMission();
    expect(next).toEqual(resetAutomatorPrimeMission());
    expect(next.status).toBe("not_started");
    expect(next.cliHistory).toHaveLength(0);
    expect(next.eventLog).toHaveLength(0);
  });
});
