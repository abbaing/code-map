export const escapeCases = [
  [
    'graph output',
    (document) => {
      document.project.graphOutput = '../escaped-graph.json'
    }
  ],
  [
    'submap directory',
    (document) => {
      document.project.submapsDirectory = '../escaped-submaps'
    }
  ],
  [
    'frontend source root',
    (document) => {
      document.sourceRoots.frontend = '../outside-source'
    }
  ],
  [
    'symlinked source root',
    (document) => {
      document.sourceRoots.frontend = 'linked-outside'
    }
  ],
  [
    'runtime links',
    (document) => {
      document.project.runtimeLinks = '../outside-runtime-links.json'
    }
  ],
  [
    'import alias',
    (document) => {
      document.imports = { aliases: [{ prefix: '@outside/', path: '../outside-source' }] }
    }
  ],
  [
    'template plugin',
    (document) => {
      document.templates.plugins = ['../../../outside-plugin.mjs']
    }
  ]
]
