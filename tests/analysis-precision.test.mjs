import assert from 'node:assert/strict'
import { normalizeProjectMap } from '#core/config.mjs'
import { extractFrontendEndpoints } from '#core/endpoints.mjs'
import { Graph } from '#core/graph.mjs'
import { moduleReferencesOf } from '#core/source-analysis.mjs'
import { createBackScanSession, scanControllers } from '#scanners/scan-back.mjs'

const importCases = [
  {
    id: 'TS-01',
    source: "import value, { helper } from './value.js'",
    expected: [{ specifier: './value.js', kind: 'static' }]
  },
  { id: 'TS-02', source: "import './setup.js'", expected: [{ specifier: './setup.js', kind: 'static' }] },
  {
    id: 'TS-03',
    source: "import type { Account } from './account.js'",
    expected: [{ specifier: './account.js', kind: 'static' }]
  },
  {
    id: 'TS-04',
    source: "export { account } from './account.js'",
    expected: [{ specifier: './account.js', kind: 'static' }]
  },
  {
    id: 'TS-05',
    source: "// import ignored from './comment.js'\nconst example = \"import fake from './string.js'\"",
    expected: []
  },
  {
    id: 'TS-06',
    source: "const module = import('./dynamic.js')",
    expected: [{ specifier: './dynamic.js', kind: 'dynamic' }]
  },
  { id: 'TS-07', source: "const module = require('./commonjs.js')", expected: [] },
  { id: 'TS-08', source: "const module = import('./features/' + name)", expected: [] }
]

for (const fixture of importCases) {
  assert.deepEqual(
    moduleReferencesOf(fixture.source).map(({ specifier, kind }) => ({ specifier, kind })),
    fixture.expected,
    fixture.id
  )
}

const endpointCases = [
  {
    id: 'HTTP-01',
    source: "fetch('/api/accounts', { method: 'POST' })",
    expected: [{ url: '/api/accounts', method: 'POST' }]
  },
  {
    id: 'HTTP-02',
    source: "const baseUrl = '/api/accounts'\nthis.get(baseUrl)",
    expected: [{ url: '/api/accounts', method: 'GET' }]
  },
  {
    id: 'HTTP-03',
    source: "const baseUrl = '/api/accounts'\nfetch(`${baseUrl}/${accountId}`)",
    expected: [{ url: '/api/accounts/{}', method: 'GET' }]
  },
  {
    id: 'HTTP-04',
    source: "client({ method: 'DELETE', url: '/api/accounts/42' })",
    expected: [{ url: '/api/accounts/42', method: 'DELETE' }]
  },
  {
    id: 'HTTP-05',
    source: "const baseUrl = '/api/accounts'\nfetch(baseUrl + '/' + accountId)",
    expected: []
  },
  {
    id: 'HTTP-06',
    source: "// fetch('/api/comment')\nconst example = \"client({ method: 'GET', url: '/api/string' })\"",
    expected: []
  },
  {
    id: 'HTTP-07',
    source: "client<{ id: string }>({\n method: 'PATCH',\n url: '/api/accounts/42'\n})",
    expected: [{ url: '/api/accounts/42', method: 'PATCH' }]
  }
]

for (const fixture of endpointCases) {
  assert.deepEqual(extractFrontendEndpoints(fixture.source), fixture.expected, fixture.id)
}

const controllerCases = [
  {
    id: 'CS-01',
    source: `
[Route("api/accounts")]
public class AccountsController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult Get(string id)
    {
        return Ok(id);
    }
}`,
    expected: [{ url: '/api/accounts/{id}', method: 'GET', action: 'Get' }]
  },
  {
    id: 'CS-02',
    source: `
[Route("api/accounts")]
public class AccountsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create() => Ok();
}`,
    expected: [{ url: '/api/accounts', method: 'POST', action: 'Create' }]
  },
  {
    id: 'CS-03',
    source: `
[Route(ApiRoutes.Accounts)]
public class AccountsController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok();
}`,
    expected: []
  },
  {
    id: 'CS-04',
    source: `
// [Route("api/ignored")]
// public class IgnoredController : ControllerBase { [HttpGet] public object Get() => Ok(); }
public class PlainController : ControllerBase {}`,
    expected: []
  },
  {
    id: 'CS-05',
    source: `
public class PlainController : ControllerBase
{
    private const string Example = "[Route(\\"api/ignored\\")] [HttpGet]";
}`,
    expected: []
  }
]

for (const fixture of controllerCases) {
  assert.deepEqual(extractControllerEndpoints(fixture.source), fixture.expected, fixture.id)
}

assert.equal(importCases.length + endpointCases.length + controllerCases.length, 20)
console.log('analysis precision fixtures passed')

function extractControllerEndpoints(source) {
  const file = 'back/Demo.API/Controllers/AccountsController.cs'
  const sourceReader = { readText: () => source }
  const projectContext = {
    toRepoPath: (filePath) => filePath,
    projectMap: normalizeProjectMap({
      schemaVersion: 1,
      project: { name: 'Precision Fixture' },
      sourceRoots: { frontend: 'src', backend: 'back' }
    })
  }
  const graph = new Graph()
  const session = createBackScanSession([file], sourceReader)
  return scanControllers(graph, [file], projectContext, session, sourceReader).map(({ url, method, action }) => ({
    url,
    method,
    action
  }))
}
