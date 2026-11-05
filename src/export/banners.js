/**
 * Marketing banners drawn on 2D canvases: product name, tagline, price,
 * logo and a transparent render of the current watch.
 *
 * Type hierarchy (largest → smallest): name (serif display) → price (bold,
 * in a pill) → tagline (light, muted). Each ratio has its own composition.
 */

export const BANNER_FORMATS = [
  { id: '1x1', label: 'Square', ratio: '1:1', width: 1080, height: 1080, use: 'Instagram / feed' },
  { id: '4x5', label: 'Portrait', ratio: '4:5', width: 1080, height: 1350, use: 'Instagram portrait' },
  { id: '9x16', label: 'Story', ratio: '9:16', width: 1080, height: 1920, use: 'Stories / Reels' },
  { id: '16x9', label: 'Landscape', ratio: '16:9', width: 1920, height: 1080, use: 'Web hero / YouTube' },
]

export const THEMES = {
  light: {
    top: '#f7f6f3',
    bottom: '#e7e4dd',
    spot: 'rgba(255,255,255,0.95)',
    ink: '#161616',
    muted: '#5f5c56',
    line: 'rgba(22,22,22,0.32)',
  },
  dark: {
    top: '#202023',
    bottom: '#0d0d0e',
    spot: 'rgba(255,255,255,0.11)',
    ink: '#f4f2ed',
    muted: '#aaa69e',
    line: 'rgba(244,242,237,0.42)',
  },
}

const SERIF = '"Cormorant Garamond", "Times New Roman", serif'
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Make sure the web fonts are ready before drawing (canvas won't wait for them). */
export async function ensureBannerFonts() {
  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load(`500 100px ${SERIF}`),
    document.fonts.load(`400 32px ${SANS}`),
    document.fonts.load(`600 32px ${SANS}`),
  ]).catch(() => {})
}

// ─── Text helpers ────────────────────────────────────────────────
function setFont(ctx, { weight, size, family, tracking = 0 }) {
  ctx.font = `${weight} ${size}px ${family}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking * size}px`
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

/** Split into two lines of similar width (avoids a lone word on the second line). */
function balancedTwoLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean)
  let best = null
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const widest = Math.max(ctx.measureText(a).width, ctx.measureText(b).width)
    if (widest <= maxWidth && (!best || widest < best.widest)) best = { lines: [a, b], widest }
  }
  return best?.lines ?? wrap(ctx, text, maxWidth)
}

/** Largest size (≤ style.size) at which the text fits maxWidth in maxLines. */
function fitText(ctx, text, style, maxWidth) {
  const min = style.minSize ?? style.size * 0.55
  // Headlines read better on one line: accept a slightly smaller size before wrapping.
  if (style.preferOneLine) {
    for (let size = style.size; size >= style.size * 0.78; size *= 0.96) {
      setFont(ctx, { ...style, size })
      if (ctx.measureText(text).width <= maxWidth) return { lines: [text], size, lineHeight: size * style.leading }
    }
  }
  for (let size = style.size; size >= min; size *= 0.95) {
    setFont(ctx, { ...style, size })
    let lines = wrap(ctx, text, maxWidth)
    if (lines.length === 2 && style.preferOneLine) lines = balancedTwoLines(ctx, text, maxWidth)
    if (lines.length <= style.maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { lines, size, lineHeight: size * style.leading }
    }
  }
  // Still too long: keep the smallest size and end with an ellipsis.
  const size = min
  setFont(ctx, { ...style, size })
  const lines = wrap(ctx, text, maxWidth).slice(0, style.maxLines)
  let last = lines[lines.length - 1] ?? ''
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
  lines[lines.length - 1] = `${last.trimEnd()}…`
  return { lines, size, lineHeight: size * style.leading }
}

// ─── Blocks ──────────────────────────────────────────────────────
// Each block is measured first ({ height, width }) and drawn later at (x, y).
function textBlock(ctx, text, style, maxWidth, color) {
  if (!text) return null
  const fit = fitText(ctx, text, style, maxWidth)
  setFont(ctx, { ...style, size: fit.size })
  const width = Math.max(...fit.lines.map((l) => ctx.measureText(l).width))
  // Cap height of the first line ≈ 0.72em; trim leading above it so blocks align optically.
  const height = fit.lineHeight * (fit.lines.length - 1) + fit.size * (style.family === SERIF ? 0.78 : 0.76)
  return {
    height,
    width,
    draw(x, y, align) {
      setFont(ctx, { ...style, size: fit.size })
      ctx.fillStyle = color
      ctx.textAlign = align
      ctx.textBaseline = 'alphabetic'
      fit.lines.forEach((l, i) => ctx.fillText(l, x, y + fit.size * (style.family === SERIF ? 0.78 : 0.76) + i * fit.lineHeight))
    },
  }
}

