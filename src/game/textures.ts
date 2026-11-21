import * as THREE from 'three';

export interface SkinMaps {
  albedo: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  dispose: () => void;
}

export interface TextureBundle {
  asphalt: THREE.CanvasTexture;
  asphaltHighway: THREE.CanvasTexture;
  asphaltSecondary: THREE.CanvasTexture;
  asphaltJunction: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  terrainDetail: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  vidhanaGranite: THREE.CanvasTexture;
  commercialFacade: THREE.CanvasTexture;
  itGlassFacade: THREE.CanvasTexture;
  residentialFacade: THREE.CanvasTexture;
  marketAwning: THREE.CanvasTexture;
  metroConcrete: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  darshiniSign: THREE.CanvasTexture;
  metroSign: THREE.CanvasTexture;
  nammaMartSign: THREE.CanvasTexture;
  armorySign: THREE.CanvasTexture;
  villaSign: THREE.CanvasTexture;
  kannadaRoadSign: THREE.CanvasTexture;
  silkBoardGantry: THREE.CanvasTexture;
  denimFabric: THREE.CanvasTexture;
  cottonFabric: THREE.CanvasTexture;
  silkSareeFabric: THREE.CanvasTexture;
  suitWoolFabric: THREE.CanvasTexture;
  streetShirtFabric: THREE.CanvasTexture;
  hairStrandTexture: THREE.CanvasTexture;
  createSkinTexture: (
    baseHex: string,
    ageGroup: 'young' | 'middle' | 'elder',
    seed: number,
    hasStubbleShade?: boolean
  ) => THREE.CanvasTexture;
  createSkinMaps: (
    baseHex: string,
    ageGroup: 'young' | 'middle' | 'elder',
    seed: number,
    hasStubbleShade?: boolean
  ) => SkinMaps;
  createIrisTexture: (irisHex: number) => THREE.CanvasTexture;
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
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
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

