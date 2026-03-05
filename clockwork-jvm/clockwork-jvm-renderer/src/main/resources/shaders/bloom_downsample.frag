#version 330 core
out vec4 fragColor;
in vec2 vUv;

uniform sampler2D uInput;

void main() {
    vec3 color = texture(uInput, vUv).rgb;
    float brightness = max(color.r, max(color.g, color.b));
    float bloomMask = smoothstep(0.55, 1.0, brightness);
    fragColor = vec4(color * bloomMask, 1.0);
}
