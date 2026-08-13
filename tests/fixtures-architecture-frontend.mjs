export const architectureFrontendFixture = {
  'architecture/front/src/features/testing/coverage.spec.ts': `import tested from './tested'

const example = "import uncovered from './uncovered'"

test('uses the tested module', () => tested)
`,
  'architecture/front/src/features/testing/tested.ts': `export default 'tested'
`,
  'architecture/front/src/features/testing/uncovered.ts': `export default 'uncovered'
`,
  'architecture/front/src/features/prospecting/hooks/useProspecting.ts': `export function useProspecting() {
  return 'prospecting'
}
`,
  'architecture/front/src/features/reports/components/ReportsMain/index.tsx': `import { useState } from 'react'

export function ReportsMain() {
  const [count] = useState(0)
  fetch('/api/reports')
  return <div>{count}</div>
}
`,
  'architecture/front/src/features/users/config/constants.ts': `export const USERS_API_BASE = '/api/v1/admin/users'
`,
  'architecture/front/src/features/users/repositories/UsersRepository.ts': `import { USERS_API_BASE as usersBase } from '../config/constants'

async function get<T>(url: string): Promise<T> {
  throw new Error(url)
}

async function mutate<T>(method: 'POST' | 'PUT', url: string): Promise<T> {
  throw new Error(method + url)
}

export async function getUsers() {
  return get(usersBase)
}

export async function createUser() {
  return mutate('POST', usersBase)
}

export async function updateUser(id: string) {
  return mutate('PUT', \`\${usersBase}/\${id}\`)
}
`,
  'architecture/front/src/features/reports/components/Widget.tsx': `export function Widget() {
  return <div>Widget</div>
}
`,
  'architecture/front/src/features/reports/pages/ReportsPage/index.tsx': `export default function ReportsPage() { return null }
`,
  'architecture/front/src/features/reports/pages/ReportsPage/_DateRangeSelector/index.tsx': `export default function DateRangeSelector() { return null }
`,
  'architecture/front/src/features/reports/pages/index.ts': `export { default } from './ReportsPage'
`,
  'architecture/front/src/features/reports/hooks/useReports.ts': `import { useProspecting } from '@/features/prospecting/hooks/useProspecting'
// import { Widget } from '@/features/reports/components/Widget'

export function useReports() {
  return useProspecting()
}
`,
  'architecture/front/src/features/reports/repositories/reportRepository.ts': `import React from 'react'

export function loadReport() {
  return React.version
}
`
}
