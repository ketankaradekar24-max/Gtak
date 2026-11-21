import * as THREE from 'three';
import {
  CONGESTION_ZONES,
  DISTRICTS,
  METRO_STATIONS,
  POLICE_STATIONS,
  ROAD_SEGMENTS,
  SILK_BOARD_FLYOVER_LOOP,
  VEHICLE_SPECS,
  computeBmrclMetroFare,
  getDistrictAt,
  getFlyoverDeckY,
  getNearestPoliceStation,
} from '../src/game/bengaluruData';
import { RoadNetworkRouter } from '../src/game/GeoJsonWorldPartition';
import { buildAllInteriors } from '../src/game/interiors';
import { buildMetroInterior } from '../src/game/metroSim';
import {
  METRO_DOOR_X,
  METRO_PASSENGER_CONVERSATIONS,
  getActiveCoachIndex,
} from '../src/game/metroTrain';
import { getBengaluruSolarTimes, getIndiaStandardTime } from '../src/game/saveSystem';

// Minimal headless canvas/document shim for Three.js CanvasTexture in Node verification
if (typeof globalThis.document === 'undefined') {
  const createCtx = () => ({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  });

  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => createCtx(),
        };
      }
      return {};
    },
  };
}

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(`VERIFICATION FAILED: ${message}`);
  }
}

