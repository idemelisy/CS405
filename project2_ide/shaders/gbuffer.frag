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
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform int u_mode;        // 0=phong, 1=toon, 2=edge, 3=hatch
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
    float tone = 1.0 - ndotl;
    vec2 uv = v_uv * u_hatchScale;
    float t0 = texture(u_hatch0, uv).r;
    float t1 = texture(u_hatch1, uv).r;
    float t2 = texture(u_hatch2, uv).r;
    float t3 = texture(u_hatch3, uv).r;
    float h = 1.0;
    if (tone > 0.2) h = min(h, t0);
    if (tone > 0.4) h = min(h, t1);
    if (tone > 0.6) h = min(h, t2);
    if (tone > 0.8) h = min(h, t3);
    return base * h;
}

void main() {
    vec3 N = normalize(v_viewNormal);
    vec3 V = normalize(-v_viewPos);
    vec3 L = normalize(-u_lightDir);
    vec3 baseColor = texture(u_diffuse, v_uv).rgb;

    float ndotl = max(dot(N, L), 0.0);
    vec3 diffuse = baseColor * ndotl;
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0);
    vec3 phong = baseColor * (0.1 + diffuse) + u_lightColor * spec * 0.6;

    vec3 shaded = phong;
    if (u_mode == 1) {
        float bands = max(u_bands, 1.0);
        float q = floor(ndotl * bands) / bands;
        float specStep = step(0.5, spec);
        shaded = baseColor * q + u_lightColor * specStep * 0.25;
    } else if (u_mode == 2) {
        float edge = smoothstep(0.0, u_rim, abs(dot(N, V)));
        shaded = mix(vec3(0.0), phong, edge);
    } else if (u_mode == 3) {
        shaded = applyHatching(baseColor, ndotl);
    }

    float depth = length(v_viewPos);
    outColor = vec4(shaded, 1.0);          // color attachment 0
    outGbuf = packGBuffer(N, depth);       // color attachment 1 (normal+depth)
}

