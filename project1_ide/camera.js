// These codes taken from webgl_3d_viewing.html and modified
// Camera implementation for CS405 Project 1

// Camera class for 3D viewing
class Camera {
    constructor() {
        this.eyePosition = [0, 5, 10];
        this.targetPosition = [0, 0, 0];
        this.upVector = [0, 1, 0];
        this.fieldOfView = 45; // degrees
        this.nearPlane = 0.1;
        this.farPlane = 100;
        this.aspectRatio = 1;
        this.isUsingPerspectiveProjection = true;
        
        // For orbital camera controls
        this.cameraRotation = { x: 0, y: 0 };
        this.cameraDistance = 15;
    }

    // Create lookAt view matrix - implementation based on webgl_3d_viewing.html
    createLookAtMatrix(eyePosition, targetPosition, upVector) {
        // Calculate camera coordinate system vectors
        const forwardVector = normalizeVector([
            eyePosition[0] - targetPosition[0],
            eyePosition[1] - targetPosition[1], 
            eyePosition[2] - targetPosition[2]
        ]);
        
        const rightVector = normalizeVector(crossProduct(upVector, forwardVector));
        const cameraUpVector = crossProduct(forwardVector, rightVector);
        
        // Create view matrix (inverse of camera transformation)
        return [
            rightVector[0], cameraUpVector[0], forwardVector[0], 0,
            rightVector[1], cameraUpVector[1], forwardVector[1], 0,
            rightVector[2], cameraUpVector[2], forwardVector[2], 0,
            -dotProduct(rightVector, eyePosition), 
            -dotProduct(cameraUpVector, eyePosition), 
            -dotProduct(forwardVector, eyePosition), 1
        ];
    }

    // Get current view matrix
    getViewMatrix() {
        return this.createLookAtMatrix(this.eyePosition, this.targetPosition, this.upVector);
    }

    // Get current projection matrix
    getProjectionMatrix() {
        if (this.isUsingPerspectiveProjection) {
            return createPerspectiveProjectionMatrix(
                degreesToRadians(this.fieldOfView),
                this.aspectRatio,
                this.nearPlane,
                this.farPlane
            );
        } else {
            const viewSize = 10;
            return createOrthographicProjectionMatrix(
                -viewSize * this.aspectRatio, viewSize * this.aspectRatio,
                -viewSize, viewSize,
                this.nearPlane, this.farPlane
            );
        }
    }

    // Update camera position based on orbital rotation
    updateCameraFromRotation() {
        const x = this.cameraDistance * Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
        const y = this.cameraDistance * Math.sin(this.cameraRotation.x);
        const z = this.cameraDistance * Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x);
        this.eyePosition = [x, y, z];
    }

    // Move camera forward/backward
    moveCameraForward(deltaDistance) {
        this.cameraDistance += deltaDistance;
        this.cameraDistance = Math.max(2, Math.min(50, this.cameraDistance));
        this.updateCameraFromRotation();
    }

    // Rotate camera around target
    rotateCameraAroundTarget(deltaX, deltaY) {
        this.cameraRotation.y += deltaX;
        this.cameraRotation.x += deltaY;
        this.cameraRotation.x = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.cameraRotation.x));
        this.updateCameraFromRotation();
    }

    // Pan camera target
    panCameraTarget(deltaX, deltaY) {
        this.targetPosition[0] += deltaX;
        this.targetPosition[1] += deltaY;
    }

    // Get current camera position
    getPosition() {
        return [this.eyePosition[0], this.eyePosition[1], this.eyePosition[2]];
    }

    // Reset camera to default position
    resetCameraPosition() {
        this.eyePosition = [0, 5, 10];
        this.targetPosition = [0, 0, 0];
        this.upVector = [0, 1, 0];
        this.cameraRotation.x = 0.3;
        this.cameraRotation.y = 0.5;
        this.cameraDistance = 15;
        this.updateCameraFromRotation();
    }

    // Toggle between perspective and orthographic projection
    toggleProjectionType() {
        this.isUsingPerspectiveProjection = !this.isUsingPerspectiveProjection;
        return this.isUsingPerspectiveProjection ? 'perspective' : 'orthographic';
    }

    // Set projection type explicitly
    setProjectionType(projectionType) {
        this.isUsingPerspectiveProjection = (projectionType === 'perspective');
    }

    // Update field of view
    setFieldOfView(fieldOfViewInDegrees) {
        this.fieldOfView = Math.max(10, Math.min(120, fieldOfViewInDegrees));
    }

    // Update near and far planes
    setClippingPlanes(nearPlane, farPlane) {
        this.nearPlane = Math.max(0.1, nearPlane);
        this.farPlane = Math.max(this.nearPlane + 1, farPlane);
    }

    // Set aspect ratio
    setAspectRatio(aspectRatio) {
        this.aspectRatio = aspectRatio;
    }
}