function priceBlock(ctx, text, size, theme) {
  if (!text) return null
  const style = { weight: 600, family: SANS, size, tracking: 0.06 }
  setFont(ctx, style)
  const tw = ctx.measureText(text).width
  const padX = size * 0.85
  const padY = size * 0.55
  const width = tw + padX * 2
  const height = size * 0.74 + padY * 2
  return {
    width,
    height,
    draw(x, y, align) {
      const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
      ctx.strokeStyle = theme.line
      ctx.lineWidth = Math.max(1.5, size * 0.045)
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(left, y, width, height, height / 2)
      else ctx.rect(left, y, width, height)
      ctx.stroke()
      setFont(ctx, style)
      ctx.fillStyle = theme.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      // letter-spacing adds space after the last glyph too; nudge to re-centre
      ctx.fillText(text, left + width / 2 + (size * 0.06) / 2, y + padY + size * 0.74)
    },
  }
}

function imageBlock(ctx, img, maxWidth, maxHeight) {
  if (!img) return null
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return null
  const s = Math.min(maxWidth / iw, maxHeight / ih)
  const width = iw * s
  const height = ih * s
  return {
    width,
    height,
    draw(x, y, align) {
      const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
      ctx.drawImage(img, left, y, width, height)
    },
  }
}

/** Fit an image into a box (contain), centred. Returns the drawn rectangle. */
function drawContain(ctx, img, box) {
  const s = Math.min(box.w / img.width, box.h / img.height)
  const w = img.width * s
  const h = img.height * s
  const x = box.x + (box.w - w) / 2
  const y = box.y + (box.h - h) / 2
  ctx.drawImage(img, x, y, w, h)
  return { x, y, w, h }
}

function paintBackground(ctx, W, H, theme, spot) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, theme.top)
  bg.addColorStop(1, theme.bottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // A soft "studio light" behind the watch gives depth.
  const r = spot.r
  const g = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, r)
  g.addColorStop(0, theme.spot)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// ─── Layouts ─────────────────────────────────────────────────────
const TYPE = (u) => ({
  name: (size, maxLines = 2) => ({ weight: 500, family: SERIF, size: size * u, minSize: size * u * 0.5, maxLines, leading: 1.0, tracking: 0, preferOneLine: true }),
  tagline: (size, maxLines = 2) => ({ weight: 400, family: SANS, size: size * u, minSize: size * u * 0.7, maxLines, leading: 1.42, tracking: 0 }),
})

/**
 * Vertical, centred composition used by 1:1, 4:5 and 9:16.
 * `order` lists the blocks top to bottom; the watch takes the remaining height.
 */
function stackLayout(ctx, W, H, u, data, theme, cfg) {
  const t = TYPE(u)
  const cx = W / 2
  const maxText = W - cfg.margin * 2
  let scale = 1
  let blocks
  let watchH
  // Shrink the type a little if the watch would get too small.
  for (let attempt = 0; attempt < 5; attempt++) {
    blocks = {
      logo: imageBlock(ctx, data.logo, cfg.logo.w * u, cfg.logo.h * u),
      name: textBlock(ctx, data.name, t.name(cfg.name * scale, cfg.nameLines), maxText, theme.ink),
      tagline: textBlock(ctx, data.tagline, t.tagline(cfg.tagline * scale, cfg.taglineLines), maxText * 0.92, theme.muted),
      price: priceBlock(ctx, data.price, cfg.price * u * scale, theme),
    }
    let used = 0
    let prev = null
    for (const key of cfg.order) {
      if (key === 'watch') {
        if (prev) used += cfg.gaps.watch * u
        prev = key
        continue
      }
      const b = blocks[key]
      if (!b) continue
      if (prev) used += (prev === 'watch' ? cfg.gaps.watch : cfg.gaps[key] ?? cfg.gaps.default) * u
      used += b.height
      prev = key
    }
    watchH = cfg.bottom - cfg.top - used
    if (watchH >= (cfg.bottom - cfg.top) * cfg.minWatch) break
    scale *= 0.9
  }

  // Draw top to bottom.
  const watchBox = { x: cfg.margin * 0.5, w: W - cfg.margin, h: watchH }
  let y = cfg.top
  let prev = null
  const plan = []
  for (const key of cfg.order) {
    if (key === 'watch') {
      if (prev) y += cfg.gaps.watch * u
      watchBox.y = y
      y += watchH
      prev = key
      continue
    }
    const b = blocks[key]
    if (!b) continue
    if (prev) y += (prev === 'watch' ? cfg.gaps.watch : cfg.gaps[key] ?? cfg.gaps.default) * u
    plan.push([b, y])
    y += b.height
    prev = key
  }
  paintBackground(ctx, W, H, theme, { x: cx, y: watchBox.y + watchBox.h * 0.48, r: Math.max(watchBox.w, watchBox.h) * 0.62 })
  if (data.watch) drawContain(ctx, data.watch, watchBox)
  for (const [b, by] of plan) b.draw(cx, by, 'center')
}

