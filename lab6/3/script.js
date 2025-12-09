let vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute vec2 aTexCoord;
uniform mat4 uMVP;
varying vec3 vColor;
varying vec2 vTexCoord;
void main() {
    vColor = aColor;
    vTexCoord = aTexCoord;
    gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;

let fragmentShaderSource = `
precision mediump float;
varying vec3 vColor;
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform int uUseTexture;
void main() {
    if (uUseTexture == 1) {
        gl_FragColor = texture2D(uTexture, vTexCoord);
    } else {
        gl_FragColor = vec4(vColor, 1.0);
    }
}
`;

function createShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("Shader compile error:", gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    let vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    let fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    let program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log("Program link error:", gl.getProgramInfoLog(program));
    }
    return program;
}

function bezierPoint(t) {
    let p0r = 0.05, p0z = -0.8;
    let p1r = 0.3,  p1z = -0.4;
    let p2r = 0.25, p2z = 0.2;
    let p3r = 0.08, p3z = 0.8;
    let mt = 1 - t;
    let mt2 = mt * mt;
    let t2 = t * t;
    let b0 = mt2 * mt;
    let b1 = 3 * mt2 * t;
    let b2 = 3 * mt * t2;
    let b3 = t2 * t;
    let r = b0 * p0r + b1 * p1r + b2 * p2r + b3 * p3r;
    let z = b0 * p0z + b1 * p1z + b2 * p2z + b3 * p3z;
    return { r: r, z: z };
}

const TESSELLATION_LEVELS = {
    1: { curveSteps: 8,  baseSlices: 16,  name: "Low" },
    2: { curveSteps: 16, baseSlices: 32,  name: "Medium" },
    3: { curveSteps: 32, baseSlices: 64, name: "High" }
};

function generateMesh(angleDegrees, tessLevel) {
    let tess = TESSELLATION_LEVELS[tessLevel];
    let curveSteps = tess.curveSteps;
    let slices = Math.max(3, Math.floor(tess.baseSlices * angleDegrees / 360));
    let sweepRad = angleDegrees * Math.PI / 180;

    let vertexCount = (curveSteps + 1) * (slices + 1);
    let positions = new Float32Array(vertexCount * 3);
    let colors    = new Float32Array(vertexCount * 3);
    let texcoords = new Float32Array(vertexCount * 2);
    let indices   = new Uint16Array(curveSteps * slices * 6);

    let zMin = -0.8;
    let zMax =  0.8;
    let zRange = zMax - zMin;

    for (let i = 0; i <= curveSteps; i++) {
        let t = i / curveSteps;
        let p = bezierPoint(t);
        for (let j = 0; j <= slices; j++) {
            //convert cylindrical points to cartesian!
            let theta = sweepRad * j / slices;
            let x = p.r * Math.cos(theta);
            let y = p.r * Math.sin(theta);
            let z = p.z;

            let vIndex = i * (slices + 1) + j;
            let pi = vIndex * 3;
            positions[pi]  = x;
            positions[pi + 1] = y;
            positions[pi + 2] = z;

            let h = (z - zMin) / zRange;
            colors[pi] = 1.0;
            colors[pi + 1] = h;
            colors[pi + 2] = 1.0 - h;

            let ti = vIndex * 2;
            //for uv mapping!
            let u = j / slices;
            let v = (z - zMin) / zRange;
            texcoords[ti] = u;
            texcoords[ti + 1] = v;
        }
    }

    let k = 0;
    for (let i = 0; i < curveSteps; i++) {
        for (let j = 0; j < slices; j++) {
            let i0 = i * (slices + 1) + j;
            let i1 = i0 + 1;
            let i2 = i0 + (slices + 1);
            let i3 = i2 + 1;

            indices[k++] = i0;
            indices[k++] = i2;
            indices[k++] = i1;

            indices[k++] = i1;
            indices[k++] = i2;
            indices[k++] = i3;
        }
    }

    let triangleCount = curveSteps * slices * 2;
    return { 
        positions: positions, 
        colors: colors, 
        texcoords: texcoords, 
        indices: indices,
        vertexCount: vertexCount,
        triangleCount: triangleCount
    };
}

function mat4Perspective(out, fovy, aspect, near, far) {
    let f = 1.0 / Math.tan(fovy / 2);
    let nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = 2 * far * near * nf;
    out[15] = 0;
}

function mat4LookAt(out, eye, center, up) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;

    z0 = eye[0] - center[0];
    z1 = eye[1] - center[1];
    z2 = eye[2] - center[2];
    len = Math.hypot(z0, z1, z2);
    z0 /= len; z1 /= len; z2 /= len;

    x0 = up[1] * z2 - up[2] * z1;
    x1 = up[2] * z0 - up[0] * z2;
    x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    x0 /= len; x1 /= len; x2 /= len;

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
}

