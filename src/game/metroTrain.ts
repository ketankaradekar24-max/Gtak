import * as THREE from 'three';
import { NpcArchetype, createArchetypeHuman, HumanRig, updateHumanAnimation } from './humans';
import { TextureBundle } from './textures';
import { BuildingCollider, LanguageId, MetroLineId, MetroTrainPhase } from './types';

export const METRO_DOOR_X = [-36.6, -29.4, -20.1, -12.9, -3.6, 3.6, 12.9, 20.1, 29.4, 36.6] as const;

export const METRO_COACH_OFFSETS = [-18, 0, 18, 36] as const;

export function getActiveCoachIndex(pz: number): number {
  const relZ = pz - (-1200);
  if (relZ < -9) return 1;
  if (relZ < 9) return 2;
  if (relZ < 27) return 3;
  return 4;
}

export interface MetroConversationLine {
  id: string;
  speaker: string;
  kn: string;
  en: string;
  hi: string;
  ta: string;
  te: string;
}

export const METRO_PASSENGER_CONVERSATIONS: MetroConversationLine[] = [
  {
    id: 'conv_crowded',
    speaker: 'Commuter Ramesh',
    kn: 'ಇವತ್ತು ಮೆಟ್ರೋ ತುಂಬಾ ಜನ ಇದೆ.',
    en: 'Metro is very crowded today.',
    hi: 'आज मेट्रो में बहुत भीड़ है।',
    ta: 'இன்று மெட்ரோவில் கூட்டம் அதிகமாக உள்ளது.',
    te: 'ఈరోజు మెట్రోలో చాలా రద్దీగా ఉంది.',
  },
  {
    id: 'conv_office',
    speaker: 'IT Engineer Ananya',
    kn: 'ಹೌದು, ಆಫೀಸ್ ಸಮಯ ಅಲ್ವಾ.',
    en: 'Yes, it is office rush hour.',
    hi: 'हाँ, ऑफिस का समय है ना।',
    ta: 'ஆம், அலுவலக நேரம் அல்லவா.',
    te: 'అవును, ఆఫీసు సమయం కదా.',
  },
  {
    id: 'conv_college',
    speaker: 'Student Karthik',
    kn: 'ನೀನು ಯಾವ ಕಾಲೇಜಿಗೆ ಹೋಗ್ತಿದ್ದೀಯ?',
    en: 'Which college are you going to?',
    hi: 'तुम किस कॉलेज जा रहे हो?',
    ta: 'நீங்கள் எந்த கல்லூரிக்குச் செல்கிறீர்கள்?',
    te: 'మీరు ఏ కాలేజీకి వెళుతున్నారు?',
  },
  {
    id: 'conv_mg_road',
    speaker: 'Student Kavya',
    kn: 'ನಾನು ಎಂಜಿ ರಸ್ತೆಗೆ ಹೋಗ್ತಿದ್ದೀನಿ.',
    en: 'I am going to MG Road.',
    hi: 'मैं एमजी रोड जा रही हूँ।',
    ta: 'நான் எம்.ஜி சாலைக்குச் செல்கிறேன்.',
    te: 'నేను ఎంజీ రోడ్డుకు వెళ్తున్నాను.',
  },
  {
    id: 'conv_trinity',
    speaker: 'Senior Citizen Narayan',
    kn: 'ಟ್ರಿನಿಟಿ ಸ್ಟೇಷನ್ ಮುಂದಿನ ಸ್ಟಾಪ್.',
    en: 'Trinity Station is the next stop.',
    hi: 'ट्रिनिटी स्टेशन अगला स्टॉप है।',
    ta: 'டிரினிட்டி நிலையம் அடுத்த நிறுத்தம்.',
    te: 'ట్రినిటీ స్టేషన్ తదుపరి స్టాప్.',
  },
  {
    id: 'conv_way',
    speaker: 'Office Commuter Deepa',
    kn: 'ಸ್ವಲ್ಪ ದಾರಿ ಬಿಡಿ ಸರ್.',
    en: 'Please give a little way, sir.',
    hi: 'कृपया थोड़ा रास्ता दीजिए सर।',
    ta: 'கொஞ்சம் வழி விடுங்கள் சார்.',
    te: 'దయచేసి కొంచెం దారి ఇవ్వండి సర్.',
  },
];

export function formatMetroDialogue(entry: MetroConversationLine, lang: LanguageId): string {
  if (lang === 'kn') return `${entry.kn} (${entry.en})`;
  if (lang === 'hi') return `${entry.kn} · ${entry.hi}`;
  if (lang === 'ta') return `${entry.kn} · ${entry.ta}`;
  if (lang === 'te') return `${entry.kn} · ${entry.te}`;
  return `${entry.kn} — "${entry.en}"`;
}

