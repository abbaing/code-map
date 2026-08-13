export const typescriptFixture = {
  'typescript/front/src/index.ts': `import value from './relative'

const item: any = value
const example = 'as any and : any are documentation here'

export default item + example
`,
  'typescript/front/src/relative.ts': `export default 'value'
`
}
