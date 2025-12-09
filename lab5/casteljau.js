const vertexShaderSource = `
    attribute vec2 a_position;

    void main() {
        gl_Position = vec4(a_position, 0, 1);
        gl_PointSize = 8.0;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color;
    }
`;

function lerp(p0, p1, t) {
    //(1-t)p0 + tp1
    //return x,y
    return {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t
    };
}

//will start with all control points and while the current point count is more than 1, we will lerp!
//will return all the stages!
function deCasteljau(points, t) {
    let stages = [points];
    let currentStage = points;

    while (currentStage.length > 1) {
        let nextStage = [];
        for (let i = 0; i < currentStage.length - 1; i++) {
            nextStage.push(lerp(currentStage[i], currentStage[i + 1], t));
        }
        stages.push(nextStage);
        currentStage = nextStage;
    }

    return stages;
}

function binomialCoeffs(n) {
  const C = new Array(n + 1).fill(0);
  C[0] = 1; //[1,3,3,1]
  for (let i = 1; i <= n; i++) {
        for (let k = i; k > 0; k--) {
            C[k] = C[k] + C[k - 1];
        }
  }
  return C; // C[k] = (n k) --> not a tuple but n choose k!
}

function bezierBernsteinPoint(controlPoints, t, binom) {
  const n = controlPoints.length - 1;
  const u = 1 - t;

  if (t === 0) {
    return { x: controlPoints[0].x, y: controlPoints[0].y };
  }
  if (t === 1) {
    return { x: controlPoints[n].x, y: controlPoints[n].y };
  }

  let x = 0, y = 0;
  let tPow = 1; //will be t^k                 
  let uPow = Math.pow(u, n); //will be (1-t)^n-k
  for (let k = 0; k <= n; k++) {
    const w = binom[k] * uPow * tPow; 
    x += w * controlPoints[k].x;
    y += w * controlPoints[k].y;
    tPow *= t; //multiply by t
    uPow = (u === 0) ? 0 : uPow / u; //divide by 1-t, will explode when t = 1 --> handled at top
  }
  return { x, y };
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    return program;
}

//just draws a line between 2 points
function drawLine(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, p0, p1, color) {
    const positions = [p0.x, p0.y, p1.x, p1.y];

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(colorUniformLocation, color);
    gl.drawArrays(gl.LINES, 0, 2);
}

