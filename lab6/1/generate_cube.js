function generateCube(tess) {
    const positions = [];
    const colors = [];
    const indices = [];
    
    const faces = [
        { dir: [ 0,  0,  1], up: [0, 1, 0], color: [1.0, 0.3, 0.3] }, // front 
        { dir: [ 0,  0, -1], up: [0, 1, 0], color: [0.3, 1.0, 0.3] }, // back 
        { dir: [ 1,  0,  0], up: [0, 1, 0], color: [0.3, 0.3, 1.0] }, // right 
        { dir: [-1,  0,  0], up: [0, 1, 0], color: [1.0, 1.0, 0.3] }, // left 
        { dir: [ 0,  1,  0], up: [0, 0, -1], color: [1.0, 0.3, 1.0] }, // top 
        { dir: [ 0, -1,  0], up: [0, 0, 1], color: [0.3, 1.0, 1.0] }, // bottom
    ];
    
    for (const face of faces) {
        const baseIndex = positions.length / 3;
        const n = face.dir;
        const u = face.up;
        
        // right vector = up × normal
        const r = [
            u[1] * n[2] - u[2] * n[1],
            u[2] * n[0] - u[0] * n[2],
            u[0] * n[1] - u[1] * n[0]
        ];
        
        // Generate vertices for this face
        for (let i = 0; i <= tess; i++) {
            for (let j = 0; j <= tess; j++) {
                //normalized values
                const s = (i / tess) * 2 - 1;
                const t = (j / tess) * 2 - 1;
                //P(s,t) = n + r*s + u*t where s,t ∈ [-1, 1] --> this is parametric construction of a plane!
                positions.push(
                    n[0] + r[0] * s + u[0] * t, //x
                    n[1] + r[1] * s + u[1] * t, //y
                    n[2] + r[2] * s + u[2] * t //z
                );
                colors.push(face.color[0], face.color[1], face.color[2]);
            }
        }
        
        // Generate indices for this face --> create two triangles per 
        for (let i = 0; i < tess; i++) {
            for (let j = 0; j < tess; j++) {
                const i0 = baseIndex + i * (tess + 1) + j;
                const i1 = i0 + 1;
                const i2 = i0 + (tess + 1);
                const i3 = i2 + 1;
                
                indices.push(i0, i2, i1);
                indices.push(i1, i2, i3);
            }
        }
    }
    
    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices)
    };
}


function generateCubeExplicit(tess) {
    const positions = [];
    const colors = [];
    const indices = [];
    
    const faces = [
        {   // Front face 
            corners: [
                [-1, -1,  1],  
                [ 1, -1,  1],  
                [ 1,  1,  1],  
                [-1,  1,  1],  
            ],
            color: [1.0, 0.3, 0.3]
        },
        {   // Back face 
            corners: [
                [ 1, -1, -1],
                [-1, -1, -1],
                [-1,  1, -1],
                [ 1,  1, -1],
            ],
            color: [0.3, 1.0, 0.3]
        },
        {   // Right face 
            corners: [
                [ 1, -1,  1],
                [ 1, -1, -1],
                [ 1,  1, -1],
                [ 1,  1,  1],
            ],
            color: [0.3, 0.3, 1.0]
        },
        {   // Left face 
            corners: [
                [-1, -1, -1],
                [-1, -1,  1],
                [-1,  1,  1],
                [-1,  1, -1],
            ],
            color: [1.0, 1.0, 0.3]
        },
        {   // Top face 
            corners: [
                [-1,  1,  1],
                [ 1,  1,  1],
                [ 1,  1, -1],
                [-1,  1, -1],
            ],
            color: [1.0, 0.3, 1.0]
        },
        {   // Bottom face 
            corners: [
                [-1, -1, -1],
                [ 1, -1, -1],
                [ 1, -1,  1],
                [-1, -1,  1],
            ],
            color: [0.3, 1.0, 1.0]
        },
    ];
    
    for (const face of faces) {
        const baseIndex = positions.length / 3;
        const c = face.corners;
        
        for (let i = 0; i <= tess; i++) {
            const t = i / tess;  
            for (let j = 0; j <= tess; j++) {
                const s = j / tess; 
                
                //bilinear interpolation!
                const x = (1-s)*(1-t)*c[0][0] + s*(1-t)*c[1][0] + s*t*c[2][0] + (1-s)*t*c[3][0];
                const y = (1-s)*(1-t)*c[0][1] + s*(1-t)*c[1][1] + s*t*c[2][1] + (1-s)*t*c[3][1];
                const z = (1-s)*(1-t)*c[0][2] + s*(1-t)*c[1][2] + s*t*c[2][2] + (1-s)*t*c[3][2];
                
                positions.push(x, y, z);
                colors.push(face.color[0], face.color[1], face.color[2]);
            }
        }
        
        for (let i = 0; i < tess; i++) {
            for (let j = 0; j < tess; j++) {
                const i0 = baseIndex + i * (tess + 1) + j;
                const i1 = i0 + 1;
                const i2 = i0 + (tess + 1);
                const i3 = i2 + 1;
                indices.push(i0, i2, i1);
                indices.push(i1, i2, i3);
            }
        }
    }
    
    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices)
    };
}


