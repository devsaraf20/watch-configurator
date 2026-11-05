import * as THREE from 'three'
import { ExportCancelled, TARGET, beginExport, yieldToBrowser } from './capture'

/**
 * 360° turntable video of the current configuration.
 *
 * Preferred: frame-by-frame rendering + WebCodecs encoding (via Mediabunny).
 * Every frame is rendered at an exact angle, so the turn is perfectly smooth
 * whatever the device's speed, and progress is real. Output: MP4 (H.264),
 * or WebM (VP9/VP8) where H.264 encoding isn't available.
 *
 * Fallback for browsers without WebCodecs: real-time capture with MediaRecorder.
 */

/** 1080p where the GPU and device can handle it, otherwise 720p. */
export function pickResolution(gl) {
  const maxSize = Math.min(gl.capabilities.maxTextureSize, gl.capabilities.maxRenderbufferSize ?? Infinity)
  const lowMemory = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4
  return maxSize >= 4096 && !lowMemory ? [1920, 1080] : [1280, 720]
}

const hasWebCodecs = () => typeof window !== 'undefined' && typeof window.VideoEncoder !== 'undefined'
const hasMediaRecorder = () =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  !!HTMLCanvasElement.prototype.captureStream

/** Can this browser make a video at all? (Used to enable the button.) */
export const videoSupported = () => hasWebCodecs() || hasMediaRecorder()

/** Camera position for a fraction `t` (0–1) of one full, constant-speed turn. */
function orbit(camera, start, t) {
  const s = new THREE.Spherical(start.radius, start.phi, start.theta + t * Math.PI * 2)
  camera.position.setFromSpherical(s).add(TARGET)
  camera.lookAt(TARGET)
}

// ─── Preferred: offline rendering + WebCodecs ────────────────────
async function encodeOffline(three, { width, height, seconds, fps, onProgress, signal }) {
  if (!hasWebCodecs()) return null
  const mb = await import('mediabunny') // loaded only when a video is made
  const opts = { width, height, bitrate: width >= 1920 ? 12_000_000 : 6_000_000 }
  const choice = (await mb.canEncodeVideo('avc', opts))
    ? { codec: 'avc', format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), ext: 'mp4', type: 'video/mp4' }
    : (await mb.canEncodeVideo('vp9', opts))
      ? { codec: 'vp9', format: new mb.WebMOutputFormat(), ext: 'webm', type: 'video/webm' }
      : (await mb.canEncodeVideo('vp8', opts))
        ? { codec: 'vp8', format: new mb.WebMOutputFormat(), ext: 'webm', type: 'video/webm' }
        : null
  if (!choice) return null

  const output = new mb.Output({ format: choice.format, target: new mb.BufferTarget() })
  const source = new mb.CanvasSource(three.gl.domElement, { codec: choice.codec, bitrate: opts.bitrate, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()

  const start = new THREE.Spherical().setFromVector3(three.camera.position.clone().sub(TARGET))
  const frames = Math.round(seconds * fps)
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) {
      await output.cancel()
      throw new ExportCancelled()
    }
    // Frame i of N (never N/N, so the clip loops without a repeated frame).
    orbit(three.camera, start, i / frames)
    three.advance(performance.now()) // run the frame (materials, hands…) and render it
    await source.add(i / fps, 1 / fps) // captured synchronously, right after rendering
    onProgress?.((i + 1) / frames)
    if (i % 5 === 4) await yieldToBrowser()
  }
  source.close()
  await output.finalize()
  return { blob: new Blob([output.target.buffer], { type: choice.type }), ext: choice.ext }
}

// ─── Fallback: real-time MediaRecorder capture ───────────────────
const RECORDER_FORMATS = [
  ['video/mp4;codecs=avc1.640028', 'mp4'],
  ['video/mp4;codecs=avc1', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm;codecs=vp8', 'webm'],
  ['video/webm', 'webm'],
]

/** Record ~0.7 s of a tiny canvas: some browsers claim MP4 but have no H.264 encoder and record nothing. */
async function producesData(mimeType) {
  const c = document.createElement('canvas')
  c.width = 320
  c.height = 180
  const ctx = c.getContext('2d')
  let hue = 0
  const draw = () => {
    ctx.fillStyle = `hsl(${(hue += 12) % 360} 50% 50%)`
    ctx.fillRect(0, 0, c.width, c.height)
  }
  draw()
  const timer = setInterval(draw, 33)
  const stream = c.captureStream(30)
  try {
    const rec = new MediaRecorder(stream, { mimeType })
    let bytes = 0
    rec.ondataavailable = (e) => (bytes += e.data.size)
    const stopped = new Promise((r) => (rec.onstop = r))
    rec.start(100)
    await new Promise((r) => setTimeout(r, 700))
    rec.stop()
    await stopped
    return bytes > 0
  } catch {
    return false
  } finally {
    clearInterval(timer)
    stream.getTracks().forEach((t) => t.stop())
  }
}

async function recorderFormat() {
  for (const [mimeType, ext] of RECORDER_FORMATS) {
    if (!MediaRecorder.isTypeSupported?.(mimeType)) continue
    if (ext === 'webm' || (await producesData(mimeType))) return { mimeType, ext }
  }
  return null
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))

async function recordRealtime(three, setDriver, { width, seconds, fps, onProgress, signal }) {
  if (!hasMediaRecorder()) return null
  const format = await recorderFormat()
  if (!format) return null
  const start = new THREE.Spherical().setFromVector3(three.camera.position.clone().sub(TARGET))
  await nextFrame()
  await nextFrame()
  const stream = three.gl.domElement.captureStream(fps)
  try {
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: width >= 1920 ? 12_000_000 : 6_000_000,
    })
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const stopped = new Promise((r) => (recorder.onstop = r))
    let t0 = null
    let finish
    const done = new Promise((r) => (finish = r))
    setDriver((now) => {
      if (t0 === null) t0 = now
      const t = (now - t0) / (seconds * 1000)
      if (t >= 1 || signal?.aborted) return finish()
      orbit(three.camera, start, t)
      onProgress?.(t)
    })
    recorder.start(250)
    await done
    setDriver(null)
    recorder.stop()
    await stopped
    if (signal?.aborted) throw new ExportCancelled()
    if (!chunks.length) throw new Error('The browser didn’t produce any video data. Please try again, or use another browser.')
    return { blob: new Blob(chunks, { type: format.mimeType.split(';')[0] }), ext: format.ext }
  } finally {
    setDriver(null)
    stream.getTracks().forEach((t) => t.stop())
  }
}

/**
 * Make a 360° video starting from the angle the user is looking from.
 * @param three      { gl, scene, camera, controls, advance }
 * @param setDriver  installs a per-frame camera function (real-time fallback only)
 * @returns { blob, ext, width, height }
 */
export async function recordTurntable(three, setDriver, { seconds = 6, fps = 30, onProgress, signal } = {}) {
  if (!videoSupported()) throw new Error('This browser can’t create videos. Try a recent Chrome, Edge, Safari or Firefox.')
  const [width, height] = pickResolution(three.gl)
  const restore = beginExport(three, { width, height, view: 'current-angle', backdrop: 'texture', zoom: 0.8 })
  try {
    const opts = { width, height, seconds, fps, onProgress, signal }
    const result = (await encodeOffline(three, opts)) ?? (await recordRealtime(three, setDriver, opts))
    if (!result) throw new Error('This browser has no usable video encoder. Try a recent Chrome, Edge, Safari or Firefox.')
    onProgress?.(1)
    return { ...result, width, height }
  } finally {
    restore()
  }
}
