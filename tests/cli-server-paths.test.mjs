import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { arbitraryConfigPath, arbitraryRoot, cliPath, tempRoot } from '#tests/cli-smoke.test.mjs'
import { request, withServer } from '#tests/cli-server-harness.mjs'

import { escapeCases } from '#tests/cli-escape-cases.mjs'

await withServer(
  ['--config', arbitraryConfigPath, '--allow-plugins'],
  arbitraryRoot,
  cliPath,
  async (port, session) => {
    const current = JSON.parse((await request(port, 'GET', '/project-map.json')).body)
    for (const [field, mutate] of escapeCases) {
      const escapedConfig = structuredClone(current)
      mutate(escapedConfig)
      const configBeforeEscape = fs.readFileSync(arbitraryConfigPath, 'utf8')
      const escapedResponse = await request(port, 'POST', '/api/project-map', escapedConfig, session)
      assert.equal(escapedResponse.status, 400, `${field} must not escape the project root`)
      assert.match(JSON.parse(escapedResponse.body).error, /must resolve within the project root/u)
      assert.equal(
        fs.readFileSync(arbitraryConfigPath, 'utf8'),
        configBeforeEscape,
        `a rejected ${field} must not modify the config`
      )
    }
    assert.equal(
      fs.existsSync(path.join(tempRoot, 'escaped-graph.json')),
      false,
      'rejected graph paths must not create files outside the project'
    )
    const changedPluginConfig = structuredClone(current)
    changedPluginConfig.templates.plugins = ['./templates/another-plugin.mjs']
    const configBeforePluginChange = fs.readFileSync(arbitraryConfigPath, 'utf8')
    const changedPluginResponse = await request(port, 'POST', '/api/project-map', changedPluginConfig, session)
    assert.equal(changedPluginResponse.status, 400, 'the viewer must not change the trusted plugin list')
    assert.match(JSON.parse(changedPluginResponse.body).error, /Template plugins cannot be changed from the viewer/u)
    assert.equal(
      fs.readFileSync(arbitraryConfigPath, 'utf8'),
      configBeforePluginChange,
      'a rejected plugin change must preserve the config'
    )
  }
)

console.log('cli server path tests passed')
