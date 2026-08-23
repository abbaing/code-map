import readline from 'node:readline'

export async function serveMcpStdio(protocol, { input, output }) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity, terminal: false })
  for await (const line of lines) {
    if (!line.trim()) {
      continue
    }
    let response
    try {
      response = await protocol.handle(JSON.parse(line))
    } catch {
      response = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }
    }
    if (response) {
      output.write(`${JSON.stringify(response)}\n`)
    }
  }
}
