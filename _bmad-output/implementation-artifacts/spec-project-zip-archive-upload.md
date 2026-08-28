# Project ZIP archive upload

Status: implemented and locally verified

## Intent

Allow project users with file-upload access to upload one ZIP archive and have it extracted server-side into the currently selected project folder while preserving the archive's internal folder structure.

## Boundaries

- ZIP only; maximum compressed size 100 MB.
- Maximum 1,000 extracted files and 250 MB total expanded size.
- Reject unsafe paths, duplicate paths, file/folder conflicts, and collisions with existing project content.
- Upload the archive once, extract it on the server, and remove the temporary archive afterward.
- Keep existing individual-file and folder-upload behavior unchanged.

## Verification

- Portal workspace checks: 188 passed.
- Monorepo type-check: 8 of 8 packages passed.
- Local browser test: a ZIP containing `root.txt` and `nested/deeper/item.txt` extracted successfully, with both files and nested folders visible in the project workspace and no browser warnings or errors.
