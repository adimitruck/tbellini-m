import { z } from 'zod';

/** Shared building blocks for every domain schema. */
export const isoTimestamp = z.iso.datetime({ offset: true });
export const idSchema = z.string().min(1);

/** Parses untrusted input, reporting the first problem in plain words instead of a schema dump. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ArchiveError(result.error.issues[0]?.message ?? 'Check the highlighted fields.');
}

/** Violations of an archive rule; the message is safe to show to a member. */
export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveError';
  }
}
