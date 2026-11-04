import { Environment, Lightformer } from '@react-three/drei'

/**
 * A virtual photo studio built from glowing panels ("lightformers").
 * Polished metal is a mirror — it only looks like metal when there is
 * something to reflect — so these long softboxes and strip lights create
 * the crisp highlights you see on the case and bracelet.
 * Everything is generated on the GPU: no HDRI download needed.
 */
export default function Studio() {
  return (
    <Environment resolution={512} frames={1}>
      {/* The studio walls: dark, so reflections have contrast */}
      <color attach="background" args={['#18181b']} />

      {/* Large overhead softbox */}
      <Lightformer form="rect" intensity={2.2} position={[0, 6, 1]} scale={[12, 4, 1]} />
      {/* Tall strip lights left and right — the long highlights along the case flanks */}
      <Lightformer form="rect" intensity={4} position={[-6, 1, 2]} scale={[1.2, 12, 1]} />
      <Lightformer form="rect" intensity={3} position={[6, 1, 1]} scale={[0.8, 12, 1]} />
      {/* Soft key from the front-left, slightly warm */}
      <Lightformer form="rect" intensity={1.6} color="#fff4e8" position={[-4, 2, 7]} scale={[5, 3, 1]} />
      {/* Cool fill from the front-right */}
      <Lightformer form="rect" intensity={0.9} color="#eef3ff" position={[5, -1, 6]} scale={[4, 4, 1]} />
      {/* Rim light behind, to separate the silhouette */}
      <Lightformer form="ring" intensity={2.5} position={[2, 3, -8]} scale={4} />
      {/* Bounce from a pale table top */}
      <Lightformer form="rect" intensity={0.7} color="#e9e4da" position={[0, -6, 0]} scale={[14, 14, 1]} />
    </Environment>
  )
}
