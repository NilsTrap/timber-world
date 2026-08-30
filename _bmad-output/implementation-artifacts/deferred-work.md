# Deferred work

- Specification mutations currently authorize before the final database write. A future hardening task should move lifecycle authorization and optimistic concurrency into an atomic database boundary across all specification mutations, not only catalogue-line editing.
