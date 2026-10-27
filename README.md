# Sistema de Monitoreo Agrícola — Juego Interactivo Merged & Mixed Reality (Café)

Simulación y juego interactivo en **Realidad Fusionada (Merged Reality)** y **Realidad Mixta (Mixed Reality AR)** para el monitoreo fitosanitario inteligente de cultivos de café (*Coffea arabica*).

## Características Principales

- **Réplica 3D Interactiva del Sistema de Monitoreo**:
  - **Cámara Multiespectral IA** con vista óptica en vivo (RGB, Clorofila NDVI y Nocturno Infrarrojo NIR) y cono de escaneo volumétrico.
  - **Brazo Flexible Articulado (Gooseneck)** con cinemática spline y físicas de resorte en tiempo real.
  - **Unidad Base de Diagnóstico** con pantalla LCD integrada en 3D y tarjeta holográfica de diagnóstico (**Nombre de la plaga/enfermedad**, **Severidad** y **Plan de acción**).
- **3 Modos de Realidad Espacial**:
  1. **Merged Reality**: Entorno 3D vivo del cafetal andino fusionado con presencia humana (mano biónica 3D articulada controlada por seguimiento de manos en webcam con MediaPipe o por puntero espacial Mouse/Touch).
  2. **Mixed Reality AR**: Passthrough de cámara física en vivo con las plantas de café 3D, el sistema de monitoreo y efectos microclimáticos anclados en tu espacio.
  3. **Cafetal 3D**: Inmersión completa en el ecosistema cafetero generado proceduralmente.
- **Doble Bucle Reactivo (Humano ⇄ Sistema ⇄ Entorno Generado)**:
  - **Respuesta a la interacción humana**: Apartar hojas expone el envés foliar y acelera el diagnóstico; sacudir bruscamente ramas con infección fúngica crítica dispersa esporas; aplicar herramientas del Plan de Acción (*Biocontrol*, *Poda & Re-Re*, *Regulación de Microclima*, *Nutrición Foliar*) recupera la salud de la planta y el avance de cosecha.
  - **Respuesta al entorno generado**: Cambios dinámicos de clima (*Soleado*, *Aguacero Cafetero*, *Niebla de Montaña*, *Noche NIR*), humedad, viento y sombrío agroforestal modifican el comportamiento de plagas reales (*Roya*, *Broca*, *Mancha de Hierro*, *Antracnosis*, *Minador*) y activan respuestas automáticas en los sensores de la cámara.

## Ejecución Local

```bash
npm install
npm run dev
```
