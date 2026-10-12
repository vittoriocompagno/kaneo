import { create } from "zustand";
import type { DoneHoursTask } from "@/lib/done-hours";

type DoneHoursPromptStore = {
  queue: DoneHoursTask[];
  enqueue: (tasks: DoneHoursTask[]) => void;
  next: () => void;
  clear: () => void;
};

// Tasks that just moved to Done and still need an hours prompt, oldest first.
export const useDoneHoursPromptStore = create<DoneHoursPromptStore>((set) => ({
  queue: [],
  enqueue: (tasks) =>
    set((state) => {
      const known = new Set(state.queue.map((task) => task.id));
      const fresh = tasks.filter((task) => !known.has(task.id));
      return fresh.length ? { queue: [...state.queue, ...fresh] } : state;
    }),
  next: () => set((state) => ({ queue: state.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