export interface MetroCoachTrigger {
  id: 'leave_train' | 'train_seat' | 'hold_rail' | 'talk_passenger';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface PlatformTrainHandles {
  group: THREE.Group;
  stripeMat: THREE.MeshStandardMaterial;
  slidingLeftDoors: THREE.Mesh[];
  slidingRightDoors: THREE.Mesh[];
  doorStatusMats: THREE.MeshStandardMaterial[];
  bogieWheels: THREE.Mesh[];
  updateLedHeader: (line: MetroLineId, destText: string, trainPhase: MetroTrainPhase) => void;
}

export function buildDetailedPlatformTrain(
  steelMat: THREE.Material,
  darkMetalMat: THREE.Material,
  glassMat: THREE.Material
): PlatformTrainHandles {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8eef5,
    roughness: 0.18,
    metalness: 0.78,
    clearcoat: 0.94,
    clearcoatRoughness: 0.14,
  });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.28, metalness: 0.2 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88 });
  const interiorWarmMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 0.62,
  });
  const seatBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 });

  // Dynamic Livery + Destination LED Texture
  const liveryCanvas = document.createElement('canvas');
  liveryCanvas.width = 512;
  liveryCanvas.height = 96;
  const liveryTex = new THREE.CanvasTexture(liveryCanvas);
  liveryTex.colorSpace = THREE.SRGBColorSpace;
  const liveryMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    emissive: 0xffffff,
    emissiveMap: liveryTex,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });

  const slidingLeftDoors: THREE.Mesh[] = [];
  const slidingRightDoors: THREE.Mesh[] = [];
  const doorStatusMats: THREE.MeshStandardMaterial[] = [];
  const bogieWheels: THREE.Mesh[] = [];

  [-33, -16.5, 0, 16.5, 33].forEach((carX, carIdx) => {
    const car = new THREE.Group();
    car.position.x = carX;

    // Underframe skirt + Lower stainless hull + Roof crown + HVAC Pods
    const underFrame = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.72, 3.16), darkMetalMat);
    underFrame.position.y = 0.54;
    const lowerSide = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.98, 3.12), shellMat);
    lowerSide.position.y = 1.26;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(15.26, 0.44, 3.15), stripeMat);
    stripe.position.y = 1.16;
    const upperBand = new THREE.Mesh(new THREE.BoxGeometry(15.26, 0.42, 3.12), shellMat);
    upperBand.position.y = 3.18;
    const roofCrown = new THREE.Mesh(new THREE.BoxGeometry(15.1, 0.32, 2.86), shellMat);
    roofCrown.position.y = 3.54;

    // Rooftop HVAC & Collector Equipment
    [-4.2, 4.2].forEach((hx) => {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 1.85), steelMat);
      hvac.position.set(hx, 3.82, 0);
      car.add(hvac);
    });
    if (carIdx === 2) {
      const pantoBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 1.3), darkMetalMat);
      pantoBase.position.set(0, 3.78, 0);
      const pantoArm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.9), steelMat);
      pantoArm.position.set(0, 4.18, 0);
      car.add(pantoBase, pantoArm);
    }

    // Illuminated cabin interior visible through passenger windows (pillars + seats + lights)
    const cabinGlow = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.35, 2.3), interiorWarmMat);
    cabinGlow.position.y = 2.42;
    const interiorSeatL = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.46, 0.55), seatBlueMat);
    interiorSeatL.position.set(0, 1.48, -0.95);
    const interiorSeatR = interiorSeatL.clone();
    interiorSeatR.position.set(0, 1.48, 0.95);
    const winGlass = new THREE.Mesh(new THREE.BoxGeometry(14.3, 1.18, 3.12), glassMat);
    winGlass.position.y = 2.42;

    // Window Mullion Pillars
    for (let px = -6.8; px <= 6.8; px += 1.7) {
      if (Math.abs(Math.abs(px) - 3.6) < 0.9) continue; // skip doorway gaps
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.24, 3.16), shellMat);
      pillar.position.set(px, 2.42, 0);
      car.add(pillar);
    }

    // Side Namma Metro Livery & Destination Sign
    const sideSign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.36), liveryMat);
    sideSign.position.set(0, 3.18, 1.58);
    car.add(underFrame, lowerSide, stripe, upperBand, roofCrown, cabinGlow, interiorSeatL, interiorSeatR, winGlass, sideSign);

    // Aerodynamic Beveled Cab Noses on End Cars (Car 1 and Car 5)
    if (carIdx === 0 || carIdx === 4) {
      const signX = carIdx === 4 ? 1 : -1;
      const cabLower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.65, 2.94), shellMat);
      cabLower.position.set(signX * 8.15, 1.35, 0);
      const cabUpper = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.55, 2.75), darkMetalMat);
      cabUpper.position.set(signX * 8.05, 2.65, 0);
      cabUpper.rotation.z = -signX * 0.26;
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.22, 2.25), glassMat);
      windshield.position.set(signX * 8.8, 2.55, 0);
      windshield.rotation.z = -signX * 0.26;
      const destHeader = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 2.0), liveryMat);
      destHeader.position.set(signX * 8.58, 3.22, 0);
      destHeader.rotation.y = signX > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

      const headlight = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.24, 0.55),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 1.9 })
      );
      headlight.position.set(signX * 8.98, 1.24, -0.78);
      const headlightR = headlight.clone();
      headlightR.position.z = 0.78;

      const tailLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.18, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 })
      );
      tailLight.position.set(signX * 8.98, 1.58, 0);

      const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 0.45), darkMetalMat);
      coupler.position.set(signX * 9.05, 0.62, 0);
      car.add(cabLower, cabUpper, windshield, destHeader, headlight, headlightR, tailLight, coupler);
    }

    // Dual Bogies & Steel Wheels
    [-5.0, 5.0].forEach((bx) => {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.38, 2.25), darkMetalMat);
      bogie.position.set(bx, 0.26, 0);
      car.add(bogie);
      [-0.86, 0.86].forEach((wx) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.22, 14), steelMat);
        wheel.rotation.x = Math.PI * 0.5;
        wheel.position.set(bx + wx, 0.36, 1.14);
        car.add(wheel);
        bogieWheels.push(wheel);
      });
    });

    // Two bi-parting sliding door pairs facing platform (+Z side) at dx = -3.6, +3.6
    // Matches METRO_DOOR_X (10 portals across 5 cars)
    [-3.6, 3.6].forEach((dx) => {
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 0.12), darkMetalMat);
      doorFrame.position.set(dx, 2.08, 1.56);
      car.add(doorFrame);

      const dL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.16, 0.1), steelMat);
      dL.position.set(dx - 0.49, 2.05, 1.62);
      dL.userData.baseX = dx - 0.49;
      const dWinL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.92, 0.12), glassMat);
      dWinL.position.set(0, 0.34, 0);
      dL.add(dWinL);

      const dR = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.16, 0.1), steelMat);
      dR.position.set(dx + 0.49, 2.05, 1.62);
      dR.userData.baseX = dx + 0.49;
      const dWinR = dWinL.clone();
      dR.add(dWinR);

      const statusMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.9,
      });
      const statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.14), statusMat);
      statusLed.position.set(dx, 3.26, 1.62);

      car.add(dL, dR, statusLed);
      slidingLeftDoors.push(dL);
      slidingRightDoors.push(dR);
      doorStatusMats.push(statusMat);
    });

    group.add(car);
  });

  // Accordion Gangway Bellows between 5 cars
  [-24.75, -8.25, 8.25, 24.75].forEach((gx) => {
    const gangway = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.75, 2.45), rubberMat);
    gangway.position.set(gx, 2.1, 0);
    group.add(gangway);
  });

  let lastKey = '';
  const updateLedHeader = (line: MetroLineId, destText: string, trainPhase: MetroTrainPhase) => {
    const key = `${line}|${destText}|${trainPhase}`;
    if (key === lastKey) return;
    lastKey = key;

    const hexMap: Record<MetroLineId, string> = {
      purple: '#9333ea',
      green: '#16a34a',
      yellow: '#eab308',
      pink: '#ec4899',
      blue: '#2563eb',
    };
    const ctx = liveryCanvas.getContext('2d')!;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = hexMap[line];
    ctx.fillRect(0, 0, 512, 16);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ನಮ್ಮ ಮೆಟ್ರೋ  ·  NAMMA METRO`, 256, 46);
    ctx.fillStyle = trainPhase === 'boarding' ? '#4ade80' : '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${line.toUpperCase()} → ${destText.slice(0, 22).toUpperCase()}`, 256, 78);
    liveryTex.needsUpdate = true;
  };

  return {
    group,
    stripeMat,
    slidingLeftDoors,
    slidingRightDoors,
    doorStatusMats,
    bogieWheels,
    updateLedHeader,
  };
}

