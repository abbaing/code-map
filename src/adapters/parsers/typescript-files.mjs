export const tsExtensions = Object.freeze(['.ts', '.tsx', '.js', '.jsx'])

export function isTestFile(filePath) {
  return /\.(spec|test)\.[cm]?[jt]sx?$/u.test(filePath)
}
