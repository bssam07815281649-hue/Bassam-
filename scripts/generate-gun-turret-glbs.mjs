import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Minimal Node.js polyfills for THREE.GLTFExporter (GLB + PNG DataTexture export)
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const len = data.length;
  const out = Buffer.alloc(12 + len);
  out.writeUInt32BE(len, 0);
  out.write(type, 4, 4, 'ascii');
  if (len > 0) data.copy(out, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  out.writeUInt32BE(crc, 8 + len);
  return out;
}

function encodeRgbaToPng(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    const srcStart = y * stride;
    for (let x = 0; x < stride; x++) {
      raw[rowStart + 1 + x] = rgba[srcStart + x];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function installNodeExportPolyfills() {
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      constructor(dataOrW, wOrH, maybeH) {
        if (typeof dataOrW === 'number') {
          this.width = dataOrW;
          this.height = wOrH;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrW;
          this.width = wOrH;
          this.height = maybeH ?? dataOrW.length / (4 * wOrH);
        }
      }
    };
  }

  if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class FileReader {
      constructor() {
        this.result = null;
        this.onloadend = null;
      }
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((buf) => {
          this.result = buf;
          if (this.onloadend) this.onloadend({ target: this });
        });
      }
      readAsDataURL(blob) {
        blob.arrayBuffer().then((buf) => {
          const b64 = Buffer.from(buf).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
          if (this.onloadend) this.onloadend({ target: this });
        });
      }
    };
  }

  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      createElement(tag) {
        if (tag !== 'canvas') {
          throw new Error(`Unsupported DOM element in Node generator: ${tag}`);
        }
        const canvas = {
          width: 1,
          height: 1,
          _pixels: null,
          _flipY: false,
          getContext() {
            return {
              translate() {},
              scale(sx, sy) {
                if (sy < 0) canvas._flipY = true;
              },
              fillStyle: '#000000',
              fillRect() {
                canvas._pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
              },
              putImageData(imgData) {
                if (!canvas._flipY) {
                  canvas._pixels = new Uint8ClampedArray(imgData.data);
                } else {
                  const w = imgData.width;
                  const h = imgData.height;
                  const out = new Uint8ClampedArray(w * h * 4);
                  for (let y = 0; y < h; y++) {
                    const srcRow = (h - 1 - y) * w * 4;
                    const dstRow = y * w * 4;
                    out.set(imgData.data.subarray(srcRow, srcRow + w * 4), dstRow);
                  }
                  canvas._pixels = out;
                }
              },
              getImageData() {
                return new globalThis.ImageData(
                  canvas._pixels || new Uint8ClampedArray(canvas.width * canvas.height * 4),
                  canvas.width,
                  canvas.height,
                );
              },
              drawImage() {},
            };
          },
          toBlob(callback, mimeType = 'image/png') {
            const pixels = canvas._pixels || new Uint8ClampedArray(canvas.width * canvas.height * 4);
            const png = encodeRgbaToPng(pixels, canvas.width, canvas.height);
            callback(new Blob([png], { type: mimeType }));
          },
        };
        return canvas;
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Deterministic Hash & Procedural Stylized PBR Textures (128x128 mobile-ready)
// ---------------------------------------------------------------------------
function hash2(x, y, seed = 1337) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;

  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbmTile(u, v, baseFreq, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(u * freq, v * freq, freq, seed + o * 97) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function makeDataTexture(size, pixelFn, srgb = true) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const [r, g, b, a = 255] = pixelFn(u, v, x, y);
      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMaterialLibrary() {
  const stoneTex = makeDataTexture(128, (u, v) => {
    const n1 = fbmTile(u, v, 8, 4, 101);
    const n2 = fbmTile(u, v, 20, 2, 202);
    const pit = n2 < 0.34 ? -18 : 0;
    const shade = (n1 - 0.5) * 38 + pit;
    return [144 + shade, 139 + shade * 0.96, 132 + shade * 0.9];
  });

  const stoneDarkTex = makeDataTexture(128, (u, v) => {
    const n1 = fbmTile(u, v, 8, 3, 303);
    const shade = (n1 - 0.5) * 30;
    return [84 + shade, 86 + shade, 90 + shade];
  });

  const gunmetalTex = makeDataTexture(128, (u, v) => {
    const streak = fbmTile(u * 0.5, v * 2.0, 12, 3, 404);
    const speck = fbmTile(u, v, 16, 2, 409);
    const d = (streak - 0.5) * 24 + (speck - 0.5) * 12;
    return [74 + d, 80 + d, 90 + d * 1.05];
  });

  const barrelSteelTex = makeDataTexture(128, (u, v) => {
    const brush = fbmTile(u * 2.0, v * 0.5, 16, 3, 505);
    const d = (brush - 0.5) * 22;
    return [112 + d, 118 + d, 128 + d];
  });

  const orangeArmorTex = makeDataTexture(128, (u, v) => {
    const n1 = fbmTile(u, v, 8, 3, 606);
    const wear = fbmTile(u, v, 16, 2, 616);
    const d = (n1 - 0.5) * 22 + (wear - 0.5) * 10;
    return [244 + d * 0.45, 146 + d, 26 + d * 0.3];
  });

  const grassTex = makeDataTexture(128, (u, v) => {
    const patch = fbmTile(u, v, 8, 3, 707);
    const blades = fbmTile(u * 2, v * 2, 16, 2, 717);
    const d = (patch - 0.5) * 40 + (blades - 0.5) * 24;
    return [102 + d * 0.85, 148 + d, 48 + d * 0.45];
  });

  const dirtTex = makeDataTexture(64, (u, v) => {
    const n = fbmTile(u, v, 8, 3, 808);
    const d = (n - 0.5) * 26;
    return [96 + d, 72 + d * 0.8, 48 + d * 0.6];
  });

  return {
    stone: new THREE.MeshStandardMaterial({
      name: 'StoneMasonry',
      map: stoneTex,
      roughness: 0.86,
      metalness: 0.06,
      vertexColors: true,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      name: 'StoneMortarDark',
      map: stoneDarkTex,
      roughness: 0.9,
      metalness: 0.08,
      vertexColors: true,
    }),
    gunmetal: new THREE.MeshStandardMaterial({
      name: 'GunmetalSteel',
      map: gunmetalTex,
      roughness: 0.4,
      metalness: 0.78,
      vertexColors: true,
    }),
    barrelSteel: new THREE.MeshStandardMaterial({
      name: 'BarrelSteel',
      map: barrelSteelTex,
      roughness: 0.3,
      metalness: 0.86,
      vertexColors: true,
    }),
    boreDark: new THREE.MeshStandardMaterial({
      name: 'BarrelBoreDark',
      color: 0x0b0d11,
      roughness: 0.95,
      metalness: 0.1,
    }),
    rivetSteel: new THREE.MeshStandardMaterial({
      name: 'RivetSteel',
      color: 0xb6c0cc,
      roughness: 0.28,
      metalness: 0.9,
    }),
    orangeArmor: new THREE.MeshStandardMaterial({
      name: 'OrangeArmor',
      map: orangeArmorTex,
      roughness: 0.36,
      metalness: 0.28,
      vertexColors: true,
    }),
    goldTrim: new THREE.MeshStandardMaterial({
      name: 'AmberGoldTrim',
      color: 0xf7b733,
      roughness: 0.3,
      metalness: 0.62,
      vertexColors: true,
    }),
    grass: new THREE.MeshStandardMaterial({
      name: 'TurfGrass',
      map: grassTex,
      roughness: 0.9,
      metalness: 0.0,
      vertexColors: true,
    }),
    dirt: new THREE.MeshStandardMaterial({
      name: 'EarthRim',
      map: dirtTex,
      roughness: 0.94,
      metalness: 0.0,
      vertexColors: true,
    }),
    rock: new THREE.MeshStandardMaterial({
      name: 'CornerRock',
      map: stoneTex,
      color: 0x9ca3af,
      roughness: 0.88,
      metalness: 0.05,
      vertexColors: true,
    }),
    flowerPink: new THREE.MeshStandardMaterial({
      name: 'FlowerPink',
      color: 0xf472b6,
      roughness: 0.65,
      metalness: 0.0,
    }),
    flowerCream: new THREE.MeshStandardMaterial({
      name: 'FlowerCream',
      color: 0xfef3c7,
      roughness: 0.65,
      metalness: 0.0,
    }),
    flowerYellow: new THREE.MeshStandardMaterial({
      name: 'FlowerYellow',
      color: 0xfacc15,
      roughness: 0.6,
      metalness: 0.0,
    }),
    opticWarm: new THREE.MeshStandardMaterial({
      name: 'OpticAmberGlow',
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.2,
    }),
    plasmaCyan: new THREE.MeshStandardMaterial({
      name: 'PlasmaCyanGlow',
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.3,
      roughness: 0.16,
      metalness: 0.25,
    }),
  };
}

// ---------------------------------------------------------------------------
// Geometry Sculpting Helpers (Rounded, Beveled, Merged per Material)
// ---------------------------------------------------------------------------
function ensureCleanAttributes(rawGeo, needsColor = false) {
  const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (!geo.attributes.uv) {
    const count = geo.attributes.position.count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (needsColor && !geo.attributes.color) {
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    colors.fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  geo.normalizeNormals();
  return geo;
}

function applyVerticalAO(geo, minY, maxY, bottomFactor = 0.68, topFactor = 1.04) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const span = Math.max(0.001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y - minY) / span));
    const v = bottomFactor + (topFactor - bottomFactor) * Math.pow(t, 0.72);
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function createMaterialBucket() {
  return new Map();
}

function pushToBucket(bucket, material, geometry, nameHint) {
  if (!geometry) return;
  const g = ensureCleanAttributes(geometry, Boolean(material.vertexColors));
  if (!bucket.has(material)) {
    bucket.set(material, { material, name: nameHint, geos: [] });
  }
  bucket.get(material).geos.push(g);
}

function flushBucketIntoGroup(bucket, targetGroup) {
  bucket.forEach(({ material, name, geos }) => {
    if (geos.length === 0) return;
    const rawMerged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    const merged = mergeVertices(rawMerged, 1e-4);
    merged.normalizeNormals();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    targetGroup.add(mesh);
  });
}

function createRoundedRectShape(w, h, r) {
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw * 0.45, hh * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}

function createBeveledTrapezoidBlock(bottomW, topW, height, depth, tiltAngle, bevel = 0.028) {
  const s = new THREE.Shape();
  const bw = bottomW / 2;
  const tw = topW / 2;
  const r = Math.min(bevel * 1.4, tw * 0.25);
  s.moveTo(-bw + r, 0);
  s.lineTo(bw - r, 0);
  s.quadraticCurveTo(bw, 0, bw - (bw - tw) * 0.15, r);
  s.lineTo(tw, height - r);
  s.quadraticCurveTo(tw, height, tw - r, height);
  s.lineTo(-tw + r, height);
  s.quadraticCurveTo(-tw, height, -tw, height - r);
  s.lineTo(-bw + (bw - tw) * 0.15, r);
  s.quadraticCurveTo(-bw, 0, -bw + r, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  if (tiltAngle !== 0) geo.rotateX(-tiltAngle);
  geo.computeVertexNormals();
  applyVerticalAO(geo, -0.05, height + 0.05, 0.72, 1.03);
  return geo;
}

function createBeveledOctagonPrism(radiusBottom, radiusTop, height, bevel = 0.025) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radiusBottom;
    const y = Math.sin(a) * radiusBottom;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const ratio = radiusTop / radiusBottom;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, y / Math.max(0.001, height)));
    const f = 1 + (ratio - 1) * t;
    pos.setX(i, pos.getX(i) * f);
    pos.setZ(i, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  applyVerticalAO(geo, -bevel, height + bevel, 0.74, 1.0);
  return geo;
}

function createSculptedTurfMound() {
  const grassPts = [
    new THREE.Vector2(0.0, 0.075),
    new THREE.Vector2(0.88, 0.075),
    new THREE.Vector2(1.06, 0.068),
    new THREE.Vector2(1.16, 0.05),
    new THREE.Vector2(1.18, 0.028),
    new THREE.Vector2(1.12, 0.015),
    new THREE.Vector2(0.0, 0.015),
  ];
  const grassGeo = new THREE.LatheGeometry(grassPts, 28);
  const gPos = grassGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i);
    const y = gPos.getY(i);
    const z = gPos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.75) {
      const a = Math.atan2(z, x);
      const wave = Math.sin(a * 8) * 0.055 + Math.cos(a * 5 + 0.7) * 0.035;
      const scale = (r + wave) / r;
      gPos.setX(i, x * scale);
      gPos.setZ(i, z * scale);
      if (y > 0.03) gPos.setY(i, y + Math.sin(a * 12) * 0.008);
    }
  }
  grassGeo.computeVertexNormals();
  applyVerticalAO(grassGeo, 0.01, 0.09, 0.72, 1.08);

  const dirtPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.13, 0.0),
    new THREE.Vector2(1.2, 0.016),
    new THREE.Vector2(1.16, 0.036),
    new THREE.Vector2(1.05, 0.044),
    new THREE.Vector2(0.0, 0.044),
  ];
  const dirtGeo = new THREE.LatheGeometry(dirtPts, 28);
  const dPos = dirtGeo.attributes.position;
  for (let i = 0; i < dPos.count; i++) {
    const x = dPos.getX(i);
    const z = dPos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.75) {
      const a = Math.atan2(z, x);
      const wave = Math.sin(a * 8) * 0.055 + Math.cos(a * 5 + 0.7) * 0.035;
      const scale = (r + wave) / r;
      dPos.setX(i, x * scale);
      dPos.setZ(i, z * scale);
    }
  }
  dirtGeo.computeVertexNormals();
  applyVerticalAO(dirtGeo, 0.0, 0.05, 0.7, 1.0);

  return { grassGeo, dirtGeo };
}

