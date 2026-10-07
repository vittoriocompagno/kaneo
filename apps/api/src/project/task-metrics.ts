import { sql } from "drizzle-orm";
import { taskTable } from "../database/schema";

// "Done" matches the sidebar progress ring: done or archived tasks.
const DONE_STATUSES = sql`('done', 'archived')`;

// A due date is overdue once a full day has passed, the same threshold the
// task badges use (getDueDateStatus in the web app), so a date-only task due
// today is not late until tomorrow.
const OVERDUE_BEFORE = sql`now() - interval '1 day'`;
const DUE_SOON_UNTIL = sql`now() + interval '7 days'`;

export const doneTaskCount = sql<number>`count(case when ${taskTable.status} in ${DONE_STATUSES} then 1 end)`;

export const overdueTaskCount = sql<number>`count(case when ${taskTable.status} not in ${DONE_STATUSES} and ${taskTable.dueDate} < ${OVERDUE_BEFORE} then 1 end)`;

export const dueSoonTaskCount = sql<number>`count(case when ${taskTable.status} not in ${DONE_STATUSES} and ${taskTable.dueDate} >= ${OVERDUE_BEFORE} and ${taskTable.dueDate} <= ${DUE_SOON_UNTIL} then 1 end)`;

export const nextOpenDueDate =
  sql<Date | null>`min(case when ${taskTable.status} not in ${DONE_STATUSES} then ${taskTable.dueDate} end)`.mapWith(
    taskTable.dueDate,
  );
