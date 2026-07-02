# POST-MEDIA-STATE1 — Media Readiness Consistency

## Context

POST-MEDIA-STATE-CONSISTENCY-AUDIT1 found a legacy Content Hub state where some posts had a visible `imageUrl` while `generationStatus` was still `PENDING`.

Observed campaign:

- Campaign: `cmqw8ayo60006eh64tu66em3b`
- State: 1 manually published post, 7 scheduled posts not published
- Media Library: no uploaded assets
- GeneratedVisual rows: only old campaign concept visuals, not post-linked media
- SocialPosts #1 and #2: `imageUrl` present, `uploadedMediaId = null`, `mediaSource = GENERATE`, `generationStatus = PENDING`
- SocialPosts #3-#8: no `imageUrl`, `mediaSource = GENERATE`, `generationStatus = PENDING`

The UI correctly kept readiness at `0 / 8`, but the card badge still said `Post media`, which made the visible preview look more final than the readiness count allowed.

## Source Of Truth

Content Hub now separates preview visibility from confirmed readiness:

- `imageUrl` controls whether a preview can be displayed.
- `generationStatus = DONE` confirms readiness.
- `uploadedMediaId + imageUrl + DONE` confirms an uploaded asset is ready.
- `mediaSource = GENERATE + imageUrl + DONE` confirms a generated image is ready.
- `imageUrl + PENDING` remains visible, but is treated as an ambiguous preview and does not count as ready.

## Media States

The shared helper derives these states:

- `no_media`: no `imageUrl`; not ready.
- `uploaded_ready`: uploaded media is linked and readiness is confirmed.
- `generated_ready`: generated image is confirmed ready.
- `ambiguous_preview_pending`: preview is visible but generation or attachment readiness is not confirmed.
- `generic_post_media`: post media exists with confirmed readiness but without a more specific uploaded/generated source.

Only confirmed ready states count toward the Content Hub media readiness progress.

## UI Behavior

For ambiguous legacy rows, Content Hub now shows:

- EN: `Media preview — readiness pending`
- AR: `معاينة وسائط — الجاهزية قيد التأكيد`

The readiness summary can also show:

- EN: `0 / 8 media ready · 2 media previews need confirmation`
- AR: `0 / 8 وسائط جاهزة · 2 معاينات تحتاج تأكيد الجاهزية`

This preserves the visible preview while making it clear that it is not counted ready.

## No Data Repair

This PR does not mutate existing `SocialPost`, `Media`, or `GeneratedVisual` rows. The existing legacy rows are displayed conservatively until a future explicit media action confirms readiness.

## Future One-Image QA

Future controlled one-image QA should avoid the legacy ambiguous post #2 and use the clean no-media candidate:

- `cmqy4rgbc00041221gdbgqkhe`

If image generation succeeds for that post, expected state is:

- `imageUrl` present
- `mediaSource = GENERATE`
- `generationStatus = DONE`
- Badge: `Generated image`
- Readiness count increments by 1

## Validation Plan

- Unit-test the shared media-state helper.
- Keep the existing media attachment/source label tests passing.
- Verify Content Hub counts only confirmed ready media.
- Verify ambiguous previews are counted separately and do not count ready.
- Run type-check and build.
