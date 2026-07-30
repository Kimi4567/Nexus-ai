import { notFound } from 'next/navigation'
import PublicLeadFormClient, { type PublicFormConfig } from './PublicLeadFormClient'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested } from '@/lib/leadCrmReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ publicId: string }>
}

export default async function PublicLeadFormPage({ params }: PageProps) {
  if (!isLeadCrmRequested() || !(await getLeadCrmDatabaseReadiness()).ready) {
    return (
      <main dir="ltr" className="grid min-h-screen place-items-center bg-[#F6F8FC] px-5">
        <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-black text-slate-900">Form temporarily unavailable</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Lead capture is temporarily unavailable. Please try again later.
          </p>
        </section>
      </main>
    )
  }

  const { publicId } = await params
  const form = await prisma.leadCaptureForm.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      title: true,
      description: true,
      consentStatement: true,
      status: true,
    },
  })

  if (!form || form.status !== 'ACTIVE') notFound()

  const config: PublicFormConfig = {
    publicId: form.publicId,
    title: form.title,
    description: form.description,
    consentStatement: form.consentStatement,
  }

  return <PublicLeadFormClient publicId={publicId} config={config} />
}
