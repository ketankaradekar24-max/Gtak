import * as THREE from 'three';

export interface TextureBundle {
  asphalt: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  vidhanaGranite: THREE.CanvasTexture;
  commercialFacade: THREE.CanvasTexture;
  itGlassFacade: THREE.CanvasTexture;
  residentialFacade: THREE.CanvasTexture;
  marketAwning: THREE.CanvasTexture;
  metroConcrete: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): TextureBundle {
  const all: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    all.push(t);
    return t;
  };

  // 1. Indian Asphalt Road Texture
  const [roadC, roadCtx] = makeCanvas(512, 512);
  roadCtx.fillStyle = '#262930';
  roadCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 30 + Math.floor(Math.random() * 26);
    roadCtx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    roadCtx.fillRect(x, y, 2, 2);
  }
  // Yellow median double line & dashed lane markers
  roadCtx.fillStyle = '#eab308';
  roadCtx.fillRect(250, 0, 4, 512);
  roadCtx.fillRect(258, 0, 4, 512);
  roadCtx.fillStyle = '#e2e8f0';
  for (let y = 16; y < 512; y += 64) {
    roadCtx.fillRect(126, y, 4, 32);
    roadCtx.fillRect(382, y, 4, 32);
  }
  // Edge lines
  roadCtx.fillStyle = 'rgba(241,245,249,0.65)';
  roadCtx.fillRect(14, 0, 4, 512);
  roadCtx.fillRect(494, 0, 4, 512);
  const asphalt = track(finalizeTexture(roadC, maxAnisotropy, 1, 1, true));

  // 2. Cubbon / Lalbagh Lush Grass
  const [grassC, grassCtx] = makeCanvas(512, 512);
  grassCtx.fillStyle = '#2d4c2b';
  grassCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 58 + Math.floor(Math.random() * 44);
    grassCtx.fillStyle = `rgb(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.45)})`;
    grassCtx.fillRect(x, y, 3, 3);
  }
  const grass = track(finalizeTexture(grassC, maxAnisotropy, 40, 40, true));

  // 3. Bengaluru Concrete & Granite Sidewalk
  const [sideC, sideCtx] = makeCanvas(256, 256);
  sideCtx.fillStyle = '#6b7078';
  sideCtx.fillRect(0, 0, 256, 256);
  sideCtx.strokeStyle = '#525760';
  sideCtx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    sideCtx.beginPath();
    sideCtx.moveTo(x, 0);
    sideCtx.lineTo(x, 256);
    sideCtx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    sideCtx.beginPath();
    sideCtx.moveTo(0, y);
    sideCtx.lineTo(256, y);
    sideCtx.stroke();
  }
  const sidewalk = track(finalizeTexture(sideC, maxAnisotropy, 2, 2, true));

  // 4. Vidhana Soudha Neo-Dravidian Granite Facade
  const [vidC, vidCtx] = makeCanvas(512, 512);
  vidCtx.fillStyle = '#c8b49a';
  vidCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    vidCtx.fillStyle = y % 64 === 0 ? 'rgba(130, 95, 65, 0.25)' : 'rgba(255,255,255,0.12)';
    vidCtx.fillRect(0, y, 512, 4);
  }
  for (let x = 24; x < 512; x += 64) {
    vidCtx.fillStyle = '#a89074';
    vidCtx.fillRect(x, 40, 24, 430);
    vidCtx.fillStyle = '#332b24';
    vidCtx.fillRect(x + 30, 80, 22, 110);
    vidCtx.fillRect(x + 30, 240, 22, 130);
  }
  const vidhanaGranite = track(finalizeTexture(vidC, maxAnisotropy, 2, 1, true));

  // 5. MG Road / Brigade Commercial Storefront Facade
  const [comC, comCtx] = makeCanvas(512, 512);
  comCtx.fillStyle = '#3b4252';
  comCtx.fillRect(0, 0, 512, 512);
  // Upper office/shop windows
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const wx = 20 + col * 82;
      const wy = 24 + row * 95;
      comCtx.fillStyle = (row + col) % 3 === 0 ? '#fde68a' : '#1e293b';
      comCtx.fillRect(wx, wy, 56, 60);
      comCtx.strokeStyle = '#64748b';
      comCtx.lineWidth = 3;
      comCtx.strokeRect(wx, wy, 56, 60);
    }
  }
  // Ground floor Kannada & English signage strip
  comCtx.fillStyle = '#111827';
  comCtx.fillRect(0, 410, 512, 102);
  comCtx.fillStyle = '#f59e0b';
  comCtx.fillRect(16, 418, 220, 44);
  comCtx.fillStyle = '#0f172a';
  comCtx.font = 'bold 22px sans-serif';
  comCtx.fillText('NAMMA DARSHINI', 26, 448);
  comCtx.fillStyle = '#06b6d4';
  comCtx.fillRect(256, 418, 240, 44);
  comCtx.fillStyle = '#0f172a';
  comCtx.fillText('MYSORE SILKS · CAFE', 266, 448);
  const commercialFacade = track(finalizeTexture(comC, maxAnisotropy, 1, 1, true));

  // 6. Electronic City / Whitefield IT Park Glass Curtain Wall
  const [itC, itCtx] = makeCanvas(512, 512);
  itCtx.fillStyle = '#1e3a5f';
  itCtx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const gx = col * 64 + 4;
      const gy = row * 64 + 4;
      const lit = (row * 5 + col * 3) % 7 === 0;
      itCtx.fillStyle = lit ? '#7dd3fc' : '#2b5876';
      itCtx.fillRect(gx, gy, 56, 56);
      itCtx.fillStyle = 'rgba(255,255,255,0.14)';
      itCtx.fillRect(gx, gy, 56, 12);
    }
  }
  const itGlassFacade = track(finalizeTexture(itC, maxAnisotropy, 1, 2, true));

  // 7. Indiranagar / Koramangala Residential & Apartment Facade
  const [resC, resCtx] = makeCanvas(512, 512);
  resCtx.fillStyle = '#d6ccc2';
  resCtx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 5; row++) {
    resCtx.fillStyle = '#b08968';
    resCtx.fillRect(0, row * 102 + 86, 512, 16);
    for (let col = 0; col < 4; col++) {
      const rx = 22 + col * 124;
      const ry = 18 + row * 102;
      resCtx.fillStyle = '#293241';
      resCtx.fillRect(rx, ry, 80, 54);
      resCtx.fillStyle = '#4a5568';
      resCtx.fillRect(rx - 6, ry + 54, 92, 12);
    }
  }
  const residentialFacade = track(finalizeTexture(resC, maxAnisotropy, 1, 1, true));

  // 8. KR Market Vibrant Canopy Stripes
  const [mktC, mktCtx] = makeCanvas(256, 256);
  const stripes = ['#ea580c', '#facc15', '#16a34a', '#2563eb'];
  for (let i = 0; i < 8; i++) {
    mktCtx.fillStyle = stripes[i % stripes.length];
    mktCtx.fillRect(i * 32, 0, 32, 256);
  }
  const marketAwning = track(finalizeTexture(mktC, maxAnisotropy, 2, 1, true));

  // 9. Namma Metro Concrete Pier & Purple Line Accent
  const [metC, metCtx] = makeCanvas(256, 256);
  metCtx.fillStyle = '#9ca3af';
  metCtx.fillRect(0, 0, 256, 256);
  metCtx.fillStyle = '#7e22ce';
  metCtx.fillRect(0, 108, 256, 36);
  metCtx.fillStyle = '#e5e7eb';
  metCtx.fillRect(0, 144, 256, 8);
  const metroConcrete = track(finalizeTexture(metC, maxAnisotropy, 4, 1, true));

  // 10. Soft Radial Contact Shadow
  const [shC, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = track(finalizeTexture(shC, 1, 1, 1, true));
  contactShadow.wrapS = THREE.ClampToEdgeWrapping;
  contactShadow.wrapT = THREE.ClampToEdgeWrapping;

  return {
    asphalt,
    grass,
    sidewalk,
    vidhanaGranite,
    commercialFacade,
    itGlassFacade,
    residentialFacade,
    marketAwning,
    metroConcrete,
    contactShadow,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
