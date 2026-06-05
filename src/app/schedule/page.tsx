/**
 * /schedule → redirects to /calendar?tab=queue
 * The Schedule page has been merged into Calendar (Published Queue tab).
 */
import { redirect } from 'next/navigation'

export default function ScheduleRedirect() {
  redirect('/calendar?tab=queue')
}
