import * as THREE from 'three';

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  anisotropy = 4,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function configureDataTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  anisotropy = 4,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTextures {
  grassMap: THREE.Texture;
  grassBump: THREE.Texture;
  dirtMap: THREE.Texture;
  dirtBump: THREE.Texture;
  stoneMap: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  roofTileMap: THREE.CanvasTexture;
  roofTileBump: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  burlapMap: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.min(maxAnisotropy || 4, 8);

  const loadTile = (name: string, x: number, y: number) => {
    const texture = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'assets/citadel/' + name + '.webp');
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(x, y);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = aniso;
    return texture;
  };
  const grassMap = loadTile('meadow', 27, 27);
  const dirtMap = loadTile('cartway', 21, .45);
  const grassBump = grassMap;
  const dirtBump = dirtMap;

  // 3. Carved Stone Masonry
  const [sCanvas, sCtx] = createCanvas(512, 512);
  sCtx.fillStyle = '#6f6c66';
  sCtx.fillRect(0, 0, 512, 512);
  const [sbCanvas, sbCtx] = createCanvas(512, 512);
  sbCtx.fillStyle = '#303030';
  sbCtx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const bh = 512 / rows;
  const bw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * bw + offset + 3;
      const by = r * bh + 3;
      const w = bw - 6;
      const h = bh - 6;
      const tone = 138 + Math.floor(Math.random() * 34);
      const warm = Math.floor(Math.random() * 10);
      sCtx.fillStyle = `rgb(${tone + warm}, ${tone + Math.floor(warm * 0.5)}, ${tone - 6})`;
      sCtx.fillRect(bx, by, w, h);
      sCtx.strokeStyle = 'rgba(240, 235, 225, 0.25)';
      sCtx.lineWidth = 2;
      sCtx.strokeRect(bx + 1, by + 1, w - 2, h - 2);

      sbCtx.fillStyle = `rgb(${165 + Math.floor(Math.random() * 55)}, ${165 + Math.floor(Math.random() * 55)}, ${165 + Math.floor(Math.random() * 55)})`;
      sbCtx.fillRect(bx, by, w, h);
    }
  }
  const stoneMap = configureColorTexture(sCanvas, 2, 2, aniso);
  const stoneBump = configureDataTexture(sbCanvas, 2, 2, aniso);

  // 4. Red Terracotta Roof Shingles
  const [rCanvas, rCtx] = createCanvas(512, 512);
  rCtx.fillStyle = '#8b2f21';
  rCtx.fillRect(0, 0, 512, 512);
  const [rbCanvas, rbCtx] = createCanvas(512, 512);
  rbCtx.fillStyle = '#404040';
  rbCtx.fillRect(0, 0, 512, 512);

  const tRows = 10;
  const tCols = 8;
  const th = 512 / tRows;
  const tw = 512 / tCols;
  for (let r = 0; r < tRows; r++) {
    const off = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= tCols; c++) {
      const tx = c * tw + off;
      const ty = r * th;
      const red = 182 + Math.floor(Math.random() * 38);
      const grn = 60 + Math.floor(Math.random() * 24);
      const blu = 38 + Math.floor(Math.random() * 18);
      rCtx.fillStyle = `rgb(${red}, ${grn}, ${blu})`;
      rCtx.beginPath();
      rCtx.roundRect(tx + 2, ty + 2, tw - 4, th - 3, [4, 4, 14, 14]);
      rCtx.fill();

      rCtx.fillStyle = 'rgba(255, 195, 140, 0.16)';
      rCtx.fillRect(tx + 5, ty + 4, tw - 10, 6);

      rbCtx.fillStyle = '#c8c8c8';
      rbCtx.beginPath();
      rbCtx.roundRect(tx + 2, ty + 2, tw - 4, th - 3, [4, 4, 14, 14]);
      rbCtx.fill();
    }
  }
  const roofTileMap = configureColorTexture(rCanvas, 2, 2, aniso);
  const roofTileBump = configureDataTexture(rbCanvas, 2, 2, aniso);

  // 5. Timber Wood Planks
  const [wCanvas, wCtx] = createCanvas(512, 512);
  wCtx.fillStyle = '#7c4c27';
  wCtx.fillRect(0, 0, 512, 512);
  for (let p = 0; p < 6; p++) {
    const py = p * (512 / 6);
    const ph = 512 / 6;
    const tone = Math.floor(Math.random() * 24) - 12;
    wCtx.fillStyle = `rgb(${138 + tone}, ${86 + Math.floor(tone * 0.7)}, ${46 + Math.floor(tone * 0.4)})`;
    wCtx.fillRect(0, py + 2, 512, ph - 4);
    for (let g = 0; g < 18; g++) {
      wCtx.strokeStyle = 'rgba(65, 34, 14, 0.22)';
      wCtx.lineWidth = 1.5;
      wCtx.beginPath();
      const gy = py + 5 + Math.random() * (ph - 10);
      wCtx.moveTo(0, gy);
      wCtx.bezierCurveTo(170, gy + (Math.random() - 0.5) * 8, 340, gy + (Math.random() - 0.5) * 8, 512, gy);
      wCtx.stroke();
    }
  }
  const woodMap = configureColorTexture(wCanvas, 1, 1, aniso);

  // 6. Sandbag Burlap Weave
  const [bCanvas, bCtx] = createCanvas(256, 256);
  bCtx.fillStyle = '#c8aa74';
  bCtx.fillRect(0, 0, 256, 256);
  bCtx.strokeStyle = 'rgba(130, 102, 58, 0.25)';
  bCtx.lineWidth = 1.5;
  for (let i = 0; i < 256; i += 6) {
    bCtx.beginPath();
    bCtx.moveTo(i, 0);
    bCtx.lineTo(i, 256);
    bCtx.stroke();
    bCtx.beginPath();
    bCtx.moveTo(0, i);
    bCtx.lineTo(256, i);
    bCtx.stroke();
  }
  const burlapMap = configureColorTexture(bCanvas, 2, 2, aniso);

  // 7. Flowing Water Ripple Texture
  const [waCanvas, waCtx] = createCanvas(256, 256);
  waCtx.fillStyle = '#4097c9';
  waCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 18 + Math.random() * 40;
    waCtx.strokeStyle = Math.random() > 0.35 ? 'rgba(215, 246, 255, 0.42)' : 'rgba(24, 96, 152, 0.38)';
    waCtx.lineWidth = 2 + Math.random() * 2;
    waCtx.beginPath();
    waCtx.moveTo(x, y);
    waCtx.quadraticCurveTo(x + len * 0.5, y + (Math.random() - 0.5) * 10, x + len, y);
    waCtx.stroke();
  }
  const waterNormal = configureColorTexture(waCanvas, 5, 1.5, aniso);

  // 8. Soft Radial Contact Shadow
  const [csCanvas, csCtx] = createCanvas(128, 128);
  const rad = csCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  rad.addColorStop(0, 'rgba(15, 22, 12, 0.58)');
  rad.addColorStop(0.55, 'rgba(15, 22, 12, 0.25)');
  rad.addColorStop(1, 'rgba(15, 22, 12, 0)');
  csCtx.fillStyle = rad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(csCanvas);
  contactShadow.needsUpdate = true;

  return {
    grassMap,
    grassBump,
    dirtMap,
    dirtBump,
    stoneMap,
    stoneBump,
    roofTileMap,
    roofTileBump,
    woodMap,
    burlapMap,
    waterNormal,
    contactShadow,
    dispose: () => {
      grassMap.dispose();
      dirtMap.dispose();
      stoneMap.dispose();
      stoneBump.dispose();
      roofTileMap.dispose();
      roofTileBump.dispose();
      woodMap.dispose();
      burlapMap.dispose();
      waterNormal.dispose();
      contactShadow.dispose();
    },
  };
}
