import * as THREE from 'three';
import { ClothSolver, ClothUpdateContext } from './cloth';
import { SkinMaps, TextureBundle } from './textures';
import {
  BeardStyleId,
  FacePresetId,
  HairStyleId,
  OutfitStyleId,
  PlayerCustomization,
  ProtagonistId,
} from './types';

export type HumanPoseState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'jump'
  | 'turn'
  | 'crouch'
  | 'sit'
  | 'swim'
  | 'climb_stairs'
  | 'open_door'
  | 'enter_car'
  | 'exit_car'
  | 'talk'
  | 'phone'
  | 'eat'
  | 'drink_coffee'
  | 'react_fear'
  | 'fight'
  | 'kick'
  | 'block'
  | 'dodge'
  | 'hit_react'
  | 'knockdown'
  | 'recover'
  | 'handcuffed'
  | 'arrest_approach'
  | 'traffic_direct'
  | 'queue_wait'
  | 'bag_scan';

export type NpcArchetype =
  | 'it_pro'
  | 'student'
  | 'saree_woman'
  | 'kurta_citizen'
  | 'auto_driver'
  | 'delivery_rider'
  | 'traffic_police'
  | 'police_officer'
  | 'security_guard'
  | 'vendor'
  | 'construction'
  | 'elder';

export type FacialExpression =
  | 'neutral'
  | 'happy'
  | 'laugh'
  | 'talking'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'focused';

export interface HumanAnimParams {
  pose: HumanPoseState;
  speedNorm: number;
  stridePhase: number;
  elapsed: number;
  dt: number;
  expression: FacialExpression;
  lookYaw: number;
  lookPitch: number;
  holdingUmbrella: boolean;
  holdingGroceryBag?: boolean;
  holdingPhone?: boolean;
  punchTimer?: number;
  kickTimer?: number;
  actionTimer?: number;
  protagonistId?: ProtagonistId;
  clothCtx?: ClothUpdateContext;
  simulateCloth?: boolean;
  terrainSlopePitch?: number;
  terrainSlopeRoll?: number;
}

export interface HumanRig {
  group: THREE.Group;
  pelvis: THREE.Bone;
  spine: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  jawBone: THREE.Bone;
  clavL: THREE.Bone;
  clavR: THREE.Bone;
  leftShoulder: THREE.Bone;
  leftElbow: THREE.Bone;
  rightShoulder: THREE.Bone;
  rightElbow: THREE.Bone;
  leftHip: THREE.Bone;
  leftKnee: THREE.Bone;
  leftAnkle: THREE.Bone;
  rightHip: THREE.Bone;
  rightKnee: THREE.Bone;
  rightAnkle: THREE.Bone;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftEyelid: THREE.Mesh;
  rightEyelid: THREE.Mesh;
  leftBrow: THREE.Group;
  rightBrow: THREE.Group;
  upperLip: THREE.Mesh;
  lowerLip: THREE.Mesh;
  teethMesh: THREE.Mesh;
  tongueMesh: THREE.Mesh;
  hairGroup: THREE.Group;
  beardGroup: THREE.Group;
  sunglasses: THREE.Group;
  backpack: THREE.Group;
  chainGroup: THREE.Group;
  watch: THREE.Mesh;
  smartphone: THREE.Group;
  smartphoneScreenTex?: THREE.CanvasTexture;
  coffeeCup: THREE.Group;
  groceryBag: THREE.Group;
  umbrella: THREE.Group;
  clothSolvers: ClothSolver[];
  clothHem?: THREE.Mesh;
  skinnedBody: THREE.SkinnedMesh;
  skinMat: THREE.MeshPhysicalMaterial;
  hairMat: THREE.MeshStandardMaterial;
  skinMaps: SkinMaps;
  irisTex: THREE.CanvasTexture;
  contactShadow: THREE.Mesh;
  blinkTimer: number;
  blinkAmount: number;
  baseHeight: number;
}

const FACE_PRESETS: Record<
  FacePresetId,
  { skinHex: string; jawWidth: number; cheekScale: number; noseScale: number; eyeColor: number }
> = {
  vikram_exec: { skinHex: '#9d6447', jawWidth: 1.09, cheekScale: 1.04, noseScale: 1.06, eyeColor: 0x24150e },
  arjun_classic: { skinHex: '#a76c4c', jawWidth: 1.0, cheekScale: 1.0, noseScale: 1.0, eyeColor: 0x2b1a11 },
  sathish_street: { skinHex: '#7e4b32', jawWidth: 1.13, cheekScale: 1.09, noseScale: 1.13, eyeColor: 0x1b110a },
  karthik_warm: { skinHex: '#875339', jawWidth: 1.04, cheekScale: 1.03, noseScale: 1.06, eyeColor: 0x1e130d },
  rohan_sharp: { skinHex: '#be8362', jawWidth: 0.94, cheekScale: 0.97, noseScale: 0.95, eyeColor: 0x3a2517 },
};

/**
 * Injects warm dermal Subsurface Scattering (SSS) wrap lighting & translucent rim bounce
 * into a Three.js MeshPhysicalMaterial skin shader.
 */
