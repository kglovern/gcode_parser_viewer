export type TextSpriteOptions = {
    x?: number;
    y?: number;
    z?: number;
    textAlign?: "left" | "center" | "right";
    textBaseline?: "top" | "middle" | "bottom";
    size?: number;
    opacity?: number;
};
export declare function createTextSprite(text: string, color: string, options?: TextSpriteOptions): any;
export declare function disposeSpriteGroup(group: any): void;
