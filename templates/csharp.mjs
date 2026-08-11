import { csharpParser } from '#parsers/csharp.mjs'
import { isBackTestFile } from '#core/source-analysis.mjs'

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
        test: isBackTestFile,
        includeTests: false
      }
    ]
  }
}
