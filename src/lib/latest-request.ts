/** Prevents an earlier account's asynchronous data or errors replacing the latest session. */
export class LatestRequest {
  private revision = 0;
  get token(): number { return this.revision; }
  invalidate(): void { this.revision += 1; }
  isCurrent(token: number): boolean { return this.revision === token; }
  async run<T>(task: (isCurrent: () => boolean) => Promise<T>, onResult: (result: T) => void, onError: (error: unknown) => void): Promise<void> {
    this.invalidate(); const token = this.token;
    const isCurrent = (): boolean => this.isCurrent(token);
    try { const result = await task(isCurrent); if (isCurrent()) onResult(result); }
    catch (error) { if (isCurrent()) onError(error); }
  }
}
