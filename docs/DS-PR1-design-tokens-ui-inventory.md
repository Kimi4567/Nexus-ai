# DS-PR1 Design Tokens & UI Inventory

Date: 2026-06-25

Scope: design-system foundation only. No business logic, API routes, billing/credits, auth, publishing, cron, schema, or production configuration changed.

## Inspected Surfaces

- `src/app/globals.css`
- `tailwind.config.ts`
- `src/components/AppShell.tsx`
- `src/components/Sidebar.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/campaigns/page.tsx`
- `src/app/campaigns/[id]/page.tsx`
- `src/app/content-hub/page.tsx`
- `src/app/calendar/page.tsx`
- `src/app/media/page.tsx`
- `src/app/billing/page.tsx`
- `src/app/brand/page.tsx`
- `src/app/strategy/page.tsx`
- `src/components/nexus-ui/*`

## Current Foundation

- Core surface tokens already exist: `--nx-base`, `--nx-surface`, `--nx-elevated`, `--nx-panel`, `--nx-border`, `--nx-border-hi`.
- Primary product accent is violet: `--nx-violet #5E5CE6`.
- Secondary/action-warning accent is orange: `--nx-orange #D97706`.
- Text ramp is defined as `--nx-text-1` through `--nx-text-4`.
- Tailwind mirrors the main `nx-*` colors and keeps legacy aliases for older pages.
- Shared CSS classes already exist for cards, buttons, forms, workflow steps, and compatibility classes.
- `src/components/nexus-ui` already contains useful primitives (`NexusButton`, `NexusGlassCard`, `NexusMetricCard`, `NexusSectionHeader`, `NexusBadge`, `NexusWorkflowStep`), but several variants still carry older dark/glow assumptions.

## Added In DS-PR1

- Added `--nx-surface-2` for quiet secondary surfaces already referenced by components.
- Added semantic state tokens for success, warning, danger, info, and neutral states in CSS and Tailwind.
- Added safe shared CSS foundations for future component work:
  - `.nx-page`
  - `.nx-page-inner`
  - `.nx-page-header`
  - `.nx-page-title`
  - `.nx-page-subtitle`
  - `.nx-section-card`
  - `.nx-status-badge`
  - `.nx-empty-state`
  - `.nx-loading-card`
  - `.nx-error-card`

These are additive tokens/classes only. Existing pages were not mass-converted.

## Inventory Findings

- AppShell and Sidebar are mostly aligned with the calm light product direction.
- Dashboard is visually closer to the target system, but remains dense and still has older comments/glow language.
- Campaigns uses mostly light cards and existing form/button utility classes.
- Campaign Room has many locally styled white cards and action states; it needs a separate visual reset.
- Content Hub still contains dark campaign cards inside the light app shell, which is the clearest split-personality surface.
- Calendar has useful truth/status distinctions, but many colors and labels are local to the page.
- Media Library uses light surfaces, but repeats local modal/card/button styles that should move into shared components later.
- Billing is visually polished but has plan/card patterns that should be audited separately because copy and monetization claims are high-risk.
- Brand Brain has strong memory/readiness patterns but many local form controls and amber accents.
- Strategy is honest and light, with local `card`/`cardStyle` helpers that should become shared components later.

## Follow-Up DS PRs

- DS-PR2 Shared UI Components: formalize `PageHeader`, `SectionCard`, `ActionButton`, badge components, `EmptyState`, and loading/error wrappers using the DS-PR1 tokens.
- DS-PR3 Sidebar/AppShell IA Cleanup: reduce primary nav density and align labels with product-language rules.
- DS-PR4 Campaign Room Visual Reset: convert campaign detail surfaces to shared cards, badges, and approval/status panels without changing workflow logic.
- DS-PR5 Content Hub + Calendar Alignment: remove dark Content Hub remnants and align content lifecycle/status language with Calendar.

## Non-Goals

- No redesign rollout.
- No copy claims about publishing, launching, agency support, or A/B testing.
- No API, data, auth, billing, credit, publishing, cron, or schema changes.
