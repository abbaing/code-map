import assert from 'node:assert/strict'
import { csharpAttributes, csharpDescendants, parseCSharp } from '#parsers/csharp.mjs'
import { csharpStringConstantExpressions, csharpStringConstants } from '#parsers/csharp-constants.mjs'
import { createBackScanSession } from '#scanners/scan-back-session.mjs'

const tree = parseCSharp(`
public static class ApiRoutes
{
    public const string Root = "api/";
    public const string Accounts = Root + "accounts";
    public const string ById = ApiRoutes.Accounts + "/{id}";
    public const string CycleA = CycleB;
    public const string CycleB = CycleA;
}
`)
const constants = csharpStringConstants(tree)
assert.deepEqual(constants, [
  { name: 'Root', qualifiedName: 'ApiRoutes.Root', value: 'api/' },
  { name: 'Accounts', qualifiedName: 'ApiRoutes.Accounts', value: 'api/accounts' },
  { name: 'ById', qualifiedName: 'ApiRoutes.ById', value: 'api/accounts/{id}' }
])

const valueByName = new Map(
  constants.flatMap((constant) => [
    [constant.name, constant.value],
    [constant.qualifiedName, constant.value]
  ])
)
const controllerTree = parseCSharp(`
[Route(ApiRoutes.Root + "reports")]
public class ReportsController : ControllerBase {}
`)
const controller = csharpDescendants(controllerTree.rootNode, 'class_declaration')[0]
assert.equal(csharpAttributes(controller, (reference) => valueByName.get(reference))[0].value, 'api/reports')

const featureTree = parseCSharp(`
public static class FeatureRoutes
{
    public const string Accounts = ApiRoutes.Root + "accounts";
}
`)
const expressionsByFile = new Map([
  ['ApiRoutes.cs', csharpStringConstantExpressions(tree)],
  ['FeatureRoutes.cs', csharpStringConstantExpressions(featureTree)]
])
const sourceDocuments = {
  factsOf: (file, factName) => (factName === 'typeDeclarations' ? [] : expressionsByFile.get(file))
}
const session = createBackScanSession([...expressionsByFile.keys()], sourceDocuments)
assert.equal(session.valueOf('FeatureRoutes.Accounts'), 'api/accounts')

console.log('C# string expression tests passed')
