# AI Tutor

The `ai-tutor` Edge Function powers the ProGenia tutor. It keeps the language model provider on the backend and never exposes API keys to the browser.

The tutor is a **learning guide**, not a passive FAQ. On each request it loads the learner's path (`module_enrollments`, lesson/capsule progress, lab usage, stats) and returns:

- a short next-step reply
- `suggestions` with exact ProGenia links (`/lesson/:id`, `/capsula/:id`, `/labs/:slug`, `/module/:id`)

The chat UI asks for the next step as soon as it opens, and exposes shortcuts for progress and untried labs.

On calm pages (`/dashboard`, modules, capsules list) it can also show a small non-blocking bubble above the tutor button. That nudge:

- waits a few seconds, never covers the lesson/lab itself
- appears at most once per session and about once per day
- skips a suggestion already offered in the last two weeks
- stays away for 3 days if dismissed, and for 2 hours after the person opens the chat
- can appear sooner after a lesson or capsule is completed, with the next relevant step

Use `intent: "nudge"` to get the suggestion without calling Groq.

## Request body

```json
{
  "message": "O que eu deveria fazer agora?",
  "conversationHistory": [],
  "userId": "optional-uuid",
  "intent": "open | next | progress | explore | chat",
  "language": "pt | en"
}
```

## Providers

- `GROQ_API_KEY` is required and is used for the final conversational response.
- `OPENEVIDENCE_API_KEY` is optional. When configured, the function queries OpenEvidence for biomedical/evidence-oriented questions and injects the returned evidence as complementary context.
- PubMed/NCBI E-utilities are used as the open evidence fallback. They work without an API key for low-volume usage.

Provider order for biomedical/evidence-oriented questions:

1. OpenEvidence, if `OPENEVIDENCE_API_KEY` is configured and the API succeeds.
2. PubMed/NCBI, if OpenEvidence is unavailable or not configured.
3. ProGenia catalog only, if no external evidence provider returns useful results.

## Optional OpenEvidence settings

```bash
supabase secrets set OPENEVIDENCE_API_KEY="..."
supabase secrets set OPENEVIDENCE_BASE_URL="https://api.openevidence.com/v1"
supabase secrets set OPENEVIDENCE_SPECIALTY="physical_medicine_rehabilitation"
supabase functions deploy ai-tutor
```

`OPENEVIDENCE_BASE_URL` and `OPENEVIDENCE_SPECIALTY` are optional. Keep `OPENEVIDENCE_SPECIALTY` unset if the API account does not support specialty filters or if the tutor should query broadly.

## Optional PubMed/NCBI settings

PubMed/NCBI does not require a key for basic use, but NCBI recommends identifying the tool and email. `NCBI_API_KEY` is optional and increases allowed request rate.

```bash
supabase secrets set NCBI_TOOL="ProGeniaAITutor"
supabase secrets set NCBI_EMAIL="your-email@example.com"
supabase secrets set NCBI_API_KEY="optional-ncbi-key"
supabase functions deploy ai-tutor
```

Optional tuning:

```bash
supabase secrets set PUBMED_RETMAX="5"
supabase secrets set NCBI_EUTILS_BASE_URL="https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
```

## Safety behavior

External evidence context is used only as educational support. The system prompt instructs the model not to provide individualized prescriptions or replace professional clinical evaluation.
