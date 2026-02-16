export type Axis = "X" | "Y" | "Z" | "A" | "B" | "C";

export type Position = Record<Axis, number>;

export type Comment = {
  type: "paren" | "semicolon";
  text: string;
  start: number;
  end: number;
};

export type GCodeWord = {
  letter: string;
  value: number;
  raw: string;
  start: number;
  end: number;
};

export type ParsedLine = {
  raw: string;
  words: GCodeWord[];
  gcodes: GCodeWord[];
  params: GCodeWord[];
  comments: Comment[];
};

export type MotionMode = "G0" | "G1" | "G2" | "G3";
export type DistanceMode = "G90" | "G91";
export type PlaneMode = "G17" | "G18" | "G19";
export type UnitsMode = "G20" | "G21";

export type ModalState = {
  motion: MotionMode;
  distance: DistanceMode;
  plane: PlaneMode;
  units: UnitsMode;
  feedMode: "G93" | "G94";
  feedRate: number | null;
  spindleSpeed: number | null;
  tool: number | null;
  coolant: "M7" | "M8" | "M9" | null;
  spindle: "M3" | "M4" | "M5" | null;
  coordinateSystem: "G54" | "G55" | "G56" | "G57" | "G58" | "G59";
};

export type LinearMoveCallback = (args: {
  modals: ModalState;
  start: Position;
  end: Position;
  transformedStart: Position;
  transformedEnd: Position;
}) => void;

export type ArcMoveCallback = (args: {
  modals: ModalState;
  start: Position;
  end: Position;
  max: Position;
  center: Position;
  plane: PlaneMode;
  motion: MotionMode;
  transformedStart: Position;
  transformedEnd: Position;
  transformedMax: Position;
  transformedCenter: Position;
}) => void;

export type MovementCallbacks = {
  onLinearMove?: LinearMoveCallback;
  onArcMove?: ArcMoveCallback;
};

export type VirtualizeResult = {
  parsed: ParsedLine;
  modals: ModalState;
  start: Position;
  end: Position;
  movement: "none" | "linear" | "arc";
  arcMax?: Position;
};
