import * as THREE from 'three';
import { ConditionId, DISEASE_CATALOG, PlantNodeState } from '../types/game';
import { getCoffeeLeafTexture } from './proceduralTextures';

function createCoffeaLeafGeometry(length = 0.62, width = 0.28): THREE.BufferGeometry {
  const segX = 8;
  const segY = 14;
  const geo = new THREE.PlaneGeometry(width, length, segX, segY);
  // Shift origin to petiole (stem attachment) at y = 0..length
  geo.translate(0, length / 2, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, y / length)); // 0 at base, 1 at tip

    // Acuminate coffee leaf silhouette: narrow petiole -> wide middle -> pointed drip tip
    const profile =
      t < 0.82
        ? Math.sin((t / 0.82) * Math.PI * 0.86)
        : Math.pow(Math.max(0, (1 - t) / 0.18), 1.35) * Math.sin(0.86 * Math.PI);

    // Subtle wavy Coffea margin
    const marginWave = Math.abs(x) > width * 0.18 ? Math.sin(t * Math.PI * 7) * 0.012 : 0;

    // Natural downward arch along length + V-fold along midrib
    const archZ = -Math.pow(t, 1.75) * 0.13 + Math.abs(x / (width * 0.5)) * 0.028 + marginWave;

    pos.setX(i, x * (0.1 + 0.95 * profile));
    pos.setZ(i, archZ);
  }

  geo.computeVertexNormals();
  return geo;
}

const sharedLeafGeo = createCoffeaLeafGeometry(0.64, 0.3);
const sharedSmallLeafGeo = createCoffeaLeafGeometry(0.46, 0.22);
const sharedCherryGeo = new THREE.SphereGeometry(0.048, 14, 12);
sharedCherryGeo.scale(0.88, 1.12, 0.88); // Oval coffee cherry (drupe) shape!
const sharedBorerGeo = new THREE.SphereGeometry(0.016, 8, 6);
sharedBorerGeo.scale(0.8, 1.5, 0.8);

export interface InteractivePlantNodeMesh {
  nodeId: string;
  group: THREE.Group;
  colliderCenter: THREE.Vector3;
  leafPivots: { pivot: THREE.Group; baseRotZ: number; baseRotX: number; mat: THREE.MeshStandardMaterial }[];
  cherries: {
    mesh: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    holeMesh: THREE.Mesh;
    isRipeBase: boolean;
  }[];
  pestParticles: THREE.Group;
  targetRing: THREE.Mesh;
  targetRingMat: THREE.MeshBasicMaterial;
  swayPos: THREE.Vector2;
  swayVel: THREE.Vector2;
  lastRenderedCondition: ConditionId;
  lastRenderedBucket: number;
}

export interface BuiltCoffeePlant {
  plantIndex: number;
  rootGroup: THREE.Group;
  nodes: InteractivePlantNodeMesh[];
}

