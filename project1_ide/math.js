// These codes taken from lab2/affine.js and webgl_transformations.html and modified
// Matrix operations for CS405 Project 1 - WebGL uses column-major ordering

// Create identity matrix
function createIdentityMatrix() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

// Create translation matrix
function createTranslationMatrix(translateX, translateY, translateZ) {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translateX, translateY, translateZ, 1
    ];
}

// Create scaling matrix
function createScalingMatrix(scaleX, scaleY, scaleZ) {
    return [
        scaleX, 0, 0, 0,
        0, scaleY, 0, 0,
        0, 0, scaleZ, 0,
        0, 0, 0, 1
    ];
}

// Create rotation matrix around X axis
function createRotationMatrixX(angleInRadians) {
    const cosine = Math.cos(angleInRadians);
    const sine = Math.sin(angleInRadians);
    return [
        1, 0, 0, 0,
        0, cosine, sine, 0,
        0, -sine, cosine, 0,
        0, 0, 0, 1
    ];
}

// Create rotation matrix around Y axis
function createRotationMatrixY(angleInRadians) {
    const cosine = Math.cos(angleInRadians);
    const sine = Math.sin(angleInRadians);
    return [
        cosine, 0, -sine, 0,
        0, 1, 0, 0,
        sine, 0, cosine, 0,
        0, 0, 0, 1
    ];
}

// Create rotation matrix around Z axis - taken from lab2/affine.js and modified
function createRotationMatrixZ(angleInRadians) {
    const cosine = Math.cos(angleInRadians);
    const sine = Math.sin(angleInRadians);
    return [
        cosine, sine, 0, 0,
        -sine, cosine, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

// Matrix multiplication for 4x4 matrices (column-major)
// These codes taken from webgl_transformations.html and modified
function multiplyMatrices(matrixA, matrixB) {
    const result = new Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            result[column * 4 + row] = 
                matrixA[0 * 4 + row] * matrixB[column * 4 + 0] +
                matrixA[1 * 4 + row] * matrixB[column * 4 + 1] +
                matrixA[2 * 4 + row] * matrixB[column * 4 + 2] +
                matrixA[3 * 4 + row] * matrixB[column * 4 + 3];
        }
    }
    return result;
}

// Create perspective projection matrix
function createPerspectiveProjectionMatrix(fieldOfViewInRadians, aspectRatio, nearPlane, farPlane) {
    const fieldOfViewScale = 1.0 / Math.tan(fieldOfViewInRadians / 2);
    const nearFarRange = 1 / (nearPlane - farPlane);
    
    return [
        fieldOfViewScale / aspectRatio, 0, 0, 0,
        0, fieldOfViewScale, 0, 0,
        0, 0, (farPlane + nearPlane) * nearFarRange, -1,
        0, 0, 2 * farPlane * nearPlane * nearFarRange, 0
    ];
}

// Create orthographic projection matrix
function createOrthographicProjectionMatrix(left, right, bottom, top, nearPlane, farPlane) {
    return [
        2 / (right - left), 0, 0, 0,
        0, 2 / (top - bottom), 0, 0,
        0, 0, -2 / (farPlane - nearPlane), 0,
        -(right + left) / (right - left), -(top + bottom) / (top - bottom), -(farPlane + nearPlane) / (farPlane - nearPlane), 1
    ];
}

