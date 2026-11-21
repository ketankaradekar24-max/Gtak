# Bengaluru Life Simulator — Codebase Bug Audit & Fixes

This document records concrete bugs, visual/physics glitches, memory leaks, and missing simulation systems identified during inspection of the codebase, along with their root causes and implemented fixes.

---

## 1. Character Rigging, Grounding & GPU Memory Bugs

### Bug 1.1: GPU Memory Leak on Protagonist Switching & Wardrobe Customization
- **Root Cause**: `rebuildPlayerCustomization()` in `src/game/humans.ts` created a new `THREE.SkinnedMesh`, `BufferGeometry` head/limbs, `MeshPhysicalMaterial`, and 1024×1024 `SkinMaps` + `irisTex` CanvasTextures on every protagonist switch (`[P]`) or customization tweak, and removed `oldRig.group` from the scene without calling `.dispose()` on geometries, materials, or per-character dynamic textures.
- **Fix**: Added `disposeHumanRig(rig)` in `src/game/humans.ts` tracking per-rig disposable textures (`skinMaps.albedo/normal/roughness`, `irisTex`) separately from shared `TextureBundle` fabric textures, and invoking `disposeHumanRig(oldRig)` inside `rebuildPlayerCustomization()` and engine disposal.

### Bug 1.2: Foot Hovering / Terrain Penetration & Missing Jawbone Skinning
- **Root Cause**: `updateHumanAnimation()` added upward stride bounce (`+0.044`) to `rig.pelvis.position.y` when knees bent without lowering the pelvis height to compensate for leg flexion `cos(hipAngle)`, causing feet to hover above slopes or clip into asphalt on sprints. Additionally, `rig.jawBone` was created in the 20-bone skeleton but never rotated during speech/laugh/eat animations, and several core motion states (`jump`, `turn`, `climb_stairs`, `open_door`, `enter_car`, `exit_car`, `eat`, `drink_coffee`, `kick`, `block`, `dodge`, `hit_react`, `knockdown`, `recover`) were absent.
- **Fix**: Implemented true leg-flexion hip-drop compensation (`flexDrop`), full slope-aligned ankle IK, `jawBone.rotation.x` animation synced with lip/teeth/tongue visibility, clavicle coupling when shoulders raise, tear-duct/eyelash facial detail, and all 23 full-body animation states.

---

## 2. World Geography, Road Clearance & Tree Placement Bugs

### Bug 2.1: Trees Spawning Inside Road Corridors & Landmark Plazas
- **Root Cause**: `buildBengaluruWorld()` in `src/game/world.ts` scattered `treeSpots` radially around all 35 districts (`dist.x + Math.cos(ang) * 44`) without checking `isPointOnRoad()` or proximity to landmarks, intersections, lakes, or metro stations. Trees occasionally appeared directly on asphalt carriageways or inside station concourses.
- **Fix**: Added `isPointOnRoad(x, z, clearance)` and `isNearBuildingOrStation(x, z)` filtering to every tree candidate in `world.ts`, ensuring a strict ≥ 6.5m clearance outside road edges, intersections, water zones, landmarks, and metro/rail stations.

---

## 3. Transit, Vehicle Fleet, Fuel & AI Traffic Bugs

### Bug 3.1: Instant Metro Teleportation Without Station Interior or Train Ride
- **Root Cause**: Interacting near a Namma Metro station in `BengaluruEngine.ts` immediately teleported the player via `travelRoute()` without allowing concourse exploration, QR ticket validation, platform waiting, or riding inside an animated train carriage.
- **Fix**: Built `src/game/metroSim.ts` with a real 3D walkable Namma Metro Station interior (concourse, ticket counter, QR gates, stairs/escalator, yellow tactile platform, Kannada/English LED arrival board) and an interactive 3D train interior where the player boards, rides past animated Bengaluru viaduct scenery with Kannada/English station announcements, and exits at the chosen destination station.

### Bug 3.2: Incomplete Indian Vehicle Fleet, Missing Fuel System & Instant Car Pop-In
- **Root Cause**: `VEHICLE_SPECS` and `createVehicleRig()` lacked Indian hatchbacks, SUVs, scooters, and delivery trucks; vehicles had infinite fuel with no petrol pump refueling loop; and entering/exiting a car snapped instantly without hinged door animation.
- **Fix**: Added `hatchback`, `suv`, `scooter`, and `truck` rigs in `src/game/entities.ts`, hinged driver doors on 4-wheelers that swing open during `enter_car`/`exit_car` transitions, and per-vehicle fuel capacity + consumption + petrol station refueling across Bengaluru.

---

## 4. Audio, Language, Interiors, Phone & Time Systems

### Bug 4.1: Monotone 8-Note Radio Loop & English-Only Interface
- **Root Cause**: `BengaluruAudio` played a single 8-note C-major sine wave loop with no station categories, playback controls, or local audio support, and the HUD lacked Kannada primary localization (`kn`).
- **Fix**: Built an 8-category Kannada & Indian procedural raga/beat radio synthesizer + local audio file player in `src/game/audio.ts` + `src/components/CarRadioPanel.tsx`, and added `src/game/localization.ts` supporting Kannada (`ಕನ್ನಡ`, primary default), English, Hindi, Tamil, and Telugu.

### Bug 4.2: Non-Enterable Buildings & Missing Daily Life / Phone / Real-Time IST Systems
- **Root Cause**: Safehouses, homes, and shops had only outdoor rings with instant heal toasts; there was no smartphone OS, live Namma Yatri physical cab dispatch, IST real-time clock sync (`Asia/Kolkata`), or save/load persistence.
- **Fix**: Implemented `src/game/interiors.ts` (3D furnished homes/villas, multi-channel simulated TV, bed/sleep, fridge/cooking, shower, Namma Mart supermarket grocery shopping, weapon shop, gym), `src/components/SmartphoneOverlay.tsx` (Contacts, Messages, Calls, Namma Yatri physical cab dispatch, Metro QR tickets, Bank, Camera/Photo Mode), `src/game/saveSystem.ts` (3-slot `localStorage` persistence), and live `Asia/Kolkata` IST clock toggle.
