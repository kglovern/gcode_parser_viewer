export type GCodeSVGOptions = {
    rapidColor: string;
    cutColor: string;
    boundingBoxColor: string;
    strokeWidth: number;
    arcSegments: number;
    padding: number;
    projectionMode: 'perspective' | 'isometric';
    showOrigin: boolean;
    originColor: string;
};
export declare const defaultGCodeSVGOptions: GCodeSVGOptions;
