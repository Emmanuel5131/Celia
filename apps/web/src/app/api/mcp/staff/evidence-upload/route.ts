import { clerkClient } from '@clerk/nextjs/server';
import * as z from 'zod';
import { startEvidenceUpload } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { runAsStaff } from '@/libs/accounts/Staff';
import { recordStaffAction } from '@/libs/accounts/StaffAudit';
import { db } from '@/libs/DB';
import { identifyMcpCallerWithRole, privateJson, unauthorized } from '@/libs/mcp/McpCaller';

const BodyValidation = z.object({ fileName: z.string().trim().min(1).max(200) });

/**
 * Gives staff a one-minute address to upload an evidence file to IPFS, as the web app does, so the file never passes through
 * Celia. Uploading to it returns Pinata's id for the file, which add_evidence takes as `pinId`. Only staff who pass the staff
 * area's rules may ask.
 * @param request - The request, with `{ fileName }` as JSON.
 * @returns The upload address, why there is none (`off` or `failed`), 401, or 422.
 */
export async function POST(request: Request) {
  const caller = await identifyMcpCallerWithRole('staff');

  if (!caller) {
    return unauthorized();
  }

  const body = BodyValidation.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return privateJson({ problem: 'input' }, 422);
  }

  const client = await clerkClient();
  const user = await client.users.getUser(caller.userId);
  const outcome = await runAsStaff(user, async () => {
    const signed = await startEvidenceUpload(body.data.fileName);

    // The person who signed in to the assistant is the one recorded asking for it.
    await recordStaffAction(db, {
      actor: { id: caller.userId, email: caller.email },
      action: 'evidence_upload_started',
      details: { outcome: 'url' in signed ? 'signed' : signed.error },
    });

    return signed;
  });

  return privateJson(outcome);
}
