// Generates the PWA icon set (solid background + heart glyph) as real PNGs.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(rootDir, 'public')
mkdirSync(publicDir, { recursive: true })

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0 // filter type: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function heartMask(x, y) {
  // Classic implicit heart curve over [-1.5, 1.5].
  const px = x * 1.35
  const py = -y * 1.35 + 0.25
  const a = px * px + py * py - 1
  return a * a * a - px * px * py * py * py <= 0
}

function renderIcon(size, { background, heart, padding }) {
  const rgba = Buffer.alloc(size * size * 4)
  const radius = size * 0.22
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const inCorner =
        (x < radius && y < radius && Math.hypot(radius - x, radius - y) > radius) ||
        (x > size - radius && y < radius && Math.hypot(x - (size - radius), radius - y) > radius) ||
        (x < radius && y > size - radius && Math.hypot(radius - x, y - (size - radius)) > radius) ||
        (x > size - radius && y > size - radius && Math.hypot(x - (size - radius), y - (size - radius)) > radius)

      if (inCorner) continue // transparent

      const nx = (x / size - 0.5) * 2
      const ny = (y / size - 0.5) * 2
      const onHeart = heartMask(nx / padding, ny / padding)
      const color = onHeart ? heart : background
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

function renderMaskable(size) {
  // Full-bleed background so the maskable safe zone is respected.
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const nx = (x / size - 0.5) * 2
      const ny = (y / size - 0.5) * 2
      const onHeart = heartMask(nx / 0.6, ny / 0.6)
      const color = onHeart ? [255, 255, 255] : [17, 24, 39]
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

const bg = [17, 24, 39]
const heart = [244, 63, 94]

const outputs = [
  ['pwa-192x192.png', renderIcon(192, { background: bg, heart, padding: 0.62 })],
  ['pwa-512x512.png', renderIcon(512, { background: bg, heart, padding: 0.62 })],
  ['apple-touch-icon.png', renderIcon(180, { background: bg, heart, padding: 0.62 })],
  ['maskable-512x512.png', renderMaskable(512)],
]

for (const [name, buffer] of outputs) {
  writeFileSync(resolve(publicDir, name), buffer)
  console.log(`wrote public/${name} (${buffer.length} bytes)`)
}
