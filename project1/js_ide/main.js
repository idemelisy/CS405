// Main application: UI bindings, matrix composition, render loop, and matrix display

let main_gl_canvas = null;
let main_curve_canvas = null;
let main_matrices_element = null;
let main_last_timestamp = undefined;

// Getter functions for UI values
let main_get_tx = null;
let main_get_ty = null;
let main_get_tz = null;
let main_get_rx = null;
let main_get_ry = null;
let main_get_rz = null;
let main_get_sx = null;
let main_get_sy = null;
let main_get_sz = null;
let main_get_theta = null;
let main_get_phi = null;
let main_get_distance = null;
let main_get_fov = null;
let main_get_near = null;
let main_get_far = null;
let main_projection_perspective = null;
let main_projection_ortho = null;
let main_bezier_attach_checkbox = null;

function main_bind_range_and_number_inputs(range_id, number_id, on_change_callback) {
    const range_input = document.getElementById(range_id);
    const number_input = document.getElementById(number_id);
    
    function sync_inputs(from_range) {
        if (from_range) {
            number_input.value = range_input.value;
        } else {
            range_input.value = number_input.value;
        }
        on_change_callback(parseFloat(range_input.value));
    }
    
    range_input.addEventListener('input', function() {
        sync_inputs(true);
    });
    
    number_input.addEventListener('input', function() {
        sync_inputs(false);
    });
    
    sync_inputs(true);
    
    return function() {
        return parseFloat(range_input.value);
    };
}

function main_compute_mvp_matrices() {
    // Model matrix: T * Rz * Ry * Rx * S
    let translation_x = main_get_tx();
    let translation_y = main_get_ty();
    let translation_z = main_get_tz();
    
    // If attach checkbox is checked, map Bezier curve point to world coordinates
    if (main_bezier_attach_checkbox.checked) {
        const bezier_point = bezier_point_at_parameter(bezier_get_t());
        const curve_rect = main_curve_canvas.getBoundingClientRect();
        
        function map_value(value, source_min, source_max, target_min, target_max) {
            return target_min + (value - source_min) * (target_max - target_min) / (source_max - source_min);
        }
        
        // Map overlay pixels to world coordinates
        translation_x = map_value(bezier_point.x, 0, curve_rect.width, -3, 3);
        translation_z = map_value(bezier_point.y, curve_rect.height, 0, -3, 3); // Invert Y to Z
    }
    
    const translation_matrix = Mat4.translate(translation_x, translation_y, translation_z);
    const rotation_x_matrix = Mat4.rotateX(main_get_rx());
    const rotation_y_matrix = Mat4.rotateY(main_get_ry());
    const rotation_z_matrix = Mat4.rotateZ(main_get_rz());
    const scale_matrix = Mat4.scale(main_get_sx(), main_get_sy(), main_get_sz());
    
    // Compose: T * Rz * Ry * Rx * S
    let model_matrix = Mat4.multiply(translation_matrix, 
        Mat4.multiply(rotation_z_matrix, 
            Mat4.multiply(rotation_y_matrix, 
                Mat4.multiply(rotation_x_matrix, scale_matrix))));
    
    // View matrix via orbit camera
    const camera_eye = orbitToEye(main_get_theta(), main_get_phi(), main_get_distance(), [0, 0, 0]);
    const view_matrix = lookAt(camera_eye, [0, 0, 0], [0, 1, 0]);
    
    // Projection matrix
    const aspect_ratio = main_gl_canvas.width / main_gl_canvas.height;
    let projection_matrix;
    
    if (main_projection_perspective.checked) {
        projection_matrix = Mat4.perspective(main_get_fov(), aspect_ratio, main_get_near(), main_get_far());
    } else {
        projection_matrix = Mat4.ortho(-aspect_ratio * 3, aspect_ratio * 3, -3, 3, main_get_near(), main_get_far());
    }
    
    return {
        model: model_matrix,
        view: view_matrix,
        proj: projection_matrix
    };
}

function main_format_matrix(matrix) {
    const matrix_array = Array.from(matrix);
    const rounded_values = matrix_array.map(function(value) {
        return Math.abs(value) < 1e-5 ? 0 : value;
    });
    
    const row_strings = [0, 1, 2, 3].map(function(row_index) {
        const row_values = [
            rounded_values[row_index].toFixed(3),
            rounded_values[4 + row_index].toFixed(3),
            rounded_values[8 + row_index].toFixed(3),
            rounded_values[12 + row_index].toFixed(3)
        ];
        return row_values.join('\t');
    });
    
    return row_strings.join('\n');
}

function main_update_matrices_panel(model_matrix, view_matrix, projection_matrix) {
    const model_string = main_format_matrix(model_matrix);
    const view_string = main_format_matrix(view_matrix);
    const projection_string = main_format_matrix(projection_matrix);
    
    main_matrices_element.textContent = 'M =\n' + model_string + '\n\nV =\n' + view_string + '\n\nP =\n' + projection_string;
}

function main_render_frame(timestamp) {
    render_resize();
    bezier_resize();
    
    // Calculate delta time for Bezier animation
    if (main_last_timestamp === undefined) {
        main_last_timestamp = timestamp;
    }
    const delta_time_seconds = Math.max(0, (timestamp - main_last_timestamp) / 1000);
    main_last_timestamp = timestamp;
    
    bezier_step(delta_time_seconds);
    
    // Compute MVP matrices
    const mvp = main_compute_mvp_matrices();
    
    // Draw WebGL scene
    render_draw(mvp.model, mvp.view, mvp.proj);
    
    // Redraw Bezier curve
    bezier_redraw();
    
    // Update matrices display
    main_update_matrices_panel(mvp.model, mvp.view, mvp.proj);
    
    requestAnimationFrame(main_render_frame);
}

