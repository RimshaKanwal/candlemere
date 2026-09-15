import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fitDistance } from './camera.js';

for (const aspect of [0.6, 1, 2.4]) {
  test(`room and mansion bounds fit the camera at aspect ${aspect}`, () => {
    for (const size of [[6, 3.5, 7], [24, 4, 25]]) {
      const box = new THREE.Box3(new THREE.Vector3(-2, -.3, -5), new THREE.Vector3(size[0] - 2, size[1] - .3, size[2] - 5));
      const direction = new THREE.Vector3(.8, 1.45, 1.5).normalize();
      const center = box.getCenter(new THREE.Vector3());
      const camera = new THREE.PerspectiveCamera(38, aspect, .1, 200);
      camera.position.copy(direction.multiplyScalar(fitDistance(box, direction, aspect)).add(center));
      camera.lookAt(center); camera.updateMatrixWorld();
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, 'every corner must remain on screen');
      }
    }
  });
}
