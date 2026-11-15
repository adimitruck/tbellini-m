/** Own one exclusive replay: project in order and acknowledge only completed graph writes. */
export async function replayOutbox(queue, graph, lockToken) {
  let locked = false;
  let processed = 0;
  let primaryError;
  try {
    locked = await queue.acquire(lockToken);
    if (!locked) throw new Error('Graph sync already locked. See docs/RUNBOOK.md for crash recovery.');
    await graph.connect();
    await graph.initialize();
    for (;;) {
      const rows = await queue.pending();
      if (!Array.isArray(rows)) throw new Error('The outbox returned an invalid batch.');
      if (!rows.length) break;
      for (const row of rows) {
        await graph.project(row);
        await queue.acknowledge(row.id);
        processed += 1;
      }
    }
  } catch (error) { primaryError = error; }
  const cleanupErrors = [];
  try { await graph.close(); } catch (error) { cleanupErrors.push(error); }
  if (locked) {
    try { await queue.release(lockToken); } catch (error) { cleanupErrors.push(error); }
  }
  if (primaryError && cleanupErrors.length) throw new AggregateError([primaryError, ...cleanupErrors], 'Graph replay failed; cleanup also failed.', { cause: primaryError });
  if (primaryError) throw primaryError;
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Graph replay cleanup failed.');
  return processed;
}
