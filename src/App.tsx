import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bug,
  Camera,
  CheckCircle2,
  CloudFog,
  CloudRain,
  Compass,
  Droplets,
  Eye,
  Hand,
  Image as ImageIcon,
  Layers,
  Leaf,
  Moon,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { AgroMRSceneManager } from './three/AgroMRSceneManager';
import {
  ActionToolId,
  ConditionId,
  DISEASE_CATALOG,
  GameHUDState,
  getSeverityLevel,
  RealityMode,
  SpectralMode,
  WEATHER_PRESETS,
  WeatherId,
} from './types/game';
import { HandTrackerController } from './vision/handTracker';

export const App: React.FC = () => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sensorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arVideoRef = useRef<HTMLVideoElement | null>(null);
  const mirrorVideoRef = useRef<HTMLVideoElement | null>(null);

  const sceneManagerRef = useRef<AgroMRSceneManager | null>(null);
  const handTrackerRef = useRef<HandTrackerController | null>(null);

  const [hud, setHud] = useState<GameHUDState | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [showArLabels, setShowArLabels] = useState(true);

  useEffect(() => {
    if (!stageRef.current) return;

    const handTracker = new HandTrackerController();
    handTrackerRef.current = handTracker;

    const manager = new AgroMRSceneManager(stageRef.current, (nextState) => {
      setHud(nextState);
    });
    sceneManagerRef.current = manager;

    if (sensorCanvasRef.current) {
      manager.setSensorCanvas(sensorCanvasRef.current);
    }

    handTracker.setOnUpdate((frame) => {
      manager.updateHandFrame(frame.snapshot, frame.landmarks);
      setWebcamActive(frame.snapshot.status === 'active');
    });

    return () => {
      handTracker.stop();
      manager.dispose();
    };
  }, []);

  useEffect(() => {
    if (sceneManagerRef.current && sensorCanvasRef.current) {
      sceneManagerRef.current.setSensorCanvas(sensorCanvasRef.current);
    }
  }, [hud === null]);

  // Attach live webcam stream to AR backdrop & Merged Reality mirror video elements whenever active
  useEffect(() => {
    const srcVideo = handTrackerRef.current?.getVideoElement();
    const stream = (srcVideo?.srcObject as MediaStream | null) ?? null;

    if (arVideoRef.current && arVideoRef.current.srcObject !== stream) {
      arVideoRef.current.srcObject = stream;
      if (stream) arVideoRef.current.play().catch(() => {});
    }
    if (mirrorVideoRef.current && mirrorVideoRef.current.srcObject !== stream) {
      mirrorVideoRef.current.srcObject = stream;
      if (stream) mirrorVideoRef.current.play().catch(() => {});
    }
  }, [webcamActive, hud?.realityMode]);

  const handleToggleWebcam = async () => {
    soundEngine.unlock();
    const tracker = handTrackerRef.current;
    if (!tracker) return;
    if (tracker.isRunning()) {
      tracker.stop();
      setWebcamActive(false);
    } else {
      const ok = await tracker.start();
      setWebcamActive(ok);
    }
  };

  const handleSelectRealityMode = async (mode: RealityMode) => {
    soundEngine.unlock();
    sceneManagerRef.current?.setRealityMode(mode);
    if (mode === 'mixed_ar' && handTrackerRef.current && !handTrackerRef.current.isRunning()) {
      const ok = await handTrackerRef.current.start();
      setWebcamActive(ok);
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const activeDiagNode =
    hud?.nodes.find((n) => n.id === (hud.focusedNodeId || hud.selectedDiagnosisNodeId)) ??
    hud?.nodes[3] ??
    null;

  const diagProfile = activeDiagNode ? DISEASE_CATALOG[activeDiagNode.condition] : null;
  const sevInfo = activeDiagNode ? getSeverityLevel(activeDiagNode.severity) : null;

  return (
    <div className="mr-app-shell">
      {/* Mixed Reality AR Webcam Passthrough OR Spatial Simulated Room Backdrop */}
      {hud?.realityMode === 'mixed_ar' &&
        (webcamActive ? (
          <video
            ref={arVideoRef}
            className="ar-webcam-backdrop"
            playsInline
            muted
            autoPlay
          />
        ) : (
          <div className="ar-simulated-room-backdrop" />
        ))}

      {/* Main Interactive 3D Merged / Mixed Reality Canvas */}
      <div ref={stageRef} className="webgl-stage" />

      {/* Projected 3D Spatial AR Callouts */}
      {showArLabels &&
        hud?.spatialAnchors
          .filter((a) => a.visible)
          .map((anchor) => (
            <div
              key={anchor.id}
              className={`ar-spatial-callout ${anchor.tone}`}
              style={{
                left: `${anchor.xPercent}%`,
                top: `${anchor.yPercent}%`,
              }}
            >
              <div className="ar-callout-title">{anchor.label}</div>
              {anchor.sublabel && <div className="ar-callout-sub">{anchor.sublabel}</div>}
            </div>
          ))}

      {/* TOP HEADER BAR */}
      <header className="top-hud-bar">
        <div className="brand-block">
          <div className="brand-badge">
            <Camera size={20} />
          </div>
          <div>
            <div className="brand-title">SISTEMA DE MONITOREO AGRÍCOLA</div>
            <div className="brand-subtitle">
              Detección inteligente de plagas y enfermedades en cultivos de café (MR / XR)
            </div>
          </div>
        </div>

        {/* Merged / Mixed Reality Mode Selector */}
        <div className="mode-pills" title="Selecciona el modo de Realidad Fusionada / Mixta">
          <button
            className={`mode-pill ${hud?.realityMode === 'merged' ? 'active' : ''}`}
            onClick={() => handleSelectRealityMode('merged')}
          >
            <Layers size={14} />
            Merged Reality
          </button>
          <button
            className={`mode-pill ${hud?.realityMode === 'mixed_ar' ? 'active' : ''}`}
            onClick={() => handleSelectRealityMode('mixed_ar')}
          >
            <Eye size={14} />
            Mixed Reality AR
          </button>
          <button
            className={`mode-pill ${hud?.realityMode === 'virtual_3d' ? 'active' : ''}`}
            onClick={() => handleSelectRealityMode('virtual_3d')}
          >
            <TreePine size={14} />
            Cafetal 3D
          </button>
        </div>

        {/* Game Play Mode & Live Metrics */}
        <div className="score-strip">
          <div className="mode-pills">
            <button
              className={`mode-pill ${hud?.playMode === 'mission' ? 'active' : ''}`}
              onClick={() => sceneManagerRef.current?.setPlayMode('mission')}
            >
              Misión
            </button>
            <button
              className={`mode-pill ${hud?.playMode === 'sandbox' ? 'active' : ''}`}
              onClick={() => sceneManagerRef.current?.setPlayMode('sandbox')}
            >
              Laboratorio
            </button>
          </div>

          <div className="metric-chip" title="Salud global de las plantas de café">
            <Leaf size={14} color="#10b981" />
            <span>Salud: {hud?.plantationHealth ?? 88}%</span>
          </div>

          <div className="metric-chip" title="Avance de cosecha sana de café">
            <Sprout size={14} color="#f59e0b" />
            <span>Cosecha: {hud?.harvestProgress ?? 18}%</span>
          </div>

          <div className="metric-chip" title="Puntaje y multiplicador de precisión">
            <Zap size={14} color="#38bdf8" />
            <span>
              {hud?.score ?? 0} pts {hud && hud.combo > 1 ? `(x${hud.combo})` : ''}
            </span>
          </div>

          <button
            className={`webcam-btn ${webcamActive ? 'live' : ''}`}
            onClick={handleToggleWebcam}
            title="Usa tu webcam para controlar la cámara y tocar las plantas con tus manos reales"
          >
            <Hand size={14} />
            {webcamActive ? 'Manos MR Activas' : 'Activar Cámara / Manos'}
          </button>

          <button
            className="icon-btn"
            onClick={() => setShowDiagramModal(true)}
            title="Comparar con el diseño original del sistema"
          >
            <ImageIcon size={14} />
            Esquema
          </button>

          <button
            className="icon-btn"
            onClick={handleToggleMute}
            title={muted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </header>

      {/* MISSION BANNER */}
      {hud?.missionBanner && <div className="mission-banner">{hud.missionBanner}</div>}

      {/* COLLAPSE TOGGLE FOR SMALLER VIEWPORTS */}
      {leftCollapsed && (
        <button
          className="icon-btn"
          style={{ position: 'absolute', top: 76, left: 12, zIndex: 11 }}
          onClick={() => setLeftCollapsed(false)}
        >
          <Compass size={14} /> Mostrar Entorno & Bitácora
        </button>
      )}

      {/* LEFT HUD: GENERATED ENVIRONMENT & LIVE REACTION LOG */}
      {!leftCollapsed && (
        <aside className="left-hud-panel">
          <div className="hud-card">
            <div className="section-heading">
              <span>Entorno Generado (Cafetal)</span>
              <button
                onClick={() => setLeftCollapsed(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
                title="Ocultar panel izquierdo"
              >
                Ocultar
              </button>
            </div>

            <div className="weather-grid">
              {(
                [
                  { id: 'sunny', icon: <Sun size={15} />, label: 'Soleado' },
                  { id: 'rain', icon: <CloudRain size={15} />, label: 'Aguacero' },
                  { id: 'fog', icon: <CloudFog size={15} />, label: 'Niebla' },
                  { id: 'night_nir', icon: <Moon size={15} />, label: 'Noche NIR' },
                ] as { id: WeatherId; icon: React.ReactNode; label: string }[]
              ).map((w) => (
                <button
                  key={w.id}
                  className={`weather-btn ${hud?.environment.weather === w.id ? 'active' : ''}`}
                  onClick={() => sceneManagerRef.current?.setWeather(w.id)}
                >
                  {w.icon}
                  <span>{w.label}</span>
                </button>
              ))}
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>
                  <Droplets size={11} style={{ verticalAlign: 'middle' }} /> Humedad Relativa
                </span>
                <strong>{Math.round(hud?.environment.humidity ?? 60)}%</strong>
              </div>
              <input
                type="range"
                min={35}
                max={98}
                value={hud?.environment.humidity ?? 60}
                onChange={(e) =>
                  sceneManagerRef.current?.updateEnvironmentParam({
                    humidity: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>
                  <Wind size={11} style={{ verticalAlign: 'middle' }} /> Viento en Ramas
                </span>
                <strong>{Math.round(hud?.environment.windSpeed ?? 22)}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                value={hud?.environment.windSpeed ?? 22}
                onChange={(e) =>
                  sceneManagerRef.current?.updateEnvironmentParam({
                    windSpeed: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>
                  <TreePine size={11} style={{ verticalAlign: 'middle' }} /> Sombrío Agroforestal
                </span>
                <strong>{Math.round(hud?.environment.shadeLevel ?? 45)}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                value={hud?.environment.shadeLevel ?? 45}
                onChange={(e) =>
                  sceneManagerRef.current?.updateEnvironmentParam({
                    shadeLevel: Number(e.target.value),
                  })
                }
              />
            </div>

            {/* Sandbox / Dynamic Event Triggers */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(
                [
                  { id: 'roya', label: '+ Roya' },
                  { id: 'broca', label: '+ Broca' },
                  { id: 'mancha_hierro', label: '+ M. Hierro' },
                  { id: 'minador', label: '+ Minador' },
                ] as { id: ConditionId; label: string }[]
              ).map((ev) => (
                <button
                  key={ev.id}
                  className="spec-btn"
                  style={{ flex: '1 1 45%' }}
                  onClick={() => sceneManagerRef.current?.triggerEcologicalEvent(ev.id)}
                  title="Generar brote en el entorno para probar la respuesta del sistema"
                >
                  {ev.label}
                </button>
              ))}
            </div>

            {/* Merged Reality Human Presence Mirror & Status */}
            <div
              style={{
                marginTop: 8,
                padding: '6px 8px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.72)',
                fontSize: 11,
                color: '#cbd5e1',
              }}
            >
              <div style={{ fontWeight: 700, color: '#34d399', marginBottom: 2 }}>
                <Hand size={12} style={{ verticalAlign: 'middle' }} /> Presencia Humana:{' '}
                {hud?.handState.gestureLabel}
              </div>
              {hud?.handState.status === 'error' && (
                <div style={{ color: '#fbbf24', fontSize: 10.5, marginTop: 3 }}>
                  {hud.handState.errorMessage}{' '}
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: 10.5,
                    }}
                  >
                    Abrir en pestaña nueva
                  </button>
                </div>
              )}
              {webcamActive && hud?.realityMode !== 'mixed_ar' && (
                <div className="human-mirror-pip">
                  <video ref={mirrorVideoRef} playsInline muted autoPlay />
                </div>
              )}
            </div>
          </div>

          {/* Bidirectional Human <-> System <-> Environment Reaction Stream */}
          <div className="hud-card reaction-log-card">
            <div className="section-heading">
              <span>Respuesta Humano ⇄ Entorno</span>
              <Activity size={13} />
            </div>
            <div className="reaction-list">
              {hud?.logs.map((entry) => (
                <div
                  key={entry.id}
                  className={`reaction-item ${entry.source} ${entry.tone === 'danger' ? 'danger' : ''}`}
                >
                  <div className="reaction-meta">
                    <span>
                      {entry.source === 'human'
                        ? 'HUMANO → PLANTA/SISTEMA'
                        : entry.source === 'environment'
                          ? 'ENTORNO → ECOSISTEMA'
                          : 'IA MONITOREO'}
                    </span>
                    <span>{entry.timestamp}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 1 }}>
                    {entry.title}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>{entry.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* RIGHT HUD: LIVE CAMERA SENSOR VIEW + DIAGRAM DIAGNOSTIC CARD */}
      <aside className="right-hud-panel">
        <div className="hud-card">
          <div className="section-heading">
            <span>Vista Óptica en Vivo — Cámara IA</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              {hud?.environment.autoSpectral ? 'Auto-Clima' : 'Manual'}
            </span>
          </div>

          <div className="sensor-pip-wrapper">
            <canvas
              ref={sensorCanvasRef}
              width={256}
              height={172}
              className="sensor-canvas"
            />
          </div>

          <div
            style={{
              fontSize: 11,
              color: '#93c5fd',
              marginTop: 6,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {hud?.cameraSystemStatus}
          </div>

          <div className="spectral-bar">
            {(
              [
                { id: 'rgb', label: 'Óptico RGB' },
                { id: 'ndvi', label: 'Clorofila NDVI' },
                { id: 'thermal_nir', label: 'Nocturno NIR' },
              ] as { id: SpectralMode; label: string }[]
            ).map((sp) => (
              <button
                key={sp.id}
                className={`spec-btn ${hud?.environment.spectralMode === sp.id ? 'active' : ''}`}
                onClick={() =>
                  sceneManagerRef.current?.updateEnvironmentParam({
                    spectralMode: sp.id,
                  })
                }
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        {/* EXACT DIAGNOSTIC CARD FROM ATTACHED DIAGRAM */}
        <div className="diagnostic-diagram-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 7,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
              Diagnostica enfermedad o plaga
            </div>
            <button
              onClick={() => sceneManagerRef.current?.resetMission()}
              title="Reiniciar estado del cafetal"
              style={{
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                borderRadius: 6,
                padding: '3px 6px',
                fontSize: 10.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                color: '#334155',
              }}
            >
              <RefreshCw size={11} /> Reiniciar
            </button>
          </div>

          {/* Quick-Focus Node Pills (Click any branch to swing the gooseneck camera right to it!) */}
          <div className="node-selector-strip">
            {hud?.nodes.map((n, idx) => {
              const isSelected = activeDiagNode?.id === n.id;
              const dotColor = !n.diagnosed
                ? '#f59e0b'
                : n.condition === 'sana'
                  ? '#10b981'
                  : DISEASE_CATALOG[n.condition].accentHex;
              return (
                <button
                  key={n.id}
                  className={`node-dot-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => sceneManagerRef.current?.focusCameraOnNode(n.id)}
                  title={`${n.plantName} — ${n.zoneLabel}`}
                >
                  <span className="status-dot" style={{ background: dotColor }} />
                  R{idx + 1}
                </button>
              );
            })}
          </div>

          {activeDiagNode && diagProfile && sevInfo && (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1a6bb8',
                  marginBottom: 4,
                }}
              >
                {activeDiagNode.plantName} ({activeDiagNode.variety}) • {activeDiagNode.zoneLabel}
              </div>

              {!activeDiagNode.diagnosed ? (
                <div
                  style={{
                    padding: '14px 12px',
                    borderRadius: 10,
                    background: '#eff6ff',
                    border: '1px dashed #60a5fa',
                    textAlign: 'center',
                    margin: '8px 0',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e3a8a' }}>
                    Escaneando Tejido Vegetal... {Math.round(activeDiagNode.scanProgress)}%
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: '#dbeafe',
                      borderRadius: 999,
                      overflow: 'hidden',
                      margin: '8px 0',
                    }}
                  >
                    <div
                      style={{
                        width: `${activeDiagNode.scanProgress}%`,
                        height: '100%',
                        background: '#1a6bb8',
                        transition: 'width 0.1s linear',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                    Arrastra la <strong>Cámara</strong> sobre esta rama o pulsa enfocar para
                    completar el diagnóstico óptico.
                  </p>
                  <button
                    onClick={() => sceneManagerRef.current?.focusCameraOnNode(activeDiagNode.id)}
                    style={{
                      background: '#1a6bb8',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Apuntar Cámara IA Aquí
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. Muestra nombre de la plaga o enfermedad */}
                  <div className="diag-row">
                    <div className="diag-label">
                      <Bug size={13} color="#1a6bb8" />
                      <span>Nombre de la plaga o enfermedad</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                        {diagProfile.name}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: diagProfile.badgeColor,
                          color: '#fff',
                        }}
                      >
                        {activeDiagNode.diagnosedConfidence.toFixed(1)}% IA
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, fontStyle: 'italic', color: '#475569' }}>
                      {diagProfile.scientificName} • {diagProfile.category}
                    </div>
                    <p style={{ fontSize: 11, color: '#334155', marginTop: 4, lineHeight: 1.35 }}>
                      {diagProfile.visualSymptomSummary}
                    </p>
                  </div>

                  {/* 2. Severidad */}
                  <div className="diag-row">
                    <div className="diag-label">
                      <AlertTriangle size={13} color={sevInfo.color} />
                      <span>Severidad</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#0f172a',
                        marginBottom: 4,
                      }}
                    >
                      <span>{sevInfo.label}</span>
                      <span>{Math.round(activeDiagNode.severity)}%</span>
                    </div>
                    <div
                      style={{
                        height: 9,
                        background: '#e2e8f0',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(4, activeDiagNode.severity)}%`,
                          height: '100%',
                          background: sevInfo.color,
                          transition: 'width 0.25s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 10.5, color: '#475569', marginTop: 4 }}>
                      {sevInfo.description}
                    </div>
                  </div>

                  {/* 3. Plan de acción */}
                  <div className="diag-row">
                    <div className="diag-label">
                      <ShieldCheck size={13} color="#10b981" />
                      <span>Plan de acción</span>
                    </div>

                    {diagProfile.actionSteps.length === 0 ? (
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: '#ecfdf5',
                          color: '#065f46',
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2
                          size={14}
                          style={{ verticalAlign: 'middle', marginRight: 5 }}
                        />
                        Planta sana ({Math.round(activeDiagNode.ripeness)}% cerezas maduras).
                        Puedes aplicar <strong>Nutrición</strong> para acelerar la cosecha o
                        escanear otra rama.
                      </div>
                    ) : (
                      diagProfile.actionSteps.map((step, i) => {
                        const isDone = activeDiagNode.completedTools.includes(step.tool);
                        return (
                          <button
                            key={step.tool}
                            className={`action-step-btn ${isDone ? 'done' : ''}`}
                            onClick={() => {
                              sceneManagerRef.current?.setActiveTool(step.tool);
                              sceneManagerRef.current?.applyToolToNode(
                                activeDiagNode.id,
                                step.tool
                              );
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11.5,
                                fontWeight: 800,
                              }}
                            >
                              <span>
                                {i + 1}. {step.label}
                              </span>
                              <span>{isDone ? '✓ Aplicado' : 'Ejecutar →'}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2 }}>
                              {step.detail}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* BOTTOM INTERACTIVE TOOL DOCK & VIEW PRESETS */}
      <nav className="bottom-tool-dock">
        {(
          [
            {
              id: 'camera_grab',
              key: '1',
              label: 'Mover Cámara IA',
              icon: <Camera size={15} />,
            },
            {
              id: 'hand_inspect',
              key: '2',
              label: 'Mano (Apartar Hojas)',
              icon: <Hand size={15} />,
            },
            {
              id: 'biocontrol',
              key: '3',
              label: 'Biocontrol',
              icon: <Sparkles size={15} />,
            },
            {
              id: 'prune_rere',
              key: '4',
              label: 'Poda & Re-Re',
              icon: <Scissors size={15} />,
            },
            {
              id: 'shade_climate',
              key: '5',
              label: 'Regular Microclima',
              icon: <Sun size={15} />,
            },
            {
              id: 'nutrition',
              key: '6',
              label: 'Nutrición Foliar',
              icon: <Sprout size={15} />,
            },
          ] as { id: ActionToolId; key: string; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.id}
            className={`tool-dock-btn ${hud?.activeTool === t.id ? 'active' : ''}`}
            onClick={() => sceneManagerRef.current?.setActiveTool(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
            <span className="key-hint">{t.key}</span>
          </button>
        ))}

        <div
          style={{
            width: 1,
            height: 24,
            background: 'rgba(148, 163, 184, 0.3)',
            margin: '0 3px',
          }}
        />

        <button
          className="icon-btn"
          onClick={() => sceneManagerRef.current?.setCameraPreset('diagram')}
          title="Vista frontal clásica del esquema"
        >
          Vista Esquema
        </button>
        <button
          className="icon-btn"
          onClick={() => sceneManagerRef.current?.setCameraPreset('screen_closeup')}
          title="Acercar a la pantalla LCD de la base del sistema"
        >
          Base LCD
        </button>
        <button
          className="icon-btn"
          onClick={() => setShowArLabels((v) => !v)}
          title="Mostrar u ocultar etiquetas espaciales AR"
        >
          {showArLabels ? 'AR HUD ✓' : 'AR HUD'}
        </button>
      </nav>

      {/* REFERENCE DIAGRAM MODAL */}
      {showDiagramModal && (
        <div className="modal-backdrop" onClick={() => setShowDiagramModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                  Diseño de Referencia — Sistema de Monitoreo Agrícola
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                  Planta de Café (Coffea) + Cámara Articulada + Diagnóstico de Severidad y Plan de
                  Acción
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowDiagramModal(false)}>
                Cerrar ✕
              </button>
            </div>
            <img src="/sistema-referencia.jpg" alt="Sistema de Monitoreo Agrícola" />
          </div>
        </div>
      )}
    </div>
  );
};
