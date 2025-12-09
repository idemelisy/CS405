const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uMVP;
    varying vec3 vColor;
    void main() {
        vColor = aColor;
        gl_Position = uMVP * vec4(aPosition, 1.0);
    }
`;

const fragmentShaderSource = `
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
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program error:', gl.getProgramInfoLog(program));
    }
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
    
    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;
    
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


function generateCube(tess) {
    const positions = [];
    const colors = [];
    const indices = [];
    
    const faces = [
        { dir: [0, 0, 1],  up: [0, 1, 0], color: [1, 0.3, 0.3] },  // front
        { dir: [0, 0, -1], up: [0, 1, 0], color: [0.3, 1, 0.3] },  // back
        { dir: [1, 0, 0],  up: [0, 1, 0], color: [0.3, 0.3, 1] },  // right
        { dir: [-1, 0, 0], up: [0, 1, 0], color: [1, 1, 0.3] },    // left
        { dir: [0, 1, 0],  up: [0, 0, -1], color: [1, 0.3, 1] },   // top
        { dir: [0, -1, 0], up: [0, 0, 1], color: [0.3, 1, 1] },    // bottom
    ];
    
    for (const face of faces) {
        const baseIndex = positions.length / 3;
        const n = face.dir;
        const u = face.up;
        // right vector = up × normal
        const r = [
            u[1] * n[2] - u[2] * n[1],
            u[2] * n[0] - u[0] * n[2],
            u[0] * n[1] - u[1] * n[0]
        ];
        
        // Generate vertices for this face
        for (let i = 0; i <= tess; i++) {
            for (let j = 0; j <= tess; j++) {
                const s = (i / tess) * 2 - 1;
                const t = (j / tess) * 2 - 1;
                positions.push(
                    n[0] + r[0] * s + u[0] * t,
                    n[1] + r[1] * s + u[1] * t,
                    n[2] + r[2] * s + u[2] * t
                );
                colors.push(...face.color);
            }
        }
        
        // Generate indices for this face
        for (let i = 0; i < tess; i++) {
            for (let j = 0; j < tess; j++) {
                const i0 = baseIndex + i * (tess + 1) + j;
                const i1 = i0 + 1;
                const i2 = i0 + (tess + 1);
                const i3 = i2 + 1;
                indices.push(i0, i2, i1, i1, i2, i3);
            }
        }
    }
    
    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices)
    };
}

