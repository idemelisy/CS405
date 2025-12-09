//  NOTE: this code uses loop unrolling for matrix operations --> just an optimization trick
const vsSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uMVP;
    varying vec3 vColor;
    void main() {
        vColor = aColor;
        gl_Position = uMVP * vec4(aPosition, 1.0);
    }
`;

const fsSource = `
    precision mediump float;
    varying vec3 vColor;
    uniform vec3 uColor;
    uniform int uUseUniformColor;
    void main() {
        if (uUseUniformColor == 1) {
            gl_FragColor = vec4(uColor, 1.0);
        } else {
            gl_FragColor = vec4(vColor, 1.0);
        }
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}



function mat4Perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
}

function mat4LookAt(out, eye, center, up) {
    let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    let len = Math.hypot(z0, z1, z2);
    z0 /= len; z1 /= len; z2 /= len;
    
    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    x0 /= len; x1 /= len; x2 /= len;
    
    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;
    
    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0*eye[0] + x1*eye[1] + x2*eye[2]);
    out[13] = -(y0*eye[0] + y1*eye[1] + y2*eye[2]);
    out[14] = -(z0*eye[0] + z1*eye[1] + z2*eye[2]);
    out[15] = 1;
}

function mat4Multiply(out, a, b) {
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
            a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
    }
}

function mat4RotateY(out, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = c;  out[1] = 0; out[2] = -s; out[3] = 0;
    out[4] = 0;  out[5] = 1; out[6] = 0;  out[7] = 0;
    out[8] = s;  out[9] = 0; out[10] = c; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
}

function mat4RotateX(out, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    out[0] = 1; out[1] = 0; out[2] = 0;  out[3] = 0;
    out[4] = 0; out[5] = c; out[6] = s;  out[7] = 0;
    out[8] = 0; out[9] = -s; out[10] = c; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
}

// Main
function main() {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl');
    
    const program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    const tessSlider = document.getElementById('tessellation');
    const tessValue = document.getElementById('tessValue');
    const wireframeCheck = document.getElementById('wireframe');
    const solidCheck = document.getElementById('solid');

    const proj = new Float32Array(16);
    const view = new Float32Array(16);
    const model = new Float32Array(16);
    const rotX = new Float32Array(16);
    const rotY = new Float32Array(16);
    const temp = new Float32Array(16);
    const mvp = new Float32Array(16);

    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uMVP = gl.getUniformLocation(program, 'uMVP');
    const uColor = gl.getUniformLocation(program, 'uColor');
    const uUseUniformColor = gl.getUniformLocation(program, 'uUseUniformColor');

    mat4Perspective(proj, Math.PI / 3, canvas.width / canvas.height, 0.1, 100);
    mat4LookAt(view, [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    
    let indexCount = 0;
    
    function updateMesh() {
        const tess = parseInt(tessSlider.value);
        tessValue.textContent = tess;
        
        const mesh = generateCubeHardCoded(tess);
        indexCount = mesh.indices.length;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        
        const vertexCount = mesh.positions.length / 3;
        const triCount = mesh.indices.length / 3;
        document.getElementById('stats').textContent = 'Vertices: ' + vertexCount + ' | Triangles: ' + triCount;
    }
    
    // Render
    function render(time) {
        const t = time * 0.001;
        
        mat4RotateY(rotY, t * 0.5);
        mat4RotateX(rotX, t * 0.3);
        mat4Multiply(model, rotY, rotX);
        mat4Multiply(temp, view, model);
        mat4Multiply(mvp, proj, temp);
        
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        
        gl.uniformMatrix4fv(uMVP, false, mvp);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        if (solidCheck.checked) {
            gl.uniform1i(uUseUniformColor, 0); //assigns value to unifrom integer!
            gl.enable(gl.POLYGON_OFFSET_FILL); //add a little Z-offset to the wireframes, to counter z-fighting
            gl.polygonOffset(1, 1); //push surface's depth values a bit backwards to make wireframes appear on top.
            gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0); //read index buffer and draws triangles, 3 vals = 1 triangle.
            gl.disable(gl.POLYGON_OFFSET_FILL); //disables the offset on wireframes
        }
        if (wireframeCheck.checked) {
            gl.uniform1i(uUseUniformColor, 1);
            gl.uniform3f(uColor, 1.0, 1.0, 1.0); //send 3 floats to webgl!
            for (let i = 0; i < indexCount; i += 3) {
                gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
            }
        }
        
        requestAnimationFrame(render);
    }
    
    tessSlider.addEventListener('input', updateMesh);
    updateMesh();
    requestAnimationFrame(render);
}