import { redirect } from 'next/navigation'

/**
 * Keep one campaign-creation contract. The previous wizard charged and promised
 * different deliverables from Strategy Studio, which made the same product look
 * like two unrelated systems. Existing links remain valid through this redirect.
 * The unified flow lets users create a content plan for review before any scheduling or publishing.
 * Paid inputs and approvals remain required before paid execution.
 * عربي: تُراجع خطة المحتوى قبل أي جدولة أو نشر.
 */
export default function NewCampaignPage() {
  // Preserve the public route contract while opening the one canonical
  // strategy-order flow. A plain /strategy redirect looked like a broken New
  // Campaign button because it landed on the existing portfolio with no form.
  redirect('/strategy?request=new')
}
