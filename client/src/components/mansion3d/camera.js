import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Fit every corner in camera space, including tall walls, at any screen ratio.
export function fitDistance(box, direction, aspect, fov = 38, padding = 1.15) {
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
  const up = forward.clone().cross(right).normalize();
  const center = box.getCenter(new THREE.Vector3());
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanX = tanY * aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(center);
    distance = Math.max(distance,
      point.dot(forward) + Math.abs(point.dot(right)) * padding / tanX,
      point.dot(forward) + Math.abs(point.dot(up)) * padding / tanY);
  }
  return distance;
}

export function createCamera(camera, canvas, motion) {
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = true;
  controls.enableDamping = !motion.matches;
  controls.dampingFactor = .13;
  controls.rotateSpeed = .38;
  controls.zoomSpeed = 1.8;
  controls.enableZoom = false;
  controls.minPolarAngle = .55;
  controls.maxPolarAngle = 1.0;
  let goal = null, box = new THREE.Box3(), mode = 'map', fitted = 40;
  let direction = new THREE.Vector3(.25, 1.65, 1).normalize();
  let view = 'orbit';
  function frame(bounds, nextMode, immediate = false) {
    box.copy(bounds); mode = nextMode;
    const target = bounds.getCenter(new THREE.Vector3());
    fitted = fitDistance(bounds, direction, camera.aspect, camera.fov, 1.02);
    controls.minDistance = mode === 'map' ? 3 : 1.8;
    controls.maxDistance = fitted * 2;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = .01; controls.maxPolarAngle = 1.45;
    const position = direction.clone().multiplyScalar(fitted).add(target);
    // Clear OrbitControls' momentum so a preset cannot inherit an old drag.
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
    if (immediate || motion.matches) { controls.target.copy(target); camera.position.copy(position); controls.update(); goal = null; }
    else goal = { position, target };
  }
  function zoom(closer, factor = closer ? .78 : 1.28) {
    const target = goal?.target.clone() || controls.target.clone();
    const offset = (goal?.position || camera.position).clone().sub(target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    const position = offset.normalize().multiplyScalar(distance).add(target);
    if (motion.matches) { camera.position.copy(position); controls.update(); }
    else goal = { position, target };
  }
  function rotate(sign) {
    const target = goal?.target.clone() || controls.target.clone();
    const offset = (goal?.position || camera.position).clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = THREE.MathUtils.clamp(spherical.theta + sign * .2, controls.minAzimuthAngle, controls.maxAzimuthAngle);
    const position = new THREE.Vector3().setFromSpherical(spherical).add(target);
    if (motion.matches) { camera.position.copy(position); controls.update(); }
    else goal = { position, target };
  }
  function wheel(event) {
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    zoom(pixels < 0, Math.exp(THREE.MathUtils.clamp(pixels * .003, -.65, .65)));
  }
  canvas.addEventListener('wheel', wheel, { passive: false });
  const cancel = () => { goal = null; };
  controls.addEventListener('start', cancel);
  return {
    controls, frame, zoom, rotate,
    setView(next, point) {
      view = next; controls.enablePan = next !== 'walk';
      direction = next === 'top' ? new THREE.Vector3(0, 1, .001).normalize() : new THREE.Vector3(.25, 1.65, 1).normalize();
      frame(box, mode, true);
      if (next === 'walk' && point) {
        controls.target.copy(point).add(new THREE.Vector3(0, .65, 0));
        camera.position.copy(controls.target).add(new THREE.Vector3(0, 5, 6));
        controls.update();
      }
    },
    follow(point) {
      if (view !== 'walk') return;
      const target = point.clone().add(new THREE.Vector3(0, .65, 0));
      const delta = target.clone().sub(controls.target);
      camera.position.add(delta); controls.target.copy(target);
      if (goal) { goal.position.add(delta); goal.target.copy(target); }
    },
    reset: () => frame(box, mode),
    resize: () => frame(box, mode, true),
    update(dt) {
      if (goal) {
        const fraction = 1 - Math.exp(-dt * 14);
        camera.position.lerp(goal.position, fraction); controls.target.lerp(goal.target, fraction);
        if (camera.position.distanceTo(goal.position) < .015) goal = null;
      }
      controls.update();
    },
    dispose() { canvas.removeEventListener('wheel', wheel); controls.removeEventListener('start', cancel); controls.dispose(); },
  };
}
