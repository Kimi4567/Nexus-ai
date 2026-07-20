import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Operations Center | NEXUS',
  description: 'Verified execution health, incidents, approvals, integrations, analytics, and credit traceability.',
}

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
