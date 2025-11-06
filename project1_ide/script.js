// Main application script for CS405 Project 1
// Coordinates all modules and handles UI events

// Global application state
let applicationState = {
    renderer: null,
    camera: null,
    bezierCurve: null,
    
    // Transformation parameters
    transformation: {
        translateX: 0, translateY: 0, translateZ: 0,
        rotateX: 0, rotateY: 0, rotateZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
        order: 'TRS'
    },
    
    // View options
    showAxes: true,
    showGrid: true,
    showBezierCurve: true,
    showControlPoints: true,
    showFrustum: false,
    
    // Mouse interaction
    mouseDown: false,
    lastMouseX: 0,
    lastMouseY: 0,
    draggingControlPoint: -1,
    
    // Animation
    animationFrameId: null
};

// Initialize the application - called from HTML onload
function initializeApplication() {
    console.log("Initializing CS405 Project 1 Application...");
    
    // Initialize renderer
    applicationState.renderer = new WebGLRenderer('webglCanvas');
    
    // Initialize cube data directly (no external loading like lab2)
    applicationState.renderer.initializeCubeData();
    
    // Initialize camera
    applicationState.camera = new Camera();
    applicationState.camera.setAspectRatio(800 / 600);
    applicationState.camera.resetCameraPosition();
    
    // Initialize Bézier curve
    applicationState.bezierCurve = new BezierCurve();
    
    // Set up mouse controls
    setupMouseControls();
    
    // Initialize slider displays
    document.getElementById('fovValue').textContent = applicationState.camera.fieldOfView + '°';
    document.getElementById('nearValue').textContent = applicationState.camera.nearPlane.toFixed(1);
    document.getElementById('farValue').textContent = applicationState.camera.farPlane.toFixed(1);
    
    // Start render loop
    startRenderLoop();
    
    console.log("Application initialized successfully!");
}

// Set up mouse interaction for camera and Bézier curve controls
function setupMouseControls() {
    const canvas = document.getElementById('webglCanvas');
    
    canvas.addEventListener('mousedown', (event) => {
        applicationState.mouseDown = true;
        applicationState.lastMouseX = event.clientX;
        applicationState.lastMouseY = event.clientY;
        
        // Check if clicking on Bézier control point
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const canvasSize = applicationState.renderer.getCanvasSize();
        const viewMatrix = applicationState.camera.getViewMatrix();
        const projectionMatrix = applicationState.camera.getProjectionMatrix();
        
        applicationState.draggingControlPoint = applicationState.bezierCurve.findNearestControlPoint(
            x, y, canvasSize.width, canvasSize.height, viewMatrix, projectionMatrix
        );
    });
    
    canvas.addEventListener('mousemove', (event) => {
        if (!applicationState.mouseDown) return;
        
        const deltaX = event.clientX - applicationState.lastMouseX;
        const deltaY = event.clientY - applicationState.lastMouseY;
        
        if (applicationState.draggingControlPoint >= 0) {
            // Move Bézier control point
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const canvasSize = applicationState.renderer.getCanvasSize();
            
            applicationState.bezierCurve.setControlPointFromScreenCoordinates(
                applicationState.draggingControlPoint, x, y, canvasSize.width, canvasSize.height
            );
        } else {
            // Rotate camera
            applicationState.camera.rotateCameraAroundTarget(deltaX * 0.01, deltaY * 0.01);
        }
        
        applicationState.lastMouseX = event.clientX;
        applicationState.lastMouseY = event.clientY;
        
        updateCameraInfo();
    });
    
    canvas.addEventListener('mouseup', () => {
        applicationState.mouseDown = false;
        applicationState.draggingControlPoint = -1;
    });
    
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        applicationState.camera.moveCameraForward(event.deltaY * 0.01);
        updateCameraInfo();
    });
}

