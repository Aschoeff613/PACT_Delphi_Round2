import { redirect } from "next/navigation";
import { RankingBoard } from "@/components/ranking-board";
import { TASKS, type RankingTask } from "@/lib/tasks";
import { getReviewerSession } from "@/lib/reviewer-session";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Deterministic per-reviewer shuffle of the start order.
 *
 * Presenting T1..T17 in codebook order would invite panellists to leave the
 * list as they found it, and that order is itself an artefact of Round 1. The
 * permutation is seeded from the reviewer id so it is stable across reloads --
 * someone who ranks half the list, leaves, and comes back does not find it
 * rearranged -- while differing between panellists.
 */
function shuffleForReviewer(items: RankingTask[], reviewerId: string): RankingTask[] {
  let seed = 0;
  for (const char of reviewerId) {
    seed = (seed * 31 + char.charCodeAt(0)) % 2147483647;
  }
  if (seed === 0) seed = 1;

  const next = () => {
    // Park-Miller: enough for a start order, and reproducible from the seed.
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default async function Page() {
  const session = await getReviewerSession();

  if (!session) {
    redirect("/login?redirectTo=/");
  }

  const reviewer = session.reviewer;
  const supabase = createAdminClient();

  const { data: saved, error: savedError } = await supabase
    .from("round2_rankings")
    .select("task_code, rank, initial_rank, submitted_at")
    .eq("reviewer_id", reviewer.id)
    .order("rank");

  if (savedError) {
    throw new Error(`Could not load your saved ranking: ${savedError.message}`);
  }

  const byCode = new Map(TASKS.map((task) => [task.taskCode, task]));

  // A saved ranking is restored in its saved order; anyone else gets the
  // randomised start order. Saved rows are filtered through the current task
  // set so a stale code cannot put an unknown card on the board.
  const savedTasks = (saved ?? [])
    .map((row) => byCode.get(row.task_code))
    .filter((task): task is RankingTask => Boolean(task));

  const hasCompleteSaved = savedTasks.length === TASKS.length;
  const boardOrder = hasCompleteSaved ? savedTasks : shuffleForReviewer(TASKS, reviewer.id);

  // On a revision the start order is the one this panellist was *originally*
  // shown, recovered from initial_rank -- not the order the board opens in.
  // Overwriting it with the saved ranking would make initial_rank a copy of
  // rank and destroy the anchoring check it exists for.
  const recordedStart = (saved ?? [])
    .filter((row) => row.initial_rank !== null)
    .sort((a, b) => (a.initial_rank as number) - (b.initial_rank as number))
    .map((row) => row.task_code);

  const startOrder =
    recordedStart.length === TASKS.length
      ? recordedStart
      : boardOrder.map((task) => task.taskCode);

  return (
    <RankingBoard
      tasks={boardOrder}
      startOrder={startOrder}
      reviewerName={reviewer.display_name}
      submittedAt={hasCompleteSaved ? saved?.[0]?.submitted_at ?? null : null}
    />
  );
}