// Create coordinate axes geometry for visualization
function createCoordinateAxesGeometry() {
    const axesPositions = [
        0, 0, 0,  5, 0, 0,  // X axis - red
        0, 0, 0,  0, 5, 0,  // Y axis - green  
        0, 0, 0,  0, 0, 5   // Z axis - blue
    ];
    
    const axesColors = [
        1, 0, 0,  1, 0, 0,  // Red for X
        0, 1, 0,  0, 1, 0,  // Green for Y
        0, 0, 1,  0, 0, 1   // Blue for Z
    ];

    return {
        positions: axesPositions,
        colors: axesColors,
        vertexCount: 6
    };
}

// Create grid geometry for ground reference
function createGridGeometry(gridSize, stepSize) {
    const gridLines = [];
    const gridColors = [];
    
    for (let i = -gridSize; i <= gridSize; i += stepSize) {
        // Lines parallel to X axis
        gridLines.push(i, 0, -gridSize, i, 0, gridSize);
        gridColors.push(0.3, 0.3, 0.3, 0.3, 0.3, 0.3);
        
        // Lines parallel to Z axis  
        gridLines.push(-gridSize, 0, i, gridSize, 0, i);
        gridColors.push(0.3, 0.3, 0.3, 0.3, 0.3, 0.3);
    }
    
    return {
        positions: gridLines,
        colors: gridColors,
        vertexCount: gridLines.length / 3
    };
}

