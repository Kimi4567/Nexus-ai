import { redirect } from 'next/navigation'

/**
 * Campaign templates previously sent presets to /campaigns/new, but that legacy
 * route now consolidates into Strategy Studio and cannot preserve those presets.
 * Keep old bookmarks useful without presenting a non-functional duplicate flow.
 */
export default function TemplatesPageRedirect() {
  redirect('/strategy')
}