// Utility functions for vector operations
function normalizeVector(vector) {
    const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function crossProduct(vectorA, vectorB) {
    return [
        vectorA[1] * vectorB[2] - vectorA[2] * vectorB[1],
        vectorA[2] * vectorB[0] - vectorA[0] * vectorB[2],
        vectorA[0] * vectorB[1] - vectorA[1] * vectorB[0]
    ];
}

function dotProduct(vectorA, vectorB) {
    return vectorA[0] * vectorB[0] + vectorA[1] * vectorB[1] + vectorA[2] * vectorB[2];
}

// Convert degrees to radians
function degreesToRadians(angleInDegrees) {
    return angleInDegrees * Math.PI / 180;
}

// Convert matrix to formatted JSON string for display
function formatMatrixAsJSON(matrix) {
    // 1. Validate the input size for a 4x4 matrix
    if (!Array.isArray(matrix) || matrix.length !== 16) {
        return "Error: Input must be an array containing exactly 16 numbers for a 4x4 matrix.";
    }

    // 2. Format the numbers (round to 4 decimal places)
    // We use toFixed(4) to ensure 4 decimal places, and parseFloat to remove trailing zeros
    const formatted = matrix.map(value => parseFloat(value.toFixed(4)));

    let output = "[";
    const numColumns = 4;

    // 3. Group and construct the string
    for (let i = 0; i < matrix.length; i += numColumns) {
        // Get the slice for the current row
        const row = formatted.slice(i, i + numColumns);
        
        // Join elements in the row with a single space
        const rowString = row.join(" ");

        output += rowString;

        // Add a newline character if it's not the last row
        if (i < matrix.length - numColumns) {
            output += "\n";
        }
    }

    // 4. Close the matrix bracket
    output += "]";
    return output;
}

// Get transformation matrix with specified order (TRS, RTS, etc.)
function createTransformationMatrix(translateX, translateY, translateZ, 
                                  rotateX, rotateY, rotateZ, 
                                  scaleX, scaleY, scaleZ, 
                                  transformationOrder) {
    const translationMatrix = createTranslationMatrix(translateX, translateY, translateZ);
    const rotationMatrixX = createRotationMatrixX(degreesToRadians(rotateX));
    const rotationMatrixY = createRotationMatrixY(degreesToRadians(rotateY));
    const rotationMatrixZ = createRotationMatrixZ(degreesToRadians(rotateZ));
    const scalingMatrix = createScalingMatrix(scaleX, scaleY, scaleZ);
    
    // Combine rotation matrices (order: Z * Y * X)
    const combinedRotationMatrix = multiplyMatrices(rotationMatrixZ, 
                                  multiplyMatrices(rotationMatrixY, rotationMatrixX));
    
    // Apply transformation order
    switch(transformationOrder) {
        case 'TRS':
            return multiplyMatrices(translationMatrix, 
                   multiplyMatrices(combinedRotationMatrix, scalingMatrix));
        case 'TSR':
            return multiplyMatrices(translationMatrix, 
                   multiplyMatrices(scalingMatrix, combinedRotationMatrix));
        case 'RTS':
            return multiplyMatrices(combinedRotationMatrix, 
                   multiplyMatrices(translationMatrix, scalingMatrix));
        case 'RST':
            return multiplyMatrices(combinedRotationMatrix, 
                   multiplyMatrices(scalingMatrix, translationMatrix));
        case 'STR':
            return multiplyMatrices(scalingMatrix, 
                   multiplyMatrices(translationMatrix, combinedRotationMatrix));
        case 'SRT':
            return multiplyMatrices(scalingMatrix, 
                   multiplyMatrices(combinedRotationMatrix, translationMatrix));
        default:
            // Default to TRS order
            return multiplyMatrices(translationMatrix, 
                   multiplyMatrices(combinedRotationMatrix, scalingMatrix));
    }
}

// Matrix inversion function for 4x4 matrices - simplified for view matrix inversion
function invertMatrix(matrix) {
    // For view matrices, we can use a simpler approach since they're composed of
    // rotation and translation. We extract the rotation part (3x3) and translation.
    // Inverse = [R^T | -R^T * t] where R is rotation, t is translation
    
    // Extract rotation part (3x3 upper-left) and transpose it
    const r00 = matrix[0], r01 = matrix[4], r02 = matrix[8];
    const r10 = matrix[1], r11 = matrix[5], r12 = matrix[9];
    const r20 = matrix[2], r21 = matrix[6], r22 = matrix[10];
    
    // Extract translation part
    const tx = matrix[12], ty = matrix[13], tz = matrix[14];
    
    // Compute -R^T * t
    const newTx = -(r00 * tx + r10 * ty + r20 * tz);
    const newTy = -(r01 * tx + r11 * ty + r21 * tz);
    const newTz = -(r02 * tx + r12 * ty + r22 * tz);
    
    // Build inverse matrix: [R^T | -R^T * t]
    return [
        r00, r10, r20, 0,
        r01, r11, r21, 0,
        r02, r12, r22, 0,
        newTx, newTy, newTz, 1
    ];
}