import * as THREE from 'three';
import { ConditionId, DISEASE_CATALOG, PlantNodeState, SpectralMode, WeatherId } from '../types/game';

const leafTextureCache = new Map<string, THREE.CanvasTexture>();

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getCoffeeLeafTexture(
  condition: ConditionId,
  severity: number
): THREE.CanvasTexture {
  const bucket = condition === 'sana' ? 0 : Math.min(4, Math.max(1, Math.ceil(severity / 25)));
  const key = `${condition}_${bucket}`;
  const cached = leafTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(condition.length * 137 + bucket * 53);

  // Rich emerald base gradient matching Coffea arabica leaves in the diagram
  const grad = ctx.createLinearGradient(0, 0, 256, 512);
  if (condition === 'sana' || condition === 'broca') {
    grad.addColorStop(0, '#235334');
    grad.addColorStop(0.5, '#2b6740');
    grad.addColorStop(1, '#1d462b');
  } else {
    // Slight physiological stress tint at higher severity
    grad.addColorStop(0, bucket >= 3 ? '#35592b' : '#255534');
    grad.addColorStop(0.5, bucket >= 3 ? '#3d6832' : '#2d683f');
    grad.addColorStop(1, '#1f492c');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle cellular sheen mottling
  for (let i = 0; i < 90; i++) {
    const x = rand() * 256;
    const y = rand() * 512;
    const r = 12 + rand() * 28;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(92, 168, 108, 0.08)' : 'rgba(12, 34, 20, 0.09)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central midrib (nervadura central)
  ctx.strokeStyle = '#6da86e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 500);
  ctx.quadraticCurveTo(129, 256, 128, 18);
  ctx.stroke();

  // Characteristic Coffea arcuate secondary veins
  const veinPairs = 9;
  for (let i = 1; i <= veinPairs; i++) {
    const yStart = 465 - i * 44;
    const reach = Math.sin((i / (veinPairs + 1)) * Math.PI) * 102 + 14;
    ctx.strokeStyle = 'rgba(125, 186, 120, 0.68)';
    ctx.lineWidth = 2.4;

    // Left vein
    ctx.beginPath();
    ctx.moveTo(128, yStart);
    ctx.quadraticCurveTo(128 - reach * 0.62, yStart - 10, 128 - reach, yStart - 38);
    ctx.stroke();

    // Right vein
    ctx.beginPath();
    ctx.moveTo(128, yStart - 5);
    ctx.quadraticCurveTo(128 + reach * 0.62, yStart - 15, 128 + reach, yStart - 43);
    ctx.stroke();
  }

  // Disease-specific lesions on foliage
  const countScale = bucket * 6;

  if (condition === 'roya' && bucket > 0) {
    // Powdery yellow-orange Hemileia vastatrix pustules
    for (let i = 0; i < countScale + 4; i++) {
      const x = 36 + rand() * 184;
      const y = 60 + rand() * 390;
      const radius = 9 + rand() * (8 + bucket * 4);

      const halo = ctx.createRadialGradient(x, y, radius * 0.15, x, y, radius * 1.45);
      halo.addColorStop(0, 'rgba(249, 115, 22, 0.96)');
      halo.addColorStop(0.48, 'rgba(250, 204, 21, 0.85)');
      halo.addColorStop(0.82, 'rgba(163, 230, 53, 0.35)');
      halo.addColorStop(1, 'rgba(43, 103, 64, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Granular spore dots inside pustule
      ctx.fillStyle = '#ea580c';
      for (let s = 0; s < 7; s++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * radius * 0.65;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (condition === 'mancha_hierro' && bucket > 0) {
    // Cercospora brown necrotic eye-spots with bright yellow chlorotic halo
    for (let i = 0; i < Math.max(4, countScale); i++) {
      const x = 40 + rand() * 176;
      const y = 65 + rand() * 380;
      const r = 8 + rand() * (6 + bucket * 3);

      // Yellow halo
      ctx.fillStyle = 'rgba(234, 179, 8, 0.72)';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // Reddish-brown ring
      ctx.fillStyle = '#5c2410';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Ash-tan center ("eye")
      ctx.fillStyle = '#b69b7d';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (condition === 'antracnosis' && bucket > 0) {
    // Dark sunken necrotic blotches near edges & apex
    for (let i = 0; i < countScale + 3; i++) {
      const leftSide = rand() > 0.5;
      const x = leftSide ? 18 + rand() * 55 : 183 + rand() * 55;
      const y = 30 + rand() * 400;
      const rx = 14 + rand() * (10 + bucket * 5);
      const ry = 18 + rand() * (14 + bucket * 6);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 0.7);
      ctx.fillStyle = 'rgba(88, 52, 28, 0.65)';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.25, ry * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1f1612';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (condition === 'minador' && bucket > 0) {
    // Leucoptera coffeella serpentine silvery-parchment tunnels
    for (let i = 0; i < Math.max(3, bucket * 3); i++) {
      let cx = 50 + rand() * 156;
      let cy = 80 + rand() * 340;
      ctx.strokeStyle = 'rgba(214, 203, 178, 0.88)';
      ctx.lineWidth = 5 + bucket * 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let seg = 0; seg < 6; seg++) {
        cx = Math.min(220, Math.max(36, cx + (rand() - 0.5) * 58));
        cy = Math.min(450, Math.max(45, cy + (rand() - 0.5) * 58));
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(110, 82, 48, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Dark outline border for clean leaf margin contrast
  ctx.strokeStyle = '#132f1c';
  ctx.lineWidth = 6;
  ctx.strokeRect(2, 2, 252, 508);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  leafTextureCache.set(key, tex);
  return tex;
}

export class BaseUnitScreenRenderer {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private lastDrawMs = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 320;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.draw(null, 'rgb', 'sunny', 62, 24, 0);
  }

  public draw(
    node: PlantNodeState | null,
    spectral: SpectralMode,
    weather: WeatherId,
    humidity: number,
    temperature: number,
    timeSec: number
  ): void {
    const now = performance.now();
    if (now - this.lastDrawMs < 65) return;
    this.lastDrawMs = now;

    const ctx = this.ctx;
    const w = 512;
    const h = 320;

    // Luminous slate-cyan industrial LCD background matching the diagram's base screen
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0d2238');
    bg.addColorStop(1, '#071525');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle scanline grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Top telemetry header
    ctx.fillStyle = '#133453';
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('AGRO-IA • MONITOREO CAFÉ', 16, 30);

    const specLabel = spectral === 'rgb' ? 'RGB' : spectral === 'ndvi' ? 'NDVI' : 'NIR';
    ctx.fillStyle = spectral === 'thermal_nir' ? '#22d3ee' : spectral === 'ndvi' ? '#4ade80' : '#60a5fa';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`[${specLabel}] ${temperature}°C | ${humidity}% HR`, 280, 29);

    if (!node) {
      // Idle radar / awaiting scan
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px sans-serif';
      ctx.fillText('Apunta la Cámara hacia una Planta de Café', 58, 128);

      // Animated spectral sine wave
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 32; x <= w - 32; x += 8) {
        const y = 195 + Math.sin(x * 0.03 + timeSec * 4.5) * 22 * Math.sin(x * 0.008);
        if (x === 32) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px monospace';
      const weatherTag =
        weather === 'rain'
          ? 'ALERTA: ALTA HUMEDAD / LLUVIA'
          : weather === 'night_nir'
            ? 'MODO INFRARROJO ACTIVO'
            : weather === 'fog'
              ? 'COMPENSACIÓN DE NIEBLA ACTIVA'
              : 'SISTEMA LISTO • ESCANEO CONTINUO';
      ctx.fillText(weatherTag, 84, 276);
    } else if (!node.diagnosed && node.scanProgress < 100) {
      // Actively scanning target
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`ESCANEANDO: ${node.plantName.toUpperCase()}`, 22, 92);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Zona: ${node.zoneLabel}`, 22, 124);

      // Progress bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(22, 152, w - 44, 34);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(22, 152, ((w - 44) * node.scanProgress) / 100, 34);
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.strokeRect(22, 152, w - 44, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`ANALIZANDO TEJIDO... ${Math.round(node.scanProgress)}%`, 112, 176);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText('Mantén el cono óptico fijo sobre el racimo/hojas', 22, 240);
    } else {
      // Diagnosed readout directly on hardware base screen!
      const profile = DISEASE_CATALOG[node.condition];
      ctx.fillStyle = profile.accentHex;
      ctx.fillRect(18, 62, 10, 232);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${node.plantName} • ${node.zoneLabel} (${node.diagnosedConfidence.toFixed(1)}%)`, 40, 82);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(profile.name, 40, 118);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'italic 16px sans-serif';
      ctx.fillText(profile.scientificName, 40, 143);

      // Severity meter
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`SEVERIDAD: ${Math.round(node.severity)}%`, 40, 180);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 192, 436, 22);
      ctx.fillStyle =
        node.severity <= 4
          ? '#10b981'
          : node.severity < 35
            ? '#eab308'
            : node.severity < 65
              ? '#f97316'
              : '#ef4444';
      ctx.fillRect(40, 192, (436 * Math.min(100, node.severity)) / 100, 22);

      // Action plan headline
      const nextStep = profile.actionSteps.find((s) => !node.completedTools.includes(s.tool));
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('PLAN DE ACCIÓN:', 40, 246);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '17px sans-serif';
      const actionMsg = nextStep
        ? `→ ${nextStep.label.slice(0, 44)}`
        : '✓ Cultivo protegido — Monitoreo preventivo';
      ctx.fillText(actionMsg, 40, 274);
    }

    this.texture.needsUpdate = true;
  }
}
