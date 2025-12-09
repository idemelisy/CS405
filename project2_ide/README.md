# CS405 Project 2: Non-Photorealistic Rendering Shaders

**Student**: İDE MELİS YILMAZ  
**Course**: CS405 - Computer Graphics  
**Semester**: Fall 2025

## Overview

This project implements multiple **Non-Photorealistic Rendering (NPR)** techniques using WebGL2:
- **Toon/Cel Shading**: Quantized lighting with discrete bands
- **Edge Detection**: Silhouette-based outlines using normal/depth discontinuities
- **Hatching**: Tone-mapped cross-hatch patterns for shadow representation

The implementation uses a **multi-pass rendering pipeline** with G-buffer for advanced post-processing effects.

---

## Features

### NPR Techniques Implemented

1. **Reference Phong Shading**
   - Standard Blinn-Phong lighting model
   - Serves as baseline comparison

2. **Toon/Cel Shading**
   - Quantized diffuse and specular components
   - Adjustable band count (2-8 levels)
   - Creates cartoon-like appearance

3. **Edge Detection**
   - View-space silhouette detection
   - Normal and depth-based edge detection using Sobel operators
   - Adjustable rim width for stylistic control

4. **Hatching (Custom NPR Effect)**
   - Procedural cross-hatch patterns
   - Tone-mapped layering (4 hatch levels)
   - Patterns intensify in shadow regions
   - Adjustable hatch density via scale parameter

### Technical Implementation

- **WebGL2** with GLSL 300 es shaders
- **Multi-pass rendering pipeline**:
  - Pass 1: G-buffer (color + normals/depth)
  - Pass 2: Edge detection & compositing
- **Procedural hatch textures** (4 levels: horizontal, diagonal, cross-hatch, dense cross-hatch)
- **Orbit camera** with mouse controls
- **Real-time parameter adjustment** via UI

---

## Controls

### Camera
- **Drag**: Orbit around model
- **Scroll**: Zoom in/out
- **Reset Camera**: Return to default view

### Visual Aids (Toggle with Checkbox)
- **Ground Grid**: Gray XZ plane for spatial reference
- **Coordinate Axes**: 
  - Red = X-axis (right)
  - Green = Y-axis (up)
  - Blue = Z-axis (forward)
- **Light Source**: 
  - Bright yellow sphere at light position
  - Yellow line from origin to light source
  - Moves in real-time with Light Dir sliders

### NPR Parameters
- **Technique Dropdown**: Switch between Phong/Toon/Edges/Hatching
- **Toon Bands** (2-8): Number of quantization levels for toon shading
- **Edge/Rim Width** (0.02-0.6): Silhouette thickness
- **Hatch Scale** (2-30): Cross-hatch line density (lower = denser)
- **Light Azimuth** (0-360°): Horizontal light direction (0°=East, 90°=South, 180°=West, 270°=North)
- **Light Elevation** (-90 to +90°): Vertical light angle (+90°=zenith, 0°=horizon, -90°=nadir)

---

## Running the Project

### Requirements
- Modern browser with **WebGL2 support** (Chrome, Edge, Firefox)
- Local web server (required for shader/model loading)

### Setup

1. **Start a local server** in the `project2_ide/` directory:
   ```bash
   # Option 1: Python
   python -m http.server 8000
   
   # Option 2: Node.js
   npx http-server . -p 8000
   
   # Option 3: VS Code Live Server extension
   ```

2. **Open** `http://localhost:8000/index.html` in your browser

3. **Interact** with the controls to explore different NPR styles

---

## Project Structure

```
project2_ide/
├── index.html          # Main HTML (UI + canvas)
├── main.js             # WebGL init, rendering pipeline, OBJ loader
├── math.js             # glMatrix helpers, orbit camera
├── shaders/
│   ├── gbuffer.vert    # G-buffer pass vertex shader
│   ├── gbuffer.frag    # G-buffer pass fragment shader (NPR logic)
│   ├── edge.vert       # Post-process vertex shader
│   └── edge.frag       # Edge detection (Sobel) fragment shader
├── po/
│   ├── panda.obj       # Po model (CC-BY Neut2000)
│   ├── textures/       # Po diffuse textures
│   └── obj_credits.txt # Model attribution
└── README.md           # This file
```

---

## Model Attribution

**"Kung-Fu Panda - Po"**  
by [Neut2000](https://skfb.ly/oRFDP)  
Licensed under [Creative Commons Attribution](http://creativecommons.org/licenses/by/4.0/)

---

## Implementation Notes

### Critical Fixes

**1. Light Direction Space Transformation**
- Light direction is now correctly transformed from **World Space** to **View Space**
- Formula: `L_view = mat3(ViewMatrix) × L_world`
- This ensures lighting stays consistent as the camera moves

**2. Ambient Light Reduction**
- Reduced from 10% to **2%** for dramatic shadows
- Added **back-face darkening** based on surface orientation
- Result: Back-facing surfaces are much darker (1-2% brightness)

### G-Buffer Layout
- **Attachment 0**: Shaded color (RGBA8)
- **Attachment 1**: View-space normal (RGB) + linear depth (A)

### Hatching Algorithm
Procedural patterns are layered based on tone (inverse of N·L):
```glsl
tone = 1.0 - max(dot(N, L), 0.0)
if (tone > 0.1) apply hatch level 0  // horizontal
if (tone > 0.3) apply hatch level 1  // diagonal
if (tone > 0.5) apply hatch level 2  // cross-hatch
if (tone > 0.7) apply hatch level 3  // dense cross-hatch
```

### Edge Detection
Sobel kernels applied to:
- **Depth gradients**: Detect geometry boundaries
- **Normal discontinuities**: Detect surface orientation changes

Composite formula:
```
edgeStrength = w_d * |∇D| + w_n * |∇N|
```

---

## Known Limitations

- **Po model complexity**: High vertex count (~8K vertices) may affect performance on low-end GPUs
- **Procedural hatching**: Real hand-drawn hatch textures would provide more artistic control
- **Single light source**: Only one directional light supported
- **No ambient occlusion**: Shadows are purely lighting-based

---

## References

- Strothotte & Schlechtweg, *Non-Photorealistic Computer Graphics*
- Gooch et al., "A Non-Photorealistic Lighting Model For Automatic Technical Illustration" (1998)
- CS405 Course Materials (Sabancı University, Fall 2025)
- Labs 3, 6 (WebGL scaffolding, matrix operations, buffer setup)

---

## License

Code: MIT (project implementation)  
Model: CC-BY 4.0 (Po model by Neut2000)

