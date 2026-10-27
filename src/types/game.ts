export type ConditionId =
  | 'sana'
  | 'roya'
  | 'broca'
  | 'mancha_hierro'
  | 'antracnosis'
  | 'minador';

export type RealityMode = 'merged' | 'mixed_ar' | 'virtual_3d';

export type WeatherId = 'sunny' | 'rain' | 'fog' | 'night_nir';

export type SpectralMode = 'rgb' | 'ndvi' | 'thermal_nir';

export type ActionToolId =
  | 'camera_grab'
  | 'hand_inspect'
  | 'biocontrol'
  | 'prune_rere'
  | 'shade_climate'
  | 'nutrition';

export type GamePlayMode = 'mission' | 'sandbox';

export interface ActionStepDefinition {
  tool: Exclude<ActionToolId, 'camera_grab' | 'hand_inspect'>;
  label: string;
  detail: string;
}

export interface DiseaseProfile {
  id: ConditionId;
  name: string;
  scientificName: string;
  category: 'Sana' | 'Hongo (Enfermedad)' | 'Insecto (Plaga)';
  badgeColor: string;
  accentHex: string;
  favoredByWeather: WeatherId[];
  targetOrgan: 'leaves' | 'cherries' | 'both';
  visualSymptomSummary: string;
  environmentalTriggerDesc: string;
  actionSteps: ActionStepDefinition[];
}

export interface PlantNodeState {
  id: string;
  plantIndex: number; // 0 = Izquierda/Norte, 1 = Central (Hero), 2 = Derecha/Sur
  plantName: string;
  variety: string;
  zoneLabel: string; // 'Dosel Superior', 'Glomérulo Central', 'Rama Basal'
  condition: ConditionId;
  severity: number; // 0 to 100
  diagnosed: boolean;
  diagnosedConfidence: number; // 0 to 99.8
  scanProgress: number; // 0 to 100
  foliageParted: number; // 0 to 1 (increased when human hand brushes/parts leaves!)
  ripeness: number; // 0 to 100 (% red ripe cherries)
  completedTools: ActionToolId[];
  worldPos: [number, number, number];
}

export interface EnvironmentState {
  weather: WeatherId;
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // 0-100
  shadeLevel: number; // 0-100 (% agroforestry canopy)
  spectralMode: SpectralMode;
  autoSpectral: boolean;
}

