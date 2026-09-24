export type GCodeSVGOptions = {
    rapidColor: string;
    cutColor: string;
    boundingBoxColor: string;
    strokeWidth: number;
    arcSegments: number;
    padding: number;
    projectionMode: 'perspective' | 'isometric' | 'top';
    showOrigin: boolean;
    originColor: string;
    crosshairColor: string;
};
export declare const defaultGCodeSVGOptions: GCodeSVGOptions;
