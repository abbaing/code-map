import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const browserModuleName = /^(?:viewer-[a-z0-9-]+|graph-gateway|rendering-contracts)\.(?:js|mjs)$/u

export function createViewerAssets(viewerRoot) {
  const indexPath = path.join(viewerRoot, 'viewer.html')
  const source = fs.readFileSync(indexPath, 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/u)?.[1]
  if (!source) {
    throw new Error('Viewer import map is missing')
  }
  const importMapHash = crypto.createHash('sha256').update(source).digest('base64')
  const assets = new Map(
    fs
      .readdirSync(viewerRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isPublicAsset(entry.name))
      .map((entry) => [`/${entry.name}`, path.join(viewerRoot, entry.name)])
  )
  return Object.freeze({ indexPath, assets, securityHeaders: securityHeaders(importMapHash) })
}

function isPublicAsset(name) {
  return name === 'tailwind.css' || name === 'viewer.css' || browserModuleName.test(name)
}

function securityHeaders(importMapHash) {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      `script-src 'self' 'sha256-${importMapHash}'`,
      "script-src-attr 'none'",
      "style-src 'self'",
      "style-src-elem 'self'",
      "style-src-attr 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'"
    ].join('; '),
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  }
}
