import { NextResponse } from "next/server";
import { TASK_COUNT, TASKS } from "@/lib/tasks";
import { getReviewerSession } from "@/lib/reviewer-session";
import { createAdminClient } from "@/lib/supabase";

type Payload = {
  taskCodes: string[];
  taskNames: string[];
  startOrder: string[];
};

export async function POST(request: Request) {
  const session = await getReviewerSession();

  if (!session) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }
  if (session.reviewer.locked_at) {
    return NextResponse.json({ error: "This panellist record is locked" }, { status: 403 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const { taskCodes, taskNames, startOrder } = payload;

  // A ranking is only meaningful as a complete permutation of the current task
  // set, so validate here as well as in the RPC: a bad payload should come back
  // as a 400 the page can show, not a 500 from a raised database exception.
  if (!Array.isArray(taskCodes) || taskCodes.length !== TASK_COUNT) {
    return NextResponse.json(
      {
        error: `Expected ${TASK_COUNT} tasks, received ${
          Array.isArray(taskCodes) ? taskCodes.length : 0
        }`
      },
      { status: 400 }
    );
  }
  if (!Array.isArray(taskNames) || taskNames.length !== taskCodes.length) {
    return NextResponse.json({ error: "Task names do not match task codes" }, { status: 400 });
  }
  if (new Set(taskCodes).size !== taskCodes.length) {
    return NextResponse.json({ error: "Ranking contains a duplicate task" }, { status: 400 });
  }

  // Codes come from the client, so confirm they are exactly the known task set
  // rather than trusting the payload.
  const known = new Set(TASKS.map((task) => task.taskCode));
  if (!taskCodes.every((code) => known.has(code))) {
    return NextResponse.json({ error: "Ranking contains an unknown task" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const validStart =
    Array.isArray(startOrder) &&
    startOrder.length === taskCodes.length &&
    new Set(startOrder).size === startOrder.length &&
    startOrder.every((entry) => taskCodes.includes(entry));

  const { error } = await supabase.rpc("save_round2_ranking", {
    p_reviewer_id: session.reviewer.id,
    p_task_codes: taskCodes,
    p_task_names: taskNames,
    p_initial_codes: validStart ? startOrder : null
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submittedAt: new Date().toISOString() });
}
