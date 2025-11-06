// Camera utilities: lookAt and simple orbit controller

function lookAt(eye, target, up) {
    const zAxis = Vec3.normalize(Vec3.subtract(eye, target));
    const xAxis = Vec3.normalize(Vec3.cross(up, zAxis));
    const yAxis = Vec3.cross(zAxis, xAxis);

    const out = new Float32Array(16);
    out[0] = xAxis[0]; out[1] = yAxis[0]; out[2] = zAxis[0]; out[3] = 0;
    out[4] = xAxis[1]; out[5] = yAxis[1]; out[6] = zAxis[1]; out[7] = 0;
    out[8] = xAxis[2]; out[9] = yAxis[2]; out[10]= zAxis[2]; out[11]= 0;
    out[12]= -(xAxis[0]*eye[0] + xAxis[1]*eye[1] + xAxis[2]*eye[2]);
    out[13]= -(yAxis[0]*eye[0] + yAxis[1]*eye[1] + yAxis[2]*eye[2]);
    out[14]= -(zAxis[0]*eye[0] + zAxis[1]*eye[1] + zAxis[2]*eye[2]);
    out[15]= 1;
    return out;
}

function orbitToEye(thetaDeg, phiDeg, distance, target=[0,0,0]) {
    const t = thetaDeg * Math.PI/180;
    const p = phiDeg * Math.PI/180;
    const x = distance * Math.cos(p) * Math.cos(t);
    const y = distance * Math.sin(p);
    const z = distance * Math.cos(p) * Math.sin(t);
    return [target[0]+x, target[1]+y, target[2]+z];
}

if (typeof window !== "undefined") {
    window.lookAt = lookAt;
    window.orbitToEye = orbitToEye;
}


