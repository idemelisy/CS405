// Simple cubic Bezier with draggable control points on an overlay canvas

const Bezier = (function(){
    const state = {
        canvas: null,
        ctx: null,
        points: [
            {x:120, y:400},
            {x:260, y:220},
            {x:540, y:220},
            {x:680, y:400},
        ],
        draggingIndex: -1,
        radius: 8,
        t: 0,
        playing: false,
        speed: 0.2,
    };

    function init(canvas) {
        state.canvas = canvas;
        state.ctx = canvas.getContext('2d');
        resize();
        bind();
        draw();
    }

    function resize() {
        const rect = state.canvas.getBoundingClientRect();
        state.canvas.width = Math.floor(rect.width);
        state.canvas.height = Math.floor(rect.height);
    }

    function samplePoint(t) {
        const p0 = state.points[0], p1 = state.points[1], p2 = state.points[2], p3 = state.points[3];
        const u = 1 - t;
        const tt = t*t, uu = u*u;
        const uuu = uu*u, ttt = tt*t;
        const x = uuu*p0.x + 3*uu*t*p1.x + 3*u*tt*p2.x + ttt*p3.x;
        const y = uuu*p0.y + 3*uu*t*p1.y + 3*u*tt*p2.y + ttt*p3.y;
        return {x,y};
    }

    function draw() {
        const ctx = state.ctx;
        ctx.clearRect(0,0,state.canvas.width, state.canvas.height);

        // Control polygon
        ctx.strokeStyle = '#ffcc66';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(state.points[0].x, state.points[0].y);
        for (let i=1;i<state.points.length;i++) ctx.lineTo(state.points[i].x, state.points[i].y);
        ctx.stroke();

        // Curve
        ctx.strokeStyle = '#6ad0ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const N = 100;
        let p = samplePoint(0);
        ctx.moveTo(p.x, p.y);
        for (let i=1;i<=N;i++){
            p = samplePoint(i/N);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Points
        for (let i=0;i<state.points.length;i++){
            const pt = state.points[i];
            ctx.fillStyle = i===0||i===3 ? '#ff6a6a' : '#ffd56a';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, state.radius, 0, Math.PI*2);
            ctx.fill();
        }

        // Animated marker at t
        const m = samplePoint(state.t);
        ctx.fillStyle = '#00ffaa';
        ctx.beginPath();
        ctx.arc(m.x, m.y, state.radius * 0.9, 0, Math.PI*2);
        ctx.fill();
    }

    function pick(x, y) {
        for (let i=state.points.length-1;i>=0;i--) {
            const p = state.points[i];
            const dx = x - p.x, dy = y - p.y;
            if (dx*dx + dy*dy <= state.radius*state.radius*2) return i;
        }
        return -1;
    }

    function bind() {
        state.canvas.addEventListener('mousedown', (e)=>{
            const rect = state.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            state.draggingIndex = pick(x, y);
        });
        state.canvas.addEventListener('mousemove', (e)=>{
            if (state.draggingIndex < 0) return;
            const rect = state.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            state.points[state.draggingIndex].x = x;
            state.points[state.draggingIndex].y = y;
            draw();
        });
        window.addEventListener('mouseup', ()=>{ state.draggingIndex = -1; });
        window.addEventListener('resize', ()=>{ resize(); draw(); });
    }

    function getPoints() { return state.points.map(p=>({x:p.x, y:p.y})); }
    function setPoints(pts) { if (pts && pts.length===4){ state.points = pts.map(p=>({x:p.x,y:p.y})); draw(); } }
    function redraw() { draw(); }
    function pointAt(t) { return samplePoint(Math.max(0, Math.min(1, t))); }
    function setT(t) { state.t = Math.max(0, Math.min(1, t)); }
    function getT() { return state.t; }
    function setSpeed(s) { state.speed = Math.max(0, s); }
    function play() { state.playing = true; }
    function pause() { state.playing = false; }
    function resetT() { state.t = 0; }
    function step(dtSeconds) {
        if (!state.playing) return;
        state.t += state.speed * dtSeconds;
        while (state.t > 1) state.t -= 1;
    }

    return { init, resize, redraw, getPoints, setPoints, pointAt, setT, getT, setSpeed, play, pause, resetT, step };
})();

if (typeof window !== 'undefined') {
    window.Bezier = Bezier;
}


