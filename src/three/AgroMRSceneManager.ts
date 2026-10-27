import * as THREE from 'three';
import { soundEngine } from '../audio/soundEngine';
import {
  ActionToolId,
  ConditionId,
  DISEASE_CATALOG,
  EnvironmentState,
  GameHUDState,
  GamePlayMode,
  HandTrackingSnapshot,
  PlantNodeState,
  ReactionLogEntry,
  RealityMode,
  SpatialAnchor2D,
  SpectralMode,
  WEATHER_PRESETS,
  WeatherId,
} from '../types/game';
import { HandLandmark3D } from '../vision/handTracker';
import {
  buildCoffeePlantationNodes,
  InteractivePlantNodeMesh,
  syncPlantNodeVisuals,
} from './coffeePlantBuilder';
import { buildMonitoringDevice, MonitoringDevice3D } from './monitoringDeviceBuilder';

const HAND_BONE_PAIRS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

interface EffectParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

function createInitialNodes(): PlantNodeState[] {
  return [
    {
      id: 'p0_basal',
      plantIndex: 0,
      plantName: 'Planta Norte',
      variety: 'Castillo',
      zoneLabel: 'Rama Basal',
      condition: 'sana',
      severity: 0,
      diagnosed: false,
      diagnosedConfidence: 98.4,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 45,
      completedTools: [],
      worldPos: [-2.1, 0.7, -0.6],
    },
    {
      id: 'p0_central',
      plantIndex: 0,
      plantName: 'Planta Norte',
      variety: 'Castillo',
      zoneLabel: 'Glomérulo Medio',
      condition: 'broca',
      severity: 38,
      diagnosed: false,
      diagnosedConfidence: 95.6,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 72,
      completedTools: [],
      worldPos: [-2.0, 1.3, -0.6],
    },
    {
      id: 'p0_top',
      plantIndex: 0,
      plantName: 'Planta Norte',
      variety: 'Castillo',
      zoneLabel: 'Dosel Superior',
      condition: 'sana',
      severity: 0,
      diagnosed: false,
      diagnosedConfidence: 99.1,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 35,
      completedTools: [],
      worldPos: [-1.9, 1.9, -0.6],
    },
    // Hero Central Plant (matches Dibujo_redisenado.jpg!)
    {
      id: 'p1_basal',
      plantIndex: 1,
      plantName: 'Planta Central (Coffea)',
      variety: 'Caturra',
      zoneLabel: 'Rama Basal Húmeda',
      condition: 'roya',
      severity: 46,
      diagnosed: false,
      diagnosedConfidence: 97.2,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 55,
      completedTools: [],
      worldPos: [-1.0, 0.75, 0.25],
    },
    {
      id: 'p1_central',
      plantIndex: 1,
      plantName: 'Planta Central (Coffea)',
      variety: 'Caturra',
      zoneLabel: 'Racimo Principal',
      condition: 'sana',
      severity: 0,
      diagnosed: false,
      diagnosedConfidence: 99.2,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 65,
      completedTools: [],
      worldPos: [-0.88, 1.42, 0.25],
    },
    {
      id: 'p1_top',
      plantIndex: 1,
      plantName: 'Planta Central (Coffea)',
      variety: 'Caturra',
      zoneLabel: 'Ápice Foliar',
      condition: 'mancha_hierro',
      severity: 29,
      diagnosed: false,
      diagnosedConfidence: 94.1,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 40,
      completedTools: [],
      worldPos: [-0.72, 2.02, 0.28],
    },
    // South Plant
    {
      id: 'p2_basal',
      plantIndex: 2,
      plantName: 'Planta Sur',
      variety: 'Borbón Rosado',
      zoneLabel: 'Rama Basal',
      condition: 'sana',
      severity: 0,
      diagnosed: false,
      diagnosedConfidence: 98.8,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 50,
      completedTools: [],
      worldPos: [-1.85, 0.72, 1.2],
    },
    {
      id: 'p2_central',
      plantIndex: 2,
      plantName: 'Planta Sur',
      variety: 'Borbón Rosado',
      zoneLabel: 'Glomérulo Central',
      condition: 'antracnosis',
      severity: 34,
      diagnosed: false,
      diagnosedConfidence: 95.3,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 58,
      completedTools: [],
      worldPos: [-1.75, 1.35, 1.18],
    },
    {
      id: 'p2_top',
      plantIndex: 2,
      plantName: 'Planta Sur',
      variety: 'Borbón Rosado',
      zoneLabel: 'Dosel Superior',
      condition: 'sana',
      severity: 0,
      diagnosed: false,
      diagnosedConfidence: 99.0,
      scanProgress: 0,
      foliageParted: 0,
      ripeness: 38,
      completedTools: [],
      worldPos: [-1.65, 1.92, 1.2],
    },
  ];
}

export class AgroMRSceneManager {
  private container: HTMLElement;
  private sensorCanvas: HTMLCanvasElement | null = null;
  private sensorCtx: CanvasRenderingContext2D | null = null;

  private renderer: THREE.WebGLRenderer;
  private sensorRenderTarget: THREE.WebGLRenderTarget;
  private sensorPixelBuffer: Uint8Array;
  private sensorTempCanvas: HTMLCanvasElement;
  private sensorTempCtx: CanvasRenderingContext2D;

  private scene: THREE.Scene;
  private mainCamera: THREE.PerspectiveCamera;

  // Orbit viewer state
  private orbitYaw = 0.08;
  private orbitPitch = 0.22;
  private orbitDist = 4.65;
  private orbitTarget = new THREE.Vector3(-0.05, 1.26, 0.22);

  // Environment 3D groups
  private virtualWorldBackdrop: THREE.Group;
  private arGridHelper: THREE.GridHelper;
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private shadeCanopyGroup: THREE.Group;
  private rainLines: THREE.LineSegments;

  // Core game entities
  private nodeStates: PlantNodeState[];
  private nodeMeshes: Map<string, InteractivePlantNodeMesh>;
  private device: MonitoringDevice3D;

  // 3D Human Hand Avatar (21 joints + bones + spatial cursor ring)
  private handAvatarGroup: THREE.Group;
  private handJointMeshes: THREE.Mesh[] = [];
  private handBoneLines: THREE.LineSegments;
  private spatialCursorMesh: THREE.Mesh;
  private currentHandWorldPos = new THREE.Vector3(-0.2, 1.4, 0.8);

  // Particle system for treatments & spore dispersal
  private effectsGroup = new THREE.Group();
  private activeParticles: EffectParticle[] = [];

  // Game & Simulation state
  private playMode: GamePlayMode = 'mission';
  private realityMode: RealityMode = 'merged';
  private activeTool: ActionToolId = 'camera_grab';
  private score = 0;
  private combo = 1;
  private plantationHealth = 88;
  private harvestProgress = 18;
  private missionsCompleted = 0;
  private waveNumber = 1;
  private focusedNodeId: string | null = null;
  private selectedDiagnosisNodeId: string | null = 'p1_basal';
  private missionBanner: string | null = null;
  private bannerTimeout: number | null = null;

  private environment: EnvironmentState = {
    weather: 'sunny',
    temperature: 25,
    humidity: 60,
    windSpeed: 22,
    shadeLevel: 45,
    spectralMode: 'rgb',
    autoSpectral: true,
  };

  private handSnapshot: HandTrackingSnapshot = {
    status: 'idle',
    handDetected: false,
    isPinching: false,
    isOpenPalm: false,
    palmNormalized: { x: 0.5, y: 0.5, z: 0 },
    velocity: 0,
    gestureLabel: 'Control espacial por Mouse / Touch activo',
  };
  private latestLandmarks: HandLandmark3D[] | null = null;

  private logs: ReactionLogEntry[] = [];

