/**
 * What the MCP server may tell anyone about a saved report: its number, its findings, their hash and when it was saved. Nothing
 * else on the record goes out, so a field added to the record later (such as the assistant's private note to staff, or the id of
 * the plan) stays inside until someone decides to share it here.
 * @param report - The saved report.
 * @returns The shareable part.
 */
export function shareReport<Snapshot>(report: {
  run: number;
  version: number;
  snapshot: Snapshot;
  hash: string;
  savedAt: string;
}) {
  return {
    run: report.run,
    version: report.version,
    snapshot: report.snapshot,
    hash: report.hash,
    savedAt: report.savedAt,
  };
}
