import * as THREE from 'three';
import type { GeoFrame, Vec3 } from './frame';

// Thousands of the same few models, drawn by the GPU in one go, on the globe. Their matrices come from
// GeoFrame.place and are relative to the map centre of that moment; the group moves them along until
// they are worked out anew, so that does not have to happen every frame. Far side: an invisible Earth
// in the depth buffer hides them, also between two updates.

interface Slot {
  mesh: THREE.InstancedMesh;
  count: number;
}

export class GeoInstances {
  readonly object = new THREE.Group();
  private slots = new Map<string, Slot>();
  private material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  private occluder = new THREE.Mesh(new THREE.SphereGeometry(0.998, 64, 48), new THREE.MeshBasicMaterial({ colorWrite: false }));
  private base: Vec3 = [0, 0, 0];
  private capacity = 0;
  private colour = new THREE.Color();

  constructor(private geometries: Record<string, THREE.BufferGeometry>) {
    this.occluder.renderOrder = -1;
    this.occluder.frustumCulled = false;
    this.object.add(this.occluder);
  }

  /** A new set of up to `count` objects, with matrices of this frame. */
  start(frame: GeoFrame, count: number) {
    this.base = [frame.origin[0], frame.origin[1], frame.origin[2]];
    if (count > this.capacity) {
      this.capacity = Math.ceil(count * 1.5);
      for (const slot of this.slots.values()) {
        this.object.remove(slot.mesh);
        slot.mesh.dispose();
      }
      this.slots.clear();
    }
    for (const slot of this.slots.values()) slot.count = 0;
  }

  add(key: string, matrix: THREE.Matrix4, color: number) {
    let slot = this.slots.get(key);
    if (!slot) {
      const mesh = new THREE.InstancedMesh(this.geometries[key], this.material, this.capacity);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.object.add(mesh);
      slot = { mesh, count: 0 };
      this.slots.set(key, slot);
    }
    slot.mesh.setMatrixAt(slot.count, matrix);
    slot.mesh.setColorAt(slot.count, this.colour.set(color));
    slot.count++;
  }

  finish() {
    for (const { mesh, count } of this.slots.values()) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Every frame: the matrices stay right when the map centre moved since they were worked out. */
  update(frame: GeoFrame) {
    const [b, o] = [this.base, frame.origin];
    for (const { mesh } of this.slots.values()) mesh.position.set(b[0] - o[0], b[1] - o[1], b[2] - o[2]);
    this.occluder.position.set(-o[0], -o[1], -o[2]);
  }

  dispose() {
    for (const { mesh } of this.slots.values()) mesh.dispose();
    for (const geometry of Object.values(this.geometries)) geometry.dispose();
    this.material.dispose();
    this.occluder.geometry.dispose();
    (this.occluder.material as THREE.Material).dispose();
  }
}
