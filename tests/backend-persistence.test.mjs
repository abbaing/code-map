import assert from 'node:assert/strict'
import { Graph } from '#core/graph.mjs'
import { createParserRegistry, createSourceDocumentStore } from '#core/source-documents.mjs'
import { csharpBackendParser } from '#parsers/csharp-backend.mjs'
import { createBackScanSession, scanDatabase } from '#scanners/scan-back.mjs'

const files = {
  'back/App/Data/AppDbContext.cs': `
public class AppDbContext : DbContext
{
    public DbSet<Account> Accounts { get; set; }
    public DbSet<Owner> Owners { get; set; }
}
`,
  'back/Domain/Entities/Accounts/Account.cs': `
public class Account
{
    public string Name { get; set; }
    public Owner Owner { get; set; }
}
`,
  'back/Domain/Entities/Accounts/Owner.cs': `
public class Owner
{
    public string Name { get; set; }
}
`,
  'back/Infrastructure/Configurations/Entities/AccountPersistenceMap.cs': `
public class AccountPersistenceMap : IEntityTypeConfiguration<Account>
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
let sourceReads = 0
const sourceReader = {
  readText(filePath) {
    sourceReads += 1
    return files[filePath]
  }
}
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

const sourceDocuments = createSourceDocumentStore({
  parserRegistry: createParserRegistry([csharpBackendParser]),
  sourceReader
})
const session = createBackScanSession(Object.keys(files), sourceDocuments)
scanDatabase(graph, Object.keys(files), projectContext, session, sourceDocuments)
assert.equal(sourceReads, Object.keys(files).length, 'backend syntax documents must be parsed once per scan session')

const entityId = 'file:back/Domain/Entities/Accounts/Account.cs'
const ownerId = 'file:back/Domain/Entities/Accounts/Owner.cs'
const tableId = 'table:accounts'
assert.equal(graph.getNode(entityId).type, 'entity')
assert.equal(graph.getNode(entityId).meta.dbSet, 'Accounts')
assert.deepEqual(graph.getNode(entityId).meta.domain.properties, [
  { name: 'Name', type: 'string' },
  { name: 'Owner', type: 'Owner' }
])
assert.equal(graph.getNode(tableId).meta.entity, 'Account')
assert.equal(graph.getNode(tableId).module, 'accounts')
assert.equal(graph.getNode('table:Owners').meta.entity, 'Owner')
assert.equal(hasEdge('file:back/App/Data/AppDbContext.cs', entityId, 'dbset'), true)
assert.equal(edge('file:back/App/Data/AppDbContext.cs', entityId, 'dbset').evidence, 'DbSet<Account> Accounts')
assert.equal(hasEdge('file:back/App/Data/AppDbContext.cs', entityId, 'uses-entity'), false)
assert.equal(hasEdge('file:back/App/Data/AppDbContext.cs', tableId, 'queries-table'), false)
assert.equal(hasEdge(entityId, tableId, 'maps-to-table'), true)
assert.equal(hasEdge(entityId, ownerId, 'domain-relation'), true)
assert.equal(hasEdge('file:back/Infrastructure/Repositories/AccountRepository.cs', entityId, 'uses-entity'), true)
assert.equal(hasEdge('file:back/Infrastructure/Repositories/AccountRepository.cs', tableId, 'queries-table'), true)

console.log('backend persistence scanner tests passed')

function hasEdge(from, to, type) {
  return Boolean(edge(from, to, type))
}

function edge(from, to, type) {
  return graph.allEdges().find((candidate) => candidate.from === from && candidate.to === to && candidate.type === type)
}
