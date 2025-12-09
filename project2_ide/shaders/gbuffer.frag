#version 300 es
precision highp float;

in vec3 v_viewPos;
in vec3 v_viewNormal;
in vec2 v_uv;

uniform sampler2D u_diffuse;
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

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGbuf;

// Pack normal.xyz and linear depth in A
vec4 packGBuffer(vec3 N, float depth) {
    return vec4(normalize(N) * 0.5 + 0.5, depth);
}

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
    
    vec3 baseColor = texture(u_diffuse, v_uv).rgb;
    
    // Lighting calculations
    float ambient = 0.08;  // Slightly increased for visibility
    float ndotl = max(dot(N, L), 0.0);
    
    // ========== DEBUG: Visualization Modes ==========
    // UNCOMMENT ONE LINE to debug:
    // outColor = vec4(N * 0.5 + 0.5, 1.0); outGbuf = vec4(0.5); return; // Normals as RGB
    // outColor = vec4(vec3(ndotl), 1.0); outGbuf = vec4(0.5); return;   // N·L grayscale
    // outColor = vec4(vec3(facing), 1.0); outGbuf = vec4(0.5); return;  // Facing camera
    // ============================================================
    
    // Back-face detection: if surface faces away from camera, darken more
    float facing = max(dot(N, V), 0.0);
    
    // ✅ FIX: Diffuse is intensity only, multiply by baseColor later
    float diffuse_intensity = ndotl;
    
    // Specular (Blinn-Phong)
    vec3 H = normalize(L + V);
    float spec_intensity = pow(max(dot(N, H), 0.0), 32.0);
    
    // ✅ FIX: Clean Phong calculation (ambient + diffuse + specular)
    // Add subtle ambient occlusion based on surface facing
    float effectiveAmbient = ambient * (0.5 + 0.5 * facing);
    vec3 phong = baseColor * (effectiveAmbient + diffuse_intensity) + u_lightColor * spec_intensity * 0.6;

    vec3 shaded = phong;
    
    if (u_mode == 1) {
        // Toon Shading (Quantized diffuse and specular)
        float bands = max(u_bands, 1.0);
        float q = floor(diffuse_intensity * bands) / bands;
        float specStep = step(0.5, spec_intensity);
        
        // ✅ FIX: Consistent ambient + quantized diffuse + quantized specular
        shaded = baseColor * (effectiveAmbient + q) + u_lightColor * specStep * 0.25;
        
    } else if (u_mode == 2) {
        // Edge/Silhouette (N·V based rim)
        float edge = smoothstep(0.0, u_rim, abs(dot(N, V)));
        
        // ✅ FIX: Use clean phong for non-edge regions
        shaded = mix(vec3(0.0), phong, edge);
        
    } else if (u_mode == 3) {
        // Hatching (tone-mapped cross-hatch)
        // ✅ FIX: Use diffuse_intensity (clean ndotl) for hatching
        shaded = applyHatching(baseColor, diffuse_intensity);
    }

    float depth = length(v_viewPos);
    outColor = vec4(shaded, 1.0);          // color attachment 0
    outGbuf = packGBuffer(N, depth);       // color attachment 1 (normal+depth)
}

