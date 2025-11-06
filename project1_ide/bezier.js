// These codes taken from curves_interactive.html and modified
// Bézier curve implementation for CS405 Project 1

// Bézier curve class for 3D cubic curves
class BezierCurve {
    constructor() {
        // Default control points for 3D space - positioned for better visibility
        this.controlPoints = [
            { x: -4, y: 2, z: -3 },  // P0
            { x: -1, y: 6, z: 1 },   // P1  
            { x: 1, y: 6, z: 1 },    // P2
            { x: 4, y: 2, z: -3 }    // P3
        ];
        this.isAnimating = false;
        this.animationParameter = 0.0;
        this.animationSpeed = 0.005;
        this.animationDirection = 1;
        this.curveResolution = 100; // Number of segments for curve rendering
    }

    // Evaluate cubic Bézier curve at parameter t (0 <= t <= 1)
    // Based on curves_interactive.html implementation
    evaluateBezierCurve(parameterT) {
        const t = Math.max(0, Math.min(1, parameterT));
        const oneMinusT = 1 - t;
        
        // Cubic Bézier formula: (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
        const coefficient0 = oneMinusT * oneMinusT * oneMinusT;
        const coefficient1 = 3 * oneMinusT * oneMinusT * t;
        const coefficient2 = 3 * oneMinusT * t * t;
        const coefficient3 = t * t * t;
        
        return {
            x: coefficient0 * this.controlPoints[0].x + 
               coefficient1 * this.controlPoints[1].x +
               coefficient2 * this.controlPoints[2].x + 
               coefficient3 * this.controlPoints[3].x,
            y: coefficient0 * this.controlPoints[0].y + 
               coefficient1 * this.controlPoints[1].y +
               coefficient2 * this.controlPoints[2].y + 
               coefficient3 * this.controlPoints[3].y,
            z: coefficient0 * this.controlPoints[0].z + 
               coefficient1 * this.controlPoints[1].z +
               coefficient2 * this.controlPoints[2].z + 
               coefficient3 * this.controlPoints[3].z
        };
    }

    // Get tangent vector at parameter t (first derivative)
    getBezierTangent(parameterT) {
        const t = Math.max(0, Math.min(1, parameterT));
        const oneMinusT = 1 - t;
        
        // First derivative coefficients
        const coefficient0 = -3 * oneMinusT * oneMinusT;
        const coefficient1 = 3 * oneMinusT * oneMinusT - 6 * oneMinusT * t;
        const coefficient2 = 6 * oneMinusT * t - 3 * t * t;
        const coefficient3 = 3 * t * t;
        
        return {
            x: coefficient0 * this.controlPoints[0].x + 
               coefficient1 * this.controlPoints[1].x +
               coefficient2 * this.controlPoints[2].x + 
               coefficient3 * this.controlPoints[3].x,
            y: coefficient0 * this.controlPoints[0].y + 
               coefficient1 * this.controlPoints[1].y +
               coefficient2 * this.controlPoints[2].y + 
               coefficient3 * this.controlPoints[3].y,
            z: coefficient0 * this.controlPoints[0].z + 
               coefficient1 * this.controlPoints[1].z +
               coefficient2 * this.controlPoints[2].z + 
               coefficient3 * this.controlPoints[3].z
        };
    }

    // Generate curve vertices for rendering
    generateCurveVertices() {
        const vertices = [];
        const colors = [];
        
        for (let i = 0; i <= this.curveResolution; i++) {
            const parameterT = i / this.curveResolution;
            const point = this.evaluateBezierCurve(parameterT);
            
            vertices.push(point.x, point.y, point.z);
            
            // Color gradient along curve (blue to red)
            const red = parameterT;
            const blue = 1 - parameterT;
            colors.push(red, 0.3, blue);
        }
        
        return { vertices, colors };
    }

    // Generate control polygon vertices for rendering  
    generateControlPolygonVertices() {
        const vertices = [];
        const colors = [];
        
        for (let i = 0; i < this.controlPoints.length; i++) {
            const point = this.controlPoints[i];
            vertices.push(point.x, point.y, point.z);
            colors.push(0.7, 0.7, 0.7); // Gray color for control polygon
        }
        
        return { vertices, colors };
    }

    // Generate control point vertices for rendering
    generateControlPointVertices() {
        const vertices = [];
        const colors = [];
        
        for (let i = 0; i < this.controlPoints.length; i++) {
            const point = this.controlPoints[i];
            vertices.push(point.x, point.y, point.z);
            
            // Different colors for each control point
            if (i === 0) colors.push(1, 0, 0); // Red for P0
            else if (i === 1) colors.push(0, 1, 0); // Green for P1  
            else if (i === 2) colors.push(0, 0, 1); // Blue for P2
            else colors.push(1, 1, 0); // Yellow for P3
        }
        
        return { vertices, colors };
    }

    // Update control point position (for interactive editing)
    updateControlPoint(pointIndex, newX, newY, newZ) {
        if (pointIndex >= 0 && pointIndex < this.controlPoints.length) {
            this.controlPoints[pointIndex].x = newX;
            this.controlPoints[pointIndex].y = newY;
            this.controlPoints[pointIndex].z = newZ;
        }
    }

