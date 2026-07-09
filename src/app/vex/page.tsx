import { redirect } from 'next/navigation'

/**
 * Legacy standalone VEX route.
 *
 * Paid/ad copy work now belongs in the paid campaign planning flow, where
 * costs, permissions, platform boundaries, and review states are explicit.
 */
export default function VexPage() {
  redirect('/paid-campaigns/new')
}