function createCornerBoulder(radius, seed) {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n =
      Math.sin(x * 18 + seed) * 0.14 +
      Math.cos(y * 14 - seed * 1.7) * 0.12 +
      Math.sin(z * 16 + seed * 0.6) * 0.14;
    const f = 1 + n;
    x *= f * 1.15;
    y *= f * 0.75;
    z *= f;
    if (y < -radius * 0.25) y = -radius * 0.25;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  applyVerticalAO(geo, -radius * 0.3, radius, 0.65, 1.05);
  return geo;
}

function createGrassTuftGeo(scale = 1, rotY = 0) {
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Shape();
    s.moveTo(-0.018, 0);
    s.quadraticCurveTo(-0.02, 0.06, 0.01, 0.12);
    s.quadraticCurveTo(0.022, 0.05, 0.018, 0);
    s.closePath();

    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.008,
      bevelEnabled: false,
      curveSegments: 4,
    });
    g.translate(0, 0, -0.004);
    g.rotateZ((i - 1.5) * 0.22);
    g.rotateX(0.18 + (i % 2) * 0.16);
    g.rotateY((i / 4) * Math.PI * 2 + rotY);
    g.scale(scale, scale, scale);
    g.computeVertexNormals();
    applyVerticalAO(g, 0, 0.13 * scale, 0.65, 1.15);
    blades.push(g);
  }
  return mergeGeometries(blades, false);
}

