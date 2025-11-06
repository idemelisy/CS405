// Main glue: UI bindings, matrix composition, render loop, matrices display

(function(){
    const glcanvas = document.getElementById('glcanvas');
    const curvecanvas = document.getElementById('curvecanvas');
    const matricesEl = document.getElementById('matrices');

    // Initialize modules
    Renderer.initGL(glcanvas);
    Bezier.init(curvecanvas);

    // UI helpers: keep range and number inputs in sync
    function bindPair(rangeId, numId, onChange) {
        const r = document.getElementById(rangeId);
        const n = document.getElementById(numId);
        const sync = (fromRange)=>{
            if (fromRange) n.value = r.value; else r.value = n.value;
            onChange(parseFloat(r.value));
        };
        r.addEventListener('input', ()=>sync(true));
        n.addEventListener('input', ()=>sync(false));
        sync(true);
        return ()=>parseFloat(r.value);
    }

    // Model controls
    let getTx = bindPair('tx','txn', ()=>{});
    let getTy = bindPair('ty','tyn', ()=>{});
    let getTz = bindPair('tz','tzn', ()=>{});
    let getRx = bindPair('rx','rxn', ()=>{});
    let getRy = bindPair('ry','ryn', ()=>{});
    let getRz = bindPair('rz','rzn', ()=>{});
    let getSx = bindPair('sx','sxn', ()=>{});
    let getSy = bindPair('sy','syn', ()=>{});
    let getSz = bindPair('sz','szn', ()=>{});

    // Camera / projection controls
    let getTheta = bindPair('orbitt','orbittn', ()=>{});
    let getPhi   = bindPair('orbitp','orbitpn', ()=>{});
    let getDist  = bindPair('camdist','camdistn', ()=>{});
    let getFov   = bindPair('fov','fovn', ()=>{});
    let getNear  = bindPair('znear','znearn', ()=>{});
    let getFar   = bindPair('zfar','zfarn', ()=>{});
    const projPersp = document.getElementById('proj-persp');
    const projOrtho = document.getElementById('proj-ortho');

    // Bézier controls
    let getBt = bindPair('bt','btn', (v)=>{ Bezier.setT(v); });
    let getBSpeed = bindPair('bspeed','bspeedn', (v)=>{ Bezier.setSpeed(v); });
    document.getElementById('bplay').addEventListener('click', ()=>Bezier.play());
    document.getElementById('bpause').addEventListener('click', ()=>Bezier.pause());
    document.getElementById('breset').addEventListener('click', ()=>{ Bezier.resetT(); document.getElementById('bt').value = 0; document.getElementById('btn').value = 0; });
    const attachCheck = document.getElementById('battach');

    // Reset button
    document.getElementById('reset').addEventListener('click', ()=>{
        [['tx',0],['ty',0],['tz',0],['rx',0],['ry',0],['rz',0],['sx',1],['sy',1],['sz',1],
         ['orbitt',35],['orbitp',20],['camdist',6],['fov',60],['znear',0.1],['zfar',100]].forEach(([id,val])=>{
            const r = document.getElementById(id); const n = document.getElementById(id+'n');
            if (r) r.value = val; if (n) n.value = val;
        });
    });

    // Export JSON
    document.getElementById('exportJson').addEventListener('click', ()=>{
        const { model, view, proj } = computeMVP();
        const data = { M: [...model], V: [...view], P: [...proj], curve: Bezier.getPoints() };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'matrices.json'; a.click();
        URL.revokeObjectURL(url);
    });

    function computeMVP() {
        // Model = T * Rz * Ry * Rx * S
        let tx = getTx(), ty = getTy(), tz = getTz();
        if (attachCheck.checked) {
            const pt = Bezier.pointAt(Bezier.getT());
            const rect = curvecanvas.getBoundingClientRect();
            const map = (v, a0, a1, b0, b1) => b0 + (v - a0) * (b1 - b0) / (a1 - a0);
            // Map overlay pixels to a modest world range
            tx = map(pt.x, 0, rect.width, -3, 3);
            tz = map(pt.y, rect.height, 0, -3, 3); // invert Y -> Z
        }
        const T = Mat4.translate(tx, ty, tz);
        const Rx = Mat4.rotateX(getRx());
        const Ry = Mat4.rotateY(getRy());
        const Rz = Mat4.rotateZ(getRz());
        const S  = Mat4.scale(getSx(), getSy(), getSz());
        let model = Mat4.multiply(T, Mat4.multiply(Rz, Mat4.multiply(Ry, Mat4.multiply(Rx, S))));

        // View via orbit camera
        const eye = orbitToEye(getTheta(), getPhi(), getDist(), [0,0,0]);
        const view = lookAt(eye, [0,0,0], [0,1,0]);

        // Projection
        const aspect = glcanvas.width / glcanvas.height;
        const proj = projPersp.checked
            ? Mat4.perspective(getFov(), aspect, getNear(), getFar())
            : Mat4.ortho(-aspect*3, aspect*3, -3, 3, getNear(), getFar());

        return { model, view, proj };
    }

    function updateMatricesPanel(M, V, P) {
        function fmt(m) {
            const a = [...m].map(v=> (Math.abs(v) < 1e-5 ? 0 : v));
            const rows = [0,1,2,3].map(r=> `${a[r].toFixed(3)}\t${a[4+r].toFixed(3)}\t${a[8+r].toFixed(3)}\t${a[12+r].toFixed(3)}`);
            return rows.join('\n');
        }
        matricesEl.textContent = `M =\n${fmt(M)}\n\nV =\n${fmt(V)}\n\nP =\n${fmt(P)}`;
    }

    let lastTs = undefined;
    function frame(ts) {
        Renderer.resize();
        Bezier.resize();
        if (lastTs === undefined) lastTs = ts;
        const dt = Math.max(0, (ts - lastTs) / 1000);
        lastTs = ts;
        Bezier.step(dt);
        const { model, view, proj } = computeMVP();
        Renderer.draw(model, view, proj);
        Bezier.redraw();
        updateMatricesPanel(model, view, proj);
        requestAnimationFrame(frame);
    }

    // Fit overlay canvas size to GL canvas CSS size
    function syncOverlaySize() {
        const glRect = glcanvas.getBoundingClientRect();
        curvecanvas.style.width = glRect.width + 'px';
        curvecanvas.style.height = glRect.height + 'px';
    }
    window.addEventListener('resize', syncOverlaySize);
    syncOverlaySize();

    requestAnimationFrame(frame);
})();


