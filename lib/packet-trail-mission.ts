export type PacketTrailStatus = "not_started" | "in_progress" | "complete";
export type PacketTrailOption = "trunk-carries-many" | "trunk-one-vlan" | "access-between-switches";

export type PacketTrailEvent = { message: string; tone: "info" | "success" | "error" };

export type PacketTrailMissionState = {
  status: PacketTrailStatus;
  stepIndex: number;
  checkpointAnswer: PacketTrailOption | null;
  attempts: number;
  eventLog: PacketTrailEvent[];
};

/** Number of guided stops before the checkpoint question. */
export const PACKET_TRAIL_STOPS = 5;
export const PACKET_TRAIL_CHECKPOINT: PacketTrailOption = "trunk-carries-many";

export const INITIAL_PACKET_TRAIL_MISSION: PacketTrailMissionState = {
  status: "not_started",
  stepIndex: 0,
  checkpointAnswer: null,
  attempts: 0,
  eventLog: [],
};

export function resetPacketTrailMission(): PacketTrailMissionState {
  return { ...INITIAL_PACKET_TRAIL_MISSION, eventLog: [] };
}

export function startPacketTrailMission(): PacketTrailMissionState {
  return {
    ...resetPacketTrailMission(),
    status: "in_progress",
    eventLog: [{ message: "Tour started. Follow the packet from PC-Sales to the gateway — and back.", tone: "info" }],
  };
}

export function nextStep(state: PacketTrailMissionState): PacketTrailMissionState {
  if (state.status === "complete" || state.stepIndex >= PACKET_TRAIL_STOPS) return state;
  return {
    ...state,
    stepIndex: state.stepIndex + 1,
    eventLog: [...state.eventLog, { message: `Stop ${state.stepIndex + 1} of ${PACKET_TRAIL_STOPS} reached.`, tone: "info" }],
  };
}

export function prevStep(state: PacketTrailMissionState): PacketTrailMissionState {
  if (state.status === "complete" || state.stepIndex <= 0) return state;
  return { ...state, stepIndex: state.stepIndex - 1 };
}

export function answerCheckpoint(state: PacketTrailMissionState, answer: PacketTrailOption): PacketTrailMissionState {
  if (state.status === "complete" || state.stepIndex !== PACKET_TRAIL_STOPS) return state;

  if (answer === PACKET_TRAIL_CHECKPOINT) {
    return {
      ...state,
      checkpointAnswer: answer,
      attempts: state.attempts + 1,
      status: "complete",
      eventLog: [
        ...state.eventLog,
        { message: "Correct! A trunk carries frames from many VLANs between switches — that is what the 802.1Q tag tells the far switch.", tone: "success" },
        { message: "Tour complete. You can now read the network map in the field missions.", tone: "success" },
      ],
    };
  }

  return {
    ...state,
    checkpointAnswer: answer,
    attempts: state.attempts + 1,
    eventLog: [
      ...state.eventLog,
      answer === "trunk-one-vlan"
        ? { message: "Not quite — a trunk carries many VLANs, not one. Access ports are the single-VLAN kind.", tone: "error" }
        : { message: "Not quite — switches connect to each other with trunks, not access ports. A trunk carries many VLANs at once.", tone: "error" },
    ],
  };
}
