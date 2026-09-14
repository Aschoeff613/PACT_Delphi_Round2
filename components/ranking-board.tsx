"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type RankingTask } from "@/lib/tasks";

type Props = {
  tasks: RankingTask[];
  /** Order the panellist was first shown, recorded for anchoring analysis. */
  startOrder: string[];
  reviewerName: string;
  submittedAt: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/** Height of one bar plus the gap below it, in px. Mirrors the CSS. */
const ROW_HEIGHT = 64;
const ROW_GAP = 8;
const STRIDE = ROW_HEIGHT + ROW_GAP;

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RankingBoard({ tasks, startOrder, reviewerName, submittedAt }: Props) {
  const [order, setOrder] = useState<RankingTask[]>(tasks);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(submittedAt);
  const [dirty, setDirty] = useState(false);
  // The popout has two independent triggers: hover/focus opens it transiently,
  // clicking pins it open. Pinning is the touch path, where there is no hover,
  // and lets someone read a long example without holding the pointer still.
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [popoutPos, setPopoutPos] = useState<{ top: number; left: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Drag state lives in a ref as well as state: the pointer handlers need to
  // read it synchronously on every move, and re-rendering the whole board at
  // pointer frequency drops frames on a 17-row list.
  const [dragCode, setDragCode] = useState<string | null>(null);
  const drag = useRef<{
    code: string;
    startIndex: number;
    currentIndex: number;
    pointerStartY: number;
    offsetY: number;
  } | null>(null);

  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const registerRow = useCallback((code: string, node: HTMLLIElement | null) => {
    if (node) rowRefs.current.set(code, node);
    else rowRefs.current.delete(code);
  }, []);

  /**
   * Offsets during a drag are applied directly to the DOM rather than through
   * React state, so a pointermove costs a transform and nothing else.
   */
  const paintOffsets = useCallback((fromIndex: number, toIndex: number, dragOffset: number) => {
    const current = order;
    current.forEach((task, index) => {
      const node = rowRefs.current.get(task.taskCode);
      if (!node) return;

      if (index === fromIndex) {
        node.style.transform = `translateY(${dragOffset}px)`;
        return;
      }

      // Rows between the grab point and the current drop position shift by one
      // slot to open a gap where the dragged bar will land.
      let shift = 0;
      if (fromIndex < toIndex && index > fromIndex && index <= toIndex) shift = -STRIDE;
      else if (fromIndex > toIndex && index >= toIndex && index < fromIndex) shift = STRIDE;

      node.style.transform = shift === 0 ? "" : `translateY(${shift}px)`;
    });
  }, [order]);

  /**
   * Drop the offsets without animating them.
   *
   * React reorders the list in the same frame, so a transition here would glide
   * every shifted bar back toward its old slot while the DOM moves it to the
   * new one -- visibly the wrong direction. Suppress the transition, clear the
   * transforms, then restore it once the browser has committed the reflow.
   */
  const clearOffsets = useCallback(() => {
    const nodes = [...rowRefs.current.values()];
    nodes.forEach((node) => {
      node.style.transition = "none";
      node.style.transform = "";
    });
    void nodes[0]?.offsetHeight; // force reflow before re-enabling transitions
    requestAnimationFrame(() => {
      nodes.forEach((node) => {
        node.style.transition = "";
      });
    });
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent, index: number) => {
    // Ignore secondary buttons and clicks on the disclosure control.
    if (event.button !== 0) return;

    const task = order[index];
    const node = rowRefs.current.get(task.taskCode);
    if (!node) return;

    // The popout is position: fixed, so it never changes row height and the
    // STRIDE maths hold -- but leaving it open mid-drag would have it hang over
    // a list that is moving underneath it.
    setHovered(null);
    setPinned(null);

    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    drag.current = {
      code: task.taskCode,
      startIndex: index,
      currentIndex: index,
      pointerStartY: event.clientY,
      offsetY: 0
    };
    setDragCode(task.taskCode);
  }, [order]);

  useEffect(() => {
    if (!dragCode) return;

    const onMove = (event: PointerEvent) => {
      const state = drag.current;
      if (!state) return;

      const delta = event.clientY - state.pointerStartY;
      state.offsetY = delta;

      // Which slot the bar's centre is now over.
      const slots = order.length;
      const target = Math.min(
        slots - 1,
        Math.max(0, state.startIndex + Math.round(delta / STRIDE))
      );

      state.currentIndex = target;
      paintOffsets(state.startIndex, target, delta);
    };

    const onUp = () => {
      const state = drag.current;
      drag.current = null;
      setDragCode(null);
      clearOffsets();

      if (!state) return;
      if (state.currentIndex === state.startIndex) return;

      const task = order[state.startIndex];
      setOrder((current) => moveItem(current, state.startIndex, state.currentIndex));
      setDirty(true);
      setSaveState("idle");
      setAnnouncement(
        `${task.title} moved to position ${state.currentIndex + 1} of ${order.length}.`
      );
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragCode, order, paintOffsets, clearOffsets]);

  /**
   * Keyboard and button moves. Dragging 17 bars with a pointer is not the only
   * way to do this: arrow keys move a focused bar, which is both the
   * screen-reader path and the fastest way to make a one-slot correction.
   */
  const nudge = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    const task = order[index];
    setOrder((current) => moveItem(current, index, target));
    setDirty(true);
    setSaveState("idle");
    setAnnouncement(`${task.title} moved to position ${target + 1} of ${order.length}.`);

    // Keep focus on the handle that moved, now one slot away.
    requestAnimationFrame(() => {
      rowRefs.current.get(task.taskCode)?.querySelector<HTMLButtonElement>(".rank-handle")?.focus();
    });
  }, [order]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(index, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(index, 1);
    }
  }, [nudge]);

  const POPOUT_WIDTH = 680;

  /**
   * Anchor the popout to a row.
   *
   * Fixed positioning against the row's viewport rect, rather than absolute
   * positioning inside the row: the row is a drag target with its own
   * transform, and an absolutely positioned child would be clipped by the
   * bar's `overflow: hidden`. Flips above the row, and clamps horizontally,
   * when the card would otherwise leave the viewport -- relevant for the
   * bottom of a 17-row list.
   */
  const openPopout = useCallback((code: string) => {
    const node = rowRefs.current.get(code);
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const margin = 12;
    // Measured at 680px wide with both examples in columns; a little generous
    // so the flip-above decision errs toward flipping rather than overflowing.
    const estimatedHeight = 290;

    const opensBelow = rect.bottom + estimatedHeight + margin < window.innerHeight;
    const top = opensBelow ? rect.bottom + 6 : Math.max(margin, rect.top - estimatedHeight - 6);
    const left = Math.min(
      Math.max(margin, rect.left + 44),
      Math.max(margin, window.innerWidth - POPOUT_WIDTH - margin)
    );

    setPopoutPos({ top, left });
    setHovered(code);
  }, []);

  const closePopout = useCallback(() => {
    setHovered(null);
  }, []);

  // Escape unpins, matching the usual dismissal for a transient overlay.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(null);
        setHovered(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  // Reordering moves rows out from under a pinned card, so re-anchor it.
  useEffect(() => {
    const code = pinned ?? hovered;
    if (!code || dragCode) return;
    openPopout(code);
    // openPopout is stable and reads the live DOM rect; re-run on order change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, pinned]);

  const activePopout = dragCode ? null : (pinned ?? hovered);
  const activeTask = activePopout
    ? order.find((task) => task.taskCode === activePopout) ?? null
    : null;

  const submit = useCallback(async () => {
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskCodes: order.map((task) => task.taskCode),
          taskNames: order.map((task) => task.title),
          startOrder
        })
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }

      setSaveState("saved");
      setDirty(false);
      setLastSubmitted(body.submittedAt ?? new Date().toISOString());
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
    }
  }, [order, startOrder]);

  return (
    <div className="rank-page">
      <section className="hero rank-hero">
        <p className="brand-eyebrow">Round 2 — Validation</p>
        <h2 className="rank-title">Rank all 17 cognitive tasks</h2>
        <p className="hero-tagline">
          Round 1 rated each task on its own. This round asks for their order relative to
          one another.
        </p>
        <p>
          <strong>Drag the bars into the order you would prioritise them</strong> for
          inclusion in the final PACT benchmark taxonomy — position 1 is the highest
          priority, position 17 the lowest.
        </p>
        <ul className="hero-instructions">
          <li>Drag a bar by the handle or any empty part of it, or focus the handle and use ↑ / ↓</li>
          <li>Hover a task name for its definition and worked examples from the ED and primary care — click to keep the card open</li>
          <li>
            The three numbers on each bar are your panel&rsquo;s Round 1 averages for that task, out
            of 5. They are shown as a reminder of where the group landed, not as an order to follow
          </li>
          <li>The list starts in a random order, different for each panellist</li>
          <li>All 17 positions are submitted together — nothing saves until you submit</li>
          <li>You can come back and revise your ranking until the round closes</li>
        </ul>
      </section>

      <div className="rank-layout">
        <ol className="rank-list">
          {order.map((task, index) => {
            const isDragging = dragCode === task.taskCode;
            const isOpen = activePopout === task.taskCode;
            // Bars lengthen toward the top of the list, so the ordering reads
            // as a shape at a glance and not only as 17 numbers.
            const fill = 46 + ((order.length - index) / order.length) * 54;

            return (
              <li
                key={task.taskCode}
                ref={(node) => registerRow(task.taskCode, node)}
                className={`rank-row${isDragging ? " is-dragging" : ""}${isOpen ? " is-open" : ""}`}
                aria-label={`Position ${index + 1} of ${order.length}: ${task.title}. Round 1 means: clinical relevance ${task.round1.clinicalRelevance.toFixed(2)}, performance variance ${task.round1.performanceVariance.toFixed(2)}, AI augmentation ${task.round1.aiAugmentation.toFixed(2)}, out of 5.`}
              >
                <div
                  className="rank-bar"
                  onPointerDown={(event) => handlePointerDown(event, index)}
                >
                  <span className="rank-fill" style={{ width: `${fill}%` }} aria-hidden="true" />

                  <span className="rank-position" aria-hidden="true">{index + 1}</span>

                  <button
                    type="button"
                    className="rank-handle"
                    aria-label={`Reorder ${task.title}. Currently position ${index + 1} of ${order.length}. Use arrow up and arrow down to move.`}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  >
                    <span aria-hidden="true">⣿</span>
                  </button>

                  <span className="rank-text">
                    <button
                      type="button"
                      className="rank-name"
                      aria-expanded={isOpen}
                      aria-describedby={isOpen ? `popout-${task.taskCode}` : undefined}
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerEnter={(event) => {
                        // Touch fires pointerenter immediately before the click
                        // that pins; only hover should open transiently.
                        if (event.pointerType === "mouse") openPopout(task.taskCode);
                      }}
                      onPointerLeave={() => {
                        if (pinned !== task.taskCode) closePopout();
                      }}
                      onFocus={() => openPopout(task.taskCode)}
                      onBlur={() => {
                        if (pinned !== task.taskCode) closePopout();
                      }}
                      onClick={() => {
                        if (pinned === task.taskCode) {
                          setPinned(null);
                          closePopout();
                        } else {
                          setPinned(task.taskCode);
                          openPopout(task.taskCode);
                        }
                      }}
                    >
                      <span className="rank-code">{task.taskCode}</span>
                      {task.title}
                      <span className="rank-name-hint" aria-hidden="true">examples</span>
                    </button>
                    <span className="rank-question">{task.guidingQuestion}</span>
                  </span>

                  {/* Round 1 group means, as Delphi feedback. Fixed-width cells
                      so the three read as columns down the list. */}
                  <span className="rank-scores" aria-hidden="true">
                    <span className="rank-score" title={`Clinical relevance, Round 1 mean ${task.round1.clinicalRelevance.toFixed(2)} of 5 (n=${task.round1.n})`}>
                      <span className="rank-score-key">Clinical relevance</span>
                      <span className="rank-score-val">{task.round1.clinicalRelevance.toFixed(2)}</span>
                    </span>
                    <span className="rank-score" title={`Performance variance, Round 1 mean ${task.round1.performanceVariance.toFixed(2)} of 5 (n=${task.round1.n})`}>
                      <span className="rank-score-key">Performance variance</span>
                      <span className="rank-score-val">{task.round1.performanceVariance.toFixed(2)}</span>
                    </span>
                    <span className="rank-score" title={`AI augmentation potential, Round 1 mean ${task.round1.aiAugmentation.toFixed(2)} of 5 (n=${task.round1.n})`}>
                      <span className="rank-score-key">AI augmentation potential</span>
                      <span className="rank-score-val">{task.round1.aiAugmentation.toFixed(2)}</span>
                    </span>
                  </span>

                  <span className="rank-nudge" onPointerDown={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => nudge(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${task.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => nudge(index, 1)}
                      disabled={index === order.length - 1}
                      aria-label={`Move ${task.title} down`}
                    >
                      ↓
                    </button>
                  </span>
                </div>

              </li>
            );
          })}
        </ol>

        <aside className="rank-aside">
          <div className="rank-submit-card">
            <p className="rank-submit-who">{reviewerName}</p>
            {lastSubmitted ? (
              <p className="rank-submit-meta">
                Last submitted{" "}
                {new Date(lastSubmitted).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </p>
            ) : (
              <p className="rank-submit-meta">Not yet submitted</p>
            )}

            <button
              type="button"
              className="rank-submit"
              onClick={submit}
              disabled={saveState === "saving" || (!dirty && saveState === "saved") || (!dirty && Boolean(lastSubmitted))}
            >
              {saveState === "saving"
                ? "Submitting…"
                : lastSubmitted
                  ? "Submit revised ranking"
                  : "Submit ranking"}
            </button>

            {saveState === "saved" ? (
              <p className="rank-status is-ok">Ranking recorded.</p>
            ) : null}
            {saveState === "error" ? (
              <p className="rank-status is-error">{errorMessage}</p>
            ) : null}
            {dirty && lastSubmitted ? (
              <p className="rank-status is-warn">Unsaved changes since your last submission.</p>
            ) : null}
          </div>
        </aside>
      </div>

      {activeTask && popoutPos ? (
        <div
          id={`popout-${activeTask.taskCode}`}
          role="tooltip"
          className={`rank-popout${pinned === activeTask.taskCode ? " is-pinned" : ""}`}
          style={{ top: popoutPos.top, left: popoutPos.left, width: POPOUT_WIDTH }}
          // Hovering the card itself keeps it open, so a pinned card can be
          // scrolled and read without the pointer having to stay on the name.
          onPointerEnter={() => setHovered(activeTask.taskCode)}
          onPointerLeave={() => {
            if (pinned !== activeTask.taskCode) closePopout();
          }}
        >
          <p className="rank-popout-title">
            <span className="rank-code">{activeTask.taskCode}</span>
            {activeTask.title}
          </p>
          <p className="rank-popout-definition">{activeTask.definition}</p>

          <div className="rank-popout-examples">
            <div>
              <p className="rank-popout-label">Primary Care</p>
              <p className="rank-popout-example">{activeTask.examplePrimaryCare}</p>
            </div>
            <div>
              <p className="rank-popout-label">Emergency Department</p>
              <p className="rank-popout-example">{activeTask.exampleEd}</p>
            </div>
          </div>

          {pinned === activeTask.taskCode ? (
            <p className="rank-popout-foot">Click the task name again, or press Esc, to close.</p>
          ) : null}
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  );
}
