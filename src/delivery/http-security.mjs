const sessionCookieName = 'code-map-session'

export function trustedAuthority(request, serverHost, address) {
  if (!request.headers.host || typeof address === 'string') {
    return null
  }
  const authority = parseAuthority(request.headers.host)
  if (
    !authority ||
    authority.username ||
    authority.password ||
    authority.pathname !== '/' ||
    authority.search ||
    authority.hash
  ) {
    return null
  }
  const requestPort = authority.port ? Number(authority.port) : 80
  if (requestPort !== address.port) {
    return null
  }
  const allowedHosts = allowedAuthorities(serverHost, address, request.socket.localAddress)
  return allowedHosts.has(normalizeHost(authority.hostname)) ? authority : null
}

export function authorizedMutation(request, expectedOrigin, sessionToken, random) {
  if (request.headers.origin !== expectedOrigin) {
    return false
  }
  const token = cookieValue(request.headers.cookie, sessionCookieName)
  if (!token) {
    return false
  }
  return random.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken))
}

export function sessionCookie(sessionToken) {
  return `${sessionCookieName}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`
}

function parseAuthority(host) {
  try {
    return new URL(`http://${host}`)
  } catch {
    return null
  }
}

function allowedAuthorities(serverHost, address, localAddress) {
  const hosts = new Set([normalizeHost(serverHost), normalizeHost(address.address), normalizeHost(localAddress)])
  if ([...hosts].some(isLoopbackHost)) {
    hosts.add('localhost')
    hosts.add('127.0.0.1')
    hosts.add('::1')
  }
  return hosts
}

function normalizeHost(value = '') {
  const normalized = String(value)
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  return normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized
}

function isLoopbackHost(value) {
  return value === 'localhost' || value === '127.0.0.1' || value === '::1'
}

function cookieValue(header = '', name) {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator >= 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim()
    }
  }
  return null
}
