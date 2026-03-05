#version 330 core
out vec4 fragColor;
in vec2 vUv;

uniform sampler2D uNormal;
uniform sampler2D uShadowAtlas;
uniform vec2 uViewport;
uniform vec3 uCamera;
uniform vec2 uLightPosition;
uniform float uLightRadius;
uniform float uLightIntensity;
uniform vec4 uShadowUv;

void main() {
    vec2 world = ((vUv * uViewport) / max(uCamera.z, 0.0001)) + uCamera.xy;
    vec2 toLight = uLightPosition - world;
    float distanceToLight = length(toLight);
    float attenuation = 1.0 - clamp(distanceToLight / max(uLightRadius, 0.0001), 0.0, 1.0);

    vec3 normal = texture(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 lightDir = normalize(vec3(toLight, 10.0));
    float diffuse = max(dot(normalize(normal), lightDir), 0.0);

    float shadow = 1.0;
    if (uShadowUv.z > 0.0 && uShadowUv.w > 0.0) {
        vec2 atlasUv = uShadowUv.xy + (vUv * uShadowUv.zw);
        float shadowDepth = texture(uShadowAtlas, atlasUv).r;
        shadow = smoothstep(0.15, 0.95, shadowDepth + 0.2);
    }

    vec3 lit = vec3(diffuse * attenuation * uLightIntensity * shadow);
    fragColor = vec4(lit, 1.0);
}
