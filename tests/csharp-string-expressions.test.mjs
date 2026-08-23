import assert from 'node:assert/strict'
import { csharpAttributes, csharpDescendants, parseCSharp } from '#parsers/csharp.mjs'
import { csharpStringConstants } from '#parsers/csharp-constants.mjs'

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

console.log('C# string expression tests passed')
