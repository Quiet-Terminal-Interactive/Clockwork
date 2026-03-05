#version 330 core
layout(location = 0) out vec4 outAlbedo;
layout(location = 1) out vec4 outNormal;
layout(location = 2) out vec4 outEmissive;

in vec2 vUv;
in vec4 vColor;

uniform sampler2D uAtlas;

void main() {
    vec4 texel = texture(uAtlas, vUv);
    vec4 base = texel * vColor;

    outAlbedo = base;
    outNormal = vec4(0.5, 0.5, 1.0, 1.0);
    outEmissive = vec4(base.rgb * 0.04, base.a);
}