function createFlowerGeos(x, y, z, rotY) {
  const petalParts = [];
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 + rotY;
    const petal = new THREE.SphereGeometry(0.022, 6, 5);
    petal.scale(1.15, 0.45, 0.85);
    petal.rotateY(a);
    petal.translate(x + Math.cos(a) * 0.024, y + 0.01, z + Math.sin(a) * 0.024);
    petal.computeVertexNormals();
    petalParts.push(petal);
  }
  const center = new THREE.SphereGeometry(0.015, 6, 5);
  center.scale(1, 0.7, 1);
  center.translate(x, y + 0.014, z);
  center.computeVertexNormals();
  return { petals: mergeGeometries(petalParts, false), center };
}

function createSteppedBearingGeos(level, baseY) {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.57, 0.0),
    new THREE.Vector2(0.58, 0.045),
    new THREE.Vector2(0.54, 0.06),
    new THREE.Vector2(0.54, 0.105),
    new THREE.Vector2(0.565, 0.12),
    new THREE.Vector2(0.565, 0.22),
    new THREE.Vector2(0.535, 0.25),
    new THREE.Vector2(0.46, 0.255),
    new THREE.Vector2(0.0, 0.255),
  ];
  const mainGeo = new THREE.LatheGeometry(pts, 24);
  mainGeo.translate(0, baseY, 0);
  mainGeo.computeVertexNormals();
  applyVerticalAO(mainGeo, baseY, baseY + 0.26, 0.78, 1.04);

  const boltGeos = [];
  const boltCount = level >= 2 ? 12 : 8;
  for (let i = 0; i < boltCount; i++) {
    const a = (i / boltCount) * Math.PI * 2;
    const b = new THREE.CylinderGeometry(0.022, 0.025, 0.028, 6);
    b.translate(Math.cos(a) * 0.545, baseY + 0.245, Math.sin(a) * 0.545);
    boltGeos.push(b);
  }
  return { mainGeo, boltGeo: mergeGeometries(boltGeos, false) };
}

