#version 300 es
precision highp float;

in vec3 v_viewPos;
in vec3 v_viewNormal;
in vec2 v_uv;

uniform sampler2D u_diffuse;
uniform sampler2D u_specularMap;  // Specular/roughness map
uniform sampler2D u_normalMap;    // Normal map (object space)
uniform sampler2D u_hatch0;
uniform sampler2D u_hatch1;
uniform sampler2D u_hatch2;
uniform sampler2D u_hatch3;
uniform vec3 u_lightDir;    // Light direction in VIEW space (transformed from world space)
uniform vec3 u_lightColor;
uniform int u_mode;         // 0=phong, 1=toon, 2=edge, 3=hatch
uniform float u_bands;
uniform float u_rim;
uniform float u_hatchScale;
uniform int u_useTexture;   // 0=solid color, 1=use texture

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGbuf;

// ============================================================================
// SIMPLEX NOISE - Van Gogh Style Wavy Strokes
// Artistic Inspiration: Vincent van Gogh's "The Starry Night"
// Van Gogh's impasto technique simulated via noise-based wavy hatching strokes
// ============================================================================

// Permutation polynomial for 2D simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

// Simplex 2D noise - creates organic, flowing patterns
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,   // (3.0-sqrt(3.0))/6.0
                        0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
                        -0.577350269189626,  // -1.0 + 2.0 * C.x
                        0.024390243902439);  // 1.0 / 41.0
    
    // First corner
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    
    // Other corners
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    
    // Permutations
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    
    // Gradients
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    
    // Compute final noise value
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// Fractal Brownian Motion - layered noise for rich texture
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < octaves; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Pack normal.xyz and linear depth in A
vec4 packGBuffer(vec3 N, float depth) {
    return vec4(normalize(N) * 0.5 + 0.5, depth);
}

// ============================================================================
// OIL-PAINTING INSPIRED HATCHING
// Van Gogh'un impasto tekniği, hatching stroke'larını noise ile dalgalı hale 
// getirerek simüle edildi.
// ============================================================================
vec3 applyOilPaintingHatching(vec3 base, float ndotl, vec3 normal, vec3 lightDir) {
    float tone = 1.0 - clamp(ndotl, 0.0, 1.0);  // 0=light, 1=dark
    vec2 uv = v_uv * u_hatchScale;
    
    // Classic cross-hatching - clean parallel lines at different angles
    float lineWidth = 0.5;  // Thinner lines for cleaner look
    
    // Layer 1: Horizontal lines (0°)
    float hatch1 = step(lineWidth, fract(uv.y * 15.0));
    
    // Layer 2: Vertical lines (90°)
    float hatch2 = step(lineWidth, fract(uv.x * 15.0));
    
    // Layer 3: Diagonal lines (45°)
    vec2 diag1UV = mat2(0.707, -0.707, 0.707, 0.707) * uv;
    float hatch3 = step(lineWidth, fract(diag1UV.y * 15.0));
    
    // Layer 4: Counter-diagonal lines (-45°)
    vec2 diag2UV = mat2(0.707, 0.707, -0.707, 0.707) * uv;
    float hatch4 = step(lineWidth, fract(diag2UV.y * 15.0));
    
    // Layer 5: Denser horizontal for darkest areas
    float hatch5 = step(lineWidth * 0.7, fract(uv.y * 22.0));
    
    // Layer 6: Denser diagonal for maximum darkness
    float hatch6 = step(lineWidth * 0.7, fract(diag1UV.y * 22.0));
    
    // Progressive cross-hatching based on tone
    float hatch = 1.0;
    
    // Very light: no hatching
    if (tone > 0.12) {
        hatch = hatch1;  // Single direction
    }
    
    // Light-mid: add perpendicular lines (cross-hatch starts)
    if (tone > 0.3) {
        hatch = min(hatch, hatch2);
    }
    
    // Mid-tone: add diagonal
    if (tone > 0.45) {
        hatch = min(hatch, hatch3);
    }
    
    // Mid-dark: complete cross-hatch with counter-diagonal
    if (tone > 0.6) {
        hatch = min(hatch, hatch4);
    }
    
    // Dark: add denser layers
    if (tone > 0.75) {
        hatch = min(hatch, hatch5);
    }
    
    // Very dark: maximum density
    if (tone > 0.88) {
        hatch = min(hatch, hatch6);
    }
    
    // Color mixing
    vec3 litColor = base * (0.3 + ndotl * 0.7);
    vec3 strokeColor = base * 0.15;  // Dark ink color
    
    vec3 hatchedColor = mix(strokeColor, litColor, hatch);
    
    return clamp(hatchedColor, 0.0, 1.0);
}

// Legacy hatching function (kept for reference)
vec3 applyHatching(vec3 base, float ndotl) {
    float tone = 1.0 - ndotl;  // 0=light, 1=dark
    vec2 uv = v_uv * u_hatchScale;
    
    // Sample all hatch layers (values 0-1, where 0=line, 1=white)
    float t0 = texture(u_hatch0, uv).r;
    float t1 = texture(u_hatch1, uv).r;
    float t2 = texture(u_hatch2, uv).r;
    float t3 = texture(u_hatch3, uv).r;
    
    // Accumulate hatching layers based on tone (darker = more layers)
    float hatch = 1.0;
    if (tone > 0.1) hatch = min(hatch, t0);  // First layer
    if (tone > 0.3) hatch = min(hatch, t1);  // Add diagonal
    if (tone > 0.5) hatch = min(hatch, t2);  // Add cross-hatch
    if (tone > 0.7) hatch = min(hatch, t3);  // Dense cross-hatch
    
    // Convert hatch value (0-1) to visible grayscale
    // 0 = black line, 1 = white/light
    vec3 hatchColor = vec3(hatch);
    
    // Mix base color with hatch pattern
    return mix(hatchColor * 0.3, base, 0.3);  // Strong hatch effect
}

