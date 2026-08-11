export const componentStatusValues = ['pass', 'gap', 'not-applicable']
export const componentRoles = ['core', 'application', 'extension', 'adapter', 'composition-root']

export function designStatus(responsibility, extensibility, substitution, interfaces, dependencies) {
  return { responsibility, extensibility, substitution, interfaces, dependencies }
}
