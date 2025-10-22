var vertexShaderSource = `
    attribute vec2 vec_position; //0 
    attribute vec3 vec_color; //take an input from cpu, 1
    varying vec3 frag_color;
    void main() {
        frag_color = vec_color;
        gl_Position = vec4(vec_position, 0.0, 1.0);
    }
`;

var fragmentShaderSource = `
    precision mediump float;
    varying vec3 frag_color;
    void main() {
        gl_FragColor = vec4(frag_color, 1.0);
    }
`;


let Demo = function() {
    let canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl");
    if(!gl) {
        console.log("update your browser");
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let vs = gl.createShader(gl.VERTEX_SHADER);
    let fs = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vs, vertexShaderSource);
    gl.shaderSource(fs, fragmentShaderSource);
    gl.compileShader(vs);
    gl.compileShader(fs);

    let program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    let vertices = new Float32Array([
        //x, y       r, g, b 
        0.0, 0.5,    1.0 ,0.0, 0.0,
        -0.5, -0.5,  0.0, 1.0, 0.0,
        0.5, -0.5,   0.0, 0.0, 1.0,
    ]);

    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    let position = gl.getAttribLocation(program, "vec_position");
    gl.vertexAttribPointer(
        position,
        2,
        gl.FLOAT,
        gl.FALSE,
        5*Float32Array.BYTES_PER_ELEMENT,
        0
    )
    gl.enableVertexAttribArray(position);
    let colorPosition = gl.getAttribLocation(program, "vec_color");
    gl.vertexAttribPointer(
        colorPosition,
        3,
        gl.FLOAT,
        gl.FALSE,
        5*Float32Array.BYTES_PER_ELEMENT,
        2*Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(colorPosition);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}