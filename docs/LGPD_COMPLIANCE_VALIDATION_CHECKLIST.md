# LGPD Compliance Validation Checklist

## Functional checks
- [ ] Signup requires acceptance of legal terms.
- [ ] Signup stores legal acceptance versions in `legal_acceptances`.
- [ ] Legal documents can be versioned in Admin and are readable in public dialogs.
- [ ] Cookie banner appears on first visit and allows category selection.
- [ ] Cookie preferences dialog can reopen and update stored choice.
- [ ] Consent updates are synchronized to `cookie_consents`.
- [ ] Contact form supports LGPD request categories and returns protocol.
- [ ] Data subject requests are stored in `data_subject_requests`.

## Security/privacy checks
- [ ] Edge functions no longer log direct PII (email/phone/name/tokens).
- [ ] CORS in touched functions is origin-aware (not blanket wildcard behavior).
- [ ] IP and user-agent are stored only as hash where applicable.
- [ ] Error responses do not leak sensitive internals.

## Telemetry checks
- [ ] GA script is only initialized through consent-aware telemetry wrapper.
- [ ] Analytics preference toggling updates runtime behavior.
- [ ] Sentry privacy tags are updated when consent changes (if Sentry exists at runtime).

## Database/governance checks
- [ ] New tables exist with RLS and basic policies:
  - `legal_documents`
  - `legal_acceptances`
  - `cookie_consents`
  - `data_subject_requests`
- [ ] Legal settings include DPO channel and document versions.
- [ ] `handle_new_user()` persists legal acceptance metadata.

## Operational checks
- [ ] `ALLOWED_ORIGINS` is set in production.
- [ ] `PRIVACY_HASH_SALT` is rotated and environment-managed.
- [ ] DPO channel data (email/canal) is configured in Admin.
- [ ] Retention policy defined for `cookie_consents` and `data_subject_requests`.

## Legal sign-off (non-technical)
- [ ] Final text of Terms of Use approved.
- [ ] Final Privacy Policy approved.
- [ ] Final Cookie Policy approved.
- [ ] Lawful basis and consent model validated by legal counsel.

