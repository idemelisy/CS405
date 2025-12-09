let vertexShaderText =`
    precision mediump float;
    attribute vec3 a_position;
    attribute vec3 a_color;

    // Our 3D transformation matrices
    uniform mat4 u_model;
    uniform mat4 u_view;
    uniform mat4 u_projection;
        
    varying vec3 v_color;

    void main() {
        // The order is important: Model -> View -> Projection
        gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
        v_color = a_color;
    }
`;


let fragmentShaderText =`
    precision mediump float;
    varying vec3 v_color;
    void main() {
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

const perspective = (left, right, bottom, top, near, far) => {
    const rl = 1 / (right - left);
    const tb = 1 / (top - bottom);
    const nf = 1 / (near - far);
    
    return new Float32Array([
        (2 * near) * rl, 0, 0, 0,
        0, (2 * near) * tb, 0, 0,
        (right + left) * rl, (top + bottom) * tb, (near + far) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
    ]);
};

const orthographic = (left, right, bottom, top, near, far) => {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
        
    return new Float32Array([
        -2 * lr, 0, 0, 0,
        0, -2 * bt, 0, 0,
        0, 0, 2 * nf, 0,
        (left + right) * lr, (top + bottom) * bt, (near + far) * nf, 1
    ]);
};


let cudeDemo = function() {
    let canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl");

    if(!gl) {
        console.log("WebGL not supported, falling back on experimental-webgl");
        gl = canvas.getContext("experimental-webgl");
    }

    gl.clearColor(0.75, 0.85, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vertexShader, vertexShaderText);
    gl.shaderSource(fragmentShader, fragmentShaderText);
    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);
    
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);


    const cubeVertices = new Float32Array([
        // X, Y, Z 
        //top
        -1.0, 1.0, -1.0,
        -1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, -1.0,
        //bottom
        -1.0, -1.0, -1.0,
        -1.0, -1.0, 1.0,
        1.0, -1.0, 1.0,
        1.0, -1.0, -1.0,
    ]);

    const cubeColors = new Float32Array([
        // R, G, B
        // Top face 
        1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        1.0, 1.0, 0.0,
        // Bottom face 
        1.0, 0.0, 1.0,
        1.0, 0.0, 1.0,
        1.0, 0.0, 1.0,
        1.0, 0.0, 1.0,
    ]);

    //we will have an index buffer to tell webgl which vertices to group together to form a triangle! 
    //this allows us to reuse vertices instead of duplicating them in the vertex array
    const indices = new Uint16Array([
        // Top face
        0, 1, 2,  0, 2, 3,
        // Front face
        1, 5, 6,  1, 6, 2,
        // Back face
        4, 0, 3,  4, 3, 7,
        // Right face
        2, 6, 7,  2, 7, 3,
        // Left face
        4, 5, 1,  4, 1, 0,
        // Bottom face
        5, 4, 7,  5, 7, 6,
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeColors, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const positionAttribLocation = gl.getAttribLocation(program, 'a_position');
    const colorAttribLocation = gl.getAttribLocation(program, 'a_color');

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(
        positionAttribLocation, // Attribute location
        3,                      // Number of elements per attribute (vec3)
        gl.FLOAT,               // Type of elements
        gl.FALSE,
        3 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
        0                       // Offset from the beginning of a single vertex to this attribute
    );
    gl.enableVertexAttribArray(positionAttribLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(
        colorAttribLocation, 3, gl.FLOAT, gl.FALSE,
        3 * Float32Array.BYTES_PER_ELEMENT, 0
    );
    gl.enableVertexAttribArray(colorAttribLocation);

    const identity = () => {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);
    };

    const translate = (matrix, tx, ty, tz) => {
        matrix[12] = tx;
        matrix[13] = ty;
        matrix[14] = tz;
    };

    // note that input is taken as radians from the html!
    const rotateX = (matrix, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const m01 = matrix[1], m02 = matrix[2];
        const m11 = matrix[5], m12 = matrix[6];
        const m21 = matrix[9], m22 = matrix[10];
        const m31 = matrix[13], m32 = matrix[14];
        
        matrix[1] = m01 * c + m02 * s;
        matrix[2] = -m01 * s + m02 * c;
        matrix[5] = m11 * c + m12 * s;
        matrix[6] = -m11 * s + m12 * c;
        matrix[9] = m21 * c + m22 * s;
        matrix[10] = -m21 * s + m22 * c;
        matrix[13] = m31 * c + m32 * s;
        matrix[14] = -m31 * s + m32 * c;
    };

    const rotateY = (matrix, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const m00 = matrix[0], m02 = matrix[2];
        const m10 = matrix[4], m12 = matrix[6];
        const m20 = matrix[8], m22 = matrix[10];
        const m30 = matrix[12], m32 = matrix[14];
        
        matrix[0] = m00 * c - m02 * s;
        matrix[2] = m00 * s + m02 * c;
        matrix[4] = m10 * c - m12 * s;
        matrix[6] = m10 * s + m12 * c;
        matrix[8] = m20 * c - m22 * s;
        matrix[10] = m20 * s + m22 * c;
        matrix[12] = m30 * c - m32 * s;
        matrix[14] = m30 * s + m32 * c;
    };

    const rotateZ = (matrix, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const m00 = matrix[0], m01 = matrix[1];
        const m10 = matrix[4], m11 = matrix[5];
        const m20 = matrix[8], m21 = matrix[9];
        const m30 = matrix[12], m31 = matrix[13];
        
        matrix[0] = m00 * c + m01 * s;
        matrix[1] = -m00 * s + m01 * c;
        matrix[4] = m10 * c + m11 * s;
        matrix[5] = -m10 * s + m11 * c;
        matrix[8] = m20 * c + m21 * s;
        matrix[9] = -m20 * s + m21 * c;
        matrix[12] = m30 * c + m31 * s;
        matrix[13] = -m30 * s + m31 * c;
    };


    const modelUniformLocation = gl.getUniformLocation(program, 'u_model');
    const viewUniformLocation = gl.getUniformLocation(program, 'u_view');
    const projUniformLocation = gl.getUniformLocation(program, 'u_projection');

    let modelMatrix = identity();
    let viewMatrix = identity();
    
    const fov = 45 * Math.PI / 180;
    const aspect = canvas.width / canvas.height;
    const near = 0.1;
    const far = 1000.0;
    const top = near * Math.tan(fov / 2);
    const bottom = -top;
    const right = top * aspect;
    const left = -right;
    
    let projMatrix = perspective(left, right, bottom, top, near, far);

    //camera position
    let cameraZ = -8;
    translate(viewMatrix, 0, 0, cameraZ);

    gl.uniformMatrix4fv(viewUniformLocation, gl.TRUE, viewMatrix);
    gl.uniformMatrix4fv(projUniformLocation, gl.TRUE, projMatrix);

    gl.enable(gl.DEPTH_TEST);

    let rotationX = 0;
    let rotationY = 0;
    let rotationZ = 0;
    let currentProjection = 'perspective';

    const rotateXSlider = document.getElementById('rotateX');
    const rotateYSlider = document.getElementById('rotateY');
    const rotateZSlider = document.getElementById('rotateZ');
    const resetBtn = document.getElementById('resetBtn');
    const projectionSelect = document.getElementById('projectionType');
    const cameraZSlider = document.getElementById('cameraZ');
    const cameraZValue = document.getElementById('cameraZValue');
    const xValue = document.getElementById('xValue');
    const yValue = document.getElementById('yValue');
    const zValue = document.getElementById('zValue');

    function updateProjection() {
        if (currentProjection === 'perspective') {
            const fov = 45 * Math.PI / 180;
            const aspect = canvas.width / canvas.height;
            const near = 0.1;
            const far = 1000.0;
            const top = near * Math.tan(fov / 2);
            const bottom = -top;
            const right = top * aspect;
            const left = -right;
            
            projMatrix = perspective(left, right, bottom, top, near, far);
        } else {
            const size = 3;
            projMatrix = orthographic(
                -size, size,
                -size, size,
                0.1, 1000.0
            );
        }
        gl.uniformMatrix4fv(projUniformLocation, gl.FALSE, projMatrix);
    }

    function updateViewMatrix() {
        viewMatrix = identity();
        translate(viewMatrix, 0, 0, cameraZ);
        gl.uniformMatrix4fv(viewUniformLocation, gl.FALSE, viewMatrix);
    }

    // Projection type change
    projectionSelect.addEventListener('change', (e) => {
        currentProjection = e.target.value;
        updateProjection();
    });

    // Camera Z position change
    cameraZSlider.addEventListener('input', (e) => {
        cameraZ = parseFloat(e.target.value);
        cameraZValue.textContent = cameraZ.toFixed(1);
        updateViewMatrix();
    });

    //rotation event listeners
    rotateXSlider.addEventListener('input', (e) => {
        rotationX = parseFloat(e.target.value);
        xValue.textContent = (rotationX * 180 / Math.PI).toFixed(0);
    });

    rotateYSlider.addEventListener('input', (e) => {
        rotationY = parseFloat(e.target.value);
        yValue.textContent = (rotationY * 180 / Math.PI).toFixed(0);
    });

    rotateZSlider.addEventListener('input', (e) => {
        rotationZ = parseFloat(e.target.value);
        zValue.textContent = (rotationZ * 180 / Math.PI).toFixed(0);
    });

    resetBtn.addEventListener('click', () => {
        rotationX = 0;
        rotationY = 0;
        rotationZ = 0;
        rotateXSlider.value = 0;
        rotateYSlider.value = 0;
        rotateZSlider.value = 0;
        xValue.textContent = '0';
        yValue.textContent = '0';
        zValue.textContent = '0';
    });

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let modelMatrix = identity();

        // Apply rotations, purely
        rotateX(modelMatrix, rotationX);
        rotateY(modelMatrix, rotationY);
        rotateZ(modelMatrix, rotationZ);

        gl.uniformMatrix4fv(modelUniformLocation, gl.TRUE, modelMatrix);

        gl.drawElements(
            gl.TRIANGLES,      
            indices.length,    
            gl.UNSIGNED_SHORT, // Type of the index data
            0 // Offset
        );
        requestAnimationFrame(render);
    }

    render();
}