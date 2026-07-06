# STRATEGY-DOCUMENT-VALUE-POLISH

## Problem

After the Strategy document language was aligned to the generated output language, some stored strategy values could still appear as raw internal English values inside an Arabic document. Examples include funnel stages such as `Awareness`, `Consideration`, and `Conversion`, or compact metric categories such as `LEAD`.

That makes a strong strategy feel like a stitched data render instead of a professional marketing document.

## Decision

Add a conservative display-only value formatter for common strategy document values:

- Funnel stages.
- Broad strategy modes.
- Common content formats.
- Simple readiness/status values.
- Metric categories such as leads.

The formatter only changes exact standalone values. It does not rewrite generated paragraphs, platform names, user-provided copy, CTAs, or brand-specific text.

## Boundaries

- No strategy generation changed.
- No prompt changed.
- No API route, schema, data, billing, credits, publishing, scheduling, Autopilot, media, paid execution, Brand Brain, or engine behavior changed.
- Content Hub remains the post and media source of truth.

## QA Focus

- Arabic strategy documents should not show raw funnel labels like `Awareness`, `Consideration`, or `Conversion`.
- Proper platform names such as Instagram, LinkedIn, and YouTube Shorts may remain as product names.
- The page should remain read-only, with no generation or product mutation during QA.