// Main render loop
function renderScene() {
    // Clear screen
    applicationState.renderer.clearScreen();
    
    // Update Bézier animation
    applicationState.bezierCurve.updateAnimation();
    
    // Get matrices
    const viewMatrix = applicationState.camera.getViewMatrix();
    const projectionMatrix = applicationState.camera.getProjectionMatrix();
    const identityMatrix = createIdentityMatrix();
    
    // Draw main cube with transformations
    const modelMatrix = createTransformationMatrix(
        applicationState.transformation.translateX,
        applicationState.transformation.translateY,
        applicationState.transformation.translateZ,
        applicationState.transformation.rotateX,
        applicationState.transformation.rotateY,
        applicationState.transformation.rotateZ,
        applicationState.transformation.scaleX,
        applicationState.transformation.scaleY,
        applicationState.transformation.scaleZ,
        applicationState.transformation.order
    );
    
    applicationState.renderer.drawCube(modelMatrix, viewMatrix, projectionMatrix);
    
    // Draw animated cube on Bézier curve
    if (applicationState.bezierCurve.isAnimating) {
        const animatedCubeMatrix = createAnimatedCubeTransform(applicationState.bezierCurve);
        applicationState.renderer.drawCube(animatedCubeMatrix, viewMatrix, projectionMatrix);
    }
    
    // Draw coordinate axes
    if (applicationState.showAxes) {
        drawCoordinateAxes(viewMatrix, projectionMatrix);
    }
    
    // Draw grid
    if (applicationState.showGrid) {
        drawGrid(viewMatrix, projectionMatrix);
    }
    
    // Draw Bézier curve
    if (applicationState.showBezierCurve) {
        drawBezierCurve(viewMatrix, projectionMatrix);
    }
    
    // Draw control points
    if (applicationState.showControlPoints) {
        drawControlPoints(viewMatrix, projectionMatrix);
    }
    
    // Draw camera frustum
    if (applicationState.showFrustum) {
        drawCameraFrustum(viewMatrix, projectionMatrix);
    }
    
    // Update UI displays
    updateBezierInfo();
    
    // Continue animation loop
    applicationState.animationFrameId = requestAnimationFrame(renderScene);
}

// Start the render loop
function startRenderLoop() {
    if (applicationState.animationFrameId) {
        cancelAnimationFrame(applicationState.animationFrameId);
    }
    renderScene();
}

// Draw coordinate axes
function drawCoordinateAxes(viewMatrix, projectionMatrix) {
    const axesGeometry = createCoordinateAxesGeometry();
    
    if (!applicationState.renderer.buffers.axesPositions) {
        applicationState.renderer.createBuffer('axesPositions', axesGeometry.positions);
        applicationState.renderer.createBuffer('axesColors', axesGeometry.colors);
    }
    
    applicationState.renderer.setLineWidth(3);
    applicationState.renderer.drawLineSegments(
        applicationState.renderer.buffers.axesPositions,
        applicationState.renderer.buffers.axesColors,
        axesGeometry.vertexCount,
        createIdentityMatrix(),
        viewMatrix,
        projectionMatrix
    );
}

// Draw grid
function drawGrid(viewMatrix, projectionMatrix) {
    const gridGeometry = createGridGeometry(20, 2);
    
    if (!applicationState.renderer.buffers.gridPositions) {
        applicationState.renderer.createBuffer('gridPositions', gridGeometry.positions);
        applicationState.renderer.createBuffer('gridColors', gridGeometry.colors);
    }
    
    applicationState.renderer.setLineWidth(1);
    applicationState.renderer.drawLineSegments(
        applicationState.renderer.buffers.gridPositions,
        applicationState.renderer.buffers.gridColors,
        gridGeometry.vertexCount,
        createIdentityMatrix(),
        viewMatrix,
        projectionMatrix
    );
}

