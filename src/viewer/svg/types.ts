export type GCodeSVGOptions = {
  rapidColor: string;
  cutColor: string;
  boundingBoxColor: string;
  strokeWidth: number;
  arcSegments: number;
  padding: number;
  projectionMode: 'perspective' | 'isometric';
};

export const defaultGCodeSVGOptions: GCodeSVGOptions = {
  rapidColor: "#4a9eff",
  cutColor: "#e05c00",
  boundingBoxColor: "#d0d0d0",
  strokeWidth: 0.5,
  arcSegments: 30,
  padding: 5,
  projectionMode: 'isometric',
};