void main() {
    vec3 N_raw = normalize(v_viewNormal);
    vec3 V = normalize(-v_viewPos);
    
    // ✅ FIX: u_lightDir is already in VIEW space (transformed from world space in main.js)
    vec3 L = normalize(u_lightDir);
    
    // Normal direction (can flip if model has inverted normals)
    vec3 N = N_raw;  // Use N_raw directly (face normals now computed correctly)
    
    // Get base color: either from texture or solid color
    vec3 baseColor;
    if (u_useTexture == 1) {
        // Get texture color and boost vibrancy
        vec3 texColor = texture(u_diffuse, v_uv).rgb;
        
        // Black lift: prevent pure black, make it soft dark gray/brown
        float blackLift = 0.12;  // Minimum brightness (0.12 ≈ RGB 30)
        vec3 liftedColor = mix(vec3(blackLift, blackLift * 0.95, blackLift * 0.9), vec3(1.0), texColor);
        // This maps black (0,0,0) to warm dark gray, white stays white
        
        // Increase saturation: convert to grayscale, then push away from it
        float gray = dot(liftedColor, vec3(0.299, 0.587, 0.114));
        float saturationBoost = 1.3;  // Slightly reduced for softer look
        vec3 saturated = mix(vec3(gray), liftedColor, saturationBoost);
        
        // Softer contrast
        float contrastBoost = 1.1;  // Reduced for softer shadows
        baseColor = (saturated - 0.5) * contrastBoost + 0.5;
        baseColor = clamp(baseColor, 0.0, 1.0);
    } else {
        // Solid color for better NPR visibility
        baseColor = vec3(0.85, 0.3, 0.25);  // Nice red/orange color for apple
    }
    
    // Lighting calculations
    float ambient = 0.25;  // Balanced ambient for visibility
    float ndotl = max(dot(N, L), 0.0);
    
    // ========== DEBUG: Visualization Modes ==========
    // UNCOMMENT ONE LINE to debug:
    // outColor = vec4(N * 0.5 + 0.5, 1.0); outGbuf = vec4(0.5); return; // Normals as RGB
    // outColor = vec4(vec3(ndotl), 1.0); outGbuf = vec4(0.5); return;   // N·L grayscale
    // outColor = vec4(vec3(facing), 1.0); outGbuf = vec4(0.5); return;  // Facing camera
    // ============================================================
    
    // Back-face detection: if surface faces away from camera, darken more
    float facing = max(dot(N, V), 0.0);
    
    // Diffuse intensity with boost
    float lightStrength = 1.5;  // Light intensity multiplier (increase for brighter light)
    float diffuse_intensity = ndotl * lightStrength;
    
    // Read specular map (controls shininess per-pixel)
    float specMapValue = texture(u_specularMap, v_uv).r;  // Grayscale specular map
    
    // Specular (Blinn-Phong) - controlled by specular map
    vec3 H = normalize(L + V);
    float shininess = 16.0;  // Lower = softer highlights (was 32)
    float specBase = pow(max(dot(N, H), 0.0), shininess);
    float specIntensity = 0.3;  // Overall specular strength (reduced from 0.8)
    float spec_intensity = specBase * specMapValue * specIntensity;
    
    // Clean Phong calculation (ambient + diffuse + specular)
    float effectiveAmbient = ambient * (0.5 + 0.5 * facing);
    vec3 phong = baseColor * (effectiveAmbient + diffuse_intensity) + u_lightColor * spec_intensity;

    vec3 shaded = phong;
    
    if (u_mode == 1) {
        // Toon Shading (Quantized diffuse and specular)
        float bands = max(u_bands, 1.0);
        float q = floor(diffuse_intensity * bands) / bands;
        float specStep = step(0.5, spec_intensity);
        
        // ✅ FIX: Consistent ambient + quantized diffuse + quantized specular
        shaded = baseColor * (effectiveAmbient + q) + u_lightColor * specStep * 0.25;
        
    } else if (u_mode == 2) {
        // Edge/Silhouette (N·V based rim) - stronger effect
        float ndotv = abs(dot(N, V));
        float rimThreshold = u_rim * 0.8;  // Wider rim detection
        float edge = smoothstep(0.0, rimThreshold, ndotv);
        edge = edge * edge;  // Sharper falloff for more visible edges
        
        // Black edges
        shaded = mix(vec3(0.0), phong, edge);
        
    } else if (u_mode == 3) {
        // Oil-Painting Inspired Hatching (Van Gogh style)
        // Artistic inspiration: Vincent van Gogh's "The Starry Night"
        // Van Gogh's impasto technique simulated via noise-based wavy strokes
        shaded = applyOilPaintingHatching(baseColor, diffuse_intensity, N, L);
    }

    float depth = length(v_viewPos);
    outColor = vec4(shaded, 1.0);          // color attachment 0
    outGbuf = packGBuffer(N, depth);       // color attachment 1 (normal+depth)
}

