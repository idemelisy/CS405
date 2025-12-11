(() => {
  const { Mat4, Vec3, OrbitCamera, degToRad } = window.MathHelpers;
  const vec3 = window.vec3 || (window.glMatrix && window.glMatrix.vec3);
  const mat4 = window.mat4 || (window.glMatrix && window.glMatrix.mat4);
  const mat3 = window.mat3 || (window.glMatrix && window.glMatrix.mat3);
  if (!vec3 || !mat4 || !mat3) {
    throw new Error("glMatrix vec3/mat4/mat3 not found. Ensure gl-matrix-min.js is loaded before main.js");
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
  let axisProgram = null;
  let meshGroups = [];  // [{vao, count, texture}, ...]
  let textures = {};    // {body: tex, eyes: tex}
  let hatchTex = [];
  let uniforms = {};
  let attribs = {};
  let gAttribs = {};
  let edgeAttribs = {};
  let axisAttribs = {};
  let quad = null;
  let axis = null;
  let lightLine = null;
  let groundGrid = null;
  let lightSphere = null;
  let fbo = null;
  let fboColor = null;
  let fboGbuffer = null;

  const ui = {
    mode: document.getElementById("mode"),
    mode2: document.getElementById("mode2"),
    compareMode: document.getElementById("compareMode"),
    bands: document.getElementById("bands"),
    rim: document.getElementById("rim"),
    hatchScale: document.getElementById("hatchScale"),
    lightAzimuth: document.getElementById("lightAzimuth"),
    lightElevation: document.getElementById("lightElevation"),
    showHelpers: document.getElementById("showHelpers"),
    useTexture: document.getElementById("useTexture"),
    resetCamera: document.getElementById("resetCamera"),
    compareDivider: document.getElementById("compareDivider"),
    labelLeft: document.getElementById("labelLeft"),
    labelRight: document.getElementById("labelRight"),
  };
  
  const modeNames = ["Reference Phong", "Toon", "Edges", "Hatching"];

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

  // OBJ loader with SMOOTH NORMALS and MULTI-MATERIAL support
  function parseOBJ(text) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const lines = text.split("\n");
    
    // Helper: compute face normal from 3 positions
    function computeFaceNormal(p0, p1, p2) {
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      const nz = e1[0] * e2[1] - e1[1] * e2[0];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 0.0001) return [0, 1, 0];
      return [nx / len, ny / len, nz / len];
    }
    
    // Helper: normalize a vector
    function normalize(v) {
      const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      if (len < 0.0001) return [0, 1, 0];
      return [v[0]/len, v[1]/len, v[2]/len];
    }
    
    // First pass: collect positions, uvs, and faces BY MATERIAL
    const materialGroups = {};  // material name -> array of faces
    let currentMaterial = "default";
    
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
      } else if (l.startsWith("usemtl ")) {
        currentMaterial = l.split(/\s+/)[1] || "default";
        if (!materialGroups[currentMaterial]) {
          materialGroups[currentMaterial] = [];
        }
      } else if (l.startsWith("f ")) {
        if (!materialGroups[currentMaterial]) {
          materialGroups[currentMaterial] = [];
        }
        const parts = l.split(/\s+/).slice(1);
        const face = parts.map(v => {
          const [vi, ti, ni] = v.split("/").map(s => s ? parseInt(s, 10) : 0);
          return { vi: vi - 1, ti: ti ? ti - 1 : -1, ni: ni ? ni - 1 : -1 };
        });
        materialGroups[currentMaterial].push(face);
      }
    }
    
    // Check if OBJ has normals
    const hasOwnNormals = normals.length > 0;
    
    // =========================================================================
    // CENTER AND SCALE MODEL - Normalize to fit in view
    // =========================================================================
    if (positions.length > 0) {
      // Calculate bounding box
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      
      for (const p of positions) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        minZ = Math.min(minZ, p[2]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
        maxZ = Math.max(maxZ, p[2]);
      }
      
      // Calculate center and size
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const maxSize = Math.max(sizeX, sizeY, sizeZ);
      
      // Scale to fit in ~3 units and center at origin
      const targetSize = 3.0;
      const scale = targetSize / maxSize;
      
      console.log(`Model bounds: (${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)}) to (${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)})`);
      console.log(`Model center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)}), size: ${maxSize.toFixed(2)}`);
      console.log(`Applying scale: ${scale.toFixed(4)} to fit target size ${targetSize}`);
      
      // Transform all positions: center then scale
      for (let i = 0; i < positions.length; i++) {
        positions[i][0] = (positions[i][0] - centerX) * scale;
        positions[i][1] = (positions[i][1] - centerY) * scale;
        positions[i][2] = (positions[i][2] - centerZ) * scale;
      }
    }
    
    // Collect ALL faces for smooth normal computation
    const allFaces = Object.values(materialGroups).flat();
    
    // If no normals, compute SMOOTH normals (average of adjacent face normals)
    let smoothNormals = null;
    if (!hasOwnNormals) {
      smoothNormals = positions.map(() => [0, 0, 0]);
      
      for (const face of allFaces) {
        for (let i = 1; i < face.length - 1; i++) {
          const v0 = face[0], v1 = face[i], v2 = face[i + 1];
          const p0 = positions[v0.vi] || [0,0,0];
          const p1 = positions[v1.vi] || [0,0,0];
          const p2 = positions[v2.vi] || [0,0,0];
          
          const fn = computeFaceNormal(p0, p1, p2);
          
          for (const v of [v0, v1, v2]) {
            if (v.vi >= 0 && v.vi < smoothNormals.length) {
              smoothNormals[v.vi][0] += fn[0];
              smoothNormals[v.vi][1] += fn[1];
              smoothNormals[v.vi][2] += fn[2];
            }
          }
        }
      }
      
      smoothNormals = smoothNormals.map(n => normalize(n));
      console.log("Computed SMOOTH normals for", smoothNormals.length, "vertices");
    }
    
    // Generate vertex buffer for each material group
    function generateVertices(faces) {
      const vertices = [];
      for (const face of faces) {
        for (let i = 1; i < face.length - 1; i++) {
          const tri = [face[0], face[i], face[i + 1]];
          
          for (const v of tri) {
            const p = positions[v.vi] || [0, 0, 0];
            const uv = v.ti >= 0 ? (uvs[v.ti] || [0, 0]) : [0, 0];
            
            let n;
            if (hasOwnNormals && v.ni >= 0) {
              n = normals[v.ni] || [0, 1, 0];
            } else if (smoothNormals && v.vi >= 0) {
              n = smoothNormals[v.vi];
            } else {
              n = [0, 1, 0];
            }
            
            vertices.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]);
          }
        }
      }
      return new Float32Array(vertices);
    }
    
    // Build result object with material groups
    const result = {
      materials: {}
    };
    
    for (const [matName, faces] of Object.entries(materialGroups)) {
      const verts = generateVertices(faces);
      result.materials[matName] = verts;
      console.log(`  Material "${matName}": ${verts.length / 8} vertices`);
    }
    
    console.log("OBJ parsed:", positions.length, "positions,", 
                Object.keys(materialGroups).length, "materials");
    return result;
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
      // Level 0: Horizontal lines (thin)
      createHatchTexture((x, y, s) => (y % 4 === 0 ? 0 : 255)),
      // Level 1: Diagonal lines (\)
      createHatchTexture((x, y, s) => ((x + y) % 4 === 0 ? 0 : 255)),
      // Level 2: Cross-hatch (+ pattern)
      createHatchTexture((x, y, s) => ((x % 4 === 0 || y % 4 === 0) ? 0 : 255)),
      // Level 3: Dense cross-hatch (X pattern)
      createHatchTexture((x, y, s) => (((x + y) % 3 === 0 || (x - y + s) % 3 === 0) ? 0 : 255)),
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
    const [vs, fs, gvs, gfs, evs, efs, avs, afs] = await Promise.all([
      loadText("shaders/phong.vert"),
      loadText("shaders/phong.frag"),
      loadText("shaders/gbuffer.vert"),
      loadText("shaders/gbuffer.frag"),
      loadText("shaders/edge.vert"),
      loadText("shaders/edge.frag"),
      loadText("shaders/axis.vert"),
      loadText("shaders/axis.frag"),
    ]);
    console.log("Shaders loaded");
    program = createProgram(vs, fs);
    gbufferProgram = createProgram(gvs, gfs);
    edgeProgram = createProgram(evs, efs);
    axisProgram = createProgram(avs, afs);
    console.log("Programs created");

    gl.useProgram(gbufferProgram);
    gAttribs = getAttribLocations(gbufferProgram, ["a_position", "a_normal", "a_uv"]);
    gl.useProgram(program);
    attribs = getAttribLocations(program, ["a_position", "a_normal", "a_uv"]);
    edgeAttribs = getAttribLocations(edgeProgram, ["a_position", "a_uv"]);
    axisAttribs = getAttribLocations(axisProgram, ["a_position", "a_color"]);
    uniforms = getUniformLocations(program, [
      "u_model", "u_view", "u_proj", "u_diffuse",
      "u_lightDir", "u_lightColor", "u_mode",
      "u_bands", "u_rim", "u_hatchScale",
      "u_hatch0", "u_hatch1", "u_hatch2", "u_hatch3",
    ]);
    console.log("Attributes and uniforms located");

    // Setup rendering state
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.BLEND);  // Opaque rendering (no transparency)
    gl.frontFace(gl.CCW);  // Counter-clockwise winding is front-face (OpenGL default)
    gl.cullFace(gl.BACK);  // Cull back-facing triangles
    gl.enable(gl.CULL_FACE);

    // Load model with multi-material support
    try {
      const objText = await loadText("apple/apple2.obj");
      console.log("OBJ file loaded, size:", objText.length, "bytes");
      const objData = parseOBJ(objText);
      
      // Load textures for apple model
      textures.body = await createTexture("apple/apple2.jpg");
      textures.specular = textures.body;  // Use diffuse as specular fallback
      textures.normal = textures.body;    // Use diffuse as normal fallback
      console.log("Loaded: apple diffuse texture");
      
      // Create VAO for each material group
      for (const [matName, vertices] of Object.entries(objData.materials)) {
        if (vertices.length === 0) continue;
        const vao = createVAO(vertices, gAttribs);
        
        // All materials use the same apple texture
        meshGroups.push({
          name: matName,
          vao: vao.vao,
          count: vao.count,
          texture: textures.body
        });
        console.log(`  Material group "${matName}": ${vao.count} vertices`);
      }
      
      if (meshGroups.length === 0) {
        throw new Error("OBJ parsing returned no geometry");
      }
      console.log("Apple model loaded with", meshGroups.length, "material groups");
    } catch (e) {
      console.warn("OBJ load failed, using cube", e);
      textures.body = await createTexture("apple/apple2.jpg");
      textures.specular = textures.body;  // Use diffuse as fallback
      textures.normal = textures.body;    // Use diffuse as fallback
      const cube = createFallbackCube(gAttribs);
      meshGroups.push({ name: "cube", vao: cube.vao, count: cube.count, texture: textures.body });
      console.log("Using fallback cube, vertices:", cube.count);
    }

    createHatchSet();
    console.log("Textures created");

    setupQuad();
    createAxisGeometry();
    lightLine = createLightLine();
    groundGrid = createGroundGrid();
    lightSphere = createLightSphere();
    setupFBO();
    console.log("Geometry ready:");
    console.log("  Axis:", axis.count, "vertices");
    console.log("  Light line:", lightLine.count, "vertices");
    console.log("  Grid:", groundGrid.count, "vertices");
    console.log("  Light sphere:", lightSphere.count, "vertices");

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

  function createAxisGeometry() {
    // Create axis lines: X(red), Y(green), Z(blue)
    const axisLength = 2.5;
    const vertices = [
      // X axis (red)
      0, 0, 0,  1, 0, 0,
      axisLength, 0, 0,  1, 0, 0,
      
      // Y axis (green)
      0, 0, 0,  0, 1, 0,
      0, axisLength, 0,  0, 1, 0,
      
      // Z axis (blue)
      0, 0, 0,  0, 0, 1,
      0, 0, axisLength,  0, 0, 1,
    ];
    
    const data = new Float32Array(vertices);
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    
    const posLoc = axisAttribs.a_position;
    const colLoc = axisAttribs.a_color;
    const stride = 24;
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, 12);
    gl.bindVertexArray(null);
    
    axis = { vao, count: 6, buffer: buf };
  }
  
  function createLightLine() {
    // Separate buffer for dynamic light line
    // Initialize with dummy data (will be updated each frame)
    const dummyData = new Float32Array([
      0, 0, 0,  1, 1, 0,  // origin
      1, 1, 1,  1, 1, 0,  // dummy end point
    ]);
    
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, dummyData, gl.DYNAMIC_DRAW);
    
    const posLoc = axisAttribs.a_position;
    const colLoc = axisAttribs.a_color;
    const stride = 24;
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, 12);
    gl.bindVertexArray(null);
    
    return { vao, count: 2, buffer: buf };
  }
  
  function createGroundGrid() {
    // Create XZ grid (ground plane at y=0)
    const gridSize = 6;
    const gridStep = 2;  // Wider spacing - less dense
    const vertices = [];
    const color = [0.25, 0.25, 0.25]; // Darker gray - less prominent
    
    // Lines parallel to X axis
    for (let z = -gridSize; z <= gridSize; z += gridStep) {
      vertices.push(-gridSize, 0, z, ...color);
      vertices.push(gridSize, 0, z, ...color);
    }
    
    // Lines parallel to Z axis
    for (let x = -gridSize; x <= gridSize; x += gridStep) {
      vertices.push(x, 0, -gridSize, ...color);
      vertices.push(x, 0, gridSize, ...color);
    }
    
    const data = new Float32Array(vertices);
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    
    const posLoc = axisAttribs.a_position;
    const colLoc = axisAttribs.a_color;
    const stride = 24;
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, 12);
    gl.bindVertexArray(null);
    
    return { vao, count: vertices.length / 6, buffer: buf };
  }
  
  function createLightSphere() {
    // Create octahedron for light source visualization
    const vertices = [];
    const color = [1, 1, 0.3]; // Bright yellow
    const radius = 0.3;
    
    // Octahedron: 8 triangular faces
    const triangles = [
      // Top 4 triangles
      [[0, radius, 0], [radius, 0, 0], [0, 0, radius]],
      [[0, radius, 0], [0, 0, radius], [-radius, 0, 0]],
      [[0, radius, 0], [-radius, 0, 0], [0, 0, -radius]],
      [[0, radius, 0], [0, 0, -radius], [radius, 0, 0]],
      // Bottom 4 triangles
      [[0, -radius, 0], [0, 0, radius], [radius, 0, 0]],
      [[0, -radius, 0], [-radius, 0, 0], [0, 0, radius]],
      [[0, -radius, 0], [0, 0, -radius], [-radius, 0, 0]],
      [[0, -radius, 0], [radius, 0, 0], [0, 0, -radius]],
    ];
    
    for (let tri of triangles) {
      for (let vert of tri) {
        vertices.push(...vert, ...color);
      }
    }
    
    const data = new Float32Array(vertices);
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    
    const posLoc = axisAttribs.a_position;
    const colLoc = axisAttribs.a_color;
    const stride = 24;
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, stride, 12);
    gl.bindVertexArray(null);
    
    return { vao, count: vertices.length / 6, buffer: buf };
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
    
    // Compare mode toggle
    function updateCompareUI() {
      const isCompare = ui.compareMode.checked;
      ui.mode2.disabled = !isCompare;
      ui.compareDivider.style.display = isCompare ? "block" : "none";
      ui.labelLeft.style.display = isCompare ? "block" : "none";
      ui.labelRight.style.display = isCompare ? "block" : "none";
      
      if (isCompare) {
        ui.labelLeft.textContent = modeNames[parseInt(ui.mode.value, 10)];
        ui.labelRight.textContent = modeNames[parseInt(ui.mode2.value, 10)];
      }
    }
    
    ui.compareMode.addEventListener("change", updateCompareUI);
    ui.mode.addEventListener("change", updateCompareUI);
    ui.mode2.addEventListener("change", updateCompareUI);
    updateCompareUI();  // Initialize
  }

  function setMatrices(progUniforms) {
    const view = Mat4.create();
    const proj = Mat4.create();
    const model = Mat4.identity(Mat4.create());
    
    // Rotate apple stem to align with GREEN Y-axis (up)
    Mat4.rotateX(model, model, Math.PI / 2);
     Mat4.rotateY(model, model, Math.PI / 6);
    
    camera.viewMatrix(view);
    const aspect = canvas.width / canvas.height;
    Mat4.perspective(proj, Math.PI / 4, aspect, 0.1, 100.0);
    gl.uniformMatrix4fv(progUniforms.u_view, false, view);
    gl.uniformMatrix4fv(progUniforms.u_proj, false, proj);
    gl.uniformMatrix4fv(progUniforms.u_model, false, model);
    return view;  // Return view matrix for light transformation
  }

  function setLighting(u, viewMatrix) {
    // Convert spherical coordinates to cartesian (light direction in WORLD space)
    // Azimuth: 0° = +X, 90° = +Z, 180° = -X, 270° = -Z
    // Elevation: +90° = +Y (top), 0° = horizon, -90° = -Y (bottom)
    const azimuthDeg = parseFloat(ui.lightAzimuth.value);
    const elevationDeg = parseFloat(ui.lightElevation.value);
    
    const azimuthRad = degToRad(azimuthDeg);
    const elevationRad = degToRad(elevationDeg);
    
    // Spherical to Cartesian conversion (WORLD space)
    const cosElev = Math.cos(elevationRad);
    const lightDirWorld = vec3.fromValues(
      cosElev * Math.cos(azimuthRad),   // X
      Math.sin(elevationRad),            // Y
      cosElev * Math.sin(azimuthRad)    // Z
    );
    vec3.normalize(lightDirWorld, lightDirWorld);
    
    // ✅ CRITICAL FIX: Transform light direction from World Space to View Space
    // For direction vectors, we use ONLY the 3x3 rotation part (ignore translation)
    // L_view = mat3(V) * L_world
    
    const lightDirView = vec3.create();
    
    if (mat3 && mat3.fromMat4 && vec3.transformMat3) {
      // Method 1: Use mat3 functions if available
      const viewMat3 = mat3.create();
      mat3.fromMat4(viewMat3, viewMatrix);
      vec3.transformMat3(lightDirView, lightDirWorld, viewMat3);
    } else {
      // Method 2: Manual 3x3 matrix multiplication (fallback)
      // Multiply direction by upper-left 3x3 of view matrix
      lightDirView[0] = viewMatrix[0] * lightDirWorld[0] + viewMatrix[4] * lightDirWorld[1] + viewMatrix[8] * lightDirWorld[2];
      lightDirView[1] = viewMatrix[1] * lightDirWorld[0] + viewMatrix[5] * lightDirWorld[1] + viewMatrix[9] * lightDirWorld[2];
      lightDirView[2] = viewMatrix[2] * lightDirWorld[0] + viewMatrix[6] * lightDirWorld[1] + viewMatrix[10] * lightDirWorld[2];
    }
    
    vec3.normalize(lightDirView, lightDirView);
    
    gl.uniform3fv(u.u_lightDir, lightDirView);  // Send VIEW space light direction
    gl.uniform3f(u.u_lightColor, 1.0, 1.0, 1.0);
  }

  function setNPROptions(u, modeOverride = null) {
    const mode = modeOverride !== null ? modeOverride : parseInt(ui.mode.value, 10);
    gl.uniform1i(u.u_mode, mode);
    gl.uniform1f(u.u_bands, parseFloat(ui.bands.value));
    gl.uniform1f(u.u_rim, parseFloat(ui.rim.value));
    gl.uniform1f(u.u_hatchScale, parseFloat(ui.hatchScale.value));
  }

  let frameCount = 0;
  
  // Helper function to render model with given mode
  function renderModel(gUniforms, viewMatrix, modeValue) {
    setNPROptions(gUniforms, modeValue);
    
    // Bind specular and normal maps (same for all materials)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures.specular);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textures.normal);
    
    // Bind hatch textures
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, hatchTex[0]);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, hatchTex[1]);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, hatchTex[2]);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, hatchTex[3]);

    // Draw each material group with its own diffuse texture
    for (const group of meshGroups) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, group.texture);
      
      if (group.vao && gl.bindVertexArray) {
        gl.bindVertexArray(group.vao);
        gl.drawArrays(gl.TRIANGLES, 0, group.count);
        gl.bindVertexArray(null);
      }
    }
  }
  
  function draw() {
    resize();
    if (frameCount === 0) {
      console.log("First draw call, canvas:", canvas.width, "x", canvas.height);
      console.log("Camera distance:", camera.distance, "eye:", camera.getEye());
    }
    frameCount++;
    
    const isCompareMode = ui.compareMode.checked;
    const mode1 = parseInt(ui.mode.value, 10);
    const mode2 = parseInt(ui.mode2.value, 10);

    // Pass 1: G-buffer + color
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.9, 0.9, 0.95, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.useProgram(gbufferProgram);
    const gUniforms = getUniformLocations(gbufferProgram, [
      "u_model", "u_view", "u_proj", "u_diffuse", "u_specularMap", "u_normalMap",
      "u_lightDir", "u_lightColor", "u_mode", "u_bands", "u_rim", "u_hatchScale", 
      "u_hatch0", "u_hatch1", "u_hatch2", "u_hatch3", "u_useTexture"
    ]);
    // Texture units: 0=diffuse, 1=specular, 2=normal, 3-6=hatch
    gl.uniform1i(gUniforms.u_diffuse, 0);
    gl.uniform1i(gUniforms.u_specularMap, 1);
    gl.uniform1i(gUniforms.u_normalMap, 2);
    gl.uniform1i(gUniforms.u_hatch0, 3);
    gl.uniform1i(gUniforms.u_hatch1, 4);
    gl.uniform1i(gUniforms.u_hatch2, 5);
    gl.uniform1i(gUniforms.u_hatch3, 6);
    gl.uniform1i(gUniforms.u_useTexture, ui.useTexture.checked ? 1 : 0);
    const viewMatrix = setMatrices(gUniforms);
    setLighting(gUniforms, viewMatrix);
    
    if (isCompareMode) {
      // COMPARE MODE: Split screen rendering
      const halfWidth = Math.floor(canvas.width / 2);
      
      gl.enable(gl.SCISSOR_TEST);
      
      // Left half - Mode 1
      gl.scissor(0, 0, halfWidth, canvas.height);
      gl.clear(gl.DEPTH_BUFFER_BIT);  // Clear depth for this half
      renderModel(gUniforms, viewMatrix, mode1);
      
      // Right half - Mode 2
      gl.scissor(halfWidth, 0, canvas.width - halfWidth, canvas.height);
      gl.clear(gl.DEPTH_BUFFER_BIT);  // Clear depth for this half
      renderModel(gUniforms, viewMatrix, mode2);
      
      gl.disable(gl.SCISSOR_TEST);
    } else {
      // NORMAL MODE: Full screen rendering
      renderModel(gUniforms, viewMatrix, mode1);
    }

    // Pass 2: Edge detection and composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);  // Fullscreen quad doesn't need depth
    gl.clearColor(0.9, 0.9, 0.95, 1);
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

    // Pass 3: Draw visualization helpers (grid, axes, light source)
    if (ui.showHelpers.checked) {
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);  // Clear depth so helpers render on top
      gl.useProgram(axisProgram);
      const aUniforms = getUniformLocations(axisProgram, ["u_model", "u_view", "u_proj"]);
      
      // Set view and projection
      const view = Mat4.create();
      camera.viewMatrix(view);
      const proj = Mat4.create();
      Mat4.perspective(proj, degToRad(45), canvas.width / canvas.height, 0.1, 100);
      gl.uniformMatrix4fv(aUniforms.u_view, false, view);
      gl.uniformMatrix4fv(aUniforms.u_proj, false, proj);
      
      // Get light direction and position (spherical to cartesian)
      const azimuthDeg = parseFloat(ui.lightAzimuth.value);
      const elevationDeg = parseFloat(ui.lightElevation.value);
      const azimuthRad = degToRad(azimuthDeg);
      const elevationRad = degToRad(elevationDeg);
      
      const cosElev = Math.cos(elevationRad);
      const lightDir = vec3.fromValues(
        cosElev * Math.cos(azimuthRad),
        Math.sin(elevationRad),
        cosElev * Math.sin(azimuthRad)
      );
      
      const lightDistance = 4.5;
      const lightPos = vec3.fromValues(
        lightDir[0] * lightDistance,
        lightDir[1] * lightDistance,
        lightDir[2] * lightDistance
      );
      
      // 1. Draw ground grid (thin lines)
      gl.lineWidth(1.0);
      const gridModel = Mat4.create();
      Mat4.identity(gridModel);
      gl.uniformMatrix4fv(aUniforms.u_model, false, gridModel);
      gl.bindVertexArray(groundGrid.vao);
      gl.drawArrays(gl.LINES, 0, groundGrid.count);
      gl.bindVertexArray(null);
      
      // 2. Draw XYZ axes (thicker if supported)
      gl.lineWidth(3.0);  // May not work on all GPUs, but try
      const axisModel = Mat4.create();
      Mat4.identity(axisModel);
      gl.uniformMatrix4fv(aUniforms.u_model, false, axisModel);
      gl.bindVertexArray(axis.vao);
      gl.drawArrays(gl.LINES, 0, axis.count);
      gl.bindVertexArray(null);
      
      // 3. Draw light direction line (thickest)
      gl.lineWidth(4.0);
      const lightLineVerts = new Float32Array([
        0, 0, 0,  1, 0.9, 0.2,  // origin, bright yellow-orange
        lightPos[0], lightPos[1], lightPos[2],  1, 0.9, 0.2,  // light position
      ]);
      // Update light line buffer (using VAO's buffer)
      gl.bindBuffer(gl.ARRAY_BUFFER, lightLine.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, lightLineVerts);
      
      // Draw using VAO
      gl.bindVertexArray(lightLine.vao);
      gl.drawArrays(gl.LINES, 0, lightLine.count);
      gl.bindVertexArray(null);
      gl.lineWidth(1.0);  // Reset
      
      // 4. Draw light source sphere at light position
      const lightModel = Mat4.create();
      Mat4.identity(lightModel);
      Mat4.translate(lightModel, lightModel, lightPos);
      gl.uniformMatrix4fv(aUniforms.u_model, false, lightModel);
      gl.bindVertexArray(lightSphere.vao);
      gl.drawArrays(gl.TRIANGLES, 0, lightSphere.count);
      gl.bindVertexArray(null);
    }

    requestAnimationFrame(draw);
  }

  init().catch((e) => {
    console.error(e);
    alert("Initialization failed; see console for details.");
  });
})();

