import * as THREE from "three";
import type { SlabBounds } from "./heightmap";

// The GCodeViewer world has Z-up (camera.up = (0,0,1)).
// GCode X → Three.js X, GCode Y → Three.js Y, GCode Z → Three.js Z.
//
// PlaneGeometry(width, depth) is in the XY plane — already horizontal with Z-up. No rotation needed.
// PlaneGeometry vertex ordering: vertices[iy*res+ix] has
//   vertex.x = ix * width/(res-1) - width/2         → GCode X = xMid + vertex.x
//   vertex.y = -(iy * depth/(res-1) - depth/2)      → iy=0 is yMax, iy=res-1 is yMin
//
// Heightmap indexing: heightmap[hy*res+hx] covers
//   hx=0..res-1 → GCode X = xMin..xMax (same direction as vertex ix)
//   hy=0..res-1 → GCode Y = yMin..yMax (OPPOSITE direction to vertex iy)
//
// Therefore vertex at (ix,iy) → heightmap[(res-1-iy)*res+ix]

export type SlabHandle = {
  group: THREE.Group;
  topMesh: THREE.Mesh;
  topPositionAttr: THREE.BufferAttribute;
  slabBounds: SlabBounds;
  resolution: number;
};

let sharedWoodTexture: THREE.CanvasTexture | null = null;