function applySkinSubsurfaceShader(mat: THREE.MeshPhysicalMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      vec3 sssTint = vec3(0.84, 0.27, 0.15);
      vec3 nView = normalize(vNormal);
      vec3 vDir = normalize(vViewPosition);
      float ndv = clamp(abs(dot(nView, vDir)), 0.0, 1.0);
      float viewRim = pow(1.0 - ndv, 1.85);
      float wrapScatter = 0.20 + 0.30 * viewRim;
      reflectedLight.directDiffuse += diffuseColor.rgb * sssTint * wrapScatter;
      reflectedLight.indirectDiffuse += diffuseColor.rgb * sssTint * 0.08;
      `
    );
  };
  mat.customProgramCacheKey = () => 'bengaluru_sss_skin_v3';
}

/**
 * Sculpted 64x48 Anatomical 3D Human Head Geometry:
 * Cranium, brow ridge, recessed orbital eye sockets, zygomatic cheekbones,
 * full 3D nasal bridge/tip/nostril alar wings, philtrum, sculpted Cupid-bow lips,
 * mental chin prominence, jawline, and natural facial asymmetry.
 */
function createAnatomicalHeadGeometry(
  jawWidth: number,
  cheekScale: number,
  noseScale: number,
  seed: number
): THREE.BufferGeometry {
  const segU = 64;
  const segV = 48;
  const geo = new THREE.SphereGeometry(0.112, segU, segV);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Anatomical cranium elongation (vertical & occiput depth)
    y *= 1.24;
    if (z < 0) z *= 1.08;

    // Jaw / chin anatomical taper vs upper cranium
    if (y < 0.01) {
      const jawT = Math.min(1, (-y + 0.01) / 0.15);
      const jawNarrow = Math.pow(jawT, 1.15) * (0.28 / jawWidth);
      x *= 1 - jawNarrow;
      if (z > 0) {
        z *= 1 - jawT * 0.14;
      } else {
        z *= 1 - jawT * 0.44;
      }
      // Gonial jaw angle corner
      if (jawT > 0.35 && jawT < 0.72 && Math.abs(x) > 0.05 && z > -0.02 && z < 0.045) {
        x *= 1.06;
      }
      // Chin mental protuberance
      if (z > 0.055 && y < -0.095) {
        const chinDist = Math.abs(x) / 0.038;
        if (chinDist < 1) {
          z += (1 - chinDist * chinDist) * 0.014;
        }
      }
    } else {
      x *= cheekScale;
    }

    // Temples & forehead slope
    if (y > 0.045 && Math.abs(x) > 0.072) {
      x *= 0.94;
    }

    // Superciliary brow ridge
    if (z > 0.068 && y > 0.028 && y < 0.056 && Math.abs(x) < 0.068) {
      const browEnv = 1 - Math.abs(y - 0.042) / 0.016;
      z += Math.max(0, browEnv) * 0.011;
    }

    // Orbital eye socket recesses (no floating eyes!)
    if (z > 0.065 && y > -0.004 && y < 0.036 && Math.abs(x) > 0.014 && Math.abs(x) < 0.062) {
      const ex = (Math.abs(x) - 0.036) / 0.024;
      const ey = (y - 0.016) / 0.02;
      const rSq = ex * ex + ey * ey;
      if (rSq < 1) {
        z -= (1 - rSq) * 0.022;
      }
    }

    // Zygomatic cheekbones
    if (z > 0.035 && y > -0.034 && y < 0.012 && Math.abs(x) > 0.042) {
      const cEnv = 1 - Math.abs(y + 0.011) / 0.024;
      z += Math.max(0, cEnv) * 0.012;
      x *= 1.045;
    }

    // Sculpted 3D Nose: bridge, tip, alar wings & subtle philtrum/nostril recess
    if (z > 0.065 && y > -0.042 && y < 0.034 && Math.abs(x) < 0.028) {
      const nx = Math.abs(x) / (0.021 * noseScale);
      const ny = (y - -0.008) / 0.042;
      if (nx < 1 && Math.abs(ny) < 1) {
        const bridgeProfile = 1 - Math.pow(nx, 1.5);
        const heightCurve = y < -0.024 ? Math.max(0, 1 - (-0.024 - y) / 0.018) : 1 - Math.max(0, (y - -0.016) / 0.05);
        z += bridgeProfile * heightCurve * 0.028 * noseScale;
      }
      // Alar nostril wings
      if (y > -0.034 && y < -0.016 && Math.abs(x) > 0.009 && Math.abs(x) < 0.024) {
        z += 0.008 * noseScale;
      }
    }

    // Sculpted Lips & Oral Recess (no black rectangle!)
    if (z > 0.072 && y > -0.082 && y < -0.042 && Math.abs(x) < 0.038) {
      const lx = Math.abs(x) / 0.034;
      if (lx < 1) {
        const lipWidthFade = 1 - lx * lx;
        // Upper lip Cupid's bow
        if (y >= -0.058 && y < -0.045) {
          const bow = Math.cos(Math.abs(x) * 140) * 0.002 + 0.009;
          z += lipWidthFade * bow;
        }
        // Oral parting groove
        if (y >= -0.064 && y < -0.058) {
          z -= lipWidthFade * 0.006;
        }
        // Lower lip fullness
        if (y >= -0.076 && y < -0.064) {
          z += lipWidthFade * 0.011;
        }
      }
    }

    // Nasolabial smile-line crease
    if (z > 0.068 && y > -0.068 && y < -0.018) {
      const foldLineX = 0.022 + (-y - 0.018) * 0.35;
      const distFold = Math.abs(Math.abs(x) - foldLineX);
      if (distFold < 0.007) {
        z -= (1 - distFold / 0.007) * 0.004;
      }
    }

    // Natural human facial asymmetry
    if (x > 0) x += ((seed % 5) - 2) * 0.0014;
    if (y < 0 && x < 0) y += 0.0016;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted 3-part anatomical ear (helix arch + concha + lobe).
 */
function createSculptedEar(side: -1 | 1, skinMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const helixCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.012, 0.01),
    new THREE.Vector3(side * 0.011, 0.027, 0.0),
    new THREE.Vector3(side * 0.014, 0.01, -0.014),
    new THREE.Vector3(side * 0.01, -0.016, -0.011),
    new THREE.Vector3(side * 0.004, -0.026, 0.002),
  ]);
  const helix = new THREE.Mesh(new THREE.TubeGeometry(helixCurve, 12, 0.0052, 8, false), skinMat);
  const concha = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), skinMat);
  concha.scale.set(0.35, 1.35, 0.9);
  concha.position.set(side * 0.004, 0.002, -0.004);
  const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 8), skinMat);
  lobe.scale.set(0.7, 1.1, 0.85);
  lobe.position.set(side * 0.005, -0.025, 0.001);
  g.add(helix, concha, lobe);
  return g;
}

/**
 * Curved multi-strand hair system using CatmullRomCurve3 TubeGeometry ribbons (zero helmet/boxes).
 */
function buildOrganicHair(style: HairStyleId, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  // Flush scalp base
  const scalp = new THREE.Mesh(
    new THREE.SphereGeometry(0.1145, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.54),
    mat
  );
  scalp.scale.set(1.01, 1.22, 1.06);
  scalp.position.set(0, 0.016, -0.01);
  g.add(scalp);

  const addStrand = (pts: Array<[number, number, number]>, r: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, r, 7, false), mat);
    tube.castShadow = true;
    g.add(tube);
  };

  // Sideburns
  [-1, 1].forEach((s) => {
    addStrand(
      [
        [s * 0.098, 0.055, 0.015],
        [s * 0.101, 0.024, 0.022],
        [s * 0.094, -0.008, 0.02],
      ],
      0.0085
    );
  });

  if (style === 'short_crop') {
    for (let i = -5; i <= 5; i++) {
      const fx = i * 0.017;
      const arch = (1 - Math.abs(i) / 6) * 0.018;
      addStrand(
        [
          [fx * 0.9, 0.11 + arch, -0.065],
          [fx, 0.132 + arch, 0.005],
          [fx * 0.92, 0.112 + arch * 0.6, 0.068],
        ],
        0.0145
      );
    }
  } else if (style === 'side_part') {
    for (let i = -5; i <= 5; i++) {
      const fx = i * 0.018;
      const arch = (1 - Math.abs(i) / 6) * 0.02;
      addStrand(
        [
          [fx - 0.016, 0.112 + arch, -0.065],
          [fx + 0.014, 0.136 + arch, 0.012],
          [fx + 0.026, 0.108 + arch * 0.5, 0.082],
        ],
        0.0155
      );
    }
  } else if (style === 'swept') {
    for (let i = -5; i <= 5; i++) {
      const fx = i * 0.0175;
      const arch = (1 - Math.abs(i) / 6) * 0.022;
      addStrand(
        [
          [fx * 0.85, 0.11 + arch, 0.072],
          [fx * 0.95, 0.144 + arch, 0.01],
          [fx, 0.112 + arch * 0.5, -0.085],
        ],
        0.0155
      );
    }
  } else if (style === 'wavy_long') {
    for (let i = -5; i <= 5; i++) {
      const fx = i * 0.018;
      const arch = (1 - Math.abs(i) / 6) * 0.02;
      addStrand(
        [
          [fx, 0.11 + arch, 0.078],
          [fx * 1.05, 0.14 + arch, 0.005],
          [fx * 1.08, 0.068, -0.105],
          [fx * 1.02, -0.055, -0.115],
        ],
        0.0155
      );
    }
  } else if (style === 'curly') {
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 1.5 - Math.PI * 0.75;
      const ring = 0.078 + (i % 2) * 0.014;
      const cx = Math.sin(ang) * ring;
      const cz = Math.cos(ang) * ring * 0.95 - 0.008;
      addStrand(
        [
          [cx * 0.9, 0.095, cz * 0.9],
          [cx * 1.05, 0.125 + (i % 3) * 0.012, cz * 1.05],
          [cx, 0.108, cz + 0.02],
        ],
        0.017
      );
    }
  } else if (style === 'bun') {
    const bun = new THREE.Mesh(new THREE.TorusKnotGeometry(0.032, 0.014, 32, 8, 2, 3), mat);
    bun.position.set(0, 0.032, -0.124);
    g.add(bun);
  }

  return g;
}

/**
 * Curved multi-strand beard & moustache built from smooth organic tubes hugging the jaw.
 */
function buildOrganicBeard(style: BeardStyleId, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  if (style === 'clean') return g;

  const addCurve = (pts: Array<[number, number, number]>, r: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, r, 7, false), mat));
  };

  if (style === 'moustache' || style === 'full_beard' || style === 'trimmed_beard') {
    const r = style === 'moustache' ? 0.0085 : 0.0068;
    [-1, 1].forEach((s) => {
      addCurve(
        [
          [0, -0.044, 0.106],
          [s * 0.018, -0.046, 0.102],
          [s * 0.036, style === 'moustache' ? -0.043 : -0.056, 0.088],
        ],
        r
      );
    });
  }

  if (style === 'trimmed_beard' || style === 'full_beard' || style === 'stubble') {
    const depth = style === 'full_beard' ? 0.011 : style === 'trimmed_beard' ? 0.0065 : 0.003;
    const jawStrands = style === 'full_beard' ? 7 : 5;
    for (let i = -jawStrands; i <= jawStrands; i++) {
      const frac = i / jawStrands;
      const ang = frac * 1.15;
      const xTop = Math.sin(ang) * 0.086;
      const zTop = Math.cos(ang) * 0.088 + 0.006;
      const yBottom = style === 'full_beard' ? -0.145 + Math.abs(frac) * 0.045 : -0.122 + Math.abs(frac) * 0.036;
      addCurve(
        [
          [xTop, -0.038, zTop],
          [xTop * 0.88, -0.082, zTop * 0.96],
          [xTop * 0.65, yBottom, zTop * 0.85],
        ],
        depth
      );
    }
    // Chin soul patch & goatee blend
    addCurve(
      [
        [0, -0.072, 0.095],
        [0, -0.1, 0.094],
        [0, style === 'full_beard' ? -0.145 : -0.12, 0.078],
      ],
      depth * 1.15
    );
  }

  return g;
}

/**
 * Generates a unified, continuous anatomical SkinnedMesh combining:
 * - Sculpted torso (pelvis -> waist -> chest -> shoulders -> neck)
 * - Welded left/right arms (deltoid -> bicep -> elbow -> forearm -> wrist)
 * - Welded left/right legs (thigh -> knee -> calf -> ankle)
 * With proper 4-bone skinIndices/skinWeights and clothing color/fabric attributes!
 */
interface CrossSection {
  y: number;
  rx: number;
  rz: number;
  zOff: number;
  boneA: number;
  boneB: number;
  wA: number;
  wB: number;
  zone: 'shirt' | 'jacket' | 'pants' | 'skin';
}

const BONE_IDX = {
  pelvis: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  jaw: 5,
  clavL: 6,
  uArmL: 7,
  fArmL: 8,
  handL: 9,
  clavR: 10,
  uArmR: 11,
  fArmR: 12,
  handR: 13,
  thighL: 14,
  shinL: 15,
  footL: 16,
  thighR: 17,
  shinR: 18,
  footR: 19,
};

function appendLoftedPart(
  positions: number[],
  normals: number[],
  uvs: number[],
  colors: number[],
  skinIndices: number[],
  skinWeights: number[],
  indices: number[],
  rings: Array<{
    cx: number;
    cy: number;
    cz: number;
    rx: number;
    rz: number;
    boneA: number;
    boneB: number;
    wA: number;
    wB: number;
    color: THREE.Color;
    pecSculpt?: number;
  }>,
  radialSegs: number
): void {
  const baseVert = positions.length / 3;
  const cols = radialSegs + 1;

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const vCoord = r / Math.max(1, rings.length - 1);
    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      let px = ring.cx + cosT * ring.rx;
      let pz = ring.cz + sinT * ring.rz;

      // Subtle anatomical pectoral / back muscle sculpt
      if (ring.pecSculpt && sinT > 0.25) {
        const pecLobe = Math.sin(Math.abs(cosT) * Math.PI) * sinT;
        pz += pecLobe * ring.pecSculpt;
      }

      positions.push(px, ring.cy, pz);
      const nx = cosT / Math.max(0.01, ring.rx);
      const nz = sinT / Math.max(0.01, ring.rz);
      const nLen = Math.hypot(nx, nz) || 1;
      normals.push(nx / nLen, 0, nz / nLen);
      uvs.push(u, vCoord);
      colors.push(ring.color.r, ring.color.g, ring.color.b);
      skinIndices.push(ring.boneA, ring.boneB, 0, 0);
      skinWeights.push(ring.wA, ring.wB, 0, 0);
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = baseVert + r * cols + s;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
}

function buildSculptedHand(side: -1 | 1, skinMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // Contoured anatomical metacarpal palm (sphere-sculpted, never a box!)
  const palmGeo = new THREE.SphereGeometry(0.042, 14, 12);
  palmGeo.scale(0.86, 1.15, 0.44);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0, -0.042, 0.004);
  palm.castShadow = true;
  g.add(palm);

  // 4 articulated organic fingers + thumb with tapered phalanges
  const fingerOffsets = [-0.025, -0.008, 0.009, 0.025];
  const fingerLens = [0.056, 0.064, 0.06, 0.048];
  fingerOffsets.forEach((fx, idx) => {
    const fCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fx * side, -0.075, 0.004),
      new THREE.Vector3(fx * side, -0.075 - fingerLens[idx] * 0.55, 0.01),
      new THREE.Vector3(fx * side * 0.94, -0.075 - fingerLens[idx], 0.017),
    ]);
    const finger = new THREE.Mesh(new THREE.TubeGeometry(fCurve, 6, 0.0072, 7, false), skinMat);
    g.add(finger);
  });

  // Opposable thumb
  const thumbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.028, -0.032, 0.012),
    new THREE.Vector3(-side * 0.044, -0.056, 0.022),
    new THREE.Vector3(-side * 0.042, -0.078, 0.03),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(thumbCurve, 6, 0.0085, 7, false), skinMat));
  return g;
}

function buildContouredShoe(colorHex: string): THREE.Group {
  const g = new THREE.Group();
  const upperMat = new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.42, clearcoat: 0.25 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });

  // Sculpted sneaker/oxford vamp + curved toe box (lathe/deformed sphere, never a box!)
  const upperGeo = new THREE.SphereGeometry(0.065, 16, 12);
  const pos = upperGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * 0.78;
    let y = pos.getY(i) * 0.65;
    let z = pos.getZ(i) * 1.95;
    if (y < 0) y *= 0.28;
    if (z > 0.04) y *= 0.68; // Taper toe slope
    pos.setXYZ(i, x, y, z + 0.042);
  }
  upperGeo.computeVertexNormals();
  const upper = new THREE.Mesh(upperGeo, upperMat);
  upper.position.set(0, -0.024, 0);
  upper.castShadow = true;

  const soleGeo = new THREE.CylinderGeometry(0.052, 0.056, 0.022, 16);
  soleGeo.scale(0.95, 1, 2.25);
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.set(0, -0.042, 0.04);

  g.add(upper, sole);
  return g;
}

export interface HumanBuildConfig extends PlayerCustomization {
  ageGroup?: 'young' | 'middle' | 'elder';
  heightScale?: number;
  widthScale?: number;
  abdomenScale?: number;
  isFemale?: boolean;
  isSaree?: boolean;
  isPolice?: boolean;
  isDelivery?: boolean;
  hasHelmet?: boolean;
  hasCap?: boolean;
  hasGajra?: boolean;
  seed?: number;
  enableCloth?: boolean;
}

export function createDetailedHumanRig(cfg: HumanBuildConfig, textures: TextureBundle): HumanRig {
  const seed = cfg.seed ?? 17;
  const preset = FACE_PRESETS[cfg.facePreset] || FACE_PRESETS.arjun_classic;
  const ageGroup = cfg.ageGroup ?? 'young';
  const hScale = cfg.heightScale ?? 1.0;
  const wScale = cfg.widthScale ?? 1.0;
  const abdScale = cfg.abdomenScale ?? 1.0;
  const hasStubble = cfg.beardStyle !== 'clean' && !cfg.isFemale;

  const skinMaps = textures.createSkinMaps(preset.skinHex, ageGroup, seed, hasStubble);
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinMaps.albedo,
    normalMap: skinMaps.normal,
    normalScale: new THREE.Vector2(0.58, 0.58),
    roughnessMap: skinMaps.roughness,
    roughness: 0.62,
    metalness: 0.0,
    sheen: 0.18,
    sheenColor: new THREE.Color(0xd97757),
    sheenRoughness: 0.72,
    clearcoat: 0.04,
    clearcoatRoughness: 0.58,
  });
  applySkinSubsurfaceShader(skinMat);

  const hairMat = new THREE.MeshStandardMaterial({
    color: cfg.hairColor,
    map: textures.hairStrandTexture,
    roughness: 0.62,
    metalness: 0.08,
  });

  const isOuter = cfg.outfitStyle === 'suit' || cfg.outfitStyle === 'jacket' || cfg.outfitStyle === 'hoodie';
  const shirtCol = new THREE.Color(cfg.shirtColor);
  const outerCol = new THREE.Color(isOuter ? cfg.jacketColor : cfg.shirtColor);
  const pantsCol = new THREE.Color(cfg.pantsColor);
  const skinCol = new THREE.Color(preset.skinHex);

  const rootGroup = new THREE.Group();

  // Build 20-bone Skeleton in rest T/A-pose
  const pelvis = new THREE.Bone();
  pelvis.position.set(0, 0.94 * hScale, 0);

  const spine = new THREE.Bone();
  spine.position.set(0, 0.14 * hScale, 0);
  pelvis.add(spine);

  const chest = new THREE.Bone();
  chest.position.set(0, 0.24 * hScale, 0);
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.position.set(0, 0.22 * hScale, 0);
  chest.add(neck);

  const head = new THREE.Bone();
  head.position.set(0, 0.14 * hScale, 0.01);
  neck.add(head);

  const jawBone = new THREE.Bone();
  jawBone.position.set(0, -0.028, 0.012);
  head.add(jawBone);

  const shOff = 0.195 * wScale;
  const clavL = new THREE.Bone();
  clavL.position.set(shOff * 0.45, 0.15 * hScale, 0);
  chest.add(clavL);
  const uArmL = new THREE.Bone();
  uArmL.position.set(shOff * 0.55, -0.01, 0);
  clavL.add(uArmL);
  const fArmL = new THREE.Bone();
  fArmL.position.set(0, -0.27 * hScale, 0);
  uArmL.add(fArmL);
  const handL = new THREE.Bone();
  handL.position.set(0, -0.25 * hScale, 0);
  fArmL.add(handL);

  const clavR = new THREE.Bone();
  clavR.position.set(-shOff * 0.45, 0.15 * hScale, 0);
  chest.add(clavR);
  const uArmR = new THREE.Bone();
  uArmR.position.set(-shOff * 0.55, -0.01, 0);
  clavR.add(uArmR);
  const fArmR = new THREE.Bone();
  fArmR.position.set(0, -0.27 * hScale, 0);
  uArmR.add(fArmR);
  const handR = new THREE.Bone();
  handR.position.set(0, -0.25 * hScale, 0);
  fArmR.add(handR);

  const hipOff = 0.095 * wScale;
  const thighL = new THREE.Bone();
  thighL.position.set(hipOff, -0.04 * hScale, 0);
  pelvis.add(thighL);
  const shinL = new THREE.Bone();
  shinL.position.set(0, -0.42 * hScale, 0);
  thighL.add(shinL);
  const footL = new THREE.Bone();
  footL.position.set(0, -0.41 * hScale, 0);
  shinL.add(footL);

  const thighR = new THREE.Bone();
  thighR.position.set(-hipOff, -0.04 * hScale, 0);
  pelvis.add(thighR);
  const shinR = new THREE.Bone();
  shinR.position.set(0, -0.42 * hScale, 0);
  thighR.add(shinR);
  const footR = new THREE.Bone();
  footR.position.set(0, -0.41 * hScale, 0);
  shinR.add(footR);

  const bones = [
    pelvis, spine, chest, neck, head, jawBone,
    clavL, uArmL, fArmL, handL,
    clavR, uArmR, fArmR, handR,
    thighL, shinL, footL,
    thighR, shinR, footR,
  ];
  const skeleton = new THREE.Skeleton(bones);
  rootGroup.add(pelvis);
  pelvis.updateMatrixWorld(true);

  // Build Continuous Welded Organic SkinnedMesh Geometry (Torso + Neck + Arms + Legs)
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  const py = pelvis.position.y;
  const torsoSections: CrossSection[] = [
    { y: py - 0.12 * hScale, rx: 0.155 * wScale, rz: 0.118 * abdScale, zOff: -0.01, boneA: BONE_IDX.pelvis, boneB: BONE_IDX.pelvis, wA: 1, wB: 0, zone: 'pants' },
    { y: py - 0.02 * hScale, rx: 0.162 * wScale, rz: 0.122 * abdScale, zOff: -0.005, boneA: BONE_IDX.pelvis, boneB: BONE_IDX.spine, wA: 0.75, wB: 0.25, zone: isOuter || cfg.outfitStyle === 'kurta' ? 'jacket' : 'shirt' },
    { y: py + 0.09 * hScale, rx: 0.152 * wScale, rz: 0.116 * abdScale, zOff: 0.004, boneA: BONE_IDX.spine, boneB: BONE_IDX.pelvis, wA: 0.78, wB: 0.22, zone: isOuter ? 'jacket' : 'shirt' },
    { y: py + 0.20 * hScale, rx: 0.16 * wScale, rz: 0.118 * abdScale, zOff: 0.006, boneA: BONE_IDX.spine, boneB: BONE_IDX.chest, wA: 0.55, wB: 0.45, zone: isOuter ? 'jacket' : 'shirt' },
    { y: py + 0.32 * hScale, rx: 0.178 * wScale, rz: 0.122 * abdScale, zOff: 0.008, boneA: BONE_IDX.chest, boneB: BONE_IDX.spine, wA: 0.85, wB: 0.15, zone: isOuter ? 'jacket' : 'shirt' },
    { y: py + 0.43 * hScale, rx: 0.198 * wScale, rz: 0.126, zOff: 0.006, boneA: BONE_IDX.chest, boneB: BONE_IDX.chest, wA: 1, wB: 0, zone: isOuter ? 'jacket' : 'shirt' },
    { y: py + 0.51 * hScale, rx: 0.172 * wScale, rz: 0.105, zOff: 0.0, boneA: BONE_IDX.chest, boneB: BONE_IDX.neck, wA: 0.7, wB: 0.3, zone: isOuter ? 'jacket' : 'shirt' },
    { y: py + 0.56 * hScale, rx: 0.068 * wScale, rz: 0.066, zOff: 0.004, boneA: BONE_IDX.neck, boneB: BONE_IDX.chest, wA: 0.75, wB: 0.25, zone: 'skin' },
    { y: py + 0.63 * hScale, rx: 0.056, rz: 0.056, zOff: 0.008, boneA: BONE_IDX.neck, boneB: BONE_IDX.head, wA: 0.6, wB: 0.4, zone: 'skin' },
    { y: py + 0.69 * hScale, rx: 0.052, rz: 0.054, zOff: 0.01, boneA: BONE_IDX.head, boneB: BONE_IDX.neck, wA: 0.8, wB: 0.2, zone: 'skin' },
  ];

  appendLoftedPart(
    positions, normals, uvs, colors, skinIndices, skinWeights, indices,
    torsoSections.map((s, idx) => ({
      cx: 0,
      cy: s.y,
      cz: s.zOff,
      rx: s.rx,
      rz: s.rz,
      boneA: s.boneA,
      boneB: s.boneB,
      wA: s.wA,
      wB: s.wB,
      color: s.zone === 'skin' ? skinCol : s.zone === 'pants' ? pantsCol : s.zone === 'jacket' ? outerCol : shirtCol,
      pecSculpt: idx === 4 || idx === 5 ? 0.018 * wScale : 0,
    })),
    24
  );

  // Welded Left & Right Arms (Deltoid -> Bicep -> Elbow -> Forearm -> Wrist)
  const buildArmRings = (side: 1 | -1) => {
    const sx = side * shOff;
    const sy = py + 0.52 * hScale;
    const uIdx = side === 1 ? BONE_IDX.uArmL : BONE_IDX.uArmR;
    const fIdx = side === 1 ? BONE_IDX.fArmL : BONE_IDX.fArmR;
    const hIdx = side === 1 ? BONE_IDX.handL : BONE_IDX.handR;
    const sleeveCol = isOuter ? outerCol : shirtCol;
    const shortSleeve = cfg.outfitStyle === 'street_shirt' || cfg.outfitStyle === 'kurta';

    return [
      { cx: sx * 0.94, cy: sy + 0.02, cz: 0, rx: 0.062 * wScale, rz: 0.06 * wScale, boneA: BONE_IDX.chest, boneB: uIdx, wA: 0.45, wB: 0.55, color: sleeveCol },
      { cx: sx, cy: sy - 0.05 * hScale, cz: 0, rx: 0.056 * wScale, rz: 0.055 * wScale, boneA: uIdx, boneB: uIdx, wA: 1, wB: 0, color: sleeveCol },
      { cx: sx, cy: sy - 0.14 * hScale, cz: 0.004, rx: 0.05 * wScale, rz: 0.05 * wScale, boneA: uIdx, boneB: uIdx, wA: 1, wB: 0, color: shortSleeve ? skinCol : sleeveCol },
      { cx: sx, cy: sy - 0.25 * hScale, cz: 0.002, rx: 0.041 * wScale, rz: 0.041 * wScale, boneA: uIdx, boneB: fIdx, wA: 0.5, wB: 0.5, color: shortSleeve ? skinCol : sleeveCol },
      { cx: sx, cy: sy - 0.34 * hScale, cz: 0.006, rx: 0.044 * wScale, rz: 0.043 * wScale, boneA: fIdx, boneB: fIdx, wA: 1, wB: 0, color: isOuter ? sleeveCol : skinCol },
      { cx: sx, cy: sy - 0.44 * hScale, cz: 0.004, rx: 0.034 * wScale, rz: 0.032 * wScale, boneA: fIdx, boneB: fIdx, wA: 1, wB: 0, color: isOuter ? sleeveCol : skinCol },
      { cx: sx, cy: sy - 0.52 * hScale, cz: 0.002, rx: 0.028, rz: 0.025, boneA: fIdx, boneB: hIdx, wA: 0.4, wB: 0.6, color: skinCol },
    ];
  };
  appendLoftedPart(positions, normals, uvs, colors, skinIndices, skinWeights, indices, buildArmRings(1), 16);
  appendLoftedPart(positions, normals, uvs, colors, skinIndices, skinWeights, indices, buildArmRings(-1), 16);

  // Welded Left & Right Legs (Hip -> Thigh -> Knee -> Calf -> Ankle)
  const buildLegRings = (side: 1 | -1) => {
    const lx = side * hipOff;
    const ly = py - 0.04 * hScale;
    const tIdx = side === 1 ? BONE_IDX.thighL : BONE_IDX.thighR;
    const sIdx = side === 1 ? BONE_IDX.shinL : BONE_IDX.shinR;
    const aIdx = side === 1 ? BONE_IDX.footL : BONE_IDX.footR;
    return [
      { cx: lx, cy: ly + 0.02, cz: 0, rx: 0.088 * wScale, rz: 0.088 * wScale, boneA: BONE_IDX.pelvis, boneB: tIdx, wA: 0.4, wB: 0.6, color: pantsCol },
      { cx: lx, cy: ly - 0.14 * hScale, cz: 0.005, rx: 0.082 * wScale, rz: 0.084 * wScale, boneA: tIdx, boneB: tIdx, wA: 1, wB: 0, color: pantsCol },
      { cx: lx, cy: ly - 0.30 * hScale, cz: 0.002, rx: 0.068 * wScale, rz: 0.068 * wScale, boneA: tIdx, boneB: tIdx, wA: 1, wB: 0, color: pantsCol },
      { cx: lx, cy: ly - 0.42 * hScale, cz: 0.006, rx: 0.058 * wScale, rz: 0.06 * wScale, boneA: tIdx, boneB: sIdx, wA: 0.5, wB: 0.5, color: pantsCol },
      { cx: lx, cy: ly - 0.56 * hScale, cz: -0.006, rx: 0.062 * wScale, rz: 0.064 * wScale, boneA: sIdx, boneB: sIdx, wA: 1, wB: 0, color: pantsCol },
      { cx: lx, cy: ly - 0.72 * hScale, cz: -0.004, rx: 0.05 * wScale, rz: 0.052 * wScale, boneA: sIdx, boneB: sIdx, wA: 1, wB: 0, color: pantsCol },
      { cx: lx, cy: ly - 0.83 * hScale, cz: 0, rx: 0.044, rz: 0.045, boneA: sIdx, boneB: aIdx, wA: 0.55, wB: 0.45, color: pantsCol },
    ];
  };
  appendLoftedPart(positions, normals, uvs, colors, skinIndices, skinWeights, indices, buildLegRings(1), 16);
  appendLoftedPart(positions, normals, uvs, colors, skinIndices, skinWeights, indices, buildLegRings(-1), 16);

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  bodyGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const fabricTex =
    cfg.outfitStyle === 'suit'
      ? textures.suitWoolFabric
      : cfg.outfitStyle === 'street_shirt'
      ? textures.streetShirtFabric
      : cfg.isSaree
      ? textures.silkSareeFabric
      : textures.cottonFabric;

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: fabricTex,
    roughness: cfg.outfitStyle === 'suit' ? 0.68 : 0.78,
    metalness: 0.04,
  });

  const skinnedBody = new THREE.SkinnedMesh(bodyGeo, bodyMat);
  skinnedBody.castShadow = true;
  skinnedBody.receiveShadow = true;
  skinnedBody.add(pelvis);
  skinnedBody.bind(skeleton);
  skinnedBody.frustumCulled = false;
  rootGroup.add(skinnedBody);

  // Shirt Collar V-lapels + Tie/Shirt Placket mounted on chest bone
  const collarMat = new THREE.MeshStandardMaterial({ color: cfg.shirtColor, roughness: 0.7 });
  [-1, 1].forEach((side) => {
    const lapelCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.056, 0.215 * hScale, 0.045),
      new THREE.Vector3(side * 0.042, 0.175 * hScale, 0.112),
      new THREE.Vector3(side * 0.015, 0.11 * hScale, 0.122),
    ]);
    const lapel = new THREE.Mesh(new THREE.TubeGeometry(lapelCurve, 8, 0.014, 6, false), collarMat);
    chest.add(lapel);
  });

  // Sculpted 5-Finger Hands, Watch, Smartphone, Umbrella attached to hand bones
  const lHandGroup = buildSculptedHand(1, skinMat);
  const rHandGroup = buildSculptedHand(-1, skinMat);
  handL.add(lHandGroup);
  handR.add(rHandGroup);

  const watch = new THREE.Mesh(
    new THREE.TorusGeometry(0.031, 0.0065, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.2 })
  );
  watch.rotation.x = Math.PI * 0.5;
  watch.position.set(0, 0.015, 0);
  watch.visible = cfg.watch;
  handL.add(watch);

  // Detailed 3D Smartphone in Hand (Machined Titanium Chassis, Camera Bump & Live NammaOS CanvasTexture Screen)
  const smartphone = new THREE.Group();
  const phoneChassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.24,
  });
  const phoneChassis = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.156, 0.009), phoneChassisMat);
  const camBump = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.032, 0.004),
    new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.6, roughness: 0.2 })
  );
  camBump.position.set(0.018, 0.052, -0.006);
  const camLens1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 10),
    new THREE.MeshPhysicalMaterial({ color: 0x1d4ed8, clearcoat: 1, roughness: 0.05 })
  );
  camLens1.rotation.x = Math.PI * 0.5;
  camLens1.position.set(0.014, 0.058, -0.008);
  const camLens2 = camLens1.clone();
  camLens2.position.set(0.022, 0.044, -0.008);

  const phoneCanvas = document.createElement('canvas');
  phoneCanvas.width = 160;
  phoneCanvas.height = 320;
  const pCtx = phoneCanvas.getContext('2d')!;
  pCtx.fillStyle = '#090d16';
  pCtx.fillRect(0, 0, 160, 320);
  pCtx.fillStyle = '#1e293b';
  pCtx.fillRect(0, 0, 160, 28);
  pCtx.fillStyle = '#f59e0b';
  pCtx.font = 'bold 13px sans-serif';
  pCtx.fillText('NammaOS 5G', 10, 19);
  pCtx.fillStyle = '#10b981';
  pCtx.fillRect(14, 42, 132, 68);
  pCtx.fillStyle = '#020617';
  pCtx.font = 'bold 15px sans-serif';
  pCtx.fillText('BENGALURU', 22, 68);
  pCtx.font = '12px sans-serif';
  pCtx.fillText('ನಮ್ಮ ಬೆಂಗಳೂರು', 22, 92);
  pCtx.fillStyle = '#7c3aed';
  pCtx.fillRect(14, 122, 62, 62);
  pCtx.fillStyle = '#0ea5e9';
  pCtx.fillRect(84, 122, 62, 62);
  pCtx.fillStyle = '#ffffff';
  pCtx.font = 'bold 11px sans-serif';
  pCtx.fillText('METRO', 24, 158);
  pCtx.fillText('YATRI', 96, 158);
  pCtx.fillStyle = '#1e293b';
  pCtx.fillRect(14, 198, 132, 96);
  pCtx.fillStyle = '#e2e8f0';
  pCtx.font = '11px monospace';
  pCtx.fillText('GPS: 12.97°N', 22, 224);
  pCtx.fillText('77.60°E · IST', 22, 244);
  pCtx.fillStyle = '#38bdf8';
  pCtx.fillText('QR TICKET ACTIVE', 22, 272);

  const smartphoneScreenTex = new THREE.CanvasTexture(phoneCanvas);
  smartphoneScreenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshStandardMaterial({
    map: smartphoneScreenTex,
    emissive: 0xffffff,
    emissiveMap: smartphoneScreenTex,
    emissiveIntensity: 0.72,
    roughness: 0.14,
  });
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), screenMat);
  phoneScreen.position.z = 0.0052;
  smartphone.add(phoneChassis, camBump, camLens1, camLens2, phoneScreen);
  smartphone.position.set(-0.015, -0.055, 0.048);
  smartphone.rotation.set(-0.42, -0.25, 0.1);
  smartphone.visible = false;
  handR.add(smartphone);

  // Filter Kaapi steel tumbler & davara (for eat / drink_coffee)
  const coffeeCup = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.22 });
  const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.075, 12), steelMat);
  const kaapiTop = new THREE.Mesh(
    new THREE.CircleGeometry(0.025, 10),
    new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.3 })
  );
  kaapiTop.rotation.x = -Math.PI * 0.5;
  kaapiTop.position.y = 0.038;
  coffeeCup.add(tumbler, kaapiTop);
  coffeeCup.position.set(0, -0.055, 0.038);
  coffeeCup.visible = false;
  handR.add(coffeeCup);

  // Namma Mart Grocery Carry Bag (left hand)
  const groceryBag = new THREE.Group();
  const bagBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.24, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 })
  );
  bagBody.position.y = -0.14;
  const bagHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.048, 0.008, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
  );
  bagHandle.position.y = -0.02;
  groceryBag.add(bagBody, bagHandle);
  groceryBag.position.set(0, -0.05, 0.02);
  groceryBag.visible = false;
  handL.add(groceryBag);

  const umbrella = new THREE.Group();
  const uShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.78, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
  );
  uShaft.position.y = 0.39;
  const uCanopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.36),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, side: THREE.DoubleSide })
  );
  uCanopy.position.y = 0.58;
  umbrella.add(uShaft, uCanopy);
  umbrella.position.set(0, -0.05, 0.03);
  umbrella.visible = false;
  handR.add(umbrella);

  // Contoured Shoes mounted on ankle bones
  footL.add(buildContouredShoe(cfg.shoeColor));
  footR.add(buildContouredShoe(cfg.shoeColor));

  // Gold Chain & Backpack
  const chainGroup = new THREE.Group();
  const chainTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.007, 8, 22, Math.PI * 1.15),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.16 })
  );
  chainTorus.rotation.x = Math.PI * 0.42;
  chainTorus.rotation.z = -Math.PI * 0.08;
  chainTorus.position.set(0, 0.18 * hScale, 0.062);
  chainGroup.add(chainTorus);
  chainGroup.visible = !!cfg.chain;
  chest.add(chainGroup);

  const backpack = new THREE.Group();
  const packGeo = new THREE.SphereGeometry(0.145, 14, 12);
  packGeo.scale(0.95, 1.32, 0.55);
  const packBody = new THREE.Mesh(
    packGeo,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82 })
  );
  packBody.position.set(0, 0.05 * hScale, -0.155);
  backpack.add(packBody);
  backpack.visible = cfg.backpack;
  chest.add(backpack);

  // Sculpted 3D Anatomical Head mounted on Head Bone
  const headMesh = new THREE.Mesh(
    createAnatomicalHeadGeometry(preset.jawWidth, preset.cheekScale, preset.noseScale, seed),
    skinMat
  );
  headMesh.position.set(0, 0.08, 0);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Sculpted 3-part Ears
  const earL = createSculptedEar(1, skinMat);
  earL.position.set(0.102 * preset.cheekScale, 0.078, -0.005);
  const earR = createSculptedEar(-1, skinMat);
  earR.position.set(-0.102 * preset.cheekScale, 0.078, -0.005);
  head.add(earL, earR);

  // Recessed Realistic Eyes (Sclera + Caruncle + Iris + Glossy Cornea + Eyelashes + Blinking Eyelids)
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ee, roughness: 0.24 });
  const caruncleMat = new THREE.MeshStandardMaterial({ color: 0xb4534d, roughness: 0.4 });
  const irisTex = textures.createIrisTexture(preset.eyeColor);
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const makeEye = (ex: number) => {
    const side = ex > 0 ? 1 : -1;
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(ex, 0.092, 0.082);
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 16, 14), scleraMat);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0078, 16), irisMat);
    iris.position.z = 0.0148;
    eyeball.add(iris);

    // Tear-duct caruncle & sculpted upper eyelash curve
    const caruncle = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 6, 6), caruncleMat);
    caruncle.position.set(-side * 0.0135, -0.002, 0.008);
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.013, 0.003, 0.011),
      new THREE.Vector3(0, 0.0085, 0.0145),
      new THREE.Vector3(side * 0.014, 0.002, 0.01),
    ]);
    const lash = new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 8, 0.0014, 5, false), hairMat);

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0168, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      skinMat
    );
    lid.rotation.x = -Math.PI * 0.42;
    eyeSocket.add(eyeball, caruncle, lash, lid);
    head.add(eyeSocket);
    return { eyeball, lid };
  };
  const eyeL = makeEye(0.036);
  const eyeR = makeEye(-0.036);

  // Curved Multi-Strand Eyebrows
  const makeBrow = (side: -1 | 1) => {
    const bg = new THREE.Group();
    bg.position.set(side * 0.036, 0.118, 0.096);
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.016, -0.001, 0),
      new THREE.Vector3(0, 0.004, 0.005),
      new THREE.Vector3(side * 0.018, -0.002, -0.005),
    ]);
    bg.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 8, 0.0036, 6, false), hairMat));
    head.add(bg);
    return bg;
  };
  const leftBrow = makeBrow(1);
  const rightBrow = makeBrow(-1);

  // Recessed Oral Cavity: Upper & Lower Teeth + Sculpted Tongue + JawBone-coupled Lower Lip & Beard
  const oralCavity = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x2b0d0e, roughness: 0.85, side: THREE.BackSide })
  );
  oralCavity.position.set(0, 0.022, 0.072);
  head.add(oralCavity);

  const teethMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.009, 12, 1, true, -0.9, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.25, side: THREE.DoubleSide })
  );
  teethMesh.position.set(0, 0.025, 0.074);
  teethMesh.visible = false;
  head.add(teethMesh);

  const tongueMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xb95055, roughness: 0.45 })
  );
  tongueMesh.scale.set(1.1, 0.45, 1.4);
  tongueMesh.position.set(0, 0.044, 0.063);
  tongueMesh.visible = false;
  jawBone.add(tongueMesh);

  const lipColor = new THREE.Color(preset.skinHex).lerp(new THREE.Color(0x9f4542), 0.48);
  const lipMat = new THREE.MeshPhysicalMaterial({ color: lipColor, roughness: 0.36, clearcoat: 0.2 });

  const uLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.024, 0.024, 0.094),
    new THREE.Vector3(-0.008, 0.027, 0.104),
    new THREE.Vector3(0, 0.025, 0.105),
    new THREE.Vector3(0.008, 0.027, 0.104),
    new THREE.Vector3(0.024, 0.024, 0.094),
  ]);
  const upperLip = new THREE.Mesh(new THREE.TubeGeometry(uLipCurve, 12, 0.0048, 7, false), lipMat);
  head.add(upperLip);

  const lLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.022, 0.049, 0.081),
    new THREE.Vector3(0, 0.045, 0.092),
    new THREE.Vector3(0.022, 0.049, 0.081),
  ]);
  const lowerLip = new THREE.Mesh(new THREE.TubeGeometry(lLipCurve, 12, 0.0054, 7, false), lipMat);
  jawBone.add(lowerLip);

  // Curved Organic Hair & JawBone-coupled Facial Hair
  const hairGroup = buildOrganicHair(cfg.hairStyle, hairMat);
  hairGroup.position.set(0, 0.08, 0);
  head.add(hairGroup);

  const beardGroup = buildOrganicBeard(cfg.beardStyle, hairMat);
  beardGroup.position.set(0, 0.108, -0.012);
  jawBone.add(beardGroup);

  // Optional Headgear (Police Cap / Helmet / Gajra)
  if (cfg.hasCap) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
    );
    cap.position.set(0, 0.125, -0.004);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.12, 0.012, 16, 1, false, -0.9, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    visor.position.set(0, 0.124, 0.068);
    head.add(cap, visor);
  } else if (cfg.hasHelmet) {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.132, 18, 14),
      new THREE.MeshPhysicalMaterial({ color: cfg.isDelivery ? 0xea580c : 0xfacc15, roughness: 0.22, clearcoat: 0.8 })
    );
    helmet.position.set(0, 0.1, -0.005);
    head.add(helmet);
  }
  if (cfg.hasGajra) {
    const gajra = new THREE.Mesh(
      new THREE.TorusGeometry(0.036, 0.011, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.8 })
    );
    gajra.position.set(0, 0.11, -0.125);
    head.add(gajra);
  }
  if (cfg.isFemale && cfg.isSaree) {
    const bindi = new THREE.Mesh(
      new THREE.SphereGeometry(0.0032, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 })
    );
    bindi.position.set(0, 0.112, 0.107);
    head.add(bindi);
  }

  // Sunglasses
  const sunglasses = new THREE.Group();
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x09090b, roughness: 0.05, metalness: 0.45, clearcoat: 1 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.2 });
  [-0.036, 0.036].forEach((lx) => {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.019, 0.006, 14), lensMat);
    lens.rotation.x = Math.PI * 0.5;
    lens.scale.set(1.15, 1, 0.85);
    lens.position.set(lx, 0.092, 0.114);
    sunglasses.add(lens);
  });
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), frameMat);
  bridge.rotation.z = Math.PI * 0.5;
  bridge.position.set(0, 0.095, 0.114);
  sunglasses.add(bridge);
  sunglasses.visible = cfg.sunglasses;
  head.add(sunglasses);

  // Chaos Cloth Verlet Panels for Jacket Coats, Kurtas, Saree Pallu & Overshirts
  const clothSolvers: ClothSolver[] = [];
  let clothHem: THREE.Mesh | undefined;
  const clothMat = new THREE.MeshStandardMaterial({
    color: cfg.isSaree ? cfg.shirtColor : isOuter ? cfg.jacketColor : cfg.shirtColor,
    map: fabricTex,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });

  if (cfg.enableCloth !== false && (isOuter || cfg.outfitStyle === 'kurta' || cfg.outfitStyle === 'street_shirt' || cfg.isSaree)) {
    const backCloth = new ClothSolver({
      width: 0.34 * wScale,
      height: cfg.outfitStyle === 'kurta' ? 0.36 : 0.27,
      cols: 6,
      rows: 6,
      material: clothMat,
      stiffness: 0.85,
      damping: 0.95,
      collisionBiasZ: -0.105,
    });
    backCloth.mesh.position.set(0, -0.02 * hScale, -0.115 * abdScale);
    pelvis.add(backCloth.mesh);
    clothSolvers.push(backCloth);
    clothHem = backCloth.mesh;

    if (cfg.isSaree) {
      const pallu = new ClothSolver({
        width: 0.24,
        height: 0.44,
        cols: 5,
        rows: 7,
        material: new THREE.MeshStandardMaterial({
          color: cfg.shirtColor,
          map: textures.silkSareeFabric,
          roughness: 0.65,
          side: THREE.DoubleSide,
        }),
        stiffness: 0.82,
        damping: 0.94,
        collisionBiasZ: -0.11,
      });
      pallu.mesh.position.set(-0.08, 0.16 * hScale, -0.12);
      pallu.mesh.rotation.z = 0.24;
      chest.add(pallu.mesh);
      clothSolvers.push(pallu);
    }
  }

  // Ground Contact Shadow
  const sGeo = new THREE.PlaneGeometry(0.88, 0.88);
  sGeo.rotateX(-Math.PI / 2);
  const contactShadow = new THREE.Mesh(
    sGeo,
    new THREE.MeshBasicMaterial({ map: textures.contactShadow, transparent: true, depthWrite: false, opacity: 0.56 })
  );
  contactShadow.position.y = 0.02;
  rootGroup.add(contactShadow);

  return {
    group: rootGroup,
    pelvis,
    spine,
    chest,
    neck,
    head,
    jawBone,
    clavL,
    clavR,
    leftShoulder: uArmL,
    leftElbow: fArmL,
    rightShoulder: uArmR,
    rightElbow: fArmR,
    leftHip: thighL,
    leftKnee: shinL,
    leftAnkle: footL,
    rightHip: thighR,
    rightKnee: shinR,
    rightAnkle: footR,
    leftEye: eyeL.eyeball,
    rightEye: eyeR.eyeball,
    leftEyelid: eyeL.lid,
    rightEyelid: eyeR.lid,
    leftBrow,
    rightBrow,
    upperLip,
    lowerLip,
    teethMesh,
    tongueMesh,
    hairGroup,
    beardGroup,
    sunglasses,
    backpack,
    chainGroup,
    watch,
    smartphone,
    smartphoneScreenTex,
    coffeeCup,
    groceryBag,
    umbrella,
    clothSolvers,
    clothHem,
    skinnedBody,
    skinMat,
    hairMat,
    skinMaps,
    irisTex,
    contactShadow,
    blinkTimer: 2 + (seed % 4),
    blinkAmount: 0,
    baseHeight: hScale,
  };
}

export function disposeHumanRig(rig: HumanRig): void {
  rig.skinMaps.dispose();
  rig.irisTex.dispose();
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

export function rebuildPlayerCustomization(
  oldRig: HumanRig,
  custom: PlayerCustomization,
  textures: TextureBundle,
  profileBody?: { heightScale: number; widthScale: number; abdomenScale: number; ageGroup: 'young' | 'middle' | 'elder' }
): HumanRig {
  const newRig = createDetailedHumanRig(
    {
      ...custom,
      ageGroup: profileBody?.ageGroup ?? 'young',
      heightScale: profileBody?.heightScale ?? 1.02,
      widthScale: profileBody?.widthScale ?? 1.03,
      abdomenScale: profileBody?.abdomenScale ?? 1.0,
      seed: custom.protagonistId === 'vikram' ? 77 : custom.protagonistId === 'sathish' ? 19 : 42,
      enableCloth: true,
    },
    textures
  );
  newRig.group.position.copy(oldRig.group.position);
  newRig.group.rotation.copy(oldRig.group.rotation);
  newRig.group.visible = oldRig.group.visible;
  if (oldRig.group.parent) {
    oldRig.group.parent.add(newRig.group);
    oldRig.group.parent.remove(oldRig.group);
  }
  disposeHumanRig(oldRig);
  return newRig;
}

export function createArchetypeHuman(
  archetype: NpcArchetype,
  seed: number,
  textures: TextureBundle
): HumanRig {
  const presets: FacePresetId[] = ['arjun_classic', 'karthik_warm', 'rohan_sharp', 'vikram_exec', 'sathish_street'];
  const hairs: HairStyleId[] = ['swept', 'side_part', 'curly', 'short_crop'];
  const facePreset = presets[seed % presets.length];

  const base: HumanBuildConfig = {
    protagonistId: 'arjun',
    facePreset,
    hairStyle: hairs[seed % hairs.length],
    hairColor: '#18181b',
    beardStyle: seed % 3 === 0 ? 'stubble' : seed % 3 === 1 ? 'clean' : 'moustache',
    outfitStyle: 'office',
    jacketColor: '#334155',
    shirtColor: '#e2e8f0',
    pantsColor: '#1e293b',
    shoeColor: '#111827',
    watch: seed % 2 === 0,
    sunglasses: false,
    backpack: false,
    chain: false,
    seed,
    enableCloth: true,
  };

  switch (archetype) {
    case 'it_pro':
      base.shirtColor = ['#e0f2fe', '#f8fafc', '#cbd5e1', '#dbeafe'][seed % 4];
      base.pantsColor = '#1e293b';
      base.backpack = true;
      break;
    case 'student':
      base.outfitStyle = 'hoodie';
      base.jacketColor = ['#be123c', '#0f766e', '#1d4ed8', '#b45309'][seed % 4];
      base.pantsColor = '#172554';
      base.backpack = true;
      base.beardStyle = 'clean';
      base.heightScale = 0.96;
      break;
    case 'saree_woman':
      base.isFemale = true;
      base.isSaree = true;
      base.hairStyle = 'bun';
      base.beardStyle = 'clean';
      base.hasGajra = true;
      base.shirtColor = ['#dc2626', '#7e22ce', '#047857', '#d97706'][seed % 4];
      base.pantsColor = base.shirtColor;
      base.heightScale = 0.95;
      break;
    case 'kurta_citizen':
      base.outfitStyle = 'kurta';
      base.shirtColor = ['#fef3c7', '#e0e7ff', '#dcfce7', '#ffedd5'][seed % 4];
      base.pantsColor = '#f8fafc';
      break;
    case 'auto_driver':
      base.shirtColor = '#a16207';
      base.pantsColor = '#78350f';
      base.beardStyle = 'moustache';
      break;
    case 'delivery_rider':
      base.isDelivery = true;
      base.hasHelmet = true;
      base.shirtColor = '#ea580c';
      base.pantsColor = '#1e293b';
      break;
    case 'traffic_police':
      base.isPolice = true;
      base.hasCap = true;
      base.shirtColor = '#f8fafc';
      base.pantsColor = '#854d0e';
      base.beardStyle = 'moustache';
      break;
    case 'police_officer':
      base.isPolice = true;
      base.hasCap = true;
      base.outfitStyle = 'office';
      base.shirtColor = '#c2a375';
      base.pantsColor = '#9b7b4f';
      base.beardStyle = seed % 2 === 0 ? 'moustache' : 'trimmed_beard';
      base.heightScale = 1.03;
      base.widthScale = 1.06;
      break;
    case 'security_guard':
      base.isPolice = true;
      base.hasCap = true;
      base.outfitStyle = 'office';
      base.shirtColor = '#1e3a8a';
      base.pantsColor = '#0f172a';
      base.beardStyle = 'trimmed_beard';
      break;
    case 'vendor':
      base.outfitStyle = 'kurta';
      base.shirtColor = '#fb923c';
      base.ageGroup = 'middle';
      break;
    case 'construction':
      base.hasHelmet = true;
      base.shirtColor = '#facc15';
      base.pantsColor = '#3f3f46';
      break;
    case 'elder':
      base.ageGroup = 'elder';
      base.hairColor = '#94a3b8';
      base.outfitStyle = 'kurta';
      base.shirtColor = '#f1f5f9';
      base.pantsColor = '#e2e8f0';
      base.heightScale = 0.95;
      base.abdomenScale = 1.08;
      break;
  }

  return createDetailedHumanRig(base, textures);
}

export function updateHumanAnimation(rig: HumanRig, p: HumanAnimParams): void {
  const { pose, speedNorm, stridePhase, elapsed, dt, expression, lookYaw, lookPitch, holdingUmbrella } = p;

  // Natural blinking cycle
  rig.blinkTimer -= dt;
  if (rig.blinkTimer <= 0) {
    rig.blinkAmount = 1;
    if (rig.blinkTimer < -0.13) {
      rig.blinkTimer = 2.4 + Math.abs(Math.sin(elapsed * 13.7)) * 2.6;
      rig.blinkAmount = 0;
    }
  } else {
    rig.blinkAmount = 0;
  }
  const lidPitch = -Math.PI * 0.42 + rig.blinkAmount * 0.62;
  rig.leftEyelid.rotation.x = THREE.MathUtils.damp(rig.leftEyelid.rotation.x, lidPitch, 28, dt);
  rig.rightEyelid.rotation.x = THREE.MathUtils.damp(rig.rightEyelid.rotation.x, lidPitch, 28, dt);

  // JawBone Rotation & Facial Expression Morphing (Lips + Teeth + Tongue + Brows)
  rig.leftEye.rotation.y = THREE.MathUtils.clamp(lookYaw * 0.4, -0.35, 0.35);
  rig.rightEye.rotation.y = rig.leftEye.rotation.y;

  const isChewing = pose === 'eat' || pose === 'drink_coffee';
  const talkOpen =
    isChewing
      ? Math.abs(Math.sin(elapsed * 7.5)) * 0.008 + 0.002
      : expression === 'talking'
      ? Math.abs(Math.sin(elapsed * 12)) * 0.009 + 0.0025
      : expression === 'laugh'
      ? Math.abs(Math.sin(elapsed * 9)) * 0.012 + 0.0065
      : expression === 'fear' || expression === 'surprise'
      ? 0.011
      : 0;

  rig.upperLip.position.y = talkOpen * 0.35;
  rig.jawBone.rotation.x = THREE.MathUtils.damp(rig.jawBone.rotation.x, talkOpen * 20, 18, dt);
  const mouthVisible = talkOpen > 0.0035 || expression === 'happy';
  rig.teethMesh.visible = mouthVisible;
  rig.tongueMesh.visible = talkOpen > 0.0065;
  rig.upperLip.scale.x = expression === 'happy' || expression === 'laugh' ? 1.18 : 1.0;
  rig.lowerLip.scale.x = rig.upperLip.scale.x;

  const browY =
    expression === 'surprise' ? 0.124 : expression === 'fear' ? 0.122 : expression === 'anger' ? 0.112 : 0.118;
  const browTilt =
    expression === 'anger' ? 0.28 : expression === 'focused' ? 0.16 : expression === 'fear' ? -0.18 : 0;
  rig.leftBrow.position.y = browY;
  rig.rightBrow.position.y = browY;
  rig.leftBrow.rotation.z = -browTilt;
  rig.rightBrow.rotation.z = browTilt;

  rig.head.rotation.y = THREE.MathUtils.damp(rig.head.rotation.y, lookYaw * 0.65, 8, dt);
  const laughNod = expression === 'laugh' ? Math.sin(elapsed * 11) * 0.08 : 0;
  rig.head.rotation.x = THREE.MathUtils.damp(
    rig.head.rotation.x,
    lookPitch + laughNod + Math.sin(elapsed * 1.4) * 0.022,
    8,
    dt
  );

  // Target Skeletal Bone Rotations + Leg-Flexion Hip-Drop Grounding & Slope IK
  const isVikram = p.protagonistId === 'vikram';
  const isSathish = p.protagonistId === 'sathish';

  let pelvisY = 0.94 * rig.baseHeight;
  let spinePitch = 0;
  let spineRoll = 0;
  let lHipX = 0;
  let rHipX = 0;
  let lKneeX = 0;
  let rKneeX = 0;
  let lAnkX = p.terrainSlopePitch ?? 0;
  let rAnkX = p.terrainSlopePitch ?? 0;
  let lShX = 0;
  let rShX = 0;
  let lShZ = 0;
  let rShZ = 0;
  let lElbX = -0.16;
  let rElbX = -0.16;
  let lClavZ = 0;
  let rClavZ = 0;

  const usingPhone = pose === 'phone' || !!p.holdingPhone;
  rig.smartphone.visible = usingPhone && pose !== 'swim' && pose !== 'fight' && pose !== 'kick' && pose !== 'knockdown';
  rig.coffeeCup.visible = pose === 'drink_coffee';
  rig.groceryBag.visible = !!p.holdingGroceryBag && pose !== 'swim' && pose !== 'sit';
  rig.umbrella.visible =
    holdingUmbrella &&
    pose !== 'swim' &&
    pose !== 'sit' &&
    !usingPhone &&
    pose !== 'drink_coffee' &&
    pose !== 'eat';

  if (pose === 'walk' || pose === 'run' || pose === 'sprint' || pose === 'climb_stairs') {
    const strideMult = isSathish ? 1.1 : isVikram ? 1.04 : 0.97;
    const isStairs = pose === 'climb_stairs';
    const amp = (isStairs ? 0.72 : pose === 'sprint' ? 0.88 : pose === 'run' ? 0.7 : 0.46) * strideMult;
    const s = Math.sin(stridePhase);
    const c = Math.cos(stridePhase);

    rig.pelvis.rotation.y = s * (isSathish ? 0.13 : 0.08);
    rig.spine.rotation.y = -s * (isSathish ? 0.13 : 0.09);
    rig.pelvis.rotation.z = isSathish ? c * 0.045 : 0;
    spinePitch = isStairs ? 0.16 : pose === 'sprint' ? 0.2 : pose === 'run' ? 0.11 : isVikram ? -0.02 : 0.04;

    lHipX = -s * amp - (isStairs ? 0.22 : 0);
    rHipX = s * amp - (isStairs ? 0.22 : 0);
    lKneeX = Math.max(0.06, -c * amp * 1.1 + (isStairs ? 0.35 : 0));
    rKneeX = Math.max(0.06, c * amp * 1.1 + (isStairs ? 0.35 : 0));
    lAnkX += c * 0.18;
    rAnkX -= c * 0.18;

    // True leg-flexion hip-drop so feet remain firmly planted instead of floating
    const maxFlex = Math.max(Math.abs(lHipX), Math.abs(rHipX));
    pelvisY -= (1 - Math.cos(maxFlex * 0.55)) * 0.36;
    pelvisY += Math.abs(c) * 0.028 * (0.4 + speedNorm);

    lShX = s * amp * (isVikram ? 0.82 : 0.72);
    rShX = -s * amp * (isVikram ? 0.82 : 0.72);
    lElbX = -0.32 - Math.max(0, s) * 0.42;
    rElbX = -0.32 - Math.max(0, -s) * 0.42;
  } else if (pose === 'jump') {
    pelvisY = 0.91 * rig.baseHeight;
    spinePitch = 0.12;
    lHipX = -0.52;
    rHipX = -0.32;
    lKneeX = 0.92;
    rKneeX = 0.55;
    lShX = -1.1;
    rShX = -1.1;
    lClavZ = 0.18;
    rClavZ = -0.18;
  } else if (pose === 'turn') {
    const sway = Math.sin(elapsed * 8) * 0.2;
    rig.pelvis.rotation.y = sway;
    rig.spine.rotation.y = -sway * 0.7;
    lHipX = -0.14;
    rHipX = 0.14;
    lKneeX = 0.22;
    rKneeX = 0.18;
    pelvisY -= 0.03;
  } else if (pose === 'crouch') {
    pelvisY = 0.62 * rig.baseHeight;
    spinePitch = 0.32;
    lHipX = -0.78;
    rHipX = -0.58;
    lKneeX = 1.22;
    rKneeX = 0.98;
  } else if (pose === 'sit') {
    pelvisY = 0.52 * rig.baseHeight;
    spinePitch = -0.05;
    lHipX = -1.45;
    rHipX = -1.45;
    lKneeX = 1.45;
    rKneeX = 1.45;
    lShX = -0.25;
    rShX = -0.25;
    lElbX = -0.65;
    rElbX = -0.65;
  } else if (pose === 'swim') {
    const s = Math.sin(elapsed * 5.2);
    lHipX = s * 0.45;
    rHipX = -s * 0.45;
    lShX = -1.8 + s * 0.9;
    rShX = -1.8 - s * 0.9;
    lClavZ = 0.22;
    rClavZ = -0.22;
  } else if (pose === 'open_door' || pose === 'enter_car' || pose === 'exit_car') {
    const wave = Math.sin(elapsed * 7);
    rShX = -0.95;
    rElbX = -0.45 + wave * 0.25;
    spinePitch = pose === 'enter_car' ? 0.25 : 0.08;
    if (pose === 'enter_car' || pose === 'exit_car') {
      pelvisY = 0.72 * rig.baseHeight;
      lHipX = -0.7;
      lKneeX = 0.95;
      rHipX = -0.45;
      rKneeX = 0.65;
    }
  } else if (pose === 'eat' || pose === 'drink_coffee') {
    const sip = Math.sin(elapsed * 3.2) * 0.16;
    rShX = -0.78 + sip;
    rElbX = -1.55 - sip * 0.4;
    rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, 0.16 + sip * 0.2, 8, dt);
  } else if (pose === 'phone') {
    rShX = -0.65;
    rElbX = -1.15;
    rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, 0.35, 8, dt);
  } else if (pose === 'talk') {
    lShX = -0.35 + Math.sin(elapsed * 3.4) * 0.24;
    rShX = -0.42 + Math.cos(elapsed * 4.1) * 0.28;
    lElbX = -0.85;
    rElbX = -0.95;
  } else if (pose === 'react_fear') {
    lShX = -1.25;
    rShX = -1.25;
    lElbX = -0.9;
    rElbX = -0.9;
    spinePitch = -0.14;
    lClavZ = 0.16;
    rClavZ = -0.16;
  } else if (pose === 'fight') {
    const jab = Math.sin(elapsed * 9);
    lShX = -1.15 + jab * 0.35;
    rShX = -1.35 - jab * 0.45;
    lElbX = -1.2;
    rElbX = jab > 0 ? -0.2 : -1.15;
    spinePitch = 0.14;
  } else if (pose === 'kick') {
    pelvisY = 0.89 * rig.baseHeight;
    spinePitch = -0.18;
    rHipX = -1.38;
    rKneeX = 0.18;
    lKneeX = 0.22;
    lShX = -0.65;
    rShX = 0.45;
    lElbX = -1.0;
  } else if (pose === 'block') {
    pelvisY = 0.86 * rig.baseHeight;
    spinePitch = 0.16;
    lHipX = -0.32;
    rHipX = 0.25;
    lKneeX = 0.42;
    rKneeX = 0.36;
    lShX = -1.28;
    rShX = -1.28;
    lShZ = -0.32;
    rShZ = 0.32;
    lElbX = -1.45;
    rElbX = -1.45;
  } else if (pose === 'dodge') {
    pelvisY = 0.78 * rig.baseHeight;
    spinePitch = 0.24;
    spineRoll = 0.32;
    lHipX = -0.52;
    rHipX = -0.25;
    lKneeX = 0.78;
    rKneeX = 0.55;
    lShX = -0.6;
    rShX = -0.6;
  } else if (pose === 'hit_react') {
    spinePitch = -0.38;
    lShX = -0.4;
    rShX = -0.5;
    lElbX = -0.3;
    rElbX = -0.3;
  } else if (pose === 'knockdown') {
    pelvisY = 0.28 * rig.baseHeight;
    spinePitch = -1.25;
    lHipX = 0.25;
    rHipX = -0.2;
    lKneeX = 0.45;
    rKneeX = 0.3;
    lShX = -0.8;
    rShX = -0.9;
  } else if (pose === 'recover') {
    pelvisY = 0.65 * rig.baseHeight;
    spinePitch = 0.45;
    lHipX = -0.95;
    rHipX = -0.35;
    lKneeX = 1.3;
    rKneeX = 0.75;
    rShX = -0.75;
  } else if (pose === 'handcuffed') {
    const s = speedNorm > 0.05 ? Math.sin(stridePhase) : 0;
    const c = speedNorm > 0.05 ? Math.cos(stridePhase) : 0;
    pelvisY = 0.92 * rig.baseHeight;
    spinePitch = 0.1;
    lHipX = -s * 0.28;
    rHipX = s * 0.28;
    lKneeX = Math.max(0.05, -c * 0.28);
    rKneeX = Math.max(0.05, c * 0.28);
    lShX = 0.44;
    rShX = 0.44;
    lShZ = 0.24;
    rShZ = -0.24;
    lElbX = -0.92;
    rElbX = -0.92;
  } else if (pose === 'arrest_approach') {
    const s = Math.sin(stridePhase);
    const c = Math.cos(stridePhase);
    spinePitch = 0.08;
    lHipX = -s * 0.56;
    rHipX = s * 0.56;
    lKneeX = Math.max(0.06, -c * 0.62);
    rKneeX = Math.max(0.06, c * 0.62);
    lShX = s * 0.32;
    rShX = -0.82;
    lElbX = -0.35;
    rElbX = -0.42;
  } else if (pose === 'traffic_direct') {
    const wave = Math.sin(elapsed * 3.4);
    const cycle = Math.sin(elapsed * 0.9);
    lShX = cycle > 0 ? -1.45 : -0.25;
    lShZ = cycle > 0 ? -0.25 : 0;
    lElbX = cycle > 0 ? -0.18 : -0.5;
    rShX = -0.95 + wave * 0.35;
    rShZ = 0.3 + wave * 0.22;
    rElbX = -0.65 - Math.abs(wave) * 0.35;
  } else if (pose === 'queue_wait') {
    rig.pelvis.rotation.z = Math.sin(elapsed * 1.1) * 0.025;
    lShX = -0.12;
    rShX = -0.32;
    rElbX = -0.75;
  } else if (pose === 'bag_scan') {
    spinePitch = 0.14;
    lShX = -0.54;
    rShX = -0.54;
    lElbX = -0.62;
    rElbX = -0.62;
  } else {
    const breath = Math.sin(elapsed * 2.1);
    rig.chest.scale.set(1 + breath * 0.012, 1, 1 + breath * 0.016);
    rig.pelvis.rotation.z = Math.sin(elapsed * 0.8) * 0.02;
    if (expression === 'laugh') {
      rShX = -0.45;
      rElbX = -1.05;
      spinePitch = -0.06 + Math.sin(elapsed * 10) * 0.05;
    } else if (expression === 'anger') {
      lShX = -0.25;
      rShX = -0.25;
      lElbX = -0.75;
      rElbX = -0.75;
      spinePitch = 0.1;
    }
  }

  if (holdingUmbrella && rig.umbrella.visible) {
    rShX = -0.85;
    rElbX = -1.05;
  } else if (rig.smartphone.visible && pose !== 'phone') {
    rShX = -0.58;
    rElbX = -1.18;
    rShZ = 0.14;
    rig.head.rotation.x = THREE.MathUtils.damp(rig.head.rotation.x, 0.28, 8, dt);
  }
  if (rig.groceryBag.visible) {
    lShX = -0.18;
    lElbX = -0.32;
  }

  if (p.punchTimer && p.punchTimer > 0 && pose !== 'kick' && pose !== 'block') {
    rShX = -1.62;
    rElbX = -0.12;
    rClavZ = -0.14;
    rig.spine.rotation.y = THREE.MathUtils.damp(rig.spine.rotation.y, 0.35, 18, dt);
  }
  if (p.kickTimer && p.kickTimer > 0 && pose !== 'kick' && pose !== 'block') {
    spinePitch = -0.16;
    rHipX = -1.35;
    rKneeX = 0.16;
    lShX = -0.6;
  }

  const blend = pose === 'sprint' || pose === 'dodge' || pose === 'hit_react' ? 16 : 11;
  rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, pelvisY, blend, dt);
  rig.spine.rotation.x = THREE.MathUtils.damp(rig.spine.rotation.x, spinePitch, blend, dt);
  rig.spine.rotation.z = THREE.MathUtils.damp(rig.spine.rotation.z, spineRoll, blend, dt);
  rig.clavL.rotation.z = THREE.MathUtils.damp(rig.clavL.rotation.z, lClavZ, blend, dt);
  rig.clavR.rotation.z = THREE.MathUtils.damp(rig.clavR.rotation.z, rClavZ, blend, dt);
  rig.leftHip.rotation.x = THREE.MathUtils.damp(rig.leftHip.rotation.x, lHipX, blend, dt);
  rig.rightHip.rotation.x = THREE.MathUtils.damp(rig.rightHip.rotation.x, rHipX, blend, dt);
  rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, lKneeX, blend, dt);
  rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, rKneeX, blend, dt);
  rig.leftAnkle.rotation.x = THREE.MathUtils.damp(rig.leftAnkle.rotation.x, lAnkX, blend, dt);
  rig.rightAnkle.rotation.x = THREE.MathUtils.damp(rig.rightAnkle.rotation.x, rAnkX, blend, dt);
  rig.leftShoulder.rotation.x = THREE.MathUtils.damp(rig.leftShoulder.rotation.x, lShX, blend, dt);
  rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, rShX, blend, dt);
  rig.leftShoulder.rotation.z = THREE.MathUtils.damp(rig.leftShoulder.rotation.z, lShZ, blend, dt);
  rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, rShZ, blend, dt);
  rig.leftElbow.rotation.x = THREE.MathUtils.damp(rig.leftElbow.rotation.x, lElbX, blend, dt);
  rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, rElbX, blend, dt);

  if (p.simulateCloth && p.clothCtx && rig.clothSolvers.length > 0) {
    for (const solver of rig.clothSolvers) {
      solver.step(p.clothCtx);
    }
  } else if (rig.clothHem) {
    rig.clothHem.rotation.x = THREE.MathUtils.damp(rig.clothHem.rotation.x, -speedNorm * 0.18, 8, dt);
  }
}

export interface StreetDogRig {
  group: THREE.Group;
  tail: THREE.Mesh;
  legs: THREE.Mesh[];
}

export function createStreetDogRig(colorHex: number, shadowTex: THREE.Texture): StreetDogRig {
  const group = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85 });

  const bodyGeo = new THREE.SphereGeometry(0.16, 12, 10);
  bodyGeo.scale(0.85, 0.85, 1.9);
  const body = new THREE.Mesh(bodyGeo, coatMat);
  body.position.y = 0.36;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), coatMat);
  head.position.set(0, 0.48, 0.32);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.14, 8), coatMat);
  snout.rotation.x = Math.PI * 0.5;
  snout.position.set(0, 0.45, 0.44);
  group.add(head, snout);

  [-0.08, 0.08].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), coatMat);
    ear.position.set(ex, 0.57, 0.3);
    ear.rotation.z = ex < 0 ? 0.3 : -0.3;
    group.add(ear);
  });

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.26, 6), coatMat);
  tail.position.set(0, 0.46, -0.32);
  tail.rotation.x = -0.7;
  group.add(tail);

  const legs: THREE.Mesh[] = [];
  [
    [-0.08, 0.2],
    [0.08, 0.2],
    [-0.08, -0.18],
    [0.08, -0.18],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.28, 6), coatMat);
    leg.position.set(lx, 0.14, lz);
    group.add(leg);
    legs.push(leg);
  });

  const sGeo = new THREE.PlaneGeometry(0.55, 0.75);
  sGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    sGeo,
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.45 })
  );
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, tail, legs };
}