function main_sync_overlay_canvas_size() {
    const gl_rect = main_gl_canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // CSS size for layout
    main_curve_canvas.style.width = gl_rect.width + 'px';
    main_curve_canvas.style.height = gl_rect.height + 'px';

    // Pixel buffer size for crisp drawing
    const width_px = Math.max(1, Math.floor(gl_rect.width * dpr));
    const height_px = Math.max(1, Math.floor(gl_rect.height * dpr));
    if (main_curve_canvas.width !== width_px || main_curve_canvas.height !== height_px) {
        main_curve_canvas.width = width_px;
        main_curve_canvas.height = height_px;
    }
}

function main_init() {
    main_gl_canvas = document.getElementById('glcanvas');
    main_curve_canvas = document.getElementById('curvecanvas');
    main_matrices_element = document.getElementById('matrices');
    
    // Initialize renderer and Bezier modules
    render_init_gl(main_gl_canvas);
    bezier_init(main_curve_canvas);
    
    // Bind model transform controls
    main_get_tx = main_bind_range_and_number_inputs('tx', 'txn', function() {});
    main_get_ty = main_bind_range_and_number_inputs('ty', 'tyn', function() {});
    main_get_tz = main_bind_range_and_number_inputs('tz', 'tzn', function() {});
    main_get_rx = main_bind_range_and_number_inputs('rx', 'rxn', function() {});
    main_get_ry = main_bind_range_and_number_inputs('ry', 'ryn', function() {});
    main_get_rz = main_bind_range_and_number_inputs('rz', 'rzn', function() {});
    main_get_sx = main_bind_range_and_number_inputs('sx', 'sxn', function() {});
    main_get_sy = main_bind_range_and_number_inputs('sy', 'syn', function() {});
    main_get_sz = main_bind_range_and_number_inputs('sz', 'szn', function() {});
    
    // Bind camera and projection controls
    main_get_theta = main_bind_range_and_number_inputs('orbitt', 'orbittn', function() {});
    main_get_phi = main_bind_range_and_number_inputs('orbitp', 'orbitpn', function() {});
    main_get_distance = main_bind_range_and_number_inputs('camdist', 'camdistn', function() {});
    main_get_fov = main_bind_range_and_number_inputs('fov', 'fovn', function() {});
    main_get_near = main_bind_range_and_number_inputs('znear', 'znearn', function() {});
    main_get_far = main_bind_range_and_number_inputs('zfar', 'zfarn', function() {});
    main_projection_perspective = document.getElementById('proj-persp');
    main_projection_ortho = document.getElementById('proj-ortho');
    
    // Bind Bezier controls
    main_bind_range_and_number_inputs('bt', 'btn', function(value) {
        bezier_set_t(value);
    });
    main_bind_range_and_number_inputs('bspeed', 'bspeedn', function(value) {
        bezier_set_speed(value);
    });
    
    document.getElementById('bplay').addEventListener('click', function() {
        bezier_play();
    });
    
    document.getElementById('bpause').addEventListener('click', function() {
        bezier_pause();
    });
    
    document.getElementById('breset').addEventListener('click', function() {
        bezier_reset_t();
        document.getElementById('bt').value = 0;
        document.getElementById('btn').value = 0;
    });
    
    main_bezier_attach_checkbox = document.getElementById('battach');
    
    // Reset button
    document.getElementById('reset').addEventListener('click', function() {
        const reset_values = [
            ['tx', 0], ['ty', 0], ['tz', 0],
            ['rx', 0], ['ry', 0], ['rz', 0],
            ['sx', 1], ['sy', 1], ['sz', 1],
            ['orbitt', 35], ['orbitp', 20], ['camdist', 6],
            ['fov', 60], ['znear', 0.1], ['zfar', 100]
        ];
        
        reset_values.forEach(function(pair) {
            const id = pair[0];
            const value = pair[1];
            const range_input = document.getElementById(id);
            const number_input = document.getElementById(id + 'n');
            if (range_input) range_input.value = value;
            if (number_input) number_input.value = value;
        });
    });
    
    // Export JSON button
    document.getElementById('exportJson').addEventListener('click', function() {
        const mvp = main_compute_mvp_matrices();
        const export_data = {
            M: Array.from(mvp.model),
            V: Array.from(mvp.view),
            P: Array.from(mvp.proj),
            curve: bezier_get_control_points()
        };
        
        const json_blob = new Blob([JSON.stringify(export_data, null, 2)], {type: 'application/json'});
        const blob_url = URL.createObjectURL(json_blob);
        const download_link = document.createElement('a');
        download_link.href = blob_url;
        download_link.download = 'matrices.json';
        download_link.click();
        URL.revokeObjectURL(blob_url);
    });
    
    // Sync overlay canvas size and handle window resize
    window.addEventListener('resize', main_sync_overlay_canvas_size);
    main_sync_overlay_canvas_size();
    
    // Start render loop
    requestAnimationFrame(main_render_frame);
}

if (typeof window !== "undefined") {
    window.main_init = main_init;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main_init);
} else {
    main_init();
}

