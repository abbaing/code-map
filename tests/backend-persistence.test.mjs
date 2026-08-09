import assert from 'node:assert/strict'
import { Graph } from '#core/graph.mjs'
import { createBackScanSession, scanDatabase } from '#scanners/scan-back.mjs'

const files = {
  'back/App/Data/AppDbContext.cs': `
public class AppDbContext : DbContext
{
    public DbSet<Account> Accounts { get; set; }
}
`,
  'back/Domain/Entities/Accounts/Account.cs': `
public class Account
{
    public string Name { get; set; }
}
`,
  'back/Infrastructure/Configurations/Entities/AccountConfiguration.cs': `
public class AccountConfiguration
{
    public void Configure(EntityTypeBuilder<Account> builder) => builder.ToTable("accounts");
}
`,
  'back/Infrastructure/Repositories/AccountRepository.cs': `
public class AccountRepository
{
    public object Find(AppDbContext db) => db.Accounts.Where(account => account.Name != null);
}
`
}
const sourceReader = { readText: (filePath) => files[filePath] }
const projectContext = {
  toRepoPath: (filePath) => filePath,
  projectMap: {
    modules: { shared: 'shared', backendEntityDomainPattern: '^back/Domain/Entities/([^/]+)' },
    backend: {
      entityConfigurationPathFragment: '/Configurations/Entities/',
      entityPathFragment: '/Entities/'
    }
  }
}
const graph = new Graph()
for (const filePath of Object.keys(files)) {
  graph.addNode(`file:${filePath}`, {
    label: filePath.split('/').at(-1),
    type: filePath.endsWith('AccountRepository.cs') ? 'repository' : 'auxiliary',
    layer: 'backend',
    module: 'accounts',
    path: filePath
  })
}

const session = createBackScanSession(Object.keys(files), sourceReader)
scanDatabase(graph, Object.keys(files), projectContext, session, sourceReader)

const entityId = 'file:back/Domain/Entities/Accounts/Account.cs'
const tableId = 'table:accounts'
assert.equal(graph.getNode(entityId).type, 'entity')
assert.equal(graph.getNode(entityId).meta.dbSet, 'Accounts')
assert.deepEqual(graph.getNode(entityId).meta.domain.properties, [{ name: 'Name', type: 'string' }])
assert.equal(graph.getNode(tableId).meta.entity, 'Account')
assert.equal(graph.getNode(tableId).module, 'accounts')
assert.equal(hasEdge('file:back/App/Data/AppDbContext.cs', entityId, 'dbset'), true)
assert.equal(hasEdge('file:back/App/Data/AppDbContext.cs', entityId, 'uses-entity'), false)
assert.equal(hasEdge('file:back/App/Data/AppDbContext.cs', tableId, 'queries-table'), false)
assert.equal(hasEdge(entityId, tableId, 'maps-to-table'), true)
assert.equal(hasEdge('file:back/Infrastructure/Repositories/AccountRepository.cs', entityId, 'uses-entity'), true)
assert.equal(hasEdge('file:back/Infrastructure/Repositories/AccountRepository.cs', tableId, 'queries-table'), true)

console.log('backend persistence scanner tests passed')

function hasEdge(from, to, type) {
  return graph.allEdges().some((edge) => edge.from === from && edge.to === to && edge.type === type)
}
