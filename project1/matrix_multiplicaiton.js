/**
 * Matrix Multiplication: out = a * b
 * 
 * WebGL stores 4x4 matrices in column-major order as a Float32Array of 16 elements:
 * 
 * Matrix layout (visual):
 *   [m0  m4  m8  m12]    [col0]  [col1]  [col2]  [col3]
 *   [m1  m5  m9  m13]  = [row0] [row0] [row0] [row0]
 *   [m2  m6  m10 m14]    [row1] [row1] [row1] [row1]
 *   [m3  m7  m11 m15]    [row2] [row2] [row2] [row2]
 *                         [row3] [row3] [row3] [row3]
 * 
 * To access element at column c, row r: index = c*4 + r
 * 
 * Matrix multiplication formula:
 *   out[c][r] = sum over k: a[k][r] * b[c][k]
 *   which means: take row r from a, column c from b, and dot product them
 * 
 * For a 4x4 matrix: out[c][r] = a[0][r]*b[c][0] + a[1][r]*b[c][1] + a[2][r]*b[c][2] + a[3][r]*b[c][3]
 */
function matrix_multiplication(a, b) {
    const out = new Float32Array(16); // Output matrix: 4 columns × 4 rows = 16 elements
    
    // Iterate over each column of the result matrix
    for (let column = 0; column < 4; column++) {
        // Iterate over each row of the result matrix
        for (let row = 0; row < 4; row++) {
            // Calculate out[column][row] using the dot product formula:
            // out[column][row] = sum of (a[col][row] * b[column][col]) for col = 0 to 3
            
            // Access pattern:
            // - a[col*4 + row]: row 'row' from column 'col' of matrix a
            // - b[column*4 + col]: column 'col' from row 'col' of matrix b (which is column 'col' in column-major)
            
            // The formula: out[c][r] = a[0][r]*b[c][0] + a[1][r]*b[c][1] + a[2][r]*b[c][2] + a[3][r]*b[c][3]
            out[column*4 + row] = 
                a[0*4 + row] * b[column*4 + 0] +  // a's col0, row 'row' * b's col 'column', row 0
                a[1*4 + row] * b[column*4 + 1] +  // a's col1, row 'row' * b's col 'column', row 1
                a[2*4 + row] * b[column*4 + 2] +  // a's col2, row 'row' * b's col 'column', row 2
                a[3*4 + row] * b[column*4 + 3];   // a's col3, row 'row' * b's col 'column', row 3
        }
    }
    return out;
}

/**
 * Example: Let's multiply two simple matrices
 * 
 * a = [1  0]    b = [5  6]
 *     [0  1]        [7  8]
 * 
 * For a 2x2 (same logic applies to 4x4):
 * 
 * Column-major storage:
 * a = [1, 0, 0, 1]  (column0: [1,0], column1: [0,1])
 * b = [5, 7, 6, 8]  (column0: [5,7], column1: [6,8])
 * 
 * out[0][0] = a[0][0]*b[0][0] + a[1][0]*b[0][1]
 *           = a[0*2+0]*b[0*2+0] + a[1*2+0]*b[0*2+1]
 *           = a[0]*b[0] + a[2]*b[1]
 *           = 1*5 + 0*7 = 5
 * 
 * out[0][1] = a[0][1]*b[0][0] + a[1][1]*b[0][1]
 *           = a[0*2+1]*b[0*2+0] + a[1*2+1]*b[0*2+1]
 *           = a[1]*b[0] + a[3]*b[1]
 *           = 0*5 + 1*7 = 7
 * 
 * Result: [5  6]
 *         [7  8] (which is correct since a is identity)
 */