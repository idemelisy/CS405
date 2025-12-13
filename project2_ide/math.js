
// Requires glMatrix (loaded in index.html).

// Resolve mat4/vec3 from glMatrix (CDN) even if they live under glMatrix namespace.
const mat4 = window.mat4 || (window.glMatrix && window.glMatrix.mat4);
const vec3 = window.vec3 || (window.glMatrix && window.glMatrix.vec3);
if (!mat4 || !vec3) {
  throw new Error("glMatrix mat4/vec3 not found. Ensure gl-matrix-min.js is loaded before math.js");
}

const Mat4 = {
  create: () => mat4.create(),
  identity: (out) => mat4.identity(out || mat4.create()),
  perspective: (out, fovy, aspect, near, far) => mat4.perspective(out, fovy, aspect, near, far),
  lookAt: (out, eye, center, up) => mat4.lookAt(out, eye, center, up),
  multiply: (out, a, b) => mat4.multiply(out, a, b),
  translate: (out, a, v) => mat4.translate(out, a, v),
  rotateX: (out, a, r) => mat4.rotateX(out, a, r),
  rotateY: (out, a, r) => mat4.rotateY(out, a, r),
  rotateZ: (out, a, r) => mat4.rotateZ(out, a, r),
  invert: (out, a) => mat4.invert(out, a),
  transpose: (out, a) => mat4.transpose(out, a),
};

const Vec3 = {
  create: () => vec3.create(),
  normalize: (out, a) => vec3.normalize(out, a),
  subtract: (out, a, b) => vec3.subtract(out, a, b),
  scale: (out, a, s) => vec3.scale(out, a, s),
  add: (out, a, b) => vec3.add(out, a, b),
  dot: (a, b) => vec3.dot(a, b),
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function degToRad(d) {
  return (d * Math.PI) / 180;
}

// Simple orbit camera helper
class OrbitCamera {
  constructor() {
    this.distance = 8;
    this.minDistance = 2;
    this.maxDistance = 30;
    this.azimuth = 40 * Math.PI / 180;  // 40 degrees
    this.elevation = 23 * Math.PI / 180; // 23 degrees
    this.target = vec3.fromValues(0, 0, 0);
  }

  dolly(delta) {
    this.distance = clamp(this.distance * (1 + delta * 0.1), this.minDistance, this.maxDistance);
  }

  rotate(dx, dy) {
    this.azimuth += dx * 0.005;
    this.elevation = clamp(this.elevation + dy * 0.005, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  }

  reset() {
    this.distance = 8;
    this.azimuth = 40 * Math.PI / 180;
    this.elevation = 23 * Math.PI / 180;
  }

  getEye() {
    const x = this.distance * Math.cos(this.elevation) * Math.sin(this.azimuth);
    const y = this.distance * Math.sin(this.elevation);
    const z = this.distance * Math.cos(this.elevation) * Math.cos(this.azimuth);
    const eye = vec3.fromValues(x, y, z);
    vec3.add(eye, eye, this.target);
    return eye;
  }

  viewMatrix(out) {
    const eye = this.getEye();
    return Mat4.lookAt(out, eye, this.target, vec3.fromValues(0, 1, 0));
  }
}

window.MathHelpers = { Mat4, Vec3, clamp, degToRad, OrbitCamera };