export function buildCoffeePlantationNodes(
  initialNodes: PlantNodeState[]
): {
  plantsGroup: THREE.Group;
  nodeMeshes: Map<string, InteractivePlantNodeMesh>;
} {
  const plantsGroup = new THREE.Group();
  const nodeMeshes = new Map<string, InteractivePlantNodeMesh>();

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x3b5328,
    roughness: 0.72,
    metalness: 0.05,
  });

  const woodyBaseMat = new THREE.MeshStandardMaterial({
    color: 0x4b3d2a,
    roughness: 0.85,
  });

  // Group initialNodes by plantIndex (0, 1, 2)
  const plantConfigs = [
    {
      index: 0,
      basePos: new THREE.Vector3(-2.15, 0, -0.65),
      rotY: 0.32,
      scale: 0.94,
    },
    {
      // Central Hero Plant — positioned prominently on the left/center just like Dibujo_redisenado.jpg!
      index: 1,
      basePos: new THREE.Vector3(-0.95, 0, 0.25),
      rotY: 0.14,
      scale: 1.08,
    },
    {
      index: 2,
      basePos: new THREE.Vector3(-1.85, 0, 1.2),
      rotY: -0.28,
      scale: 0.92,
    },
  ];

  for (const cfg of plantConfigs) {
    const pGroup = new THREE.Group();
    pGroup.position.copy(cfg.basePos);
    pGroup.rotation.y = cfg.rotY;
    pGroup.scale.setScalar(cfg.scale);

    // Rich volcanic soil mound around base of coffee plant
    const moundGeo = new THREE.CylinderGeometry(0.42, 0.58, 0.14, 18);
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0x2c1e14,
      roughness: 0.95,
    });
    const mound = new THREE.Mesh(moundGeo, moundMat);
    mound.position.y = 0.06;
    mound.receiveShadow = true;
    pGroup.add(mound);

    // Curved organic main coffee stem matching the angled stem in Dibujo_redisenado.jpg
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.18, 0.05, 0),
      new THREE.Vector3(-0.06, 0.72, 0.05),
      new THREE.Vector3(0.12, 1.45, -0.02),
      new THREE.Vector3(0.28, 2.18, 0.04),
    ]);
    const trunkGeo = new THREE.TubeGeometry(stemCurve, 24, 0.042, 10, false);
    const trunkMesh = new THREE.Mesh(trunkGeo, cfg.index === 1 ? stemMat : woodyBaseMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    pGroup.add(trunkMesh);

    const nodesForPlant = initialNodes.filter((n) => n.plantIndex === cfg.index);
    const curveFractions = [0.34, 0.64, 0.91]; // Basal, Central, Superior

    nodesForPlant.forEach((nodeState, idx) => {
      const frac = curveFractions[idx] ?? 0.6;
      const pointOnStem = stemCurve.getPoint(frac);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(pointOnStem);
      pGroup.add(nodeGroup);

      // Compute world position for state sync
      pGroup.updateMatrixWorld(true);
      const worldCenter = new THREE.Vector3();
      nodeGroup.getWorldPosition(worldCenter);
      nodeState.worldPos = [worldCenter.x, worldCenter.y, worldCenter.z];

      // Lateral fruiting branchlet (bandola)
      const branchCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, -0.03, 0.02),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.26, 0.05, -0.02),
      ]);
      const branchMesh = new THREE.Mesh(
        new THREE.TubeGeometry(branchCurve, 10, 0.02, 8, false),
        stemMat
      );
      nodeGroup.add(branchMesh);

      const leafTex = getCoffeeLeafTexture(nodeState.condition, nodeState.severity);
      const leafPivots: InteractivePlantNodeMesh['leafPivots'] = [];

      // Create 5 rich opposite Coffea leaves radiating naturally around the cherry cluster
      const leafConfigs = [
        { pos: [-0.08, 0.03, 0.03], rotZ: 1.15, rotX: 0.28, rotY: 0.15, small: false },
        { pos: [0.09, 0.04, -0.03], rotZ: -1.1, rotX: -0.22, rotY: -0.18, small: false },
        { pos: [-0.03, 0.06, -0.06], rotZ: 0.45, rotX: -0.88, rotY: 0.35, small: false },
        { pos: [0.04, -0.02, 0.07], rotZ: -0.5, rotX: 0.92, rotY: -0.25, small: true },
        { pos: [0.18, 0.07, 0.02], rotZ: -1.35, rotX: 0.12, rotY: 0.1, small: true },
      ];

      for (const lc of leafConfigs) {
        const pivot = new THREE.Group();
        pivot.position.set(lc.pos[0], lc.pos[1], lc.pos[2]);
        pivot.rotation.set(lc.rotX, lc.rotY, lc.rotZ);

        const mat = new THREE.MeshStandardMaterial({
          map: leafTex,
          roughness: 0.36, // Glossy waxy Coffea cuticle!
          metalness: 0.04,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(lc.small ? sharedSmallLeafGeo : sharedLeafGeo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { nodeId: nodeState.id };
        pivot.add(mesh);
        nodeGroup.add(pivot);

        leafPivots.push({
          pivot,
          baseRotZ: lc.rotZ,
          baseRotX: lc.rotX,
          mat,
        });
      }

      // Dense Coffee Cherry Glomerule (cluster of 11 green & crimson-red coffee cherries!)
      const cherries: InteractivePlantNodeMesh['cherries'] = [];
      const holeGeo = new THREE.SphereGeometry(0.013, 8, 8);
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x090605 });

      for (let c = 0; c < 11; c++) {
        const phi = Math.acos(1 - (2 * (c + 0.5)) / 11);
        const theta = Math.PI * (1 + Math.sqrt(5)) * c;
        const radius = 0.078 + (c % 3) * 0.018;

        const cx = Math.sin(phi) * Math.cos(theta) * radius * 1.25;
        const cy = Math.cos(phi) * radius * 0.95;
        const cz = Math.sin(phi) * Math.sin(theta) * radius;

        const isRipeBase = c % 3 === 0 || c === 4; // Mix of bright red and fresh green cherries like the drawing!
        const cherryMat = new THREE.MeshStandardMaterial({
          color: isRipeBase ? 0xc82323 : 0x6ea338,
          roughness: 0.24,
          metalness: 0.05,
        });

        const cherryMesh = new THREE.Mesh(sharedCherryGeo, cherryMat);
        cherryMesh.position.set(cx, cy, cz);
        cherryMesh.lookAt(cx * 2, cy * 2, cz * 2);
        cherryMesh.castShadow = true;
        cherryMesh.userData = { nodeId: nodeState.id };

        // Tiny Broca perforation hole at crown of cherry (visible only when condition === 'broca')
        const holeMesh = new THREE.Mesh(holeGeo, holeMat);
        holeMesh.position.set(0, 0.046, 0);
        holeMesh.visible = false;
        cherryMesh.add(holeMesh);

        nodeGroup.add(cherryMesh);
        cherries.push({
          mesh: cherryMesh,
          mat: cherryMat,
          holeMesh,
          isRipeBase,
        });
      }

      // Animated pest / spore particle group around infected node
      const pestParticles = new THREE.Group();
      for (let p = 0; p < 6; p++) {
        const pMat = new THREE.MeshBasicMaterial({
          color: 0x1a1412,
          transparent: true,
          opacity: 0.9,
        });
        const pMesh = new THREE.Mesh(sharedBorerGeo, pMat);
        pMesh.userData = {
          orbitRadius: 0.14 + p * 0.032,
          orbitSpeed: 1.8 + p * 0.45,
          phase: p * 1.1,
        };
        pestParticles.add(pMesh);
      }
      pestParticles.visible = false;
      nodeGroup.add(pestParticles);

      // Spatial Mixed-Reality Target Ring around botanical node
      const ringGeo = new THREE.RingGeometry(0.22, 0.255, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const targetRing = new THREE.Mesh(ringGeo, ringMat);
      nodeGroup.add(targetRing);

      nodeMeshes.set(nodeState.id, {
        nodeId: nodeState.id,
        group: nodeGroup,
        colliderCenter: worldCenter.clone(),
        leafPivots,
        cherries,
        pestParticles,
        targetRing,
        targetRingMat: ringMat,
        swayPos: new THREE.Vector2(0, 0),
        swayVel: new THREE.Vector2(0, 0),
        lastRenderedCondition: nodeState.condition,
        lastRenderedBucket: -1,
      });
    });

    plantsGroup.add(pGroup);
  }

  return { plantsGroup, nodeMeshes };
}

