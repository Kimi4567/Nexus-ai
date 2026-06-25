# DS-PR2 Shared UI Components

Date: 2026-06-25

Scope: additive shared UI components only. No product page conversion, no behavior changes, and no API/auth/billing/credits/publishing/cron/schema/env changes.

## Added Components

- `PageHeader`
- `SectionCard`
- `ActionButton`
- `StatusBadge`
- `ReadinessBadge`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `MetricCard`

## Notes

- Components use the DS-PR1 `nx-*` tokens and shared CSS classes.
- `StatusBadge` intentionally does not include a `Live` status.
- `autoScheduled` displays as `Auto-plan queued` until true auto-publish behavior is proven.
- Components are not mass-applied to product pages in this PR. Future DS PRs should convert surfaces gradually.