export interface CoachPassengerState {
  id: string;
  archetype: NpcArchetype;
  speaker: string;
  mode: 'sit' | 'stand_strap' | 'stand_door';
  homeX: number;
  homeY: number;
  homeZ: number;
  rotY: number;
  phase: number;
  conversationIdx: number;
  talkTimer: number;
  rig?: HumanRig;
}

export interface WalkableMetroCoachHandles {
  trainX: number;
  trainY: number;
  trainZ: number;
  coachCount: number;
  passengerCount: number;
  colliders: BuildingCollider[];
  triggers: MetroCoachTrigger[];
  passengers: CoachPassengerState[];
  interactNearestPassenger: (
    px: number,
    pz: number,
    lang: LanguageId
  ) => { speaker: string; text: string; passengerId: string } | null;
  getNearestPassengerPrompt: (px: number, pz: number) => string | null;
  update: (params: {
    dt: number;
    elapsed: number;
    isRiding: boolean;
    isArrived: boolean;
    trainSpeedKmh: number;
    coachDoorOpen: number;
    line: MetroLineId;
    destinationName: string;
    nextStopText: string;
    stopsRemaining: number;
    rideProgress: number;
  }) => void;
}

export function buildWalkableMetroCoach(
  group: THREE.Group,
  steelMat: THREE.Material,
  darkMetalMat: THREE.Material,
  graniteMat: THREE.Material,
  wallMat: THREE.Material,
  glassMat: THREE.Material,
  ledBoardMat: THREE.Material,
  textures?: TextureBundle
): WalkableMetroCoachHandles {
  const trainX = 300;
  const trainY = -140;
  const trainZ = -1200;

  const coachGroup = new THREE.Group();
  group.add(coachGroup);

  const floorRibMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72, metalness: 0.14 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.08 });
  const seatBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.46 });
  const seatPriorityMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.44 });
  const yellowStrapMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const gangwayRubberMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const emergencyRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });

  // Dynamic Bilingual LED Route Progress Strip & Bengaluru Ad Posters
  const routeLedCanvas = document.createElement('canvas');
  routeLedCanvas.width = 512;
  routeLedCanvas.height = 96;
  const routeLedTex = new THREE.CanvasTexture(routeLedCanvas);
  routeLedTex.colorSpace = THREE.SRGBColorSpace;
  const routeLedMat = new THREE.MeshStandardMaterial({
    map: routeLedTex,
    emissive: 0xffffff,
    emissiveMap: routeLedTex,
    emissiveIntensity: 0.75,
  });

  const adCanvas = document.createElement('canvas');
  adCanvas.width = 256;
  adCanvas.height = 96;
  const adCtx = adCanvas.getContext('2d')!;
  adCtx.fillStyle = '#7c2d12';
  adCtx.fillRect(0, 0, 256, 96);
  adCtx.strokeStyle = '#facc15';
  adCtx.lineWidth = 4;
  adCtx.strokeRect(4, 4, 248, 88);
  adCtx.fillStyle = '#fef08a';
  adCtx.font = 'bold 20px sans-serif';
  adCtx.textAlign = 'center';
  adCtx.fillText('ಕಾವೇರಿ ಫಿಲ್ಟರ್ ಕಾಫಿ', 128, 42);
  adCtx.fillStyle = '#ffffff';
  adCtx.font = '14px sans-serif';
  adCtx.fillText('NAMMA BENGALURU HERITAGE', 128, 72);
  const adTex = new THREE.CanvasTexture(adCanvas);
  adTex.colorSpace = THREE.SRGBColorSpace;
  const adMat = new THREE.MeshStandardMaterial({ map: adTex, roughness: 0.4 });

  const doorPanels: Array<{ left: THREE.Mesh; right: THREE.Mesh; baseZ: number }> = [];
  const hangingStraps: Array<{ mesh: THREE.Mesh; baseRot: number; phase: number }> = [];
  const triggers: MetroCoachTrigger[] = [];

  const makeBench = (x: number, z: number, len: number, priority = false) => {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.48, len),
      priority ? seatPriorityMat : seatBlueMat
    );
    b.position.set(x, trainY + 0.28, z);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.58, len),
      priority ? seatPriorityMat : seatBlueMat
    );
    back.position.set(x + (x > trainX ? 0.34 : -0.34), trainY + 0.72, z);
    coachGroup.add(b, back);
  };

  // Build 4 Connected Walkable Coaches (centered at Z offsets [-18, 0, +18, +36])
  METRO_COACH_OFFSETS.forEach((offsetZ, cIdx) => {
    const cz = trainZ + offsetZ;
    const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.32, 16.6), floorRibMat);
    cabinFloor.position.set(trainX, trainY - 0.16, cz);
    const centerTactile = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 16.0), yellowStrapMat);
    centerTactile.position.set(trainX, trainY + 0.01, cz);
    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.3, 16.6), ceilingMat);
    cabinRoof.position.set(trainX, trainY + 3.28, cz);
    coachGroup.add(cabinFloor, centerTactile, cabinRoof);

    // Recessed LED light strips & AC diffuser grilles
    [-4.5, 4.5].forEach((lz) => {
      const ledStripL = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.06, 4.6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf8fafc, emissiveIntensity: 1.25 })
      );
      ledStripL.position.set(trainX - 0.95, trainY + 3.1, cz + lz);
      const ledStripR = ledStripL.clone();
      ledStripR.position.x = trainX + 0.95;
      const acVent = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 2.2), darkMetalMat);
      acVent.position.set(trainX, trainY + 3.12, cz + lz);
      coachGroup.add(ledStripL, ledStripR, acVent);
    });

    // Side Walls + Panoramic Windows + 2 Door Portals per Coach at cz - 4.2 and cz + 4.2
    [-2.16, 2.16].forEach((ox) => {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.04, 16.6), wallMat);
      lower.position.set(trainX + ox, trainY + 0.52, cz);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 16.6), wallMat);
      upper.position.set(trainX + ox, trainY + 2.9, cz);
      coachGroup.add(lower, upper);

      const winSegments: Array<[number, number]> =
        ox < 0
          ? [
              [-6.6, 2.4],
              [0, 5.8],
              [6.6, 2.4],
            ]
          : [[0, 15.6]];
      winSegments.forEach(([wz, len]) => {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.54, len), glassMat);
        glass.position.set(trainX + ox, trainY + 1.82, cz + wz);
        coachGroup.add(glass);
      });

      for (let mz = -7.0; mz <= 7.0; mz += 2.35) {
        if (ox < 0 && (Math.abs(mz + 4.2) < 1.15 || Math.abs(mz - 4.2) < 1.15)) continue;
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.6, 0.24), steelMat);
        mullion.position.set(trainX + ox, trainY + 1.82, cz + mz);
        coachGroup.add(mullion);
      }
    });

    // Bi-parting Coach Doors on left boarding side (cz - 4.2, cz + 4.2)
    [-4.2, 4.2].forEach((dz) => {
      const dL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.38, 1.1), steelMat);
      dL.position.set(trainX - 2.12, trainY + 1.24, cz + dz - 0.55);
      const dR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.38, 1.1), steelMat);
      dR.position.set(trainX - 2.12, trainY + 1.24, cz + dz + 0.55);
      const dGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.72), glassMat);
      dGlassL.position.set(0, 0.35, 0);
      dL.add(dGlassL);
      const dGlassR = dGlassL.clone();
      dR.add(dGlassR);
      coachGroup.add(dL, dR);
      doorPanels.push({ left: dL, right: dR, baseZ: cz + dz });

      triggers.push({
        id: 'leave_train',
        label: 'Alight Metro Train [F]',
        x: trainX - 1.4,
        y: trainY,
        z: cz + dz,
        radius: 3.1,
      });
    });

    // Cushioned Priority & General Longitudinal Benches
    makeBench(trainX - 1.56, cz - 6.7, 2.5, cIdx === 0);
    makeBench(trainX - 1.56, cz, 5.4, false);
    makeBench(trainX - 1.56, cz + 6.7, 2.5, false);
    makeBench(trainX + 1.56, cz - 6.7, 2.5, cIdx === 0);
    makeBench(trainX + 1.56, cz, 5.4, false);
    makeBench(trainX + 1.56, cz + 6.7, 2.5, false);

    // Overhead Handrail Bars, Swaying Straps & Vertical Stanchion Poles
    [-1.08, 1.08].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 15.6, 8), steelMat);
      rail.rotation.x = Math.PI * 0.5;
      rail.position.set(trainX + rx, trainY + 2.26, cz);
      coachGroup.add(rail);
      for (let sz = -6.2; sz <= 6.2; sz += 2.4) {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 12), yellowStrapMat);
        strap.position.set(trainX + rx, trainY + 2.04, cz + sz);
        coachGroup.add(strap);
        hangingStraps.push({ mesh: strap, baseRot: 0, phase: (offsetZ + sz) * 0.4 + rx });
      }
    });
    [-4.8, 0, 4.8].forEach((pz) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 3.1, 8), steelMat);
      pole.position.set(trainX, trainY + 1.55, cz + pz);
      coachGroup.add(pole);
    });

    // Emergency Stop Handle, Dynamic Route Strip, Ad Panel & Lighting
    const emergencyBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.32), emergencyRedMat);
    emergencyBox.position.set(trainX - 1.98, trainY + 1.65, cz - 2.6);
    const sideRouteStrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 3.8), routeLedMat);
    sideRouteStrip.position.set(trainX + 2.04, trainY + 2.68, cz);
    const adPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 2.2), adMat);
    adPanel.position.set(trainX - 2.02, trainY + 2.68, cz);
    const coachLight = new THREE.PointLight(0xfef9c3, 2.2, 22);
    coachLight.position.set(trainX, trainY + 2.85, cz);
    coachGroup.add(emergencyBox, sideRouteStrip, adPanel, coachLight);

    // Seat & Handrail triggers per coach
    triggers.push(
      { id: 'train_seat', label: 'Sit / Stand in Metro Seat [F]', x: trainX + 1.25, y: trainY, z: cz - 0.8, radius: 2.3 },
      { id: 'train_seat', label: 'Sit / Stand in Metro Seat [F]', x: trainX - 1.25, y: trainY, z: cz + 0.8, radius: 2.3 },
      { id: 'hold_rail', label: 'Hold Overhead Handrail [F]', x: trainX, y: trainY, z: cz, radius: 2.1 }
    );
  });

  // Walkable Open Accordion Gangway Tunnels linking all 4 coaches at Z offsets [-9, +9, +27]
  [-9, 9, 27].forEach((gzRel) => {
    const gz = trainZ + gzRel;
    const gFloor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.5), floorRibMat);
    gFloor.position.set(trainX, trainY - 0.15, gz);
    const gRoof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 1.5), gangwayRubberMat);
    gRoof.position.set(trainX, trainY + 2.85, gz);
    const gWallL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.9, 1.5), gangwayRubberMat);
    gWallL.position.set(trainX - 1.25, trainY + 1.45, gz);
    const gWallR = gWallL.clone();
    gWallR.position.set(trainX + 1.25, trainY + 1.45, gz);
    // Bulkhead trim shoulders outside the gangway opening
    const trimL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.3, 0.35), wallMat);
    trimL.position.set(trainX - 1.72, trainY + 1.65, gz);
    const trimR = trimL.clone();
    trimR.position.set(trainX + 1.72, trainY + 1.65, gz);
    coachGroup.add(gFloor, gRoof, gWallL, gWallR, trimL, trimR);
  });

  // Front Operator Cab Bulkhead (trainZ - 26.3) & Rear Cab Bulkhead (trainZ + 44.3)
  const frontCab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.3, 0.42), wallMat);
  frontCab.position.set(trainX, trainY + 1.65, trainZ - 26.3);
  const cabWindow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.46), glassMat);
  cabWindow.position.set(trainX, trainY + 1.85, trainZ - 26.3);
  const frontRouteStrip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.52, 0.12), ledBoardMat);
  frontRouteStrip.position.set(trainX, trainY + 2.66, trainZ - 26.02);
  const cctvDome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), darkMetalMat);
  cctvDome.position.set(trainX, trainY + 3.08, trainZ - 25.2);
  const rearCab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.3, 0.42), wallMat);
  rearCab.position.set(trainX, trainY + 1.65, trainZ + 44.3);
  coachGroup.add(frontCab, cabWindow, frontRouteStrip, cctvDome, rearCab);

  // Exterior Scrolling Bengaluru Skyline, Elevated Viaduct Piers, Trees & Streetlights outside windows
  const scrollingScenery = new THREE.Group();
  const concretePierMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
  for (let i = -14; i <= 18; i++) {
    const zPos = trainZ + i * 7.5;
    const viaductPillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 11, 0.85), concretePierMat);
    viaductPillar.position.set(trainX - 6.6, trainY + 1.0, zPos);
    const treeCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 0), foliageMat);
    treeCrown.position.set(trainX + 8.5, trainY + 0.5, zPos + 2.5);
    const towerL = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 18 + ((Math.abs(i) * 5) % 14), 4.6),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: i % 2 === 0 ? 0xf59e0b : 0x38bdf8,
        emissiveIntensity: 0.42,
      })
    );
    towerL.position.set(trainX - 18, trainY + 2.5, zPos);
    const towerR = towerL.clone();
    towerR.position.set(trainX + 18, trainY + 2.5, zPos + 3.5);
    scrollingScenery.add(viaductPillar, treeCrown, towerL, towerR);
  }
  coachGroup.add(scrollingScenery);

  // 18 Distinct Animated Metro Coach Passengers Distributed Across Coaches 1–4
  const passengerSpecs: Array<{
    id: string;
    arch: NpcArchetype;
    speaker: string;
    mode: 'sit' | 'stand_strap' | 'stand_door';
    x: number;
    z: number;
    rotY: number;
    convIdx: number;
  }> = [
    // Coach 1 (-18)
    { id: 'mpax_1', arch: 'kurta_citizen', speaker: 'Commuter Ramesh', mode: 'sit', x: trainX - 1.48, z: trainZ - 24.4, rotY: Math.PI * 0.5, convIdx: 0 },
    { id: 'mpax_2', arch: 'saree_woman', speaker: 'Senior Rider Kamala', mode: 'sit', x: trainX + 1.48, z: trainZ - 24.2, rotY: -Math.PI * 0.5, convIdx: 4 },
    { id: 'mpax_3', arch: 'student', speaker: 'Student Karthik', mode: 'stand_strap', x: trainX - 0.72, z: trainZ - 17.5, rotY: 0.2, convIdx: 2 },
    { id: 'mpax_4', arch: 'it_pro', speaker: 'Techie Meera', mode: 'sit', x: trainX + 1.48, z: trainZ - 12.2, rotY: -Math.PI * 0.5, convIdx: 1 },
    // Coach 2 (0 - Player Spawn Coach)
    { id: 'mpax_5', arch: 'it_pro', speaker: 'IT Engineer Ananya', mode: 'sit', x: trainX + 1.48, z: trainZ - 6.4, rotY: -Math.PI * 0.5, convIdx: 1 },
    { id: 'mpax_6', arch: 'saree_woman', speaker: 'Student Kavya', mode: 'sit', x: trainX - 1.48, z: trainZ - 1.2, rotY: Math.PI * 0.5, convIdx: 3 },
    { id: 'mpax_7', arch: 'elder', speaker: 'Senior Citizen Narayan', mode: 'sit', x: trainX + 1.48, z: trainZ + 1.2, rotY: -Math.PI * 0.5, convIdx: 4 },
    { id: 'mpax_8', arch: 'student', speaker: 'College Rider Vivek', mode: 'stand_door', x: trainX - 0.85, z: trainZ + 4.1, rotY: 2.8, convIdx: 2 },
    { id: 'mpax_9', arch: 'vendor', speaker: 'Trader Manjunath', mode: 'sit', x: trainX - 1.48, z: trainZ + 6.4, rotY: Math.PI * 0.5, convIdx: 0 },
    // Coach 3 (+18)
    { id: 'mpax_10', arch: 'it_pro', speaker: 'Office Commuter Deepa', mode: 'stand_strap', x: trainX + 0.72, z: trainZ + 14.5, rotY: -0.35, convIdx: 5 },
    { id: 'mpax_11', arch: 'saree_woman', speaker: 'Shopper Lakshmi', mode: 'sit', x: trainX + 1.48, z: trainZ + 17.4, rotY: -Math.PI * 0.5, convIdx: 0 },
    { id: 'mpax_12', arch: 'delivery_rider', speaker: 'Commuter Arun', mode: 'stand_strap', x: trainX - 0.68, z: trainZ + 20.8, rotY: 0.8, convIdx: 1 },
    { id: 'mpax_13', arch: 'student', speaker: 'Student Sneha', mode: 'sit', x: trainX - 1.48, z: trainZ + 24.1, rotY: Math.PI * 0.5, convIdx: 3 },
    { id: 'mpax_14', arch: 'kurta_citizen', speaker: 'Commuter Harish', mode: 'stand_door', x: trainX - 0.88, z: trainZ + 22.1, rotY: 2.5, convIdx: 5 },
    // Coach 4 (+36)
    { id: 'mpax_15', arch: 'it_pro', speaker: 'Architect Vikram', mode: 'sit', x: trainX + 1.48, z: trainZ + 30.2, rotY: -Math.PI * 0.5, convIdx: 1 },
    { id: 'mpax_16', arch: 'saree_woman', speaker: 'Teacher Savitha', mode: 'sit', x: trainX - 1.48, z: trainZ + 35.4, rotY: Math.PI * 0.5, convIdx: 4 },
    { id: 'mpax_17', arch: 'student', speaker: 'Runner Sanjay', mode: 'stand_strap', x: trainX + 0.65, z: trainZ + 38.2, rotY: -0.5, convIdx: 2 },
    { id: 'mpax_18', arch: 'elder', speaker: 'Elder Govind', mode: 'sit', x: trainX + 1.48, z: trainZ + 42.1, rotY: -Math.PI * 0.5, convIdx: 0 },
  ];

  const passengers: CoachPassengerState[] = passengerSpecs.map((spec, idx) => {
    const state: CoachPassengerState = {
      id: spec.id,
      archetype: spec.arch,
      speaker: spec.speaker,
      mode: spec.mode,
      homeX: spec.x,
      homeY: trainY,
      homeZ: spec.z,
      rotY: spec.rotY,
      phase: idx * 1.15,
      conversationIdx: spec.convIdx,
      talkTimer: 0,
    };
    if (textures) {
      const rig = createArchetypeHuman(spec.arch, 740 + idx, textures);
      rig.group.position.set(spec.x, trainY, spec.z);
      rig.group.rotation.y = spec.rotY;
      coachGroup.add(rig.group);
      state.rig = rig;
    }
    return state;
  });

  // Multi-Coach Wall & Gangway Shoulder Colliders (continuous walkable center aisle across Coaches 1–4)
  const colliders: BuildingCollider[] = [
    { minX: trainX - 2.45, maxX: trainX - 1.92, minZ: trainZ - 26.8, maxZ: trainZ + 44.8, height: trainY + 4 },
    { minX: trainX + 1.92, maxX: trainX + 2.45, minZ: trainZ - 26.8, maxZ: trainZ + 44.8, height: trainY + 4 },
    { minX: trainX - 2.45, maxX: trainX + 2.45, minZ: trainZ - 26.9, maxZ: trainZ - 26.0, height: trainY + 4 },
    { minX: trainX - 2.45, maxX: trainX + 2.45, minZ: trainZ + 44.0, maxZ: trainZ + 44.9, height: trainY + 4 },
  ];
  [-9, 9, 27].forEach((gzRel) => {
    const gz = trainZ + gzRel;
    colliders.push(
      { minX: trainX - 2.3, maxX: trainX - 1.15, minZ: gz - 0.65, maxZ: gz + 0.65, height: trainY + 4 },
      { minX: trainX + 1.15, maxX: trainX + 2.3, minZ: gz - 0.65, maxZ: gz + 0.65, height: trainY + 4 }
    );
  });

  const interactNearestPassenger = (
    px: number,
    pz: number,
    lang: LanguageId
  ): { speaker: string; text: string; passengerId: string } | null => {
    let best: CoachPassengerState | null = null;
    let bestD = 3.6;
    for (const p of passengers) {
      const d = Math.hypot(px - p.homeX, pz - p.homeZ);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return null;
    const conv = METRO_PASSENGER_CONVERSATIONS[best.conversationIdx % METRO_PASSENGER_CONVERSATIONS.length];
    best.conversationIdx = (best.conversationIdx + 1) % METRO_PASSENGER_CONVERSATIONS.length;
    best.talkTimer = 3.2;
    return {
      passengerId: best.id,
      speaker: best.speaker,
      text: formatMetroDialogue(conv, lang),
    };
  };

  const getNearestPassengerPrompt = (px: number, pz: number): string | null => {
    for (const p of passengers) {
      if (Math.hypot(px - p.homeX, pz - p.homeZ) < 3.4) {
        return `Talk to ${p.speaker} [F]`;
      }
    }
    return null;
  };

  let scrollOffset = 0;
  let lastRouteKey = '';

  const update: WalkableMetroCoachHandles['update'] = ({
    dt,
    elapsed,
    isRiding,
    isArrived,
    trainSpeedKmh,
    coachDoorOpen,
    line,
    destinationName,
    nextStopText,
    stopsRemaining,
    rideProgress,
  }) => {
    // Scroll outside elevated viaduct & skyline proportional to real train speed
    const scrollRate = isRiding ? Math.max(0.5, trainSpeedKmh * 0.42) : 0;
    if (scrollRate > 0) {
      scrollOffset = (scrollOffset + dt * scrollRate) % 15;
      scrollingScenery.position.z = scrollOffset;
    }

    // Bi-parting coach doors at z = trainZ ± 6.5
    const doorOffset = (isArrived ? 1 : coachDoorOpen) * 1.05;
    doorPanels.forEach((dp) => {
      dp.left.position.z = dp.baseZ - 0.56 - doorOffset;
      dp.right.position.z = dp.baseZ + 0.56 + doorOffset;
    });

    // Subtle hanging strap sway proportional to train motion
    const swayAmp = isRiding && trainSpeedKmh > 5 ? 0.14 : 0.025;
    hangingStraps.forEach((st) => {
      st.mesh.rotation.z = Math.sin(elapsed * 2.4 + st.phase) * swayAmp;
    });

    // Update interior digital route progress display
    const routeKey = `${line}|${nextStopText}|${stopsRemaining}|${Math.round(trainSpeedKmh)}|${Math.round(rideProgress * 20)}`;
    if (routeKey !== lastRouteKey) {
      lastRouteKey = routeKey;
      const rCtx = routeLedCanvas.getContext('2d')!;
      rCtx.fillStyle = '#020617';
      rCtx.fillRect(0, 0, 512, 96);
      rCtx.strokeStyle = '#334155';
      rCtx.lineWidth = 3;
      rCtx.strokeRect(2, 2, 508, 92);
      rCtx.fillStyle = '#38bdf8';
      rCtx.font = 'bold 20px monospace';
      rCtx.textAlign = 'left';
      rCtx.fillText(
        isArrived
          ? `ARRIVED: ${destinationName.toUpperCase()}`
          : `NEXT: ${nextStopText.toUpperCase()} (${stopsRemaining} LEFT)`,
        16,
        34
      );
      rCtx.fillStyle = '#facc15';
      rCtx.textAlign = 'right';
      rCtx.fillText(`${Math.round(trainSpeedKmh)} KM/H`, 494, 34);
      // Progress track bar
      rCtx.fillStyle = '#1e293b';
      rCtx.fillRect(16, 54, 480, 14);
      rCtx.fillStyle = '#22c55e';
      rCtx.fillRect(16, 54, Math.max(12, Math.round(480 * rideProgress)), 14);
      routeLedTex.needsUpdate = true;
    }

    // Animate 10 Metro Coach Passengers (train vibration, talking gestures, door exchange)
    const trainVibration = isRiding && trainSpeedKmh > 6 ? Math.sin(elapsed * 14) * 0.008 : 0;
    passengers.forEach((p) => {
      if (p.talkTimer > 0) p.talkTimer = Math.max(0, p.talkTimer - dt);
      if (!p.rig) return;

      // Passengers near doors shift slightly outward at intermediate stops as if exchanging riders
      const doorShift = p.mode === 'stand_door' && coachDoorOpen > 0.2 ? -coachDoorOpen * 0.48 : 0;
      const swayX = p.mode !== 'sit' && isRiding && trainSpeedKmh > 6 ? Math.sin(elapsed * 2.1 + p.phase) * 0.045 : 0;
      p.rig.group.position.set(p.homeX + doorShift + swayX, p.homeY + trainVibration, p.homeZ);

      updateHumanAnimation(p.rig, {
        pose: p.mode === 'sit' ? 'sit' : p.talkTimer > 0 ? 'talk' : 'idle',
        speedNorm: 0,
        stridePhase: 0,
        elapsed: elapsed + p.phase,
        dt,
        expression: p.talkTimer > 0 ? 'happy' : 'neutral',
        lookYaw: p.talkTimer > 0 ? Math.sin(elapsed * 3.5) * 0.3 : Math.sin(elapsed * 0.65 + p.phase) * 0.22,
        lookPitch: 0,
        holdingUmbrella: false,
        holdingPhone: p.mode === 'stand_strap' && p.talkTimer <= 0 && (p.phase % 2 > 0.8),
        simulateCloth: false,
      });
    });
  };

  return {
    trainX,
    trainY,
    trainZ,
    coachCount: METRO_COACH_OFFSETS.length,
    passengerCount: passengers.length,
    colliders,
    triggers,
    passengers,
    interactNearestPassenger,
    getNearestPassengerPrompt,
    update,
  };
}