// Draw Bézier curve
function drawBezierCurve(viewMatrix, projectionMatrix) {
    const curveData = applicationState.bezierCurve.generateCurveVertices();
    
    applicationState.renderer.updateBuffer('curvePositions', curveData.vertices);
    applicationState.renderer.updateBuffer('curveColors', curveData.colors);
    
    if (!applicationState.renderer.buffers.curvePositions) {
        applicationState.renderer.createBuffer('curvePositions', curveData.vertices);
        applicationState.renderer.createBuffer('curveColors', curveData.colors);
    }
    
    applicationState.renderer.setLineWidth(3);
    applicationState.renderer.drawLines(
        applicationState.renderer.buffers.curvePositions,
        applicationState.renderer.buffers.curveColors,
        curveData.vertices.length / 3,
        createIdentityMatrix(),
        viewMatrix,
        projectionMatrix
    );
    
    // Draw control polygon
    const polygonData = applicationState.bezierCurve.generateControlPolygonVertices();
    
    applicationState.renderer.updateBuffer('polygonPositions', polygonData.vertices);
    applicationState.renderer.updateBuffer('polygonColors', polygonData.colors);
    
    if (!applicationState.renderer.buffers.polygonPositions) {
        applicationState.renderer.createBuffer('polygonPositions', polygonData.vertices);
        applicationState.renderer.createBuffer('polygonColors', polygonData.colors);
    }
    
    applicationState.renderer.setLineWidth(1);
    applicationState.renderer.drawLineSegments(
        applicationState.renderer.buffers.polygonPositions,
        applicationState.renderer.buffers.polygonColors,
        polygonData.vertices.length / 3,
        createIdentityMatrix(),
        viewMatrix,
        projectionMatrix
    );
}

// Draw control points
function drawControlPoints(viewMatrix, projectionMatrix) {
    const pointsData = applicationState.bezierCurve.generateControlPointVertices();
    
    applicationState.renderer.updateBuffer('controlPositions', pointsData.vertices);
    applicationState.renderer.updateBuffer('controlColors', pointsData.colors);
    
    if (!applicationState.renderer.buffers.controlPositions) {
        applicationState.renderer.createBuffer('controlPositions', pointsData.vertices);
        applicationState.renderer.createBuffer('controlColors', pointsData.colors);
    }
    
    applicationState.renderer.drawPoints(
        applicationState.renderer.buffers.controlPositions,
        applicationState.renderer.buffers.controlColors,
        pointsData.vertices.length / 3,
        createIdentityMatrix(),
        viewMatrix,
        projectionMatrix
    );
}