function drawPoint(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, p, color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([p.x, p.y]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(colorUniformLocation, color);
    gl.drawArrays(gl.POINTS, 0, 1); //allows us to make points visible together with gl_PointSize
}

function drawBezierCurve(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, controlPoints, segments = 100, type='casteljau') {
    const points = new Float32Array((segments + 1) * 2);

    const n = controlPoints.length - 1;
    const binom = type === 'casteljau' ? null : binomialCoeffs(n);


    //sample the curve as bunch of points actually then draw it as line!
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let p;
        if(type === 'casteljau') {
            const stages = deCasteljau(controlPoints, t);
            p = stages[stages.length - 1][0];
        } else {
            p = bezierBernsteinPoint(controlPoints, t, binom);
        }
        
        //[x0,y0,x1,y1...]
        points[i * 2 + 0] = p.x;
        points[i * 2 + 1] = p.y;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(colorUniformLocation, [0.0, 0.0, 0.0, 1.0]); // color for our curve
    gl.drawArrays(gl.LINE_STRIP, 0, segments + 1);
}

function drawTangentVector(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, point, tangent, scale = 0.3, color = [1.0, 0.0, 0.0, 1.0]) {
    const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
    const tx = (tangent.x / length) * scale;
    const ty = (tangent.y / length) * scale;

    //position of the arrow!
    const endPoint = { x: point.x + tx, y: point.y + ty };
    drawLine(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, point, endPoint, color);

    //note: these will be used to draw the head
    const arrowSize = 0.05;
    const arrowAngle = Math.PI / 6; 

    const angle = Math.atan2(ty, tx);

    const leftArrow = {
        x: endPoint.x - arrowSize * Math.cos(angle - arrowAngle),
        y: endPoint.y - arrowSize * Math.sin(angle - arrowAngle)
    };
    drawLine(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, endPoint, leftArrow, color);

    const rightArrow = {
        x: endPoint.x - arrowSize * Math.cos(angle + arrowAngle),
        y: endPoint.y - arrowSize * Math.sin(angle + arrowAngle)
    };
    drawLine(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, endPoint, rightArrow, color);
}

function render(gl, program, positionBuffer, positionAttributeLocation, colorUniformLocation, controlPoints, t) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    drawBezierCurve(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, controlPoints, 100, 'casteljau');

    for (let i = 0; i < controlPoints.length - 1; i++) {
        drawLine(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, controlPoints[i], controlPoints[i + 1], [0.5, 0.5, 0.5, 1.0]);
    }

    for (let i = 0; i < controlPoints.length; i++) {
        drawPoint(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, controlPoints[i], [1.0, 0.0, 0.0, 1.0]); 
    }

    const stages = deCasteljau(controlPoints, t);

    const stageColors = [
        [0.0, 0.5, 1.0, 1.0],  
        [0.0, 0.8, 0.4, 1.0],  
        [1.0, 0.5, 0.0, 1.0],  
    ];

    //loop for intermediate stages of the casteljau algorithm
    /*
        so in our memory stages look like this:
        [[p0, p1, p2, p3],
         [q0,q1,q2],
         [r0,r1],
         [b(t)]
        ]
    */
    for (let stageIndex = 1; stageIndex < stages.length; stageIndex++) {
        const stage = stages[stageIndex];
        const colorIndex = (stageIndex - 1);
        const color = stageColors[colorIndex];

        for (let i = 0; i < stage.length - 1; i++) {
            drawLine(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, stage[i], stage[i + 1], color);
        }

        for (let i = 0; i < stage.length; i++) {
            drawPoint(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, stage[i], color);
        }
    }

    const finalPoint = stages[stages.length - 1][0];
    drawPoint(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, finalPoint, [1.0, 0.0, 0.0, 1.0]);

    //to Draw tangent vector
    // B′(t)=n(P1^(n−1)​(t)−P0^(n−1)​(t)
    if (stages.length >= 2) {
        const secondToLastStage = stages[stages.length - 2];
        if (secondToLastStage.length >= 2) {
            const p0 = secondToLastStage[0];
            const p1 = secondToLastStage[1];
            const tangent = {
                x: p1.x - p0.x,
                y: p1.y - p0.y
            };
            const degree = controlPoints.length - 1; // equivalent to n.
            tangent.x *= degree;
            tangent.y *= degree;

            drawTangentVector(gl, positionBuffer, positionAttributeLocation, colorUniformLocation, finalPoint, tangent, 0.2, [1.0, 0.0, 0.0, 1.0]);
        }
    }
}

function setupEventListeners(canvas, controlPoints, renderCallback) {
    let draggingPoint = null;

    const slider = document.getElementById('tSlider');
    const tValue = document.getElementById('tValue');

    slider.addEventListener('input', (e) => {
        const t = parseFloat(e.target.value);
        tValue.textContent = t.toFixed(2);
        renderCallback(t);
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / canvas.width) * 2 - 1;
        const y = -(((e.clientY - rect.top) / canvas.height) * 2 - 1);

        // Check if clicking near a control point
        for (let i = 0; i < controlPoints.length; i++) {
            const dx = x - controlPoints[i].x;
            const dy = y - controlPoints[i].y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.1) {
                draggingPoint = i;
                break;
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (draggingPoint !== null) {
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / canvas.width) * 2 - 1;
            const y = -(((e.clientY - rect.top) / canvas.height) * 2 - 1);

            //because our coordinate space is between -1 and 1
            controlPoints[draggingPoint].x = Math.max(-1, Math.min(1, x));
            controlPoints[draggingPoint].y = Math.max(-1, Math.min(1, y));
            renderCallback();
        }
    });

    canvas.addEventListener('mouseup', () => {
        draggingPoint = null;
    });

    canvas.addEventListener('mouseleave', () => {
        draggingPoint = null;
    });
}

function Demo() {
    const controlPoints = [
        { x: -0.6, y: -0.6 },
        { x: -0.2, y: 0.6 },
        { x: 0.4, y: 0.6 },
        { x: 0.7, y: -0.6 }
    ];

    let t = 0.5; 

    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
        alert('WebGL not supported, update your browser');
        return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const colorUniformLocation = gl.getUniformLocation(program, 'u_color');

    const positionBuffer = gl.createBuffer();

    //a callback that is dependent on t!
    const renderCallback = (newT) => {
        if (newT !== undefined) {
            t = newT;
        }
        render(gl, program, positionBuffer, positionAttributeLocation, colorUniformLocation, controlPoints, t);
    };

    setupEventListeners(canvas, controlPoints, renderCallback);

    renderCallback();
}