  // Pointer & keyboard interaction state
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2(0, 0);
  private isDraggingCameraHead = false;
  private isOrbitingScene = false;
  private lastPointerPx = { x: 0, y: 0 };
  private keysPressed = new Set<string>();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.28);

  private rafId: number | null = null;
  private clock = new THREE.Clock();
  private simAccumulator = 0;
  private weatherCycleTimer = 0;
  private lastHudEmitMs = 0;
  private lastPipRenderMs = 0;
  private lastSporeWarningMs = 0;
  private onHudSync: (state: GameHUDState) => void;

  constructor(container: HTMLElement, onHudSync: (state: GameHUDState) => void) {
    this.container = container;
    this.onHudSync = onHudSync;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // Offscreen render target for the Gooseneck Camera's Live Optical Sensor View!
    const pipW = 256;
    const pipH = 172;
    this.sensorRenderTarget = new THREE.WebGLRenderTarget(pipW, pipH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.sensorPixelBuffer = new Uint8Array(pipW * pipH * 4);
    this.sensorTempCanvas = document.createElement('canvas');
    this.sensorTempCanvas.width = pipW;
    this.sensorTempCanvas.height = pipH;
    this.sensorTempCtx = this.sensorTempCanvas.getContext('2d')!;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeafe);
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.032);

    this.mainCamera = new THREE.PerspectiveCamera(46, width / height, 0.1, 80);
    this.updateOrbitCamera();

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xf1f5f9, 1.15);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.1);
    this.sunLight.position.set(4.5, 8.5, 5.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 22;
    const d = 4.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-4, 3, -4);
    this.scene.add(rimLight);

    // Build Generated Colombian Coffee Plantation Backdrop
    const envBuilt = this.buildGeneratedEnvironment();
    this.virtualWorldBackdrop = envBuilt.backdrop;
    this.arGridHelper = envBuilt.arGrid;
    this.shadeCanopyGroup = envBuilt.shadeCanopy;
    this.rainLines = envBuilt.rainLines;
    this.scene.add(this.virtualWorldBackdrop);
    this.scene.add(this.arGridHelper);
    this.scene.add(this.rainLines);

    // Build Interactive Coffee Plants (Coffea)
    this.nodeStates = createInitialNodes();
    const builtPlants = buildCoffeePlantationNodes(this.nodeStates);
    this.nodeMeshes = builtPlants.nodeMeshes;
    this.scene.add(builtPlants.plantsGroup);

    // Build Articulated Agricultural Monitoring Device
    this.device = buildMonitoringDevice();
    // Point initial camera head toward hero central basal roya node so user sees immediate action!
    const heroNode = this.nodeStates.find((n) => n.id === 'p1_basal')!;
    this.device.aimTargetWorldPos.set(
      heroNode.worldPos[0],
      heroNode.worldPos[1],
      heroNode.worldPos[2]
    );
    this.scene.add(this.device.rootGroup);

    // Build 3D Human Hand Avatar & Spatial Cursor
    const handBuilt = this.buildHumanHandAvatar();
    this.handAvatarGroup = handBuilt.group;
    this.handJointMeshes = handBuilt.joints;
    this.handBoneLines = handBuilt.bones;
    this.spatialCursorMesh = handBuilt.cursor;
    this.scene.add(this.handAvatarGroup);
    this.scene.add(this.spatialCursorMesh);

    this.scene.add(this.effectsGroup);

    // Initial welcome logs demonstrating human + environment reactivity
    this.pushLog(
      'system',
      'Sistema de Monitoreo Agrícola Iniciado',
      'Arrastra el cabezal de la Cámara IA (o usa tu mano en webcam) hacia las ramas de café para diagnosticar plagas y enfermedades.',
      'info'
    );
    this.pushLog(
      'environment',
      'Entorno Generado: Cafetal Andino (1,650 msnm)',
      'Focos iniciales detectados en el ecosistema: Roya en Planta Central y Broca en Planta Norte.',
      'warning'
    );

    this.applyEnvironmentVisuals();
    this.attachInputListeners();
    this.startLoop();
  }

  public setSensorCanvas(canvas: HTMLCanvasElement | null): void {
    this.sensorCanvas = canvas;
    this.sensorCtx = canvas ? canvas.getContext('2d') : null;
  }

  private buildGeneratedEnvironment(): {
    backdrop: THREE.Group;
    arGrid: THREE.GridHelper;
    shadeCanopy: THREE.Group;
    rainLines: THREE.LineSegments;
  } {
    const backdrop = new THREE.Group();

    // Rich volcanic terrace ground
    const groundGeo = new THREE.CircleGeometry(24, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3b4d2b,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    backdrop.add(ground);

    // Mulched coffee furrow strip beneath our 3 interactive plants
    const bedGeo = new THREE.CylinderGeometry(2.65, 2.85, 0.05, 36);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x3a281b,
      roughness: 0.96,
    });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(-1.35, 0.02, 0.25);
    bed.receiveShadow = true;
    backdrop.add(bed);

    // Scenic Andean mountain ridges & background coffee rows
    const hillMat1 = new THREE.MeshStandardMaterial({ color: 0x2d5a36, roughness: 0.9 });
    const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x3b6e4c, roughness: 0.92 });
    const hills = [
      { pos: [-9, -1.2, -13], r: 8.5, mat: hillMat1 },
      { pos: [2, -1.5, -16], r: 10.5, mat: hillMat2 },
      { pos: [12, -1.0, -12], r: 7.5, mat: hillMat1 },
    ];
    for (const h of hills) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(h.r, 24, 16), h.mat);
      m.scale.set(1.4, 0.55, 0.9);
      m.position.set(h.pos[0], h.pos[1], h.pos[2]);
      backdrop.add(m);
    }

    // Background plantation coffee bushes for depth
    const bushFoliageMat = new THREE.MeshStandardMaterial({ color: 0x225432, roughness: 0.8 });
    for (let row = 0; row < 3; row++) {
      for (let col = -4; col <= 4; col++) {
        const bx = col * 2.1 + (row % 2) * 0.8;
        const bz = -4.2 - row * 2.4;
        const bush = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.55, 9), bushFoliageMat);
        bush.position.set(bx, 0.75, bz);
        backdrop.add(bush);
      }
    }

    // Agroforestry Guamo Shade Canopy overhead (scales with shadeLevel!)
    const shadeCanopy = new THREE.Group();
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x2f5e2e,
      roughness: 0.85,
      transparent: true,
      opacity: 0.72,
    });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
    const shadeTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 4.4, 10), trunkMat);
    shadeTrunk.position.set(-3.4, 2.2, -1.9);
    shadeCanopy.add(shadeTrunk);

    const pads = [
      [-2.1, 4.1, -0.8, 2.1],
      [-0.8, 4.3, 0.5, 1.85],
      [-2.6, 3.95, 1.1, 1.65],
    ];
    for (const [px, py, pz, pr] of pads) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(pr, 16, 12), canopyMat);
      pad.scale.set(1.2, 0.22, 1.1);
      pad.position.set(px, py, pz);
      pad.castShadow = true;
      shadeCanopy.add(pad);
    }
    backdrop.add(shadeCanopy);

    // Mixed Reality AR spatial anchor grid (shown when realityMode === 'mixed_ar')
    const arGrid = new THREE.GridHelper(6.5, 18, 0x38bdf8, 0x1e3a5f);
    arGrid.position.set(-0.2, 0.01, 0.25);
    (arGrid.material as THREE.Material).transparent = true;
    (arGrid.material as THREE.Material).opacity = 0.42;
    arGrid.visible = false;

    // Rain particle lines
    const rainCount = 420;
    const rainPositions = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 9;
      const ry = Math.random() * 5;
      const rz = (Math.random() - 0.5) * 7;
      rainPositions[i * 6 + 0] = rx;
      rainPositions[i * 6 + 1] = ry;
      rainPositions[i * 6 + 2] = rz;
      rainPositions[i * 6 + 3] = rx - 0.05;
      rainPositions[i * 6 + 4] = ry - 0.28;
      rainPositions[i * 6 + 5] = rz;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.52,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.visible = false;

    return { backdrop, arGrid, shadeCanopy, rainLines };
  }

  private buildHumanHandAvatar(): {
    group: THREE.Group;
    joints: THREE.Mesh[];
    bones: THREE.LineSegments;
    cursor: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const joints: THREE.Mesh[] = [];
    const jointGeo = new THREE.SphereGeometry(0.022, 10, 10);
    const jointMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.95,
    });

    for (let i = 0; i < 21; i++) {
      const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
      const m = new THREE.Mesh(jointGeo, isTip ? tipMat : jointMat);
      if (isTip) m.scale.setScalar(1.25);
      group.add(m);
      joints.push(m);
    }

    const bonePositions = new Float32Array(HAND_BONE_PAIRS.length * 6);
    const boneGeo = new THREE.BufferGeometry();
    boneGeo.setAttribute('position', new THREE.BufferAttribute(bonePositions, 3));
    const boneMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.82,
    });
    const bones = new THREE.LineSegments(boneGeo, boneMat);
    group.add(bones);
    group.visible = false;

    // Spatial 3D Hand / Tool Cursor for seamless mouse/touch + MR interaction
    const cursorGeo = new THREE.TorusGeometry(0.095, 0.011, 10, 28);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const cursor = new THREE.Mesh(cursorGeo, cursorMat);
    cursor.position.set(-0.5, 1.35, 0.5);

    return { group, joints, bones, cursor };
  }

  // === PUBLIC CONTROLS FOR UI & HAND TRACKER ===

  public updateHandFrame(snapshot: HandTrackingSnapshot, landmarks: HandLandmark3D[] | null): void {
    this.handSnapshot = snapshot;
    this.latestLandmarks = landmarks;
  }

  public setRealityMode(mode: RealityMode): void {
    this.realityMode = mode;
    this.applyEnvironmentVisuals();
    const labels: Record<RealityMode, string> = {
      merged: 'Merged Reality: Entorno 3D Generado + Presencia Humana Fusionada',
      mixed_ar: 'Mixed Reality AR: Cámara Física en Vivo + Objetos 3D Anclados',
      virtual_3d: 'Entorno Cafetal 3D Completo: Simulación Espacial Directa',
    };
    this.pushLog('system', `Modo Cambiado → ${labels[mode]}`, 'El renderizador espacial ajustó la fusión humano-entorno.', 'info');
    this.emitHud(true);
  }

  public setPlayMode(mode: GamePlayMode): void {
    this.playMode = mode;
    this.showBanner(
      mode === 'mission'
        ? 'Modo Misión Activo: Protege la cosecha frente al clima cambiante'
        : 'Modo Laboratorio Libre: Experimenta con el clima, plagas y la Cámara IA'
    );
    this.emitHud(true);
  }

  public setActiveTool(tool: ActionToolId): void {
    this.activeTool = tool;
    soundEngine.unlock();
    this.emitHud(true);
  }

  public setWeather(weather: WeatherId): void {
    const preset = WEATHER_PRESETS[weather];
    this.environment.weather = weather;
    this.environment.temperature = preset.temperature;
    this.environment.humidity = preset.humidity;
    this.environment.windSpeed = preset.windSpeed;

    if (this.environment.autoSpectral) {
      this.environment.spectralMode = preset.recommendedSpectral;
    }

    this.applyEnvironmentVisuals();
    soundEngine.setRainAmbience(weather === 'rain');

    this.pushLog(
      'environment',
      `Clima del Entorno → ${preset.label}`,
      `${preset.ecosystemEffectMsg} ${preset.cameraReactionMsg}`,
      weather === 'rain' ? 'warning' : 'info'
    );
    this.emitHud(true);
  }

  public updateEnvironmentParam(
    patch: Partial<Pick<EnvironmentState, 'humidity' | 'windSpeed' | 'shadeLevel' | 'spectralMode' | 'autoSpectral'>>
  ): void {
    Object.assign(this.environment, patch);
    if (patch.spectralMode) {
      this.environment.autoSpectral = false;
    }
    this.applyEnvironmentVisuals();
    this.emitHud(true);
  }

  public triggerEcologicalEvent(conditionToSpawn?: ConditionId): void {
    const candidates = this.nodeStates.filter((n) => n.condition === 'sana');
    const target =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : this.nodeStates[Math.floor(Math.random() * this.nodeStates.length)];

    const weatherFavored: Record<WeatherId, ConditionId[]> = {
      sunny: ['broca', 'mancha_hierro'],
      rain: ['roya', 'antracnosis'],
      fog: ['antracnosis', 'roya'],
      night_nir: ['minador', 'roya'],
    };
    const pool = weatherFavored[this.environment.weather];
    const chosen = conditionToSpawn || pool[Math.floor(Math.random() * pool.length)];

    target.condition = chosen;
    target.severity = Math.max(26, Math.min(68, target.severity + 34));
    target.diagnosed = false;
    target.scanProgress = 0;
    target.completedTools = [];

    const profile = DISEASE_CATALOG[chosen];
    this.spawnParticles(
      new THREE.Vector3(...target.worldPos),
      new THREE.Color(profile.accentHex),
      18,
      0.55
    );
    soundEngine.playWarningBeep();

    this.pushLog(
      'environment',
      `Evento Biológico: Brote de ${profile.name}`,
      `Condiciones del entorno activaron síntomas en ${target.plantName} (${target.zoneLabel}). ¡Apunta la Cámara IA para diagnosticar!`,
      'warning'
    );
    this.emitHud(true);
  }

  public focusCameraOnNode(nodeId: string): void {
    const node = this.nodeStates.find((n) => n.id === nodeId);
    if (!node) return;
    soundEngine.unlock();
    soundEngine.playServoMove(0.8);

    // Move camera head to an ergonomic vantage point facing this node
    this.device.targetHeadWorldPos.set(
      Math.max(0.15, node.worldPos[0] + 1.38),
      Math.max(1.05, Math.min(2.3, node.worldPos[1] + 0.14)),
      node.worldPos[2] + 0.12
    );
    this.device.aimTargetWorldPos.set(node.worldPos[0], node.worldPos[1], node.worldPos[2]);
    this.selectedDiagnosisNodeId = node.id;
    this.emitHud(true);
  }

  public applyToolToNode(nodeId: string, tool: ActionToolId): void {
    const node = this.nodeStates.find((n) => n.id === nodeId);
    if (!node) return;
    const meshEntry = this.nodeMeshes.get(nodeId);
    const pos = new THREE.Vector3(...node.worldPos);

    if (tool === 'hand_inspect') {
      node.foliageParted = 1.0;
      if (meshEntry) {
        meshEntry.swayVel.x += (Math.random() - 0.5) * 0.16;
        meshEntry.swayVel.y += 0.09;
      }
      soundEngine.playLeafRustle(0.8);
      this.spawnParticles(pos, new THREE.Color('#4ade80'), 8, 0.35);
      this.pushLog(
        'human',
        `Interacción Humana en ${node.plantName}`,
        `Apartaste el follaje de ${node.zoneLabel}: el envés de la hoja quedó expuesto (+precisión óptica).`,
        'info'
      );
      this.emitHud(true);
      return;
    }

    if (tool === 'camera_grab') {
      this.focusCameraOnNode(nodeId);
      return;
    }

    // Agronomic treatment tools!
    const profile = DISEASE_CATALOG[node.condition];
    if (node.condition === 'sana') {
      if (tool === 'nutrition') {
        node.ripeness = Math.min(100, node.ripeness + 18);
        this.score += 25;
        soundEngine.playActionSuccess();
        this.spawnParticles(pos, new THREE.Color('#facc15'), 16, 0.5);
        this.pushLog(
          'human',
          `Bioestimulación en ${node.plantName}`,
          'Nutrición potásica aceleró la maduración uniforme de cerezas sanas (+25 pts).',
          'success'
        );
      } else {
        this.pushLog(
          'system',
          `${node.plantName} (${node.zoneLabel}) ya está sana`,
          'No requiere intervención fitosanitaria; enfoca otra rama con síntomas.',
          'info'
        );
      }
      this.emitHud(true);
      return;
    }

    if (!node.diagnosed) {
      soundEngine.playWarningBeep();
      this.focusCameraOnNode(nodeId);
      this.pushLog(
        'system',
        'Diagnóstico Requerido Primero',
        `Apunta la Cámara a ${node.plantName} (${node.zoneLabel}) para confirmar la plaga y severidad antes de tratar.`,
        'warning'
      );
      this.emitHud(true);
      return;
    }

    const matchingStep = profile.actionSteps.find((s) => s.tool === tool);
    const toolColors: Record<string, string> = {
      biocontrol: '#38bdf8',
      prune_rere: '#f43f5e',
      shade_climate: '#a3e635',
      nutrition: '#facc15',
    };
    this.spawnParticles(pos, new THREE.Color(toolColors[tool] || '#38bdf8'), 24, 0.65);

    if (tool === 'shade_climate') {
      // Also adjusts environmental shade toward optimal 48%!
      this.environment.shadeLevel = Math.round(this.environment.shadeLevel * 0.5 + 48 * 0.5);
      this.applyEnvironmentVisuals();
    }

    if (matchingStep) {
      if (!node.completedTools.includes(tool)) {
        node.completedTools.push(tool);
      }
      const stepCount = Math.max(1, profile.actionSteps.length);
      const reduction = Math.ceil(100 / stepCount) + 12;
      node.severity = Math.max(0, node.severity - reduction);

      if (meshEntry) {
        meshEntry.swayVel.x += 0.1;
      }

      if (node.severity <= 4 || node.completedTools.length >= profile.actionSteps.length) {
        // Cured completely!
        const curedName = profile.name;
        node.condition = 'sana';
        node.severity = 0;
        node.completedTools = [];
        node.diagnosed = true;
        node.ripeness = Math.min(100, node.ripeness + 14);

        const gained = 120 * this.combo;
        this.score += gained;
        this.combo = Math.min(5, this.combo + 1);
        this.missionsCompleted += 1;
        this.harvestProgress = Math.min(100, this.harvestProgress + 12);

        soundEngine.playActionSuccess();
        this.spawnParticles(pos, new THREE.Color('#10b981'), 32, 0.85);
        this.pushLog(
          'human',
          `¡Plan de Acción Completado! (${curedName} erradicada)`,
          `${node.plantName} (${node.zoneLabel}) recuperó su vigor fitosanitario (+${gained} pts, Combo x${this.combo}).`,
          'success'
        );

        if (this.harvestProgress >= 100) {
          this.waveNumber += 1;
          this.harvestProgress = 15;
          this.score += 300;
          this.showBanner(`¡Cosecha Café Especial Lograda! Iniciando Ciclo Climático #${this.waveNumber} (+300 pts)`);
        }
      } else {
        this.score += 45;
        soundEngine.playActionSuccess();
        this.pushLog(
          'human',
          `Paso Ejecutado: ${matchingStep.label}`,
          `Severidad en ${node.zoneLabel} reducida al ${Math.round(node.severity)}%. Completa el siguiente paso del Plan de Acción.`,
          'success'
        );
      }
    } else {
      // Wrong tool for this specific pest/disease -> teaches real agronomy!
      this.combo = 1;
      soundEngine.playWarningBeep();
      this.pushLog(
        'system',
        'Tratamiento Subóptimo para este Diagnóstico',
        `Para ${profile.name}, revisa las acciones recomendadas en la tarjeta del Plan de Acción.`,
        'warning'
      );
    }

    this.recomputePlantationHealth();
    this.emitHud(true);
  }

  public setCameraPreset(preset: 'diagram' | 'overview' | 'screen_closeup'): void {
    if (preset === 'diagram') {
      this.orbitYaw = 0.08;
      this.orbitPitch = 0.21;
      this.orbitDist = 4.65;
      this.orbitTarget.set(-0.05, 1.26, 0.22);
    } else if (preset === 'overview') {
      this.orbitYaw = -0.38;
      this.orbitPitch = 0.34;
      this.orbitDist = 5.6;
      this.orbitTarget.set(-0.45, 1.25, 0.25);
    } else {
      this.orbitYaw = -0.25;
      this.orbitPitch = 0.42;
      this.orbitDist = 2.35;
      this.orbitTarget.set(0.95, 0.92, 0.28);
    }
    this.updateOrbitCamera();
  }

  public resetMission(): void {
    const fresh = createInitialNodes();
    fresh.forEach((f, idx) => {
      const target = this.nodeStates[idx];
      if (!target) return;
      const keepWorld = target.worldPos;
      Object.assign(target, f, { worldPos: keepWorld });
    });
    this.score = 0;
    this.combo = 1;
    this.harvestProgress = 18;
    this.waveNumber = 1;
    this.recomputePlantationHealth();
    this.setWeather('sunny');
    this.showBanner('Cafetal reiniciado — ¡Escanea las plantas con la Cámara IA!');
    this.emitHud(true);
  }

  // === ENVIRONMENT VISUALS & SIMULATION ===

  private applyEnvironmentVisuals(): void {
    const isAR = this.realityMode === 'mixed_ar';
    this.virtualWorldBackdrop.visible = !isAR;
    this.arGridHelper.visible = isAR;

    // Scale Agroforestry Shade Canopy with shadeLevel
    const shadeFactor = Math.max(0.05, this.environment.shadeLevel / 100);
    this.shadeCanopyGroup.visible = !isAR && this.environment.shadeLevel > 6;
    this.shadeCanopyGroup.scale.set(0.55 + shadeFactor * 0.65, 1, 0.55 + shadeFactor * 0.65);

    const w = this.environment.weather;
    this.rainLines.visible = w === 'rain';

    if (isAR) {
      this.scene.background = null;
      this.scene.fog = null;
      this.renderer.setClearColor(0x000000, 0);
    } else {
      if (w === 'sunny') {
        const sky = new THREE.Color(0xcffafe).lerp(new THREE.Color(0x93c5fd), 0.45);
        this.scene.background = sky;
        this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.025);
        this.ambientLight.intensity = 1.2;
        this.sunLight.intensity = 2.25 * (1 - shadeFactor * 0.38);
        this.sunLight.color.setHex(0xfffbeb);
      } else if (w === 'rain') {
        this.scene.background = new THREE.Color(0x475569);
        this.scene.fog = new THREE.FogExp2(0x475569, 0.068);
        this.ambientLight.intensity = 0.85;
        this.sunLight.intensity = 0.75;
        this.sunLight.color.setHex(0xcbd5e1);
      } else if (w === 'fog') {
        this.scene.background = new THREE.Color(0xcbd5e1);
        this.scene.fog = new THREE.FogExp2(0xcbd5e1, 0.115);
        this.ambientLight.intensity = 1.05;
        this.sunLight.intensity = 0.9;
        this.sunLight.color.setHex(0xe2e8f0);
      } else {
        // Night NIR
        this.scene.background = new THREE.Color(0x06101f);
        this.scene.fog = new THREE.FogExp2(0x06101f, 0.065);
        this.ambientLight.intensity = 0.28;
        this.sunLight.intensity = 0.18;
        this.sunLight.color.setHex(0x38bdf8);
      }
    }
  }

  private updateOrbitCamera(): void {
    this.orbitPitch = Math.max(-0.02, Math.min(1.05, this.orbitPitch));
    this.orbitDist = Math.max(2.0, Math.min(7.5, this.orbitDist));

    const x =
      this.orbitTarget.x +
      Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist;
    const y = this.orbitTarget.y + Math.sin(this.orbitPitch) * this.orbitDist;
    const z =
      this.orbitTarget.z +
      Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist;

    this.mainCamera.position.set(x, y, z);
    this.mainCamera.lookAt(this.orbitTarget);
  }

  // === INPUT HANDLING (MOUSE / TOUCH / KEYBOARD + LIVE WEBCAM HAND) ===

  private attachInputListeners(): void {
    const dom = this.renderer.domElement;

    const updateNDC = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect();
      this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      soundEngine.unlock();
      dom.setPointerCapture(e.pointerId);
      this.lastPointerPx = { x: e.clientX, y: e.clientY };
      updateNDC(e.clientX, e.clientY);

      if (e.button === 2 || e.altKey) {
        this.isOrbitingScene = true;
        return;
      }

      this.raycaster.setFromCamera(this.pointerNDC, this.mainCamera);

      // 1. Check if grabbing the 3D Monitoring Camera Head directly
      const grabHit = this.raycaster.intersectObject(this.device.cameraGrabCollider, false);
      if (grabHit.length > 0) {
        this.isDraggingCameraHead = true;
        this.dragPlane.setFromNormalAndCoplanarPoint(
          this.mainCamera.getWorldDirection(new THREE.Vector3()).negate(),
          this.device.currentHeadWorldPos
        );
        return;
      }

      // 2. Check if clicking a Coffee Plant Node
      const hitNodeId = this.raycastPlantNode();
      if (hitNodeId) {
        if (this.activeTool === 'camera_grab') {
          this.focusCameraOnNode(hitNodeId);
          this.isDraggingCameraHead = true;
          this.dragPlane.setFromNormalAndCoplanarPoint(
            this.mainCamera.getWorldDirection(new THREE.Vector3()).negate(),
            this.device.targetHeadWorldPos
          );
        } else {
          this.applyToolToNode(hitNodeId, this.activeTool);
        }
        return;
      }

      // 3. Background drag orbits the 3D scene smoothly!
      this.isOrbitingScene = true;
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - this.lastPointerPx.x;
      const dy = e.clientY - this.lastPointerPx.y;
      const moveSpeed = Math.hypot(dx, dy);
      this.lastPointerPx = { x: e.clientX, y: e.clientY };
      updateNDC(e.clientX, e.clientY);

      if (this.isOrbitingScene) {
        this.orbitYaw -= dx * 0.0065;
        this.orbitPitch += dy * 0.0055;
        this.updateOrbitCamera();
        return;
      }

      this.raycaster.setFromCamera(this.pointerNDC, this.mainCamera);

      // Update 3D spatial cursor position
      const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.25);
      const intersectPt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(cursorPlane, intersectPt)) {
        this.spatialCursorMesh.position.lerp(intersectPt, 0.45);
        this.spatialCursorMesh.lookAt(this.mainCamera.position);
      }

      if (this.isDraggingCameraHead) {
        const dragPt = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, dragPt)) {
          this.device.targetHeadWorldPos.copy(dragPt);
          // Automatically orient camera lens toward nearest coffee plant node along its gaze!
          const nearest = this.findNearestNodeToPoint(
            new THREE.Vector3(-1.35, dragPt.y - 0.15, dragPt.z)
          );
          if (nearest) {
            this.device.aimTargetWorldPos.lerp(
              new THREE.Vector3(...nearest.worldPos),
              0.35
            );
          }
          soundEngine.playServoMove(moveSpeed * 0.04);
        }
        return;
      }

      // Brush foliage organically when moving cursor across coffee leaves!
      const hoveredNodeId = this.raycastPlantNode();
      if (hoveredNodeId && moveSpeed > 3) {
        this.handleHumanBrushNode(hoveredNodeId, Math.min(2.5, moveSpeed * 0.05));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      this.isDraggingCameraHead = false;
      this.isOrbitingScene = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.orbitDist += e.deltaY * 0.0028;
      this.updateOrbitCamera();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      this.keysPressed.add(e.key.toLowerCase());
      if (e.key >= '1' && e.key <= '6') {
        const tools: ActionToolId[] = [
          'camera_grab',
          'hand_inspect',
          'biocontrol',
          'prune_rere',
          'shade_climate',
          'nutrition',
        ];
        this.setActiveTool(tools[Number(e.key) - 1]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.key.toLowerCase());
    };

    const onResize = () => {
      if (!this.container) return;
      const w = Math.max(320, this.container.clientWidth);
      const h = Math.max(240, this.container.clientHeight);
      this.mainCamera.aspect = w / h;
      this.mainCamera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    // Save cleanup reference on instance
    this.cleanupListeners = () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
    };
  }

  private cleanupListeners: () => void = () => {};

  private raycastPlantNode(): string | null {
    const meshes: THREE.Object3D[] = [];
    this.nodeMeshes.forEach((entry) => {
      meshes.push(entry.group);
    });
    const hits = this.raycaster.intersectObjects(meshes, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData?.nodeId) return obj.userData.nodeId as string;
        obj = obj.parent;
      }
    }
    return null;
  }

  private findNearestNodeToPoint(pt: THREE.Vector3): PlantNodeState | null {
    let best: PlantNodeState | null = null;
    let bestDist = Infinity;
    for (const n of this.nodeStates) {
      const d = pt.distanceTo(new THREE.Vector3(...n.worldPos));
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  private handleHumanBrushNode(nodeId: string, velocity: number): void {
    const node = this.nodeStates.find((n) => n.id === nodeId);
    const meshEntry = this.nodeMeshes.get(nodeId);
    if (!node || !meshEntry) return;

    meshEntry.swayVel.x += (Math.random() - 0.5) * 0.055 * velocity;
    meshEntry.swayVel.y += (Math.random() - 0.5) * 0.04 * velocity;
    node.foliageParted = Math.min(1, node.foliageParted + 0.22);
    soundEngine.playLeafRustle(Math.min(1, velocity * 0.45));

    // Realistic ecological reaction: rough shaking of high-severity fungal leaf disperses spores!
    const now = performance.now();
    if (
      velocity > 1.75 &&
      node.severity > 66 &&
      (node.condition === 'roya' || node.condition === 'antracnosis') &&
      now - this.lastSporeWarningMs > 5500
    ) {
      this.lastSporeWarningMs = now;
      this.spawnParticles(
        new THREE.Vector3(...node.worldPos),
        new THREE.Color(DISEASE_CATALOG[node.condition].accentHex),
        22,
        0.75
      );
      soundEngine.playWarningBeep();

      // Potentially infect an adjacent healthy node
      const healthyNeighbor = this.nodeStates.find(
        (other) => other.id !== node.id && other.condition === 'sana'
      );
      if (healthyNeighbor) {
        healthyNeighbor.condition = node.condition;
        healthyNeighbor.severity = 22;
        healthyNeighbor.diagnosed = false;
        healthyNeighbor.scanProgress = 0;
        this.pushLog(
          'human',
          '¡Dispersión Accidental de Esporas!',
          `Sacudiste bruscamente ${node.plantName} con ${DISEASE_CATALOG[node.condition].name} crítica: las esporas viajaron hacia ${healthyNeighbor.plantName} (${healthyNeighbor.zoneLabel}).`,
          'danger'
        );
      }
    }
  }

  // === MAIN FRAME LOOP ===

  private startLoop(): void {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.clock.getDelta());
      const elapsed = this.clock.elapsedTime;

      this.processKeyboardControls(dt);
      this.processLiveHandInteraction(dt);
      this.updateOpticalScanning(dt);
      this.updateBiologicalSimulation(dt);
      this.updateRainAndParticles(dt);

      // Update plant node 3D meshes & physics
      for (const n of this.nodeStates) {
        const m = this.nodeMeshes.get(n.id);
        if (m) {
          syncPlantNodeVisuals(
            m,
            n,
            elapsed,
            this.environment.windSpeed,
            this.focusedNodeId === n.id,
            this.mainCamera.position
          );
        }
      }

      // Update articulated camera device + base unit screen
      const activeNode =
        this.nodeStates.find((n) => n.id === (this.focusedNodeId || this.selectedDiagnosisNodeId)) ||
        null;
      const statusHex = !activeNode
        ? 0x38bdf8
        : !activeNode.diagnosed
          ? 0x0ea5e9
          : activeNode.condition === 'sana'
            ? 0x10b981
            : activeNode.severity > 60
              ? 0xef4444
              : 0xf59e0b;

      this.device.update(
        dt,
        elapsed,
        this.isDraggingCameraHead || (this.handSnapshot.handDetected && this.handSnapshot.isPinching),
        this.focusedNodeId !== null,
        this.environment.spectralMode,
        statusHex
      );

      this.device.screenRenderer.draw(
        activeNode,
        this.environment.spectralMode,
        this.environment.weather,
        Math.round(this.environment.humidity),
        Math.round(this.environment.temperature),
        elapsed
      );

      // 1. Render main Mixed/Merged Reality scene
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.mainCamera);

      // 2. Render Picture-in-Picture Gooseneck Camera Optical Sensor View (~24 fps for crisp perf)
      const nowMs = performance.now();
      if (this.sensorCanvas && this.sensorCtx && nowMs - this.lastPipRenderMs > 42) {
        this.lastPipRenderMs = nowMs;
        this.renderCameraLensFeed(activeNode);
      }

      // 3. Throttled HUD state sync (~12 fps or immediate on events)
      if (nowMs - this.lastHudEmitMs > 85) {
        this.emitHud(false);
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private processKeyboardControls(dt: number): void {
    const moveSpeed = 1.35 * dt;
    let movedCam = false;
    if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) {
      this.device.targetHeadWorldPos.y += moveSpeed;
      movedCam = true;
    }
    if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) {
      this.device.targetHeadWorldPos.y -= moveSpeed;
      movedCam = true;
    }
    if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) {
      this.device.targetHeadWorldPos.z -= moveSpeed;
      movedCam = true;
    }
    if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) {
      this.device.targetHeadWorldPos.z += moveSpeed;
      movedCam = true;
    }
    if (movedCam) {
      const nearest = this.findNearestNodeToPoint(
        new THREE.Vector3(-1.3, this.device.targetHeadWorldPos.y, this.device.targetHeadWorldPos.z)
      );
      if (nearest) {
        this.device.aimTargetWorldPos.lerp(new THREE.Vector3(...nearest.worldPos), 0.25);
      }
    }

    if (this.keysPressed.has('q')) {
      this.orbitYaw -= 1.4 * dt;
      this.updateOrbitCamera();
    }
    if (this.keysPressed.has('e')) {
      this.orbitYaw += 1.4 * dt;
      this.updateOrbitCamera();
    }
  }

  private processLiveHandInteraction(dt: number): void {
    const elapsed = this.clock.elapsedTime;

    if (!this.handSnapshot.handDetected || !this.latestLandmarks) {
      // Synthesize a smooth articulated 3D Bionic Human Hand following the spatial cursor in Merged/Mixed Reality!
      const showSyntheticHand =
        this.realityMode === 'merged' ||
        this.realityMode === 'mixed_ar' ||
        this.activeTool === 'hand_inspect';

      this.handAvatarGroup.visible = showSyntheticHand;
      this.spatialCursorMesh.visible = true;

      if (showSyntheticHand) {
        const anchor = this.isDraggingCameraHead
          ? this.device.currentHeadWorldPos.clone().add(new THREE.Vector3(0.18, -0.05, 0.22))
          : this.spatialCursorMesh.position.clone();

        const pinchFactor = this.isDraggingCameraHead ? 0.85 : 0.12;
        const synthJoints = this.computeSyntheticHandLandmarks(anchor, pinchFactor, elapsed);
        for (let i = 0; i < 21; i++) {
          this.handJointMeshes[i].position.copy(synthJoints[i]);
        }
        const posAttr = this.handBoneLines.geometry.attributes.position as THREE.BufferAttribute;
        HAND_BONE_PAIRS.forEach(([a, b], idx) => {
          posAttr.setXYZ(idx * 2, synthJoints[a].x, synthJoints[a].y, synthJoints[a].z);
          posAttr.setXYZ(idx * 2 + 1, synthJoints[b].x, synthJoints[b].y, synthJoints[b].z);
        });
        posAttr.needsUpdate = true;
      }
      return;
    }

    this.handAvatarGroup.visible = true;
    this.spatialCursorMesh.visible = false;

    // Map normalized webcam coordinates (0..1) into the 3D coffee & camera workspace!
    const mapLandmark = (lm: HandLandmark3D): THREE.Vector3 => {
      const wx = -2.35 + lm.x * 3.85; // spans from plants (-2.35) to monitoring camera (+1.5)
      const wy = 2.35 - lm.y * 1.95; // spans from basal branches (0.4) to upper canopy (2.35)
      const wz = 0.25 - lm.z * 2.1;
      return new THREE.Vector3(wx, wy, wz);
    };

    const worldJoints = this.latestLandmarks.map(mapLandmark);
    for (let i = 0; i < 21; i++) {
      this.handJointMeshes[i].position.copy(worldJoints[i]);
    }

    const posAttr = this.handBoneLines.geometry.attributes.position as THREE.BufferAttribute;
    HAND_BONE_PAIRS.forEach(([a, b], idx) => {
      posAttr.setXYZ(idx * 2, worldJoints[a].x, worldJoints[a].y, worldJoints[a].z);
      posAttr.setXYZ(idx * 2 + 1, worldJoints[b].x, worldJoints[b].y, worldJoints[b].z);
    });
    posAttr.needsUpdate = true;

    const indexTipWorld = worldJoints[8];
    this.currentHandWorldPos.copy(indexTipWorld);

    // 1. Pinching gesture -> Grabs & aims the articulated Gooseneck Camera Head in mid-air!
    if (this.handSnapshot.isPinching) {
      this.device.targetHeadWorldPos.set(
        Math.max(0.1, indexTipWorld.x + 0.65),
        indexTipWorld.y,
        indexTipWorld.z
      );
      const nearest = this.findNearestNodeToPoint(indexTipWorld);
      if (nearest) {
        this.device.aimTargetWorldPos.lerp(new THREE.Vector3(...nearest.worldPos), 0.3);
      }
      soundEngine.playServoMove(this.handSnapshot.velocity * 0.4);
      return;
    }

    // 2. Touching / hovering near a Coffee Plant Node with real tracked hand!
    for (const node of this.nodeStates) {
      const nodePos = new THREE.Vector3(...node.worldPos);
      const dist = indexTipWorld.distanceTo(nodePos);
      if (dist < 0.48) {
        this.handleHumanBrushNode(node.id, Math.max(0.5, this.handSnapshot.velocity));
        // If user selected a field action tool and opens their palm over the plant, execute treatment!
        if (
          this.handSnapshot.isOpenPalm &&
          this.activeTool !== 'camera_grab' &&
          this.activeTool !== 'hand_inspect' &&
          node.diagnosed &&
          node.condition !== 'sana'
        ) {
          this.applyToolToNode(node.id, this.activeTool);
        }
        break;
      }
    }
  }

  private updateOpticalScanning(dt: number): void {
    // Determine which plant node falls inside the Gooseneck Camera's optical cone
    const headPos = this.device.currentHeadWorldPos;
    const gazeDir = this.device.aimTargetWorldPos.clone().sub(headPos).normalize();

    let bestNode: PlantNodeState | null = null;
    let bestScore = Infinity;

    for (const n of this.nodeStates) {
      const nPos = new THREE.Vector3(...n.worldPos);
      const toNode = nPos.clone().sub(headPos);
      const dist = toNode.length();
      if (dist < 0.35 || dist > 2.95) continue;

      const angle = gazeDir.angleTo(toNode.normalize());
      if (angle < 0.34) {
        const metric = angle * 2.2 + dist * 0.15;
        if (metric < bestScore) {
          bestScore = metric;
          bestNode = n;
        }
      }
    }

    if (bestNode) {
      this.focusedNodeId = bestNode.id;
      this.selectedDiagnosisNodeId = bestNode.id;

      if (!bestNode.diagnosed) {
        // Scanning speed scales up when human parts leaves or uses optimal spectral mode!
        const preset = WEATHER_PRESETS[this.environment.weather];
        const spectralBonus =
          this.environment.spectralMode === preset.recommendedSpectral ? 1.25 : 0.85;
        const foliageBonus = 1 + bestNode.foliageParted * 0.45;
        const windPenalty = Math.max(0.65, 1 - (this.environment.windSpeed / 100) * 0.28);

        const rate = 68 * spectralBonus * foliageBonus * windPenalty;
        bestNode.scanProgress = Math.min(100, bestNode.scanProgress + rate * dt);
        soundEngine.playScanTick(bestNode.scanProgress);

        if (bestNode.scanProgress >= 100) {
          bestNode.diagnosed = true;
          bestNode.diagnosedConfidence = Math.min(
            99.7,
            92.5 + bestNode.foliageParted * 4.5 + Math.random() * 2.4
          );
          const profile = DISEASE_CATALOG[bestNode.condition];
          const isHealthy = bestNode.condition === 'sana';
          soundEngine.playDiagnosisComplete(isHealthy, bestNode.severity >= 60);

          this.score += isHealthy ? 20 : 55;
          this.pushLog(
            'system',
            `Diagnóstico IA: ${profile.name} (${Math.round(bestNode.severity)}%)`,
            isHealthy
              ? `${bestNode.plantName} (${bestNode.zoneLabel}) presenta tejido sano (+20 pts).`
              : `Detectado en ${bestNode.plantName} (${bestNode.zoneLabel}) con ${bestNode.diagnosedConfidence.toFixed(1)}% de confianza. ¡Revisa el Plan de Acción!`,
            isHealthy ? 'success' : bestNode.severity >= 60 ? 'danger' : 'warning'
          );
          this.emitHud(true);
        }
      }
    } else {
      this.focusedNodeId = null;
    }
  }

  private updateBiologicalSimulation(dt: number): void {
    // Relax parted foliage smoothly back toward natural position
    for (const n of this.nodeStates) {
      if (n.foliageParted > 0) {
        n.foliageParted = Math.max(0, n.foliageParted - dt * 0.22);
      }
    }

    this.simAccumulator += dt;
    if (this.simAccumulator < 2.5) return;
    const stepSec = this.simAccumulator;
    this.simAccumulator = 0;

    // Ecological progression driven by the Generated Environment!
    for (const n of this.nodeStates) {
      if (n.condition === 'sana') {
        if (this.environment.weather === 'sunny') {
          n.ripeness = Math.min(100, n.ripeness + stepSec * 0.65);
        }
        continue;
      }

      const profile = DISEASE_CATALOG[n.condition];
      const weatherFavors = profile.favoredByWeather.includes(this.environment.weather);
      const shadeStress =
        n.condition === 'mancha_hierro' && this.environment.shadeLevel < 28
          ? 1.5
          : n.condition === 'roya' && this.environment.humidity > 80
            ? 1.45
            : 1.0;

      const growthRate =
        (this.playMode === 'mission' ? 0.95 : 0.35) *
        (weatherFavors ? 1.45 : 0.7) *
        shadeStress;

      n.severity = Math.min(98, n.severity + stepSec * growthRate);
    }

    // Mission Mode dynamic weather & outbreak cycle
    if (this.playMode === 'mission') {
      this.weatherCycleTimer += stepSec;
      const sickCount = this.nodeStates.filter((n) => n.condition !== 'sana').length;
      if (sickCount === 0) {
        this.harvestProgress = Math.min(100, this.harvestProgress + stepSec * 2.2);
      }
      if (this.weatherCycleTimer >= 28) {
        this.weatherCycleTimer = 0;
        if (sickCount < 3) {
          this.triggerEcologicalEvent();
        }
      }
    }

    this.recomputePlantationHealth();
  }

  private recomputePlantationHealth(): void {
    const totalDamage = this.nodeStates.reduce((acc, n) => acc + n.severity, 0);
    const avgDamage = totalDamage / this.nodeStates.length;
    this.plantationHealth = Math.max(5, Math.min(100, Math.round(100 - avgDamage * 1.15)));
  }

  private renderCameraLensFeed(activeNode: PlantNodeState | null): void {
    if (!this.sensorCanvas || !this.sensorCtx) return;

    const w = this.sensorRenderTarget.width;
    const h = this.sensorRenderTarget.height;

    // Hide volumetric scan cone, grab halo & HUD cursors during optical sensor capture
    const prevBackdrop = this.virtualWorldBackdrop.visible;
    const prevHand = this.handAvatarGroup.visible;
    const prevCursor = this.spatialCursorMesh.visible;
    this.virtualWorldBackdrop.visible = true;
    this.handAvatarGroup.visible = false;
    this.spatialCursorMesh.visible = false;
    this.device.setSensorCaptureMode(true);

    this.renderer.setRenderTarget(this.sensorRenderTarget);
    this.renderer.render(this.scene, this.device.sensorCamera);
    this.renderer.readRenderTargetPixels(
      this.sensorRenderTarget,
      0,
      0,
      w,
      h,
      this.sensorPixelBuffer
    );
    this.renderer.setRenderTarget(null);

    this.device.setSensorCaptureMode(false);
    this.virtualWorldBackdrop.visible = prevBackdrop;
    this.handAvatarGroup.visible = prevHand;
    this.spatialCursorMesh.visible = prevCursor;

    // Flip Y from WebGL pixel buffer & apply real-time Spectral AI Shader (RGB / NDVI / Thermal NIR)
    const imgData = this.sensorTempCtx.createImageData(w, h);
    const dst = imgData.data;
    const src = this.sensorPixelBuffer;
    const mode: SpectralMode = this.environment.spectralMode;

    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * w * 4;
      const dstRow = y * w * 4;
      for (let x = 0; x < w; x++) {
        const si = srcRow + x * 4;
        const di = dstRow + x * 4;
        const r = src[si];
        const g = src[si + 1];
        const b = src[si + 2];

        if (mode === 'rgb') {
          dst[di] = r;
          dst[di + 1] = g;
          dst[di + 2] = b;
          dst[di + 3] = 255;
        } else if (mode === 'ndvi') {
          // NDVI Chlorophyll Stress Enhancement: healthy green -> emerald/blue; stressed yellow/orange -> bright magenta/red!
          const vegIndex = (g - r) / Math.max(1, g + r);
          if (vegIndex > 0.12) {
            dst[di] = Math.min(255, r * 0.35);
            dst[di + 1] = Math.min(255, g * 1.25 + 25);
            dst[di + 2] = Math.min(255, b * 0.9 + 40);
          } else {
            dst[di] = Math.min(255, r * 1.45 + 45);
            dst[di + 1] = Math.min(255, g * 0.55);
            dst[di + 2] = Math.min(255, 90);
          }
          dst[di + 3] = 255;
        } else {
          // Night Thermal / NIR Vision
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const scanline = y % 3 === 0 ? 0.84 : 1.04;
          dst[di] = Math.min(255, lum * 0.22 * scanline);
          dst[di + 1] = Math.min(255, (lum * 1.35 + 28) * scanline);
          dst[di + 2] = Math.min(255, (lum * 1.15 + 36) * scanline);
          dst[di + 3] = 255;
        }
      }
    }

    this.sensorTempCtx.putImageData(imgData, 0, 0);

    const ctx = this.sensorCtx;
    const cw = this.sensorCanvas.width;
    const ch = this.sensorCanvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(this.sensorTempCanvas, 0, 0, cw, ch);

    // Draw AI Computer-Vision Reticle & Bounding Box Overlay
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cw / 2 - 14, ch / 2);
    ctx.lineTo(cw / 2 + 14, ch / 2);
    ctx.moveTo(cw / 2, ch / 2 - 14);
    ctx.lineTo(cw / 2, ch / 2 + 14);
    ctx.stroke();

    if (activeNode && this.focusedNodeId === activeNode.id) {
      const profile = DISEASE_CATALOG[activeNode.condition];
      const boxColor = activeNode.diagnosed ? profile.accentHex : '#38bdf8';
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2;
      const bx = cw * 0.21;
      const by = ch * 0.18;
      const bw = cw * 0.58;
      const bh = ch * 0.62;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.fillRect(bx, by - 20, bw, 19);
      ctx.fillStyle = boxColor;
      ctx.font = 'bold 11px monospace';
      const label = activeNode.diagnosed
        ? `${profile.name.toUpperCase()} [${activeNode.diagnosedConfidence.toFixed(1)}%]`
        : `ESCANEANDO... ${Math.round(activeNode.scanProgress)}%`;
      ctx.fillText(label.slice(0, 29), bx + 5, by - 6);
    }
  }

  private spawnParticles(
    origin: THREE.Vector3,
    color: THREE.Color,
    count: number,
    speed: number
  ): void {
    const geo = new THREE.SphereGeometry(0.024, 6, 6);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      this.effectsGroup.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed * 2,
        Math.random() * speed * 1.4 + 0.15,
        (Math.random() - 0.5) * speed * 2
      );
      this.activeParticles.push({
        mesh,
        vel,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.45,
      });
    }
  }

  private updateRainAndParticles(dt: number): void {
    if (this.rainLines.visible) {
      const pos = this.rainLines.geometry.attributes.position as THREE.BufferAttribute;
      const windX = -(this.environment.windSpeed / 100) * 2.2;
      for (let i = 0; i < pos.count; i += 2) {
        let x = pos.getX(i) + windX * dt;
        let y = pos.getY(i) - 8.5 * dt;
        const z = pos.getZ(i);
        if (y < 0) {
          y = 4.8 + Math.random() * 0.5;
          x = (Math.random() - 0.5) * 9;
        }
        pos.setXYZ(i, x, y, z);
        pos.setXYZ(i + 1, x + windX * 0.03, y - 0.28, z);
      }
      pos.needsUpdate = true;
    }

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.effectsGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.activeParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 1.2 * dt;
      const ratio = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;
      p.mesh.scale.setScalar(0.5 + ratio * 0.7);
    }
  }

  private showBanner(text: string): void {
    this.missionBanner = text;
    if (this.bannerTimeout) window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.missionBanner = null;
      this.emitHud(true);
    }, 4500);
  }

  private pushLog(
    source: ReactionLogEntry['source'],
    title: string,
    detail: string,
    tone: ReactionLogEntry['tone']
  ): void {
    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 8);
    this.logs = [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp,
        source,
        title,
        detail,
        tone,
      },
      ...this.logs.slice(0, 17),
    ];
  }

  private computeSyntheticHandLandmarks(
    indexTipTarget: THREE.Vector3,
    pinch: number,
    timeSec: number
  ): THREE.Vector3[] {
    const idleBob = Math.sin(timeSec * 2.6) * 0.015;
    const wrist = indexTipTarget.clone().add(new THREE.Vector3(0.16, -0.26 + idleBob, 0.24));
    const pts: THREE.Vector3[] = new Array(21);
    pts[0] = wrist;

    // Thumb (1..4) pinching toward index tip when pinch -> 1
    const thumbTipOpen = wrist.clone().add(new THREE.Vector3(-0.14, 0.14, -0.1));
    const thumbTip = thumbTipOpen.lerp(indexTipTarget.clone().add(new THREE.Vector3(0.015, -0.015, 0.01)), pinch);
    pts[1] = wrist.clone().lerp(thumbTip, 0.28).add(new THREE.Vector3(-0.03, 0.01, 0));
    pts[2] = wrist.clone().lerp(thumbTip, 0.55).add(new THREE.Vector3(-0.02, 0.02, 0));
    pts[3] = wrist.clone().lerp(thumbTip, 0.8);
    pts[4] = thumbTip;

    // Index finger (5..8) reaching indexTipTarget
    const indexMcp = wrist.clone().add(new THREE.Vector3(-0.06, 0.14, -0.11));
    pts[5] = indexMcp;
    pts[6] = indexMcp.clone().lerp(indexTipTarget, 0.42).add(new THREE.Vector3(0, 0.02, 0));
    pts[7] = indexMcp.clone().lerp(indexTipTarget, 0.74).add(new THREE.Vector3(0, 0.01, 0));
    pts[8] = indexTipTarget.clone();

    // Middle, Ring, Pinky fingers (9..20)
    const fingerSpecs = [
      { mcpOff: [-0.01, 0.145, -0.115], tipOff: [-0.03, 0.27, -0.22], baseIdx: 9 },
      { mcpOff: [0.038, 0.135, -0.11], tipOff: [0.03, 0.245, -0.2], baseIdx: 13 },
      { mcpOff: [0.08, 0.115, -0.095], tipOff: [0.085, 0.2, -0.175], baseIdx: 17 },
    ];

    for (const f of fingerSpecs) {
      const mcp = wrist.clone().add(new THREE.Vector3(f.mcpOff[0], f.mcpOff[1], f.mcpOff[2]));
      const curl = pinch * 0.45;
      const tip = wrist
        .clone()
        .add(new THREE.Vector3(f.tipOff[0], f.tipOff[1] * (1 - curl * 0.35), f.tipOff[2] * (1 - curl * 0.4)));
      pts[f.baseIdx] = mcp;
      pts[f.baseIdx + 1] = mcp.clone().lerp(tip, 0.42).add(new THREE.Vector3(0, 0.022, -0.01));
      pts[f.baseIdx + 2] = mcp.clone().lerp(tip, 0.75).add(new THREE.Vector3(0, 0.01, 0));
      pts[f.baseIdx + 3] = tip;
    }

    return pts;
  }

  private computeSpatialAnchors(): SpatialAnchor2D[] {
    const projectPoint = (world: THREE.Vector3): { x: number; y: number; ok: boolean } => {
      const v = world.clone().project(this.mainCamera);
      const ok = v.z >= -1 && v.z <= 1;
      return {
        x: (v.x * 0.5 + 0.5) * 100,
        y: (-v.y * 0.5 + 0.5) * 100,
        ok,
      };
    };

    const plantPt = projectPoint(new THREE.Vector3(-0.95, 2.38, 0.25));
    const camPt = projectPoint(
      this.device.currentHeadWorldPos.clone().add(new THREE.Vector3(0, 0.26, 0))
    );
    const basePt = projectPoint(new THREE.Vector3(1.18, 1.05, 0.28));

    const sickNodes = this.nodeStates.filter((n) => n.condition !== 'sana').length;

    return [
      {
        id: 'plant_callout',
        label: 'Planta de Café (Coffea)',
        sublabel: sickNodes > 0 ? `${sickNodes} focos activos en el cafetal` : 'Cultivo 100% saludable',
        xPercent: plantPt.x,
        yPercent: plantPt.y,
        visible: plantPt.ok && plantPt.x > 18 && plantPt.x < 82,
        tone: sickNodes > 0 ? 'amber' : 'emerald',
      },
      {
        id: 'camera_callout',
        label: 'Cámara IA Articulada',
        sublabel: 'Arrastra o pellizca para enfocar',
        xPercent: camPt.x,
        yPercent: camPt.y,
        visible: camPt.ok && camPt.x > 18 && camPt.x < 82,
        tone: 'blue',
      },
      {
        id: 'base_callout',
        label: 'Unidad de Diagnóstico',
        sublabel: 'Severidad + Plan de Acción en pantalla',
        xPercent: basePt.x,
        yPercent: basePt.y,
        visible: basePt.ok && basePt.x > 20 && basePt.x < 80,
        tone: 'blue',
      },
    ];
  }

  private emitHud(force: boolean): void {
    if (force) {
      this.lastHudEmitMs = performance.now();
    } else {
      this.lastHudEmitMs = performance.now();
    }

    const activeNode = this.nodeStates.find((n) => n.id === this.focusedNodeId);
    const cameraSystemStatus = activeNode
      ? activeNode.diagnosed
        ? `Objetivo bloqueado: ${activeNode.plantName} (${activeNode.zoneLabel})`
        : `Escaneando ${activeNode.plantName}... ${Math.round(activeNode.scanProgress)}%`
      : 'En espera — Arrastra la Cámara o haz clic en un racimo/rama';

    this.onHudSync({
      playMode: this.playMode,
      realityMode: this.realityMode,
      activeTool: this.activeTool,
      score: this.score,
      combo: this.combo,
      plantationHealth: this.plantationHealth,
      harvestProgress: Math.round(this.harvestProgress),
      missionsCompleted: this.missionsCompleted,
      waveNumber: this.waveNumber,
      focusedNodeId: this.focusedNodeId,
      selectedDiagnosisNodeId: this.selectedDiagnosisNodeId,
      nodes: this.nodeStates.map((n) => ({
        ...n,
        completedTools: [...n.completedTools],
      })),
      environment: { ...this.environment },
      handState: { ...this.handSnapshot },
      logs: this.logs,
      cameraSystemStatus,
      cameraAimNormalized: {
        x: this.device.currentHeadWorldPos.x,
        y: this.device.currentHeadWorldPos.y,
        z: this.device.currentHeadWorldPos.z,
      },
      missionBanner: this.missionBanner,
      spatialAnchors: this.computeSpatialAnchors(),
    });
  }

  public dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    soundEngine.setRainAmbience(false);
    this.cleanupListeners();
    this.sensorRenderTarget.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