// Draw frustum wireframe for clearer visualization
function drawFrustumWireframe(cameraWorldMatrix, viewMatrix, projectionMatrix) {
    // Create wireframe lines from the frustum geometry
    if (!applicationState.renderer.frustumWireframe) {
        const wireframeLines = [];
        const wireframeColors = [];
        
        // Get camera parameters
        const camera = applicationState.camera;
        const fovRadians = degreesToRadians(camera.fieldOfView);
        const near = camera.nearPlane;
        const far = Math.min(camera.farPlane, camera.nearPlane + 10);
        
        const halfHeightNear = near * Math.tan(fovRadians / 2);
        const halfWidthNear = halfHeightNear * camera.aspectRatio;
        const halfHeightFar = far * Math.tan(fovRadians / 2);
        const halfWidthFar = halfHeightFar * camera.aspectRatio;
        
        // Camera origin and corner points
        const origin = [0, 0, 0];
        const nearCorners = [
            [-halfWidthNear, -halfHeightNear, -near],
            [ halfWidthNear, -halfHeightNear, -near],
            [ halfWidthNear,  halfHeightNear, -near],
            [-halfWidthNear,  halfHeightNear, -near]
        ];
        const farCorners = [
            [-halfWidthFar, -halfHeightFar, -far],
            [ halfWidthFar, -halfHeightFar, -far],
            [ halfWidthFar,  halfHeightFar, -far],
            [-halfWidthFar,  halfHeightFar, -far]
        ];
        
        // Lines from camera to corners
        for (let i = 0; i < 4; i++) {
            wireframeLines.push(...origin, ...nearCorners[i]);
            wireframeColors.push(1.0, 1.0, 0.0, 1.0, 1.0, 0.0); // Yellow
            
            wireframeLines.push(...origin, ...farCorners[i]);
            wireframeColors.push(0.0, 1.0, 1.0, 0.0, 1.0, 1.0); // Cyan
        }
        
        // Near plane rectangle
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            wireframeLines.push(...nearCorners[i], ...nearCorners[next]);
            wireframeColors.push(1.0, 0.5, 0.0, 1.0, 0.5, 0.0); // Orange
        }
        
        // Far plane rectangle  
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            wireframeLines.push(...farCorners[i], ...farCorners[next]);
            wireframeColors.push(1.0, 0.0, 1.0, 1.0, 0.0, 1.0); // Magenta
        }
        
        // Store wireframe data
        applicationState.renderer.frustumWireframe = {
            positions: wireframeLines,
            colors: wireframeColors,
            vertexCount: wireframeLines.length / 3
        };
        
        // Create buffers
        applicationState.renderer.createBuffer('frustumWireframePositions', wireframeLines);
        applicationState.renderer.createBuffer('frustumWireframeColors', wireframeColors);
    }
    
    // Draw wireframe
    applicationState.renderer.setLineWidth(2);
    applicationState.renderer.drawLineSegments(
        applicationState.renderer.buffers.frustumWireframePositions,
        applicationState.renderer.buffers.frustumWireframeColors,
        applicationState.renderer.frustumWireframe.vertexCount,
        cameraWorldMatrix,
        viewMatrix,
        projectionMatrix
    );
}

// Draw camera frustum to visualize field of view
function drawCameraFrustum(viewMatrix, projectionMatrix) {
    // Only draw if frustum buffers exist
    if (!applicationState.renderer.buffers.frustumPositions) {
        return;
    }
    
    // Create inverse view matrix to transform frustum from camera space to world space
    const cameraWorldMatrix = invertMatrix(viewMatrix);
    
    const gl = applicationState.renderer.webglContext;
    
    // First draw the camera indicator (solid, no transparency)
    if (applicationState.renderer.buffers.cameraPositions) {
        applicationState.renderer.drawTriangles(
            applicationState.renderer.buffers.cameraPositions,
            applicationState.renderer.buffers.cameraColors,
            applicationState.renderer.cameraIndicatorGeometry.vertexCount,
            cameraWorldMatrix,
            viewMatrix,
            projectionMatrix,
            1.0  // Fully opaque
        );
    }
    
    // Draw frustum as wireframe instead of solid 
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); 
    
    // Draw only the edges for clearer visualization
    drawFrustumWireframe(cameraWorldMatrix, viewMatrix, projectionMatrix);
    
    // Restore normal rendering state
    gl.depthMask(true);
    gl.disable(gl.BLEND);
}

// UI Event Handlers

function updateTransformation() {
    // Get values from sliders and update display
    applicationState.transformation.translateX = parseFloat(document.getElementById('translateX').value);
    applicationState.transformation.translateY = parseFloat(document.getElementById('translateY').value);
    applicationState.transformation.translateZ = parseFloat(document.getElementById('translateZ').value);
    applicationState.transformation.rotateX = parseFloat(document.getElementById('rotateX').value);
    applicationState.transformation.rotateY = parseFloat(document.getElementById('rotateY').value);
    applicationState.transformation.rotateZ = parseFloat(document.getElementById('rotateZ').value);
    applicationState.transformation.scaleX = parseFloat(document.getElementById('scaleX').value);
    applicationState.transformation.scaleY = parseFloat(document.getElementById('scaleY').value);
    applicationState.transformation.scaleZ = parseFloat(document.getElementById('scaleZ').value);
    
    // Update displayed values
    document.getElementById('translateXValue').textContent = applicationState.transformation.translateX.toFixed(1);
    document.getElementById('translateYValue').textContent = applicationState.transformation.translateY.toFixed(1);
    document.getElementById('translateZValue').textContent = applicationState.transformation.translateZ.toFixed(1);
    document.getElementById('rotateXValue').textContent = applicationState.transformation.rotateX + '°';
    document.getElementById('rotateYValue').textContent = applicationState.transformation.rotateY + '°';
    document.getElementById('rotateZValue').textContent = applicationState.transformation.rotateZ + '°';
    document.getElementById('scaleXValue').textContent = applicationState.transformation.scaleX.toFixed(1);
    document.getElementById('scaleYValue').textContent = applicationState.transformation.scaleY.toFixed(1);
    document.getElementById('scaleZValue').textContent = applicationState.transformation.scaleZ.toFixed(1);
}

