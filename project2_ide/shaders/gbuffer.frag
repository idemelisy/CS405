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
    vec3 baseColor = (saturated - 0.5) * contrastBoost + 0.5;
    baseColor = clamp(baseColor, 0.0, 1.0);
    
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
        // Hatching (tone-mapped cross-hatch)
        // ✅ FIX: Use diffuse_intensity (clean ndotl) for hatching
        shaded = applyHatching(baseColor, diffuse_intensity);
    }

    float depth = length(v_viewPos);
    outColor = vec4(shaded, 1.0);          // color attachment 0
    outGbuf = packGBuffer(N, depth);       // color attachment 1 (normal+depth)
}

