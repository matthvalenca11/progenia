# AI Tutor

The `ai-tutor` Edge Function powers the ProGenia tutor. It keeps the language model provider on the backend and never exposes API keys to the browser.

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
