import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  appRoot,
  arbitraryConfigDir,
  arbitraryConfigPath,
  arbitraryGraphPath,
  arbitraryRoot,
  cliPath
} from '#tests/cli-smoke.test.mjs'
import { request, withServer } from '#tests/cli-server-harness.mjs'

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
    const notFound = await request(port, 'GET', '/missing', null)
    assert.equal(notFound.status, 404)

    const graphBackup = fs.readFileSync(arbitraryGraphPath, 'utf8')
    fs.rmSync(arbitraryGraphPath)
    fs.mkdirSync(arbitraryGraphPath)
    try {
      const failedScan = await request(port, 'POST', '/api/scan', {}, session)
      assert.equal(failedScan.status, 500, 'graph write failures must be returned as controlled scan errors')
      assert.equal(JSON.parse(failedScan.body).ok, false)
      assert.equal(
        JSON.parse(failedScan.body).error,
        'Internal server error.',
        'internal scan details must not leak over HTTP'
      )
      assert.equal(
        fs.readdirSync(arbitraryConfigDir).some((name) => name.endsWith('.tmp')),
        false,
        'failed graph writes must clean up temporary files'
      )
    } finally {
      fs.rmSync(arbitraryGraphPath, { recursive: true })
      fs.writeFileSync(arbitraryGraphPath, graphBackup, 'utf8')
    }

    const configBackup = fs.readFileSync(arbitraryConfigPath, 'utf8')
    fs.rmSync(arbitraryConfigPath)
    fs.mkdirSync(arbitraryConfigPath)
    try {
      const failedSave = await request(port, 'POST', '/api/project-map', current, session)
      assert.equal(failedSave.status, 500, 'config write failures must be returned as controlled save errors')
      assert.equal(JSON.parse(failedSave.body).ok, false)
      assert.equal(
        JSON.parse(failedSave.body).error,
        'Internal server error.',
        'internal save details must not leak over HTTP'
      )
      assert.equal(
        fs.readdirSync(arbitraryConfigDir).some((name) => name.endsWith('.tmp')),
        false,
        'failed config writes must clean up temporary files'
      )
    } finally {
      fs.rmSync(arbitraryConfigPath, { recursive: true })
      fs.writeFileSync(arbitraryConfigPath, configBackup, 'utf8')
    }
  }
)

await withServer([], appRoot, cliPath, async (port, session) => {
  const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
  const response = await request(port, 'POST', '/api/project-map', current, session)
  assert.equal(response.status, 400, 'settings save should be blocked for auto-detected configs')
  assert.match(response.body, /Cannot save an auto-detected project map/u)
})

console.log('cli server failure tests passed')
