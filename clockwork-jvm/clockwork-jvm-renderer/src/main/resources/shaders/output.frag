#version 330 core
out vec4 fragColor;
in vec2 vUv;

uniform sampler2D uScene;

void main() {
    vec3 scene = texture(uScene, vUv).rgb;
    vec3 gamma = pow(scene, vec3(1.0 / 2.2));
    fragColor = vec4(gamma, 1.0);
}