function generateCubeHardCoded(tess) {
    const positions = [];
    const colors = [];
    const indices = [];
    let baseIndex = 0;

    for (let i = 0; i <= tess; i++) {
        for (let j = 0; j <= tess; j++) {
            const s = (i / tess) * 2 - 1;
            const t = (j / tess) * 2 - 1;
            positions.push(s, t, 1);
            colors.push(1.0, 0.3, 0.3);
        }
    }
    for (let i = 0; i < tess; i++) {
        for (let j = 0; j < tess; j++) {
            const i0 = baseIndex + i * (tess + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (tess + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    baseIndex = positions.length / 3;

    for (let i = 0; i <= tess; i++) {
        for (let j = 0; j <= tess; j++) {
            const s = (i / tess) * 2 - 1;
            const t = (j / tess) * 2 - 1;
            positions.push(-s, t, -1);
            colors.push(0.3, 1.0, 0.3);
        }
    }
    for (let i = 0; i < tess; i++) {
        for (let j = 0; j < tess; j++) {
            const i0 = baseIndex + i * (tess + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (tess + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    baseIndex = positions.length / 3;

    for (let i = 0; i <= tess; i++) {
        for (let j = 0; j <= tess; j++) {
            const s = (i / tess) * 2 - 1;
            const t = (j / tess) * 2 - 1;
            positions.push(1, t, -s);
            colors.push(0.3, 0.3, 1.0);
        }
    }
    for (let i = 0; i < tess; i++) {
        for (let j = 0; j < tess; j++) {
            const i0 = baseIndex + i * (tess + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (tess + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    baseIndex = positions.length / 3;

    for (let i = 0; i <= tess; i++) {
        for (let j = 0; j <= tess; j++) {
            const s = (i / tess) * 2 - 1;
            const t = (j / tess) * 2 - 1;
            positions.push(-1, t, s);
            colors.push(1.0, 1.0, 0.3);
        }
    }
    for (let i = 0; i < tess; i++) {
        for (let j = 0; j < tess; j++) {
            const i0 = baseIndex + i * (tess + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (tess + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    baseIndex = positions.length / 3;

    for (let i = 0; i <= tess; i++) {
        for (let j = 0; j <= tess; j++) {
            const s = (i / tess) * 2 - 1;
            const t = (j / tess) * 2 - 1;
            positions.push(s, 1, -t);
            colors.push(1.0, 0.3, 1.0);
        }
    }
    for (let i = 0; i < tess; i++) {
        for (let j = 0; j < tess; j++) {
            const i0 = baseIndex + i * (tess + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (tess + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }
    baseIndex = positions.length / 3;

    for (let i = 0; i <= tess; i++) {
        for (let j = 0; j <= tess; j++) {
            const s = (i / tess) * 2 - 1;
            const t = (j / tess) * 2 - 1;
            positions.push(s, -1, t);
            colors.push(0.3, 1.0, 1.0);
        }
    }
    for (let i = 0; i < tess; i++) {
        for (let j = 0; j < tess; j++) {
            const i0 = baseIndex + i * (tess + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + (tess + 1);
            const i3 = i2 + 1;
            indices.push(i0, i2, i1, i1, i2, i3);
        }
    }

    return {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        indices: new Uint16Array(indices)
    };
}