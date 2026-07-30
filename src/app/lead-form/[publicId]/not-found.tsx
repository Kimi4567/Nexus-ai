import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function PublicLeadFormNotFound() {
  return (
    <main dir="ltr" className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#EEF1FF_0%,#F7F8FC_45%,#FFFFFF_100%)] px-5">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-8 text-center shadow-[0_30px_80px_-40px_rgba(31,42,99,0.45)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldX className="h-6 w-6" />
        </span>
        <p className="mt-5 font-mono text-xs font-black tracking-[0.18em] text-[#101A4D]">NEXUS</p>
        <h1 className="mt-3 text-2xl font-black text-[#0B1028]">This form is unavailable</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          The form may have been closed or the link is no longer active. No information was submitted.
        </p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#101A4D] px-5 text-sm font-black text-white">
          Back to NEXUS
        </Link>
      </section>
    </main>
  )
}
