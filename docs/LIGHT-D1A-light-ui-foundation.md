# LIGHT-D1A - Light UI Foundation

## Objective

Move the app foundation away from inherited dark UI defaults and toward a calm, premium, light-first business operating system without converting product pages or changing product behavior.

## Foundation Changes

- Updated the root application body in `src/app/layout.tsx` so it no longer inherits a dark canvas or white text.
- Kept the app structure, providers, metadata, and routing behavior unchanged.
- Updated global fallback screens in `src/app/loading.tsx`, `src/app/error.tsx`, and `src/app/not-found.tsx` to use soft gray backgrounds, white cards, slate text, calm blue primary actions, and subtle shadows.
- Reduced global glow pressure in `src/app/globals.css` by softening glow variables, legacy glow classes, and shared gradient button shadows.
- Updated `tailwind.config.ts` so existing glow and gradient compatibility utilities are calmer and light-first.

## Compatibility Kept

The legacy `dark`, `dark-secondary`, and `dark-tertiary` Tailwind aliases remain in place because many older pages and components still reference those class names. They already map to light-safe colors:

- `dark` -> `#F5F5F7`
- `dark-secondary` -> `#FFFFFF`
- `dark-tertiary` -> `#E5E7EB`

The compatibility variables `--nx-card-dark`, `--nx-border-dark`, `--nx-text-on-dark`, and `--nx-text-on-dark-muted` also remain, but now point to light-safe surfaces and slate text. Removing these aliases in this PR would risk breaking legacy pages before they are individually converted.

## Intentionally Excluded

This PR does not convert:

- Dashboard
- Billing
- Campaign Room
- Campaign detail tabs
- RunFullStrategyModal
- Campaign Wizard
- Content Hub
- Media Library
- Analytics
- Auth page redesign
- Generation, credits, billing, publishing, cron, schema, migrations, or platform API logic

The known dirty files `src/app/dashboard/page.tsx` and `src/app/billing/page.tsx` were intentionally not touched.

## Next Phases

1. Convert the core authenticated pages: Dashboard, Brand Brain, Strategy, Campaigns list, and the Campaign detail shell.
2. Convert production surfaces: Content Hub, Calendar, Media Library, Connections, and Analytics.
3. Convert high-impact modals and generation surfaces, especially `RunFullStrategyModal`.
4. Remove leftover legacy dark aliases after route-level conversions prove they are no longer needed.

## Risks And QA Notes

- Some older pages may still contain local dark cards or inherited white-on-dark assumptions. This PR does not chase those page-level styles.
- The root body change is intentionally small but important; browser QA should confirm already-light pages stay light and old dark surfaces do not regress functionally.
- Dark media overlays may still be valid for media previews and should be handled page by page rather than removed globally.