export interface ReactionLogEntry {
  id: string;
  timestamp: string;
  source: 'human' | 'environment' | 'system';
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

export interface HandTrackingSnapshot {
  status: 'idle' | 'loading' | 'active' | 'error';
  errorMessage?: string;
  handDetected: boolean;
  isPinching: boolean;
  isOpenPalm: boolean;
  palmNormalized: { x: number; y: number; z: number }; // 0..1 screen-like
  velocity: number;
  gestureLabel: string;
}

export interface SpatialAnchor2D {
  id: string;
  label: string;
  sublabel?: string;
  xPercent: number;
  yPercent: number;
  visible: boolean;
  tone: 'blue' | 'emerald' | 'amber' | 'crimson';
}

export interface GameHUDState {
  playMode: GamePlayMode;
  realityMode: RealityMode;
  activeTool: ActionToolId;
  score: number;
  combo: number;
  plantationHealth: number; // 0..100
  harvestProgress: number; // 0..100
  missionsCompleted: number;
  waveNumber: number;
  focusedNodeId: string | null;
  selectedDiagnosisNodeId: string | null;
  nodes: PlantNodeState[];
  environment: EnvironmentState;
  handState: HandTrackingSnapshot;
  logs: ReactionLogEntry[];
  cameraSystemStatus: string;
  cameraAimNormalized: { x: number; y: number; z: number };
  missionBanner: string | null;
  spatialAnchors: SpatialAnchor2D[];
}

export const DISEASE_CATALOG: Record<ConditionId, DiseaseProfile> = {
  sana: {
    id: 'sana',
    name: 'Planta de Café Sana',
    scientificName: 'Coffea arabica — Estado Fitosanitario Óptimo',
    category: 'Sana',
    badgeColor: '#10b981',
    accentHex: '#10b981',
    favoredByWeather: ['sunny'],
    targetOrgan: 'both',
    visualSymptomSummary:
      'Hojas elípticas verde oscuro brillante con nervadura limpia y cerezas firmes madurando de verde a rojo cereza.',
    environmentalTriggerDesc:
      'Equilibrio óptimo entre radiación solar filtrada, humedad moderada (60-72%) y buena aireación.',
    actionSteps: [],
  },
  roya: {
    id: 'roya',
    name: 'Roya del Cafeto',
    scientificName: 'Hemileia vastatrix',
    category: 'Hongo (Enfermedad)',
    badgeColor: '#f59e0b',
    accentHex: '#f97316',
    favoredByWeather: ['rain', 'fog'],
    targetOrgan: 'leaves',
    visualSymptomSummary:
      'Pústulas pulverulentas amarillo-naranja en el envés de las hojas y manchas cloróticas que provocan defoliación.',
    environmentalTriggerDesc:
      'Disparada por lluvias frecuentes, salpicadura de agua y humedad relativa superior al 82%.',
    actionSteps: [
      {
        tool: 'biocontrol',
        label: 'Aplicar Biocontrol Fúngico (Lecanicillium / Caldo Mineral)',
        detail: 'Nebuliza biofungicida sobre el envés foliar para inhibir uredosporas.',
      },
      {
        tool: 'shade_climate',
        label: 'Regular Ventilación y Sombrío del Microclima',
        detail: 'Reduce el exceso de humedad estancada entre las ramas.',
      },
      {
        tool: 'nutrition',
        label: 'Reforzar Nutrición Potásica Foliar',
        detail: 'Compensa el desgaste energético de la planta y evita caída de hojas.',
      },
    ],
  },
  broca: {
    id: 'broca',
    name: 'Broca del Café',
    scientificName: 'Hypothenemus hampei',
    category: 'Insecto (Plaga)',
    badgeColor: '#ef4444',
    accentHex: '#ef4444',
    favoredByWeather: ['sunny'],
    targetOrgan: 'cherries',
    visualSymptomSummary:
      'Pequeño escolítido negro (1.7 mm) que perfora el disco/ombligo de las cerezas verdes y maduras destruyendo la almendra.',
    environmentalTriggerDesc:
      'Vuelo masivo estimulado por temperaturas cálidas (>23°C) tras periodos húmedos y presencia de frutos sobremaduros.',
    actionSteps: [
      {
        tool: 'prune_rere',
        label: 'Ejecutar Recolección Sanitaria (Re-Re)',
        detail: 'Retira cerezas perforadas y sobremaduras para cortar el ciclo reproductivo.',
      },
      {
        tool: 'biocontrol',
        label: 'Aspersión de Hongo Beauveria bassiana',
        detail: 'Control biológico dirigido a hembras colonizadoras en la entrada del fruto.',
      },
    ],
  },
  mancha_hierro: {
    id: 'mancha_hierro',
    name: 'Mancha de Hierro',
    scientificName: 'Cercospora coffeicola',
    category: 'Hongo (Enfermedad)',
    badgeColor: '#d97706',
    accentHex: '#eab308',
    favoredByWeather: ['sunny'],
    targetOrgan: 'both',
    visualSymptomSummary:
      'Lesiones circulares pardas-rojizas con centro grisáceo y un halo amarillo brillante en hojas y cerezas.',
    environmentalTriggerDesc:
      'Favorecida por alta exposición solar directa (bajo sombrío) combinada con desbalance nutricional.',
    actionSteps: [
      {
        tool: 'nutrition',
        label: 'Aplicar Bioestimulante Nutricional N-K',
        detail: 'Corrige la susceptibilidad fisiológica del tejido foliar.',
      },
      {
        tool: 'shade_climate',
        label: 'Ajustar Sombrío Agroforestal (40-55%)',
        detail: 'Atenúa el estrés foto-oxidativo sobre el dosel del cafeto.',
      },
    ],
  },
  antracnosis: {
    id: 'antracnosis',
    name: 'Antracnosis / Muerte Descendente',
    scientificName: 'Colletotrichum kahawae',
    category: 'Hongo (Enfermedad)',
    badgeColor: '#a855f7',
    accentHex: '#c084fc',
    favoredByWeather: ['fog', 'rain'],
    targetOrgan: 'both',
    visualSymptomSummary:
      'Manchas necróticas oscuras hundidas en bordes de hojas, tallos tiernos y momificación negra de cerezas.',
    environmentalTriggerDesc:
      'Prospera en niebla andina fría (14-18°C), rocío persistente y follaje denso sin aireación.',
    actionSteps: [
      {
        tool: 'prune_rere',
        label: 'Poda Fitosanitaria de Tejidos Necróticos',
        detail: 'Elimina ápices y frutos momificados que actúan como fuente de inóculo.',
      },
      {
        tool: 'biocontrol',
        label: 'Sellar con Biofungicida Protector',
        detail: 'Protege los cortes y nudos fructíferos sanos adyacentes.',
      },
    ],
  },
  minador: {
    id: 'minador',
    name: 'Minador de la Hoja del Cafeto',
    scientificName: 'Leucoptera coffeella',
    category: 'Insecto (Plaga)',
    badgeColor: '#06b6d4',
    accentHex: '#22d3ee',
    favoredByWeather: ['night_nir', 'sunny'],
    targetOrgan: 'leaves',
    visualSymptomSummary:
      'Galerías serpenteantes plateadas y parches pergaminosos donde las larvas consumen el parénquima foliar.',
    environmentalTriggerDesc:
      'Adultos de hábito nocturno (detectables con visión NIR); explosiones poblacionales en épocas secas y ventosas.',
    actionSteps: [
      {
        tool: 'prune_rere',
        label: 'Remoción Selectiva de Hojas con Minas Activas',
        detail: 'Extrae galerías con pupas antes de la emergencia nocturna de polillas.',
      },
      {
        tool: 'biocontrol',
        label: 'Liberar Control Biológico / Extracto Neem',
        detail: 'Interrumpe la oviposición sobre brotes tiernos superiores.',
      },
    ],
  },
};

export const WEATHER_PRESETS: Record<
  WeatherId,
  {
    label: string;
    shortLabel: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    recommendedSpectral: SpectralMode;
    cameraReactionMsg: string;
    ecosystemEffectMsg: string;
  }
> = {
  sunny: {
    label: 'Mañana Soleada Andina',
    shortLabel: 'Soleado',
    temperature: 25,
    humidity: 58,
    windSpeed: 22,
    recommendedSpectral: 'rgb',
    cameraReactionMsg:
      'Cámara IA calibró balance óptico RGB diurno y compensación de brillo especular en hojas.',
    ecosystemEffectMsg:
      'Fotosíntesis alta y maduración activa de cerezas; calor estimula vuelo de Broca y Mancha de Hierro si falta sombrío.',
  },
  rain: {
    label: 'Aguacero Cafetero',
    shortLabel: 'Aguacero',
    temperature: 18,
    humidity: 92,
    windSpeed: 54,
    recommendedSpectral: 'ndvi',
    cameraReactionMsg:
      'Humedad >85% detectada: Sistema activó modo Multiespectral NDVI anti-reflejo hídrico y estabilizador de viento.',
    ecosystemEffectMsg:
      'Gotas dispersan uredosporas de Roya del Cafeto entre ramas; alta presión fúngica en nudos bajos.',
  },
  fog: {
    label: 'Niebla Alta de Montaña',
    shortLabel: 'Niebla',
    temperature: 15,
    humidity: 88,
    windSpeed: 30,
    recommendedSpectral: 'ndvi',
    cameraReactionMsg:
      'Baja visibilidad por neblina: Cámara encendió LEDs auxiliares y realce de fluorescencia de clorofila (NDVI).',
    ecosystemEffectMsg:
      'Microclima frío y saturado favorece Antracnosis y Roya latente en el interior del dosel.',
  },
  night_nir: {
    label: 'Monitoreo Nocturno Infrarrojo',
    shortLabel: 'Noche NIR',
    temperature: 13,
    humidity: 79,
    windSpeed: 18,
    recommendedSpectral: 'thermal_nir',
    cameraReactionMsg:
      'Oscuridad detectada: Cabezal activó haz Infrarrojo Cercano (NIR) y sensor térmico de anomalías metabólicas.',
    ecosystemEffectMsg:
      'Actividad nocturna de polillas de Minador de la Hoja visible bajo espectro infrarrojo.',
  },
};

export function getSeverityLevel(severity: number): {
  label: string;
  color: string;
  description: string;
} {
  if (severity <= 4) {
    return {
      label: ' Nula / Óptima (0%)',
      color: '#10b981',
      description: 'Tejido vegetal vigoroso sin lesiones patológicas.',
    };
  }
  if (severity < 32) {
    return {
      label: 'Baja — Foco Incipiente',
      color: '#eab308',
      description: 'Detección temprana ideal: intervención preventiva evita pérdidas.',
    };
  }
  if (severity < 65) {
    return {
      label: 'Moderada — En Expansión',
      color: '#f97316',
      description: 'Lesiones activas; riesgo de contagio a ramas vecinas si no se trata.',
    };
  }
  return {
    label: 'Crítica — Riesgo de Defoliación/Pérdida',
    color: '#ef4444',
    description: 'Alta carga de inóculo/plaga: ¡evita sacudir brusco y ejecuta el Plan de Acción ya!',
  };
}