export function syncPlantNodeVisuals(
  meshEntry: InteractivePlantNodeMesh,
  state: PlantNodeState,
  timeSec: number,
  windSpeed: number,
  isFocusedByCamera: boolean,
  cameraWorldPos: THREE.Vector3
): void {
  const bucket =
    state.condition === 'sana' ? 0 : Math.min(4, Math.max(1, Math.ceil(state.severity / 25)));

  // Update procedural foliage texture only when condition or severity bucket changes
  if (
    meshEntry.lastRenderedCondition !== state.condition ||
    meshEntry.lastRenderedBucket !== bucket
  ) {
    const tex = getCoffeeLeafTexture(state.condition, state.severity);
    for (const lp of meshEntry.leafPivots) {
      lp.mat.map = tex;
      lp.mat.needsUpdate = true;
    }
    meshEntry.lastRenderedCondition = state.condition;
    meshEntry.lastRenderedBucket = bucket;
  }

  // Update coffee cherries appearance (ripeness + broca holes + anthracnose darkening)
  meshEntry.cherries.forEach((c, idx) => {
    const ripeThreshold = (state.ripeness / 100) * 11;
    const isRipe = c.isRipeBase || idx < ripeThreshold;

    if (state.condition === 'antracnosis' && state.severity > 25 && idx % 2 === 0) {
      c.mat.color.setHex(0x241712); // Mummified dark berry
    } else if (state.condition === 'broca' && state.severity > 15 && idx % 2 === 0) {
      c.mat.color.setHex(isRipe ? 0x991b1b : 0x55752a);
    } else {
      c.mat.color.setHex(isRipe ? 0xd62828 : 0x74ad3a);
    }

    c.holeMesh.visible = state.condition === 'broca' && state.severity > 10 && idx % 2 === 0;
  });

  // Update flying/floating pest & spore micro-particles
  if (state.condition !== 'sana' && state.severity > 12) {
    meshEntry.pestParticles.visible = true;
    const profile = DISEASE_CATALOG[state.condition];
    meshEntry.pestParticles.children.forEach((child, idx) => {
      const m = child as THREE.Mesh;
      const mat = m.material as THREE.MeshBasicMaterial;
      const activeCount = Math.ceil((state.severity / 100) * 6);
      m.visible = idx < activeCount;
      if (!m.visible) return;

      if (state.condition === 'broca') {
        mat.color.setHex(0x14110f);
        m.scale.set(1.1, 1.3, 1.1);
      } else if (state.condition === 'minador') {
        mat.color.setHex(0xe2e8f0);
        m.scale.set(1.2, 0.7, 1.2);
      } else {
        // Fungal spore glow
        mat.color.set(profile.accentHex);
        m.scale.setScalar(0.75);
      }

      const { orbitRadius, orbitSpeed, phase } = m.userData;
      const a = timeSec * orbitSpeed + phase;
      m.position.set(
        Math.cos(a) * orbitRadius,
        Math.sin(a * 1.7) * 0.09 + 0.04,
        Math.sin(a) * orbitRadius
      );
    });
  } else {
    meshEntry.pestParticles.visible = false;
  }

  // Spring-damper branch sway (wind + human hand touch!)
  const windForceX = Math.sin(timeSec * 2.1 + meshEntry.colliderCenter.y * 2) * (windSpeed / 100) * 0.085;
  const windForceY = Math.cos(timeSec * 1.6 + meshEntry.colliderCenter.x * 2) * (windSpeed / 100) * 0.05;

  const stiffness = 0.14;
  const damping = 0.84;
  meshEntry.swayVel.x = (meshEntry.swayVel.x + (windForceX - meshEntry.swayPos.x) * stiffness) * damping;
  meshEntry.swayVel.y = (meshEntry.swayVel.y + (windForceY - meshEntry.swayPos.y) * stiffness) * damping;
  meshEntry.swayPos.add(meshEntry.swayVel);

  meshEntry.group.rotation.z = meshEntry.swayPos.x;
  meshEntry.group.rotation.x = meshEntry.swayPos.y;

  // Foliage parting when human hand inspects/brushes leaves!
  const partAmount = state.foliageParted;
  meshEntry.leafPivots.forEach((lp, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    lp.pivot.rotation.z =
      lp.baseRotZ + dir * partAmount * 0.48 + Math.sin(timeSec * 3.2 + i) * (windSpeed / 100) * 0.06;
    lp.pivot.rotation.x = lp.baseRotX + partAmount * 0.22;
  });

  // Update world collider center
  meshEntry.group.getWorldPosition(meshEntry.colliderCenter);

  // Billboard & pulse spatial target ring
  meshEntry.targetRing.lookAt(cameraWorldPos);
  if (isFocusedByCamera) {
    meshEntry.targetRingMat.opacity = 0.85;
    meshEntry.targetRingMat.color.setHex(state.diagnosed ? 0x10b981 : 0x38bdf8);
    const pulse = 1 + Math.sin(timeSec * 8) * 0.07;
    meshEntry.targetRing.scale.setScalar(pulse);
  } else if (state.condition !== 'sana' && state.severity > 20) {
    // Subtle diagnostic hint pulse in Mixed Reality
    meshEntry.targetRingMat.opacity = 0.26 + Math.sin(timeSec * 3.5) * 0.12;
    meshEntry.targetRingMat.color.set(
      state.diagnosed ? DISEASE_CATALOG[state.condition].accentHex : '#fbbf24'
    );
    meshEntry.targetRing.scale.setScalar(0.92);
  } else {
    meshEntry.targetRingMat.opacity = 0;
  }
}
