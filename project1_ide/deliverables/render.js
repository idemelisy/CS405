// These codes taken from lab2/script.js and lab2/affine.js and modified
// WebGL rendering setup for CS405 Project 1

// Vertex shader source - taken from lab2 and modified
const vertexShaderSource = `
    attribute vec3 vertexPosition;
    attribute vec3 vertexColor;
    
    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    
    varying vec3 fragmentColor;
    
    void main() {
        // Apply transformation chain: Projection × View × Model × Position
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(vertexPosition, 1.0);
        fragmentColor = vertexColor;
        
        // Set point size for control points
        gl_PointSize = 15.0;
    }
`;

// Fragment shader source - taken from lab2 and modified
const fragmentShaderSource = `
    precision mediump float;
    varying vec3 fragmentColor;
    uniform float uAlpha;
    
    void main() {
        gl_FragColor = vec4(fragmentColor, uAlpha);
    }
`;

// WebGL renderer class
class WebGLRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.webglContext = null;
        this.shaderProgram = null;
        this.buffers = {};
        this.uniformLocations = {};
        this.attributeLocations = {};
        
        this.initializeWebGL();
    }

    // Initialize WebGL context and shaders - based on lab2/script.js
    initializeWebGL() {
        this.webglContext = this.canvas.getContext("webgl");
        if (!this.webglContext) {
            console.log("WebGL not supported, please update your browser");
            return;
        }

        // Set up WebGL state
        this.webglContext.clearColor(0.9, 0.9, 0.9, 1.0);
        this.webglContext.enable(this.webglContext.DEPTH_TEST);
        this.webglContext.enable(this.webglContext.CULL_FACE);
        
        // Create shader program
        this.createShaderProgram();
        
        // Get attribute and uniform locations
        this.getShaderLocations();
    }

    // Create and compile shader - based on lab2/script.js
    createShader(shaderType, shaderSource) {
        const shader = this.webglContext.createShader(shaderType);
        this.webglContext.shaderSource(shader, shaderSource);
        this.webglContext.compileShader(shader);
        
        if (!this.webglContext.getShaderParameter(shader, this.webglContext.COMPILE_STATUS)) {
            console.error("Shader compilation error:", this.webglContext.getShaderInfoLog(shader));
            this.webglContext.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Create shader program - based on lab2/script.js
    createShaderProgram() {
        const vertexShader = this.createShader(this.webglContext.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.webglContext.FRAGMENT_SHADER, fragmentShaderSource);
        
        this.shaderProgram = this.webglContext.createProgram();
        this.webglContext.attachShader(this.shaderProgram, vertexShader);
        this.webglContext.attachShader(this.shaderProgram, fragmentShader);
        this.webglContext.linkProgram(this.shaderProgram);
        
        if (!this.webglContext.getProgramParameter(this.shaderProgram, this.webglContext.LINK_STATUS)) {
            console.error("Program linking error:", this.webglContext.getProgramInfoLog(this.shaderProgram));
            return;
        }
        
        this.webglContext.useProgram(this.shaderProgram);
    }

    // Get shader locations - based on lab2/script.js
    getShaderLocations() {
        this.attributeLocations = {
            vertexPosition: this.webglContext.getAttribLocation(this.shaderProgram, "vertexPosition"),
            vertexColor: this.webglContext.getAttribLocation(this.shaderProgram, "vertexColor")
        };
        
        this.uniformLocations = {
            modelMatrix: this.webglContext.getUniformLocation(this.shaderProgram, "modelMatrix"),
            viewMatrix: this.webglContext.getUniformLocation(this.shaderProgram, "viewMatrix"),
            projectionMatrix: this.webglContext.getUniformLocation(this.shaderProgram, "projectionMatrix"),
            uAlpha: this.webglContext.getUniformLocation(this.shaderProgram, "uAlpha")
        };
    }

    // Create buffer for vertex data - based on lab2/script.js
    createBuffer(bufferName, data, bufferType = this.webglContext.ARRAY_BUFFER) {
        const buffer = this.webglContext.createBuffer();
        this.webglContext.bindBuffer(bufferType, buffer);
        
        if (bufferType === this.webglContext.ELEMENT_ARRAY_BUFFER) {
            this.webglContext.bufferData(bufferType, new Uint16Array(data), this.webglContext.STATIC_DRAW);
        } else {
            this.webglContext.bufferData(bufferType, new Float32Array(data), this.webglContext.STATIC_DRAW);
        }
        
        this.buffers[bufferName] = buffer;
        return buffer;
    }

    // Update buffer data - for dynamic geometry
    updateBuffer(bufferName, data, bufferType = this.webglContext.ARRAY_BUFFER) {
        if (this.buffers[bufferName]) {
            this.webglContext.bindBuffer(bufferType, this.buffers[bufferName]);
            
            if (bufferType === this.webglContext.ELEMENT_ARRAY_BUFFER) {
                this.webglContext.bufferData(bufferType, new Uint16Array(data), this.webglContext.DYNAMIC_DRAW);
            } else {
                this.webglContext.bufferData(bufferType, new Float32Array(data), this.webglContext.DYNAMIC_DRAW);
            }
        }
    }

    // Initialize cube data directly - based on lab2 approach
    initializeCubeData() {
        // Cube data embedded directly like in lab2 - no external file loading needed
        const cubeData = {
            positions: [
                -1.0, -1.0,  1.0,   1.0, -1.0,  1.0,   1.0,  1.0,  1.0,  -1.0,  1.0,  1.0,
                -1.0, -1.0, -1.0,  -1.0,  1.0, -1.0,   1.0,  1.0, -1.0,   1.0, -1.0, -1.0,
                -1.0,  1.0, -1.0,  -1.0,  1.0,  1.0,   1.0,  1.0,  1.0,   1.0,  1.0, -1.0,
                -1.0, -1.0, -1.0,   1.0, -1.0, -1.0,   1.0, -1.0,  1.0,  -1.0, -1.0,  1.0,
                 1.0, -1.0, -1.0,   1.0,  1.0, -1.0,   1.0,  1.0,  1.0,   1.0, -1.0,  1.0,
                -1.0, -1.0, -1.0,  -1.0, -1.0,  1.0,  -1.0,  1.0,  1.0,  -1.0,  1.0, -1.0
            ],
            colors: [
                1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0, // Front - Red
                0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0, // Back - Green
                0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0, // Top - Blue
                1.0, 1.0, 0.0,   1.0, 1.0, 0.0,   1.0, 1.0, 0.0,   1.0, 1.0, 0.0, // Bottom - Yellow
                1.0, 0.0, 1.0,   1.0, 0.0, 1.0,   1.0, 0.0, 1.0,   1.0, 0.0, 1.0, // Right - Magenta
                0.0, 1.0, 1.0,   0.0, 1.0, 1.0,   0.0, 1.0, 1.0,   0.0, 1.0, 1.0  // Left - Cyan
            ],
            indices: [
                 0,  1,  2,   0,  2,  3,
                 4,  5,  6,   4,  6,  7,
                 8,  9, 10,   8, 10, 11,
                12, 13, 14,  12, 14, 15,
                16, 17, 18,  16, 18, 19,
                20, 21, 22,  20, 22, 23
            ]
        };
        
        // Create buffers for cube data
        this.createBuffer('cubePositions', cubeData.positions);
        this.createBuffer('cubeColors', cubeData.colors);
        this.createBuffer('cubeIndices', cubeData.indices, this.webglContext.ELEMENT_ARRAY_BUFFER);
        
        return cubeData;
    }

    // Set up vertex attributes - based on lab2/script.js
    setupVertexAttributes(positionBuffer, colorBuffer) {
        // Position attribute
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, positionBuffer);
        this.webglContext.vertexAttribPointer(
            this.attributeLocations.vertexPosition,
            3, // 3 components per vertex (x, y, z)
            this.webglContext.FLOAT,
            false,
            0,
            0
        );
        this.webglContext.enableVertexAttribArray(this.attributeLocations.vertexPosition);

        // Color attribute
        this.webglContext.bindBuffer(this.webglContext.ARRAY_BUFFER, colorBuffer);
        this.webglContext.vertexAttribPointer(
            this.attributeLocations.vertexColor,
            3, // 3 components per color (r, g, b)
            this.webglContext.FLOAT,
            false,
            0,
            0
        );
        this.webglContext.enableVertexAttribArray(this.attributeLocations.vertexColor);
    }

    // Set matrices uniforms
    setMatrixUniforms(modelMatrix, viewMatrix, projectionMatrix, alpha = 1.0) {
        this.webglContext.uniformMatrix4fv(this.uniformLocations.modelMatrix, false, new Float32Array(modelMatrix));
        this.webglContext.uniformMatrix4fv(this.uniformLocations.viewMatrix, false, new Float32Array(viewMatrix));
        this.webglContext.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, new Float32Array(projectionMatrix));
        this.webglContext.uniform1f(this.uniformLocations.uAlpha, alpha);
    }

    // Draw cube
    drawCube(modelMatrix, viewMatrix, projectionMatrix) {
        this.setupVertexAttributes(this.buffers.cubePositions, this.buffers.cubeColors);
        this.setMatrixUniforms(modelMatrix, viewMatrix, projectionMatrix);
        
        this.webglContext.bindBuffer(this.webglContext.ELEMENT_ARRAY_BUFFER, this.buffers.cubeIndices);
        this.webglContext.drawElements(this.webglContext.TRIANGLES, 36, this.webglContext.UNSIGNED_SHORT, 0);
    }

    // Draw lines (for curves, axes, grid)
    drawLines(positionBuffer, colorBuffer, vertexCount, modelMatrix, viewMatrix, projectionMatrix) {
        this.setupVertexAttributes(positionBuffer, colorBuffer);
        this.setMatrixUniforms(modelMatrix, viewMatrix, projectionMatrix);
        
        this.webglContext.drawArrays(this.webglContext.LINE_STRIP, 0, vertexCount);
    }

    // Draw line segments (for grid, control polygon)
    drawLineSegments(positionBuffer, colorBuffer, vertexCount, modelMatrix, viewMatrix, projectionMatrix) {
        this.setupVertexAttributes(positionBuffer, colorBuffer);
        this.setMatrixUniforms(modelMatrix, viewMatrix, projectionMatrix);
        
        this.webglContext.drawArrays(this.webglContext.LINES, 0, vertexCount);
    }

    // Draw points (for control points)
    drawPoints(positionBuffer, colorBuffer, vertexCount, modelMatrix, viewMatrix, projectionMatrix) {
        this.setupVertexAttributes(positionBuffer, colorBuffer);
        this.setMatrixUniforms(modelMatrix, viewMatrix, projectionMatrix);
        
        // Disable depth test for points so they're always visible
        this.webglContext.disable(this.webglContext.DEPTH_TEST);
        this.webglContext.drawArrays(this.webglContext.POINTS, 0, vertexCount);
        this.webglContext.enable(this.webglContext.DEPTH_TEST);
    }

    // Draw triangles (for frustum surfaces)
    drawTriangles(positionBuffer, colorBuffer, vertexCount, modelMatrix, viewMatrix, projectionMatrix, alpha = 1.0) {
        this.setupVertexAttributes(positionBuffer, colorBuffer);
        this.setMatrixUniforms(modelMatrix, viewMatrix, projectionMatrix, alpha);
        
        this.webglContext.drawArrays(this.webglContext.TRIANGLES, 0, vertexCount);
    }

    // Clear screen
    clearScreen() {
        this.webglContext.clear(this.webglContext.COLOR_BUFFER_BIT | this.webglContext.DEPTH_BUFFER_BIT);
    }

    // Resize viewport
    resizeViewport(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.webglContext.viewport(0, 0, width, height);
    }

    // Get canvas dimensions
    getCanvasSize() {
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    // Setup frustum geometry for camera visualization
    setupFrustumGeometry(fieldOfView, aspectRatio, nearPlane, farPlane) {
        this.frustumGeometry = createCameraFrustumGeometry(fieldOfView, aspectRatio, nearPlane, farPlane);
        
        // Clean up old buffers if they exist
        if (this.buffers.frustumPositions) {
            this.webglContext.deleteBuffer(this.buffers.frustumPositions);
        }
        if (this.buffers.frustumColors) {
            this.webglContext.deleteBuffer(this.buffers.frustumColors);
        }
        
        // Create new buffers for frustum
        this.createBuffer('frustumPositions', this.frustumGeometry.positions);
        this.createBuffer('frustumColors', this.frustumGeometry.colors);
        
        // Also create camera indicator
        this.cameraIndicatorGeometry = createCameraIndicatorGeometry();
        
        // Clean up old camera indicator buffers
        if (this.buffers.cameraPositions) {
            this.webglContext.deleteBuffer(this.buffers.cameraPositions);
        }
        if (this.buffers.cameraColors) {
            this.webglContext.deleteBuffer(this.buffers.cameraColors);
        }
        
        // Create new buffers for camera indicator
        this.createBuffer('cameraPositions', this.cameraIndicatorGeometry.positions);
        this.createBuffer('cameraColors', this.cameraIndicatorGeometry.colors);
        
        return this.frustumGeometry;
    }
}