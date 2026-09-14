import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { REVIEWER_SESSION_COOKIE } from "@/lib/reviewer-session-constants";

const SESSION_TTL_DAYS = 30;

export type Reviewer = {
  id: string;
  code: string;
  display_name: string;
  last_name: string;
  email: string | null;
  institution: string | null;
  title: string | null;
  role: "reviewer" | "admin";
  locked_at: string | null;
};

export type ReviewerSession = {
  id: string;
  reviewer_id: string;
  expires_at: string;
  reviewer: Reviewer;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeReviewerCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function getReviewerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEWER_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  // Someone holding a session cookie from a configured deployment should see
  // the sign-in page, not a crashed layout, if the settings go missing.
  if (!isSupabaseConfigured()) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reviewer_sessions")
    .select(`
      id,
      reviewer_id,
      expires_at,
      reviewers (
        id,
        code,
        display_name,
        last_name,
        email,
        institution,
        title,
        role,
        locked_at
      )
    `)
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data || !data.reviewers) {
    return null;
  }

  return {
    id: data.id,
    reviewer_id: data.reviewer_id,
    expires_at: data.expires_at,
    reviewer: Array.isArray(data.reviewers) ? data.reviewers[0] : data.reviewers
  } satisfies ReviewerSession;
}

export async function createReviewerSession(reviewerId: string) {
  const admin = createAdminClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS).toISOString();

  const { error } = await admin.from("reviewer_sessions").insert({
    reviewer_id: reviewerId,
    token_hash: hashToken(token),
    expires_at: expiresAt
  });

  if (error) {
    throw new Error(error.message);
  }

  const cookieStore = await cookies();
  cookieStore.set(REVIEWER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export async function clearReviewerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEWER_SESSION_COOKIE)?.value;

  if (token) {
    const admin = createAdminClient();
    await admin.from("reviewer_sessions").delete().eq("token_hash", hashToken(token));
  }

  cookieStore.delete(REVIEWER_SESSION_COOKIE);
}
