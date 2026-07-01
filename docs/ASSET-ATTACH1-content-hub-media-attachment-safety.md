# ASSET-ATTACH1 — Content Hub Media Attachment Safety

## Audit Finding

Content Hub is the source of truth for post copy, lifecycle status, and post-linked media. The previous existing-media picker could attach a Media Library asset to a SocialPost immediately when a tile was clicked. That made the mutation too easy to trigger and left the server trusting client-provided `uploadedMediaId` / `imageUrl` pairs.

## Source Of Truth

- `SocialPost.imageUrl` is the final preview media URL shown in Content Hub.
- `SocialPost.uploadedMediaId` points to an uploaded `Media` asset when the post uses a library asset.
- `Media` remains the workspace asset library.
- `GeneratedVisual` remains campaign concept or generated visual output. It is not automatically final post media.
- Content Hub remains the final post preview and post-linked media decision surface.

## What Changed

- Existing-media selection now prepares a pending attachment instead of mutating the post on tile click.
- Attach and replace actions require an explicit confirmation checkbox before the post is patched.
- Remove media is an explicit action with confirmation copy.
- Removing post media clears the post-linked media preview only; it does not delete the Media Library asset.
- The post PATCH route validates uploaded media ownership server-side.
- When `uploadedMediaId` is provided, the server resolves `imageUrl` from the Media row and ignores any client-provided URL.
- Campaign-specific media from another campaign is rejected.
- Workspace-level media with no campaign link is allowed.
- Media deletion is blocked when any SocialPost still references the asset through `uploadedMediaId`.
- Content Hub cards show safe source badges such as No media, Uploaded asset, and Generated image.

## What Did Not Change

- No publishing, scheduling, manual publish, Autopilot, paid launch, platform push, or engine behavior changed.
- No billing or global credit logic changed.
- No schema or migration was added.
- Existing image generation behavior remains unchanged.
- Existing SocialPost rows and campaign output are not migrated or rewritten.

## Generated Visuals Vs Post Media

Per-post generated images may create `GeneratedVisual` records and copy their URL to `SocialPost.imageUrl`. This PR keeps that behavior and labels generated post media conservatively when the post is visibly using generated media. A heavier direct `SocialPost -> GeneratedVisual` provenance relationship is deferred.

## Media Library Relationship

`/media` remains storage-first: upload, preview, Brand It, copy URL, and delete. It is not the final post preview surface. Deleting an asset now refuses to proceed while posts still reference it.

## QA Plan

Read-only / modal-only Browser QA:

- Confirm Content Hub state remains 1 manually published post and 7 scheduled posts not published.
- Open Choose existing media and verify the picker opens without a PATCH.
- Select an asset only on preview/staging if safe and verify it opens attach/replace confirmation before mutation.
- Do not click final attach, replace, or remove.
- Verify media source badges show No media / Media pending for current posts.
- Verify `/media` remains asset-library oriented.
- Verify credits do not change.
- Verify no generation, upload, publish, schedule, manual publish, Autopilot, paid launch, platform push, or engine endpoints are called.
