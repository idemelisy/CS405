var vertexShaderSource = `
    attribute vec2 vec_position;
    attribute vec3 vec_color;
    uniform mat4 u_transforMatrix; //uniform because we don't change it
    varying vec3 frag_color;
    void main(){
        frag_color = vec_color; // Pass the color to the fragment shader
        gl_Position = u_transforMatrix * vec4(vec_position, 0.0, 1.0);
    }
`;

var fragmentShaderSource = `
    precision mediump float;
    varying vec3 frag_color;
    void main(){
        gl_FragColor = vec4(frag_color, 1.0); // Use the color passed from the vertex shader
    }
`;

function getTransformMatrix(angleInDegrees, scale) {
    let angleInRadians = (angleInDegrees * Math.PI) / 180;
    let cos = Math.cos(angleInRadians);
    let sin = Math.sin(angleInRadians);

    return new Float32Array([
        cos * scale, -sin * scale, 0.0, 0.0,
        sin * scale, cos * scale,  0.0, 0.0, 
        0.0,         0.0,          1.0, 0.0,
        0.0,         0.0,          0.0, 1.0  
    ]);
}

let demo = function() {
    let canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl");

    let red = document.getElementById("red");
    let green = document.getElementById("green");
    let blue = document.getElementById("blue");
    let rotation = document.getElementById("rotation");
    let scale = document.getElementById("scale");

    if (!gl) {
        console.log("No webgl for you, update your browser");
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Create shaders
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    let program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    gl.useProgram(program);

    let vertices = new Float32Array([
        // x, y, r, g, b
        0.0, 0.5, 1.0, 0.0, 0.0, 
        -0.5, -0.5, 0.0, 1.0, 0.0, 
        0.5, -0.5, 0.0, 0.0, 1.0 
    ]);

    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW); //can use static here too but becomes slower 

    var positionLocation = gl.getAttribLocation(program, "vec_position");
    gl.vertexAttribPointer(
        positionLocation,
        2,
        gl.FLOAT,
        gl.FALSE,
        5 * Float32Array.BYTES_PER_ELEMENT,
        0
    );
    gl.enableVertexAttribArray(positionLocation);

    var colorLocation = gl.getAttribLocation(program, "vec_color");
    gl.vertexAttribPointer(
        colorLocation,
        3,
        gl.FLOAT,
        gl.FALSE,
        5 * Float32Array.BYTES_PER_ELEMENT,
        2 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(colorLocation);

    let transformMatrixLocation = gl.getUniformLocation(program, "u_transforMatrix");


    function updateScene() {
        let r = red.value / 255; 
        let g = green.value / 255;
        let b = blue.value / 255;
        let angle = parseFloat(rotation.value); 
        let scalingFactor = parseFloat(scale.value); 

        vertices.set([
            0.0, 0.5, r, g, b, 
            -0.5, -0.5, r, g, b, 
            0.5, -0.5, r, g, b 
        ]);

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices); //this writes data to currently bounded buffer, so no need to define new! 

        let transformMatrix = getTransformMatrix(angle, scalingFactor);
        gl.uniformMatrix4fv(transformMatrixLocation, false, transformMatrix);


        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    [red, green, blue, rotation, scale].forEach(input => {
        input.addEventListener("input", updateScene);
    });

    updateScene();
};