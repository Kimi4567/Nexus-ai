# STRATEGY-DOCUMENT-LANGUAGE-SYNC

## Problem

Generated strategy documents can be saved in Arabic while the surrounding app UI is still English. That made the Strategy tab feel stitched together: Arabic strategic content appeared beside English reading labels such as `Business stage`, `Situation`, `Hypothesis`, and `Readiness`.

## Decision

The Strategy tab keeps two language layers:

- The global Campaign Room shell follows the user's UI locale.
- The strategy document reading surface follows the saved strategy output language from `aiOutput.language`.

This keeps an Arabic generated strategy readable as one coherent Arabic document even when the user's app shell is currently English.

## Scope

- Added `resolveStrategyDocumentLocale`.
- Added a document-level copy helper for strategy labels.
- Added a document-level Strategy Room state copy instance for the Strategy command center.
- Changed the visible Strategy document sections, cards, lists, readiness bridge, metrics, and risk labels to use the document locale.

## Boundaries

- No strategy generation changed.
- No prompt, API route, schema, data, billing, credits, publishing, scheduling, Autopilot, media, paid execution, or Brand Brain mutation changed.
- The change is display-only and affects the Strategy tab reading surface.
