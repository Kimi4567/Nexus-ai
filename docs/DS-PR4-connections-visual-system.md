# DS-PR4 Connections Visual System Adoption

## Objective

Adopt the DS-PR1 tokens and DS-PR2 shared UI primitives on the Connections surface without changing platform integration behavior.

Connections is the product surface where users understand platform readiness. The UI must distinguish account connection from publishing approval, ads operation, insights access, and future platform availability.

## Scope

Changed:

- `src/app/connections/page.tsx`
- `src/lib/i18n-context.tsx`
- `docs/DS-PR4-connections-visual-system.md`

Not changed:

- OAuth routes
- platform API behavior
- publishing behavior
- ads behavior
- auth behavior
- billing or credits
- database schema or migrations
- environment files

## Visual System Adoption

The page now uses DS shared primitives where low risk:

- `PageHeader` for the page title, description, and refresh action.
- `SectionCard` for the connection meaning summary and platform list.
- `ActionButton` for refresh, connect, disconnect, and start actions.
- `ReadinessBadge` for platform capability and availability labels.
- `LoadingState` for the authenticated loading state.

The existing `PlatformReadinessPanel` remains the source of the top-level readiness summary. No readiness logic was changed.

## Readiness Language

Approved terms:

- Connected
- Needs setup
- Permission needed
- Planning only
- Not available yet
- Publishing requires approval

Avoided terms:

- Live
- Fully connected
- Ready to publish
- Auto-publish ready
- Ads ready
- Insights ready

Copy now makes clear that connecting a platform does not publish on its own or activate ad spend. Publishing and spend remain approval-based unless future backend logic explicitly supports otherwise.

## Behavior Notes

The page still calls the same existing account list, connect, refresh, and disconnect flows. DS-PR4 is visual and information architecture only.

Unavailable or unsupported platform capabilities are presented as future planning or not available, rather than implied live features.

## Validation Plan

- `npm run type-check`
- `npm run build`
- Browser QA:
  - `/`
  - `/auth/login`
  - `/connections` when an authenticated session is available
  - mobile viewport for `/connections` when available
  - Arabic/RTL when available
  - console error check
