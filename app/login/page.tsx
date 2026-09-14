import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { createReviewerSession, getReviewerSession } from "@/lib/reviewer-session";

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
};

// Institutions shown in the dropdown — extend as needed
const INSTITUTIONS = [
  "Stanford Medicine",
  "Beth Israel Deaconess Medical Center",
  "Harvard Medical School",
  "Massachusetts General Hospital",
  "Brigham and Women's Hospital",
  "UCSF Health",
  "UCLA Health",
  "NYU Langone Health",
  "Johns Hopkins Medicine",
  "Columbia University Irving Medical Center",
  "Weill Cornell Medicine",
  "Mayo Clinic",
  "Cleveland Clinic",
  "Duke Health",
  "Vanderbilt University Medical Center",
  "University of Washington Medicine",
  "University of Michigan Health",
  "Northwestern Medicine",
  "Emory Healthcare",
  "University of Chicago Medicine",
  "Mount Sinai Health System",
  "Other",
];

function buildReviewerCode() {
  return `R${randomBytes(3).toString("hex").toUpperCase()}`;
}

type ReviewerIdentity = {
  id: string;
  display_name: string;
  last_name: string;
  locked_at: string | null;
  created_at: string;
};

// Strip everything but letters and digits so "priyank_jain", "Priyank Jain" and
// "priyankjain" all reduce to the same key. The panel is small enough that a
// collision between two different people is not a practical concern, and
// sign-in is keyed on name anyway.
function identityKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The reviewer panel is a few dozen rows, so matching in JS is cheaper than
// getting `ilike` right: `_` is a LIKE wildcard, and PostgREST's single-object
// mode returns a 406 whenever two rows share a name.
async function findReviewersByKey(
  admin: ReturnType<typeof createAdminClient>,
  key: string
): Promise<ReviewerIdentity[] | null> {
  const { data, error } = await admin
    .from("reviewers")
    .select("id, display_name, last_name, locked_at, created_at")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return null;
  }

  return (data as ReviewerIdentity[]).filter(
    (row) => identityKey(`${row.display_name}${row.last_name}`) === key
  );
}

