/** M2 storage capability. Implement with server-issued R2 upload URLs, never browser credentials. */
export interface MediaStorage { createUploadUrl(input: { ownerId: string; objectId: string; contentType: string; size: number }): Promise<{ url: string; expiresAt: string }> }
/** Graph is a replayable projection; authoritative writes stay in Postgres. */
export interface GraphProjection { project(input: { outboxId: string; ownerId: string; aggregateId: string; payload: Readonly<Record<string, unknown>> }): Promise<void> }
