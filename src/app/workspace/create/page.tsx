import { redirect } from 'next/navigation'

// Workspace creation is handled in /onboarding
export default function CreateWorkspacePage() {
  redirect('/onboarding')
}
