import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  distanceForFrustumHeight,
  fitDistanceForBounds,
  frustumHeightAtDistance,
  intersectRayWithZPlane,
  orthoDepthRange,
  orthoFrustumFor,
  perspectiveDepthRange,
} from "../src/viewer/camera/camera";

describe("frustum height <-> distance", () => {
  it("round-trips across fovs and distances", () => {
    for (const fov of [20, 45, 90]) {
      for (const distance of [1, 37.5, 200, 12000]) {
        const height = frustumHeightAtDistance(distance, fov);
        expect(distanceForFrustumHeight(height, fov)).toBeCloseTo(distance, 6);
      }
    }
  });

  it("frames exactly twice the height at twice the distance", () => {
    expect(frustumHeightAtDistance(200, 45)).toBeCloseTo(frustumHeightAtDistance(100, 45) * 2, 9);
  });

  it("matches the closed form for a 90 degree fov", () => {
    // tan(45deg) === 1, so the visible height is exactly 2 * distance.
    expect(frustumHeightAtDistance(50, 90)).toBeCloseTo(100, 6);
  });
});

describe("fitDistanceForBounds", () => {
  // Pins the formula previously inlined in GCodeViewer's ViewCube snap handler
  // and startCameraFocus, so the extraction is provably behaviour-preserving.
  const legacy = (size: { x: number; y: number; z: number }, fov: number): number => {
    const halfMax = Math.max(size.x, size.y, 1) / 2;
    const fovRadians = THREE.MathUtils.degToRad(fov);
    return (halfMax / Math.tan(fovRadians / 2)) * 1.25 + size.z;
  };

  it("reproduces the previous inline formula", () => {
    const cases = [
      { x: 300, y: 200, z: 25 },
      { x: 10, y: 10, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1200, y: 40, z: 100 },
    ];
    for (const size of cases) {
      expect(fitDistanceForBounds(size, 45)).toBeCloseTo(legacy(size, 45), 9);
    }
  });

  it("floors the in-plane extent at 1 so an empty model still gets a standoff", () => {
    expect(fitDistanceForBounds({ x: 0, y: 0, z: 0 }, 45)).toBeGreaterThan(0);
  });

  it("adds model height to the standoff", () => {
    const flat = fitDistanceForBounds({ x: 100, y: 100, z: 0 }, 45);
    const tall = fitDistanceForBounds({ x: 100, y: 100, z: 30 }, 45);
    expect(tall - flat).toBeCloseTo(30, 9);
  });
});

describe("orthoFrustumFor", () => {
  it("is symmetric about the origin", () => {
    const f = orthoFrustumFor(200, 1.5);
    expect(f.right).toBeCloseTo(-f.left, 9);
    expect(f.top).toBeCloseTo(-f.bottom, 9);
  });

  it("frames the requested height and scales width by aspect", () => {
    const f = orthoFrustumFor(200, 2);
    expect(f.top - f.bottom).toBeCloseTo(200, 9);
    expect(f.right - f.left).toBeCloseTo(400, 9);
  });

  it("preserves vertical extent across aspect changes (the resize invariant)", () => {
    const wide = orthoFrustumFor(200, 2.5);
    const tall = orthoFrustumFor(200, 0.4);
    expect(wide.top - wide.bottom).toBeCloseTo(tall.top - tall.bottom, 9);
  });

  it("clamps degenerate height and aspect instead of collapsing", () => {
    const f = orthoFrustumFor(0, 0);
    expect(f.top).toBeGreaterThan(0);
    expect(f.right).toBeGreaterThan(0);
  });
});

describe("depth ranges", () => {
  it("keeps the perspective near/far ratio at 1:50000", () => {
    const { near, far } = perspectiveDepthRange(500);
    expect(near).toBeCloseTo(0.5, 9);
    expect(far).toBeCloseTo(25000, 9);
  });

  it("floors perspective depth on a degenerate model", () => {
    const { near, far } = perspectiveDepthRange(0);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });

  it("gives ortho a symmetric range spanning the camera standoff and the model", () => {
    const distance = 400;
    const maxDim = 250;
    const { near, far } = orthoDepthRange(distance, maxDim);
    expect(near).toBeLessThan(0);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(distance + maxDim);
    expect(near).toBeLessThan(-(distance + maxDim));
  });
});

describe("intersectRayWithZPlane", () => {
  const down = new THREE.Vector3(0, 0, -1);

  it("hits a plane in front of the origin", () => {
    const hit = intersectRayWithZPlane(new THREE.Vector3(3, 4, 10), down, 2, false);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(3, 9);
    expect(hit!.y).toBeCloseTo(4, 9);
    expect(hit!.z).toBeCloseTo(2, 9);
  });

  it("follows an angled ray to the plane", () => {
    const direction = new THREE.Vector3(1, 0, -1).normalize();
    const hit = intersectRayWithZPlane(new THREE.Vector3(0, 0, 10), direction, 0, false);
    expect(hit!.x).toBeCloseTo(10, 6);
    expect(hit!.z).toBeCloseTo(0, 6);
  });

  it("misses a plane behind the origin unless allowBehind is set", () => {
    const origin = new THREE.Vector3(3, 4, 0);
    expect(intersectRayWithZPlane(origin, down, 5, false)).toBeNull();

    const hit = intersectRayWithZPlane(origin, down, 5, true);
    expect(hit).not.toBeNull();
    expect(hit!.z).toBeCloseTo(5, 9);
    expect(hit!.x).toBeCloseTo(3, 9);
  });

  it("returns null for a ray parallel to the plane", () => {
    const parallel = new THREE.Vector3(1, 0, 0);
    expect(intersectRayWithZPlane(new THREE.Vector3(0, 0, 10), parallel, 0, true)).toBeNull();
  });

  it("does not mutate the origin it is given", () => {
    const origin = new THREE.Vector3(3, 4, 10);
    intersectRayWithZPlane(origin, down, 2, false);
    expect(origin.toArray()).toEqual([3, 4, 10]);
  });
});
