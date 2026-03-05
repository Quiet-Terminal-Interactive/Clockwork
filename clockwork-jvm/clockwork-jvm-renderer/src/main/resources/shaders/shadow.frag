#version 330 core
in vec2 vUv;

uniform vec2 uLightPosition;
uniform float uLightRadius;

void main() {
    vec2 delta = (vUv - 0.5) * 2.0;
    float dist = length(delta);
    float normalized = clamp(dist / max(uLightRadius, 0.0001), 0.0, 1.0);
    gl_FragDepth = normalized;
}
