// Rendering: WebGL init, shaders, cube buffers, draw with MVP

const Renderer = (function(){
    let gl, canvas;
    let program;
    let aPosLoc, aColLoc;
    let uModelLoc, uViewLoc, uProjLoc;
    let vbo, cbo, ibo;
    let indexCount = 0;

    const vsSource = `
        attribute vec3 a_position;
        attribute vec3 a_color;
        varying vec3 v_color;
        uniform mat4 u_model;
        uniform mat4 u_view;
        uniform mat4 u_proj;
        void main(){
            v_color = a_color;
            gl_Position = u_proj * u_view * u_model * vec4(a_position, 1.0);
        }
    `;

    const fsSource = `
        precision mediump float;
        varying vec3 v_color;
        void main(){
            gl_FragColor = vec4(v_color, 1.0);
        }
    `;

    function createShader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }

    function createProgram(vs, fs) {
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        return p;
    }

    function initGL(glcanvas) {
        canvas = glcanvas;
        gl = canvas.getContext('webgl');
        if (!gl) throw new Error('WebGL not supported');
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0,0,0,1);

        const vs = createShader(gl.VERTEX_SHADER, vsSource);
        const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
        program = createProgram(vs, fs);
        gl.useProgram(program);

        aPosLoc = gl.getAttribLocation(program, 'a_position');
        aColLoc = gl.getAttribLocation(program, 'a_color');
        uModelLoc = gl.getUniformLocation(program, 'u_model');
        uViewLoc = gl.getUniformLocation(program, 'u_view');
        uProjLoc = gl.getUniformLocation(program, 'u_proj');

        initCube();
        resize();
    }

    function initCube() {
        // Cube positions (8 unique) and colors per vertex
        const positions = new Float32Array([
            -1,-1,-1,  1,-1,-1,  1, 1,-1, -1, 1,-1, // back
            -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1  // front
        ]);
        const colors = new Float32Array([
            1,0,0,  0,1,0,  0,0,1,  1,1,0,
            1,0,1,  0,1,1,  1,1,1,  0.5,0.5,0.5
        ]);
        const indices = new Uint16Array([
            0,1,2, 0,2,3, // back
            4,6,5, 4,7,6, // front
            4,5,1, 4,1,0, // bottom
            3,2,6, 3,6,7, // top
            1,5,6, 1,6,2, // right
            4,0,3, 4,3,7  // left
        ]);
        indexCount = indices.length;

        vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);

        cbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(aColLoc);
        gl.vertexAttribPointer(aColLoc, 3, gl.FLOAT, false, 0, 0);

        ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(320, Math.floor(rect.width * dpr));
        const h = Math.max(240, Math.floor(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw(model, view, proj) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(uModelLoc, false, model);
        gl.uniformMatrix4fv(uViewLoc, false, view);
        gl.uniformMatrix4fv(uProjLoc, false, proj);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }

    return { initGL, resize, draw };
})();

if (typeof window !== 'undefined') {
    window.Renderer = Renderer;
}


