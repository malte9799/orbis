// 3d-tiles-renderer ships no type entry for these internal modules (its "exports" map would need ".js.d.ts" files).
declare module '3d-tiles-renderer/src/three/renderer/math/TileBoundingVolume.js' {
  import { Box3, Matrix4, Sphere, Vector3, Frustum } from 'three';
  export class TileBoundingVolume {
    sphere: Sphere | null;
    obb: { box: Box3; transform: Matrix4 } | null;
    regionObb: { box: Box3; transform: Matrix4 } | null;
    distanceToPoint(point: Vector3): number;
    intersectsFrustum(frustum: Frustum): boolean;
    setObbData(data: number[], transform: Matrix4): void;
    setSphereData(x: number, y: number, z: number, radius: number, transform: Matrix4): void;
    setRegionData(ellipsoid: unknown, west: number, south: number, east: number, north: number, minHeight: number, maxHeight: number): void;
  }
}
declare module '3d-tiles-renderer/src/three/renderer/math/ExtendedFrustum.js' {
  import { Frustum } from 'three';
  export class ExtendedFrustum extends Frustum {}
}
