import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Every query in this app is server-side (route handlers
 * and server components), so the key never reaches the browser and RLS on
 * round2_rankings can stay closed to anon.
 */
/**
 * Whether the Supabase settings are present.
 *
 * Deployed before its environment variables are set, this app would otherwise
 * crash with a server exception on the first write. Callers check this and show
 * a readable message instead.
 */
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/** Round 1 issued codes like `R3CCB3F`; normalise the same way it did. */
export function normalizeReviewerCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
