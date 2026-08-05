export class SubmapError extends Error {
  constructor(code, message, details = {}, exitCode = 2) {
    super(message)
    this.name = 'SubmapError'
    this.code = code
    this.details = details
    this.exitCode = exitCode
  }
}

export function validationIssue(code, message, details = {}) {
  return { code, message, ...(Object.keys(details).length ? { details } : {}) }
}
