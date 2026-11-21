import * as THREE from 'three';
import { WorldPartitionManager } from './GeoJsonWorldPartition';
import {
  LANDMARK_MARKERS,
  METRO_STATIONS,
  RAIL_BUS_STATIONS,
  getGradedTerrainY,
} from './bengaluruData';
import { TextureBundle } from './textures';
import { BuildingCollider, MetroLineId } from './types';

function lineHex(line: MetroLineId): number {
  switch (line) {
    case 'purple':
      return 0x9333ea;
    case 'green':
      return 0x16a34a;
    case 'yellow':
      return 0xeab308;
    case 'pink':
      return 0xec4899;
    case 'blue':
      return 0x2563eb;
  }
}

function addCollider(colliders: BuildingCollider[], x: number, z: number, w: number, d: number, topY: number): void {
  colliders.push({
    minX: x - w * 0.5,
    maxX: x + w * 0.5,
    minZ: z - d * 0.5,
    maxZ: z + d * 0.5,
    height: topY,
  });
}

/**
 * Builds all 15 famous Bengaluru landmarks, 29 Namma Metro stations (operational & under-construction),
 * and 8 Railway/Bus Hubs, registering each into WorldPartitionManager.
 */
export function buildBengaluruLandmarksAndStations(
  parent: THREE.Group,
  colliders: BuildingCollider[],
  textures: TextureBundle,
  partition: WorldPartitionManager
): void {
  const registerLm = (x: number, z: number, grp: THREE.Group, skirtW = 14, skirtD = 14) => {
    const cY = getGradedTerrainY(x, z);
    const minY = Math.min(
      cY,
      getGradedTerrainY(x - skirtW * 0.5, z - skirtD * 0.5),
      getGradedTerrainY(x + skirtW * 0.5, z - skirtD * 0.5),
      getGradedTerrainY(x - skirtW * 0.5, z + skirtD * 0.5),
      getGradedTerrainY(x + skirtW * 0.5, z + skirtD * 0.5)
    );
    const maxY = Math.max(
      cY,
      getGradedTerrainY(x - skirtW * 0.5, z - skirtD * 0.5),
      getGradedTerrainY(x + skirtW * 0.5, z - skirtD * 0.5),
      getGradedTerrainY(x - skirtW * 0.5, z + skirtD * 0.5),
      getGradedTerrainY(x + skirtW * 0.5, z + skirtD * 0.5)
    );
    const drop = Math.max(0.7, maxY - minY + 0.85);
    const padSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(skirtW, drop, skirtD),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88 })
    );
    padSkirt.position.y = -drop * 0.5 + 0.04;
    padSkirt.receiveShadow = true;
    grp.add(padSkirt);
    grp.position.set(x, maxY, z);
    parent.add(grp);
    partition.registerObject(x, z, grp, 'medium');
  };

  const vidMat = new THREE.MeshStandardMaterial({ map: textures.vidhanaGranite, roughness: 0.78, metalness: 0.08 });
  const domeGold = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.5 });
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.82 });
  const redCourtMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.72 });
  const palaceStoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85 });
  const teakMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75 });
  const templeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.12,
    metalness: 0.15,
    clearcoat: 1,
    transparent: true,
    opacity: 0.65,
  });
  const itGlassMat = new THREE.MeshStandardMaterial({ map: textures.itGlassFacade, roughness: 0.22, metalness: 0.78 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0xd9a05b, roughness: 0.7 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });

  // 1. Vidhana Soudha
  const lmVid = LANDMARK_MARKERS.find((l) => l.id === 'lm_vidhana_soudha');
  if (lmVid) {
    const g = new THREE.Group();
    const steps = new THREE.Mesh(new THREE.BoxGeometry(68, 2.4, 38), graniteMat);
    steps.position.y = 1.2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 30), vidMat);
    base.position.y = 9.4;
    base.castShadow = true;
    const cDome = new THREE.Mesh(new THREE.SphereGeometry(6.8, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), domeGold);
    cDome.position.y = 16.4;
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 10), domeGold);
    finial.position.y = 24.5;
    g.add(steps, base, cDome, finial);
    [[-24, -10], [24, -10], [-24, 10], [24, 10]].forEach(([dx, dz]) => {
      const cd = new THREE.Mesh(new THREE.SphereGeometry(3.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), domeGold);
      cd.position.set(dx, 16.4, dz);
      g.add(cd);
    });
    registerLm(lmVid.x - 28, lmVid.z - 22, g);
    addCollider(colliders, lmVid.x - 28, lmVid.z - 22, 62, 32, getGradedTerrainY(lmVid.x, lmVid.z) + 18);
  }

  // 2. Bangalore Palace (Tudor Towers & Battlements)
  const lmPal = LANDMARK_MARKERS.find((l) => l.id === 'lm_bangalore_palace');
  if (lmPal) {
    const g = new THREE.Group();
    const main = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 22), palaceStoneMat);
    main.position.y = 6;
    main.castShadow = true;
    g.add(main);
    [[-17, -11], [17, -11], [-17, 11], [17, 11]].forEach(([tx, tz]) => {
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 17, 10), palaceStoneMat);
      turret.position.set(tx, 8.5, tz);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.9, 5, 10), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      spire.position.set(tx, 19.5, tz);
      g.add(turret, spire);
    });
    registerLm(lmPal.x + 24, lmPal.z, g);
    addCollider(colliders, lmPal.x + 24, lmPal.z, 36, 24, getGradedTerrainY(lmPal.x, lmPal.z) + 15);
  }

  // 3. Lalbagh Glass House
  const lmGlass = LANDMARK_MARKERS.find((l) => l.id === 'lm_lalbagh_glasshouse');
  if (lmGlass) {
    const g = new THREE.Group();
    const ghBase = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 16), glassMat);
    ghBase.position.y = 3;
    const ghRoof = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 26, 16, 1, false, 0, Math.PI), glassMat);
    ghRoof.rotation.z = Math.PI / 2;
    ghRoof.position.y = 6;
    const ghRib = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.7, 16.4), templeWhiteMat);
    ghRib.position.y = 6;
    g.add(ghBase, ghRoof, ghRib);
    registerLm(lmGlass.x + 18, lmGlass.z, g);
    addCollider(colliders, lmGlass.x + 18, lmGlass.z, 26, 16, getGradedTerrainY(lmGlass.x, lmGlass.z) + 14);
  }

  // 4. Cubbon Park Victorian Bandstand
  const lmCub = LANDMARK_MARKERS.find((l) => l.id === 'lm_cubbon_park');
  if (lmCub) {
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 1.2, 8), graniteMat);
    plinth.position.y = 0.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3.5, 8), templeWhiteMat);
    roof.position.y = 6.8;
    g.add(plinth, roof);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 4.4, 8), templeWhiteMat);
      col.position.set(Math.cos(a) * 5.2, 3.4, Math.sin(a) * 5.2);
      g.add(col);
    }
    registerLm(lmCub.x - 16, lmCub.z + 12, g);
  }

  // 5. Attara Kacheri (Karnataka High Court)
  const lmCourt = LANDMARK_MARKERS.find((l) => l.id === 'lm_attara_kacheri');
  if (lmCourt) {
    const g = new THREE.Group();
    const hall = new THREE.Mesh(new THREE.BoxGeometry(42, 11, 16), redCourtMat);
    hall.position.y = 5.5;
    hall.castShadow = true;
    const portico = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 19), redCourtMat);
    portico.position.y = 6;
    const pediment = new THREE.Mesh(new THREE.ConeGeometry(8, 3.8, 4), domeGold);
    pediment.rotation.y = Math.PI * 0.25;
    pediment.position.y = 13.8;
    g.add(hall, portico, pediment);
    registerLm(lmCourt.x + 22, lmCourt.z + 14, g);
    addCollider(colliders, lmCourt.x + 22, lmCourt.z + 14, 42, 18, getGradedTerrainY(lmCourt.x, lmCourt.z) + 13);
  }

  // 6. Tipu Sultan's Summer Palace
  const lmTipu = LANDMARK_MARKERS.find((l) => l.id === 'lm_tipu_palace');
  if (lmTipu) {
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(22, 1.5, 16), graniteMat);
    plinth.position.y = 0.75;
    const pavilion = new THREE.Mesh(new THREE.BoxGeometry(19, 7.5, 13), teakMat);
    pavilion.position.y = 5.25;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(21, 0.9, 15), teakMat);
    roof.position.y = 9.4;
    g.add(plinth, pavilion, roof);
    registerLm(lmTipu.x - 18, lmTipu.z, g);
    addCollider(colliders, lmTipu.x - 18, lmTipu.z, 22, 16, getGradedTerrainY(lmTipu.x, lmTipu.z) + 10);
  }

  // 7. ISKCON Temple Bengaluru
  const lmIsk = LANDMARK_MARKERS.find((l) => l.id === 'lm_iskcon');
  if (lmIsk) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 24), templeWhiteMat);
    base.position.y = 4;
    const atrium = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), glassMat);
    atrium.position.y = 14;
    const shikhara = new THREE.Mesh(new THREE.ConeGeometry(4.5, 12, 8), domeGold);
    shikhara.position.y = 26;
    g.add(base, atrium, shikhara);
    registerLm(lmIsk.x - 20, lmIsk.z, g);
    addCollider(colliders, lmIsk.x - 20, lmIsk.z, 26, 24, getGradedTerrainY(lmIsk.x, lmIsk.z) + 22);
  }

  // 8. Bull Temple (Dodda Basavana Gudi)
  const lmBull = LANDMARK_MARKERS.find((l) => l.id === 'lm_bull_temple');
  if (lmBull) {
    const g = new THREE.Group();
    const sanctum = new THREE.Mesh(new THREE.BoxGeometry(18, 7.5, 18), graniteMat);
    sanctum.position.y = 3.75;
    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(11, 4, 11), domeGold);
    tier1.position.y = 9.5;
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 7), domeGold);
    tier2.position.y = 13.2;
    const kalasha = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 10), domeGold);
    kalasha.position.y = 16.5;
    g.add(sanctum, tier1, tier2, kalasha);
    registerLm(lmBull.x - 18, lmBull.z, g);
    addCollider(colliders, lmBull.x - 18, lmBull.z, 18, 18, getGradedTerrainY(lmBull.x, lmBull.z) + 14);
  }

  // 9. M. Chinnaswamy Stadium
  const lmStad = LANDMARK_MARKERS.find((l) => l.id === 'lm_chinnaswamy');
  if (lmStad) {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 25, 10, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, side: THREE.DoubleSide })
    );
    bowl.position.y = 5;
    const pitch = new THREE.Mesh(new THREE.CircleGeometry(23, 24), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.25;
    g.add(bowl, pitch);
    [[-24, -24], [24, -24], [-24, 24], [24, 24]].forEach(([fx, fz]) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 24, 8), concreteMat);
      mast.position.set(fx, 12, fz);
      const bank = new THREE.Mesh(
        new THREE.BoxGeometry(5, 2.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.7 })
      );
      bank.position.set(fx, 24.5, fz);
      g.add(mast, bank);
    });
    registerLm(lmStad.x + 26, lmStad.z - 20, g);
    addCollider(colliders, lmStad.x + 26, lmStad.z - 20, 52, 52, getGradedTerrainY(lmStad.x, lmStad.z) + 11);
  }

  // 10. UB City Luxury Skyscrapers
  const lmUb = LANDMARK_MARKERS.find((l) => l.id === 'lm_ub_city');
  if (lmUb) {
    const g = new THREE.Group();
    const podium = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 26), graniteMat);
    podium.position.y = 5;
    const towerA = new THREE.Mesh(new THREE.BoxGeometry(14, 58, 14), itGlassMat);
    towerA.position.set(-8, 34, 0);
    towerA.castShadow = true;
    const towerB = new THREE.Mesh(new THREE.BoxGeometry(12, 46, 12), itGlassMat);
    towerB.position.set(10, 28, 2);
    towerB.castShadow = true;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 11, 8), domeGold);
    spire.position.set(-8, 68, 0);
    g.add(podium, towerA, towerB, spire);
    registerLm(lmUb.x - 24, lmUb.z + 20, g);
    addCollider(colliders, lmUb.x - 24, lmUb.z + 20, 36, 26, getGradedTerrainY(lmUb.x, lmUb.z) + 60);
  }

  // 11. BIEC Exhibition Centre
  const lmBiec = LANDMARK_MARKERS.find((l) => l.id === 'lm_biec');
  if (lmBiec) {
    const g = new THREE.Group();
    for (let h = -1; h <= 1; h += 2) {
      const hall = new THREE.Mesh(new THREE.BoxGeometry(38, 12, 24), concreteMat);
      hall.position.set(h * 22, 6, 0);
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 38, 14, 1, false, 0, Math.PI), glassMat);
      vault.rotation.z = Math.PI * 0.5;
      vault.position.set(h * 22, 12, 0);
      g.add(hall, vault);
    }
    registerLm(lmBiec.x, lmBiec.z - 26, g);
    addCollider(colliders, lmBiec.x, lmBiec.z - 26, 82, 26, getGradedTerrainY(lmBiec.x, lmBiec.z) + 14);
  }

  // 12. Kempegowda International Airport (T2 Bamboo Garden Terminal + ATC Tower + Aircraft)
  const lmKia = LANDMARK_MARKERS.find((l) => l.id === 'lm_kia_airport');
  if (lmKia) {
    const g = new THREE.Group();
    const term = new THREE.Mesh(new THREE.BoxGeometry(84, 13, 28), glassMat);
    term.position.set(0, 6.5, -24);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(92, 1.6, 36), bambooMat);
    roof.position.set(0, 13.8, -24);
    const atcShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 36, 12), concreteMat);
    atcShaft.position.set(54, 18, -26);
    const atcCab = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 4.2, 5.5, 14), glassMat);
    atcCab.position.set(54, 37.5, -26);
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 22),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.09, 28);
    // Parked jetliner silhouette
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 22, 12), templeWhiteMat);
    fuselage.rotation.z = Math.PI * 0.5;
    fuselage.position.set(-22, 3.2, 12);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.35, 22), templeWhiteMat);
    wing.position.set(-22, 2.8, 12);
    g.add(term, roof, atcShaft, atcCab, runway, fuselage, wing);
    registerLm(lmKia.x, lmKia.z - 18, g);
    addCollider(colliders, lmKia.x, lmKia.z - 42, 86, 30, getGradedTerrainY(lmKia.x, lmKia.z) + 15);
  }

  // 13. KR Market Rotunda Hall
  const lmKrm = LANDMARK_MARKERS.find((l) => l.id === 'lm_kr_market');
  if (lmKrm) {
    const g = new THREE.Group();
    const hall = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 17, 9, 16),
      new THREE.MeshStandardMaterial({ map: textures.marketAwning, roughness: 0.78 })
    );
    hall.position.y = 4.5;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), redCourtMat);
    dome.position.y = 9;
    g.add(hall, dome);
    registerLm(lmKrm.x - 16, lmKrm.z - 14, g);
    addCollider(colliders, lmKrm.x - 16, lmKrm.z - 14, 32, 32, getGradedTerrainY(lmKrm.x, lmKrm.z) + 12);
  }

  // 14. Freedom Park Watchtower & Plaza
  const lmFree = LANDMARK_MARKERS.find((l) => l.id === 'lm_freedom_park');
  if (lmFree) {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 22, 10), redCourtMat);
    tower.position.y = 11;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 1.1, 8, 24), graniteMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.6;
    g.add(tower, ring);
    registerLm(lmFree.x, lmFree.z - 16, g);
    addCollider(colliders, lmFree.x, lmFree.z - 16, 7, 7, getGradedTerrainY(lmFree.x, lmFree.z) + 22);
  }

  // 15. Bangalore Fort (Granite Bastions & Gate)
  const lmFort = LANDMARK_MARKERS.find((l) => l.id === 'lm_bangalore_fort');
  if (lmFort) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(26, 7.5, 8), graniteMat);
    wall.position.y = 3.75;
    [-12, 12].forEach((bx) => {
      const bastion = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 8.5, 12), graniteMat);
      bastion.position.set(bx, 4.25, 0);
      g.add(bastion);
    });
    g.add(wall);
    registerLm(lmFort.x + 18, lmFort.z + 12, g);
    addCollider(colliders, lmFort.x + 18, lmFort.z + 12, 30, 10, getGradedTerrainY(lmFort.x, lmFort.z) + 9);
  }

  // Namma Metro Stations (30 Stations: Operational Elevated/Underground Concourses vs Pink/Blue Construction Sites)
  METRO_STATIONS.forEach((st) => {
    const g = new THREE.Group();
    const col = lineHex(st.line);
    if (st.status === 'operational') {
      const deckY = st.elevated ? 12.6 : 2.8;
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.62 });
      const steelTrussMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.78 });
      const accentMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.45 });

      // Platform slab + concourse undercroft + T-shaped concrete viaduct piers
      const platSlab = new THREE.Mesh(new THREE.BoxGeometry(42, 0.9, 12.4), concreteMat);
      platSlab.position.y = deckY - 1.65;
      platSlab.castShadow = true;
      platSlab.receiveShadow = true;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(39, 3.6, 11.4), hullMat);
      shell.position.y = deckY + 0.1;
      const lineBand = new THREE.Mesh(new THREE.BoxGeometry(39.3, 0.55, 11.6), accentMat);
      lineBand.position.y = deckY - 1.05;

      // Sculpted curved arched canopy roof with skylight ribs
      const canopyVault = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.2, 43, 14, 1, true, -Math.PI * 0.34, Math.PI * 0.68),
        steelTrussMat
      );
      canopyVault.rotation.z = Math.PI * 0.5;
      canopyVault.position.y = deckY - 2.3;
      const skylightStrip = new THREE.Mesh(new THREE.BoxGeometry(40, 0.18, 3.6), glassMat);
      skylightStrip.position.y = deckY + 4.6;
      g.add(platSlab, shell, lineBand, canopyVault, skylightStrip);

      // Ribbed steel roof trusses & elevated support piers
      [-16, -8, 0, 8, 16].forEach((rx) => {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 13.4), accentMat);
        rib.position.set(rx, deckY + 2.45, 0);
        g.add(rib);
        if (st.elevated && Math.abs(rx) === 16) {
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, deckY - 1.6, 10), concreteMat);
          pier.position.set(rx, (deckY - 1.6) * 0.5, 0);
          g.add(pier);
        }
      });

      const board = new THREE.Mesh(
        new THREE.BoxGeometry(11.6, 2.8, 0.28),
        new THREE.MeshStandardMaterial({ map: textures.metroSign, emissive: col, emissiveIntensity: 0.34 })
      );
      board.position.set(0, deckY + 0.4, 5.95);

      // Street-level glass concourse entrance + covered escalator ramp + Auto Stand Bay
      const entryCanopy = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.45, 7.6), accentMat);
      entryCanopy.position.set(0, 4.2, 7.8);
      const entryGlass = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.7, 5.6), glassMat);
      entryGlass.position.set(0, 1.9, 7.4);
      const stairRamp = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.85, 11.0), concreteMat);
      stairRamp.position.set(0, st.elevated ? 6.2 : 1.5, 4.2);
      stairRamp.rotation.x = st.elevated ? -0.68 : -0.15;
      const autoBayPad = new THREE.Mesh(
        new THREE.BoxGeometry(7.2, 0.14, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.7 })
      );
      autoBayPad.position.set(-11.5, 0.07, 8.2);
      const entryPylon = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 4.8, 0.6),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28 })
      );
      entryPylon.position.set(6.4, 2.4, 9.8);
      g.add(board, entryCanopy, entryGlass, stairRamp, autoBayPad, entryPylon);
    } else {
      // Under-Construction Pink & Blue Line Station Barricade & Pier Site
      for (let b = -2; b <= 2; b++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.5), barrierMat);
        bar.position.set(b * 4.2, 0.55, 5.5);
        g.add(bar);
      }
      const pierStub = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8.2, 2.6), concreteMat);
      pierStub.position.y = 4.1;
      const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 0.6), barrierMat);
      craneBoom.position.set(4, 11.2, 0);
      g.add(pierStub, craneBoom);
    }
    registerLm(st.x, st.z, g);
  });

  // 8 Major Railway & BMTC Bus Hubs
  RAIL_BUS_STATIONS.forEach((hub) => {
    const g = new THREE.Group();
    const accent = hub.kind === 'rail' ? 0x0f766e : 0x2563eb;
    for (let b = -1; b <= 1; b++) {
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.7, 24),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42, metalness: 0.4 })
      );
      canopy.position.set(b * 18, 5.0, -18);
      canopy.castShadow = true;
      g.add(canopy);
      [-9, 9].forEach((oz) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 5.0, 8), concreteMat);
        post.position.set(b * 18, 2.5, -18 + oz);
        g.add(post);
      });
    }
    registerLm(hub.x, hub.z, g);
  });

  // Enterable Interior Storefronts, Villas & Fuel Stations
  LANDMARK_MARKERS.forEach((lm) => {
    if (lm.type === 'petrol') {
      const g = new THREE.Group();
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.65, 10),
        new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 })
      );
      canopy.position.set(0, 4.8, -6);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(14.2, 0.28, 10.2),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x1d4ed8, emissiveIntensity: 0.2 })
      );
      stripe.position.set(0, 4.4, -6);
      [-4.8, 4.8].forEach((px) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.6, 8), templeWhiteMat);
        col.position.set(px, 2.3, -6);
        const pump = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.8), barrierMat);
        pump.position.set(px * 0.45, 0.9, -6);
        g.add(col, pump);
      });
      g.add(canopy, stripe);
      registerLm(lm.x, lm.z, g);
    } else if (lm.type === 'interior' && lm.interiorId) {
      const g = new THREE.Group();
      const iid = lm.interiorId;
      if (iid === 'namma_mart' || iid === 'weapon_shop' || iid === 'bengaluru_gym') {
        const w = iid === 'namma_mart' ? 20 : 15;
        const h = iid === 'namma_mart' ? 8.5 : 7.2;
        const wallColor = iid === 'namma_mart' ? 0xf8fafc : iid === 'weapon_shop' ? 0x1e293b : 0x334155;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 14),
          new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.6 })
        );
        box.position.set(0, h * 0.5, -9);
        box.castShadow = true;
        const signTex =
          iid === 'namma_mart'
            ? textures.nammaMartSign
            : iid === 'weapon_shop'
            ? textures.armorySign
            : textures.commercialFacade;
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.72, 2.2, 0.24),
          new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveIntensity: 0.16 })
        );
        sign.position.set(0, h - 1.4, -1.9);
        const glassEntry = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 0.25), glassMat);
        glassEntry.position.set(0, 1.6, -1.95);
        g.add(box, sign, glassEntry);
        registerLm(lm.x, lm.z, g);
        addCollider(colliders, lm.x, lm.z - 9, w, 14, getGradedTerrainY(lm.x, lm.z) + h);
      } else {
        // Luxury Villa / House / Sky Apartment Exterior
        const w = iid === 'whitefield_apt' ? 18 : 16;
        const h = iid === 'whitefield_apt' ? 22 : 9.2;
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 14),
          new THREE.MeshStandardMaterial({
            color: iid === 'indiranagar_villa' ? 0xfef3c7 : iid === 'koramangala_house' ? 0xe2e8f0 : 0xcbd5e1,
            roughness: 0.55,
          })
        );
        body.position.set(0, h * 0.5, -10);
        body.castShadow = true;
        const porch = new THREE.Mesh(
          new THREE.BoxGeometry(6.5, 0.45, 4.2),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
        );
        porch.position.set(0, 3.6, -2.2);
        const villaBoard = new THREE.Mesh(
          new THREE.BoxGeometry(5.6, 1.4, 0.2),
          new THREE.MeshStandardMaterial({ map: textures.villaSign })
        );
        villaBoard.position.set(0, 4.6, -2.1);
        g.add(body, porch, villaBoard);
        registerLm(lm.x, lm.z, g);
        addCollider(colliders, lm.x, lm.z - 10, w, 14, getGradedTerrainY(lm.x, lm.z) + h);
      }
    }
  });
}
