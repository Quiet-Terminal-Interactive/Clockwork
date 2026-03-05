#version 330 core
out vec4 fragColor;
in vec2 vUv;

uniform sampler2D uInput;

void main() {
    vec3 center = texture(uInput, vUv).rgb;
    vec3 north = texture(uInput, vUv + vec2(0.0, 0.0015)).rgb;
    vec3 south = texture(uInput, vUv - vec2(0.0, 0.0015)).rgb;
    vec3 east = texture(uInput, vUv + vec2(0.0015, 0.0)).rgb;
    vec3 west = texture(uInput, vUv - vec2(0.0015, 0.0)).rgb;

    vec3 bloom = (center * 0.4) + ((north + south + east + west) * 0.15);
    fragColor = vec4(bloom, 1.0);
}
