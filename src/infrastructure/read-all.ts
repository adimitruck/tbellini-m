import { z } from 'zod';
import { ArchiveError } from '@/domain/archive';
export interface PageResult { data: unknown; error: { message: string } | null }
export const ARCHIVE_PAGE_SIZE = 1000;
/** Queries must apply a stable unique order and authorization scope to every page. */
export async function readAll(fetchPage: (from: number, to: number) => PromiseLike<PageResult>): Promise<unknown[]> {
  const records: unknown[] = [];
  let previousFirstRow: string | undefined;
  for (let offset = 0; ; offset += ARCHIVE_PAGE_SIZE) {
    if (!Number.isSafeInteger(offset + ARCHIVE_PAGE_SIZE)) throw new ArchiveError('The archive is too large to load safely.');
    const { data, error } = await fetchPage(offset, offset + ARCHIVE_PAGE_SIZE - 1);
    if (error) throw new ArchiveError(error.message);
    const page = z.array(z.unknown()).parse(data);
    if (page.length > ARCHIVE_PAGE_SIZE) throw new ArchiveError('The database returned an invalid archive page.');
    const firstRow = page.length ? JSON.stringify(page[0]) : undefined;
    if (firstRow !== undefined && firstRow === previousFirstRow) throw new ArchiveError('Archive pagination did not advance.');
    previousFirstRow = firstRow;
    records.push(...page);
    if (page.length < ARCHIVE_PAGE_SIZE) return records;
  }
}
