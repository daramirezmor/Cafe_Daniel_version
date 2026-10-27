import { HandTrackingSnapshot } from '../types/game';

export interface HandLandmark3D {
  x: number;
  y: number;
  z: number;
}

export interface FullHandFrame {
  snapshot: HandTrackingSnapshot;
  landmarks: HandLandmark3D[] | null;
}

declare global {
  interface Window {
    Hands?: new (config: { locateFile: (file: string) => string }) => {
      setOptions: (opts: Record<string, unknown>) => void;
      onResults: (cb: (results: { multiHandLandmarks?: HandLandmark3D[][] }) => void) => void;
      initialize: () => Promise<void>;
      send: (input: { image: HTMLVideoElement }) => Promise<void>;
      close: () => Promise<void>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadMediaPipeHandsScript(): Promise<void> {
  if (window.Hands) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const handsBaseUrl = `${import.meta.env.BASE_URL}mediapipe-hands/`;
    script.src = `${handsBaseUrl}hands.js`;
    script.async = true;
    script.onload = () => {
      if (window.Hands) {
        resolve();
      } else {
        reject(new Error('No se pudo inicializar el módulo local MediaPipe Hands.'));
      }
    };
    script.onerror = () => reject(new Error('Error cargando el módulo MediaPipe Hands.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export class HandTrackerController {
  private videoEl: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private handsInstance: InstanceType<NonNullable<Window['Hands']>> | null = null;
  private rafId: number | null = null;
  private running = false;
  private processingFrame = false;

  private smoothedLandmarks: HandLandmark3D[] | null = null;
  private prevPalm = { x: 0.5, y: 0.5, time: 0 };
  private onUpdateCallback: ((frame: FullHandFrame) => void) | null = null;

  public setOnUpdate(cb: (frame: FullHandFrame) => void): void {
    this.onUpdateCallback = cb;
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoEl;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async start(): Promise<boolean> {
    if (this.running) return true;

    this.emitStatus({
      status: 'loading',
      handDetected: false,
      isPinching: false,
      isOpenPalm: false,
      palmNormalized: { x: 0.5, y: 0.5, z: 0 },
      velocity: 0,
      gestureLabel: 'Iniciando cámara y seguimiento de manos IA...',
    });

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'API de cámara no disponible en este contexto (abre la vista en pestaña nueva o usa el modo espacial 3D).'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.stream = stream;

      const video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;
      await video.play();
      this.videoEl = video;

      await loadMediaPipeHandsScript();
      if (!window.Hands) {
        throw new Error('MediaPipe Hands no disponible.');
      }

      const hands = new window.Hands({
        locateFile: (file: string) => `${import.meta.env.BASE_URL}mediapipe-hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // Lite model: ultra fast 60fps in browser!
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
        this.handleResults(results);
      });

      await hands.initialize();
      this.handsInstance = hands;
      this.running = true;

      this.emitStatus({
        status: 'active',
        handDetected: false,
        isPinching: false,
        isOpenPalm: false,
        palmNormalized: { x: 0.5, y: 0.5, z: 0 },
        velocity: 0,
        gestureLabel: 'Cámara activa — Muestra tu mano frente a la lente',
      });

      this.loop();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Permiso de cámara denegado o cámara no detectada.';
      this.stopInternal(false);
      this.emitStatus({
        status: 'error',
        errorMessage: msg,
        handDetected: false,
        isPinching: false,
        isOpenPalm: false,
        palmNormalized: { x: 0.5, y: 0.5, z: 0 },
        velocity: 0,
        gestureLabel: 'Control espacial por Mouse/Touch activo (sin webcam)',
      });
      return false;
    }
  }

  public stop(): void {
    this.stopInternal(true);
  }

  private stopInternal(emitIdle: boolean): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
    if (this.handsInstance) {
      this.handsInstance.close().catch(() => {});
      this.handsInstance = null;
    }
    this.smoothedLandmarks = null;

    if (emitIdle) {
      this.emitStatus({
        status: 'idle',
        handDetected: false,
        isPinching: false,
        isOpenPalm: false,
        palmNormalized: { x: 0.5, y: 0.5, z: 0 },
        velocity: 0,
        gestureLabel: 'Seguimiento por Mouse / Touch 3D activo',
      });
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    if (
      this.videoEl &&
      this.handsInstance &&
      this.videoEl.readyState >= 2 &&
      !this.processingFrame
    ) {
      this.processingFrame = true;
      this.handsInstance
        .send({ image: this.videoEl })
        .catch(() => {})
        .finally(() => {
          this.processingFrame = false;
        });
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleResults(results: { multiHandLandmarks?: HandLandmark3D[][] }): void {
    const raw = results.multiHandLandmarks?.[0];
    if (!raw || raw.length < 21) {
      this.smoothedLandmarks = null;
      this.emitStatus({
        status: 'active',
        handDetected: false,
        isPinching: false,
        isOpenPalm: false,
        palmNormalized: { x: 0.5, y: 0.5, z: 0 },
        velocity: 0,
        gestureLabel: 'Buscando mano en escena... (levanta tu palma)',
      });
      return;
    }

    // Mirror X so moving your hand right moves right on screen naturally!
    const mirrored: HandLandmark3D[] = raw.map((lm) => ({
      x: 1 - lm.x,
      y: lm.y,
      z: lm.z,
    }));

    if (!this.smoothedLandmarks) {
      this.smoothedLandmarks = mirrored;
    } else {
      const alpha = 0.48;
      this.smoothedLandmarks = this.smoothedLandmarks.map((prev, i) => ({
        x: prev.x + (mirrored[i].x - prev.x) * alpha,
        y: prev.y + (mirrored[i].y - prev.y) * alpha,
        z: prev.z + (mirrored[i].z - prev.z) * alpha,
      }));
    }

    const lm = this.smoothedLandmarks;
    const thumbTip = lm[4];
    const indexTip = lm[8];
    const middleTip = lm[12];
    const ringTip = lm[16];
    const pinkyTip = lm[20];
    const wrist = lm[0];
    const middleMcp = lm[9];

    const handScale = Math.max(
      0.06,
      Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y)
    );

    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) / handScale;
    const isPinching = pinchDist < 0.44;

    const avgFingerSpread =
      (Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) +
        Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) +
        Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) +
        Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y)) /
      (4 * handScale);
    const isOpenPalm = !isPinching && avgFingerSpread > 1.55;

    const palmX = (wrist.x + middleMcp.x + indexTip.x) / 3;
    const palmY = (wrist.y + middleMcp.y + indexTip.y) / 3;
    const palmZ = middleMcp.z;

    const now = performance.now();
    const dt = Math.max(16, now - this.prevPalm.time) / 1000;
    const speed = Math.min(
      3.5,
      Math.hypot(palmX - this.prevPalm.x, palmY - this.prevPalm.y) / dt
    );
    this.prevPalm = { x: palmX, y: palmY, time: now };

    const gestureLabel = isPinching
      ? 'Pellizco detectado: Agarrando / Apuntando Cámara IA'
      : isOpenPalm
        ? 'Palma abierta: Interactuando con follaje y herramientas'
        : 'Mano rastreada: Apuntando en entorno 3D';

    this.onUpdateCallback?.({
      snapshot: {
        status: 'active',
        handDetected: true,
        isPinching,
        isOpenPalm,
        palmNormalized: { x: palmX, y: palmY, z: palmZ },
        velocity: speed,
        gestureLabel,
      },
      landmarks: lm,
    });
  }

  private emitStatus(snapshot: HandTrackingSnapshot): void {
    this.onUpdateCallback?.({
      snapshot,
      landmarks: this.smoothedLandmarks,
    });
  }
}
