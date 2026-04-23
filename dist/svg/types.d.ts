export type GCodeSVGOptions = {
    rapidColor: string;
    cutColor: string;
    boundingBoxColor: string;
    strokeWidth: number;
    arcSegments: number;
    padding: number;
    projectionMode: 'perspective' | 'isometric';
};
export declare const defaultGCodeSVGOptions: GCodeSVGOptions;