function generateSphere(tess) {
    const positions = [];
    const colors = [];
    const indices = [];
    
    const stacks = tess ; 
    const slices = tess *2;
    const r = 1;
    /*
        R = radius
        p = R * sin(phi)
        x = p * cos(theta)
        y = R * cos(phi)
        z = p * sin(theta)
    */
   //think of this as slicing up a sphere! 
    for (let i = 0; i <= stacks; i++) {
        //at each iteration, our height changes!
        const phi = (i / stacks) * Math.PI; //when 0, its topmost.
        const y = r * Math.cos(phi); //accept 
        const p = r * Math.sin(phi);
        
        for (let j = 0; j <= slices; j++) {
            //draw a horizontal line wrt to height and r! 
            const theta = (j / slices) * Math.PI * 2;
            const x = p * Math.cos(theta);
            const z = p * Math.sin(theta);
            
            positions.push(x, y, z);
            
            // Color based on position --> we have no light yet
            colors.push(
                (x + 1) / 2,
                (y + 1) / 2,
                (z + 1) / 2
            );
        }
    }
    
    for (let i = 0; i < stacks; i++) {
        for (let j = 0; j < slices; j++) {
            const i0 = i * (slices + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (slices + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors), 
        indices: new Uint16Array(indices)
    };
}

//take a circle rotate it around a larger angle!
function generateDonut(tess) {
    const positions = [];
    const colors = [];
    const indices = [];
    
    const R = 0.7;  
    const r = 0.3; 
    const rings = tess;
    const sides = tess;
    
    for (let i = 0; i <= rings; i++) {
        const theta = (i / rings) * Math.PI * 2; //rotation angle of smaller circle around larger circle!
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        
        for (let j = 0; j <= sides; j++) {
            const phi = (j / sides) * Math.PI * 2; //small circle angle, 
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);
            /*
                x=(R+r*cos(phi))*cos(t)
                z=(R+r*cos(phi))*sin(t)
                y=r*sin(phi)
            */
            const x = (R + r * cosPhi) * cosTheta;
            const y = r * sinPhi;
            const z = (R + r * cosPhi) * sinTheta;
            
            positions.push(x, y, z);
            colors.push(
                (cosPhi + 1) / 2,
                (sinPhi + 1) / 2,
                (cosTheta + 1) / 2
            );
        }
    }
    
    //i = which circle 
    for (let i = 0; i < rings; i++) {
        //j = where are you on that specific circle
        for (let j = 0; j < sides; j++) {
            const i0 = i * (sides + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (sides + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices)
    };
}


function main() {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        alert('WebGL not supported!');
        return;
    }
    
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);
    
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uMVP = gl.getUniformLocation(program, 'uMVP');
    const uColor = gl.getUniformLocation(program, 'uColor');
    const uUseUniformColor = gl.getUniformLocation(program, 'uUseUniformColor');
    
    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();

    const proj = new Float32Array(16);
    const view = new Float32Array(16);
    const model = new Float32Array(16);
    const rotX = new Float32Array(16);
    const rotY = new Float32Array(16);
    const temp = new Float32Array(16);
    const mvp = new Float32Array(16);
    
    mat4Perspective(proj, Math.PI / 3, canvas.width / canvas.height, 0.1, 100);
    mat4LookAt(view, [0, 0, 4], [0, 0, 0], [0, 1, 0]);
    
    // States
    let currentMesh = null;
    let indexCount = 0;
    
    // Controls
    const shapeSelect = document.getElementById('shapeSelect');
    const tessSlider = document.getElementById('tessellation');
    const tessValue = document.getElementById('tessValue');
    const wireframeCheck = document.getElementById('wireframe');
    const solidCheck = document.getElementById('solid');
    
    const meshGenerators = {
        cube: generateCube,
        sphere: generateSphere,
        donut: generateDonut
    };
    
    function updateMesh() {
        const tess = parseInt(tessSlider.value);
        tessValue.textContent = tess;
        
        const shape = shapeSelect.value;
        currentMesh = meshGenerators[shape](tess);
        indexCount = currentMesh.indices.length;
        
        // Upload to GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, currentMesh.positions, gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, currentMesh.colors, gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, currentMesh.indices, gl.STATIC_DRAW);
        
        // Update stats
        const vertexCount = currentMesh.positions.length / 3;
        const triCount = indexCount / 3;
        const edgeCount = triCount * 3 / 2;  //just an approximation!
        
        document.getElementById('vertexCount').textContent = vertexCount;
        document.getElementById('triCount').textContent = triCount;
        document.getElementById('edgeCount').textContent = Math.round(edgeCount);
    }
    
    function render(time) {
        const t = time * 0.001;
        
        mat4RotateY(rotY, t * 0.5);
        mat4RotateX(rotX, t * 0.3);
        mat4Multiply(model, rotY, rotX);
        
        mat4Multiply(temp, view, model);
        mat4Multiply(mvp, proj, temp);
        
        gl.uniformMatrix4fv(uMVP, false, mvp);
        
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.06, 0.06, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        
        if (solidCheck.checked) {
            gl.uniform1i(uUseUniformColor, 0);  // Use vertex colors
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1, 1);
            gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
            gl.disable(gl.POLYGON_OFFSET_FILL);
        }
        
        if (wireframeCheck.checked) {
            gl.uniform1i(uUseUniformColor, 1);
            gl.uniform3f(uColor, 1.0, 1.0, 1.0); 
            
            //draws triangle!
            for (let i = 0; i < indexCount; i += 3) {
                gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
            }
        }
        
        requestAnimationFrame(render);
    }
    shapeSelect.addEventListener('change', updateMesh);
    tessSlider.addEventListener('input', updateMesh);
    updateMesh();
    requestAnimationFrame(render);
}