  // 1. Realistic Bengaluru Asphalt with cracks, tar patches, aggregate & lane markings
  const [roadC, roadCtx] = makeCanvas(512, 512);
  roadCtx.fillStyle = '#25282f';
  roadCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 24 + Math.floor(Math.random() * 34);
    roadCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    roadCtx.fillRect(x, y, 2, 2);
  }
  for (let p = 0; p < 5; p++) {
    roadCtx.fillStyle = 'rgba(18, 20, 24, 0.55)';
    roadCtx.fillRect(40 + ((p * 97) % 360), 35 + ((p * 131) % 410), 58, 34);
  }
  roadCtx.strokeStyle = 'rgba(12, 14, 18, 0.72)';
  roadCtx.lineWidth = 1.5;
  for (let c = 0; c < 6; c++) {
    let cx = 60 + ((c * 83) % 390);
    let cy = (c * 91) % 450;
    roadCtx.beginPath();
    roadCtx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += Math.sin(c + s * 2) * 18;
      cy += 14;
      roadCtx.lineTo(cx, cy);
    }
    roadCtx.stroke();
  }
  roadCtx.fillStyle = '#d9a406';
  roadCtx.fillRect(250, 0, 4, 512);
  roadCtx.fillRect(258, 0, 4, 512);
  roadCtx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  for (let y = 16; y < 512; y += 64) {
    roadCtx.fillRect(126, y, 4, 30);
    roadCtx.fillRect(382, y, 4, 30);
  }
  roadCtx.fillStyle = 'rgba(241,245,249,0.52)';
  roadCtx.fillRect(14, 0, 4, 512);
  roadCtx.fillRect(494, 0, 4, 512);
  const asphalt = track(finalizeTexture(roadC, maxAnisotropy, 1, 1, true));

  // 1b. Clean Intersection Apron Asphalt (no lane dividers through junction box)
  const [juncC, juncCtx] = makeCanvas(512, 512);
  juncCtx.fillStyle = '#24272e';
  juncCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 24 + Math.floor(Math.random() * 32);
    juncCtx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    juncCtx.fillRect(x, y, 2, 2);
  }
  const asphaltJunction = track(finalizeTexture(juncC, maxAnisotropy, 2, 2, true));

  // 1c. 4-Lane Divided Highway Asphalt (NH-44, ORR, NICE, Hosur)
  const [hwC, hwCtx] = makeCanvas(512, 512);
  hwCtx.drawImage(juncC, 0, 0);
  // Central median border yellow lines
  hwCtx.fillStyle = '#eab308';
  hwCtx.fillRect(236, 0, 5, 512);
  hwCtx.fillRect(271, 0, 5, 512);
  // Dashed lane lines on left & right carriageways
  hwCtx.fillStyle = 'rgba(241, 245, 249, 0.86)';
  for (let y = 16; y < 512; y += 64) {
    hwCtx.fillRect(126, y, 4, 30);
    hwCtx.fillRect(382, y, 4, 30);
  }
  // Crisp outer edge shoulder markings
  hwCtx.fillStyle = 'rgba(248, 250, 252, 0.72)';
  hwCtx.fillRect(14, 0, 5, 512);
  hwCtx.fillRect(493, 0, 5, 512);
  const asphaltHighway = track(finalizeTexture(hwC, maxAnisotropy, 1, 1, true));

  // 1d. 2-Lane Secondary Street Asphalt (Brigade, Commercial St, Cantonment)
  const [secC, secCtx] = makeCanvas(512, 512);
  secCtx.drawImage(juncC, 0, 0);
  secCtx.fillStyle = 'rgba(250, 204, 21, 0.88)';
  for (let y = 14; y < 512; y += 64) {
    secCtx.fillRect(253, y, 6, 34);
  }
  secCtx.fillStyle = 'rgba(241, 245, 249, 0.58)';
  secCtx.fillRect(16, 0, 4, 512);
  secCtx.fillRect(492, 0, 4, 512);
  const asphaltSecondary = track(finalizeTexture(secC, maxAnisotropy, 1, 1, true));

  // 2. Cubbon / Lalbagh Grass & Soil Variation
  const [grassC, grassCtx] = makeCanvas(512, 512);
  grassCtx.fillStyle = '#2d4c2b';
  grassCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 11000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 54 + Math.floor(Math.random() * 48);
    grassCtx.fillStyle = `rgb(${Math.floor(g * 0.56)},${g},${Math.floor(g * 0.44)})`;
    grassCtx.fillRect(x, y, 3, 3);
  }
  const grass = track(finalizeTexture(grassC, maxAnisotropy, 120, 120, true));

  // 2b. Neutral high-frequency ground micro-grain (tinted per-vertex for urban vs park zoning)
  const [terC, terCtx] = makeCanvas(256, 256);
  terCtx.fillStyle = '#c8c8c8';
  terCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const lum = 165 + Math.floor(Math.random() * 68);
    terCtx.fillStyle = `rgb(${lum},${lum},${lum})`;
    terCtx.fillRect(x, y, 2, 2);
  }
  const terrainDetail = track(finalizeTexture(terC, maxAnisotropy, 140, 140, true));

  // 3. Uneven Bengaluru Concrete & Granite Sidewalk Tiles
  const [sideC, sideCtx] = makeCanvas(256, 256);
  sideCtx.fillStyle = '#686d75';
  sideCtx.fillRect(0, 0, 256, 256);
  for (let tx = 0; tx < 256; tx += 64) {
    for (let ty = 0; ty < 256; ty += 64) {
      const shade = 96 + Math.floor(Math.random() * 20);
      sideCtx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
      sideCtx.fillRect(tx + 2, ty + 2, 60, 60);
    }
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

  // 5. MG Road / Brigade Commercial Storefront
  const [comC, comCtx] = makeCanvas(512, 512);
  comCtx.fillStyle = '#3b4252';
  comCtx.fillRect(0, 0, 512, 512);
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
  comCtx.fillStyle = '#111827';
  comCtx.fillRect(0, 406, 512, 106);
  comCtx.fillStyle = '#f59e0b';
  comCtx.fillRect(14, 416, 232, 48);
  comCtx.fillStyle = '#0f172a';
  comCtx.font = 'bold 17px sans-serif';
  comCtx.fillText('ನಮ್ಮ ದರ್ಶಿನಿ · DARSHINI', 22, 446);
  comCtx.fillStyle = '#06b6d4';
  comCtx.fillRect(262, 416, 236, 48);
  comCtx.fillStyle = '#0f172a';
  comCtx.fillText('ಬೆಂಗಳೂರು ಸಿಲ್ಕ್ಸ್ · SILKS', 270, 446);
  const commercialFacade = track(finalizeTexture(comC, maxAnisotropy, 1, 1, true));

  // 6. Electronic City / Whitefield / Manyata IT Park Glass Curtain Wall
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

  // 7. Indiranagar / Koramangala / Jayanagar Residential Facade
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

  // 11. Authentic Kannada Darshini & Metro Signs
  const [dSignC, dSignCtx] = makeCanvas(512, 160);
  dSignCtx.fillStyle = '#7c2d12';
  dSignCtx.fillRect(0, 0, 512, 160);
  dSignCtx.strokeStyle = '#facc15';
  dSignCtx.lineWidth = 6;
  dSignCtx.strokeRect(8, 8, 496, 144);
  dSignCtx.fillStyle = '#fef08a';
  dSignCtx.font = 'bold 34px sans-serif';
  dSignCtx.textAlign = 'center';
  dSignCtx.fillText('ಶ್ರೀ ಗಣೇಶ್ ದರ್ಶಿನಿ · ಕಾಫಿ', 256, 72);
  dSignCtx.fillStyle = '#ffffff';
  dSignCtx.font = 'bold 22px sans-serif';
  dSignCtx.fillText('HOT MASALA DOSA & FILTER KAAPI', 256, 118);
  const darshiniSign = track(finalizeTexture(dSignC, maxAnisotropy, 1, 1, true));

  const [mSignC, mSignCtx] = makeCanvas(512, 160);
  mSignCtx.fillStyle = '#4c1d95';
  mSignCtx.fillRect(0, 0, 512, 160);
  mSignCtx.fillStyle = '#10b981';
  mSignCtx.fillRect(0, 134, 512, 26);
  mSignCtx.fillStyle = '#ffffff';
  mSignCtx.font = 'bold 34px sans-serif';
  mSignCtx.textAlign = 'center';
  mSignCtx.fillText('ನಮ್ಮ ಮೆಟ್ರೋ · ಎಂ.ಜಿ ರಸ್ತೆ', 256, 68);
  mSignCtx.fillStyle = '#e9d5ff';
  mSignCtx.font = 'bold 22px sans-serif';
  mSignCtx.fillText('NAMMA METRO · BENGALURU RAIL', 256, 112);
  const metroSign = track(finalizeTexture(mSignC, maxAnisotropy, 1, 1, true));

  const [martC, martCtx] = makeCanvas(512, 160);
  martCtx.fillStyle = '#065f46';
  martCtx.fillRect(0, 0, 512, 160);
  martCtx.fillStyle = '#facc15';
  martCtx.fillRect(0, 134, 512, 26);
  martCtx.fillStyle = '#ffffff';
  martCtx.font = 'bold 34px sans-serif';
  martCtx.textAlign = 'center';
  martCtx.fillText('ನಮ್ಮ ಮಾರ್ಟ್ · ಸೂಪರ್ ಮಾರ್ಕೆಟ್', 256, 68);
  martCtx.fillStyle = '#a7f3d0';
  martCtx.font = 'bold 21px sans-serif';
  martCtx.fillText('NAMMA MART · FRESH GROCERIES & DAIRY', 256, 112);
  const nammaMartSign = track(finalizeTexture(martC, maxAnisotropy, 1, 1, true));

  const [armC, armCtx] = makeCanvas(512, 160);
  armCtx.fillStyle = '#18181b';
  armCtx.fillRect(0, 0, 512, 160);
  armCtx.strokeStyle = '#ef4444';
  armCtx.lineWidth = 6;
  armCtx.strokeRect(8, 8, 496, 144);
  armCtx.fillStyle = '#fca5a5';
  armCtx.font = 'bold 32px sans-serif';
  armCtx.textAlign = 'center';
  armCtx.fillText('ಕನ್ನಡ ರಕ್ಷಣಾ ಶಸ್ತ್ರಾಗಾರ', 256, 68);
  armCtx.fillStyle = '#ffffff';
  armCtx.font = 'bold 20px sans-serif';
  armCtx.fillText('BENGALURU TACTICAL & ARMORY SHOP', 256, 114);
  const armorySign = track(finalizeTexture(armC, maxAnisotropy, 1, 1, true));

  const [vilC, vilCtx] = makeCanvas(512, 160);
  vilCtx.fillStyle = '#1e293b';
  vilCtx.fillRect(0, 0, 512, 160);
  vilCtx.strokeStyle = '#d97706';
  vilCtx.lineWidth = 5;
  vilCtx.strokeRect(8, 8, 496, 144);
  vilCtx.fillStyle = '#fde68a';
  vilCtx.font = 'bold 32px sans-serif';
  vilCtx.textAlign = 'center';
  vilCtx.fillText('ನಮ್ಮ ನಿವಾಸ · LUXURY HOMES', 256, 68);
  vilCtx.fillStyle = '#e2e8f0';
  vilCtx.font = 'bold 20px sans-serif';
  vilCtx.fillText('PRESS [F] TO ENTER RESIDENCE', 256, 114);
  const villaSign = track(finalizeTexture(vilC, maxAnisotropy, 1, 1, true));

  const [roadSignC, roadSignCtx] = makeCanvas(512, 192);
  roadSignCtx.fillStyle = '#14532d';
  roadSignCtx.fillRect(0, 0, 512, 192);
  roadSignCtx.strokeStyle = '#f8fafc';
  roadSignCtx.lineWidth = 7;
  roadSignCtx.strokeRect(10, 10, 492, 172);
  roadSignCtx.fillStyle = '#ffffff';
  roadSignCtx.font = 'bold 30px sans-serif';
  roadSignCtx.textAlign = 'center';
  roadSignCtx.fillText('ಎಂ.ಜಿ ರಸ್ತೆ ↑  ಇಂದಿರಾನಗರ →', 256, 66);
  roadSignCtx.fillStyle = '#fde047';
  roadSignCtx.font = 'bold 24px sans-serif';
  roadSignCtx.fillText('MG ROAD ↑   INDIRANAGAR →', 256, 114);
  roadSignCtx.fillStyle = '#cbd5e1';
  roadSignCtx.font = 'bold 18px sans-serif';
  roadSignCtx.fillText('ಬೆಂಗಳೂರು ಸಂಚಾರ ಪೊಲೀಸ್ · BTP', 256, 154);
  const kannadaRoadSign = track(finalizeTexture(roadSignC, maxAnisotropy, 1, 1, true));

  const [sbSignC, sbSignCtx] = makeCanvas(640, 192);
  sbSignCtx.fillStyle = '#075985';
  sbSignCtx.fillRect(0, 0, 640, 192);
  sbSignCtx.strokeStyle = '#f8fafc';
  sbSignCtx.lineWidth = 7;
  sbSignCtx.strokeRect(10, 10, 620, 172);
  sbSignCtx.fillStyle = '#ffffff';
  sbSignCtx.font = 'bold 28px sans-serif';
  sbSignCtx.textAlign = 'center';
  sbSignCtx.fillText('ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್  ·  SILK BOARD FLYOVER', 320, 64);
  sbSignCtx.fillStyle = '#fde047';
  sbSignCtx.font = 'bold 24px sans-serif';
  sbSignCtx.fillText('↑ OUTER RING RD / HSR     → ELECTRONIC CITY', 320, 114);
  sbSignCtx.fillStyle = '#bae6fd';
  sbSignCtx.font = 'bold 17px sans-serif';
  sbSignCtx.fillText('BMRCL YELLOW & BLUE LINE INTERCHANGE · KEEP LANE', 320, 156);
  const silkBoardGantry = track(finalizeTexture(sbSignC, maxAnisotropy, 1, 1, true));

  // 12. Woven Denim, Cotton, Suit Wool, Street Shirt & Silk Saree Fabric Micro-Textures
  const [denC, denCtx] = makeCanvas(128, 128);
  denCtx.fillStyle = '#cbd5e1';
  denCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const diag = (x + y) % 6 === 0 ? 185 : 215;
      denCtx.fillStyle = `rgb(${diag},${diag + 4},${diag + 12})`;
      denCtx.fillRect(x, y, 2, 2);
    }
  }
  const denimFabric = track(finalizeTexture(denC, maxAnisotropy, 3, 3, true));

  const [cotC, cotCtx] = makeCanvas(128, 128);
  cotCtx.fillStyle = '#e5e7eb';
  cotCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 3) {
    cotCtx.fillStyle = 'rgba(0,0,0,0.045)';
    cotCtx.fillRect(0, y, 128, 1);
    cotCtx.fillRect(y, 0, 1, 128);
  }
  const cottonFabric = track(finalizeTexture(cotC, maxAnisotropy, 2, 2, true));

  const [woolC, woolCtx] = makeCanvas(128, 128);
  woolCtx.fillStyle = '#e2e8f0';
  woolCtx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    woolCtx.fillStyle = 'rgba(15,23,42,0.06)';
    woolCtx.fillRect(x, 0, 2, 128);
  }
  const suitWoolFabric = track(finalizeTexture(woolC, maxAnisotropy, 3, 3, true));

  const [stC, stCtx] = makeCanvas(256, 256);
  stCtx.fillStyle = '#ffffff';
  stCtx.fillRect(0, 0, 256, 256);
  stCtx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 16; i++) {
    stCtx.beginPath();
    stCtx.arc((i * 47) % 240 + 8, (i * 73) % 240 + 8, 14, 0, Math.PI * 2);
    stCtx.fill();
  }
  stCtx.strokeStyle = 'rgba(0,0,0,0.12)';
  stCtx.lineWidth = 3;
  for (let y = 16; y < 256; y += 32) {
    stCtx.beginPath();
    stCtx.moveTo(0, y);
    stCtx.lineTo(256, y);
    stCtx.stroke();
  }
  const streetShirtFabric = track(finalizeTexture(stC, maxAnisotropy, 2, 2, true));

  const [sareeC, sareeCtx] = makeCanvas(256, 256);
  sareeCtx.fillStyle = '#ffffff';
  sareeCtx.fillRect(0, 0, 256, 256);
  sareeCtx.fillStyle = '#eab308';
  sareeCtx.fillRect(0, 212, 256, 44);
  sareeCtx.fillStyle = '#b45309';
  for (let x = 0; x < 256; x += 16) {
    sareeCtx.fillRect(x, 220, 8, 24);
  }
  const silkSareeFabric = track(finalizeTexture(sareeC, maxAnisotropy, 1, 1, true));

  // 13. Anisotropic Hair Strand Micro-Texture
  const [hairC, hairCtx] = makeCanvas(256, 256);
  hairCtx.fillStyle = '#d4d4d8';
  hairCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) {
    const lum = 155 + Math.floor(Math.sin(x * 0.45) * 35 + Math.random() * 28);
    hairCtx.fillStyle = `rgb(${lum},${lum},${lum})`;
    hairCtx.fillRect(x, 0, 1.5, 256);
  }
  const hairStrandTexture = track(finalizeTexture(hairC, maxAnisotropy, 2, 1, true));

  // 14. 1024x1024 PBR Skin Maps (Albedo + Pore/Wrinkle Normal Map + T-Zone Roughness Map)
  const createSkinMaps = (
    baseHex: string,
    ageGroup: 'young' | 'middle' | 'elder',
    seed: number,
    hasStubbleShade = false
  ): SkinMaps => {
    const sz = 1024;
    const [sc, sctx] = makeCanvas(sz, sz);
    const [nc, nctx] = makeCanvas(sz, sz);
    const [rc, rctx] = makeCanvas(sz, sz);

    const col = new THREE.Color(baseHex);
    const r = Math.round(col.r * 255);
    const g = Math.round(col.g * 255);
    const b = Math.round(col.b * 255);

    // Base Albedo
    sctx.fillStyle = `rgb(${r},${g},${b})`;
    sctx.fillRect(0, 0, sz, sz);

    // Base Neutral Normal (128, 128, 255)
    nctx.fillStyle = 'rgb(128,128,255)';
    nctx.fillRect(0, 0, sz, sz);

    // Base Skin Roughness (~0.52 = 133)
    rctx.fillStyle = 'rgb(138,138,138)';
    rctx.fillRect(0, 0, sz, sz);

    let rng = (seed * 9301 + 49297) % 233280;
    const rand = () => {
      rng = (rng * 9301 + 49297) % 233280;
      return rng / 233280;
    };

    // High-resolution skin pores & melanin micro-variation across albedo, normal & roughness
    for (let i = 0; i < 28000; i++) {
      const px = rand() * sz;
      const py = rand() * sz;
      const delta = Math.floor((rand() - 0.5) * 18);
      sctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r + delta))},${Math.max(
        0,
        Math.min(255, g + delta)
      )},${Math.max(0, Math.min(255, b + delta))})`;
      sctx.fillRect(px, py, 2, 2);

      // Subtle tangent normal pore dimple
      if (i % 2 === 0) {
        const nx = 128 + Math.floor((rand() - 0.5) * 44);
        const ny = 128 + Math.floor((rand() - 0.5) * 44);
        nctx.fillStyle = `rgb(${nx},${ny},235)`;
        nctx.fillRect(px, py, 2, 2);
      }

      // Micro-roughness pore sparkle variation
      if (i % 3 === 0) {
        const rv = 112 + Math.floor(rand() * 58);
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rctx.fillRect(px, py, 2.5, 2.5);
      }
    }

    const addFlush = (cx: number, cy: number, rad: number, alpha: number) => {
      const fg = sctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
      fg.addColorStop(0, `rgba(186, 66, 48, ${alpha})`);
      fg.addColorStop(1, 'rgba(186, 66, 48, 0)');
      sctx.fillStyle = fg;
      sctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    };
    // Micro-pores, melanin variation & subtle nasolabial/lip tint alignment
    addFlush(340, 580, 140, 0.25);
    addFlush(684, 580, 140, 0.25);
    addFlush(512, 520, 90, 0.2);

    // Dewy T-zone roughness contrast (forehead center, nose ridge, cheekbones slightly shinier)
    const addGlossZone = (cx: number, cy: number, rad: number, val: number) => {
      const gg = rctx.createRadialGradient(cx, cy, 6, cx, cy, rad);
      gg.addColorStop(0, `rgba(${val},${val},${val},0.72)`);
      gg.addColorStop(1, `rgba(${val},${val},${val},0)`);
      rctx.fillStyle = gg;
      rctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    };
    addGlossZone(512, 520, 75, 86);  // Nose bridge/tip
    addGlossZone(512, 340, 130, 95); // Forehead
    addGlossZone(350, 560, 80, 98);  // Left cheek
    addGlossZone(674, 560, 80, 98);  // Right cheek

    // Under-eye & orbital socket shading
    const addShadow = (cx: number, cy: number, rad: number, alpha: number) => {
      const sg = sctx.createRadialGradient(cx, cy, 6, cx, cy, rad);
      sg.addColorStop(0, `rgba(42, 22, 15, ${alpha})`);
      sg.addColorStop(1, 'rgba(42, 22, 15, 0)');
      sctx.fillStyle = sg;
      sctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    };
    addShadow(390, 450, 76, 0.2);
    addShadow(634, 450, 76, 0.2);

    // Subtle vermilion lip & nasolabial crease shadow alignment
    const lipGrad = sctx.createRadialGradient(512, 668, 12, 512, 668, 72);
    lipGrad.addColorStop(0, 'rgba(155, 62, 58, 0.28)');
    lipGrad.addColorStop(1, 'rgba(155, 62, 58, 0)');
    sctx.fillStyle = lipGrad;
    sctx.fillRect(430, 595, 164, 145);

    // Beard follicle stubble texture along lower jaw
    if (hasStubbleShade) {
      for (let i = 0; i < 4600; i++) {
        const fx = 250 + rand() * 524;
        const fy = 615 + rand() * 300;
        sctx.fillStyle = 'rgba(22, 16, 14, 0.26)';
        sctx.fillRect(fx, fy, 2.2, 3.0);
        nctx.fillStyle = 'rgb(142, 116, 232)';
        nctx.fillRect(fx, fy, 2.0, 2.5);
      }
    }

    // Natural skin imperfection / asymmetric mole
    sctx.fillStyle = 'rgba(54, 28, 18, 0.52)';
    sctx.beginPath();
    sctx.arc(316 + (seed % 70), 610 + (seed % 50), 3.6, 0, Math.PI * 2);
    sctx.fill();

    // Forehead & crow's feet wrinkles (Albedo + Normal crease!)
    const drawWrinkle = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, alpha: number) => {
      sctx.strokeStyle = `rgba(54, 28, 18, ${alpha})`;
      sctx.lineWidth = ageGroup === 'elder' ? 3.2 : 2.1;
      sctx.beginPath();
      sctx.moveTo(x1, y1);
      sctx.quadraticCurveTo(cx, cy, x2, y2);
      sctx.stroke();

      nctx.strokeStyle = 'rgb(128, 90, 238)';
      nctx.lineWidth = 3.0;
      nctx.beginPath();
      nctx.moveTo(x1, y1);
      nctx.quadraticCurveTo(cx, cy, x2, y2);
      nctx.stroke();
    };

    if (ageGroup !== 'young') {
      const wAlpha = ageGroup === 'elder' ? 0.36 : 0.22;
      [270, 304, 336].forEach((fy) => {
        drawWrinkle(330, fy, 512, fy - 12, 694, fy, wAlpha);
      });
      [-1, 1].forEach((side) => {
        const ex = 512 + side * 190;
        for (let k = -1; k <= 1; k++) {
          drawWrinkle(ex, 440 + k * 14, ex + side * 18, 436 + k * 17, ex + side * 34, 434 + k * 20, wAlpha);
        }
      });
    }

    // Rig-owned textures (disposed via disposeHumanRig to avoid GPU memory leaks)
    const albedo = finalizeTexture(sc, maxAnisotropy, 1, 1, true);
    const normal = finalizeTexture(nc, maxAnisotropy, 1, 1, false);
    const roughness = finalizeTexture(rc, maxAnisotropy, 1, 1, false);
    albedo.wrapS = THREE.ClampToEdgeWrapping;
    albedo.wrapT = THREE.ClampToEdgeWrapping;
    normal.wrapS = THREE.ClampToEdgeWrapping;
    normal.wrapT = THREE.ClampToEdgeWrapping;
    roughness.wrapS = THREE.ClampToEdgeWrapping;
    roughness.wrapT = THREE.ClampToEdgeWrapping;

    return {
      albedo,
      normal,
      roughness,
      dispose: () => {
        albedo.dispose();
        normal.dispose();
        roughness.dispose();
      },
    };
  };

  const createSkinTexture = (
    baseHex: string,
    ageGroup: 'young' | 'middle' | 'elder',
    seed: number,
    hasStubbleShade = false
  ): THREE.CanvasTexture => createSkinMaps(baseHex, ageGroup, seed, hasStubbleShade).albedo;

  // 15. Detailed 256x256 Eye Iris Texture (Dark Limbal Ring + Radial Fibers + Pupil + Specular Catchlight)
  const createIrisTexture = (irisHex: number): THREE.CanvasTexture => {
    const [ic, ictx] = makeCanvas(256, 256);
    const col = new THREE.Color(irisHex);
    const r = Math.round(col.r * 255);
    const g = Math.round(col.g * 255);
    const b = Math.round(col.b * 255);

    ictx.fillStyle = '#070709';
    ictx.fillRect(0, 0, 256, 256);
    ictx.fillStyle = `rgb(${r},${g},${b})`;
    ictx.beginPath();
    ictx.arc(128, 128, 108, 0, Math.PI * 2);
    ictx.fill();

    // Limbal ring gradient
    ictx.strokeStyle = 'rgba(10, 6, 4, 0.72)';
    ictx.lineWidth = 10;
    ictx.beginPath();
    ictx.arc(128, 128, 104, 0, Math.PI * 2);
    ictx.stroke();

    for (let a = 0; a < 110; a++) {
      const ang = (a / 110) * Math.PI * 2;
      ictx.strokeStyle = a % 2 === 0 ? 'rgba(255,215,170,0.26)' : 'rgba(15,10,8,0.34)';
      ictx.lineWidth = 2.2;
      ictx.beginPath();
      ictx.moveTo(128 + Math.cos(ang) * 34, 128 + Math.sin(ang) * 34);
      ictx.lineTo(128 + Math.cos(ang) * 100, 128 + Math.sin(ang) * 100);
      ictx.stroke();
    }
    ictx.fillStyle = '#030305';
    ictx.beginPath();
    ictx.arc(128, 128, 40, 0, Math.PI * 2);
    ictx.fill();
    ictx.fillStyle = 'rgba(255,255,255,0.92)';
    ictx.beginPath();
    ictx.arc(104, 100, 11, 0, Math.PI * 2);
    ictx.fill();

    return finalizeTexture(ic, 2, 1, 1, true);
  };

  return {
    asphalt,
    asphaltHighway,
    asphaltSecondary,
    asphaltJunction,
    grass,
    terrainDetail,
    sidewalk,
    vidhanaGranite,
    commercialFacade,
    itGlassFacade,
    residentialFacade,
    marketAwning,
    metroConcrete,
    contactShadow,
    darshiniSign,
    metroSign,
    nammaMartSign,
    armorySign,
    villaSign,
    kannadaRoadSign,
    silkBoardGantry,
    denimFabric,
    cottonFabric,
    silkSareeFabric,
    suitWoolFabric,
    streetShirtFabric,
    hairStrandTexture,
    createSkinTexture,
    createSkinMaps,
    createIrisTexture,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
