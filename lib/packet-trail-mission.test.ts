import { describe, expect, it } from "vitest";
import {
  answerCheckpoint,
  nextStep,
  PACKET_TRAIL_CHECKPOINT,
  PACKET_TRAIL_STOPS,
  prevStep,
  resetPacketTrailMission,
  startPacketTrailMission,
} from "./packet-trail-mission";

describe("The Packet Trail tour", () => {
  it("starts at stop 0", () => {
    const state = startPacketTrailMission();
    expect(state.status).toBe("in_progress");
    expect(state.stepIndex).toBe(0);
  });

  it("walks forward through all stops, then opens the checkpoint", () => {
    let state = startPacketTrailMission();
    for (let index = 0; index < PACKET_TRAIL_STOPS; index += 1) {
      state = nextStep(state);
    }
    expect(state.stepIndex).toBe(PACKET_TRAIL_STOPS);
    expect(state.status).toBe("in_progress");
  });

  it("prevents stepping past the checkpoint or before the start", () => {
    let end = startPacketTrailMission();
    for (let index = 0; index < PACKET_TRAIL_STOPS + 2; index += 1) {
      end = nextStep(end);
    }
    expect(end.stepIndex).toBe(PACKET_TRAIL_STOPS);
    const start = prevStep(startPacketTrailMission());
    expect(start.stepIndex).toBe(0);
  });

  it("completes only on the correct checkpoint answer", () => {
    let state = startPacketTrailMission();
    for (let index = 0; index < PACKET_TRAIL_STOPS; index += 1) {
      state = nextStep(state);
    }

    const wrong = answerCheckpoint(state, "trunk-one-vlan");
    expect(wrong.status).toBe("in_progress");
    expect(wrong.eventLog.at(-1)?.tone).toBe("error");
    expect(wrong.attempts).toBe(1);

    const complete = answerCheckpoint(wrong, PACKET_TRAIL_CHECKPOINT);
    expect(complete.status).toBe("complete");
    expect(complete.eventLog.at(-1)?.tone).toBe("success");
  });

  it("does not change a completed mission", () => {
    let state = startPacketTrailMission();
    for (let index = 0; index < PACKET_TRAIL_STOPS; index += 1) {
      state = nextStep(state);
    }
    const complete = answerCheckpoint(state, PACKET_TRAIL_CHECKPOINT);
    expect(nextStep(complete)).toEqual(complete);
    expect(prevStep(complete)).toEqual(complete);
    expect(resetPacketTrailMission().status).toBe("not_started");
  });
});
