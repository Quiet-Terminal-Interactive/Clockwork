#version 330 core
out vec4 fragColor;
in vec2 vUv;

uniform sampler2D uAlbedo;
uniform sampler2D uLight;
uniform sampler2D uEmissive;

void main() {
    vec4 albedo = texture(uAlbedo, vUv);
    vec3 light = texture(uLight, vUv).rgb;
    vec3 emissive = texture(uEmissive, vUv).rgb;

    vec3 color = (albedo.rgb * light) + emissive;
    fragColor = vec4(color, albedo.a);
}
