# CREATIVE-STUDIO2 — Editable Draft Controls

## Purpose

CREATIVE-STUDIO2 turns the read-only per-post Creative Studio preview into a lightweight local review tool. The user can adjust the draft headline, CTA, brand label, accent color, and layout emphasis while staying inside the Creative Brief planner.

This is still a planning surface, not an execution surface.

## Product Truth

- The controls update the in-browser draft preview only.
- The preview remains a transient SVG artifact.
- Missing backgrounds render as a neutral placeholder, not a broken dark block.
- Long Arabic/English text must wrap inside editable layer safe zones.
- Edits are not saved, uploaded, rendered, exported, or attached.
- No SocialPost, Media, GeneratedVisual, campaign.aiOutput, or Brand Brain record is mutated.
- Content Hub remains the final post media source of truth.
- A future render step must require explicit confirmation, cost review, and a clear no-publish/no-schedule contract.
- A future attach step must happen from Content Hub with explicit user confirmation.

## Controls

- Headline text: local editable layer override.
- CTA text: local editable layer override.
- Brand label: local text fallback for the logo/brand layer.
- Accent color: local brand accent override using a safe hex color.
- Layout balance: local visual emphasis preset for the transient preview.
- Reset local draft: removes the local override for the selected post.

## Non-Goals

- No render/upload pipeline.
- No image generation.
- No Creative Studio persistence.
- No media attachment.
- No publish, schedule, manual publish, Autopilot, or paid launch behavior.
- No billing or credit behavior change.
- No schema or API route change.

## QA Contract

Browser QA should confirm:

- Creative Brief page loads with real Content Hub posts.
- Draft controls appear in the Creative Studio preview card.
- Editing headline/CTA/brand/accent/layout updates the preview locally.
- The preview does not show a broken full-blue/full-dark block when a post has no background yet.
- Edited Arabic headline/CTA text stays readable inside the preview bounds.
- Reset local draft restores the base preview.
- No save, render, upload, export, attach, publish, or schedule actions are exposed by the controls.
- Console remains clean.
- Mobile 390px has no horizontal overflow.