function createWoodTexture(): THREE.CanvasTexture {
  if (sharedWoodTexture) return sharedWoodTexture;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(0, 0, size, size);

  const stripeCount = Math.floor(40 + Math.random() * 20);
  for (let i = 0; i < stripeCount; i++) {
    const y = Math.random() * size;
    const lineWidth = 1 + Math.random() * 2;
    const r = Math.floor(139 + (Math.random() - 0.5) * 40);
    const g = Math.floor(94 + (Math.random() - 0.5) * 30);
    const b = Math.floor(60 + (Math.random() - 0.5) * 20);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 20 + Math.random() * 60;
    const angle = (Math.random() - 0.5) * 0.3;
    const r = Math.floor(100 + Math.random() * 80);
    const g = Math.floor(60 + Math.random() * 50);
    const b = Math.floor(30 + Math.random() * 40);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`;
    ctx.lineWidth = 0.5 + Math.random() * 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + len * 0.5 * Math.cos(angle),
      y + len * 0.5 * Math.sin(angle) * 0.1,
      x + len * Math.cos(angle * 0.5),
      y + len * 0.15
    );
    ctx.stroke();
  }

  sharedWoodTexture = new THREE.CanvasTexture(canvas);
  return sharedWoodTexture;
}

export function createMaterialSlab(slabBounds: SlabBounds, resolution: number): SlabHandle {
  const group = new THREE.Group();
  group.name = "gviewer:sim3d-slab";

  const width = slabBounds.xMax - slabBounds.xMin;
  const depth = slabBounds.yMax - slabBounds.yMin;
  const slabHeight = slabBounds.zTop - slabBounds.zBot;
  const xMid = (slabBounds.xMin + slabBounds.xMax) / 2;
  const yMid = (slabBounds.yMin + slabBounds.yMax) / 2;
  const zMid = (slabBounds.zBot + slabBounds.zTop) / 2;

  const woodTex = createWoodTexture();
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(width / 100, depth / 100);

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.FrontSide,
  });

  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x7a5230,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const bottomMat = new THREE.MeshStandardMaterial({
    color: 0x6b4826,
    roughness: 0.9,
    metalness: 0.0,
  });

  // --- Top surface ---
  // PlaneGeometry is already in the XY plane (horizontal with Z-up). No rotation needed.
  const topGeo = new THREE.PlaneGeometry(width, depth, resolution - 1, resolution - 1);
  const vertCount = resolution * resolution;
  const positions = new Float32Array(vertCount * 3);

  // Copy XY from geometry, Z starts at 0 (mesh sits at zTop)
  const srcPos = topGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3]     = srcPos.getX(i);
    positions[i * 3 + 1] = srcPos.getY(i);
    positions[i * 3 + 2] = 0;
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.usage = THREE.DynamicDrawUsage;
  topGeo.setAttribute("position", posAttr);
  topGeo.computeVertexNormals();

  const topMesh = new THREE.Mesh(topGeo, woodMat);
  topMesh.name = "gviewer:sim3d-top";
  // Z-up world: GCode Z → position.z
  topMesh.position.set(xMid, yMid, slabBounds.zTop);
  group.add(topMesh);

  // --- Side walls (baked rotations — no mesh.rotation, avoids Euler composition ambiguity) ---
  // Z-up world: vertical walls span either (X,Z) or (Y,Z).
  //
  // North/South walls span X and Z:
  //   PlaneGeometry(width, slabHeight): x_pg→X, y_pg→Y, z_pg=0
  //   geo.rotateX(PI/2): (x,y,0)→(x,0,y)  →  x_pg→worldX ✓, y_pg→worldZ ✓
  //   Position at (xMid, yEdge, zMid) — no mesh rotation needed.
  //
  // East/West walls span Y and Z:
  //   PlaneGeometry(slabHeight, depth): x_pg spans slabHeight, y_pg spans depth
  //   geo.rotateY(-PI/2): (x,y,0)→(0,y,x)  →  x_pg→worldZ ✓, y_pg→worldY ✓
  //   Position at (xEdge, yMid, zMid) — no mesh rotation needed.

  const northGeo = new THREE.PlaneGeometry(width, slabHeight);
  northGeo.rotateX(Math.PI / 2);
  const sideN = new THREE.Mesh(northGeo, sideMat);
  sideN.position.set(xMid, slabBounds.yMax, zMid);
  group.add(sideN);

  const southGeo = new THREE.PlaneGeometry(width, slabHeight);
  southGeo.rotateX(Math.PI / 2);
  const sideS = new THREE.Mesh(southGeo, sideMat);
  sideS.position.set(xMid, slabBounds.yMin, zMid);
  group.add(sideS);

  const eastGeo = new THREE.PlaneGeometry(slabHeight, depth);
  eastGeo.rotateY(-Math.PI / 2);
  const sideE = new THREE.Mesh(eastGeo, sideMat);
  sideE.position.set(slabBounds.xMax, yMid, zMid);
  group.add(sideE);

  const westGeo = new THREE.PlaneGeometry(slabHeight, depth);
  westGeo.rotateY(-Math.PI / 2);
  const sideW = new THREE.Mesh(westGeo, sideMat);
  sideW.position.set(slabBounds.xMin, yMid, zMid);
  group.add(sideW);

  // Bottom: in XY plane at zBot
  const bottomMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), bottomMat);
  bottomMesh.position.set(xMid, yMid, slabBounds.zBot);
  group.add(bottomMesh);

  return { group, topMesh, topPositionAttr: posAttr, slabBounds, resolution };
}

export function updateSlabTopSurface(handle: SlabHandle, heightmap: Float32Array): void {
  const { topPositionAttr, slabBounds, resolution } = handle;
  const count = resolution * resolution;

  // Top mesh is at position.z = zTop (in world space).
  // vertex.z = worldZ - zTop = heightmap[hmIdx] - zTop
  //
  // PlaneGeometry vertex at linear index i = iy*resolution + ix:
  //   vertex.y = -(iy * depth/(res-1) - depth/2)  → iy=0 is yMax, iy=res-1 is yMin
  // Heightmap hy=0 is yMin, hy=res-1 is yMax → invert: hmIdx = (res-1-iy)*res + ix
  for (let i = 0; i < count; i++) {
    const iy = Math.floor(i / resolution);
    const ix = i % resolution;
    const hmIdx = (resolution - 1 - iy) * resolution + ix;
    topPositionAttr.setZ(i, heightmap[hmIdx] - slabBounds.zTop);
  }
  topPositionAttr.needsUpdate = true;
  handle.topMesh.geometry.computeVertexNormals();
}

export function disposeSlabHandle(handle: SlabHandle): void {
  handle.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if ((m as THREE.MeshStandardMaterial).map) {
            (m as THREE.MeshStandardMaterial).map!.dispose();
          }
          m.dispose();
        });
      } else {
        if ((mat as THREE.MeshStandardMaterial).map) {
          (mat as THREE.MeshStandardMaterial).map!.dispose();
        }
        mat.dispose();
      }
    }
  });
  // Shared wood texture is not disposed here — it's reused across slab instances
}
