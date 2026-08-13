import http from 'node:http'
import net from 'node:net'

export function request(port, method, pathname, body = '', headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: pathname, method, headers }, (response) => {
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
    })
    request.on('error', reject)
    if (body) {
      request.write(body)
    }
    request.end()
  })
}

export function requestWithoutHost(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const chunks = []
    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write('GET / HTTP/1.0\r\n\r\n'))
    socket.on('data', (chunk) => chunks.push(chunk))
    socket.on('end', () => resolve(Number(/^HTTP\/1\.1 (\d{3})/u.exec(chunks.join(''))?.[1])))
    socket.on('error', reject)
  })
}