// Create camera frustum geometry for visualization
function createCameraFrustumGeometry(fieldOfViewInDegrees, aspectRatio, nearPlane, farPlane) {
    const fovRadians = degreesToRadians(fieldOfViewInDegrees);
    
    // Use actual near and far plane distances but limit far plane for better visibility
    const near = nearPlane;   
    const far = Math.min(farPlane, nearPlane + 10); // Limit frustum depth to 10 units max     
    
    const halfHeightNear = near * Math.tan(fovRadians / 2);
    const halfWidthNear = halfHeightNear * aspectRatio;
    const halfHeightFar = far * Math.tan(fovRadians / 2);
    const halfWidthFar = halfHeightFar * aspectRatio;
    
    // Create solid frustum surfaces (triangles for filled rendering)
    const frustumVertices = [];
    const frustumColors = [];
    
    // Camera origin point (this is where the camera sits)
    const cameraOrigin = [0, 0, 0];
    
    // Near plane corners (in camera space, looking down -Z axis)
    const nearCorners = [
        [-halfWidthNear, -halfHeightNear, -near],  // 0: Near bottom-left
        [ halfWidthNear, -halfHeightNear, -near],  // 1: Near bottom-right
        [ halfWidthNear,  halfHeightNear, -near],  // 2: Near top-right
        [-halfWidthNear,  halfHeightNear, -near]   // 3: Near top-left
    ];
    
    // Far plane corners  
    const farCorners = [
        [-halfWidthFar, -halfHeightFar, -far],    // 4: Far bottom-left
        [ halfWidthFar, -halfHeightFar, -far],    // 5: Far bottom-right
        [ halfWidthFar,  halfHeightFar, -far],    // 6: Far top-right
        [-halfWidthFar,  halfHeightFar, -far]     // 7: Far top-left
    ];
    
    // Helper function to add triangle
    function addTriangle(p1, p2, p3, color) {
        frustumVertices.push(...p1, ...p2, ...p3);
        frustumColors.push(...color, ...color, ...color);
    }
    
    // Colors for different faces
    const nearColor = [1.0, 1.0, 0.0];    // Yellow - near plane
    const farColor = [0.0, 0.8, 1.0];     // Light blue - far plane  
    const sideColor = [0.8, 0.4, 1.0];    // Purple - side faces
    const topColor = [1.0, 0.6, 0.2];     // Orange - top face
    const bottomColor = [0.2, 1.0, 0.6];  // Green - bottom face
    
    // Near plane (2 triangles) - semi-transparent yellow
    addTriangle(nearCorners[0], nearCorners[1], nearCorners[2], [1.0, 1.0, 0.0]);
    addTriangle(nearCorners[0], nearCorners[2], nearCorners[3], [1.0, 1.0, 0.0]);
    
    // Far plane (2 triangles) - semi-transparent blue
    addTriangle(farCorners[0], farCorners[2], farCorners[1], [0.0, 0.8, 1.0]);
    addTriangle(farCorners[0], farCorners[3], farCorners[2], [0.0, 0.8, 1.0]);
    
    // Left side face (2 triangles) - purple
    addTriangle(cameraOrigin, nearCorners[0], nearCorners[3], sideColor);
    addTriangle(nearCorners[0], farCorners[0], farCorners[3], sideColor);
    addTriangle(nearCorners[0], farCorners[3], nearCorners[3], sideColor);
    
    // Right side face (2 triangles) - purple  
    addTriangle(cameraOrigin, nearCorners[2], nearCorners[1], sideColor);
    addTriangle(nearCorners[1], farCorners[2], farCorners[1], sideColor);
    addTriangle(nearCorners[1], nearCorners[2], farCorners[2], sideColor);
    
    // Top face (2 triangles) - orange
    addTriangle(cameraOrigin, nearCorners[3], nearCorners[2], topColor);
    addTriangle(nearCorners[2], farCorners[2], farCorners[3], topColor);
    addTriangle(nearCorners[2], farCorners[3], nearCorners[3], topColor);
    
    // Bottom face (2 triangles) - green
    addTriangle(cameraOrigin, nearCorners[1], nearCorners[0], bottomColor);
    addTriangle(nearCorners[0], farCorners[1], farCorners[0], bottomColor);
    addTriangle(nearCorners[0], nearCorners[1], farCorners[1], bottomColor);
    
    return {
        positions: frustumVertices,
        colors: frustumColors,
        vertexCount: frustumVertices.length / 3
    };
}

// Create camera indicator geometry (small cube to show camera position)
function createCameraIndicatorGeometry() {
    const size = 0.2; // Smaller size for better visibility
    const cameraVertices = [];
    const cameraColors = [];
    
    // Define cube vertices around origin (camera position)
    const vertices = [
        [-size, -size, -size], [size, -size, -size], [size, size, -size], [-size, size, -size], // Back face
        [-size, -size,  size], [size, -size,  size], [size, size,  size], [-size, size,  size]  // Front face
    ];
    
    // Cube faces as triangles
    const faces = [
        [0, 1, 2], [0, 2, 3], // Back
        [4, 6, 5], [4, 7, 6], // Front  
        [0, 4, 5], [0, 5, 1], // Bottom
        [2, 6, 7], [2, 7, 3], // Top
        [0, 3, 7], [0, 7, 4], // Left
        [1, 5, 6], [1, 6, 2]  // Right
    ];
    
    // Camera color (bright magenta/pink)
    const cameraColor = [1.0, 0.0, 1.0]; // Magenta - easy to spot
    
    // Add triangles for camera cube
    faces.forEach(face => {
        face.forEach(vertexIndex => {
            cameraVertices.push(...vertices[vertexIndex]);
            cameraColors.push(...cameraColor);
        });
    });
    
    return {
        positions: cameraVertices,
        colors: cameraColors,
        vertexCount: cameraVertices.length / 3
    };
}