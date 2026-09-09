import type { GCodeViewerCameraView } from "./types";
type ViewCubeArgs = {
    container: HTMLElement;
    onSelectView: (view: GCodeViewerCameraView) => void;
};
export declare class ViewCube {
    private readonly root;
    private readonly cube;
    private readonly onSelectView;
    private readonly faceButtons;
    constructor(args: ViewCubeArgs);
    setActiveFace(view: "front" | "back" | "left" | "right" | "top" | "bottom"): void;
    setRotationMatrix3d(elements: readonly number[]): void;
    dispose(): void;
}
export {};
