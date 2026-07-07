'use client'

/**
 * Creative Brief Page — /campaigns/[id]/creative-brief
 *
 * Sprint F — Creative Direction
 *
 * Two modes:
 * 1. Uploaded asset review — real assets can be analyzed into a review-only brief
 * 2. Concept direction — AI drafts visual direction notes and production planning
 *
 * Opened in a new tab from the Campaign Visuals tab.
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getCreditActionTruth } from '@/lib/creditActionTruth'
import { useI18n } from '@/lib/i18n-context'
import { useBillingStatus } from '@/lib/useBillingStatus'
import {
  applyCreativeStudioDraftControls,
  buildCreativeStudioPreviewModel,
  defaultCreativeStudioDraftControls,
  type CreativeStudioDraftControls,
  type CreativeStudioDraftLayout,
  type CreativeStudioPreviewModel,
} from '@/lib/creativeStudioPreview'
import UpgradeModal from '@/components/UpgradeModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string
  fileName: string
  url: string
  type: string
  width?: number
  height?: number
  size: number
}

interface AssetAnalysis {
  mediaId: string
  fileName: string
  url: string
  type: string
  brandAlignment: string
  contentType: string
  suggestedUse: string[]
  qualityNotes: string
  campaignFit: string
  adCopyHook: string
  captionSuggestion: string
}

interface StoryboardScene {
  sceneNumber: number
  description: string
  visualNotes: string
  textOverlay: string
  duration: string
  platform: string
}

interface ImagePrompt {
  platform: string
  style: string
  prompt: string
  aspectRatio: string
  notes: string
}

interface CreativeBrief {
  mode: 'asset' | 'concept'
  generatedAt: string
  // Asset
  assetAnalyses?: AssetAnalysis[]
  overallCreativeDirection?: string
  adCopyVariants?: string[]
  captionFormulas?: string[]
  topAssetsForCampaign?: string[]
  assetBasedScripts?: string[]
  // Concept
  imagePrompts?: ImagePrompt[]
  storyboardScenes?: StoryboardScene[]
  productionBrief?: string
  moodDescription?: string
  colorDirections?: string[]
  platformLayouts?: Record<string, string>
  creativeNotes?: string
}

interface Campaign {
  id: string
  name: string
  goal?: string
  audience?: string
  platforms: string[]
  aiOutput?: any
}

interface ContentPlanPost {
  id: string
  platform?: string | null
  caption?: string | null
  hook?: string | null
  cta?: string | null
  contentType?: string | null
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
  contentPlanIndex?: number | null
  status?: string | null
}

// ─── Utility Components ───────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { locale } = useI18n()
  const isArabic = locale === 'ar'
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={btnStyle(copied)}
    >
      {copied ? (isArabic ? '✓ تم النسخ' : '✓ Copied') : (isArabic ? 'نسخ' : 'Copy')}
    </button>
  )
}

function CopyAllButton({ texts, label = 'Copy All' }: { texts: string[]; label?: string }) {
  const [copied, setCopied] = useState(false)
  const { locale } = useI18n()
  const isArabic = locale === 'ar'
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(texts.join('\n\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ ...btnStyle(copied), background: copied ? '#22C55E' : '#6366F1', color: '#fff' }}
    >
      {copied ? (isArabic ? '✓ تم نسخ الكل' : '✓ Copied All') : (label === 'Copy All' && isArabic ? 'نسخ الكل' : label)}
    </button>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
    fontWeight: 600, transition: 'all 0.15s', flexShrink: 0, whiteSpace: 'nowrap',
    background: active ? '#22C55E' : '#F0F0F0', color: active ? '#fff' : '#444',
  }
}

function Tag({ label, color = '#6366F1' }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}40`,
      color, background: `${color}15`, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function SectionCard({ title, icon, children, accent = '#6366F1' }: {
  title: string; icon: string; children: React.ReactNode; accent?: string
}) {
  return (
    <div style={{ background: '#fff', border: `1px solid #E5E7EB`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{title}</h3>
        <div style={{ flex: 1, height: 2, background: `${accent}30`, borderRadius: 2, marginLeft: 8 }} />
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function SafetyNote({ title, body, accent = '#6366F1' }: { title: string; body: string; accent?: string }) {
  return (
    <div style={{
      border: `1px solid ${accent}24`,
      background: `${accent}0D`,
      borderRadius: 14,
      padding: '12px 14px',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: accent }}>{title}</p>
      <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#6366F1',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreativeBriefPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const { creditsRemaining, isUnlimited, loading: billingLoading } = useBillingStatus()
  const isArabic = locale === 'ar'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [contentPosts, setContentPosts] = useState<ContentPlanPost[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set())
  const [creativeBrief, setCreativeBrief] = useState<CreativeBrief | null>(null)
  const [mode, setMode] = useState<'asset' | 'concept'>('asset')
  const [selectedStudioPostId, setSelectedStudioPostId] = useState<string | null>(null)
  const [studioDraftControlsByPostId, setStudioDraftControlsByPostId] = useState<Record<string, CreativeStudioDraftControls>>({})
  const [confirmedReviewOnly, setConfirmedReviewOnly] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [refreshingAssets, setRefreshingAssets] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const creativeBriefTruth = getCreditActionTruth({
    action: 'CREATIVE_BRIEF',
    creditsRemaining,
    isUnlimited,
  })
  const creativeBriefLocked = !billingLoading && !creativeBriefTruth.canAfford
  const creditLabel = isArabic
    ? `${creativeBriefTruth.cost} كريديت`
    : `${creativeBriefTruth.cost} credit${creativeBriefTruth.cost === 1 ? '' : 's'}`
  const addCreditsLabel = isArabic
    ? 'أضف رصيدًا لإنشاء موجز إبداعي.'
    : 'Add credits to create a creative brief.'
  const copy = {
    title: isArabic ? 'مخطط الإبداع' : 'Creative brief planner',
    badge: isArabic ? 'تخطيط ومراجعة فقط' : 'Planning and review only',
    subtitle: isArabic
      ? 'حوّل الاستراتيجية إلى متطلبات أصول واتجاه بصري واضح قبل أي توليد صورة أو إرفاق ميديا أو نشر.'
      : 'Turn the strategy into asset requirements and visual direction before any image generation, media attachment, or publishing.',
    print: isArabic ? 'طباعة الموجز' : 'Print brief',
    back: isArabic ? 'العودة إلى الإبداع' : 'Back to Creative',
    noStrategy: isArabic
      ? 'لم نجد استراتيجية للحملة. راجع أو أنشئ الاستراتيجية أولًا حتى يعتمد الموجز الإبداعي على رسالة واضحة وجمهور ومنصات محددة.'
      : 'No campaign strategy found. Review or create the strategy first so the creative brief uses clear messaging, audience, and platform context.',
    currentStep: isArabic ? 'الخطوة الحالية' : 'Current step',
    currentStepBody: isArabic
      ? 'تحديد متطلبات الأصول والاتجاه الإبداعي من الاستراتيجية.'
      : 'Define asset requirements and creative direction from the strategy.',
    commandSummaryTitle: isArabic ? 'ملخص غرفة القرار الإبداعي' : 'Creative command summary',
    commandSummaryBody: isArabic
      ? 'لقطة تشغيلية لما تحتاجه الحملة الآن قبل أي توليد أو ربط وسائط.'
      : 'An operating snapshot of what this campaign needs before any generation or media attachment.',
    commandPosts: isArabic ? 'منشورات في الخطة' : 'posts in plan',
    commandReadyMedia: isArabic ? 'جاهزة بصريًا للمراجعة' : 'visually ready for review',
    commandNeedDecision: isArabic ? 'تحتاج قرار وسائط' : 'need media decision',
    commandStudioCandidate: isArabic ? 'منشور المعاينة الحالي' : 'current studio candidate',
    commandNoCandidate: isArabic ? 'بانتظار منشورات Content Hub' : 'waiting for Content Hub posts',
    commandRecommendedMove: isArabic ? 'أفضل خطوة الآن' : 'best move now',
    costTitle: isArabic ? 'تكلفة الإجراء' : 'Action cost',
    costBody: isArabic
      ? `إنشاء أو تحليل الموجز يستهلك ${creditLabel}.`
      : `Creating or analyzing the brief costs ${creditLabel}.`,
    boundaryTitle: isArabic ? 'حدود الصفحة' : 'Page boundary',
    boundaryBody: isArabic
      ? 'هذه الصفحة لا تنشر، لا تجدول، لا ترفق ميديا في المنشورات، ولا تنتج أصلًا جاهزًا للنشر.'
      : 'This page does not publish, schedule, attach post media, or create finished ad assets.',
    contentHubTitle: isArabic ? 'مصدر الحقيقة النهائي' : 'Final media source of truth',
    contentHubBody: isArabic
      ? 'مركز المحتوى هو مكان معاينة المنشورات النهائية وإرفاق الميديا لاحقًا بتأكيد صريح.'
      : 'Content Hub remains the place to preview final posts and attach media later with explicit confirmation.',
    modeLabel: isArabic ? 'اختر طريقة التخطيط الإبداعي:' : 'Choose creative planning mode:',
    assetModeTitle: isArabic ? 'مراجعة أصول العميل' : 'Review uploaded assets',
    assetModeDesc: isArabic
      ? 'حلّل صور/فيديو/شعار حقيقي لإخراج اتجاهات ونسخ للمراجعة.'
      : 'Analyze real photos, videos, or logos into review-ready direction and copy ideas.',
    conceptModeTitle: isArabic ? 'اتجاه مفاهيمي' : 'Concept direction',
    conceptModeDesc: isArabic
      ? 'أنشئ اتجاهًا بصريًا وملاحظات إنتاج بدون توليد صورة نهائية.'
      : 'Create visual direction and production notes without generating final imagery.',
    requirementsTitle: isArabic ? 'متطلبات الأصول من الاستراتيجية' : 'Strategy asset requirements',
    requirementsIntro: isArabic
      ? 'هذه الأصول مطلوبة قبل التنفيذ. ارفعها في مكتبة الوسائط، ثم ارجع هنا لتحليلها كموجز مراجعة.'
      : 'These are the assets the strategy requires before execution. Upload them in Media Library, then return here for review-only analysis.',
    mustHave: isArabic ? 'ضروري' : 'Must have',
    niceToHave: isArabic ? 'مفيد' : 'Nice to have',
    forPaid: isArabic ? 'للإعلانات المدفوعة' : 'For paid ads',
    forOrganic: isArabic ? 'للمحتوى العضوي' : 'For organic',
    proof: isArabic ? 'إثبات ومصداقية' : 'Proof',
    shootNext: isArabic ? 'يتم تصويره لاحقًا' : 'Shoot next',
    uploadAssets: isArabic ? 'افتح مكتبة الوسائط' : 'Open Media Library',
    refreshAssets: isArabic ? 'تحديث قائمة الأصول' : 'Refresh asset list',
    refreshingAssets: isArabic ? 'جاري التحديث...' : 'Refreshing...',
    assetIntakeTitle: isArabic ? 'مسار إدخال الأصول' : 'Asset intake path',
    assetIntakeBody: isArabic
      ? 'استخدم هذا المسار عندما تحتاج صورًا أو فيديوهات أو شعارًا حقيقيًا قبل إنشاء موجز إبداعي. رفع الأصل لا يرفقه بالمنشورات ولا يستهلك كريديت.'
      : 'Use this path when the brief needs real photos, videos, or logos before creative planning. Uploading an asset does not attach it to posts or spend credits.',
    assetIntakeUploadStep: isArabic ? 'ارفع الأصل في مكتبة الوسائط' : 'Upload the asset in Media Library',
    assetIntakeReturnStep: isArabic ? 'ارجع هنا وحدّث القائمة' : 'Return here and refresh the list',
    assetIntakeSelectStep: isArabic ? 'اختر الأصل ثم أكّد الموجز' : 'Select the asset, then confirm the brief',
    mediaLibraryBoundary: isArabic
      ? 'مكتبة الوسائط تخزن أصول العمل فقط. الربط النهائي بمنشور يتم لاحقًا من Content Hub بتأكيد منفصل.'
      : 'Media Library stores workspace assets only. Final attachment to a post happens later from Content Hub with separate confirmation.',
    productionDeskTitle: isArabic ? 'لوحة إنتاج المنشورات' : 'Post production desk',
    productionDeskSubtitle: isArabic
      ? 'ترجمة عملية للاستراتيجية إلى احتياجات إنتاج لكل منشور. هذه اللوحة لا تولد، لا ترفع، لا ترفق، ولا تنشر أي شيء.'
      : 'A practical translation of the strategy into production needs for each post. This desk does not generate, upload, attach, or publish anything.',
    productionDeskEmptyTitle: isArabic ? 'بانتظار منشورات Content Hub' : 'Waiting for Content Hub posts',
    productionDeskEmptyBody: isArabic
      ? 'تظهر لوحة الإنتاج بعد وجود منشورات فعلية في Content Hub، حتى تكون قرارات الأصول مرتبطة بمنشورات حقيقية وليست افتراضات عامة.'
      : 'The production desk appears after real Content Hub posts exist, so asset decisions stay tied to actual posts instead of generic assumptions.',
    productionDeskBoundary: isArabic
      ? 'الربط النهائي للوسائط يحدث لاحقًا من Content Hub بتأكيد منفصل لكل منشور. هذه اللوحة للقراءة والتخطيط فقط.'
      : 'Final media attachment happens later from Content Hub with a separate confirmation per post. This desk is read-only planning only.',
    productionDeskStatsPosts: isArabic ? 'منشورات في الخطة' : 'posts in plan',
    productionDeskStatsNeedMedia: isArabic ? 'تحتاج قرار وسائط' : 'need media decision',
    productionDeskStatsAssets: isArabic ? 'أصول مرفوعة متاحة' : 'uploaded assets available',
    productionDeskPost: isArabic ? 'منشور' : 'Post',
    productionDeskPlatform: isArabic ? 'المنصة' : 'Platform',
    productionDeskFormat: isArabic ? 'الشكل' : 'Format',
    productionDeskMediaStatus: isArabic ? 'حالة الوسائط' : 'Media status',
    productionDeskAssetNeed: isArabic ? 'احتياج الأصل' : 'Asset need',
    productionDeskLayerPlan: isArabic ? 'خطة الطبقات' : 'Layer plan',
    productionDeskNextStep: isArabic ? 'الخطوة التالية' : 'Next step',
    productionDeskLinkedMedia: isArabic ? 'وسائط مرتبطة بالفعل في Content Hub' : 'Media already linked in Content Hub',
    productionDeskNeedsUpload: isArabic ? 'يحتاج رفع أصل قبل المراجعة' : 'Needs asset upload before review',
    productionDeskNeedsSelection: isArabic ? 'اختر أصلًا مرفوعًا لتحليل الموجز' : 'Select an uploaded asset for brief analysis',
    productionDeskReadyForReview: isArabic ? 'جاهز لمراجعة الأصل في الموجز' : 'Ready for asset review in the brief',
    productionDeskReviewLinked: isArabic ? 'راجع الوسائط المرتبطة في Content Hub' : 'Review linked media in Content Hub',
    productionDeskUploadNext: isArabic ? 'ارفع الأصل المطلوب في مكتبة الوسائط' : 'Upload the required asset in Media Library',
    productionDeskSelectNext: isArabic ? 'اختر الأصل هنا ثم أكد موجز المراجعة' : 'Select the asset here, then confirm the review brief',
    productionDeskAttachLater: isArabic ? 'بعد المراجعة، اربط الوسائط النهائية من Content Hub فقط' : 'After review, attach final media from Content Hub only',
    productionDeskHeadlineLayer: isArabic ? 'Headline قابل للتعديل من نص المنشور' : 'Editable headline layer from post copy',
    productionDeskCtaLayer: isArabic ? 'CTA قابل للتعديل من هدف المنشور' : 'Editable CTA layer from post goal',
    productionDeskLogoLayer: isArabic ? 'Logo أو اسم البراند داخل safe zone' : 'Logo or brand-name layer inside safe zone',
    productionDeskSafeZone: isArabic ? 'تترك مساحة آمنة للنص والشعار' : 'Keep safe zones for text and logo',
    productionDeskDefaultAsset: isArabic ? 'صورة/فيديو داعم من متطلبات الاستراتيجية' : 'Supporting image/video from strategy requirements',
    productionDeskNoCaption: isArabic ? 'نص المنشور غير متوفر بعد' : 'Post copy not available yet',
    studioTitle: isArabic ? 'معاينة Creative Studio للمنشور' : 'Creative Studio post preview',
    studioBadge: isArabic ? 'مسودة طبقات للمراجعة' : 'Draft layered preview',
    studioSubtitle: isArabic
      ? 'اختر منشورًا لترى كيف تتحول الخلفية، النص، CTA، والهوية إلى مسودة تركيب قابلة للمراجعة. هذه ليست مادة نهائية ولا يتم حفظها أو رفعها أو ربطها تلقائيًا.'
      : 'Select a post to see how the background, headline, CTA, and brand layer become a reviewable composition draft. This is not final creative and is not saved, uploaded, or attached automatically.',
    studioEmptyTitle: isArabic ? 'بانتظار منشور قابل للمعاينة' : 'Waiting for a post to preview',
    studioEmptyBody: isArabic
      ? 'تظهر معاينة Creative Studio بعد وجود منشورات Content Hub حتى تكون الطبقات مرتبطة بمنشور حقيقي.'
      : 'The Creative Studio preview appears after Content Hub posts exist so layers stay tied to a real post.',
    studioSelectPost: isArabic ? 'اختر منشورًا' : 'Select post',
    studioCanvas: isArabic ? 'معاينة التركيب' : 'Composition preview',
    studioLayerInventory: isArabic ? 'الطبقات القابلة للمراجعة' : 'Reviewable layers',
    studioQuality: isArabic ? 'فحص الجودة' : 'Quality checks',
    studioPath: isArabic ? 'مسار التنفيذ المقفول' : 'Controlled execution path',
    studioDecisionTitle: isArabic ? 'قرار التصميم' : 'Creative decision',
    studioDecisionSubtitle: isArabic
      ? 'اقرأ الحكم التسويقي قبل تعديل الطبقات: ما الهدف، ما الرسالة، هل الخلفية والبراند جاهزان، وما الخطوة الصحيحة التالية؟'
      : 'Read the marketing/design decision before editing layers: objective, message hierarchy, readiness, and the correct next step.',
    studioDecisionObjective: isArabic ? 'هدف التصميم' : 'Design objective',
    studioDecisionAudience: isArabic ? 'لحظة الجمهور' : 'Audience moment',
    studioDecisionPlatform: isArabic ? 'ملاءمة المنصة' : 'Platform fit',
    studioDecisionHierarchy: isArabic ? 'ترتيب الرسالة' : 'Message hierarchy',
    studioDecisionReadiness: isArabic ? 'جاهزية المراجعة' : 'Review readiness',
    studioDecisionNextAction: isArabic ? 'الخطوة الصحيحة التالية' : 'Correct next action',
    studioDecisionQualitySignals: isArabic ? 'إشارات الجودة' : 'Quality signals',
    studioDecisionScore: isArabic ? 'درجة' : 'score',
    studioDecisionNoBlockers: isArabic ? 'لا توجد عوائق حرجة داخل هذه المعاينة.' : 'No critical blockers inside this preview.',
    studioBackgroundReady: isArabic ? 'الخلفية متاحة للمعاينة' : 'Background available for preview',
    studioBackgroundNeeded: isArabic ? 'الخلفية مطلوبة قبل أي render مستقبلي' : 'Background needed before future render',
    studioPreviewOnly: isArabic ? 'معاينة مؤقتة فقط' : 'Transient preview only',
    studioPreviewOnlyBody: isArabic
      ? 'SVG مؤقت داخل الصفحة: لا يتم رفعه، لا يتم حفظه كأصل، ولا يغير SocialPost.'
      : 'Transient SVG in the page: not uploaded, not saved as an asset, and does not change the SocialPost.',
    studioNotFinal: isArabic ? 'ليست مادة إعلانية نهائية' : 'Not final ad creative',
    studioNotFinalBody: isArabic
      ? 'النتيجة هنا تساعد على مراجعة الطبقات قبل أي توليد/تركيب/ربط لاحق بتأكيد صريح.'
      : 'This view helps review layers before any later generation, composition, or attachment with explicit confirmation.',
    studioNoActions: isArabic ? 'لا توجد أزرار تنفيذ هنا' : 'No execution actions here',
    studioNoActionsBody: isArabic
      ? 'لا توليد، لا render، لا upload، لا attach، لا publish، ولا schedule من هذه المعاينة.'
      : 'No generation, render, upload, attach, publish, or schedule happens from this preview.',
    studioFinalAttach: isArabic ? 'الربط النهائي من Content Hub فقط' : 'Final attachment from Content Hub only',
    studioFinalAttachBody: isArabic
      ? 'بعد اكتمال المسار لاحقًا، يظل ربط الوسائط بمنشور SocialPost قرارًا منفصلًا من Content Hub.'
      : 'When this path is completed later, attaching media to a SocialPost remains a separate Content Hub decision.',
    studioRequiredPassed: isArabic ? 'فحوص مطلوبة ناجحة' : 'required checks passed',
    studioRequiredFailed: isArabic ? 'فحوص مطلوبة تحتاج مراجعة' : 'required checks need review',
    studioRecommendedFailed: isArabic ? 'تحسينات مقترحة' : 'recommended improvements',
    studioNoTextLayer: isArabic ? 'طبقة بدون نص قابل للعرض' : 'Layer has no display text',
    studioSafe: isArabic ? 'داخل safe zone' : 'inside safe zone',
    studioNeedsReview: isArabic ? 'تحتاج مراجعة safe zone' : 'needs safe-zone review',
    studioStepAvailable: isArabic ? 'متاح الآن' : 'available now',
    studioStepLocked: isArabic ? 'مقفول حتى اكتمال الخلفية' : 'locked until background exists',
    studioStepFuture: isArabic ? 'مستقبلي بتأكيد صريح' : 'future explicit confirmation',
    studioDraftControlsTitle: isArabic ? 'تحكم محلي في المسودة' : 'Local draft controls',
    studioDraftControlsBody: isArabic
      ? 'عدّل النص، CTA، اسم البراند، اللون، وتوازن التخطيط داخل هذه المعاينة فقط. لا يتم حفظ التعديلات، لا يتم رفعها، ولا تغيّر المنشور.'
      : 'Adjust headline, CTA, brand label, accent color, and layout balance inside this preview only. Edits are not saved, uploaded, or applied to the post.',
    studioDraftUnsaved: isArabic ? 'غير محفوظ' : 'Not saved',
    studioHeadlineControl: isArabic ? 'Headline' : 'Headline',
    studioCtaControl: isArabic ? 'CTA' : 'CTA',
    studioBrandControl: isArabic ? 'اسم البراند / الشعار النصي' : 'Brand label',
    studioAccentControl: isArabic ? 'لون التمييز' : 'Accent color',
    studioLayoutControl: isArabic ? 'توازن التخطيط' : 'Layout balance',
    studioLayoutBalanced: isArabic ? 'متوازن' : 'Balanced',
    studioLayoutEditorial: isArabic ? 'تحريري' : 'Editorial',
    studioLayoutCtaFocus: isArabic ? 'تركيز CTA' : 'CTA focus',
    studioResetDraft: isArabic ? 'إعادة المسودة الأصلية' : 'Reset local draft',
    studioDraftBoundary: isArabic
      ? 'هذه أدوات تحرير مؤقتة داخل المتصفح فقط. لا توجد أزرار حفظ، render، upload، attach، نشر، أو جدولة.'
      : 'These are temporary in-browser edit controls only. There are no save, render, upload, attach, publish, or schedule actions here.',
    imageSingular: isArabic ? 'صورة' : 'image',
    imagePlural: isArabic ? 'صور' : 'images',
    videoSingular: isArabic ? 'فيديو' : 'video',
    videoPlural: isArabic ? 'فيديوهات' : 'videos',
    noMediaTitle: isArabic ? 'لا توجد أصول في مساحة العمل بعد' : 'No assets in this workspace yet',
    noMediaBody: isArabic
      ? 'ارفع صورًا أو فيديوهات أو شعارًا في مكتبة الوسائط، ثم عد هنا لتحويلها إلى موجز إبداعي للمراجعة.'
      : 'Upload photos, videos, or a logo in Media Library, then return here to turn them into a review-only creative brief.',
    guidance: isArabic ? 'إرشاد الأصول من الاستراتيجية' : 'Strategy asset guidance',
    selectAssets: isArabic ? 'اختر الأصول للتحليل' : 'Select assets to analyze',
    inWorkspace: isArabic ? 'في مساحة العمل' : 'in workspace',
    selected: isArabic ? 'محدد' : 'selected',
    selectAll: isArabic ? 'تحديد الكل' : 'Select all',
    deselectAll: isArabic ? 'إلغاء التحديد' : 'Deselect all',
    selectHint: isArabic ? 'اختر أصلًا واحدًا على الأقل للتحليل.' : 'Select at least one asset to analyze.',
    videoNote: isArabic
      ? 'تحليل الفيديو التفصيلي قادم لاحقًا. حاليًا يتم تضمين الفيديو كملاحظة مراجعة يدوية.'
      : 'Detailed frame-level video analysis is coming later. Videos are included with a manual review note for now.',
    confirmTitle: isArabic ? 'تأكيد قبل استهلاك الرصيد' : 'Confirm before spending credits',
    confirmBody: isArabic
      ? `أفهم أن هذا ينشئ موجزًا إبداعيًا للمراجعة فقط ويستهلك ${creditLabel}. لن يولد صورة نهائية، ولن يرفق ميديا، ولن ينشر أو يجدول أو يحدّث Brand Brain كتعلّم أداء.`
      : `I understand this creates a review-only creative brief and costs ${creditLabel}. It will not generate a final image, attach media, publish, schedule, or update Brand Brain as performance learning.`,
    confirmRequired: isArabic ? 'أكد أن هذا موجز مراجعة فقط للمتابعة.' : 'Confirm this is a review-only brief to continue.',
    analyzeButton: isArabic ? 'تحليل الأصول المختارة' : 'Analyze selected assets',
    conceptButton: isArabic ? 'إنشاء موجز اتجاه إبداعي' : 'Create creative direction brief',
    lastGenerated: isArabic ? 'آخر إنشاء' : 'Last generated',
    regenerate: isArabic ? 'إعادة إنشاء' : 'Regenerate',
    addCredits: isArabic ? 'أضف رصيدًا للإعادة' : 'Add credits to regenerate',
    analyzingTitle: isArabic ? 'يتم تحليل الأصول...' : 'Analyzing assets...',
    conceptTitle: isArabic ? 'يتم إنشاء موجز الاتجاه...' : 'Creating creative direction brief...',
    analyzingBody: isArabic
      ? 'يحلل NEXUS الأصول المختارة لإنتاج ملاحظات واتجاهات مراجعة. قد يستغرق ذلك 30-60 ثانية.'
      : 'NEXUS analyzes the selected assets into review notes and direction. This may take 30-60 seconds.',
    conceptBody: isArabic
      ? 'ينشئ NEXUS موجز اتجاه بصري وملاحظات إنتاج للمراجعة فقط. لا يتم إنشاء صورة نهائية.'
      : 'NEXUS creates a review-only visual direction brief and production notes. No final image is created.',
    emptyAssetTitle: isArabic ? 'جاهز لتحليل الأصول' : 'Ready to analyze assets',
    waitingForAssetsTitle: isArabic ? 'بانتظار رفع الأصول' : 'Waiting for uploaded assets',
    waitingForAssetsBody: isArabic
      ? 'ارفع أصلًا واحدًا على الأقل في مكتبة الوسائط قبل تحليل الأصول. لن يستهلك NEXUS رصيدًا حتى تختار أصلًا وتؤكد الإجراء.'
      : 'Upload at least one asset in Media Library before asset analysis. NEXUS will not spend credits until an asset is selected and the action is confirmed.',
    waitingForSelectionTitle: isArabic ? 'بانتظار اختيار أصل' : 'Waiting for asset selection',
    waitingForSelectionBody: isArabic
      ? 'اختر أصلًا واحدًا على الأقل من القائمة أعلاه قبل التحليل. الزر سيبقى مقفولًا حتى يتم الاختيار والتأكيد.'
      : 'Select at least one asset from the list above before analysis. The action stays locked until selection and confirmation are complete.',
    emptyConceptTitle: isArabic ? 'جاهز لإنشاء اتجاه إبداعي' : 'Ready to create creative direction',
    emptyAssetBody: isArabic
      ? 'اختر الأصول أعلاه ثم أكد الإجراء. سيُخرج NEXUS اتجاهات ونسخًا ومسودات نصية للمراجعة قبل التنفيذ.'
      : 'Select assets above, then confirm the action. NEXUS will produce direction, copy ideas, and draft scripts for review before execution.',
    emptyConceptBody: isArabic
      ? 'أكد الإجراء لإنشاء موجز اتجاه بصري: أفكار صور، ستوريبورد، وملاحظات إنتاج. النتيجة ليست إعلانًا نهائيًا.'
      : 'Confirm the action to create visual direction: image ideas, storyboard, and production notes. The output is not a finished ad asset.',
    overallDirection: isArabic ? 'الاتجاه الإبداعي العام' : 'Overall Creative Direction',
    topAssets: isArabic ? 'أفضل الأصول لهذه الحملة' : 'Top Assets for This Campaign',
    assetAnalyses: isArabic ? 'تحليل الأصول' : 'Asset Analyses',
    brandAlignment: isArabic ? 'توافق البراند' : 'Brand Alignment',
    campaignFit: isArabic ? 'ملاءمة الحملة' : 'Campaign Fit',
    qualityNotes: isArabic ? 'ملاحظات الجودة' : 'Quality Notes',
    suggestedUse: isArabic ? 'استخدام مقترح' : 'Suggested Use',
    adCopyHook: isArabic ? 'هوك نسخة إعلانية' : 'Ad Copy Hook',
    captionSuggestion: isArabic ? 'اقتراح كابشن' : 'Caption Suggestion',
    copyAllVariants: isArabic ? 'نسخ كل المسودات' : 'Copy All Drafts',
    captionFormulas: isArabic ? 'قوالب كابشن للمراجعة' : 'Caption Draft Formulas',
    captionFormulasBody: isArabic ? 'قوالب قابلة للتعديل، لا تنشر قبل مراجعة الإنسان.' : 'Editable formulas; do not publish before human review.',
    contentScripts: isArabic ? 'مسودات سكريبتات المحتوى' : 'Draft Content Scripts',
    contentScriptsBody: isArabic ? 'سكريبتات Reel / TikTok للمراجعة والإنتاج لاحقًا.' : 'Reel / TikTok scripts for review and later production.',
    copyAllScripts: isArabic ? 'نسخ كل السكريبتات' : 'Copy All Scripts',
    script: isArabic ? 'سكريبت' : 'Script',
    moodColor: isArabic ? 'المزاج البصري واتجاه الألوان' : 'Visual Mood & Color Direction',
    colorDirections: isArabic ? 'اتجاهات الألوان' : 'Color Directions',
    copyAllPrompts: isArabic ? 'نسخ كل الموجهات' : 'Copy All Prompts',
    storyboard: isArabic ? 'ستوريبورد للمراجعة' : 'Review Storyboard',
    storyboardBody: isArabic ? 'خطة مشاهد للمراجعة، وليست فيديو نهائيًا.' : 'Scene plan for review, not a final video.',
    visual: isArabic ? 'الصورة' : 'Visual',
    textOverlay: isArabic ? 'النص فوق المشهد' : 'Text overlay',
    platformLayouts: isArabic ? 'تخطيطات المنصات' : 'Platform Layouts',
    creativeNotes: isArabic ? 'ملاحظات المخرج الإبداعي' : 'Creative Director Notes',
    productionNote: isArabic ? 'ملاحظة إنتاج' : 'Production note',
    notIncluded: isArabic ? 'غير مشمول في هذه الخطة' : 'Not included in this plan',
    notEnoughData: isArabic ? 'لا توجد بيانات كافية بعد' : 'Not enough data yet',
  }

  // ── Data loading ──
  const loadData = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    try {
      const [campaignRes, mediaRes, briefRes, contentPlanRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } }),
        fetch(`/api/media?limit=50`, { headers: { Authorization: token } }),
        fetch(`/api/campaigns/${campaignId}/creative-brief`, { headers: { Authorization: token } }),
        fetch(`/api/campaigns/${campaignId}/content-plan`, { headers: { Authorization: token } }),
      ])
      const [cd, md, bd, pd] = await Promise.all([
        campaignRes.json(),
        mediaRes.json(),
        briefRes.json(),
        contentPlanRes.ok ? contentPlanRes.json() : Promise.resolve({ posts: [] }),
      ])
      if (cd.campaign) setCampaign(cd.campaign)
      if (Array.isArray(md.media)) setMediaItems(md.media)
      if (Array.isArray(pd.posts)) setContentPosts(pd.posts)
      if (bd.creativeBrief) {
        setCreativeBrief(bd.creativeBrief)
        setMode(bd.creativeMode || 'asset')
      }
    } catch {}
  }, [campaignId, authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    loadData().finally(() => setFetching(false))
  }, [loading, isAuthenticated, loadData, router])

  // ── Generate ──
  const handleGenerate = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    if (creativeBriefLocked) {
      setError(addCreditsLabel)
      router.push('/billing')
      return
    }
    // Guard: in asset mode, require at least one asset selected
    if (mode === 'asset' && mediaItems.length > 0 && selectedMedia.size === 0) {
      setError(copy.selectHint)
      return
    }
    if (!confirmedReviewOnly) {
      setError(copy.confirmRequired)
      return
    }
    setGenerating(true)
    setError('')
    try {
      const body: any = { mode }
      if (mode === 'asset' && selectedMedia.size > 0) {
        body.mediaIds = Array.from(selectedMedia)
      }
      const res = await fetch(`/api/campaigns/${campaignId}/creative-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (d.creativeBrief) {
        setCreativeBrief(d.creativeBrief)
        setConfirmedReviewOnly(false)
      } else if (d.error === 'INSUFFICIENT_CREDITS') {
        setShowUpgrade(true)
      } else {
        setError(d.error || 'Generation failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setGenerating(false)
    }
  }

  // ── Asset selection ──
  const toggleMedia = (id: string) => {
    setError('')
    setConfirmedReviewOnly(false)
    setSelectedMedia(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setError('')
    setConfirmedReviewOnly(false)
    if (selectedMedia.size === mediaItems.length) {
      setSelectedMedia(new Set())
    } else {
      setSelectedMedia(new Set(mediaItems.map(m => m.id)))
    }
  }

  const handleRefreshAssets = async () => {
    setError('')
    setRefreshingAssets(true)
    await loadData()
    setRefreshingAssets(false)
  }

  // ── Loading / empty states ──
  if (loading || fetching) return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <Spinner />
    </div>
  )

  if (!campaign) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F9FAFB' }}>
      <p style={{ color: '#9CA3AF' }}>Campaign not found.</p>
    </div>
  )

  const hasStrategy = !!(campaign.aiOutput?.strategy)
  const assetRequirements: any = campaign.aiOutput?.strategy?.assetRequirements || null
  const imageMedia = mediaItems.filter(m => m.type === 'IMAGE' || m.type === 'LOGO')
  const videoMedia = mediaItems.filter(m => m.type === 'VIDEO')
  const assetRequirementText = (item: string) => {
    const normalized = item.trim().toLowerCase()
    if (normalized === 'not included') return copy.notIncluded
    if (normalized === 'not enough data') return copy.notEnoughData
    return item
  }
  const assetNeedPool = [
    ...(assetRequirements?.mustHave ?? []),
    ...(assetRequirements?.forOrganic ?? []),
    ...(assetRequirements?.nextToCreate ?? []),
    ...(assetRequirements?.niceToHave ?? []),
  ].map((item: string) => assetRequirementText(String(item))).filter(Boolean)
  const productionRows = contentPosts
    .slice()
    .sort((a, b) => (a.contentPlanIndex ?? 999) - (b.contentPlanIndex ?? 999))
    .map((post, index) => {
      const hasLinkedMedia = Boolean(post.imageUrl || post.uploadedMediaId)
      const hasUploadedAssets = mediaItems.length > 0
      const assetNeed = hasLinkedMedia
        ? copy.productionDeskLinkedMedia
        : assetNeedPool[index % Math.max(assetNeedPool.length, 1)] || copy.productionDeskDefaultAsset
      const mediaStatus = hasLinkedMedia
        ? copy.productionDeskLinkedMedia
        : hasUploadedAssets
          ? copy.productionDeskNeedsSelection
          : copy.productionDeskNeedsUpload
      const nextStep = hasLinkedMedia
        ? copy.productionDeskReviewLinked
        : hasUploadedAssets
          ? copy.productionDeskSelectNext
          : copy.productionDeskUploadNext
      const copySource = post.hook || post.caption || copy.productionDeskNoCaption
      const shortCopy = String(copySource).replace(/\s+/g, ' ').slice(0, 130)
      return {
        id: post.id || `post-${index + 1}`,
        number: index + 1,
        platform: post.platform || campaign.platforms?.[index % Math.max(campaign.platforms.length, 1)] || 'General',
        format: post.contentType || (post.caption?.toLowerCase().includes('video') ? 'Video post' : 'Social post'),
        status: post.status,
        mediaStatus,
        assetNeed,
        nextStep,
        shortCopy,
        layerPlan: [
          copy.productionDeskHeadlineLayer,
          copy.productionDeskCtaLayer,
          copy.productionDeskLogoLayer,
          copy.productionDeskSafeZone,
        ],
      }
    })
  const productionRowsNeedingMedia = productionRows.filter(row => row.mediaStatus !== copy.productionDeskLinkedMedia).length
  const brandSnapshot = (campaign.aiOutput?.brandBrainSnapshot
    || campaign.aiOutput?.brandProfile
    || campaign.aiOutput?.brand
    || {}) as any
  const strategySnapshot = (campaign.aiOutput?.strategy || {}) as any
  const studioBrandName = brandSnapshot.brandName
    || brandSnapshot.name
    || strategySnapshot.brandName
    || strategySnapshot.brand
    || campaign.name
  const studioLogoUrl = brandSnapshot.logoUrl || strategySnapshot.logoUrl || null
  const studioColorPalette = brandSnapshot.colorPalette || strategySnapshot.colorPalette || strategySnapshot.brandColors || []
  const studioPreviewModels: CreativeStudioPreviewModel[] = contentPosts
    .slice()
    .sort((a, b) => (a.contentPlanIndex ?? 999) - (b.contentPlanIndex ?? 999))
    .map((post, index) => buildCreativeStudioPreviewModel({
      post: {
        id: post.id || `post-${index + 1}`,
        postNumber: index + 1,
        platform: post.platform || campaign.platforms?.[index % Math.max(campaign.platforms.length, 1)] || 'General',
        caption: post.caption,
        hook: post.hook,
        cta: post.cta,
        contentType: post.contentType,
        imageUrl: post.imageUrl,
        uploadedMediaId: post.uploadedMediaId,
        mediaSource: post.mediaSource,
        generationStatus: post.generationStatus,
        status: post.status,
      },
      campaign: {
        campaignName: campaign.name,
        campaignGoal: campaign.goal,
        campaignType: strategySnapshot.strategyMode || strategySnapshot.mode || strategySnapshot.type,
        language: campaign.aiOutput?.language || locale,
        brandName: studioBrandName,
        logoUrl: studioLogoUrl,
        colorPalette: studioColorPalette,
      },
    }))
  const baseSelectedStudioPreview = studioPreviewModels.find(model => model.postId === selectedStudioPostId)
    || studioPreviewModels[0]
    || null
  const selectedStudioDraftControls = baseSelectedStudioPreview
    ? {
        ...defaultCreativeStudioDraftControls(baseSelectedStudioPreview),
        ...(studioDraftControlsByPostId[baseSelectedStudioPreview.postId] || {}),
      }
    : null
  const selectedStudioPreview = baseSelectedStudioPreview && selectedStudioDraftControls
    ? applyCreativeStudioDraftControls(baseSelectedStudioPreview, selectedStudioDraftControls)
    : null
  const studioPreviewImageSrc = selectedStudioPreview
    ? `data:image/svg+xml;utf8,${encodeURIComponent(selectedStudioPreview.compositionPreview.artifact.svg)}`
    : ''
  const updateStudioDraftControls = (patch: Partial<CreativeStudioDraftControls>) => {
    if (!baseSelectedStudioPreview) return
    const defaults = defaultCreativeStudioDraftControls(baseSelectedStudioPreview)
    setStudioDraftControlsByPostId(prev => ({
      ...prev,
      [baseSelectedStudioPreview.postId]: {
        ...defaults,
        ...(prev[baseSelectedStudioPreview.postId] || {}),
        ...patch,
      },
    }))
  }
  const resetStudioDraftControls = () => {
    if (!baseSelectedStudioPreview) return
    setStudioDraftControlsByPostId(prev => {
      const next = { ...prev }
      delete next[baseSelectedStudioPreview.postId]
      return next
    })
  }
  const studioPathStateLabel = (state: CreativeStudioPreviewModel['controlledPath'][number]['state']) => {
    if (state === 'available_now') return copy.studioStepAvailable
    if (state === 'locked_until_background') return copy.studioStepLocked
    return copy.studioStepFuture
  }
  const assetActionUnavailable = mode === 'asset' && (mediaItems.length === 0 || selectedMedia.size === 0)
  const generationDisabled = assetActionUnavailable || !confirmedReviewOnly
  const emptyStateTitle = mode === 'asset'
    ? mediaItems.length === 0
      ? copy.waitingForAssetsTitle
      : selectedMedia.size === 0
        ? copy.waitingForSelectionTitle
        : copy.emptyAssetTitle
    : copy.emptyConceptTitle
  const emptyStateBody = mode === 'asset'
    ? mediaItems.length === 0
      ? copy.waitingForAssetsBody
      : selectedMedia.size === 0
        ? copy.waitingForSelectionBody
        : copy.emptyAssetBody
    : copy.emptyConceptBody
  return (
    <>
    <div dir={dir} style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── Global print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Header ── */}
      <div className="no-print" style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ fontSize: 20 }}>🎨</span>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>{copy.title}</h1>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#6366F115',
              color: '#6366F1', fontWeight: 700, border: '1px solid #6366F130',
            }}>{copy.badge}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>{campaign.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {copy.print}
          </button>
          <button
            onClick={() => router.push(`/campaigns/${campaign.id}?tab=creative#campaign-room-workspace`)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#F9FAFB', color: '#6B7280', fontSize: 13, cursor: 'pointer',
            }}
          >
            {copy.back}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 36px' }}>

        <div style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 24,
          padding: '22px',
          marginBottom: 22,
          boxShadow: '0 18px 45px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#6366F1', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {copy.badge}
              </p>
              <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.2, fontWeight: 850, color: '#0F172A' }}>
                {copy.title}
              </h2>
              <p style={{ margin: '10px 0 0', maxWidth: 720, fontSize: 14, lineHeight: 1.8, color: '#475569' }}>
                {copy.subtitle}
              </p>
            </div>
            <div style={{
              border: '1px solid #D7E3F0',
              borderRadius: 18,
              padding: '14px',
              background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 900, color: '#3730A3', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                    {copy.commandSummaryTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#475569' }}>
                    {copy.commandSummaryBody}
                  </p>
                </div>
                <span style={{
                  border: '1px solid #C7D2FE',
                  background: '#FFFFFF',
                  color: '#3730A3',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                }}>
                  {selectedStudioPreview
                    ? `${copy.productionDeskPost} #${selectedStudioPreview.postNumber}`
                    : copy.commandNoCandidate}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 9 }}>
                {[
                  { value: productionRows.length, label: copy.commandPosts, color: '#3730A3' },
                  { value: Math.max(productionRows.length - productionRowsNeedingMedia, 0), label: copy.commandReadyMedia, color: '#047857' },
                  { value: productionRowsNeedingMedia, label: copy.commandNeedDecision, color: '#B45309' },
                ].map(item => (
                  <div key={item.label} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '9px 10px', background: '#FFFFFF' }}>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 950, color: item.color, lineHeight: 1 }}>{item.value}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, lineHeight: 1.35, color: '#64748B', fontWeight: 850 }}>{item.label}</p>
                  </div>
                ))}
                <div style={{ border: '1px solid #D1FAE5', borderRadius: 12, padding: '9px 10px', background: '#F0FDF4' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                    {copy.commandRecommendedMove}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: '#065F46', fontWeight: 800 }}>
                    {selectedStudioPreview?.decisionBrief.nextBestAction || copy.commandNoCandidate}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <SafetyNote title={copy.currentStep} body={copy.currentStepBody} accent="#4F46E5" />
              <SafetyNote title={copy.costTitle} body={copy.costBody} accent="#B45309" />
              <SafetyNote title={copy.boundaryTitle} body={copy.boundaryBody} accent="#0F766E" />
              <SafetyNote title={copy.contentHubTitle} body={copy.contentHubBody} accent="#7C3AED" />
            </div>
          </div>
        </div>

        {/* ── Strategy Warning ── */}
        {!hasStrategy && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
            padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10,
          }}>
            <span>⚠️</span>
            <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
              {copy.noStrategy}
            </p>
          </div>
        )}

        {/* ── Mode Selector ── */}
        <div className="no-print" style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>{copy.modeLabel}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            {([
              {
                key: 'asset',
                icon: '🖼️',
                title: copy.assetModeTitle,
                desc: copy.assetModeDesc,
                color: '#6366F1',
              },
              {
                key: 'concept',
                icon: '🤖',
                title: copy.conceptModeTitle,
                desc: copy.conceptModeDesc,
                color: '#EC4899',
              },
            ] as const).map(m => (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setConfirmedReviewOnly(false); setError('') }}
                style={{
                  flex: 1, padding: '16px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${mode === m.key ? m.color : '#E5E7EB'}`,
                  background: mode === m.key ? `${m.color}08` : '#fff',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: mode === m.key ? m.color : '#111' }}>{m.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Asset Mode Controls ── */}
        {mode === 'asset' && !generating && (
          <div className="no-print">
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E0E7FF',
              borderRadius: 16,
              padding: '16px 18px',
              marginBottom: 18,
              boxShadow: '0 10px 30px rgba(79,70,229,0.06)',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 680 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#4338CA' }}>
                    {copy.assetIntakeTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: '#475569' }}>
                    {copy.assetIntakeBody}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href="/media"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 13px',
                      borderRadius: 10,
                      background: '#4F46E5',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    {copy.uploadAssets} ↗
                  </a>
                  <button
                    type="button"
                    onClick={handleRefreshAssets}
                    disabled={refreshingAssets}
                    style={{
                      padding: '8px 13px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      background: refreshingAssets ? '#F1F5F9' : '#FFFFFF',
                      color: '#334155',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: refreshingAssets ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {refreshingAssets ? copy.refreshingAssets : copy.refreshAssets}
                  </button>
                </div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                marginTop: 14,
              }}>
                {[copy.assetIntakeUploadStep, copy.assetIntakeReturnStep, copy.assetIntakeSelectStep].map((step, index) => (
                  <div key={step} style={{
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    borderRadius: 12,
                    padding: '10px 12px',
                    display: 'flex',
                    gap: 9,
                    alignItems: 'center',
                  }}>
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#EEF2FF',
                      color: '#4338CA',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontSize: 12, color: '#334155', fontWeight: 700, lineHeight: 1.45 }}>{step}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 11, lineHeight: 1.55, color: '#64748B' }}>
                {copy.mediaLibraryBoundary}
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 18,
              padding: '18px',
              marginBottom: 22,
              boxShadow: '0 14px 35px rgba(15,23,42,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ maxWidth: 700 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 900, color: '#0F766E', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    {copy.productionDeskTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: '#475569' }}>
                    {copy.productionDeskSubtitle}
                  </p>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(88px, 1fr))',
                  gap: 8,
                  minWidth: 260,
                }}>
                  {[
                    { value: productionRows.length, label: copy.productionDeskStatsPosts, color: '#0F766E' },
                    { value: productionRowsNeedingMedia, label: copy.productionDeskStatsNeedMedia, color: '#B45309' },
                    { value: mediaItems.length, label: copy.productionDeskStatsAssets, color: '#4F46E5' },
                  ].map(item => (
                    <div key={item.label} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '9px 10px', background: '#F8FAFC' }}>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, lineHeight: 1.35, color: '#64748B', fontWeight: 700 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {productionRows.length === 0 ? (
                <div style={{ border: '1px dashed #CBD5E1', borderRadius: 14, padding: '18px', background: '#F8FAFC' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
                    {copy.productionDeskEmptyTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: '#64748B' }}>
                    {copy.productionDeskEmptyBody}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                  {productionRows.map(row => (
                    <div key={row.id} style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 16,
                      background: '#FFFFFF',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'flex-start',
                      }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#0F172A' }}>
                            {copy.productionDeskPost} #{row.number}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748B', lineHeight: 1.45 }}>
                            {row.shortCopy}
                          </p>
                        </div>
                        <span style={{
                          border: '1px solid #C7D2FE',
                          background: '#EEF2FF',
                          color: '#4338CA',
                          borderRadius: 999,
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}>
                          {row.platform}
                        </span>
                      </div>
                      <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
                        {[
                          { label: copy.productionDeskFormat, value: row.format },
                          { label: copy.productionDeskMediaStatus, value: row.mediaStatus },
                          { label: copy.productionDeskAssetNeed, value: row.assetNeed },
                          { label: copy.productionDeskNextStep, value: row.nextStep },
                        ].map(item => (
                          <div key={item.label}>
                            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 900, color: '#94A3B8', letterSpacing: 0.35, textTransform: 'uppercase' }}>
                              {item.label}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#334155', fontWeight: 650 }}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                        <div>
                          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 900, color: '#94A3B8', letterSpacing: 0.35, textTransform: 'uppercase' }}>
                            {copy.productionDeskLayerPlan}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {row.layerPlan.map(layer => (
                              <span key={layer} style={{
                                border: '1px solid #D1FAE5',
                                background: '#ECFDF5',
                                color: '#047857',
                                borderRadius: 999,
                                padding: '4px 7px',
                                fontSize: 10,
                                fontWeight: 750,
                                lineHeight: 1.25,
                              }}>
                                {layer}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ margin: '14px 0 0', fontSize: 11, lineHeight: 1.6, color: '#64748B' }}>
                {copy.productionDeskBoundary}
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #D7E3F0',
              borderRadius: 20,
              padding: '18px',
              marginBottom: 22,
              boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ maxWidth: 720 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 900, color: '#312E81', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    {copy.studioBadge}
                  </p>
                  <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.25, fontWeight: 900, color: '#0F172A' }}>
                    {copy.studioTitle}
                  </h3>
                  <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.7, color: '#475569' }}>
                    {copy.studioSubtitle}
                  </p>
                </div>
                <div style={{
                  border: '1px solid #C7D2FE',
                  background: '#EEF2FF',
                  color: '#3730A3',
                  borderRadius: 999,
                  padding: '7px 11px',
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                }}>
                  {copy.studioPreviewOnly}
                </div>
              </div>

              {studioPreviewModels.length === 0 || !selectedStudioPreview ? (
                <div style={{ border: '1px dashed #CBD5E1', borderRadius: 16, padding: '18px', background: '#F8FAFC' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 850, color: '#334155' }}>
                    {copy.studioEmptyTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: '#64748B' }}>
                    {copy.studioEmptyBody}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                        {copy.studioSelectPost}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {studioPreviewModels.map(model => {
                          const active = model.postId === selectedStudioPreview.postId
                          return (
                            <button
                              key={model.postId}
                              type="button"
                              onClick={() => setSelectedStudioPostId(model.postId)}
                              style={{
                                border: active ? '1px solid #4F46E5' : '1px solid #CBD5E1',
                                background: active ? '#EEF2FF' : '#FFFFFF',
                                color: active ? '#3730A3' : '#334155',
                                borderRadius: 999,
                                padding: '7px 10px',
                                fontSize: 11,
                                fontWeight: 850,
                                cursor: 'pointer',
                              }}
                            >
                              {copy.productionDeskPost} #{model.postNumber}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{
                      border: '1px solid #E2E8F0',
                      background: '#0F172A',
                      borderRadius: 18,
                      padding: 12,
                      overflow: 'hidden',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioCanvas}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>
                            {selectedStudioPreview.platform} · {selectedStudioPreview.format} · {selectedStudioPreview.compositionPreview.canvas.aspectRatio}
                          </p>
                        </div>
                        <span style={{
                          border: '1px solid rgba(255,255,255,0.18)',
                          color: '#E0F2FE',
                          background: 'rgba(14,165,233,0.14)',
                          borderRadius: 999,
                          padding: '5px 9px',
                          fontSize: 10,
                          fontWeight: 850,
                        }}>
                          {selectedStudioPreview.backgroundStatus === 'background_available_for_preview'
                            ? copy.studioBackgroundReady
                            : copy.studioBackgroundNeeded}
                        </span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={studioPreviewImageSrc}
                        alt={copy.studioCanvas}
                        style={{
                          width: '100%',
                          display: 'block',
                          borderRadius: 12,
                          background: '#020617',
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 12, alignContent: 'start', minWidth: 0 }}>
                    <div style={{
                      border: '1px solid #BFD7EA',
                      borderRadius: 16,
                      padding: '14px',
                      background: 'linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 100%)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 900, color: '#0F766E', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioDecisionTitle}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#475569' }}>
                            {copy.studioDecisionSubtitle}
                          </p>
                        </div>
                        <div style={{
                          border: selectedStudioPreview.decisionBrief.readiness.status === 'review_ready' ? '1px solid #BBF7D0' : '1px solid #FED7AA',
                          background: selectedStudioPreview.decisionBrief.readiness.status === 'review_ready' ? '#F0FDF4' : '#FFF7ED',
                          color: selectedStudioPreview.decisionBrief.readiness.status === 'review_ready' ? '#15803D' : '#C2410C',
                          borderRadius: 12,
                          padding: '8px 10px',
                          minWidth: 118,
                          textAlign: 'center',
                        }}>
                          <p style={{ margin: 0, fontSize: 18, fontWeight: 950, lineHeight: 1 }}>
                            {selectedStudioPreview.decisionBrief.readiness.score}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                            {copy.studioDecisionScore}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {[
                          { label: copy.studioDecisionObjective, value: selectedStudioPreview.decisionBrief.creativeObjective },
                          { label: copy.studioDecisionAudience, value: selectedStudioPreview.decisionBrief.audienceMoment },
                          { label: copy.studioDecisionPlatform, value: selectedStudioPreview.decisionBrief.platformFit },
                        ].map(item => (
                          <div key={item.label} style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: 12,
                            padding: '9px 10px',
                            background: '#FFFFFF',
                          }}>
                            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                              {item.label}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#0F172A', fontWeight: 650 }}>
                              {item.value}
                            </p>
                          </div>
                        ))}

                        <div style={{
                          border: '1px solid #D1FAE5',
                          borderRadius: 12,
                          padding: '10px',
                          background: '#F0FDF4',
                        }}>
                          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 900, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioDecisionNextAction}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#065F46', fontWeight: 750 }}>
                            {selectedStudioPreview.decisionBrief.nextBestAction}
                          </p>
                        </div>

                        <div>
                          <p style={{ margin: '0 0 7px', fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioDecisionHierarchy}
                          </p>
                          <div style={{ display: 'grid', gap: 7 }}>
                            {selectedStudioPreview.decisionBrief.messageHierarchy.map(item => (
                              <div key={item.role} style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(92px, 128px) minmax(0, 1fr)',
                                gap: 8,
                                alignItems: 'start',
                                border: '1px solid #E2E8F0',
                                borderRadius: 12,
                                padding: '8px 9px',
                                background: '#FFFFFF',
                              }}>
                                <p style={{ margin: 0, fontSize: 10, lineHeight: 1.4, color: '#64748B', fontWeight: 900 }}>
                                  {item.label}
                                </p>
                                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#334155', fontWeight: 700 }}>
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p style={{ margin: '0 0 7px', fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioDecisionReadiness}
                          </p>
                          <div style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: 12,
                            padding: '9px 10px',
                            background: '#FFFFFF',
                          }}>
                            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 900, color: '#0F172A' }}>
                              {selectedStudioPreview.decisionBrief.readiness.label}
                            </p>
                            <div style={{ display: 'grid', gap: 5 }}>
                              {(selectedStudioPreview.decisionBrief.readiness.blockers.length > 0
                                ? selectedStudioPreview.decisionBrief.readiness.blockers
                                : [copy.studioDecisionNoBlockers]
                              ).map(blocker => (
                                <p key={blocker} style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: '#64748B' }}>
                                  {blocker}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <p style={{ margin: '0 0 7px', fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioDecisionQualitySignals}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 7 }}>
                            {selectedStudioPreview.decisionBrief.qualitySignals.map(signal => (
                              <div key={signal.id} style={{
                                border: `1px solid ${signal.status === 'pass' ? '#BBF7D0' : '#FED7AA'}`,
                                borderRadius: 12,
                                padding: '8px 9px',
                                background: signal.status === 'pass' ? '#F0FDF4' : '#FFF7ED',
                              }}>
                                <p style={{
                                  margin: '0 0 4px',
                                  fontSize: 11,
                                  lineHeight: 1.35,
                                  fontWeight: 900,
                                  color: signal.status === 'pass' ? '#15803D' : '#C2410C',
                                }}>
                                  {signal.label}
                                </p>
                                <p style={{ margin: 0, fontSize: 10, lineHeight: 1.45, color: '#475569' }}>
                                  {signal.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      border: '1px solid #D8B4FE',
                      borderRadius: 16,
                      padding: '14px',
                      background: 'linear-gradient(180deg, #FAF5FF 0%, #FFFFFF 100%)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 900, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {copy.studioDraftControlsTitle}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#475569' }}>
                            {copy.studioDraftControlsBody}
                          </p>
                        </div>
                        <span style={{
                          border: '1px solid #DDD6FE',
                          background: '#FFFFFF',
                          color: '#6D28D9',
                          borderRadius: 999,
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                        }}>
                          {copy.studioDraftUnsaved}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {[
                          {
                            id: 'headline',
                            label: copy.studioHeadlineControl,
                            value: selectedStudioDraftControls?.headlineText || '',
                            onChange: (value: string) => updateStudioDraftControls({ headlineText: value }),
                          },
                          {
                            id: 'cta',
                            label: copy.studioCtaControl,
                            value: selectedStudioDraftControls?.ctaText || '',
                            onChange: (value: string) => updateStudioDraftControls({ ctaText: value }),
                          },
                          {
                            id: 'brand',
                            label: copy.studioBrandControl,
                            value: selectedStudioDraftControls?.brandText || '',
                            onChange: (value: string) => updateStudioDraftControls({ brandText: value }),
                          },
                        ].map(control => (
                          <label key={control.id} style={{ display: 'grid', gap: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                              {control.label}
                            </span>
                            <input
                              type="text"
                              value={control.value}
                              onChange={event => control.onChange(event.target.value)}
                              style={{
                                width: '100%',
                                border: '1px solid #CBD5E1',
                                borderRadius: 10,
                                padding: '8px 10px',
                                background: '#FFFFFF',
                                color: '#0F172A',
                                fontSize: 12,
                                lineHeight: 1.4,
                                outlineColor: '#8B5CF6',
                              }}
                            />
                          </label>
                        ))}

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: 10 }}>
                          <div style={{ display: 'grid', gap: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                              {copy.studioAccentControl}
                            </span>
                            <input
                              type="color"
                              value={selectedStudioDraftControls?.accentColor || '#334155'}
                              onChange={event => updateStudioDraftControls({ accentColor: event.target.value })}
                              style={{
                                width: '100%',
                                height: 38,
                                border: '1px solid #CBD5E1',
                                borderRadius: 10,
                                padding: 4,
                                background: '#FFFFFF',
                                cursor: 'pointer',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {['#334155', '#0F766E', '#4F46E5', '#7C3AED', '#B45309'].map(color => {
                                const active = (selectedStudioDraftControls?.accentColor || '#334155').toUpperCase() === color
                                return (
                                  <button
                                    key={color}
                                    type="button"
                                    aria-label={`Use ${color} accent`}
                                    title={color}
                                    onClick={() => updateStudioDraftControls({ accentColor: color })}
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: '50%',
                                      border: active ? '2px solid #0F172A' : '1px solid #CBD5E1',
                                      background: color,
                                      boxShadow: active ? '0 0 0 3px rgba(15,23,42,0.08)' : 'none',
                                      cursor: 'pointer',
                                    }}
                                  />
                                )
                              })}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                              {copy.studioLayoutControl}
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                              {[
                                { key: 'balanced', label: copy.studioLayoutBalanced },
                                { key: 'editorial', label: copy.studioLayoutEditorial },
                                { key: 'cta_focus', label: copy.studioLayoutCtaFocus },
                              ].map(layout => {
                                const active = selectedStudioDraftControls?.layout === layout.key
                                return (
                                  <button
                                    key={layout.key}
                                    type="button"
                                    onClick={() => updateStudioDraftControls({ layout: layout.key as CreativeStudioDraftLayout })}
                                    style={{
                                      border: active ? '1px solid #7C3AED' : '1px solid #CBD5E1',
                                      background: active ? '#F3E8FF' : '#FFFFFF',
                                      color: active ? '#6D28D9' : '#475569',
                                      borderRadius: 10,
                                      minHeight: 38,
                                      padding: '7px 6px',
                                      fontSize: 10,
                                      fontWeight: 850,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {layout.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#64748B', flex: '1 1 220px' }}>
                            {copy.studioDraftBoundary}
                          </p>
                          <button
                            type="button"
                            onClick={resetStudioDraftControls}
                            style={{
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: '#334155',
                              borderRadius: 10,
                              padding: '8px 10px',
                              fontSize: 11,
                              fontWeight: 850,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {copy.studioResetDraft}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                      <SafetyNote title={copy.studioPreviewOnly} body={copy.studioPreviewOnlyBody} accent="#4F46E5" />
                      <SafetyNote title={copy.studioNotFinal} body={copy.studioNotFinalBody} accent="#0F766E" />
                      <SafetyNote title={copy.studioNoActions} body={copy.studioNoActionsBody} accent="#B45309" />
                      <SafetyNote title={copy.studioFinalAttach} body={copy.studioFinalAttachBody} accent="#7C3AED" />
                    </div>

                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: '13px 14px', background: '#F8FAFC' }}>
                      <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                        {copy.studioLayerInventory}
                      </p>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedStudioPreview.editableLayers.map(layer => (
                          <div key={layer.id} style={{
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            borderRadius: 12,
                            padding: '9px 10px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 850, color: '#0F172A' }}>
                                {layer.role.replace(/_/g, ' ')}
                              </p>
                              <span style={{
                                border: `1px solid ${layer.safeZoneCompliant ? '#BBF7D0' : '#FED7AA'}`,
                                background: layer.safeZoneCompliant ? '#F0FDF4' : '#FFF7ED',
                                color: layer.safeZoneCompliant ? '#15803D' : '#C2410C',
                                borderRadius: 999,
                                padding: '3px 7px',
                                fontSize: 10,
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                              }}>
                                {layer.safeZoneCompliant ? copy.studioSafe : copy.studioNeedsReview}
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.55, color: '#64748B' }}>
                              {layer.text || copy.studioNoTextLayer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: '13px 14px', background: '#FFFFFF' }}>
                      <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                        {copy.studioQuality}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                        {[
                          { value: selectedStudioPreview.qualitySummary.requiredPassed, label: copy.studioRequiredPassed, color: '#15803D' },
                          { value: selectedStudioPreview.qualitySummary.requiredFailed, label: copy.studioRequiredFailed, color: '#B45309' },
                          { value: selectedStudioPreview.qualitySummary.recommendedFailed, label: copy.studioRecommendedFailed, color: '#4F46E5' },
                        ].map(item => (
                          <div key={item.label} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '8px 9px', background: '#F8FAFC' }}>
                            <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: item.color }}>{item.value}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 9, lineHeight: 1.25, color: '#64748B', fontWeight: 750 }}>{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: '13px 14px', background: '#F8FAFC' }}>
                      <p style={{ margin: '0 0 9px', fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.35 }}>
                        {copy.studioPath}
                      </p>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedStudioPreview.controlledPath.map((step, index) => (
                          <div key={step.id} style={{
                            display: 'grid',
                            gridTemplateColumns: '24px minmax(0, 1fr)',
                            gap: 9,
                            alignItems: 'start',
                          }}>
                            <span style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: step.state === 'available_now' ? '#DCFCE7' : '#E2E8F0',
                              color: step.state === 'available_now' ? '#15803D' : '#475569',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 900,
                            }}>
                              {index + 1}
                            </span>
                            <div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 850, color: '#0F172A' }}>{step.label}</p>
                                <span style={{
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  color: '#475569',
                                  borderRadius: 999,
                                  padding: '2px 6px',
                                  fontSize: 9,
                                  fontWeight: 800,
                                }}>
                                  {studioPathStateLabel(step.state)}
                                </span>
                              </div>
                              <p style={{ margin: '3px 0 0', fontSize: 11, lineHeight: 1.55, color: '#64748B' }}>
                                {step.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mediaItems.length === 0 ? (
              <div>
                {/* Strategy Asset Requirements — show when no media */}
                {assetRequirements ? (
                  <div style={{ marginBottom: 24 }}>
                    <SectionCard title={copy.requirementsTitle} icon="📋" accent="#6366F1">
                      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7280' }}>
                        {copy.requirementsIntro}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        {assetRequirements.mustHave?.length > 0 && (
                          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>🔴 {copy.mustHave}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {assetRequirements.mustHave.map((item: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#DC2626', flexShrink: 0 }}>·</span>{assetRequirementText(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {assetRequirements.niceToHave?.length > 0 && (
                          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5 }}>🟡 {copy.niceToHave}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {assetRequirements.niceToHave.map((item: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#D97706', flexShrink: 0 }}>·</span>{assetRequirementText(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {assetRequirements.forAds?.length > 0 && (
                          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 {copy.forPaid}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {assetRequirements.forAds.map((item: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#4338CA', flexShrink: 0 }}>·</span>{assetRequirementText(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {assetRequirements.forOrganic?.length > 0 && (
                          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5 }}>📱 {copy.forOrganic}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {assetRequirements.forOrganic.map((item: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#15803D', flexShrink: 0 }}>·</span>{assetRequirementText(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {assetRequirements.forProof?.length > 0 && (
                          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 }}>⭐ {copy.proof}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {assetRequirements.forProof.map((item: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#7C3AED', flexShrink: 0 }}>·</span>{assetRequirementText(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {assetRequirements.nextToCreate?.length > 0 && (
                          <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, padding: '12px 14px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: 0.5 }}>📸 {copy.shootNext}</p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                              {assetRequirements.nextToCreate.map((item: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#C2410C', flexShrink: 0 }}>·</span>{assetRequirementText(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <a
                          href="/media"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '9px 20px', borderRadius: 8,
                            background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          {copy.uploadAssets} ↗
                        </a>
                        <button
                          type="button"
                          onClick={handleRefreshAssets}
                          disabled={refreshingAssets}
                          style={{
                            padding: '9px 18px',
                            borderRadius: 8,
                            border: '1px solid #D1D5DB',
                            background: refreshingAssets ? '#F3F4F6' : '#FFFFFF',
                            color: '#374151',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: refreshingAssets ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {refreshingAssets ? copy.refreshingAssets : copy.refreshAssets}
                        </button>
                      </div>
                    </SectionCard>
                  </div>
                ) : (
                  <div style={{
                    background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 12,
                    padding: '32px 24px', textAlign: 'center', marginBottom: 24,
                  }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>{copy.noMediaTitle}</p>
                    <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>{copy.noMediaBody}</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <a
                        href="/media"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 18px', borderRadius: 8,
                          background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        {copy.uploadAssets} ↗
                      </a>
                      <button
                        type="button"
                        onClick={handleRefreshAssets}
                        disabled={refreshingAssets}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: '1px solid #D1D5DB',
                          background: refreshingAssets ? '#F3F4F6' : '#FFFFFF',
                          color: '#374151',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: refreshingAssets ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {refreshingAssets ? copy.refreshingAssets : copy.refreshAssets}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
              {/* Strategy asset requirements — guidance when media exists */}
              {assetRequirements && (assetRequirements.mustHave?.length > 0 || assetRequirements.nextToCreate?.length > 0) && (
                <div style={{
                  background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 16,
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                    📋 {copy.guidance}
                  </p>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const }}>
                    {assetRequirements.mustHave?.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{copy.mustHave}</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {assetRequirements.mustHave.slice(0, 3).map((item: string, i: number) => (
                            <li key={i} style={{ fontSize: 12, color: '#374151', padding: '1px 0' }}>· {assetRequirementText(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {assetRequirements.nextToCreate?.length > 0 && (
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{copy.shootNext}</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {assetRequirements.nextToCreate.slice(0, 3).map((item: string, i: number) => (
                            <li key={i} style={{ fontSize: 12, color: '#374151', padding: '1px 0' }}>· {assetRequirementText(item)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
                padding: 20, marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111' }}>
                      {copy.selectAssets}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                      {imageMedia.length} {imageMedia.length === 1 ? copy.imageSingular : copy.imagePlural}
                      {videoMedia.length > 0 && ` · ${videoMedia.length} ${videoMedia.length === 1 ? copy.videoSingular : copy.videoPlural}`}
                      {' '}{copy.inWorkspace}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      {selectedMedia.size} {copy.selected}
                    </span>
                    <a
                      href="/media"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        padding: '4px 12px',
                        borderRadius: 6,
                        border: '1px solid #C7D2FE',
                        background: '#EEF2FF',
                        color: '#4338CA',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      {copy.uploadAssets} ↗
                    </a>
                    <button
                      type="button"
                      onClick={handleRefreshAssets}
                      disabled={refreshingAssets}
                      style={{
                        fontSize: 12,
                        padding: '4px 12px',
                        borderRadius: 6,
                        cursor: refreshingAssets ? 'not-allowed' : 'pointer',
                        border: '1px solid #D1D5DB',
                        background: refreshingAssets ? '#F3F4F6' : '#F9FAFB',
                        color: '#374151',
                        fontWeight: 600,
                      }}
                    >
                      {refreshingAssets ? copy.refreshingAssets : copy.refreshAssets}
                    </button>
                    <button
                      onClick={toggleAll}
                      style={{
                        fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                        border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#374151', fontWeight: 600,
                      }}
                    >
                      {selectedMedia.size === mediaItems.length ? copy.deselectAll : copy.selectAll}
                    </button>
                  </div>
                </div>

                {/* Asset grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10,
                  maxHeight: 340, overflowY: 'auto', padding: '4px 2px',
                }}>
                  {mediaItems.map(m => {
                    const isSelected = selectedMedia.has(m.id)
                    const isImage = m.type === 'IMAGE' || m.type === 'LOGO'
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMedia(m.id)}
                        style={{
                          position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                          border: `2px solid ${isSelected ? '#6366F1' : '#E5E7EB'}`,
                          transition: 'all 0.12s', background: '#F3F4F6',
                        }}
                      >
                        {isImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={m.url} alt={m.fileName}
                            style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div style={{
                            height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 28, background: '#1F2937',
                          }}>
                            {m.type === 'VIDEO' ? '🎬' : '📄'}
                          </div>
                        )}
                        <div style={{ padding: '6px 8px' }}>
                          <p style={{
                            margin: 0, fontSize: 10, color: '#374151', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {m.fileName}
                          </p>
                          <p style={{ margin: 0, fontSize: 9, color: '#9CA3AF' }}>{m.type}</p>
                        </div>
                        {isSelected && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6, width: 20, height: 20,
                            borderRadius: '50%', background: '#6366F1', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Selection-required hint */}
                {selectedMedia.size === 0 && (
                  <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 600, color: '#F59E0B', textAlign: 'center' }}>
                    ☝️ {copy.selectHint}
                  </p>
                )}
                {videoMedia.length > 0 && (
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    ℹ️ {copy.videoNote}
                  </p>
                )}
              </div>
              </>
            )}
          </div>
        )}

        {/* ── Generate Button ── */}
        {!generating && (
          <div className="no-print" style={{ marginBottom: 28 }}>
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: '10px 14px', marginBottom: 12,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: '#DC2626' }}>⚠️ {error}</p>
              </div>
            )}
            <label style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              background: '#fff',
              border: confirmedReviewOnly ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 12,
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={confirmedReviewOnly}
                onChange={(event) => { setConfirmedReviewOnly(event.target.checked); setError('') }}
                disabled={assetActionUnavailable}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: '#4F46E5', flexShrink: 0 }}
              />
              <span>
                <strong style={{ display: 'block', fontSize: 13, color: '#0F172A', marginBottom: 2 }}>{copy.confirmTitle}</strong>
                <span style={{ display: 'block', fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{copy.confirmBody}</span>
              </span>
            </label>
            <button
              onClick={creativeBriefLocked ? () => router.push('/billing') : handleGenerate}
              disabled={!creativeBriefLocked && generationDisabled}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: 10,
                background: creativeBriefLocked ? '#FEF2F2' : generationDisabled ? '#E5E7EB' : '#6366F1',
                color: creativeBriefLocked ? '#B91C1C' : generationDisabled ? '#9CA3AF' : '#fff',
                border: creativeBriefLocked ? '1px solid rgba(239,68,68,0.18)' : 'none',
                fontSize: 14, fontWeight: 700, cursor: generationDisabled && !creativeBriefLocked ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {creativeBriefLocked ? addCreditsLabel : mode === 'asset'
                ? `🔍 ${copy.analyzeButton}${selectedMedia.size > 0 ? ` (${selectedMedia.size})` : ''} — ${creditLabel}`
                : `✨ ${copy.conceptButton} — ${creditLabel}`
              }
            </button>
            {creativeBrief && (
              <p style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                {copy.lastGenerated}: {new Date(creativeBrief.generatedAt).toLocaleString()}
                {' · '}
                <span
                  onClick={creativeBriefLocked ? () => router.push('/billing') : () => {
                    if (!confirmedReviewOnly) {
                      setError(copy.confirmRequired)
                      return
                    }
                    handleGenerate()
                  }}
                  style={{ color: creativeBriefLocked ? '#B91C1C' : '#6366F1', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {creativeBriefLocked ? copy.addCredits : copy.regenerate}
                </span>
              </p>
            )}
          </div>
        )}

        {/* ── Generating State ── */}
        {generating && (
          <div className="no-print" style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
            padding: '40px 24px', textAlign: 'center', marginBottom: 28,
          }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#6366F1',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111' }}>
              {mode === 'asset' ? copy.analyzingTitle : copy.conceptTitle}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
              {mode === 'asset' ? copy.analyzingBody : copy.conceptBody}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            RESULTS — Asset Mode
        ───────────────────────────────────────────────────────────────────── */}

        {creativeBrief && creativeBrief.mode === 'asset' && (

          <div>
            {/* Overall Creative Direction */}
            {creativeBrief.overallCreativeDirection && (
              <SectionCard title={copy.overallDirection} icon="🎯" accent="#6366F1">
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
                  {creativeBrief.overallCreativeDirection}
                </p>
              </SectionCard>
            )}

            {/* Top Assets Recommendation */}
            {(creativeBrief.topAssetsForCampaign?.length ?? 0) > 0 && (
              <SectionCard title={copy.topAssets} icon="⭐" accent="#F59E0B">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {creativeBrief.topAssetsForCampaign!.map((name, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8,
                      padding: '6px 12px',
                    }}>
                      <span style={{ fontSize: 14 }}>#{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>{name}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Per-Asset Analyses */}
            {(creativeBrief.assetAnalyses?.length ?? 0) > 0 && (
              <SectionCard title={`${copy.assetAnalyses} (${creativeBrief.assetAnalyses!.length})`} icon="🖼️" accent="#6366F1">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {creativeBrief.assetAnalyses!.map((a, i) => (
                    <div key={i} style={{
                      border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden',
                    }}>
                      {/* Asset header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                        background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                      }}>
                        {(a.type === 'IMAGE' || a.type === 'LOGO') && a.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={a.url} alt={a.fileName}
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: 56, height: 56, background: '#1F2937', borderRadius: 6, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                          }}>
                            {a.type === 'VIDEO' ? '🎬' : '📄'}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111' }}>{a.fileName}</p>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <Tag label={a.type} color="#6B7280" />
                            {a.contentType && a.contentType !== 'Unknown' && (
                              <Tag label={a.contentType} color="#6366F1" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Analysis body */}
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {a.brandAlignment && (
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.brandAlignment}</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.brandAlignment}</p>
                          </div>
                        )}
                        {a.campaignFit && (
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.campaignFit}</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.campaignFit}</p>
                          </div>
                        )}
                        {a.qualityNotes && (
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.qualityNotes}</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.qualityNotes}</p>
                          </div>
                        )}
                        {a.suggestedUse.length > 0 && (
                          <div>
                            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.suggestedUse}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {a.suggestedUse.map((u, j) => <Tag key={j} label={u} color="#22C55E" />)}
                            </div>
                          </div>
                        )}
                        {a.adCopyHook && (
                          <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div>
                                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.adCopyHook}</p>
                                <p style={{ margin: 0, fontSize: 13, color: '#374151', fontStyle: 'italic', lineHeight: 1.6 }}>"{a.adCopyHook}"</p>
                              </div>
                              <CopyButton text={a.adCopyHook} />
                            </div>
                          </div>
                        )}
                        {a.captionSuggestion && (
                          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.captionSuggestion}</p>
                                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.captionSuggestion}</p>
                              </div>
                              <CopyButton text={a.captionSuggestion} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Ad Copy Variants */}
            {(creativeBrief.adCopyVariants?.length ?? 0) > 0 && (
              <SectionCard title={isArabic ? 'مسودات نسخ إعلانية للمراجعة' : 'Draft Ad Copy Ideas'} icon="✍️" accent="#F59E0B">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                    {isArabic ? 'أفكار نسخ للمراجعة قبل التنفيذ، وليست نشرًا أو إعلانًا جاهزًا للنشر.' : 'Copy ideas for review before execution, not publishing or a finished ad asset.'}
                  </p>
                  <CopyAllButton texts={creativeBrief.adCopyVariants!} label={copy.copyAllVariants} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {creativeBrief.adCopyVariants!.map((variant, i) => (
                    <div key={i} style={{
                      background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{variant}</p>
                      <CopyButton text={variant} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Caption Formulas */}
            {(creativeBrief.captionFormulas?.length ?? 0) > 0 && (
              <SectionCard title={copy.captionFormulas} icon="📝" accent="#6366F1">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{copy.captionFormulasBody}</p>
                  <CopyAllButton texts={creativeBrief.captionFormulas!} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {creativeBrief.captionFormulas!.map((formula, i) => (
                    <div key={i} style={{
                      background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '10px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{formula}</p>
                      <CopyButton text={formula} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Asset-Based Scripts */}
            {(creativeBrief.assetBasedScripts?.length ?? 0) > 0 && (
              <SectionCard title={copy.contentScripts} icon="🎬" accent="#EC4899">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{copy.contentScriptsBody}</p>
                  <CopyAllButton texts={creativeBrief.assetBasedScripts!} label={copy.copyAllScripts} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {creativeBrief.assetBasedScripts!.map((script, i) => (
                    <div key={i} style={{
                      background: '#FDF4FF', border: '1px solid #F0ABFC', borderRadius: 8, padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#A21CAF' }}>{copy.script} {i + 1}</p>
                        <CopyButton text={script} />
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{script}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            RESULTS — Concept Mode
        ───────────────────────────────────────────────────────────────────── */}

        {creativeBrief && creativeBrief.mode === 'concept' && (
          <div>

            {/* Mood + Color Direction */}
            {(creativeBrief.moodDescription || (creativeBrief.colorDirections?.length ?? 0) > 0) && (
              <SectionCard title={copy.moodColor} icon="🎨" accent="#EC4899">
                {creativeBrief.moodDescription && (
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: '#374151', lineHeight: 1.7, fontStyle: 'italic' }}>
                    "{creativeBrief.moodDescription}"
                  </p>
                )}
                {(creativeBrief.colorDirections?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>{copy.colorDirections}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {creativeBrief.colorDirections!.map((dir, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                          background: '#FDF4FF', border: '1px solid #E9D5FF', borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>🎨</span>
                          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{dir}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Image Prompts */}
            {(creativeBrief.imagePrompts?.length ?? 0) > 0 && (
              <SectionCard title={isArabic ? 'اتجاهات صور مسودة' : 'Draft Image Direction Prompts'} icon="✨" accent="#6366F1">
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                    {isArabic ? 'موجهات تخطيطية للمراجعة أو لإرشاد المصمم لاحقًا. لا يتم توليد صورة هنا.' : 'Planning prompts for review or later designer guidance. No image is generated here.'}
                  </p>
                  <CopyAllButton
                    texts={creativeBrief.imagePrompts!.map(p => `[${p.platform} — ${p.aspectRatio}]\n${p.prompt}\n\nNotes: ${p.notes}`)}
                    label={copy.copyAllPrompts}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {creativeBrief.imagePrompts!.map((prompt, i) => (
                    <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                      }}>
                        <Tag label={prompt.platform} color="#6366F1" />
                        <Tag label={prompt.aspectRatio} color="#6B7280" />
                        <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', flex: 1 }}>{prompt.style}</span>
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{
                          background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8,
                          padding: '10px 14px', marginBottom: 10,
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                        }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#0C4A6E', lineHeight: 1.7, fontFamily: 'monospace', flex: 1 }}>
                            {prompt.prompt}
                          </p>
                          <CopyButton text={prompt.prompt} />
                        </div>
                        {prompt.notes && (
                          <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                            <strong>{copy.productionNote}:</strong> {prompt.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Storyboard */}
            {(creativeBrief.storyboardScenes?.length ?? 0) > 0 && (
              <SectionCard title={copy.storyboard} icon="🎬" accent="#F59E0B">
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6B7280' }}>
                  {copy.storyboardBody}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {creativeBrief.storyboardScenes!.map((scene, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 14, padding: '14px 16px',
                      background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: '#F59E0B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: '#fff', fontWeight: 800, fontSize: 14,
                      }}>
                        {scene.sceneNumber}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <Tag label={scene.platform} color="#F59E0B" />
                          {scene.duration && <Tag label={scene.duration} color="#6B7280" />}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111' }}>{scene.description}</p>
                        {scene.visualNotes && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6B7280' }}>
                            <strong>{copy.visual}:</strong> {scene.visualNotes}
                          </p>
                        )}
                        {scene.textOverlay && scene.textOverlay !== 'none' && (
                          <p style={{ margin: 0, fontSize: 12, color: '#D97706' }}>
                            <strong>{copy.textOverlay}:</strong> "{scene.textOverlay}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Production Brief */}
            {creativeBrief.productionBrief && (
              <SectionCard title={isArabic ? 'ملاحظات إنتاج للمراجعة' : 'Review-Only Production Notes'} icon="📋" accent="#22C55E">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8, flex: 1 }}>
                    {creativeBrief.productionBrief}
                  </p>
                  <CopyButton text={creativeBrief.productionBrief} />
                </div>
              </SectionCard>
            )}

            {/* Platform Layouts */}
            {creativeBrief.platformLayouts && Object.keys(creativeBrief.platformLayouts).length > 0 && (
              <SectionCard title={copy.platformLayouts} icon="📱" accent="#6366F1">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(creativeBrief.platformLayouts).map(([platform, direction]) => (
                    <div key={platform} style={{
                      border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'capitalize' }}>
                          {platform.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{
                        padding: '10px 14px', display: 'flex',
                        alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                      }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{direction}</p>
                        <CopyButton text={direction} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Creative Notes */}
            {creativeBrief.creativeNotes && (
              <SectionCard title={copy.creativeNotes} icon="💡" accent="#F59E0B">
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                  {creativeBrief.creativeNotes}
                </p>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!creativeBrief && !generating && (
          <div style={{
            background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 16,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>
              {mode === 'asset' ? '🖼️' : '✨'}
            </p>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111' }}>
              {emptyStateTitle}
            </h3>
            <p style={{ margin: '0 auto', fontSize: 14, color: '#9CA3AF', maxWidth: 440 }}>
              {emptyStateBody}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#D1D5DB' }}>
            NEXUS AI — {copy.title} · {campaign.name}
          </p>
        </div>

      </div>
    </div>

    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      reason="no_credits"
    />
    </>
  )
}
