import { csharpParser, isCSharpTestFile } from '#parsers/csharp.mjs'

export const csharpTemplate = {
  id: 'csharp',
  stage: 'technology',
  description: 'C# source discovery and parser services.',
  capabilities: {
    parsers: [csharpParser],
    fileKinds: [
      {
        id: 'backend-source',
        rootKey: 'backend',
        extensions: ['.cs'],
        test: isCSharpTestFile,
        includeTests: false
      }
    ]
  }
}
