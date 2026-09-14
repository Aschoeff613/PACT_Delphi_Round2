import { redirect } from "next/navigation";
import { RankingBoard } from "@/components/ranking-board";
import { PRESENTED_ORDER, TASKS, type RankingTask } from "@/lib/tasks";
import { getReviewerSession } from "@/lib/reviewer-session";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

  // A returning panellist picks up their own saved ranking; everyone else
  // starts from the study team's composite order, identical for all of them.
  const hasCompleteSaved = savedTasks.length === TASKS.length;
  const boardOrder = hasCompleteSaved ? savedTasks : PRESENTED_ORDER;

  // On a revision the start order is the one this panellist was *originally*
  // shown, recovered from initial_rank -- not the order the board opens in.
  // Overwriting it with the saved ranking would make initial_rank a copy of
  // rank, and initial_rank is what makes displacement from the proposed order
  // measurable: rank minus initial_rank is how far this panellist moved each
  // task away from what the team put in front of them.
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
