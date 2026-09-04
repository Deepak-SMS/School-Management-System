import { useState } from "react";

/**
 * A small, session-only undo/redo stack for the designer pages — snapshots
 * of the element array, not of individual field diffs. Reverting replays
 * through the same `apply` callback the page already uses to persist a
 * change (PATCH/POST/DELETE calls), so the server stays the source of
 * truth; nothing here is itself persisted across a reload.
 */
export function useDesignHistory<T>(apply: (snapshot: T) => void) {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  /** Call with the state *before* a change is applied, so undo can restore it. */
  function pushSnapshot(previous: T) {
    setPast((p) => [...p, previous]);
    setFuture([]);
  }

  function undo(current: T) {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, current]);
    apply(previous);
  }

  function redo(current: T) {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, current]);
    apply(next);
  }

  return { pushSnapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