function createGunBarrelGeometry(length, radius, isLv2Plus, isLv3) {
  const rRear = radius * 1.38;
  const rMid = radius;
  const rCollar = radius * 1.24;
  const rTip = radius * 1.28;
  const rBore = radius * 0.62;

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(rRear, 0.0),
    new THREE.Vector2(rRear, length * 0.22),
    new THREE.Vector2(rMid * 1.12, length * 0.26),
    new THREE.Vector2(rMid, length * 0.28),
    new THREE.Vector2(rMid, length * 0.66),
  ];

  if (isLv2Plus) {
    pts.push(
      new THREE.Vector2(rCollar * 0.96, length * 0.68),
      new THREE.Vector2(rCollar * 0.96, length * 0.74),
      new THREE.Vector2(rMid, length * 0.76),
    );
  }

  pts.push(
    new THREE.Vector2(rMid, length * 0.8),
    new THREE.Vector2(rCollar, length * 0.82),
    new THREE.Vector2(rTip, length * 0.84),
    new THREE.Vector2(rTip, length * 0.975),
    new THREE.Vector2(rTip * 0.9, length),
    new THREE.Vector2(rBore, length),
    new THREE.Vector2(rBore, length * 0.72),
    new THREE.Vector2(0.0, length * 0.72),
  );

  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  applyVerticalAO(geo, -rRear, rRear, 0.82, 1.05);

  const boreGeo = new THREE.CylinderGeometry(rBore * 0.94, rBore * 0.94, length * 0.18, 12);
  boreGeo.rotateX(Math.PI / 2);
  boreGeo.translate(0, 0, length * 0.89);

  let plasmaGeo = null;
  if (isLv3) {
    const s = createRoundedRectShape(radius * 0.56, length * 0.42, radius * 0.16);
    plasmaGeo = new THREE.ExtrudeGeometry(s, {
      depth: radius * 0.26,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    });
    plasmaGeo.rotateX(Math.PI / 2);
    plasmaGeo.translate(0, radius * 0.94, length * 0.49);
    plasmaGeo.computeVertexNormals();
  }

  return { geo, boreGeo, plasmaGeo };
}

