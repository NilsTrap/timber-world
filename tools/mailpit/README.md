# Mailpit for agent UI-flow tests

This is a private, local mail capture service for Nilitto's agent UI-flow tests. It must never be exposed publicly and must never be used by production.

Start it from this directory:

```sh
docker compose up -d
```

Set `NILITTO_TEST_MAILPIT_URL=http://127.0.0.1:8027` for the portal process. Invitation e-mails will then be captured by Mailpit instead of being sent through Resend.

Mailpit's browser UI and API are available locally on port 8027. The SMTP listener is available locally on port 1027 for future mail paths that use SMTP. These non-default ports avoid colliding with other local projects.

For an isolated staging test environment, keep the same boundary: run Mailpit on a private network, configure the portal's test-only URL there, and do not set that value in production.
