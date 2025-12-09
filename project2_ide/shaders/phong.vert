attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_proj;

varying vec3 v_viewPos;
varying vec3 v_viewNormal;
varying vec2 v_uv;

void main() {
    vec4 viewPos = u_view * u_model * vec4(a_position, 1.0);
    v_viewPos = viewPos.xyz;
    mat3 normalMat = mat3(u_view * u_model);
    v_viewNormal = normalize(normalMat * a_normal);
    v_uv = a_uv;
    gl_Position = u_proj * viewPos;
}

