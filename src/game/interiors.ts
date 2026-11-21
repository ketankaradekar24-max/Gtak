import * as THREE from 'three';
import { GROCERY_ITEMS, TV_CHANNELS } from './bengaluruData';
import { BuildingCollider, InteriorId } from './types';

export interface InteriorTrigger {
  id:
    | 'exit_door'
    | 'sofa'
    | 'tv'
    | 'bed'
    | 'lights'
    | 'curtains'
    | 'kitchen'
    | 'shower'
    | 'shelf'
    | 'checkout'
    | 'armory_counter'
    | 'gym_workout'
    | 'jail_booking';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  shelfCategory?: string;
}

export interface InteriorPocket {
  id: InteriorId;
  spawn: THREE.Vector3;
  floorY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  colliders: BuildingCollider[];
  triggers: InteriorTrigger[];
  lights: THREE.PointLight[];
  curtains: THREE.Mesh[];
  tvScreenMat?: THREE.MeshStandardMaterial;
  tvCanvas?: HTMLCanvasElement;
  tvTex?: THREE.CanvasTexture;
}

export interface InteriorsManagerHandles {
  group: THREE.Group;
  pockets: Record<InteriorId, InteriorPocket>;
  updateHomeVisuals: (
    interiorId: InteriorId | null,
    lightsOn: boolean,
    curtainsOpen: boolean,
    tvOn: boolean,
    tvChannel: number
  ) => void;
}

const INTERIOR_Y = -120;
const INTERIOR_Z = -600;