    // Set control points from screen coordinates (for mouse interaction)
    setControlPointFromScreenCoordinates(pointIndex, screenX, screenY, canvasWidth, canvasHeight) {
        if (pointIndex >= 0 && pointIndex < this.controlPoints.length) {
            // Convert screen coordinates to world coordinates
            // Map screen space to world space more intuitively
            const worldX = ((screenX / canvasWidth) - 0.5) * 20; // Scale to world coordinates
            const worldY = -((screenY / canvasHeight) - 0.5) * 15; // Flip Y and scale
            const worldZ = this.controlPoints[pointIndex].z; // Keep Z unchanged
            
            this.controlPoints[pointIndex].x = worldX;
            this.controlPoints[pointIndex].y = worldY;
            this.controlPoints[pointIndex].z = worldZ;
        }
    }

    
    startAnimation() {
        this.isAnimating = true;
        this.animationParameter = 0.0;
        this.animationDirection = 1;
    }

    stopAnimation() {
        this.isAnimating = false;
    }

    toggleAnimation() {
        this.isAnimating = !this.isAnimating;
        return this.isAnimating;
    }

    
    updateAnimation() {
        if (!this.isAnimating) return;
        
        this.animationParameter += this.animationSpeed * this.animationDirection;
        
        // Reverse direction at endpoints for  animation
        if (this.animationParameter >= 1.0) {
            this.animationParameter = 1.0;
            this.animationDirection = -1;
        } else if (this.animationParameter <= 0.0) {
            this.animationParameter = 0.0;
            this.animationDirection = 1;
        }
    }

    
    getAnimatedPosition() {
        return this.evaluateBezierCurve(this.animationParameter);
    }

   
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.001, Math.min(0.02, speed));
    }


    resetCurve() {
        this.controlPoints = [
            { x: -4, y: 2, z: -3 },
            { x: -1, y: 6, z: 1 },
            { x: 1, y: 6, z: 1 },
            { x: 4, y: 2, z: -3 }
        ];
        this.animationParameter = 0.0;
        this.animationDirection = 1;
    }

    //for mouse interaction
    findNearestControlPoint(screenX, screenY, canvasWidth, canvasHeight, viewMatrix, projectionMatrix, threshold = 50) {
        // Project 3D control points to screen coordinates
        for (let i = 0; i < this.controlPoints.length; i++) {
            const controlPoint = this.controlPoints[i];
            
            // Transform point through view and projection matrices
            const point4D = [controlPoint.x, controlPoint.y, controlPoint.z, 1.0];
            
            // Apply view matrix
            const viewPoint = [
                viewMatrix[0] * point4D[0] + viewMatrix[4] * point4D[1] + viewMatrix[8] * point4D[2] + viewMatrix[12],
                viewMatrix[1] * point4D[0] + viewMatrix[5] * point4D[1] + viewMatrix[9] * point4D[2] + viewMatrix[13],
                viewMatrix[2] * point4D[0] + viewMatrix[6] * point4D[1] + viewMatrix[10] * point4D[2] + viewMatrix[14],
                1.0
            ];
            
            // Apply projection matrix
            const clipPoint = [
                projectionMatrix[0] * viewPoint[0] + projectionMatrix[4] * viewPoint[1] + projectionMatrix[8] * viewPoint[2] + projectionMatrix[12],
                projectionMatrix[1] * viewPoint[0] + projectionMatrix[5] * viewPoint[1] + projectionMatrix[9] * viewPoint[2] + projectionMatrix[13],
                projectionMatrix[2] * viewPoint[0] + projectionMatrix[6] * viewPoint[1] + projectionMatrix[10] * viewPoint[2] + projectionMatrix[14],
                projectionMatrix[3] * viewPoint[0] + projectionMatrix[7] * viewPoint[1] + projectionMatrix[11] * viewPoint[2] + projectionMatrix[15]
            ];
            
            // Perspective divide
            if (clipPoint[3] !== 0) {
                const ndcX = clipPoint[0] / clipPoint[3];
                const ndcY = clipPoint[1] / clipPoint[3];
                
                // Convert NDC to screen coordinates
                const screenPointX = (ndcX + 1.0) * 0.5 * canvasWidth;
                const screenPointY = (1.0 - ndcY) * 0.5 * canvasHeight;
                
                const distance = Math.sqrt((screenX - screenPointX) ** 2 + (screenY - screenPointY) ** 2);
                if (distance < threshold) {
                    return i;
                }
            }
        }
        return -1;
    }

    // Get curve properties for display
    getCurveProperties() {
        return {
            controlPoints: this.controlPoints.map(p => ({x: p.x.toFixed(2), y: p.y.toFixed(2), z: p.z.toFixed(2)})),
            animationParameter: this.animationParameter.toFixed(3),
            isAnimating: this.isAnimating,
            currentPosition: this.getAnimatedPosition()
        };
    }
}

// Utility function to create a cube at animated position
function createAnimatedCubeTransform(bezierCurve) {
    const animatedPosition = bezierCurve.getAnimatedPosition();
    const tangent = bezierCurve.getBezierTangent(bezierCurve.animationParameter);
    
    // Create transformation matrix for cube at animated position
    let transform = createTranslationMatrix(animatedPosition.x, animatedPosition.y, animatedPosition.z);
    
    // Optionally orient cube along tangent direction
    if (tangent.x !== 0 || tangent.z !== 0) {
        const angle = Math.atan2(tangent.x, tangent.z);
        const rotationMatrix = createRotationMatrixY(angle);
        transform = multiplyMatrices(transform, rotationMatrix);
    }
    
    // Scale cube slightly smaller
    const scaleMatrix = createScalingMatrix(0.3, 0.3, 0.3);
    transform = multiplyMatrices(transform, scaleMatrix);
    
    return transform;
}