function mat4Multiply(out, a, b) {
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c * 4 + r] =
                a[0 * 4 + r] * b[c * 4 + 0] +
                a[1 * 4 + r] * b[c * 4 + 1] +
                a[2 * 4 + r] * b[c * 4 + 2] +
                a[3 * 4 + r] * b[c * 4 + 3];
        }
    }
}

function mat4RotateZ(out, angle) {
    let c = Math.cos(angle);
    let s = Math.sin(angle);
    out[0] = c;  out[1] = s;  out[2] = 0; out[3] = 0;
    out[4] = -s; out[5] = c;  out[6] = 0; out[7] = 0;
    out[8] = 0;  out[9] = 0;  out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
}

let Demo = function() {
    let canvas = document.getElementById("canvas");
    let gl = canvas.getContext("webgl");
    if (!gl) {
        console.log("no WebGL for you!");
        return;
    }

    let program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    let positionBuffer = gl.createBuffer();
    let colorBuffer  = gl.createBuffer();
    let texcoordBuffer = gl.createBuffer();
    let indexBuffer  = gl.createBuffer();
    let indexCount = 0;

    let aPositionLocation = gl.getAttribLocation(program, "aPosition");
    let aColorLocation  = gl.getAttribLocation(program, "aColor");
    let aTexCoordLocation = gl.getAttribLocation(program, "aTexCoord");
    let uMVPLocation  = gl.getUniformLocation(program, "uMVP");
    let uTextureLocation  = gl.getUniformLocation(program, "uTexture");
    let uUseTextureLocation = gl.getUniformLocation(program, "uUseTexture");

    let sweepInput = document.getElementById("sweep");
    let texInput = document.getElementById("texInput");
    let tessInput  = document.getElementById("tessellation");
    let wireframeInput = document.getElementById("wireframe");
    let statsDisplay = document.getElementById("stats");

    let proj = new Float32Array(16);
    let view = new Float32Array(16);
    let pv = new Float32Array(16);
    let model = new Float32Array(16);
    let mvp = new Float32Array(16);

    let aspect = canvas.width / canvas.height;
    mat4Perspective(proj, Math.PI / 3, aspect, 0.1, 20.0);

    let eye = [2.5, 2.5, 1.5];
    let center = [0.0, 0.0, 0.0];
    let up = [0.0, 0.0, 1.0];
    mat4LookAt(view, eye, center, up);
    mat4Multiply(pv, proj, view);

    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    let whitePixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, whitePixel); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let useTexture = 0;
    let wireframeMode = false;
    let currentTessLevel = 2;
    let currentTriangleCount = 0;
    let currentVertexCount = 0;

    gl.uniform1i(uUseTextureLocation, useTexture);
    gl.uniform1i(uTextureLocation, 0);

    texInput.onchange = function(e) {
        let file = e.target.files[0];
        if (!file) return;
        let reader = new FileReader();
        reader.onload = function(ev) {
            let img = new Image();
            img.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.generateMipmap(gl.TEXTURE_2D);
                useTexture = 1;
                gl.uniform1i(uUseTextureLocation, useTexture);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    function updateStats() {
        let tessName = TESSELLATION_LEVELS[currentTessLevel].name;
        statsDisplay.textContent = `Tessellation: ${tessName} | Vertices: ${currentVertexCount} | Triangles: ${currentTriangleCount}`;
    }

    function updateGeometry() {
        let angle = parseFloat(sweepInput.value);
        currentTessLevel = parseInt(tessInput.value);
        let mesh = generateMesh(angle, currentTessLevel);
        indexCount = mesh.indices.length;
        currentTriangleCount = mesh.triangleCount;
        currentVertexCount = mesh.vertexCount;

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.texcoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

        updateStats();
    }

    function drawScene(time) {
        let rotation = time * 0.001;
        mat4RotateZ(model, rotation);
        mat4Multiply(mvp, pv, model);
        gl.uniformMatrix4fv(uMVPLocation, false, mvp);
        gl.uniform1i(uUseTextureLocation, wireframeMode ? 0 : useTexture);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.vertexAttribPointer(aColorLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        
        if (wireframeMode) {
            for (let i = 0; i < indexCount; i += 3) {
                gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
            }
        } else {
            gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
        }
        requestAnimationFrame(drawScene);
    }

    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aColorLocation);
    gl.enableVertexAttribArray(aTexCoordLocation);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.95, 0.95, 0.95, 1.0);

    sweepInput.oninput = updateGeometry;
    tessInput.oninput = updateGeometry;
    wireframeInput.onchange = function() {
        wireframeMode = wireframeInput.checked;
    };

    updateGeometry();
    requestAnimationFrame(drawScene);
};