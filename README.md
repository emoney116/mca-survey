# MCA Survey

A standalone mobile-first Next.js app for Metrolina Christian Academy Baseball players to rank fall development goals and for coaches to review results.

## Routes

- `/` - player survey
- `/admin` - password-protected coach dashboard

## Local Setup

```bash
npm install
$env:ADMIN_PASSWORD="metrolina-dev-password"
$env:ADMIN_SESSION_SECRET="local-dev-session-secret"
npm run dev
```

Without Supabase env vars, local development uses `data/dev-responses.json` so the full flow can be tested. Production requires Supabase.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260817000000_initial_schema.sql` in the Supabase SQL editor, or apply it through the Supabase CLI.
3. Add these Vercel environment variables:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SURVEY_ID
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
NEXT_PUBLIC_SURVEY_URL
```

`SUPABASE_SURVEY_ID` is optional if there is one active survey row. The migration includes one default active survey.

## Vercel

Recommended project name: `mca-survey`.

Set the environment variables above before production use. The Supabase service role key is only read by server routes and is never exposed to the browser.
