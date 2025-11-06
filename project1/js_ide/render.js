// WebGL rendering: initialization, shaders, cube buffers, and drawing with MVP matrices

let render_gl = null;
let render_canvas = null;
let render_program = null;
let render_position_location = null;
let render_color_location = null;
let render_model_matrix_location = null;
let render_view_matrix_location = null;
let render_projection_matrix_location = null;
let render_vertex_buffer = null;
let render_color_buffer = null;
let render_index_buffer = null;
let render_index_count = 0;

const render_vertex_shader_source = `
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

const render_fragment_shader_source = `
    precision mediump float;
    varying vec3 v_color;
    void main(){
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

function render_create_shader(shader_type, shader_source) {
    const shader = render_gl.createShader(shader_type);
    render_gl.shaderSource(shader, shader_source);
    render_gl.compileShader(shader);
    return shader;
}

function render_create_program(vertex_shader, fragment_shader) {
    const program = render_gl.createProgram();
    render_gl.attachShader(program, vertex_shader);
    render_gl.attachShader(program, fragment_shader);
    render_gl.linkProgram(program);
    return program;
}

function render_init_gl(gl_canvas) {
    render_canvas = gl_canvas;
    render_gl = render_canvas.getContext('webgl');
    if (!render_gl) {
        throw new Error('WebGL not supported');
    }
    render_gl.enable(render_gl.DEPTH_TEST);
    render_gl.clearColor(0, 0, 0, 1);

    const vertex_shader = render_create_shader(render_gl.VERTEX_SHADER, render_vertex_shader_source);
    const fragment_shader = render_create_shader(render_gl.FRAGMENT_SHADER, render_fragment_shader_source);
    render_program = render_create_program(vertex_shader, fragment_shader);
    render_gl.useProgram(render_program);

    render_position_location = render_gl.getAttribLocation(render_program, 'a_position');
    render_color_location = render_gl.getAttribLocation(render_program, 'a_color');
    render_model_matrix_location = render_gl.getUniformLocation(render_program, 'u_model');
    render_view_matrix_location = render_gl.getUniformLocation(render_program, 'u_view');
    render_projection_matrix_location = render_gl.getUniformLocation(render_program, 'u_proj');

    render_init_cube();
    render_resize();
}

function render_init_cube() {
    // Cube vertex positions (8 unique vertices)
    const vertex_positions = new Float32Array([
        -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1, // back face
        -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1  // front face
    ]);
    
    // Cube vertex colors (one color per vertex)
    const vertex_colors = new Float32Array([
        1, 0, 0,  0, 1, 0,  0, 0, 1,  1, 1, 0,  // back face colors
        1, 0, 1,  0, 1, 1,  1, 1, 1,  0.5, 0.5, 0.5  // front face colors
    ]);
    
    // Cube indices (6 faces × 2 triangles × 3 vertices = 36 indices)
    const cube_indices = new Uint16Array([
        0, 1, 2,  0, 2, 3,  // back face
        4, 6, 5,  4, 7, 6,  // front face
        4, 5, 1,  4, 1, 0,  // bottom face
        3, 2, 6,  3, 6, 7,  // top face
        1, 5, 6,  1, 6, 2,  // right face
        4, 0, 3,  4, 3, 7   // left face
    ]);
    render_index_count = cube_indices.length;

    // Create and bind vertex position buffer
    render_vertex_buffer = render_gl.createBuffer();
    render_gl.bindBuffer(render_gl.ARRAY_BUFFER, render_vertex_buffer);
    render_gl.bufferData(render_gl.ARRAY_BUFFER, vertex_positions, render_gl.STATIC_DRAW);
    render_gl.enableVertexAttribArray(render_position_location);
    render_gl.vertexAttribPointer(render_position_location, 3, render_gl.FLOAT, false, 0, 0);

    // Create and bind vertex color buffer
    render_color_buffer = render_gl.createBuffer();
    render_gl.bindBuffer(render_gl.ARRAY_BUFFER, render_color_buffer);
    render_gl.bufferData(render_gl.ARRAY_BUFFER, vertex_colors, render_gl.STATIC_DRAW);
    render_gl.enableVertexAttribArray(render_color_location);
    render_gl.vertexAttribPointer(render_color_location, 3, render_gl.FLOAT, false, 0, 0);

    // Create and bind index buffer
    render_index_buffer = render_gl.createBuffer();
    render_gl.bindBuffer(render_gl.ELEMENT_ARRAY_BUFFER, render_index_buffer);
    render_gl.bufferData(render_gl.ELEMENT_ARRAY_BUFFER, cube_indices, render_gl.STATIC_DRAW);
}

function render_resize() {
    const canvas_rect = render_canvas.getBoundingClientRect();
    const device_pixel_ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas_width = Math.max(320, Math.floor(canvas_rect.width * device_pixel_ratio));
    const canvas_height = Math.max(240, Math.floor(canvas_rect.height * device_pixel_ratio));
    
    if (render_canvas.width !== canvas_width || render_canvas.height !== canvas_height) {
        render_canvas.width = canvas_width;
        render_canvas.height = canvas_height;
    }
    render_gl.viewport(0, 0, render_canvas.width, render_canvas.height);
}

function render_draw(model_matrix, view_matrix, projection_matrix) {
    render_gl.clear(render_gl.COLOR_BUFFER_BIT | render_gl.DEPTH_BUFFER_BIT);
    render_gl.uniformMatrix4fv(render_model_matrix_location, false, model_matrix);
    render_gl.uniformMatrix4fv(render_view_matrix_location, false, view_matrix);
    render_gl.uniformMatrix4fv(render_projection_matrix_location, false, projection_matrix);
    render_gl.drawElements(render_gl.TRIANGLES, render_index_count, render_gl.UNSIGNED_SHORT, 0);
}

if (typeof window !== "undefined") {
    window.render_init_gl = render_init_gl;
    window.render_resize = render_resize;
    window.render_draw = render_draw;
}

