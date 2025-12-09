#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_colorTex;
uniform sampler2D u_gbufferTex;
uniform vec2 u_texel;

out vec4 fragColor;

// Sobel kernels
const float kx[9] = float[9](
    -1.0, 0.0, 1.0,
    -2.0, 0.0, 2.0,
    -1.0, 0.0, 1.0
);
const float ky[9] = float[9](
    -1.0, -2.0, -1.0,
     0.0,  0.0,  0.0,
     1.0,  2.0,  1.0
);

void main() {
    vec3 gN = vec3(0.0);
    float gD = 0.0;
    int idx = 0;
    for (int j = -1; j <= 1; ++j) {
        for (int i = -1; i <= 1; ++i) {
            vec2 uv = v_uv + vec2(float(i) * u_texel.x, float(j) * u_texel.y);
            vec4 g = texture(u_gbufferTex, uv);
            vec3 n = normalize(g.rgb * 2.0 - 1.0);
            float d = g.a;
            float wx = kx[idx];
            float wy = ky[idx];
            gN += n * wx + n * wy;
            gD += d * wx + d * wy;
            idx++;
        }
    }

    float edgeN = length(gN);
    float edgeD = abs(gD);
    float edge = edgeN * 0.6 + edgeD * 0.4;
    edge = smoothstep(0.2, 0.6, edge);

    vec3 color = texture(u_colorTex, v_uv).rgb;
    vec3 finalColor = mix(vec3(0.0), color, 1.0 - edge);
    fragColor = vec4(finalColor, 1.0);
}

