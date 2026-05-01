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
  rapidColor: "#0ef6ae",
  cutColor: "#3e85c7",
  boundingBoxColor: "#d0d0d0",
  strokeWidth: 0.5,
  arcSegments: 30,
  padding: 5,
  projectionMode: 'isometric',
};
