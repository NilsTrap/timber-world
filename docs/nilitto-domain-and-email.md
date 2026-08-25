# Nilitto identity, domains, DNS, and email

_Authoritative agent context. Last verified 2026-08-25._

## Identity and naming

- Company/product: **Nilitto**.
- Portal: **Nilitto Trading Platform**.
- Primary domain: **`nilitto.com`** — exact spelling, with double `t`.
- Canonical staging portal: **https://staging.nilitto.com**.
- Use the new identity in new user-facing text. Preserve existing technical identifiers (`timber-world`, `nils-timber`, `timber-portal-staging`, `feature/timber-spec-phase`, `@timber/*`, database/schema names) unless Edgars explicitly requests a planned migration.
- The login heading and sidebar fallback are already `Nilitto Trading Platform`; the former login subtitle was removed.

## Environment map

| Purpose | Current value |
|---|---|
| Cloudflare zone | `nilitto.com`, Nils's Cloudflare account |
| Staging hostname | `staging.nilitto.com` |
| Staging DNS target | DNS-only A record to `76.76.21.21`, TTL Auto |
| Vercel project | `timber-portal-staging` |
| Vercel scope | `nils-projects-ee818bb8` |
| Staging branch | `feature/timber-spec-phase` |
| Staging Supabase | `fyzrtqsnmnizoxgcqsjc` |
| Production | Frozen; do not change without explicit coordinated approval |

Always inspect `.vercel/project.json` before deployment. Deploy from the repository root, then verify the Vercel deployment is Ready and exercise the canonical `staging.nilitto.com` URL.

## Email architecture

Keep employee and application mail separated:

- **Employee inboxes:** Google Workspace using `person@nilitto.com`.
- **Transactional Timber/Nilitto mail:** Resend using `noreply@mail.nilitto.com`.
- Resend is sending-only; there are no application inboxes on `mail.nilitto.com`.
- Do not move application mail to the apex or replace the Resend records when enabling Gmail.

### Resend

- Verified sending domain: `mail.nilitto.com`, region `eu-west-1`.
- Sender contract: `Nilitto Trading Platform <noreply@mail.nilitto.com>`.
- Staging Vercel variables: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL`.
- Current internal recipient: `nils@nils.lv`.
- Scoped token source: Vault `secret/agents/nilitto/resend`, field `token`.
- The token must go directly from Vault to Vercel/process input. Never print, log, chat, email, commit, or write it to a repository `.env` file.
- A controlled test to `edgars@ideajetlab.com` was received successfully; SPF and DKIM both passed.

Current Resend DNS records, all DNS-only with TTL Auto:

| Type | Name | Target/value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey.mail` | Resend-provided DKIM public key; inspect Cloudflare/Resend rather than copying it into documentation | — |
| MX | `send.mail` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | — |

### Google Workspace employee mail

Cloudflare preparation already completed:

| Type | Name | Target/value | Priority |
|---|---|---|---|
| MX | `@` | `smtp.google.com` | 1 |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | — |

Still required from Nils/Google Admin:

1. Create the Google Workspace tenant for `nilitto.com`.
2. Provide Google's domain-verification TXT record name and complete value.
3. Activate Gmail for `nilitto.com`.
4. In Google Admin, generate a 2048-bit DKIM key under Gmail authentication.
5. Provide the DKIM selector/name (normally `google._domainkey`) and complete TXT value.
6. After DNS is added and propagated, activate DKIM signing and send/receive a controlled test.
7. Create licensed employee users. Use aliases or Google Groups for role addresses that do not need independent inboxes, such as `info@nilitto.com` or `sales@nilitto.com`.
8. Add DMARC only after Google and Resend authentication are verified. Start in monitoring mode and use an established report mailbox before increasing enforcement.

Never request or accept employee passwords. DNS TXT records are public configuration and may be supplied in chat; credentials and recovery codes may not.

## Verification checklist

- Re-read live Cloudflare records before making changes; documentation can drift.
- Confirm `staging.nilitto.com` resolves and returns HTTPS successfully.
- Confirm the apex has exactly one SPF TXT policy; merge authorized senders rather than creating a second SPF record.
- Do not remove or repurpose `send.mail.nilitto.com`; it handles Resend/SES feedback.
- Verify Gmail inbound delivery, Google DKIM/SPF, and Resend DKIM/SPF independently.
- API acceptance is not enough: confirm actual inbox receipt and inspect authentication results.

Useful authoritative checks:

```bash
dig MX nilitto.com @anahi.ns.cloudflare.com +short
dig TXT nilitto.com @anahi.ns.cloudflare.com +short
dig MX send.mail.nilitto.com @anahi.ns.cloudflare.com +short
dig TXT send.mail.nilitto.com @anahi.ns.cloudflare.com +short
```

## Secure handoff request to Nils

Ask Nils to return only:

- Google domain-verification TXT name and value.
- Google DKIM TXT name/selector and complete value.
- Confirmation that Gmail has been activated.
- The desired employee addresses and which should be paid users, aliases, or Groups.

Do not ask him to send passwords, API keys, recovery codes, or Workspace administrator credentials.
