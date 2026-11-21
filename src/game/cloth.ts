import * as THREE from 'three';

export interface ClothUpdateContext {
  dt: number;
  windX: number;
  windZ: number;
  charVelX: number;
  charVelZ: number;
  charHeading: number;
  strideSpeed: number;
  elapsed: number;
}

/**
 * Chaos-style Verlet Cloth Simulation System.
 * Simulates pinned cloth panels (jacket tails, kurta drapes, saree pallu, overshirt flaps)
 * with gravity, aerodynamic drag from character velocity, directional weather wind,
 * distance/shear constraint relaxation, and torso/thigh collision push-out.
 */
export class ClothSolver {
  public readonly mesh: THREE.Mesh;
  public readonly cols: number;
  public readonly rows: number;
  private readonly segW: number;
  private readonly segH: number;
  private readonly count: number;
  private readonly pos: Float32Array;
  private readonly prevPos: Float32Array;
  private readonly pinned: Uint8Array;
  private readonly restX: Float32Array;
  private readonly restY: Float32Array;
  private readonly restZ: Float32Array;
  private readonly stiffness: number;
  private readonly damping: number;
  private readonly gravity: number;
  private readonly collisionBiasZ: number;

  constructor(opts: {
    width: number;
    height: number;
    cols: number;
    rows: number;
    material: THREE.Material;
    stiffness?: number;
    damping?: number;
    gravity?: number;
    collisionBiasZ?: number;
    pinTopRow?: boolean;
  }) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.segW = opts.width / (opts.cols - 1);
    this.segH = opts.height / (opts.rows - 1);
    this.stiffness = opts.stiffness ?? 0.88;
    this.damping = opts.damping ?? 0.96;
    this.gravity = opts.gravity ?? -9.8;
    this.collisionBiasZ = opts.collisionBiasZ ?? 0.04;

    const geo = new THREE.PlaneGeometry(opts.width, opts.height, opts.cols - 1, opts.rows - 1);
    // Shift plane so top edge is at y = 0 and cloth hangs downward (-y)
    geo.translate(0, -opts.height * 0.5, 0);

    this.mesh = new THREE.Mesh(geo, opts.material);
    this.mesh.castShadow = true;

    const attr = geo.attributes.position;
    this.count = attr.count;
    this.pos = new Float32Array(this.count * 3);
    this.prevPos = new Float32Array(this.count * 3);
    this.restX = new Float32Array(this.count);
    this.restY = new Float32Array(this.count);
    this.restZ = new Float32Array(this.count);
    this.pinned = new Uint8Array(this.count);