// Duplicate registrations used to lock a reviewer out permanently. When they
// exist, return the account holding the most work so the reviewer lands back on
// their real progress; `matches` is ordered oldest-first, so ties keep the
// original account.
async function pickMostAdvanced(
  admin: ReturnType<typeof createAdminClient>,
  matches: ReviewerIdentity[]
): Promise<ReviewerIdentity> {
  if (matches.length === 1) {
    return matches[0];
  }

  const ids = matches.map((row) => row.id);
  const counts = new Map<string, number>();

  // Round 1 ratings are the best signal of which duplicate is the real
  // account. If that table is gone, fall through on Round 2 rankings, and if
  // neither is readable keep the oldest account rather than failing.
  for (const table of ["ratings", "round2_rankings"] as const) {
    const { data: rows, error } = await admin
      .from(table)
      .select("reviewer_id")
      .in("reviewer_id", ids);

    if (error || !rows) continue;

    for (const row of rows as { reviewer_id: string }[]) {
      counts.set(row.reviewer_id, (counts.get(row.reviewer_id) ?? 0) + 1);
    }
    if (counts.size > 0) break;
  }

  return matches.reduce(
    (best, current) => ((counts.get(current.id) ?? 0) > (counts.get(best.id) ?? 0) ? current : best),
    matches[0]
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const session = await getReviewerSession();

  if (session) {
    redirect(params.redirectTo || "/");
  }

  async function register(formData: FormData) {
    "use server";

    // Refuse before touching the database: without settings this would throw a
    // server exception, which reaches the panellist as an opaque error page.
    if (!isSupabaseConfigured()) {
      redirect(`/login?error=not_configured&redirectTo=${encodeURIComponent(String(formData.get("redirectTo") || "/"))}`);
    }

    // display_name stores first name only
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const institution = String(formData.get("institution") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const redirectTo = String(formData.get("redirectTo") || "/");
    const admin = createAdminClient();

    if (!firstName || !lastName || !email || !institution || !title) {
      redirect(`/login?error=missing_registration_fields&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    // Reviewers who are unsure whether they already signed up tend to register a
    // second time. That used to create a duplicate name row, which then broke
    // the returning login for good — so adopt the existing account instead.
    const existing = await findReviewersByKey(admin, identityKey(`${firstName}${lastName}`));

    if (existing && existing.length > 0) {
      const reviewer = await pickMostAdvanced(admin, existing);

      if (reviewer.locked_at) {
        redirect(`/login?error=locked&redirectTo=${encodeURIComponent(redirectTo)}`);
      }

      await admin
        .from("reviewers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", reviewer.id);

      await createReviewerSession(reviewer.id);
      redirect(redirectTo);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = buildReviewerCode();
      const { data: createdReviewer, error } = await admin
        .from("reviewers")
        .insert({
          code,
          display_name: firstName,
          last_name: lastName,
          email,
          institution,
          // Column is `title`; the form asks for "Department". Round 1 used the
          // same column for department or job title, and the analysis export
          // reads it by column name, so the column keeps its name.
          title
        })
        .select("id")
        .single();

      if (!error && createdReviewer) {
        await createReviewerSession(createdReviewer.id);
        redirect(redirectTo);
      }

      if (error?.code !== "23505") {
        redirect(`/login?error=registration_failed&redirectTo=${encodeURIComponent(redirectTo)}`);
      }
    }

    redirect(`/login?error=registration_failed&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  async function signIn(formData: FormData) {
    "use server";

    // Refuse before touching the database: without settings this would throw a
    // server exception, which reaches the panellist as an opaque error page.
    if (!isSupabaseConfigured()) {
      redirect(`/login?error=not_configured&redirectTo=${encodeURIComponent(String(formData.get("redirectTo") || "/"))}`);
    }

    // Username format: first_last (e.g. jane_smith). Spacing, capitalisation and
    // punctuation are all forgiven — only the letters and digits have to match.
    const username = String(formData.get("username") || "").trim();
    const redirectTo = String(formData.get("redirectTo") || "/");
    const admin = createAdminClient();

    const key = identityKey(username);
    if (!key) {
      redirect(`/login?error=missing_return_fields&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    const matches = await findReviewersByKey(admin, key);

    if (!matches) {
      redirect(`/login?error=lookup_failed&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    if (matches.length === 0) {
      redirect(`/login?error=invalid_identity&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    const reviewer = await pickMostAdvanced(admin, matches);

    if (reviewer.locked_at) {
      redirect(`/login?error=locked&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    await admin
      .from("reviewers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", reviewer.id);

    await createReviewerSession(reviewer.id);
    redirect(redirectTo);
  }

  return (
    <div className="login-wrap">
      <div className="login-panel">
        {params.error === "missing_registration_fields" && (
          <p className="error-banner">
            Please fill in your first name, last name, email, institution and department to register.
          </p>
        )}
        {params.error === "missing_return_fields" && (
          <p className="error-banner">Enter your username in first_last format (e.g. jane_smith).</p>
        )}
        {params.error === "invalid_identity" && (
          <p className="error-banner">Username not recognised. Check the format is first_last and matches your registration.</p>
        )}
        {params.error === "locked" && (
          <p className="error-banner">This account has been locked. Contact the study team.</p>
        )}
        {params.error === "not_configured" && (
          <p className="error-banner">
            This round is not open yet — the survey has not been connected to its database.
            Please contact the study team rather than trying again.
          </p>
        )}
        {params.error === "registration_failed" && (
          <p className="error-banner">Registration failed. Please try again.</p>
        )}
        {params.error === "lookup_failed" && (
          <p className="error-banner">
            We could not reach the reviewer records just now. Please try again in a moment.
          </p>
        )}

        <div className="login-layout">
          {/* ── Study overview & consent ─────────────────────────── */}
          <section className="login-overview">
            <div className="eyebrow">Round 2 — Reviewer access</div>
            <h2>Register once. Return with your first_last username.</h2>
            <p>
              New panelists fill in the registration form once. To return on any device, log in with your
              username in <strong>first_last</strong> format — for example, <code>jane_smith</code>.
            </p>
            <div className="consent-panel">
              <p>
                This survey is part of the PACT project (Physician-AI Collaboration Teaming), an ARPA-H funded
                collaboration between Stanford University and Beth Israel Deaconess Medical Center.
                We are conducting a modified Delphi process to identify high-risk clinical cognitive tasks
                for physician-AI collaboration benchmarking. This is <strong>Round 2</strong>: having rated
                the tasks individually in Round 1, you are now asked to rank all 17 against one another.
              </p>
              <p>
                Your participation involves 2–3 short surveys over ~8 weeks rating and ranking candidate tasks.
                Responses are anonymous and reported in aggregate only. Participation is voluntary and you may
                stop at any time.
              </p>
              <p>Questions? Contact Austin Schoeffler at austin_schoeffler@stanford.edu.</p>
              <p><strong>By continuing you confirm that you have read this information and consent to participate.</strong></p>
            </div>
          </section>

          <div className="login-actions">
            {/* ── Registration ─────────────────────────────────── */}
            <section className="login-card">
              <div className="eyebrow">First time</div>
              <h3>Create your reviewer access</h3>
              <p>After registering you will be logged in automatically. To return later, use your first_last username. If you took part in Round 1, register with the same name and you will be returned to your existing record.</p>
              <form action={register}>
                <input type="hidden" name="redirectTo" value={params.redirectTo || "/"} />
                <label className="field-block">
                  <span>First name</span>
                  <input type="text" name="firstName" required placeholder="Jane" autoComplete="given-name" />
                </label>
                <label className="field-block">
                  <span>Last name</span>
                  <input type="text" name="lastName" required placeholder="Smith" autoComplete="family-name" />
                </label>
                <label className="field-block">
                  <span>Email</span>
                  <input type="email" name="email" required placeholder="you@example.org" autoComplete="email" />
                </label>
                <label className="field-block">
                  <span>Institution</span>
                  <select name="institution" defaultValue="" required>
                    <option value="" disabled>Select institution</option>
                    {INSTITUTIONS.map((inst) => (
                      <option key={inst} value={inst}>{inst}</option>
                    ))}
                  </select>
                </label>
                <label className="field-block">
                  <span>Department</span>
                  <input type="text" name="title" required placeholder="Emergency Medicine" />
                </label>
                <button className="primary-button" type="submit">Begin Round 2</button>
              </form>
            </section>

            {/* ── Returning sign-in ─────────────────────────────── */}
            <section className="login-card compact">
              <div className="eyebrow">Returning reviewer</div>
              <h3>Log in with your username</h3>
              <p>
                Enter your username in <strong>first_last</strong> format — the same first and last name
                you registered with, joined by an underscore. Example: <code>jane_smith</code>
              </p>
              <form action={signIn}>
                <input type="hidden" name="redirectTo" value={params.redirectTo || "/"} />
                <label className="field-block">
                  <span>Username</span>
                  <input
                    type="text"
                    name="username"
                    required
                    placeholder="jane_smith"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
                <button className="primary-button" type="submit">Continue</button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
