// Camera functions: lookAt and orbit camera

function lookAt(eye, target, up) {
    const z = Vec3.normalize(Vec3.subtract(eye, target));
    const x = Vec3.normalize(Vec3.cross(up, z));
    const y = Vec3.cross(z, x);

    const tx = -Vec3.dot(x, eye);
    const ty = -Vec3.dot(y, eye);
    const tz = -Vec3.dot(z, eye);

    // Column-major: col0=x, col1=y, col2=z, col3=translation
    return new Float32Array([
        x[0], x[1], x[2], 0,
        y[0], y[1], y[2], 0,
        z[0], z[1], z[2], 0,
        tx,   ty,   tz,   1
    ]);
}

function orbitToEye(thetaDeg, phiDeg, distance, target) {
    if (target === undefined) {
        target = [0, 0, 0];
    }
    const t = thetaDeg * Math.PI/180;
    const p = phiDeg * Math.PI/180;
    const x = distance * Math.cos(p) * Math.cos(t);
    const y = distance * Math.sin(p);
    const z = distance * Math.cos(p) * Math.sin(t);
    return [target[0] + x, target[1] + y, target[2] + z];
}

if (typeof window !== "undefined") {
    window.lookAt = lookAt;
    window.orbitToEye = orbitToEye;
}