    for (let i = 0; i < this.count; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      const z = attr.getZ(i);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.prevPos[i * 3] = x;
      this.prevPos[i * 3 + 1] = y;
      this.prevPos[i * 3 + 2] = z;
      this.restX[i] = x;
      this.restY[i] = y;
      this.restZ[i] = z;

      const row = Math.floor(i / this.cols);
      if ((opts.pinTopRow ?? true) && row === 0) {
        this.pinned[i] = 1;
      }
    }
  }

  public step(ctx: ClothUpdateContext): void {
    const dt = Math.min(ctx.dt, 0.033);
    if (dt <= 0.0001) return;
    const dtSq = dt * dt;

    // Transform world-space wind + opposite character velocity into character local coordinates
    const relWorldX = ctx.windX - ctx.charVelX * 0.72;
    const relWorldZ = ctx.windZ - ctx.charVelZ * 0.72;
    const sinH = Math.sin(ctx.charHeading);
    const cosH = Math.cos(ctx.charHeading);
    // Character forward is (+sinH, +cosH), right is (+cosH, -sinH)
    const localDragX = relWorldX * cosH - relWorldZ * sinH;
    const localDragZ = relWorldX * sinH + relWorldZ * cosH;

    // Micro flutter from stride motion & air turbulence
    const flutter = Math.sin(ctx.elapsed * 7.5 + ctx.strideSpeed * 2.0) * (0.65 + ctx.strideSpeed * 1.4);

    // 1. Verlet Integration
    for (let i = 0; i < this.count; i++) {
      if (this.pinned[i]) continue;
      const i3 = i * 3;
      const x = this.pos[i3];
      const y = this.pos[i3 + 1];
      const z = this.pos[i3 + 2];

      const vx = (x - this.prevPos[i3]) * this.damping;
      const vy = (y - this.prevPos[i3 + 1]) * this.damping;
      const vz = (z - this.prevPos[i3 + 2]) * this.damping;

      this.prevPos[i3] = x;
      this.prevPos[i3 + 1] = y;
      this.prevPos[i3 + 2] = z;

      const rowFrac = Math.floor(i / this.cols) / Math.max(1, this.rows - 1);
      const ax = localDragX * (0.7 + rowFrac * 0.9) + Math.sin(ctx.elapsed * 5.2 + i) * 0.35;
      const ay = this.gravity;
      const az = localDragZ * (0.8 + rowFrac * 1.1) + flutter * rowFrac * 0.45;

      this.pos[i3] = x + vx + ax * dtSq;
      this.pos[i3 + 1] = y + vy + ay * dtSq;
      this.pos[i3 + 2] = z + vz + az * dtSq;
    }

    // 2. Constraint Relaxation (Structural + Diagonal Shear, 3 iterations)
    const diagDist = Math.hypot(this.segW, this.segH);
    for (let iter = 0; iter < 3; iter++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const idx = r * this.cols + c;
          if (c < this.cols - 1) {
            this.satisfy(idx, idx + 1, this.segW);
          }
          if (r < this.rows - 1) {
            this.satisfy(idx, idx + this.cols, this.segH);
          }
          if (r < this.rows - 1 && c < this.cols - 1) {
            this.satisfy(idx, idx + this.cols + 1, diagDist);
          }
        }
      }

      // Prevent cloth from penetrating character pelvis/legs
      for (let i = 0; i < this.count; i++) {
        if (this.pinned[i]) continue;
        const i3 = i * 3;
        if (this.collisionBiasZ < 0 && this.pos[i3 + 2] > this.collisionBiasZ) {
          this.pos[i3 + 2] = this.collisionBiasZ;
        } else if (this.collisionBiasZ > 0 && this.pos[i3 + 2] < this.collisionBiasZ) {
          this.pos[i3 + 2] = this.collisionBiasZ;
        }
        // Subtle restore toward rest shape to avoid excessive over-stretching
        this.pos[i3] += (this.restX[i] - this.pos[i3]) * 0.04;
      }
    }

    // 3. Push positions to BufferGeometry
    const attr = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      attr.setXYZ(i, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    }
    attr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  private satisfy(i1: number, i2: number, restLen: number): void {
    const a3 = i1 * 3;
    const b3 = i2 * 3;
    const dx = this.pos[b3] - this.pos[a3];
    const dy = this.pos[b3 + 1] - this.pos[a3 + 1];
    const dz = this.pos[b3 + 2] - this.pos[a3 + 2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-6) return;
    const diff = ((dist - restLen) / dist) * this.stiffness;

    const p1 = this.pinned[i1];
    const p2 = this.pinned[i2];
    if (p1 && p2) return;
    if (p1) {
      this.pos[b3] -= dx * diff;
      this.pos[b3 + 1] -= dy * diff;
      this.pos[b3 + 2] -= dz * diff;
    } else if (p2) {
      this.pos[a3] += dx * diff;
      this.pos[a3 + 1] += dy * diff;
      this.pos[a3 + 2] += dz * diff;
    } else {
      const half = diff * 0.5;
      this.pos[a3] += dx * half;
      this.pos[a3 + 1] += dy * half;
      this.pos[a3 + 2] += dz * half;
      this.pos[b3] -= dx * half;
      this.pos[b3 + 1] -= dy * half;
      this.pos[b3 + 2] -= dz * half;
    }
  }
}
