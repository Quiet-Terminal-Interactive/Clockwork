#version 330 core
layout(location = 0) in vec2 aUnitPos;
layout(location = 1) in vec2 iPosition;
layout(location = 2) in vec2 iSize;
layout(location = 3) in vec2 iOrigin;
layout(location = 4) in float iLayer;
layout(location = 5) in vec4 iColor;
layout(location = 6) in vec2 iFlip;

uniform vec2 uViewport;
uniform vec3 uCamera;

out vec2 vUv;
out vec4 vColor;

void main() {
    vec2 centered = (aUnitPos - iOrigin) * iSize;
    vec2 world = iPosition + centered;
    vec2 cameraAdjusted = (world - uCamera.xy) * uCamera.z;
    vec2 ndc = vec2(
        (cameraAdjusted.x / max(uViewport.x, 1.0)) * 2.0,
        (cameraAdjusted.y / max(uViewport.y, 1.0)) * 2.0
    );

    vec2 uv = aUnitPos;
    if (iFlip.x > 0.5) {
        uv.x = 1.0 - uv.x;
    }
    if (iFlip.y > 0.5) {
        uv.y = 1.0 - uv.y;
    }

    gl_Position = vec4(ndc, iLayer * 0.0001, 1.0);
    vUv = uv;
    vColor = iColor;
}
