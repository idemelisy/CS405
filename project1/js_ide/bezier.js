// Cubic Bezier curve implementation with draggable control points

let bezier_canvas = null;
let bezier_context = null;
let bezier_control_points = [
    {x:120, y:400},
    {x:260, y:220},
    {x:540, y:220},
    {x:680, y:400},
];
let bezier_dragging_index = -1;
let bezier_radius = 8;
let bezier_t = 0;
let bezier_playing = false;
let bezier_speed = 0.2;

function bezier_init(canvas) {
    bezier_canvas = canvas;
    bezier_context = canvas.getContext('2d');
    bezier_resize();
    bezier_bind_events();
    bezier_draw();
}

function bezier_resize() {
    const rect = bezier_canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // CSS size for layout
    bezier_canvas.style.width = rect.width + 'px';
    bezier_canvas.style.height = rect.height + 'px';
    // Pixel buffer size for crisp drawing
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (bezier_canvas.width !== w || bezier_canvas.height !== h) {
        bezier_canvas.width = w;
        bezier_canvas.height = h;
    }
    // Scale drawing so we can continue using CSS pixel coordinates
    const ctx = bezier_context;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function bezier_sample_point_at_t(t) {
    const p0 = bezier_control_points[0];
    const p1 = bezier_control_points[1];
    const p2 = bezier_control_points[2];
    const p3 = bezier_control_points[3];
    const u = 1 - t;
    const t_squared = t * t;
    const u_squared = u * u;
    const u_cubed = u_squared * u;
    const t_cubed = t_squared * t;
    const x = u_cubed * p0.x + 3 * u_squared * t * p1.x + 3 * u * t_squared * p2.x + t_cubed * p3.x;
    const y = u_cubed * p0.y + 3 * u_squared * t * p1.y + 3 * u * t_squared * p2.y + t_cubed * p3.y;
    return {x: x, y: y};
}

function bezier_draw() {
    const ctx = bezier_context;
    ctx.clearRect(0, 0, bezier_canvas.width, bezier_canvas.height);

    // Draw control polygon (lines connecting control points)
    ctx.strokeStyle = '#ffcc66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bezier_control_points[0].x, bezier_control_points[0].y);
    for (let i = 1; i < bezier_control_points.length; i++) {
        ctx.lineTo(bezier_control_points[i].x, bezier_control_points[i].y);
    }
    ctx.stroke();

    // Draw the Bezier curve
    ctx.strokeStyle = '#6ad0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const num_samples = 100;
    let point = bezier_sample_point_at_t(0);
    ctx.moveTo(point.x, point.y);
    for (let i = 1; i <= num_samples; i++) {
        point = bezier_sample_point_at_t(i / num_samples);
        ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    // Draw control points
    for (let i = 0; i < bezier_control_points.length; i++) {
        const control_point = bezier_control_points[i];
        // End points (first and last) are red, intermediate points are yellow
        ctx.fillStyle = (i === 0 || i === 3) ? '#ff6a6a' : '#ffd56a';
        ctx.beginPath();
        ctx.arc(control_point.x, control_point.y, bezier_radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw animated marker at current t value
    const marker_point = bezier_sample_point_at_t(bezier_t);
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.arc(marker_point.x, marker_point.y, bezier_radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
}

function bezier_pick_control_point(x, y) {
    for (let i = bezier_control_points.length - 1; i >= 0; i--) {
        const point = bezier_control_points[i];
        const dx = x - point.x;
        const dy = y - point.y;
        const distance_squared = dx * dx + dy * dy;
        if (distance_squared <= bezier_radius * bezier_radius * 2) {
            return i;
        }
    }
    return -1;
}

function bezier_bind_events() {
    bezier_canvas.addEventListener('mousedown', function(e) {
        const rect = bezier_canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        bezier_dragging_index = bezier_pick_control_point(x, y);
    });

    bezier_canvas.addEventListener('mousemove', function(e) {
        if (bezier_dragging_index < 0) return;
        const rect = bezier_canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        bezier_control_points[bezier_dragging_index].x = x;
        bezier_control_points[bezier_dragging_index].y = y;
        bezier_draw();
    });

    window.addEventListener('mouseup', function() {
        bezier_dragging_index = -1;
    });

    window.addEventListener('resize', function() {
        bezier_resize();
        bezier_draw();
    });
}

function bezier_get_control_points() {
    return bezier_control_points.map(function(point) {
        return {x: point.x, y: point.y};
    });
}

function bezier_set_control_points(points) {
    if (points && points.length === 4) {
        bezier_control_points = points.map(function(point) {
            return {x: point.x, y: point.y};
        });
        bezier_draw();
    }
}

function bezier_redraw() {
    bezier_draw();
}

function bezier_point_at_parameter(t) {
    const clamped_t = Math.max(0, Math.min(1, t));
    return bezier_sample_point_at_t(clamped_t);
}

function bezier_set_t(t) {
    bezier_t = Math.max(0, Math.min(1, t));
}

function bezier_get_t() {
    return bezier_t;
}

function bezier_set_speed(speed) {
    bezier_speed = Math.max(0, speed);
}

function bezier_play() {
    bezier_playing = true;
}

function bezier_pause() {
    bezier_playing = false;
}

function bezier_reset_t() {
    bezier_t = 0;
}

function bezier_step(delta_time_seconds) {
    if (!bezier_playing) return;
    bezier_t += bezier_speed * delta_time_seconds;
    while (bezier_t > 1) {
        bezier_t -= 1;
    }
}

if (typeof window !== "undefined") {
    window.bezier_init = bezier_init;
    window.bezier_resize = bezier_resize;
    window.bezier_redraw = bezier_redraw;
    window.bezier_get_control_points = bezier_get_control_points;
    window.bezier_set_control_points = bezier_set_control_points;
    window.bezier_point_at_parameter = bezier_point_at_parameter;
    window.bezier_set_t = bezier_set_t;
    window.bezier_get_t = bezier_get_t;
    window.bezier_set_speed = bezier_set_speed;
    window.bezier_play = bezier_play;
    window.bezier_pause = bezier_pause;
    window.bezier_reset_t = bezier_reset_t;
    window.bezier_step = bezier_step;
}
