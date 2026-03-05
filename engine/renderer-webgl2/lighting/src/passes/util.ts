/** Compile a vertex + fragment shader pair into a linked WebGLProgram. */
export function compileProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)

  const prog = gl.createProgram()
  if (!prog) {
    throw new Error('LightingPlugin: failed to create shader program')
  }
  gl.attachShader(prog, vert)
  gl.attachShader(prog, frag)
  gl.linkProgram(prog)

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`LightingPlugin: program link failed: ${gl.getProgramInfoLog(prog)}`)
  }

  // Shaders are baked into the program; detach immediately to free driver memory.
  gl.detachShader(prog, vert)
  gl.detachShader(prog, frag)
  gl.deleteShader(vert)
  gl.deleteShader(frag)

  return prog
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('LightingPlugin: failed to create shader')
  }
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`LightingPlugin: shader compile failed: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

/** Create a VAO with a full-screen triangle pair. Vertex attribute 0 = vec2 position. */
export function makeQuadVAO(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): WebGLVertexArrayObject {
  // Two triangles covering NDC [-1,1] × [-1,1].
  const verts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1])

  const vbo = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)

  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  const loc = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  return vao
}

/** Shared vertex shader source for all full-screen quad passes. */
export const VERT_QUAD_SRC = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

/** Create a framebuffer with a single RGBA16F colour attachment. */
export function makeHdrFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): { tex: WebGLTexture; fb: WebGLFramebuffer } {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const fb = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { tex, fb }
}