export function buildAllInteriors(scene: THREE.Scene): InteriorsManagerHandles {
  const group = new THREE.Group();
  const pockets = {} as Record<InteriorId, InteriorPocket>;

  const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 });
  const tileFloorMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
  const rubberFloorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const wallCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
  const wallCoolMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 });
  const wallDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.75 });
  const bedSheetMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
  const skyViewMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.35,
  });

  const addBoxRoom = (
    cx: number,
    w: number,
    h: number,
    d: number,
    floorMat: THREE.Material,
    wallMat: THREE.Material,
    colliders: BuildingCollider[]
  ) => {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), floorMat);
    floor.position.set(cx, INTERIOR_Y - 0.2, INTERIOR_Z);
    floor.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), wallMat);
    roof.position.set(cx, INTERIOR_Y + h + 0.2, INTERIOR_Z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), wallMat);
    back.position.set(cx, INTERIOR_Y + h * 0.5, INTERIOR_Z - d * 0.5);
    const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), wallMat);
    front.position.set(cx, INTERIOR_Y + h * 0.5, INTERIOR_Z + d * 0.5);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, d), wallMat);
    left.position.set(cx - w * 0.5, INTERIOR_Y + h * 0.5, INTERIOR_Z);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, d), wallMat);
    right.position.set(cx + w * 0.5, INTERIOR_Y + h * 0.5, INTERIOR_Z);
    group.add(floor, roof, back, front, left, right);

    colliders.push(
      { minX: cx - w * 0.5 - 1, maxX: cx + w * 0.5 + 1, minZ: INTERIOR_Z - d * 0.5 - 1, maxZ: INTERIOR_Z - d * 0.5 + 0.4, height: INTERIOR_Y + h },
      { minX: cx - w * 0.5 - 1, maxX: cx + w * 0.5 + 1, minZ: INTERIOR_Z + d * 0.5 - 0.4, maxZ: INTERIOR_Z + d * 0.5 + 1, height: INTERIOR_Y + h },
      { minX: cx - w * 0.5 - 1, maxX: cx - w * 0.5 + 0.4, minZ: INTERIOR_Z - d * 0.5 - 1, maxZ: INTERIOR_Z + d * 0.5 + 1, height: INTERIOR_Y + h },
      { minX: cx + w * 0.5 - 0.4, maxX: cx + w * 0.5 + 1, minZ: INTERIOR_Z - d * 0.5 - 1, maxZ: INTERIOR_Z + d * 0.5 + 1, height: INTERIOR_Y + h }
    );

    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.7, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.35 })
    );
    exitDoor.position.set(cx, INTERIOR_Y + 1.35, INTERIOR_Z + d * 0.5 - 0.25);
    group.add(exitDoor);
  };

  // Build 3 Homes (Indiranagar Villa, Koramangala House, Whitefield Sky Apt)
  const homeConfigs: Array<{ id: InteriorId; cx: number; accent: number }> = [
    { id: 'indiranagar_villa', cx: -400, accent: 0x0f766e },
    { id: 'koramangala_house', cx: -200, accent: 0x1d4ed8 },
    { id: 'whitefield_apt', cx: 0, accent: 0x7e22ce },
  ];

  homeConfigs.forEach(({ id, cx, accent }) => {
    const colliders: BuildingCollider[] = [];
    const w = 18;
    const d = 16;
    const h = 4.6;
    addBoxRoom(cx, w, h, d, woodFloorMat, id === 'indiranagar_villa' ? wallCreamMat : wallCoolMat, colliders);

    // Living Room Sofa + Coffee Table
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.9, 1.3), sofaMat);
    sofa.position.set(cx - 2.5, INTERIOR_Y + 0.45, INTERIOR_Z + 0.5);
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.2, 0.35), sofaMat);
    sofaBack.position.set(cx - 2.5, INTERIOR_Y + 0.9, INTERIOR_Z + 1.0);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.48, 1.0), woodMat);
    table.position.set(cx - 2.5, INTERIOR_Y + 0.24, INTERIOR_Z - 1.4);
    group.add(sofa, sofaBack, table);

    // Wall Smart TV with live canvas texture
    const tvCanvas = document.createElement('canvas');
    tvCanvas.width = 512;
    tvCanvas.height = 256;
    const tvTex = new THREE.CanvasTexture(tvCanvas);
    tvTex.colorSpace = THREE.SRGBColorSpace;
    const tvScreenMat = new THREE.MeshStandardMaterial({
      map: tvTex,
      emissive: 0xffffff,
      emissiveMap: tvTex,
      emissiveIntensity: 0.75,
    });
    const tvBezel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.0, 0.14), wallDarkMat);
    tvBezel.position.set(cx - 2.5, INTERIOR_Y + 2.1, INTERIOR_Z - 7.6);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 1.8), tvScreenMat);
    tvScreen.position.set(cx - 2.5, INTERIOR_Y + 2.1, INTERIOR_Z - 7.51);
    group.add(tvBezel, tvScreen);

    // Bedroom Corner (Bed + Wardrobe)
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 2.6), woodMat);
    bedFrame.position.set(cx + 5.6, INTERIOR_Y + 0.28, INTERIOR_Z - 5.2);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 2.4), bedSheetMat);
    mattress.position.set(cx + 5.6, INTERIOR_Y + 0.65, INTERIOR_Z - 5.2);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.6), tileFloorMat);
    pillow.position.set(cx + 5.6, INTERIOR_Y + 0.88, INTERIOR_Z - 6.0);
    group.add(bedFrame, mattress, pillow);

    // Kitchen Counter + Fridge
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.2), steelMat);
    counter.position.set(cx + 5.5, INTERIOR_Y + 0.5, INTERIOR_Z + 3.2);
    const fridge = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 2.4, 1.05),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.5 })
    );
    fridge.position.set(cx + 7.8, INTERIOR_Y + 1.2, INTERIOR_Z + 1.4);
    group.add(counter, fridge);

    // Bathroom Shower Partition
    const showerGlass = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.15), skyViewMat);
    showerGlass.position.set(cx - 6.8, INTERIOR_Y + 1.3, INTERIOR_Z - 5.8);
    group.add(showerGlass);

    // Panoramic Window + Curtains on left wall
    const winPane = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 2.4), skyViewMat);
    winPane.rotation.y = Math.PI / 2;
    winPane.position.set(cx - 8.75, INTERIOR_Y + 2.3, INTERIOR_Z);
    const curtainL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 3.0), curtainMat);
    curtainL.position.set(cx - 8.55, INTERIOR_Y + 2.3, INTERIOR_Z - 1.5);
    const curtainR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 3.0), curtainMat);
    curtainR.position.set(cx - 8.55, INTERIOR_Y + 2.3, INTERIOR_Z + 1.5);
    group.add(winPane, curtainL, curtainR);

    const mainLight = new THREE.PointLight(0xfff7ed, 2.2, 28);
    mainLight.position.set(cx, INTERIOR_Y + 4.1, INTERIOR_Z);
    const warmLight = new THREE.PointLight(0xfde68a, 1.4, 18);
    warmLight.position.set(cx + 5.5, INTERIOR_Y + 3.6, INTERIOR_Z - 4);
    group.add(mainLight, warmLight);

    pockets[id] = {
      id,
      spawn: new THREE.Vector3(cx, INTERIOR_Y, INTERIOR_Z + 5.2),
      floorY: INTERIOR_Y,
      bounds: {
        minX: cx - w * 0.5 + 0.55,
        maxX: cx + w * 0.5 - 0.55,
        minY: INTERIOR_Y + 0.5,
        maxY: INTERIOR_Y + h - 0.45,
        minZ: INTERIOR_Z - d * 0.5 + 0.55,
        maxZ: INTERIOR_Z + d * 0.5 - 0.55,
      },
      colliders,
      lights: [mainLight, warmLight],
      curtains: [curtainL, curtainR],
      tvScreenMat,
      tvCanvas,
      tvTex,
      triggers: [
        { id: 'exit_door', label: 'Exit to Bengaluru Street [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z + 6.8, radius: 2.5 },
        { id: 'sofa', label: 'Sit / Relax on Sofa [F]', x: cx - 2.5, y: INTERIOR_Y, z: INTERIOR_Z - 0.3, radius: 2.4 },
        { id: 'tv', label: 'Watch / Switch TV Channel [F]', x: cx - 2.5, y: INTERIOR_Y, z: INTERIOR_Z - 5.8, radius: 3.0 },
        { id: 'bed', label: 'Sleep & Save (+Restore Health) [F]', x: cx + 5.6, y: INTERIOR_Y, z: INTERIOR_Z - 3.6, radius: 2.6 },
        { id: 'kitchen', label: 'Fridge & Cook Pantry Meal [F]', x: cx + 5.8, y: INTERIOR_Y, z: INTERIOR_Z + 1.8, radius: 2.8 },
        { id: 'shower', label: 'Take Refreshing Shower (+Stamina) [F]', x: cx - 6.8, y: INTERIOR_Y, z: INTERIOR_Z - 4.4, radius: 2.4 },
        { id: 'lights', label: 'Toggle Home Lights [F]', x: cx - 2.4, y: INTERIOR_Y, z: INTERIOR_Z + 6.4, radius: 2.1 },
        { id: 'curtains', label: 'Open / Close Curtains [F]', x: cx - 7.4, y: INTERIOR_Y, z: INTERIOR_Z, radius: 2.5 },
      ],
    };
  });

  // 4. Namma Mart Supermarket (cx = +200)
  {
    const cx = 200;
    const colliders: BuildingCollider[] = [];
    addBoxRoom(cx, 24, 5.2, 20, tileFloorMat, wallCoolMat, colliders);
    const triggers: InteriorTrigger[] = [
      { id: 'exit_door', label: 'Exit Namma Mart [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z + 8.6, radius: 2.6 },
      { id: 'checkout', label: 'Billing Counter & Pay [F]', x: cx - 7.5, y: INTERIOR_Y, z: INTERIOR_Z + 6.2, radius: 3.2 },
    ];

    const categories = ['Dairy', 'Bakery', 'Grains', 'Produce', 'Snacks', 'Beverages'];
    categories.forEach((cat, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const ax = cx - 6 + col * 6;
      const az = INTERIOR_Z - 4.5 + row * 6.0;
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 2.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 })
      );
      rack.position.set(ax, INTERIOR_Y + 1.1, az);
      group.add(rack);
      // Colored item boxes on shelves
      const items = GROCERY_ITEMS.filter((g) => g.category === cat);
      items.forEach((item, ii) => {
        const pkg = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.55, 0.55),
          new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.4 })
        );
        pkg.position.set(ax - 1.1 + ii * 1.1, INTERIOR_Y + 2.45, az);
        group.add(pkg);
      });
      triggers.push({
        id: 'shelf',
        label: `Browse ${cat} Aisle [F]`,
        x: ax,
        y: INTERIOR_Y,
        z: az + 1.6,
        radius: 2.8,
        shelfCategory: cat,
      });
    });

    const billingCounter = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 1.5), steelMat);
    billingCounter.position.set(cx - 7.5, INTERIOR_Y + 0.55, INTERIOR_Z + 4.8);
    group.add(billingCounter);

    const l1 = new THREE.PointLight(0xffffff, 2.4, 34);
    l1.position.set(cx, INTERIOR_Y + 4.6, INTERIOR_Z);
    group.add(l1);

    pockets.namma_mart = {
      id: 'namma_mart',
      spawn: new THREE.Vector3(cx, INTERIOR_Y, INTERIOR_Z + 6.8),
      floorY: INTERIOR_Y,
      bounds: {
        minX: cx - 11.4,
        maxX: cx + 11.4,
        minY: INTERIOR_Y + 0.5,
        maxY: INTERIOR_Y + 4.7,
        minZ: INTERIOR_Z - 9.4,
        maxZ: INTERIOR_Z + 9.4,
      },
      colliders,
      triggers,
      lights: [l1],
      curtains: [],
    };
  }

  // 5. Deccan Tactical Armory (cx = +400)
  {
    const cx = 400;
    const colliders: BuildingCollider[] = [];
    addBoxRoom(cx, 16, 4.5, 14, rubberFloorMat, wallDarkMat, colliders);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.15, 1.4), steelMat);
    desk.position.set(cx, INTERIOR_Y + 0.58, INTERIOR_Z - 3.2);
    const backRack = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 2.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    );
    backRack.position.set(cx, INTERIOR_Y + 1.6, INTERIOR_Z - 6.4);
    group.add(desk, backRack);

    const l1 = new THREE.PointLight(0xf59e0b, 2.0, 26);
    l1.position.set(cx, INTERIOR_Y + 3.8, INTERIOR_Z);
    group.add(l1);

    pockets.weapon_shop = {
      id: 'weapon_shop',
      spawn: new THREE.Vector3(cx, INTERIOR_Y, INTERIOR_Z + 4.4),
      floorY: INTERIOR_Y,
      bounds: {
        minX: cx - 7.4,
        maxX: cx + 7.4,
        minY: INTERIOR_Y + 0.5,
        maxY: INTERIOR_Y + 4.1,
        minZ: INTERIOR_Z - 6.4,
        maxZ: INTERIOR_Z + 6.4,
      },
      colliders,
      lights: [l1],
      curtains: [],
      triggers: [
        { id: 'exit_door', label: 'Exit Armory [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z + 6.0, radius: 2.5 },
        { id: 'armory_counter', label: 'Open Armory Weapons & Ammo [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z - 1.6, radius: 3.2 },
      ],
    };
  }

  // 6. Koramangala Iron Club Gym (cx = +600)
  {
    const cx = 600;
    const colliders: BuildingCollider[] = [];
    addBoxRoom(cx, 20, 4.8, 16, rubberFloorMat, wallDarkMat, colliders);
    for (let i = -1; i <= 1; i++) {
      const treadmill = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 2.4), steelMat);
      treadmill.position.set(cx + i * 3.0, INTERIOR_Y + 0.2, INTERIOR_Z - 4.0);
      group.add(treadmill);
    }
    const bag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    );
    bag.position.set(cx + 6.2, INTERIOR_Y + 1.7, INTERIOR_Z);
    group.add(bag);

    const l1 = new THREE.PointLight(0x38bdf8, 2.2, 28);
    l1.position.set(cx, INTERIOR_Y + 4.2, INTERIOR_Z);
    group.add(l1);

    pockets.bengaluru_gym = {
      id: 'bengaluru_gym',
      spawn: new THREE.Vector3(cx, INTERIOR_Y, INTERIOR_Z + 5.2),
      floorY: INTERIOR_Y,
      bounds: {
        minX: cx - 9.4,
        maxX: cx + 9.4,
        minY: INTERIOR_Y + 0.5,
        maxY: INTERIOR_Y + 4.4,
        minZ: INTERIOR_Z - 7.4,
        maxZ: INTERIOR_Z + 7.4,
      },
      colliders,
      lights: [l1],
      curtains: [],
      triggers: [
        { id: 'exit_door', label: 'Exit Gym [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z + 6.8, radius: 2.5 },
        { id: 'gym_workout', label: 'Train Strength & Stamina (+Max Armor/Health) [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z - 2.0, radius: 4.5 },
      ],
    };
  }

  // 7. Bengaluru Police Station & Lockup Jail (cx = +800)
  {
    const cx = 800;
    const colliders: BuildingCollider[] = [];
    const w = 18;
    const d = 16;
    const h = 4.6;
    addBoxRoom(cx, w, h, d, tileFloorMat, wallCoolMat, colliders);

    // Police Booking Counter + Monitor + Officer Bench
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.15, 1.4), woodMat);
    desk.position.set(cx + 3.2, INTERIOR_Y + 0.58, INTERIOR_Z - 2.2);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.12, 1.6), steelMat);
    deskTop.position.set(cx + 3.2, INTERIOR_Y + 1.18, INTERIOR_Z - 2.2);
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.58, 0.1), wallDarkMat);
    monitor.position.set(cx + 2.4, INTERIOR_Y + 1.55, INTERIOR_Z - 2.2);
    const monitorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.46),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.75 })
    );
    monitorGlow.position.set(cx + 2.4, INTERIOR_Y + 1.55, INTERIOR_Z - 2.14);
    group.add(desk, deskTop, monitor, monitorGlow);

    // Karnataka Police Crest Header Board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.2, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x1e3a8a, emissiveIntensity: 0.35 })
    );
    board.position.set(cx + 3.2, INTERIOR_Y + 3.0, INTERIOR_Z - 7.7);
    group.add(board);

    // Lockup Cell Bars (Left wing x: cx - 8.8 .. cx - 2.2, z: INTERIOR_Z - 7.8 .. INTERIOR_Z - 0.5)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.85 });
    for (let bz = INTERIOR_Z - 7.2; bz <= INTERIOR_Z - 0.8; bz += 0.62) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, h - 0.2, 8), barMat);
      bar.position.set(cx - 2.4, INTERIOR_Y + h * 0.5, bz);
      group.add(bar);
    }
    const cellHeaderBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 7.6), barMat);
    cellHeaderBar.position.set(cx - 2.4, INTERIOR_Y + 2.8, INTERIOR_Z - 4.0);
    const cellCot = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 1.2), bedSheetMat);
    cellCot.position.set(cx - 6.6, INTERIOR_Y + 0.23, INTERIOR_Z - 6.0);
    const cellWallFront = new THREE.Mesh(new THREE.BoxGeometry(6.4, h, 0.24), wallDarkMat);
    cellWallFront.position.set(cx - 5.6, INTERIOR_Y + h * 0.5, INTERIOR_Z - 0.5);
    group.add(cellHeaderBar, cellCot, cellWallFront);

    colliders.push(
      { minX: cx - 9.0, maxX: cx - 2.2, minZ: INTERIOR_Z - 0.8, maxZ: INTERIOR_Z - 0.2, height: INTERIOR_Y + h },
      { minX: cx - 2.6, maxX: cx - 2.1, minZ: INTERIOR_Z - 7.8, maxZ: INTERIOR_Z - 2.8, height: INTERIOR_Y + h }
    );

    const l1 = new THREE.PointLight(0xfef3c7, 2.2, 30);
    l1.position.set(cx, INTERIOR_Y + 4.0, INTERIOR_Z);
    const l2 = new THREE.PointLight(0x93c5fd, 1.4, 18);
    l2.position.set(cx - 5.4, INTERIOR_Y + 3.6, INTERIOR_Z - 4.0);
    group.add(l1, l2);

    pockets.police_jail = {
      id: 'police_jail',
      spawn: new THREE.Vector3(cx + 1.8, INTERIOR_Y, INTERIOR_Z + 1.2),
      floorY: INTERIOR_Y,
      bounds: {
        minX: cx - 8.4,
        maxX: cx + 8.4,
        minY: INTERIOR_Y + 0.5,
        maxY: INTERIOR_Y + h - 0.4,
        minZ: INTERIOR_Z - 7.4,
        maxZ: INTERIOR_Z + 7.4,
      },
      colliders,
      lights: [l1, l2],
      curtains: [],
      triggers: [
        { id: 'jail_booking', label: 'Police Booking & Bail Counter [F]', x: cx + 3.0, y: INTERIOR_Y, z: INTERIOR_Z - 0.5, radius: 3.6 },
        { id: 'exit_door', label: 'Exit Police Station [F]', x: cx, y: INTERIOR_Y, z: INTERIOR_Z + 6.8, radius: 2.8 },
      ],
    };
  }

  scene.add(group);

  const updateHomeVisuals = (
    interiorId: InteriorId | null,
    lightsOn: boolean,
    curtainsOpen: boolean,
    tvOn: boolean,
    tvChannel: number
  ) => {
    if (!interiorId) return;
    const p = pockets[interiorId];
    if (!p) return;

    p.lights.forEach((l) => {
      l.intensity = lightsOn ? 2.1 : 0.22;
    });
    if (p.curtains.length === 2) {
      p.curtains[0].position.z = INTERIOR_Z + (curtainsOpen ? -2.7 : -1.45);
      p.curtains[1].position.z = INTERIOR_Z + (curtainsOpen ? 2.7 : 1.45);
    }

    if (p.tvCanvas && p.tvTex && p.tvScreenMat) {
      const ctx = p.tvCanvas.getContext('2d')!;
      if (!tvOn) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, 512, 256);
        p.tvScreenMat.emissiveIntensity = 0.05;
      } else {
        const ch = TV_CHANNELS.find((c) => c.channel === tvChannel) || TV_CHANNELS[0];
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = ch.color;
        ctx.fillRect(0, 0, 512, 54);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`CH ${ch.channel}: ${ch.name}`, 20, 36);
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(ch.kannadaName, 20, 108);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '18px sans-serif';
        ctx.fillText(ch.program, 20, 148);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 204, 512, 52);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '15px sans-serif';
        ctx.fillText(ch.ticker.slice(0, 58), 16, 236);
        p.tvScreenMat.emissiveIntensity = 0.9;
      }
      p.tvTex.needsUpdate = true;
    }
  };

  return { group, pockets, updateHomeVisuals };
}
