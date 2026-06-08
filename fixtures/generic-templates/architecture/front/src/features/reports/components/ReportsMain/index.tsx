import { useState } from 'react'

export function ReportsMain() {
  const [count] = useState(0)
  fetch('/api/reports')
  return <div>{count}</div>
}