function runVerification(): void {
  console.log('1. Verifying Asia/Kolkata (IST) clock & Bengaluru solar elevation math...');
  const ist = getIndiaStandardTime();
  assert(ist.timezoneLabel === 'Asia/Kolkata (IST)', `Expected Asia/Kolkata (IST), got ${ist.timezoneLabel}`);
  assert(
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(ist.weekdayLabel),
    `Invalid weekdayLabel: ${ist.weekdayLabel}`
  );
  assert(ist.clockLabel.endsWith('IST'), `Expected IST suffix in clockLabel, got ${ist.clockLabel}`);

  const solarNoon = getBengaluruSolarTimes(12.33, 120);
  const solarMidnight = getBengaluruSolarTimes(0.5, 120);
  assert(solarNoon.elevationDeg > 60, `Expected high Bengaluru noon sun, got ${solarNoon.elevationDeg}°`);
  assert(solarMidnight.elevationDeg < -30, `Expected negative midnight sun elevation, got ${solarMidnight.elevationDeg}°`);
  assert(solarNoon.sunrise.startsWith('05:') || solarNoon.sunrise.startsWith('06:'), `Unexpected sunrise ${solarNoon.sunrise}`);
  assert(solarNoon.sunset.startsWith('18:') || solarNoon.sunset.startsWith('17:'), `Unexpected sunset ${solarNoon.sunset}`);
  console.log(`   OK: ${ist.weekdayLabel}, ${ist.dateLabel}, ${ist.clockLabel} | Sunrise ${solarNoon.sunrise} Sunset ${solarNoon.sunset} Noon ${solarNoon.elevationDeg}°`);

  console.log('2. Verifying BMRCL Metro station statuses & geographical district resolution...');
  const operational = METRO_STATIONS.filter((s) => s.status === 'operational');
  const underConst = METRO_STATIONS.filter((s) => s.status === 'under_construction');
  assert(operational.length === 22, `Expected 22 operational stations (Purple/Green/Yellow incl. Bommasandra), got ${operational.length}`);
  assert(
    operational.some((s) => s.id === 'my_bommasandra' && s.line === 'yellow'),
    'Missing Bommasandra terminal on Yellow Line'
  );
  assert(underConst.length === 8, `Expected 8 under-construction stations (Pink/Blue), got ${underConst.length}`);
  assert(
    underConst.every((s) => s.line === 'pink' || s.line === 'blue'),
    'Only Pink and Blue lines should be under construction'
  );
  assert(CONGESTION_ZONES.length >= 7, `Expected >=7 congestion zones, got ${CONGESTION_ZONES.length}`);
  const sbMid = SILK_BOARD_FLYOVER_LOOP[2];
  assert(
    getFlyoverDeckY(sbMid.x, sbMid.z) > 4.0,
    `Expected Silk Board flyover deck elevation > 4m, got ${getFlyoverDeckY(sbMid.x, sbMid.z)}`
  );

  // Verify Trinity Metro specifically does NOT resolve to Yelahanka!
  const trinity = operational.find((s) => s.id === 'mp_trinity');
  assert(Boolean(trinity), 'Trinity Metro station missing');
  const trinityDistrict = getDistrictAt(trinity!.x, trinity!.z);
  assert(
    trinityDistrict.id !== 'yelahanka',
    `Trinity Metro resolved to Yelahanka! Got ${trinityDistrict.id}`
  );
  for (const st of operational) {
    const dist = getDistrictAt(st.x, st.z);
    assert(Boolean(dist && dist.name), `Station ${st.id} failed district lookup`);
    if (!st.id.includes('yelahanka')) {
      assert(
        dist.id !== 'yelahanka',
        `Operational station ${st.id} unexpectedly resolved to yelahanka`
      );
    }
  }
  console.log(`   OK: ${operational.length} operational stations resolved accurately; Trinity -> ${trinityDistrict.name}`);

  console.log('3. Verifying RoadNetworkRouter GeoJSON road waypoints & Metro interchanges...');
  const router = new RoadNetworkRouter(ROAD_SEGMENTS);
  const mg = DISTRICTS.find((d) => d.id === 'mg_road')!;
  const koramangala = DISTRICTS.find((d) => d.id === 'koramangala')!;
  const roadWaypoints = router.findRoadWaypoints(mg.x, mg.z, koramangala.x, koramangala.z);
  assert(roadWaypoints.length >= 2, `Expected >=2 waypoints for MG Road -> Koramangala, got ${roadWaypoints.length}`);

  const singleLineRoute = router.findMetroRouteStations('mp_mg_road', 'mp_indiranagar', METRO_STATIONS);
  assert(
    singleLineRoute.map((s) => s.id).join(',') === 'mp_mg_road,mp_trinity,mp_indiranagar',
    `Unexpected single-line Purple route: ${singleLineRoute.map((s) => s.id).join(',')}`
  );

  const interchangeRoute = router.findMetroRouteStations('mp_trinity', 'mg_jayanagar', METRO_STATIONS);
  assert(
    interchangeRoute.some((s) => s.id === 'mp_majestic' || s.id === 'mg_majestic'),
    `Expected Majestic interchange on Trinity -> Jayanagar route, got ${interchangeRoute.map((s) => s.id).join(',')}`
  );

  const twoInterchangeRoute = router.findMetroRouteStations('mp_indiranagar', 'my_ecity', METRO_STATIONS);
  assert(
    twoInterchangeRoute.some((s) => s.line === 'green') &&
      twoInterchangeRoute.some((s) => s.line === 'yellow'),
    `Expected Purple -> Green -> Yellow route to Electronic City, got ${twoInterchangeRoute.map((s) => s.id).join(' -> ')}`
  );
  const roadInfo = router.getNearestRoadInfo(mg.x, mg.z);
  assert(Boolean(roadInfo && roadInfo.road.id), 'Expected valid nearest road info at MG Road');
  const nodePt = roadInfo!.road.points[0];
  const targets = router.getConnectedIntersectionTargets(nodePt.x, nodePt.z, 0, false);
  assert(targets.length >= 1, `Expected >=1 connected intersection targets at ${roadInfo!.road.name}, got ${targets.length}`);

  assert(POLICE_STATIONS.length >= 5, `Expected >=5 police stations, got ${POLICE_STATIONS.length}`);
  const nearestPs = getNearestPoliceStation(mg.x, mg.z);
  assert(Boolean(nearestPs && nearestPs.name), 'Expected nearest police station lookup to succeed');

  assert(computeBmrclMetroFare(1, false) === 10, 'Expected minimum BMRCL fare ₹10');
  assert(
    computeBmrclMetroFare(4, true) < computeBmrclMetroFare(4, false),
    'Expected 5% Smart Card discount on multi-stop fare'
  );
  assert(Boolean(VEHICLE_SPECS.ambulance && VEHICLE_SPECS.delivery), 'Missing ambulance or delivery specs');
  console.log(`   OK: Road waypoints (${roadWaypoints.length} pts), ${targets.length} junction targets, ${POLICE_STATIONS.length} police stations & Metro multi-line interchange (${twoInterchangeRoute.map((s) => s.name).join(' -> ')})`);

  console.log('4. Verifying 3D Metro station vertical navigation, elevator, escalators, and camera containment...');
  const scene = new THREE.Scene();
  const metro = buildMetroInterior(scene);
  assert(metro.group.children.length > 20, `Metro interior mesh count unexpectedly low: ${metro.group.children.length}`);

  const spawnBounds = metro.getStationCameraBounds(
    metro.concourseSpawn.x,
    metro.concourseSpawn.y,
    metro.concourseSpawn.z
  );
  assert(
    metro.concourseSpawn.x > spawnBounds.minX &&
      metro.concourseSpawn.x < spawnBounds.maxX &&
      metro.concourseSpawn.z > spawnBounds.minZ &&
      metro.concourseSpawn.z < spawnBounds.maxZ,
    'Concourse spawn is outside station camera bounds'
  );

  const concourseFloorY = metro.getFloorY(metro.concourseSpawn.x, metro.concourseSpawn.z, -140);
  assert(Math.abs(concourseFloorY - -140) < 0.01, `Expected concourse floor Y=-140, got ${concourseFloorY}`);

  const elevMidFloorY = metro.getFloorY(metro.elevatorCabCenter.x, metro.elevatorCabCenter.z, -137.5);
  assert(Math.abs(elevMidFloorY - -137.5) < 0.01, `Expected elevator mid floor Y=-137.5, got ${elevMidFloorY}`);

  const platTrig = metro.triggers.find((t) => t.id === 'call_elevator_platform');
  assert(Boolean(platTrig), 'Missing call_elevator_platform trigger');
  const platFloorY = metro.getFloorY(platTrig!.x, platTrig!.z, -135.2);
  assert(Math.abs(platFloorY - -135.2) < 0.1, `Platform elevator trigger floor expected -135.2, got ${platFloorY}`);

  const escUpMove = metro.getEscalatorMove(-1.8, -138.0, -1214.0);
  assert(escUpMove !== null && escUpMove.dir === 'up', `Expected upward escalator at x=-1.8, got ${JSON.stringify(escUpMove)}`);
  const escDownMove = metro.getEscalatorMove(1.8, -138.0, -1214.0);
  assert(escDownMove !== null && escDownMove.dir === 'down', `Expected downward escalator at x=1.8, got ${JSON.stringify(escDownMove)}`);
  assert(metro.isOnStairs(-9.0, -1214.0), 'Expected staircase detection at x=-9.0, z=-1214');

  const boardTrigs = metro.triggers.filter((t) => t.id === 'board_train');
  assert(
    boardTrigs.length === METRO_DOOR_X.length && boardTrigs.length === 10,
    `Expected 10 board_train triggers matching 5-car METRO_DOOR_X, got ${boardTrigs.length}`
  );
  assert(metro.coachCount === 4, `Expected 4 walkable metro coaches, got ${metro.coachCount}`);
  assert(metro.passengerCount === 18, `Expected 18 animated coach passengers, got ${metro.passengerCount}`);
  assert(
    metro.triggers.some((t) => t.id === 'tvm_kiosk') &&
      metro.triggers.some((t) => t.id === 'smart_card_kiosk') &&
      metro.triggers.some((t) => t.id === 'security_scan') &&
      metro.triggers.some((t) => t.id === 'exit_gate'),
    'Missing required Metro station concourse triggers (tvm_kiosk, smart_card_kiosk, security_scan, exit_gate)'
  );
  assert(
    METRO_PASSENGER_CONVERSATIONS.length >= 6,
    `Expected >=6 Kannada Metro passenger conversations, got ${METRO_PASSENGER_CONVERSATIONS.length}`
  );
  const paxInteract = metro.interactNearestPassenger(metro.trainCabinSpawn.x - 1.0, metro.trainCabinSpawn.z, 'kn');
  assert(paxInteract !== null && paxInteract.text.length > 5, 'Failed to interact with nearby Metro coach passenger');

  assert(getActiveCoachIndex(-1218) === 1, 'Expected coach 1 at z=-1218');
  assert(getActiveCoachIndex(-1200) === 2, 'Expected coach 2 at z=-1200');
  assert(getActiveCoachIndex(-1182) === 3, 'Expected coach 3 at z=-1182');
  assert(getActiveCoachIndex(-1164) === 4, 'Expected coach 4 at z=-1164');

  const frontCoachBounds = metro.getStationCameraBounds(
    metro.trainCabinSpawn.x,
    metro.trainCabinSpawn.y,
    -1218
  );
  const rearCoachBounds = metro.getStationCameraBounds(
    metro.trainCabinSpawn.x,
    metro.trainCabinSpawn.y,
    -1164
  );
  assert(
    -1218 >= frontCoachBounds.minZ && -1164 <= rearCoachBounds.maxZ,
    '4-coach train cabin bounds failed to span coaches 1..4'
  );
  console.log('   OK: Metro concourse/TVM/SmartCard/Security/ExitGate/elevator/escalator/10-door platform/4 coaches/18 passengers verified.');

  console.log('5. Verifying all 3D building interior pockets and camera bounds...');
  const interiors = buildAllInteriors(scene);
  assert(Boolean(interiors.pockets.police_jail), 'Missing police_jail interior pocket');
  const jailPocket = interiors.pockets.police_jail;
  assert(
    jailPocket.triggers.some((t) => t.id === 'jail_booking') &&
      jailPocket.triggers.some((t) => t.id === 'exit_door'),
    'Missing jail_booking or exit_door trigger in police_jail interior'
  );
  for (const [id, pocket] of Object.entries(interiors.pockets)) {
    const b = pocket.bounds;
    const camTestY = pocket.spawn.y + 1.5;
    assert(
      pocket.spawn.x > b.minX &&
        pocket.spawn.x < b.maxX &&
        camTestY >= b.minY &&
        camTestY < b.maxY &&
        pocket.spawn.z > b.minZ &&
        pocket.spawn.z < b.maxZ,
      `Interior ${id} camera (${pocket.spawn.x}, ${camTestY}, ${pocket.spawn.z}) outside bounds`
    );
  }
  console.log(`   OK: All ${Object.keys(interiors.pockets).length} interior pockets (incl. police_jail) have valid spawn & camera bounds.`);
  console.log('ALL WORLD SYSTEM CHECKS PASSED.');
}

runVerification();
