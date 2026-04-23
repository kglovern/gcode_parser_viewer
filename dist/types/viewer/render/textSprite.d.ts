import * as THREE from "three";
export type TextSpriteOptions = {
    x?: number;
    y?: number;
    z?: number;
    textAlign?: "left" | "center" | "right";
    textBaseline?: "top" | "middle" | "bottom";
    size?: number;
    opacity?: number;
};
export declare function createTextSprite(text: string, color: string, options?: TextSpriteOptions): THREE.Object3D;
export declare function disposeSpriteGroup(group: THREE.Object3D): void;