// ---------------------------------------------------------------------------
// Complete Gun Turret Builder (Lv.1 / Lv.2 / Lv.3)
// ---------------------------------------------------------------------------
function buildGunTurretModel(level, mats) {
  const root = new THREE.Group();
  root.name = `GunTurret_Lv${level}`;

  // =========================================================================
  // 1. BASE — Stationary Octagonal Stone Foundation + Turf + Bearing Collar
  // =========================================================================
  const baseGroup = new THREE.Group();
  baseGroup.name = 'Base';
  root.add(baseGroup);

  const baseBucket = createMaterialBucket();

  const { grassGeo, dirtGeo } = createSculptedTurfMound();
  pushToBucket(baseBucket, mats.dirt, dirtGeo, 'BaseEarthRim');
  pushToBucket(baseBucket, mats.grass, grassGeo, 'BaseGrassTurf');

  const boulderSpecs = [
    { x: -0.92, z: 0.58, r: 0.145, seed: 1.2 },
    { x: 0.92, z: 0.52, r: 0.125, seed: 2.7 },
    { x: -0.84, z: -0.68, r: 0.135, seed: 4.1 },
    { x: 0.82, z: -0.72, r: 0.15, seed: 5.5 },
  ];
  boulderSpecs.forEach((b) => {
    const g = createCornerBoulder(b.r, b.seed);
    g.translate(b.x, b.r * 0.35 + 0.04, b.z);
    pushToBucket(baseBucket, mats.rock, g, 'BaseBoulders');
  });

  const tuftCoords = [
    [-0.65, 0.88, 1.0],
    [0.64, 0.88, 0.95],
    [-0.98, 0.25, 0.9],
    [0.98, 0.22, 1.05],
    [-0.45, 0.97, 0.85],
    [0.42, 0.98, 0.9],
    [-0.78, -0.82, 0.95],
    [0.78, -0.8, 0.9],
  ];
  tuftCoords.forEach(([x, z, s], idx) => {
    const tuft = createGrassTuftGeo(s, idx * 1.1);
    tuft.translate(x, 0.062, z);
    pushToBucket(baseBucket, mats.grass, tuft, 'BaseGrassTurf');
  });

  const flowerSpecs = [
    { x: -0.28, z: 1.02, mat: mats.flowerPink },
    { x: -0.1, z: 1.05, mat: mats.flowerCream },
    { x: 0.16, z: 1.04, mat: mats.flowerCream },
    { x: 0.34, z: 1.0, mat: mats.flowerPink },
    { x: -0.56, z: 0.9, mat: mats.flowerYellow },
    { x: 0.56, z: 0.9, mat: mats.flowerYellow },
  ];
  flowerSpecs.forEach((fl, idx) => {
    const { petals, center } = createFlowerGeos(fl.x, 0.072, fl.z, idx * 0.9);
    const name =
      fl.mat === mats.flowerPink
        ? 'BaseFlowersPink'
        : fl.mat === mats.flowerCream
          ? 'BaseFlowersCream'
          : 'BaseFlowersYellow';
    pushToBucket(baseBucket, fl.mat, petals, name);
    pushToBucket(baseBucket, mats.flowerYellow, center, 'BaseFlowersYellow');
  });

  // Mortar cores
  const lowerMortar = createBeveledOctagonPrism(0.86, 0.69, 0.36, 0.02);
  lowerMortar.translate(0, 0.05, 0);
  pushToBucket(baseBucket, mats.stoneDark, lowerMortar, 'BaseMortarCore');

  const upperMortar = createBeveledOctagonPrism(0.67, 0.56, 0.24, 0.02);
  upperMortar.translate(0, 0.41, 0);
  pushToBucket(baseBucket, mats.stoneDark, upperMortar, 'BaseMortarCore');

  // Lower tier: 8 beveled trapezoidal stone blocks + rivets
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const block = createBeveledTrapezoidBlock(0.56, 0.45, 0.37, 0.22, 0.28, 0.028);
    block.translate(0, 0.055, 0.78);
    block.rotateY(angle);
    pushToBucket(baseBucket, mats.stone, block, 'BaseStoneBlocks');

    [-0.14, 0.14].forEach((bx) => {
      const bolt = new THREE.CylinderGeometry(0.02, 0.024, 0.03, 6);
      bolt.rotateX(Math.PI / 2 - 0.28);
      bolt.translate(bx, 0.35, 0.8);
      bolt.rotateY(angle);
      pushToBucket(baseBucket, mats.rivetSteel, bolt, 'BaseRivets');
    });
  }

  // Upper tier: 8 beveled trapezoidal blocks (with orange accent blocks matching reference)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const block = createBeveledTrapezoidBlock(0.45, 0.38, 0.22, 0.18, 0.24, 0.024);
    block.translate(0, 0.415, 0.62);
    block.rotateY(angle);

    const isOrangeAccent = level === 1 ? i === 0 || i === 1 : i === 0 || i === 1 || i === 7;
    if (isOrangeAccent) {
      pushToBucket(baseBucket, mats.orangeArmor, block, 'BaseOrangeAccents');
    } else {
      pushToBucket(baseBucket, mats.stone, block, 'BaseStoneBlocks');
    }

    [-0.11, 0.11].forEach((bx) => {
      const bolt = new THREE.CylinderGeometry(0.017, 0.02, 0.026, 6);
      bolt.rotateX(Math.PI / 2 - 0.24);
      bolt.translate(bx, 0.58, 0.66);
      bolt.rotateY(angle);
      pushToBucket(baseBucket, mats.rivetSteel, bolt, 'BaseRivets');
    });
  }

  // Metallic turret bearing collar
  const bearingBaseY = 0.63;
  const collarTopY = bearingBaseY + 0.255; // 0.885
  const { mainGeo: bearingGeo, boltGeo: bearingBoltGeo } = createSteppedBearingGeos(level, bearingBaseY);
  pushToBucket(baseBucket, mats.gunmetal, bearingGeo, 'BaseBearingSteel');
  pushToBucket(baseBucket, mats.rivetSteel, bearingBoltGeo, 'BaseRivets');

  // Level 2 & 3 Foundation Buttresses
  if (level >= 2) {
    const sideAngles =
      level === 2
        ? [Math.PI / 2, -Math.PI / 2]
        : [Math.PI / 2, -Math.PI / 2, Math.PI * 0.16, -Math.PI * 0.16];

    sideAngles.forEach((ang, idx) => {
      const isMainFlank = idx < 2;
      const bracketW = isMainFlank ? 0.34 : 0.22;
      const bracketH = isMainFlank ? 0.44 : 0.34;
      const bracketD = isMainFlank ? 0.22 : 0.16;

      const sBracket = createBeveledTrapezoidBlock(bracketW, bracketW * 0.72, bracketH, bracketD, 0.34, 0.022);
      sBracket.translate(0, 0.12, 0.83);
      sBracket.rotateY(ang);
      pushToBucket(baseBucket, mats.gunmetal, sBracket, 'BaseBearingSteel');

      const trimPlate = createBeveledTrapezoidBlock(
        bracketW * 0.78,
        bracketW * 0.56,
        bracketH * 0.55,
        0.07,
        0.34,
        0.015,
      );
      trimPlate.translate(0, 0.21, 0.92);
      trimPlate.rotateY(ang);
      pushToBucket(
        baseBucket,
        level === 3 ? mats.goldTrim : mats.orangeArmor,
        trimPlate,
        level === 3 ? 'BaseGoldTrim' : 'BaseOrangeAccents',
      );

      if (level === 3) {
        const coreShape = createRoundedRectShape(bracketW * 0.32, bracketH * 0.58, 0.02);
        const coreGeo = new THREE.ExtrudeGeometry(coreShape, {
          depth: 0.06,
          bevelEnabled: true,
          bevelThickness: 0.01,
          bevelSize: 0.01,
          bevelSegments: 2,
        });
        coreGeo.translate(0, 0, -0.03);
        coreGeo.rotateX(-0.34);
        coreGeo.translate(0, 0.34, 0.91);
        coreGeo.rotateY(ang);
        coreGeo.computeVertexNormals();
        pushToBucket(baseBucket, mats.plasmaCyan, coreGeo, 'BaseEnergyCaps');
      }
    });
  }

  flushBucketIntoGroup(baseBucket, baseGroup);

  // =========================================================================
  // 2. TURRET — Rotating Armored Weapon Assembly (barrels facing +Z)
  // =========================================================================
  const turretPivotY = collarTopY - 0.015; // 0.87
  const turretGroup = new THREE.Group();
  turretGroup.name = 'Turret';
  turretGroup.position.set(0, turretPivotY, 0);
  root.add(turretGroup);

  const turretBucket = createMaterialBucket();

  // Swivel neck
  const neckGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.12, 20);
  neckGeo.translate(0, 0.04, 0);
  applyVerticalAO(neckGeo, -0.02, 0.1, 0.72, 1.0);
  pushToBucket(turretBucket, mats.gunmetal, neckGeo, 'TurretArmoredBody');

  // Main Sculpted Gun Housing
  const housingWidth = level === 1 ? 0.68 : level === 2 ? 0.74 : 0.78;
  const sideSilhouette = new THREE.Shape();
  sideSilhouette.moveTo(-0.56, 0.04);
  sideSilhouette.lineTo(0.46, 0.04);
  sideSilhouette.quadraticCurveTo(0.56, 0.04, 0.56, 0.14);
  sideSilhouette.lineTo(0.54, 0.48);
  sideSilhouette.quadraticCurveTo(0.52, 0.6, 0.36, 0.62);
  sideSilhouette.lineTo(-0.44, 0.62);
  sideSilhouette.quadraticCurveTo(-0.58, 0.6, -0.62, 0.42);
  sideSilhouette.lineTo(-0.62, 0.16);
  sideSilhouette.quadraticCurveTo(-0.62, 0.04, -0.56, 0.04);
  sideSilhouette.closePath();

  const housingGeo = new THREE.ExtrudeGeometry(sideSilhouette, {
    depth: housingWidth,
    bevelEnabled: true,
    bevelThickness: 0.065,
    bevelSize: 0.055,
    bevelSegments: 2,
    curveSegments: 6,
  });
  housingGeo.translate(0, 0, -housingWidth / 2);
  housingGeo.rotateY(-Math.PI / 2);
  housingGeo.computeVertexNormals();
  applyVerticalAO(housingGeo, 0.0, 0.68, 0.78, 1.05);
  pushToBucket(turretBucket, mats.gunmetal, housingGeo, 'TurretArmoredBody');

  // Upper Armored Roof Carapace
  const roofShape = createRoundedRectShape(housingWidth * 0.72, 0.76, 0.08);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 6,
  });
  roofGeo.rotateX(Math.PI / 2);
  roofGeo.translate(0, 0.695, -0.05);
  roofGeo.computeVertexNormals();
  applyVerticalAO(roofGeo, 0.62, 0.74, 0.88, 1.06);
  pushToBucket(turretBucket, mats.gunmetal, roofGeo, 'TurretArmoredBody');

  // Roof corner rivets
  const rw = housingWidth * 0.28;
  [
    [-rw, 0.24],
    [rw, 0.24],
    [-rw, -0.34],
    [rw, -0.34],
  ].forEach(([rx, rz]) => {
    const r = new THREE.CylinderGeometry(0.02, 0.023, 0.022, 6);
    r.translate(rx, 0.72, rz);
    pushToBucket(turretBucket, mats.rivetSteel, r, 'TurretRivets');
  });

  // Front Orange Cowl / Mantle (+Z)
  const cowlShape = createRoundedRectShape(housingWidth * 0.88, 0.44, 0.09);
  const cowlGeo = new THREE.ExtrudeGeometry(cowlShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 6,
  });
  cowlGeo.translate(0, 0.33, 0.48);
  cowlGeo.computeVertexNormals();
  applyVerticalAO(cowlGeo, 0.06, 0.6, 0.82, 1.06);
  pushToBucket(turretBucket, mats.orangeArmor, cowlGeo, 'TurretOrangeArmor');

  // Inner dark recessed barrel cradle
  const cradleShape = createRoundedRectShape(housingWidth * 0.62, 0.34, 0.06);
  const cradleGeo = new THREE.ExtrudeGeometry(cradleShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 2,
    curveSegments: 6,
  });
  cradleGeo.translate(0, 0.33, 0.54);
  cradleGeo.computeVertexNormals();
  applyVerticalAO(cradleGeo, 0.14, 0.52, 0.76, 1.0);
  pushToBucket(turretBucket, mats.stoneDark, cradleGeo, 'TurretCradleDark');

  // Rear Orange Bustle Armor Plate (-Z)
  const rearPlateShape = createRoundedRectShape(housingWidth * 0.56, 0.24, 0.05);
  const rearPlateGeo = new THREE.ExtrudeGeometry(rearPlateShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 6,
  });
  rearPlateGeo.translate(0, 0.35, -0.66);
  rearPlateGeo.computeVertexNormals();
  applyVerticalAO(rearPlateGeo, 0.2, 0.5, 0.82, 1.05);
  pushToBucket(turretBucket, mats.orangeArmor, rearPlateGeo, 'TurretOrangeArmor');

  // Left & Right Beveled Cheek Armor Pods
  const podDepthX = level === 1 ? 0.11 : level === 2 ? 0.15 : 0.17;
  const podLenZ = level === 1 ? 0.58 : level === 2 ? 0.68 : 0.74;
  const podH = level === 1 ? 0.24 : level === 2 ? 0.28 : 0.31;
  const sideOffsetX = housingWidth / 2 + 0.045;

  [-1, 1].forEach((side) => {
    const backShape = createRoundedRectShape(podLenZ * 1.12, podH * 1.24, 0.05);
    const backGeo = new THREE.ExtrudeGeometry(backShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 6,
    });
    backGeo.translate(0, 0, -0.035);
    backGeo.rotateY((side * Math.PI) / 2);
    backGeo.translate(side * sideOffsetX, 0.33, -0.04);
    backGeo.computeVertexNormals();
    applyVerticalAO(backGeo, 0.14, 0.52, 0.8, 1.04);
    pushToBucket(turretBucket, mats.gunmetal, backGeo, 'TurretArmoredBody');

    const podShape = createRoundedRectShape(podLenZ, podH, 0.055);
    const podGeo = new THREE.ExtrudeGeometry(podShape, {
      depth: podDepthX,
      bevelEnabled: true,
      bevelThickness: 0.026,
      bevelSize: 0.024,
      bevelSegments: 2,
      curveSegments: 6,
    });
    podGeo.translate(0, 0, -podDepthX / 2);
    podGeo.rotateY((side * Math.PI) / 2);
    podGeo.translate(side * (sideOffsetX + podDepthX * 0.45), 0.33, -0.02);
    podGeo.computeVertexNormals();
    applyVerticalAO(podGeo, 0.16, 0.5, 0.82, 1.06);
    pushToBucket(turretBucket, mats.orangeArmor, podGeo, 'TurretOrangeArmor');

    [-podLenZ * 0.34, podLenZ * 0.34].forEach((rz) => {
      const r = new THREE.CylinderGeometry(0.017, 0.02, 0.022, 6);
      r.rotateZ(Math.PI / 2);
      r.translate(side * (sideOffsetX + podDepthX + 0.015), 0.33, rz - 0.02);
      pushToBucket(turretBucket, mats.rivetSteel, r, 'TurretRivets');
    });

    if (level >= 2) {
      const extShape = createRoundedRectShape(podLenZ * 0.48, podH * 0.72, 0.04);
      const extGeo = new THREE.ExtrudeGeometry(extShape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.018,
        bevelSegments: 2,
        curveSegments: 6,
      });
      extGeo.translate(0, 0, -0.04);
      extGeo.rotateY((side * Math.PI) / 2);
      extGeo.translate(side * (sideOffsetX + podDepthX + 0.02), 0.35, -0.24);
      extGeo.computeVertexNormals();
      applyVerticalAO(extGeo, 0.2, 0.5, 0.82, 1.05);
      pushToBucket(turretBucket, mats.orangeArmor, extGeo, 'TurretOrangeArmor');
    }

    if (level === 3) {
      const cellShape = createRoundedRectShape(0.16, 0.14, 0.03);
      const cellGeo = new THREE.ExtrudeGeometry(cellShape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
        curveSegments: 5,
      });
      cellGeo.translate(0, 0, -0.03);
      cellGeo.rotateY((side * Math.PI) / 2);
      cellGeo.translate(side * (sideOffsetX + podDepthX + 0.065), 0.35, -0.24);
      cellGeo.computeVertexNormals();
      pushToBucket(turretBucket, mats.plasmaCyan, cellGeo, 'TurretEnergyCells');
    }
  });

  // Lv.2 & Lv.3 Top Optic Crest
  if (level >= 2) {
    const crestShape = createRoundedRectShape(0.32, 0.44, 0.04);
    const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.022,
      bevelSegments: 2,
      curveSegments: 6,
    });
    crestGeo.rotateX(Math.PI / 2);
    crestGeo.translate(0, 0.81, -0.02);
    crestGeo.computeVertexNormals();
    applyVerticalAO(crestGeo, 0.68, 0.84, 0.85, 1.05);
    pushToBucket(
      turretBucket,
      level === 3 ? mats.orangeArmor : mats.gunmetal,
      crestGeo,
      level === 3 ? 'TurretOrangeArmor' : 'TurretArmoredBody',
    );

    [-0.17, 0.17].forEach((rx) => {
      const railGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.06, 0.38, 0.015), {
        depth: 0.07,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 2,
        curveSegments: 5,
      });
      railGeo.rotateX(Math.PI / 2);
      railGeo.translate(rx, 0.78, -0.02);
      railGeo.computeVertexNormals();
      applyVerticalAO(railGeo, 0.69, 0.8, 0.85, 1.05);
      pushToBucket(
        turretBucket,
        level === 3 ? mats.gunmetal : mats.orangeArmor,
        railGeo,
        level === 3 ? 'TurretArmoredBody' : 'TurretOrangeArmor',
      );
    });

    const opticGeo = new THREE.ExtrudeGeometry(createRoundedRectShape(0.16, 0.06, 0.015), {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 5,
    });
    opticGeo.translate(0, 0.76, 0.2);
    opticGeo.computeVertexNormals();
    pushToBucket(
      turretBucket,
      level === 3 ? mats.plasmaCyan : mats.opticWarm,
      opticGeo,
      level === 3 ? 'TurretEnergyCells' : 'TurretOpticGlow',
    );
  }

  flushBucketIntoGroup(turretBucket, turretGroup);

  // =========================================================================
  // Quad 2x2 Barrel Assembly (`QuadBarrels` — recoils cleanly inside Turret!)
  // =========================================================================
  const quadBarrels = new THREE.Group();
  quadBarrels.name = 'QuadBarrels';
  const barrelCenterY = 0.34;
  const barrelMountZ = 0.52;
  quadBarrels.position.set(0, barrelCenterY, barrelMountZ);
  turretGroup.add(quadBarrels);

  const barrelLength = level === 1 ? 0.72 : level === 2 ? 0.82 : 0.9;
  const barrelRadius = level === 1 ? 0.062 : level === 2 ? 0.067 : 0.072;
  const spacingX = level === 1 ? 0.115 : 0.125;
  const spacingY = level === 1 ? 0.105 : 0.115;

  const { geo: bGeo, boreGeo: bBoreGeo, plasmaGeo: bPlasmaGeo } = createGunBarrelGeometry(
    barrelLength,
    barrelRadius,
    level >= 2,
    level === 3,
  );

  const barrelBucket = createMaterialBucket();
  const offsets = [
    [-spacingX, spacingY],
    [spacingX, spacingY],
    [-spacingX, -spacingY],
    [spacingX, -spacingY],
  ];

  offsets.forEach(([ox, oy]) => {
    const g = bGeo.clone();
    g.translate(ox, oy, 0);
    pushToBucket(barrelBucket, mats.barrelSteel, g, 'BarrelTubes');

    const bg = bBoreGeo.clone();
    bg.translate(ox, oy, 0);
    pushToBucket(barrelBucket, mats.boreDark, bg, 'BarrelBores');

    if (bPlasmaGeo) {
      const pg = bPlasmaGeo.clone();
      pg.translate(ox, oy, 0);
      pushToBucket(barrelBucket, mats.plasmaCyan, pg, 'BarrelPlasmaCoils');
    }
  });

  const clampShape = createRoundedRectShape(
    spacingX * 2 + barrelRadius * 2.1,
    spacingY * 2 + barrelRadius * 2.1,
    0.045,
  );
  const clampGeo = new THREE.ExtrudeGeometry(clampShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
    curveSegments: 6,
  });
  clampGeo.translate(0, 0, barrelLength * 0.22);
  clampGeo.computeVertexNormals();
  applyVerticalAO(clampGeo, -0.25, 0.25, 0.82, 1.04);
  pushToBucket(barrelBucket, mats.gunmetal, clampGeo, 'BarrelStabilizerClamp');

  flushBucketIntoGroup(barrelBucket, quadBarrels);

  // =========================================================================
  // 3. MUZZLE — Projectile emission point at tip of the quad barrels (+Z)
  // =========================================================================
  const muzzle = new THREE.Object3D();
  muzzle.name = 'Muzzle';
  muzzle.position.set(0, barrelCenterY, barrelMountZ + barrelLength + 0.04);
  turretGroup.add(muzzle);

  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return root;
}

// ---------------------------------------------------------------------------
// Export GLB & Report Stats
// ---------------------------------------------------------------------------
async function exportModelToGlb(sceneOrGroup, outPath) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(sceneOrGroup, {
    binary: true,
    onlyVisible: true,
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
  return arrayBuffer.byteLength;
}

async function main() {
  installNodeExportPolyfills();
  const mats = createMaterialLibrary();
  const outDir = path.resolve(process.cwd(), 'public/assets/models/towers');

  for (const level of [1, 2, 3]) {
    const model = buildGunTurretModel(level, mats);
    const scene = new THREE.Scene();
    scene.add(model);

    let meshCount = 0;
    let triCount = 0;
    model.traverse((o) => {
      if (o.isMesh) {
        meshCount += 1;
        const idx = o.geometry.index;
        triCount += idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
      }
    });

    const outPath = path.join(outDir, `gun_turret_l${level}.glb`);
    const bytes = await exportModelToGlb(scene, outPath);
    console.log(
      `[OK] Exported ${path.relative(process.cwd(), outPath)} (${(bytes / 1024).toFixed(1)} KB, ${meshCount} draw calls, ${Math.round(triCount)} triangles)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
