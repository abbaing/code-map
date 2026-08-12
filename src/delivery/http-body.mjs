const maxRequestBodyBytes = 1024 * 1024

export class HttpRequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function readRequestBody(request) {
  validateDeclaredLength(request)
  return new Promise((resolve, reject) => {
    const state = { chunks: [], receivedBytes: 0, settled: false }
    request.on('data', (chunk) => receiveChunk(state, chunk, reject))
    request.on('end', () => finishBody(state, resolve))
    request.on('aborted', () => {
      if (!state.settled) {
        state.settled = true
        reject(new HttpRequestError(400, 'Request body was interrupted.'))
      }
    })
    request.on('error', () => {
      if (!state.settled) {
        state.settled = true
        reject(new HttpRequestError(400, 'Request body could not be read.'))
      }
    })
  })
}

export async function readJsonRequest(request) {
  const body = await readRequestBody(request)
  try {
    return JSON.parse(body)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }
    throw new HttpRequestError(400, 'Request body must contain valid JSON.')
  }
}

function validateDeclaredLength(request) {
  const declaredLength = request.headers['content-length']
  if (declaredLength === undefined) {
    return
  }
  if (!/^\d+$/u.test(declaredLength)) {
    throw new HttpRequestError(400, 'Invalid Content-Length header.')
  }
  if (Number(declaredLength) > maxRequestBodyBytes) {
    request.resume()
    throw new HttpRequestError(413, 'Request body exceeds the 1 MiB limit.')
  }
}

function receiveChunk(state, chunk, reject) {
  if (state.settled) {
    return
  }
  state.receivedBytes += chunk.length
  if (state.receivedBytes > maxRequestBodyBytes) {
    state.settled = true
    state.chunks.length = 0
    reject(new HttpRequestError(413, 'Request body exceeds the 1 MiB limit.'))
    return
  }
  state.chunks.push(chunk)
}

function finishBody(state, resolve) {
  if (!state.settled) {
    state.settled = true
    resolve(Buffer.concat(state.chunks, state.receivedBytes).toString('utf8'))
  }
}
