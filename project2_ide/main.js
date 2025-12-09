(() => {
  const { Mat4, Vec3, OrbitCamera } = window.MathHelpers;
  const vec3 = window.vec3 || (window.glMatrix && window.glMatrix.vec3);
  if (!vec3) {
    throw new Error("glMatrix vec3 not found. Ensure gl-matrix-min.js is loaded before main.js");
  }

  const canvas = document.getElementById("glcanvas");
  /** @type {WebGL2RenderingContext} */
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL2 not supported");
    return;
  }

  // State
  const camera = new OrbitCamera();
  let program = null;
  let gbufferProgram = null;
  let edgeProgram = null;
  let mesh = null;
  let diffuseTex = null;
  let hatchTex = [];
  let uniforms = {};
  let attribs = {};
  let gAttribs = {};
  let edgeAttribs = {};
  let quad = null;
  let fbo = null;
  let fboColor = null;
  let fboGbuffer = null;

  const ui = {
    mode: document.getElementById("mode"),
    bands: document.getElementById("bands"),
    rim: document.getElementById("rim"),
    hatchScale: document.getElementById("hatchScale"),
    lightX: document.getElementById("lightX"),
    lightY: document.getElementById("lightY"),
    lightZ: document.getElementById("lightZ"),
    resetCamera: document.getElementById("resetCamera"),
  };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener("resize", resize);
  resize();

  // Shader loading
  async function loadText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.text();
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      throw new Error("Shader compile failed");
    }
    return shader;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      throw new Error("Program link failed");
    }
    return prog;
  }

  // OBJ loader (positions, normals, uvs, triangles only)
  function parseOBJ(text) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const vertices = [];
    const lines = text.split("\n");
    
    for (const line of lines) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      
      if (l.startsWith("v ")) {
        const parts = l.split(/\s+/);
        positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (l.startsWith("vn ")) {
        const parts = l.split(/\s+/);
        normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (l.startsWith("vt ")) {
        const parts = l.split(/\s+/);
        uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
      } else if (l.startsWith("f ")) {
        const parts = l.split(/\s+/).slice(1);
        // Triangulate polygon (fan from first vertex)
        for (let i = 1; i < parts.length - 1; i++) {
          const tri = [parts[0], parts[i], parts[i + 1]];
          for (const v of tri) {
            const [vi, ti, ni] = v.split("/").map(s => s ? parseInt(s, 10) : 0);
            const p = positions[vi - 1] || [0, 0, 0];
            const uv = (ti && uvs[ti - 1]) || [0, 0];
            const n = (ni && normals[ni - 1]) || [0, 1, 0];
            vertices.push(...p, ...n, uv[0], uv[1]);
          }
        }
      }
    }
    
    console.log("OBJ parsed:", positions.length, "positions,", normals.length, "normals,", vertices.length / 8, "vertices");
    return new Float32Array(vertices);
  }

  function createVAO(data, attribSet) {
    const stride = (3 + 3 + 2) * 4;
    const vao = gl.createVertexArray ? gl.createVertexArray() : null;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const posLoc = attribSet.a_position;
    const normLoc = attribSet.a_normal;
    const uvLoc = attribSet.a_uv;

    if (vao && gl.bindVertexArray) gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, stride, 24);
    if (vao && gl.bindVertexArray) gl.bindVertexArray(null);

    return { vao, buffer, count: data.length / 8 };
  }

  function createFallbackCube(attribSet) {
    const s = 1.5; // Make cube bigger
    const data = new Float32Array([
      // positions       normals          uvs
      -s, -s, -s, 0, 0, -1, 0, 0,
       s, -s, -s, 0, 0, -1, 1, 0,
       s,  s, -s, 0, 0, -1, 1, 1,
      -s, -s, -s, 0, 0, -1, 0, 0,
       s,  s, -s, 0, 0, -1, 1, 1,
      -s,  s, -s, 0, 0, -1, 0, 1,
      // +Z
      -s, -s, s, 0, 0, 1, 0, 0,
       s, -s, s, 0, 0, 1, 1, 0,
       s,  s, s, 0, 0, 1, 1, 1,
      -s, -s, s, 0, 0, 1, 0, 0,
       s,  s, s, 0, 0, 1, 1, 1,
      -s,  s, s, 0, 0, 1, 0, 1,
      // -X
      -s, -s, -s, -1, 0, 0, 0, 0,
      -s,  s, -s, -1, 0, 0, 1, 0,
      -s,  s,  s, -1, 0, 0, 1, 1,
      -s, -s, -s, -1, 0, 0, 0, 0,
      -s,  s,  s, -1, 0, 0, 1, 1,
      -s, -s,  s, -1, 0, 0, 0, 1,
      // +X
       s, -s, -s, 1, 0, 0, 0, 0,
       s,  s, -s, 1, 0, 0, 1, 0,
       s,  s,  s, 1, 0, 0, 1, 1,
       s, -s, -s, 1, 0, 0, 0, 0,
       s,  s,  s, 1, 0, 0, 1, 1,
       s, -s,  s, 1, 0, 0, 0, 1,
      // -Y
      -s, -s, -s, 0, -1, 0, 0, 0,
      -s, -s,  s, 0, -1, 0, 1, 0,
       s, -s,  s, 0, -1, 0, 1, 1,
      -s, -s, -s, 0, -1, 0, 0, 0,
       s, -s,  s, 0, -1, 0, 1, 1,
       s, -s, -s, 0, -1, 0, 0, 1,
      // +Y
      -s, s, -s, 0, 1, 0, 0, 0,
       s, s, -s, 0, 1, 0, 1, 0,
       s, s,  s, 0, 1, 0, 1, 1,
      -s, s, -s, 0, 1, 0, 0, 0,
       s, s,  s, 0, 1, 0, 1, 1,
      -s, s,  s, 0, 1, 0, 0, 1,
    ]);
    return createVAO(data, attribSet);
  }

  function createTexture(url) {
    return new Promise((resolve) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        resolve(tex);
      };
      img.onerror = () => resolve(tex); // fallback white
      img.src = url;
    });
  }

  // Create grayscale hatch textures procedurally (replace with file loads if desired)
  function createHatchTexture(patternFn) {
    const size = 64;
    const data = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = patternFn(x, y, size);
        data[y * size + x] = v;
      }
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, size, size, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  function createHatchSet() {
    hatchTex = [
      createHatchTexture(() => 255),
      createHatchTexture((x, y, s) => ((x + y) % 6 === 0 ? 40 : 220)),
      createHatchTexture((x, y, s) => ((x * 3 + y * 5) % 11 < 3 ? 30 : 200)),
      createHatchTexture((x, y, s) => ((Math.sin((x + y) * 0.3) > 0.2) ? 25 : 180)),
    ];
  }

  function getUniformLocations(prog, names) {
    const res = {};
    for (const n of names) {
      res[n] = gl.getUniformLocation(prog, n);
    }
    return res;
  }

  function getAttribLocations(prog, names) {
    const res = {};
    for (const n of names) {
      res[n] = gl.getAttribLocation(prog, n);
    }
    return res;
  }

  async function init() {
    console.log("Init starting...");
    const [vs, fs, gvs, gfs, evs, efs] = await Promise.all([
      loadText("shaders/phong.vert"),
      loadText("shaders/phong.frag"),
      loadText("shaders/gbuffer.vert"),
      loadText("shaders/gbuffer.frag"),
      loadText("shaders/edge.vert"),
      loadText("shaders/edge.frag"),
    ]);
    console.log("Shaders loaded");
    program = createProgram(vs, fs);
    gbufferProgram = createProgram(gvs, gfs);
    edgeProgram = createProgram(evs, efs);
    console.log("Programs created");

    gl.useProgram(gbufferProgram);
    gAttribs = getAttribLocations(gbufferProgram, ["a_position", "a_normal", "a_uv"]);
    gl.useProgram(program);
    attribs = getAttribLocations(program, ["a_position", "a_normal", "a_uv"]);
    edgeAttribs = getAttribLocations(edgeProgram, ["a_position", "a_uv"]);
    uniforms = getUniformLocations(program, [
      "u_model", "u_view", "u_proj", "u_diffuse",
      "u_lightDir", "u_lightColor", "u_mode",
      "u_bands", "u_rim", "u_hatchScale",
      "u_hatch0", "u_hatch1", "u_hatch2", "u_hatch3",
    ]);
    console.log("Attributes and uniforms located");

    gl.enable(gl.DEPTH_TEST);

    // Load model
    try {
      const objText = await loadText("po/panda.obj");
      console.log("OBJ file loaded, size:", objText.length, "bytes");
      const data = parseOBJ(objText);
      if (data.length === 0) {
        throw new Error("OBJ parsing returned no geometry");
      }
      mesh = createVAO(data, gAttribs);
      console.log("Po model loaded, vertices:", mesh.count);
    } catch (e) {
      console.warn("OBJ load failed, using cube", e);
      mesh = createFallbackCube(gAttribs);
      console.log("Using fallback cube, vertices:", mesh.count);
    }

    diffuseTex = await createTexture("po/textures/Po.png");
    createHatchSet();
    console.log("Textures created");

    setupQuad();
    setupFBO();
    console.log("FBO and quad ready");

    gl.useProgram(program);
    gl.uniform1i(uniforms.u_diffuse, 0);
    gl.uniform1i(uniforms.u_hatch0, 1);
    gl.uniform1i(uniforms.u_hatch1, 2);
    gl.uniform1i(uniforms.u_hatch2, 3);
    gl.uniform1i(uniforms.u_hatch3, 4);

    bindUI();
    console.log("Init complete, starting render loop");
    requestAnimationFrame(draw);
  }

  function setupQuad() {
    const data = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1,
    ]);
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const posLoc = edgeAttribs.a_position;
    const uvLoc = edgeAttribs.a_uv;
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    quad = { vao, count: 4 };
  }

  let gbufferInternal = gl.RGBA16F;
  let gbufferType = gl.HALF_FLOAT;

  function makeTextureAttachment(internalFormat, format, type) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, canvas.width, canvas.height, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function setupFBO() {
    // Use simple RGBA8 for both attachments (widely supported)
    if (fbo) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(fboColor);
      gl.deleteTexture(fboGbuffer);
    }

    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    fboColor = makeTextureAttachment(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    fboGbuffer = makeTextureAttachment(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const depthRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, canvas.width, canvas.height);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, fboGbuffer, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error("FBO incomplete", status.toString(16));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function bindUI() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener("mouseup", () => { isDragging = false; });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camera.rotate(dx, dy);
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      camera.dolly(Math.sign(e.deltaY));
    }, { passive: false });
    ui.resetCamera.addEventListener("click", () => camera.reset());
  }

  function setMatrices(progUniforms) {
    const view = Mat4.create();
    const proj = Mat4.create();
    const model = Mat4.identity(Mat4.create());
    camera.viewMatrix(view);
    const aspect = canvas.width / canvas.height;
    Mat4.perspective(proj, Math.PI / 4, aspect, 0.1, 100.0);
    gl.uniformMatrix4fv(progUniforms.u_view, false, view);
    gl.uniformMatrix4fv(progUniforms.u_proj, false, proj);
    gl.uniformMatrix4fv(progUniforms.u_model, false, model);
  }

  function setLighting(u) {
    const ld = vec3.fromValues(
      parseFloat(ui.lightX.value),
      parseFloat(ui.lightY.value),
      parseFloat(ui.lightZ.value),
    );
    vec3.normalize(ld, ld);
    gl.uniform3fv(u.u_lightDir, ld);
    gl.uniform3f(u.u_lightColor, 1.0, 1.0, 1.0);
  }

  function setNPROptions(u) {
    gl.uniform1i(u.u_mode, parseInt(ui.mode.value, 10));
    gl.uniform1f(u.u_bands, parseFloat(ui.bands.value));
    gl.uniform1f(u.u_rim, parseFloat(ui.rim.value));
    gl.uniform1f(u.u_hatchScale, parseFloat(ui.hatchScale.value));
  }

  let frameCount = 0;
  function draw() {
    resize();
    if (frameCount === 0) {
      console.log("First draw call, canvas:", canvas.width, "x", canvas.height);
      console.log("Camera distance:", camera.distance, "eye:", camera.getEye());
    }
    frameCount++;

    // Pass 1: G-buffer + color
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.08, 0.08, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(gbufferProgram);
    const gUniforms = getUniformLocations(gbufferProgram, ["u_model", "u_view", "u_proj", "u_diffuse", "u_lightDir", "u_lightColor", "u_mode", "u_bands", "u_rim", "u_hatchScale", "u_hatch0", "u_hatch1", "u_hatch2", "u_hatch3"]);
    gl.uniform1i(gUniforms.u_diffuse, 0);
    gl.uniform1i(gUniforms.u_hatch0, 1);
    gl.uniform1i(gUniforms.u_hatch1, 2);
    gl.uniform1i(gUniforms.u_hatch2, 3);
    gl.uniform1i(gUniforms.u_hatch3, 4);
    setMatrices(gUniforms);
    setLighting(gUniforms);
    setNPROptions(gUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, diffuseTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, hatchTex[0]);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, hatchTex[1]);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, hatchTex[2]);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, hatchTex[3]);

    if (mesh.vao && gl.bindVertexArray) gl.bindVertexArray(mesh.vao);
    else {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      const stride = 32;
      gl.enableVertexAttribArray(gAttribs.a_position);
      gl.vertexAttribPointer(gAttribs.a_position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(gAttribs.a_normal);
      gl.vertexAttribPointer(gAttribs.a_normal, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(gAttribs.a_uv);
      gl.vertexAttribPointer(gAttribs.a_uv, 2, gl.FLOAT, false, stride, 24);
    }
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (mesh.vao && gl.bindVertexArray) gl.bindVertexArray(null);

    // Pass 2: Edge detection and composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(edgeProgram);
    const eUniforms = getUniformLocations(edgeProgram, ["u_colorTex", "u_gbufferTex", "u_texel"]);
    gl.uniform1i(eUniforms.u_colorTex, 0);
    gl.uniform1i(eUniforms.u_gbufferTex, 1);
    gl.uniform2f(eUniforms.u_texel, 1.0 / canvas.width, 1.0 / canvas.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboColor);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fboGbuffer);
    gl.bindVertexArray(quad.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, quad.count);
    gl.bindVertexArray(null);

    requestAnimationFrame(draw);
  }

  init().catch((e) => {
    console.error(e);
    alert("Initialization failed; see console for details.");
  });
})();

