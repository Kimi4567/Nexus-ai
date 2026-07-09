import { redirect } from 'next/navigation'

/**
 * Legacy bootstrap route.
 *
 * This route used to run owner/credit setup as soon as the page opened. That is
 * unsafe for a production SaaS surface because a browser visit must never grant
 * credits, change roles, or mutate account data implicitly.
 */
export default function BootstrapPage() {
  redirect('/dashboard')
}
