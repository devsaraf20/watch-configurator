import { Suspense, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Studio from './Studio'
import Watch from './Watch'
import { downloadImage } from '../utils/downloadImage'

const TARGET = new THREE.Vector3(0, -0.1, -0.7)
// Default 3/4 product view (direction from the target, before distance is applied)
const VIEW_DIR = new THREE.Vector3(0.42, 0.16, 1).normalize()

/**
 * The 3D viewport. `apiRef` receives { downloadImage(), resetView() }
 * so the side panel can trigger them.
 */
export default function Scene({ config, apiRef }) {
  const [floorY, setFloorY] = useState(-2)
  const onBounds = useCallback((box) => setFloorY(box.min.y - 0.02), [])

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
        <Watch config={config} onBounds={onBounds} />
      </Suspense>

      <ContactShadows
        position={[0, floorY, 0]}
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

/** Frames the watch for the screen shape and exposes download / reset to the UI. */
function ViewApi({ apiRef }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))

  const frame = useCallback(() => {
    // Narrow (portrait) screens need the camera further back to fit the watch.
    const distance = aspect < 1 ? 10 / Math.max(0.5, aspect) ** 0.8 : 10.5
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
    () => ({
      downloadImage: () => downloadImage({ gl, scene, camera }),
      resetView: frame,
    }),
    [gl, scene, camera, frame],
  )
  return null
}
