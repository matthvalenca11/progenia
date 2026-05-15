# LGPD Data Flow Audit - ProGenia

## Scope
- Frontend React/Vite (`src/`)
- Supabase Edge Functions (`supabase/functions/`)
- Legal and consent persistence in Postgres (`supabase/migrations/`)

## Personal data processed
- Identification: `full_name`, `email`, `phone`, `institution`
- Profile/compliance: `birth_date`, `gender`, `city`, `state_uf`, `country`, `education_level`, `profession`
- Security/account recovery: verification/reset tokens and expirations
- Support/contact: free text messages and request type
- Consent/audit: legal acceptance versions, cookie preferences, protocol metadata

## Data flow summary
1. User signs up via `Auth.tsx` and sends profile + legal acceptance metadata to Supabase Auth.
2. `handle_new_user()` trigger creates profile and stores legal acceptance records (`legal_acceptances`).
3. Cookie preferences are stored locally and synchronized via `save-cookie-consent` Edge Function into `cookie_consents`.
4. Contact form writes LGPD requests into `data_subject_requests` and sends email notification.
5. AI tutor and email functions interact with third parties (Groq/Resend), with reduced response/log detail.

## Key risks found and addressed
- PII leakage in logs (email/name/user ids/tokens) in multiple Edge Functions.
  - Mitigation: removed direct PII logs and replaced with generic error messages.
- No structured legal document versioning/audit acceptance table.
  - Mitigation: added `legal_documents`, `legal_acceptances`.
- No formal cookie consent persistence trail.
  - Mitigation: added `cookie_consents` + frontend consent provider + backend persistence function.
- No explicit LGPD request protocol in contact flow.
  - Mitigation: added request protocol generation and `data_subject_requests` table.
- CORS wildcard broad exposure.
  - Mitigation: added origin-aware CORS helper in touched functions (`_shared/privacy.ts`).

## Residual risks
- External trackers configured outside repository (hosting panel/GTM) can bypass app consent logic.
- Existing historical logs outside application control may still contain prior PII.
- Legal text quality and legal basis still require formal legal review by counsel/DPO.

