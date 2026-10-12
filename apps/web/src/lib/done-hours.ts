export type StatusColumn = {
  id?: string;
  slug?: string;
  isFinal?: boolean | null;
};

export type DoneHoursTask = {
  id: string;
  title: string;
  projectId: string;
  estimatedMinutes?: number | null;
};

export function isFinalStatus(
  columns: readonly StatusColumn[] | null | undefined,
  status: string | null | undefined,
) {
  if (!columns || !status) return false;
  return columns.some(
    (column) =>
      (column.slug === status || column.id === status) &&
      Boolean(column.isFinal),
  );
}

// A move "to Done" is a status that ends in a final column from one that is
// not. Final -> final (e.g. Done -> a second final column) and a task dropped
// back into the column it already sits in do not ask for hours again.
export function isMoveToDone({
  fromColumns,
  fromStatus,
  toColumns = fromColumns,
  toStatus,
}: {
  fromColumns: readonly StatusColumn[] | null | undefined;
  fromStatus: string | null | undefined;
  toColumns?: readonly StatusColumn[] | null;
  toStatus: string | null | undefined;
}) {
  return (
    isFinalStatus(toColumns, toStatus) &&
    !isFinalStatus(fromColumns, fromStatus)
  );
}

// Only what the dialog needs, so a board task's draft proxies and bulk never
// leak into the queue.
export function toPromptTask(task: DoneHoursTask): DoneHoursTask {
  return {
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    estimatedMinutes: task.estimatedMinutes,
  };
}

type BoardLike = {
  columns?: {
    id: string;
    slug?: string;
    isFinal?: boolean | null;
    tasks: DoneHoursTask[];
  }[];
};

// The tasks a board reorder moved into another column, as prompt candidates.
// `board` is the board as it was before the drop, so each task is still in the
// column it came from. A reorder only sets `status` on tasks that changed
// column.
export function doneMovesFromReorder(
  board: BoardLike | undefined,
  moved: { id: string; status?: string }[],
) {
  const columns = board?.columns ?? [];
  return moved.flatMap(({ id, status }) => {
    if (status === undefined) return [];
    const source = columns.find((column) =>
      column.tasks.some((task) => task.id === id),
    );
    const task = source?.tasks.find((candidate) => candidate.id === id);
    if (!source || !task) return [];
    return [
      {
        task: toPromptTask(task),
        fromStatus: source.slug ?? source.id,
        toStatus: status,
        fromColumns: columns,
        toColumns: columns,
      },
    ];
  });
}

type StatusTask = DoneHoursTask & { status: string };

// Selected tasks sent to one status together (bulk change, backlog -> board),
// read from the board as it was before the change.
export function doneMovesForStatus(
  board:
    | (BoardLike & {
        plannedTasks?: StatusTask[];
        archivedTasks?: StatusTask[];
      })
    | null
    | undefined,
  taskIds: string[],
  toStatus: string,
) {
  const columns = board?.columns ?? [];
  const known = [
    ...columns.flatMap((column) => column.tasks as StatusTask[]),
    ...(board?.plannedTasks ?? []),
    ...(board?.archivedTasks ?? []),
  ];
  const wanted = new Set(taskIds);
  return known
    .filter((task) => wanted.has(task.id))
    .map((task) => ({
      task: toPromptTask(task),
      fromStatus: task.status,
      toStatus,
      fromColumns: columns,
      toColumns: columns,
    }));
}