/** 16:9 — text column on the left, watch large on the right. */
function landscapeLayout(ctx, W, H, u, data, theme) {
  const t = TYPE(u)
  const m = 96 * u
  const colX = 150 * u
  const colW = W * 0.4
  const watchBox = { x: W * 0.47, y: m * 0.45, w: W * 0.53 - m * 0.5, h: H - m * 0.9 }
  paintBackground(ctx, W, H, theme, { x: watchBox.x + watchBox.w / 2, y: H * 0.5, r: H * 0.62 })

  const logo = imageBlock(ctx, data.logo, 280 * u, 60 * u)
  logo?.draw(colX, m, 'left')

  const name = textBlock(ctx, data.name, t.name(124, 2), colW, theme.ink)
  const tagline = textBlock(ctx, data.tagline, t.tagline(36, 3), colW * 0.9, theme.muted)
  const price = priceBlock(ctx, data.price, 38 * u, theme)
  const gapA = 46 * u
  const gapB = 64 * u
  const blocks = [[name, 0], [tagline, gapA], [price, gapB]].filter(([b]) => b)
  const total = blocks.reduce((h, [b, gap], i) => h + b.height + (i ? gap : 0), 0)
  // Optically centred: slightly above the middle, and below the logo.
  let y = Math.max((H - total) / 2 - 10 * u, (logo ? m + logo.height + 60 * u : m))
  blocks.forEach(([b, gap], i) => {
    if (i) y += gap
    b.draw(colX, y, 'left')
    y += b.height
  })
  if (data.watch) drawContain(ctx, data.watch, watchBox)
}

const LAYOUTS = {
  '1x1': (ctx, W, H, u, data, theme) =>
    stackLayout(ctx, W, H, u, data, theme, {
      margin: 76 * u,
      top: 64 * u,
      bottom: H - 72 * u,
      order: ['logo', 'watch', 'name', 'tagline', 'price'],
      logo: { w: 220, h: 46 },
      name: 88,
      nameLines: 2,
      tagline: 29,
      taglineLines: 2,
      price: 30,
      gaps: { default: 18, tagline: 26, price: 34, watch: 26 },
      minWatch: 0.42,
    }),
  '4x5': (ctx, W, H, u, data, theme) =>
    stackLayout(ctx, W, H, u, data, theme, {
      margin: 84 * u,
      top: 76 * u,
      bottom: H - 84 * u,
      order: ['logo', 'name', 'tagline', 'watch', 'price'],
      logo: { w: 240, h: 50 },
      name: 100,
      nameLines: 2,
      tagline: 31,
      taglineLines: 2,
      price: 34,
      gaps: { default: 20, name: 44, tagline: 30, watch: 24 },
      minWatch: 0.45,
    }),
  // Stories: keep text out of the top ~12% and bottom ~16%, where the app's own UI sits.
  '9x16': (ctx, W, H, u, data, theme) =>
    stackLayout(ctx, W, H, u, data, theme, {
      margin: 90 * u,
      top: H * 0.115,
      bottom: H * 0.84,
      order: ['logo', 'name', 'tagline', 'watch', 'price'],
      logo: { w: 260, h: 58 },
      name: 120,
      nameLines: 2,
      tagline: 38,
      taglineLines: 3,
      price: 42,
      gaps: { default: 24, name: 64, tagline: 38, watch: 30 },
      minWatch: 0.45,
    }),
  '16x9': landscapeLayout,
}

/**
 * Draw one banner onto `canvas` (resized to the format).
 * data: { name, tagline, price, logo (image|null), watch (canvas|null), theme: 'light'|'dark' }
 */
export function drawBanner(canvas, format, data) {
  canvas.width = format.width
  canvas.height = format.height
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const u = Math.min(format.width, format.height) / 1080
  const theme = THEMES[data.theme] ?? THEMES.light
  // NFC: draw "é" as one character, not "e" + a combining accent some fonts misplace.
  const tidy = (v) => (v || '').normalize('NFC').trim()
  const clean = { ...data, name: tidy(data.name), tagline: tidy(data.tagline), price: tidy(data.price) }
  LAYOUTS[format.id](ctx, format.width, format.height, u, clean, theme)
}
