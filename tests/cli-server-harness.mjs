import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

export async function withServer(args, cwd, cliPath, callback) {
  const port = String(4300 + Math.floor(Math.random() * 1000))
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, CODE_MAP_PORT: port, CODE_MAP_CONFIG: '' },
    stdio: ['ignore', 'ignore', 'pipe']
  })
  let childFailure
  let childError = ''
  child.on('error', (error) => {
    childFailure = error
  })
  child.stderr.on('data', (chunk) => {
    childError += chunk.toString('utf8')
  })
  child.stderr.on('error', () => {})

  try {
    const session = await waitForServer(port)
    await callback(port, session)
    if (childFailure) {
      throw childFailure
    }
  } catch (error) {
    error.message += `\nServer arguments: ${args.join(' ') || '(auto-detected)'}`
    if (childError.trim()) {
      error.message += `\nServer process error:\n${childError.trim()}`
    }
    throw error
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await new Promise((resolve) => child.once('exit', resolve))
    }
  }
}

export function request(port, method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (response) => {
        const chunks = []
        response.on('error', reject)
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: response.headers
          })
        )
      }
    )
    req.on('error', reject)
    if (payload) {
      req.write(payload)
    }
    req.end()
  })
}

export function requestRaw(port, method, pathname, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const contentLength = headers['Transfer-Encoding'] ? {} : { 'Content-Length': Buffer.byteLength(payload) }
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method,
        headers: { 'Content-Type': 'application/json', ...contentLength, ...headers }
      },
      (response) => {
        const chunks = []
        response.on('error', reject)
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: response.headers
          })
        )
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await request(port, 'GET', '/', null)
      if (response.status === 200) {
        return sessionHeaders(response, port)
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`server did not start on port ${port}`)
}

function sessionHeaders(response, port) {
  const setCookie = response.headers['set-cookie']?.[0]
  if (!setCookie) {
    throw new Error('server did not issue a viewer session cookie')
  }
  assert.match(
    setCookie,
    /; HttpOnly; SameSite=Strict; Path=\/$/u,
    'the viewer session cookie must not be readable by JavaScript or sent cross-site'
  )
  return { Cookie: setCookie.split(';')[0], Origin: `http://localhost:${port}` }
}

export function viewerRuntimeModuleNames(packageRoot) {
  const modules = new Set()
  visit('viewer-init.js')
  return [...modules].sort()

  function visit(moduleName) {
    if (modules.has(moduleName)) {
      return
    }
    modules.add(moduleName)
    const source = fs.readFileSync(path.join(packageRoot, 'viewer', moduleName), 'utf8')
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]#viewer\/([^'"]+)['"]/gu)) {
      visit(match[1])
    }
  }
}
