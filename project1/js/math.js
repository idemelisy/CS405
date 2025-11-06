// Minimal 4x4 matrix utilities (column-major, WebGL-friendly)

const Mat4 = {
    identity() {
        return new Float32Array([
            1,0,0,0,
            0,1,0,0,
            0,0,1,0,
            0,0,0,1
        ]);
    },
    multiply(a, b) {
        const out = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                out[c*4 + r] = a[0*4 + r]*b[c*4 + 0] + a[1*4 + r]*b[c*4 + 1] + a[2*4 + r]*b[c*4 + 2] + a[3*4 + r]*b[c*4 + 3];
            }
        }
        return out;
    },
    translate(tx, ty, tz) {
        const m = Mat4.identity();
        m[12] = tx; m[13] = ty; m[14] = tz;
        return m;
    },
    scale(sx, sy, sz) {
        const m = Mat4.identity();
        m[0] = sx; m[5] = sy; m[10] = sz;
        return m;
    },
    rotateX(deg) {
        const rad = deg * Math.PI/180;
        const c = Math.cos(rad), s = Math.sin(rad);
        return new Float32Array([
            1,0,0,0,
            0,c,s,0,
            0,-s,c,0,
            0,0,0,1
        ]);
    },
    rotateY(deg) {
        const rad = deg * Math.PI/180;
        const c = Math.cos(rad), s = Math.sin(rad);
        return new Float32Array([
            c,0,-s,0,
            0,1,0,0,
            s,0,c,0,
            0,0,0,1
        ]);
    },
    rotateZ(deg) {
        const rad = deg * Math.PI/180;
        const c = Math.cos(rad), s = Math.sin(rad);
        return new Float32Array([
            c,s,0,0,
            -s,c,0,0,
            0,0,1,0,
            0,0,0,1
        ]);
    },
    perspective(fovDeg, aspect, near, far) {
        const f = 1/Math.tan((fovDeg*Math.PI/180)/2);
        const nf = 1/(near - far);
        const out = new Float32Array(16);
        out[0] = f/aspect; out[1]=0; out[2]=0; out[3]=0;
        out[4] = 0; out[5]=f; out[6]=0; out[7]=0;
        out[8] = 0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
        out[12]=0; out[13]=0; out[14]=(2*far*near)*nf; out[15]=0;
        return out;
    },
    ortho(l, r, b, t, n, f) {
        const out = new Float32Array(16);
        out[0] = 2/(r-l); out[1]=0; out[2]=0; out[3]=0;
        out[4] = 0; out[5]=2/(t-b); out[6]=0; out[7]=0;
        out[8] = 0; out[9]=0; out[10]=-2/(f-n); out[11]=0;
        out[12]=-(r+l)/(r-l); out[13]=-(t+b)/(t-b); out[14]=-(f+n)/(f-n); out[15]=1;
        return out;
    },
};

// Simple vec utilities for lookAt
const Vec3 = {
    normalize(v) {
        const len = Math.hypot(v[0], v[1], v[2]);
        return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0,0,0];
    },
    subtract(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; },
    cross(a, b) {
        return [
            a[1]*b[2]-a[2]*b[1],
            a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0]
        ];
    }
};

if (typeof window !== "undefined") {
    window.Mat4 = Mat4;
    window.Vec3 = Vec3;
}


