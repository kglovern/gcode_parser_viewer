declare module "three" {
  const three: any;
  export = three;
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export class OrbitControls {
    enableDamping: boolean;
    target: any;
    constructor(camera: any, domElement: any);
    update(): void;
    dispose(): void;
  }
}

