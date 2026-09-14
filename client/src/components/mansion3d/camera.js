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
  controls.enablePan = false;
  controls.enableDamping = !motion.matches;
  controls.dampingFactor = .13;
  controls.rotateSpeed = .38;
  controls.zoomSpeed = .42;
  controls.minPolarAngle = .55;
  controls.maxPolarAngle = 1.0;
  let goal = null, box = new THREE.Box3(), mode = 'map', fitted = 40;
  const direction = new THREE.Vector3(.8, 1.25, 1.5).normalize();
  function frame(bounds, nextMode, immediate = false) {
    box.copy(bounds); mode = nextMode;
    const target = bounds.getCenter(new THREE.Vector3());
    fitted = fitDistance(bounds, direction, camera.aspect, camera.fov, nextMode === 'map' ? 1.14 : 1.12);
    controls.minDistance = fitted * (mode === 'map' ? .82 : .74);
    controls.maxDistance = fitted * 1.16;
    controls.minAzimuthAngle = mode === 'map' ? -.15 : -.08;
    controls.maxAzimuthAngle = mode === 'map' ? 1.1 : 1.05;
    controls.minPolarAngle = .55; controls.maxPolarAngle = mode === 'map' ? .9 : 1.08;
    const position = direction.clone().multiplyScalar(fitted).add(target);
    // Clear OrbitControls' momentum so a preset cannot inherit an old drag.
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
    if (immediate || motion.matches) { controls.target.copy(target); camera.position.copy(position); controls.update(); goal = null; }
    else goal = { position, target };
  }
  function zoom(closer) {
    const offset = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * (closer ? .88 : 1.12), controls.minDistance, controls.maxDistance);
    const position = offset.normalize().multiplyScalar(distance).add(controls.target);
    if (motion.matches) { camera.position.copy(position); controls.update(); }
    else goal = { position, target: controls.target.clone() };
  }
  function rotate(sign) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = THREE.MathUtils.clamp(spherical.theta + sign * .2, controls.minAzimuthAngle, controls.maxAzimuthAngle);
    const position = new THREE.Vector3().setFromSpherical(spherical).add(controls.target);
    if (motion.matches) { camera.position.copy(position); controls.update(); }
    else goal = { position, target: controls.target.clone() };
  }
  const cancel = () => { goal = null; };
  controls.addEventListener('start', cancel);
  return {
    controls, frame, zoom, rotate,
    reset: () => frame(box, mode),
    resize: () => frame(box, mode, true),
    update(dt) {
      if (goal) {
        const fraction = 1 - Math.exp(-dt * 8);
        camera.position.lerp(goal.position, fraction); controls.target.lerp(goal.target, fraction);
        if (camera.position.distanceTo(goal.position) < .015) goal = null;
      }
      controls.update();
    },
    dispose() { controls.removeEventListener('start', cancel); controls.dispose(); },
  };
}