function setTransformationOrder(order) {
    applicationState.transformation.order = order;
    
    // Update button states
    document.querySelectorAll('.button-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('btn' + order).classList.add('active');
}

function toggleProjection() {
    const projectionType = applicationState.camera.toggleProjectionType();
    document.getElementById('projectionBtn').textContent = 
        projectionType === 'perspective' ? 'Perspective' : 'Orthographic';
}

function resetCamera() {
    applicationState.camera.resetCameraPosition();
    
    // Reset near and far plane sliders to default values
    document.getElementById('nearPlane').value = 1;
    document.getElementById('nearValue').textContent = '0.1';
    document.getElementById('farPlane').value = 100;
    document.getElementById('farValue').textContent = '100.0';
    
    // Reset field of view slider
    document.getElementById('fieldOfView').value = 45;
    document.getElementById('fovValue').textContent = '45°';
    
    updateCameraInfo();
}

function updateCamera() {
    const fov = parseFloat(document.getElementById('fieldOfView').value);
    applicationState.camera.setFieldOfView(fov);
    document.getElementById('fovValue').textContent = fov + '°';
    
    // Update frustum geometry if it's currently visible
    if (applicationState.showFrustum) {
        const camera = applicationState.camera;
        applicationState.renderer.setupFrustumGeometry(
            camera.fieldOfView,
            camera.aspectRatio,
            camera.nearPlane,
            camera.farPlane
        );
        // Clear wireframe cache to regenerate
        applicationState.renderer.frustumWireframe = null;
    }
}

function updateNearPlane() {
    const value = parseFloat(document.getElementById('nearPlane').value);
    const nearValue = value / 10; // Scale slider value: 1-200 becomes 0.1-20.0
    applicationState.camera.setClippingPlanes(nearValue, applicationState.camera.farPlane);
    document.getElementById('nearValue').textContent = nearValue.toFixed(1);
    
    // Update frustum geometry if it's currently visible
    if (applicationState.showFrustum) {
        const camera = applicationState.camera;
        applicationState.renderer.setupFrustumGeometry(
            camera.fieldOfView,
            camera.aspectRatio,
            camera.nearPlane,
            camera.farPlane
        );
    }
}

function updateFarPlane() {
    const value = parseFloat(document.getElementById('farPlane').value);
    applicationState.camera.setClippingPlanes(applicationState.camera.nearPlane, value);
    document.getElementById('farValue').textContent = value.toFixed(1);
    
    // Update frustum geometry if it's currently visible
    if (applicationState.showFrustum) {
        const camera = applicationState.camera;
        applicationState.renderer.setupFrustumGeometry(
            camera.fieldOfView,
            camera.aspectRatio,
            camera.nearPlane,
            camera.farPlane
        );
    }
}

function toggleBezierAnimation() {
    const isAnimating = applicationState.bezierCurve.toggleAnimation();
    document.getElementById('animationBtn').textContent = isAnimating ? 'Stop Animation' : 'Start Animation';
}

function resetBezierCurve() {
    applicationState.bezierCurve.resetCurve();
}

function updateAnimationSpeed() {
    const speed = parseFloat(document.getElementById('animationSpeed').value) / 1000;
    applicationState.bezierCurve.setAnimationSpeed(speed);
    document.getElementById('speedValue').textContent = speed.toFixed(3);
}

function toggleAxes() {
    applicationState.showAxes = !applicationState.showAxes;
    document.getElementById('axesBtn').textContent = applicationState.showAxes ? 'Hide Axes' : 'Show Axes';
}

function toggleGrid() {
    applicationState.showGrid = !applicationState.showGrid;
    document.getElementById('gridBtn').textContent = applicationState.showGrid ? 'Hide Grid' : 'Show Grid';
}

function toggleBezierCurve() {
    applicationState.showBezierCurve = !applicationState.showBezierCurve;
    document.getElementById('curveBtn').textContent = applicationState.showBezierCurve ? 'Hide Curve' : 'Show Curve';
}

function toggleControlPoints() {
    applicationState.showControlPoints = !applicationState.showControlPoints;
    document.getElementById('controlBtn').textContent = applicationState.showControlPoints ? 'Hide Controls' : 'Show Controls';
}

function toggleFrustum() {
    applicationState.showFrustum = !applicationState.showFrustum;
    document.getElementById('frustumBtn').textContent = applicationState.showFrustum ? 'Hide Frustum' : 'Show Frustum';
    
    // Update frustum geometry when toggled on
    if (applicationState.showFrustum) {
        const camera = applicationState.camera;
        applicationState.renderer.setupFrustumGeometry(
            camera.fieldOfView,
            camera.aspectRatio,
            camera.nearPlane,
            camera.farPlane
        );
    }
}

// Matrix display functions
function showModelMatrix() {
    const matrix = createTransformationMatrix(
        applicationState.transformation.translateX,
        applicationState.transformation.translateY,
        applicationState.transformation.translateZ,
        applicationState.transformation.rotateX,
        applicationState.transformation.rotateY,
        applicationState.transformation.rotateZ,
        applicationState.transformation.scaleX,
        applicationState.transformation.scaleY,
        applicationState.transformation.scaleZ,
        applicationState.transformation.order
    );
    
    document.getElementById('matrixOutput').textContent = formatMatrixAsJSON(matrix);
    
    // Update button states
    updateMatrixButtonStates('modelBtn');
}

function showViewMatrix() {
    const matrix = applicationState.camera.getViewMatrix();
    document.getElementById('matrixOutput').textContent = formatMatrixAsJSON(matrix);
    updateMatrixButtonStates('viewBtn');
}

function showProjectionMatrix() {
    const matrix = applicationState.camera.getProjectionMatrix();
    document.getElementById('matrixOutput').textContent = formatMatrixAsJSON(matrix);
    updateMatrixButtonStates('projBtn');
}

function updateMatrixButtonStates(activeId) {
    ['modelBtn', 'viewBtn', 'projBtn'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}

// Update camera info display
function updateCameraInfo() {
    const eye = applicationState.camera.eyePosition;
    const target = applicationState.camera.targetPosition;
    const distance = applicationState.camera.cameraDistance;
    
    document.getElementById('cameraInfo').innerHTML = 
        `Camera Position: (${eye[0].toFixed(1)}, ${eye[1].toFixed(1)}, ${eye[2].toFixed(1)})<br>` +
        `Target: (${target[0].toFixed(1)}, ${target[1].toFixed(1)}, ${target[2].toFixed(1)})<br>` +
        `Distance: ${distance.toFixed(1)}`;
}

// Update Bézier info display
function updateBezierInfo() {
    const param = applicationState.bezierCurve.animationParameter;
    document.getElementById('bezierParam').textContent = param.toFixed(3);
}

// Initialize default UI values
function initializeUIValues() {
    updateTransformation();
    updateCamera();
    updateAnimationSpeed();
    updateCameraInfo();
}