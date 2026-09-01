# Deferred work

- Specification mutations currently authorize before the final database write. A future hardening task should move lifecycle authorization and optimistic concurrency into an atomic database boundary across all specification mutations, not only catalogue-line editing.
- The global portal shell does not automatically collapse its desktop sidebar at phone widths. Project cards wrap correctly after manual collapse, but the expanded shell leaves too little content width; address this as an application-shell responsive task rather than inside project cards.
- `projects-workspace.test.ts` has a pre-existing brittle source-text assertion for quotation targets (`targetType:"line"` / `targetType:"process"`) that fails against the current spaced TypeScript formatting. Replace it with a formatting-independent assertion or behavioral test.
