import { redirect } from 'next/navigation'

/** Legacy entrypoint kept for old bookmarks. Onboarding is the single setup flow. */
export default function StartPageRedirect() {
  redirect('/onboarding')
}
