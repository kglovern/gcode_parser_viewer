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
export type WorkerGeometryData = {
    vertices: ArrayBuffer;
    frames: ArrayBuffer;
    colorArrayBuffer: ArrayBuffer;
    verticesLen: number;
    framesLen: number;
    colorLen: number;
    savedColorsBuffer?: ArrayBuffer;
    savedColorLen?: number;
    isLaser?: boolean;
    toolchangeCount?: number;
};
/** Bit 7 of a segments vertex attribute: the vertex belongs to a rapid (G0) move. */
export declare const SEGMENT_ATTR_RAPID = 128;
/** Bits 0-6 of a segments vertex attribute: the palette slot of a cutting move. */
export declare const SEGMENT_ATTR_SLOT_MASK = 127;
/**
 * One drawable chunk of a {@link WorkerSegmentsData} toolpath. Chunks never
 * split a segment, so each is uploaded as its own `LineSegments`.
 */
export type WorkerSegmentsChunk = {
    /** Float32 x,y,z per vertex, as segment pairs (v0,v1)(v2,v3)… */
    positions: ArrayBuffer;
    /** Uint8 per vertex: {@link SEGMENT_ATTR_RAPID} | palette slot. */
    attrs: ArrayBuffer;
    /** Float32 per vertex, laser files only: laser power (S), 0 when off. */
    power?: ArrayBuffer;
    vertexCount: number;
};
/**
 * Worker toolpath in its final draw layout. The buffers are uploaded as-is,
 * colour and progress greying are resolved in the shader, and nothing is
 * re-packed on the main thread.
 *
 * Line indexing is the same as the text-loading path: `prefixEndVertex[i]` is
 * the number of vertices emitted through line `i` (0-based), and
 * `hideUntilLine(i)` / `lineGroups` use those same line indices.
 */
export type WorkerSegmentsData = {
    format: "segments-v1";
    chunks: readonly WorkerSegmentsChunk[];
    totalVertices: number;
    /** Uint32 per line: cumulative vertex count after that line. */
    prefixEndVertex: ArrayBuffer;
    /**
     * Hex colour per palette slot. Used when `toolchangeCount > 0`; otherwise
     * cutting moves take the theme's cutting (or, in laser mode, laser) colour.
     */
    paletteHex?: readonly string[];
    toolchangeCount?: number;
    isLaser?: boolean;
    /** Highest `power` in the file; power is drawn as opacity relative to it. */
    maxPower?: number;
};
/**
 * An inclusive range of source lines the host wants to show or hide as a unit,
 * e.g. everything cut with one tool.
 *
 * Indices are 0-based and match `hideUntilLine`/`seekToLine` — the same source
 * line indexing used by `prefixEndVertex` — not 1-based editor line numbers.
 */
export type LineRangeGroup = {
    start: number;
    end: number;
};
export type LoadWorkerDataOptions = {
    /**
     * Split the toolpath into separately hideable streams by source-line range,
     * so `setLineGroupVisible` can hide an interior span. Without this the
     * toolpath is one rapid stream plus one cut stream, and only a *prefix* can
     * be hidden (via `hideUntilLine`, which sets a single contiguous draw range).
     *
     * Groups are matched in order, so where ranges overlap the first one wins.
     * Lines in no group land in an always-visible stream.
     */
    lineGroups?: readonly LineRangeGroup[];
};
