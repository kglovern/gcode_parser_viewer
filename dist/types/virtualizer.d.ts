import { ModalState, MovementCallbacks, Position, VirtualizeResult } from "./types";
export declare class GCodeVirtualizer {
    private readonly parser;
    private modals;
    private position;
    private callbacks;
    private feedRates;
    private spindleSpeeds;
    private tools;
    constructor(callbacks?: MovementCallbacks);
    setCallbacks(callbacks: MovementCallbacks): void;
    getModals(): ModalState;
    getPosition(): Position;
    getUniqueFeedRates(): number[];
    getUniqueSpindleSpeeds(): number[];
    getUniqueTools(): number[];
    reset(): void;
    processLine(line: string): VirtualizeResult;
    private unitsScale;
    private updateModals;
    private applyAxes;
    private computeArcMax;
    private arcCenter;
    private emitLinear;
    private emitArc;
}
