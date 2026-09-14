# PACT Delphi — Round 2 ranking instrument

A single-page instrument for Round 2 of the PACT Delphi. Round 1 asked
panellists for three independent 1–5 ratings of each of the 17 Erasmus V6
cognitive tasks, which left the eligible set larger than the final taxonomy and
gave no ordering within it. Reviewers asked for a validation round, so Round 2
asks each panellist for a single complete ordering of all 17 tasks: position 1
is the highest priority for inclusion, position 17 the lowest.

Live at https://pact-delphi-round2.vercel.app

## Where this sits among the PACT repositories

| Repository | Role |
| --- | --- |
| [expert-case-review-PACT](https://github.com/perezcodex/expert-case-review-PACT) | The **Round 1** instrument — panellists rated each task on three 1–5 scales |
| **this repository** | The **Round 2** instrument — panellists rank all 17 tasks against one another |
| [PACT_Delphi](https://github.com/Aschoeff613/PACT_Delphi) | The **analysis** — R pipeline for consensus and agreement statistics. No interface code |
| [PACT_Literature_Review](https://github.com/Aschoeff613/PACT_Literature_Review) | Task taxonomy derivation, including `taxonomy/pact_17_tasks.json` |

Deployed separately from the Round 1 instrument but against the **same Supabase
project** — the `reviewers` table is shared, so a Round 2 ranking joins to that
panellist's Round 1 ratings on `reviewer_id`.

---

## How a panellist reaches it

There is no login. Each invitation links to the panellist's own code:

```
https://<deployment>/?r=R3CCB3F
```

The code is resolved server-side against `reviewers.code`, so the page itself
is only the ranking. If the query string is lost, `/` asks for the code rather
than accepting an unattributable submission.

This means **the link is the credential** — anyone holding it can submit as
that panellist. That is the usual trade-off for emailed survey links, and it is
the reason Round 1 codes should not be circulated in a shared inbox or a group
thread. If that is not acceptable, add a last-name confirmation step: Round 1
already validated code + last name, and `reviewers.last_name` is populated.

## Interaction

- 17 full-width bars, longest at rank 1, dragged to reorder
- Arrow keys, or the ↑/↓ buttons, move a focused bar one slot
- Hovering a task name pops out its definition and both worked examples
  (Emergency Department and Primary Care); clicking pins the card open
- Nothing saves until submit — a ranking is only meaningful complete
- Panellists may return and revise until the round closes

## Setup

```bash
npm install
cp .env.example .env.local   # fill in from the Round 1 Supabase project
npm run dev
```

`SUPABASE_SERVICE_ROLE_KEY` is read only in server code (`lib/supabase.ts`,
used by the page and the submit route), so it never reaches the browser. There
is no `NEXT_PUBLIC_` anon key because the client never talks to Supabase
directly.

## Database

Apply `supabase/migrations/001_round2_rankings.sql` to the Round 1 Supabase
project before deploying. It is not applied by the build. It creates:

- `round2_rankings` — one row per panellist × task, with `rank` 1–17 and the
  `initial_rank` the task held in that panellist's randomised start order
- `save_round2_ranking()` — writes a whole ranking atomically

Constraints make a stored ranking a true permutation: unique `(reviewer_id,
task_code)` and unique `(reviewer_id, rank)`. A revision is a delete-then-insert
inside the function, so permuting ranks cannot trip the uniqueness check
mid-write.

## Getting the data out for analysis

```sql
select
  rev.code  as reviewer_code,
  rev.display_name,
  rev.institution,
  rr.task_code,
  rr.task_name,
  rr.rank,
  rr.initial_rank,
  rr.submitted_at
from round2_rankings rr
join reviewers rev on rev.id = rr.reviewer_id
order by rev.code, rr.rank;
```

Long format, one row per panellist × task — the shape `R/02_load_clean.R` in
[PACT_Delphi](https://github.com/Aschoeff613/PACT_Delphi) already reads. Note
that the existing loader expects the three Round 1 rating columns and will
reject this file until a Round 2 loader is added; the ranking statistics (mean
rank, Kendall's W, Borda aggregation) are not yet written.

## Task wording

`lib/tasks.ts` hardcodes all 17 tasks — title, guiding question, definition,
and both case seeds — so the instrument shows identical text regardless of
database state, and does not depend on Round 1's `cases` and `sections` tables
continuing to exist. Titles, questions and definitions come from
[`PACT_Literature_Review/taxonomy/pact_17_tasks.json`](https://github.com/Aschoeff613/PACT_Literature_Review/blob/main/taxonomy/pact_17_tasks.json); the case seeds come from
the Round 1 instrument (`PACT_EMC_V6_Tasks_CaseSeeds_1.xlsx`, sheet
`Cognitive Tasks`). `taskCode` is load-bearing — the R analysis orders tasks by
its numeric suffix.
