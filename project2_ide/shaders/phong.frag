precision mediump float;

varying vec3 v_viewPos;
varying vec3 v_viewNormal;
varying vec2 v_uv;

uniform sampler2D u_diffuse;
uniform vec3 u_lightDir;   // in view space, points FROM light TO origin
uniform vec3 u_lightColor;
uniform int u_mode;        // 0=phong, 1=toon, 2=edge, 3=hatch
uniform float u_bands;     // toon bands
uniform float u_rim;       // edge/rim width
uniform float u_hatchScale;

// Simple hash noise for hatching variation
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 applyHatching(vec3 base, float ndotl) {
    float tone = 1.0 - ndotl; // darker = more tone
    float s = u_hatchScale;
    vec2 coord = gl_FragCoord.xy / s;
    float layer1 = step(0.2, tone) * step(0.0, sin(coord.x + coord.y));
    float layer2 = step(0.4, tone) * step(0.0, sin(coord.x * 1.3 - coord.y * 0.7));
    float layer3 = step(0.6, tone) * step(0.0, sin(coord.x * 0.6 + coord.y * 1.6));
    float layer4 = step(0.8, tone) * step(0.0, sin(coord.x * 2.2 - coord.y * 1.9));
    float hatch = (layer1 + layer2 + layer3 + layer4) * 0.25;
    float noise = hash21(coord * 0.37) * 0.1;
    float darken = clamp(tone * 0.8 + hatch * 0.6 + noise, 0.0, 1.0);
    return base * (1.0 - darken);
}

void main() {
    vec3 N = normalize(v_viewNormal);
    vec3 V = normalize(-v_viewPos);
    vec3 L = normalize(-u_lightDir); // light direction toward fragment
    vec3 baseColor = texture2D(u_diffuse, v_uv).rgb;

    float ndotl = max(dot(N, L), 0.0);
    vec3 diffuse = baseColor * ndotl;
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0);
    vec3 phong = baseColor * (0.1 + diffuse) + u_lightColor * spec * 0.6;

    if (u_mode == 1) {
        // Toon
        float bands = max(u_bands, 1.0);
        float q = floor(ndotl * bands) / bands;
        float specStep = step(0.5, spec);
        vec3 toon = baseColor * q + u_lightColor * specStep * 0.25;
        gl_FragColor = vec4(toon, 1.0);
        return;
    }

    if (u_mode == 2) {
        // Edge/silhouette via N.V
        float edge = smoothstep(0.0, u_rim, abs(dot(N, V)));
        vec3 edgeColor = mix(vec3(0.0), phong, edge);
        gl_FragColor = vec4(edgeColor, 1.0);
        return;
    }

    if (u_mode == 3) {
        vec3 hatch = applyHatching(baseColor, ndotl);
        gl_FragColor = vec4(hatch, 1.0);
        return;
    }

    // Default Phong
    gl_FragColor = vec4(phong, 1.0);
}

