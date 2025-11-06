// Matrix and vector utility functions wrapped in Mat4 and Vec3 objects

const Mat4 = {
    multiply: function(a, b) {
        const out = new Float32Array(16); 
        for (let column = 0; column < 4; column++) {
            for (let row = 0; row < 4; row++) {
                out[column*4 + row] = 
                    a[0*4 + row] * b[column*4 + 0] +  
                    a[1*4 + row] * b[column*4 + 1] +  
                    a[2*4 + row] * b[column*4 + 2] +  
                    a[3*4 + row] * b[column*4 + 3];   
            }
        }
        return out;
    },
    
    identity: function() {
        return new Float32Array([
            1,0,0,0,
            0,1,0,0,
            0,0,1,0,
            0,0,0,1
        ]);
    },
    
    translate: function(tx, ty, tz) {
        const translated_matrix = Mat4.identity();    
        translated_matrix[12] = tx; 
        translated_matrix[13] = ty; 
        translated_matrix[14] = tz;
        return translated_matrix;
    },
    
    scale: function(sx, sy, sz) {
        const scaled_matrix = Mat4.identity();    
        scaled_matrix[0] = sx; 
        scaled_matrix[5] = sy; 
        scaled_matrix[10] = sz;
        return scaled_matrix;
    },
    
    rotateX: function(angle) {
        const rad = angle * Math.PI/180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    },
    
    rotateY: function(angle) {
        const rad = angle * Math.PI/180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    },
    
    rotateZ: function(angle) {
        const rad = angle * Math.PI/180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return new Float32Array([
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },
    
    perspective: function(fov, aspect, near, far) {   
        const f = 1/Math.tan((fov*Math.PI/180)/2);
        const denominator_near_far = 1/(near - far);
        const sum_near_far = far + near;
        const two_times_near_far = 2*far*near;
        return new Float32Array([
            f/aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, sum_near_far*denominator_near_far, -1,
            0, 0, two_times_near_far*denominator_near_far, 0   
        ]);
    },
    
    ortho: function(left, right, bottom, top, near, far) {
        return new Float32Array([
            2/(right-left), 0, 0, 0,
            0, 2/(top-bottom), 0, 0,
            0, 0, -2/(far-near), 0,
            -(right+left)/(right-left), -(top+bottom)/(top-bottom), -(far+near)/(far-near), 1   
        ]);
    }
};

const Vec3 = {
    normalize: function(vector) {
        const length = Math.hypot(vector[0], vector[1], vector[2]);
        return length > 0 ? [vector[0]/length, vector[1]/length, vector[2]/length] : [0, 0, 0];
    },
    
    subtract: function(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    },
    
    cross: function(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    },
    
    dot: function(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }
};

// Expose to global scope
if (typeof window !== "undefined") {
    window.Mat4 = Mat4;
    window.Vec3 = Vec3;
}
