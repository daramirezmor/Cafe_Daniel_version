import * as THREE from 'three';
import { SpectralMode } from '../types/game';
import { BaseUnitScreenRenderer } from './proceduralTextures';

export interface MonitoringDevice3D {
  rootGroup: THREE.Group;
  cameraHeadGroup: THREE.Group;
  cameraGrabCollider: THREE.Mesh;
  sensorCamera: THREE.PerspectiveCamera;
  lensLight: THREE.SpotLight;
  screenRenderer: BaseUnitScreenRenderer;
  currentHeadWorldPos: THREE.Vector3;
  targetHeadWorldPos: THREE.Vector3;
  aimTargetWorldPos: THREE.Vector3;
  setSensorCaptureMode: (capturing: boolean) => void;
  update: (
    dt: number,
    timeSec: number,
    isGrabbed: boolean,
    isScanning: boolean,
    spectral: SpectralMode,
    statusHex: number
  ) => number; // returns head movement speed
}

export function buildMonitoringDevice(): MonitoringDevice3D {
  const rootGroup = new THREE.Group();
  const basePos = new THREE.Vector3(1.18, 0.0, 0.28);

  // Field tripod / mounting plinth so the device sits at natural ergonomic height next to the coffee bush
  const plinthGroup = new THREE.Group();
  plinthGroup.position.copy(basePos);

  const standPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 0.56, 20),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 })
  );
  standPillar.position.y = 0.28;
  standPillar.castShadow = true;
  standPillar.receiveShadow = true;
  plinthGroup.add(standPillar);

  const standPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.05, 0.82),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.5 })
  );
  standPlate.position.y = 0.56;
  standPlate.receiveShadow = true;
  plinthGroup.add(standPlate);

  // === BASE DIAGNOSTIC UNIT (matching Dibujo_redisenado.jpg) ===
  const baseUnit = new THREE.Group();
  baseUnit.position.set(0, 0.585, 0);
  baseUnit.rotation.y = -0.35; // Angled slightly toward viewer & plants like the 3/4 illustration!

  const darkNavyMat = new THREE.MeshStandardMaterial({
    color: 0x1a293d,
    roughness: 0.38,
    metalness: 0.35,
  });
  const silverBezelMat = new THREE.MeshStandardMaterial({
    color: 0xdbe5f0,
    roughness: 0.28,
    metalness: 0.55,
  });

  // Main chassis body
  const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.25, 0.66), darkNavyMat);
  chassisMesh.position.y = 0.125;
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  baseUnit.add(chassisMesh);

  // Sloped silver top deck
  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.055, 0.64), silverBezelMat);
  topDeck.position.set(0, 0.255, 0);
  topDeck.rotation.z = 0.08;
  topDeck.castShadow = true;
  baseUnit.add(topDeck);

  // Embedded LCD Screen on top deck (live CanvasTexture!)
  const screenRenderer = new BaseUnitScreenRenderer();
  const screenMat = new THREE.MeshBasicMaterial({
    map: screenRenderer.texture,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), screenMat);
  screenMesh.position.set(-0.08, 0.288, 0.04);
  screenMesh.rotation.order = 'YXZ';
  screenMesh.rotation.y = -Math.PI / 2;
  screenMesh.rotation.x = -Math.PI / 2 + 0.12;
  baseUnit.add(screenMesh);

  // Front LED pill bar & indicator dots (exactly as drawn on front-left face of base!)
  const ledPillMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const frontPill = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.16), ledPillMat);
  frontPill.position.set(-0.372, 0.09, 0.0);
  baseUnit.add(frontPill);

  const statusLedMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  for (const zOff of [-0.15, 0.15]) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), statusLedMat);
    dot.position.set(-0.372, 0.09, zOff);
    baseUnit.add(dot);
  }

  // Side cooling louvers (||||||) on right side face
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x0b1320, roughness: 0.8 });
  for (let v = 0; v < 6; v++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.09, 0.012), ventMat);
    slot.position.set(0.08 + v * 0.035, 0.12, 0.332);
    baseUnit.add(slot);
  }

  // Rear braided power/telemetry cable
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.36, 0.1, -0.08),
    new THREE.Vector3(0.56, 0.08, -0.18),
    new THREE.Vector3(0.75, -0.18, -0.28),
    new THREE.Vector3(0.88, -0.55, -0.35),
  ]);
  const cableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 16, 0.022, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 })
  );
  baseUnit.add(cableMesh);

  // Gooseneck collar socket on top-rear of base
  const socketCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.088, 0.11, 20),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.7 })
  );
  socketCollar.position.set(0.16, 0.31, -0.05);
  baseUnit.add(socketCollar);

  plinthGroup.add(baseUnit);
  rootGroup.add(plinthGroup);

  // Compute exact world anchor of gooseneck base socket
  rootGroup.updateMatrixWorld(true);
  const neckSocketWorld = new THREE.Vector3();
  socketCollar.getWorldPosition(neckSocketWorld);
  neckSocketWorld.y += 0.04;

  // === FLEXIBLE METALLIC GOOSENECK (28 Articulated Ribbed Rings) ===
  const NUM_RINGS = 28;
  const neckRings: THREE.Mesh[] = [];
  const ringSilverMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.82,
  });
  const ringDarkMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.65,
  });
  const torusGeo = new THREE.TorusGeometry(0.042, 0.016, 10, 18);

  const neckGroup = new THREE.Group();
  for (let i = 0; i < NUM_RINGS; i++) {
    const ring = new THREE.Mesh(torusGeo, i % 2 === 0 ? ringSilverMat : ringDarkMat);
    ring.castShadow = true;
    neckGroup.add(ring);
    neckRings.push(ring);
  }
  rootGroup.add(neckGroup);

  // === SMART CAMERA HEAD (matching Dibujo_redisenado.jpg) ===
  const cameraHeadGroup = new THREE.Group();
  const initialHeadPos = new THREE.Vector3(0.62, 1.86, 0.28);
  cameraHeadGroup.position.copy(initialHeadPos);

  // Outer silver housing shell
  const camOuter = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.24, 0.44),
    silverBezelMat
  );
  camOuter.castShadow = true;
  cameraHeadGroup.add(camOuter);

  // Side dark-navy recessed plate with 3 white LED dots (• • •)
  const sidePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.292, 0.14, 0.32),
    darkNavyMat
  );
  sidePlate.position.set(0, -0.01, -0.02);
  cameraHeadGroup.add(sidePlate);

  const whiteDotMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  for (let d = -1; d <= 1; d++) {
    const dotL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), whiteDotMat);
    dotL.position.set(-0.149, -0.01, d * 0.055);
    cameraHeadGroup.add(dotL);

    const dotR = dotL.clone();
    dotR.position.x = 0.149;
    cameraHeadGroup.add(dotR);
  }

  // Front bezel & optical lens assembly (facing +Z in local cameraHeadGroup space -> lookAt orients +Z toward plant!)
  const frontBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.22, 0.04),
    darkNavyMat
  );
  frontBezel.position.z = 0.215;
  cameraHeadGroup.add(frontBezel);

  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.095, 0.07, 24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 })
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.z = 0.235;
  cameraHeadGroup.add(lensBarrel);

  const lensGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.55,
    roughness: 0.08,
    metalness: 0.9,
  });
  const lensGlass = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 16), lensGlassMat);
  lensGlass.scale.set(1, 1, 0.35);
  lensGlass.position.z = 0.262;
  cameraHeadGroup.add(lensGlass);

  // Ring illuminator around lens (brightens in NDVI / Night NIR!)
  const lensRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
  });
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.007, 8, 24), lensRingMat);
  lensRing.position.z = 0.268;
  cameraHeadGroup.add(lensRing);

  // Bottom pivot ball joint where gooseneck enters camera head
  const neckMount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.058, 0.09, 16),
    ringDarkMat
  );
  neckMount.position.set(0, -0.14, -0.06);
  cameraHeadGroup.add(neckMount);

  // Volumetric Optical Scan Cone projecting forward (+Z) from lens
  const coneLength = 1.95;
  const coneGeo = new THREE.ConeGeometry(0.46, coneLength, 28, 1, true);
  // Rotate & translate so apex is at lens (0,0,0.27) and open base extends toward +Z!
  coneGeo.rotateX(-Math.PI / 2);
  coneGeo.translate(0, 0, 0.27 + coneLength / 2);

  const scanConeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const scanCone = new THREE.Mesh(coneGeo, scanConeMat);
  cameraHeadGroup.add(scanCone);

  // Subtle laser axis beam inside cone
  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.27),
    new THREE.Vector3(0, 0, 2.2),
  ]);
  const laserMat = new THREE.LineBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.55,
  });
  const laserLine = new THREE.Line(laserGeo, laserMat);
  cameraHeadGroup.add(laserLine);

  // Active spotlight for Night NIR & close inspection illumination
  const lensLight = new THREE.SpotLight(0x7dd3fc, 1.4, 5.5, Math.PI / 6, 0.5, 1.0);
  lensLight.position.set(0, 0, 0.28);
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, 0, 2.5);
  cameraHeadGroup.add(lightTarget);
  lensLight.target = lightTarget;
  cameraHeadGroup.add(lensLight);

  // Embedded Secondary PerspectiveCamera INSIDE the lens for Picture-in-Picture AI Sensor Feed!
  const sensorCamera = new THREE.PerspectiveCamera(40, 240 / 160, 0.12, 16);
  sensorCamera.position.set(0, 0, 0.28);
  // Three.js cameras look down -Z by default; rotate Y by PI so it looks down +Z along our lens cone!
  sensorCamera.rotation.y = Math.PI;
  cameraHeadGroup.add(sensorCamera);

  // Interactive Grab Halo & Invisible Expanded Hit-Sphere so grabbing the camera is effortless!
  const grabHaloMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const grabHalo = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.28, 32), grabHaloMat);
  grabHalo.position.set(0, 0, 0);
  cameraHeadGroup.add(grabHalo);

  const cameraGrabCollider = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  cameraGrabCollider.userData = { isCameraGrabHandle: true };
  cameraHeadGroup.add(cameraGrabCollider);

  rootGroup.add(cameraHeadGroup);

  // Physics state for smooth articulated spring movement
  const currentHeadWorldPos = initialHeadPos.clone();
  const targetHeadWorldPos = initialHeadPos.clone();
  const headVel = new THREE.Vector3();
  const aimTargetWorldPos = new THREE.Vector3(-0.95, 1.25, 0.25); // Initially aimed at hero coffee plant!

  const update = (
    dt: number,
    timeSec: number,
    isGrabbed: boolean,
    isScanning: boolean,
    spectral: SpectralMode,
    statusHex: number
  ): number => {
    // Clamp target camera head within realistic articulated gooseneck workspace
    targetHeadWorldPos.x = Math.max(-0.25, Math.min(1.65, targetHeadWorldPos.x));
    targetHeadWorldPos.y = Math.max(0.98, Math.min(2.45, targetHeadWorldPos.y));
    targetHeadWorldPos.z = Math.max(-0.75, Math.min(1.35, targetHeadWorldPos.z));

    const prevPos = currentHeadWorldPos.clone();
    const stiffness = isGrabbed ? 18 : 11;
    const damping = 0.78;

    const force = targetHeadWorldPos.clone().sub(currentHeadWorldPos).multiplyScalar(stiffness * dt);
    headVel.add(force).multiplyScalar(damping);
    currentHeadWorldPos.add(headVel);

    cameraHeadGroup.position.copy(currentHeadWorldPos);
    cameraHeadGroup.lookAt(aimTargetWorldPos);

    // Solve S-curved Gooseneck spline between neckSocketWorld and neckMount world position
    cameraHeadGroup.updateMatrixWorld(true);
    const headMountWorld = new THREE.Vector3();
    neckMount.getWorldPosition(headMountWorld);

    const mid1 = neckSocketWorld
      .clone()
      .lerp(headMountWorld, 0.33)
      .add(new THREE.Vector3(0.14, 0.12, -0.05));
    const mid2 = neckSocketWorld
      .clone()
      .lerp(headMountWorld, 0.68)
      .add(new THREE.Vector3(-0.08, 0.08, 0.04));

    const spline = new THREE.CatmullRomCurve3([
      neckSocketWorld,
      mid1,
      mid2,
      headMountWorld,
    ]);

    for (let i = 0; i < NUM_RINGS; i++) {
      const t = i / (NUM_RINGS - 1);
      const pt = spline.getPoint(t);
      const tangent = spline.getTangent(t);
      const ring = neckRings[i];
      ring.position.copy(pt);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    }

    // Visual response on lens, cone & base LEDs
    const coneColor =
      spectral === 'thermal_nir'
        ? 0x22d3ee
        : spectral === 'ndvi'
          ? 0x4ade80
          : statusHex;
    scanConeMat.color.setHex(coneColor);
    scanConeMat.opacity = isScanning
      ? 0.22 + Math.sin(timeSec * 12) * 0.06
      : 0.11 + Math.sin(timeSec * 3) * 0.02;

    lensRingMat.color.setHex(coneColor);
    statusLedMat.color.setHex(coneColor);
    lensLight.intensity = spectral === 'thermal_nir' ? 3.6 : spectral === 'ndvi' ? 2.1 : 1.2;
    lensLight.color.setHex(spectral === 'thermal_nir' ? 0x38bdf8 : 0xffffff);

    grabHaloMat.opacity = isGrabbed ? 0.75 : 0.28 + Math.sin(timeSec * 4) * 0.1;
    grabHaloMat.color.setHex(isGrabbed ? 0x38bdf8 : 0x93c5fd);
    grabHalo.scale.setScalar(isGrabbed ? 1.14 : 1.0);

    const moveSpeed = currentHeadWorldPos.distanceTo(prevPos) / Math.max(0.008, dt);
    return moveSpeed;
  };

  const setSensorCaptureMode = (capturing: boolean): void => {
    scanCone.visible = !capturing;
    laserLine.visible = !capturing;
    grabHalo.visible = !capturing;
  };

  return {
    rootGroup,
    cameraHeadGroup,
    cameraGrabCollider,
    sensorCamera,
    lensLight,
    screenRenderer,
    currentHeadWorldPos,
    targetHeadWorldPos,
    aimTargetWorldPos,
    setSensorCaptureMode,
    update,
  };
}
