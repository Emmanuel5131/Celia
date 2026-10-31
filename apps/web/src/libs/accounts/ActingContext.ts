import { AsyncLocalStorage } from 'node:async_hooks';
import type { currentUser } from '@clerk/nextjs/server';

/** A staff member as Clerk describes them. */
export type StaffUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/**
 * Who is acting when the work comes from the MCP server rather than a browser. It is set by `runAsStaff` and nowhere else, so
 * anything that finds a person here knows the change was made through an assistant on that person's behalf, and records it so.
 */
export const actingStaff = new AsyncLocalStorage<StaffUser>();
