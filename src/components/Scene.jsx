import { Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Studio from './Studio'
import Watch from './Watch'
import { downloadImage } from '../utils/downloadImage'
import { TARGET, VIEW_DIR, beginExport, cropToContent, defaultDistance, renderToCanvas } from '../export/capture'
import { recordTurntable } from '../export/turntable'
import { exportVariants } from '../export/batch'

/**
 * The 3D viewport. `apiRef` receives the export/view functions
 * (downloadImage, resetView, recordTurntable, exportVariants, captureWatch)
 * so the UI outside the canvas can trigger them.
 */
export default function Scene({ config, apiRef, ...watchProps }) {
  // `n` re-renders the (render-once) floor shadow whenever the watch changes.
  const [floor, setFloor] = useState({ y: -2, n: 0 })
  const onBounds = useCallback((box) => setFloor((f) => ({ y: box.min.y - 0.02, n: f.n + 1 })), [])

  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.1, far: 100, position: [3, 1.2, 7] }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        // Neutral tone mapping keeps the chosen colours true to the swatches.
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <Watch config={config} onBounds={onBounds} {...watchProps} />
      </Suspense>

      {/* Rendered once (not every frame) — a big saving on phones. It re-renders
          when the watch reports its size, i.e. once the model has loaded. */}
      <ContactShadows
        key={floor.n}
        frames={1}
        position={[0, floor.y, 0]}
        scale={12}
        far={4}
        blur={2.6}
        opacity={0.55}
        resolution={512}
        color="#2a2520"
      />

      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        minDistance={5}
        maxDistance={18}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 + 0.12}
      />
      <ViewApi apiRef={apiRef} />
    </Canvas>
  )
}

/** Frames the watch for the screen shape and exposes view + export functions to the UI. */
function ViewApi({ apiRef }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const advance = useThree((s) => s.advance)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))

  // A per-frame camera function used while recording the 360° video. It runs
  // after OrbitControls and before the frame is drawn.
  const driver = useRef(null)
  useFrame(() => driver.current?.(performance.now()))

  const frame = useCallback(() => {
    // Narrow (portrait) screens need the camera further back to fit the watch.
    const distance = defaultDistance(aspect)
    camera.position.copy(TARGET).addScaledVector(VIEW_DIR, distance)
    camera.lookAt(TARGET)
    if (controls) {
      controls.target.copy(TARGET)
      controls.update()
    }
  }, [aspect, camera, controls])

  // Re-frame when the viewport shape changes (rotate phone, resize window).
  useEffect(() => {
    frame()
  }, [frame])

  useImperativeHandle(
    apiRef,
    () => {
      const three = { gl, scene, camera, controls, advance }
      return {
        downloadImage: () => downloadImage(three),
        resetView: frame,
        recordTurntable: (opts) => recordTurntable(three, (fn) => (driver.current = fn), opts),
        exportVariants: (applyConfig, opts) => exportVariants(three, applyConfig, opts),
        /** Transparent, tightly cropped render of the watch from the current angle (for banners). */
        captureWatch: (size = 1600) => {
          const restore = beginExport(three, { width: size, height: size, view: 'current-angle' })
          try {
            return cropToContent(renderToCanvas(three, { backdrop: 'none' }))
          } finally {
            restore()
          }
        },
      }
    },
    [gl, scene, camera, controls, advance, frame],
  )
  return null
}
