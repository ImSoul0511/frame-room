/** Keep the same request key after a network failure with an unknown outcome. */
export class JobSubmission {
  private fingerprint = '';
  private requestKey = '';
  key(path: string, input: unknown) {
    const fingerprint = JSON.stringify([path, input]);
    if (fingerprint !== this.fingerprint || !this.requestKey) {
      this.fingerprint = fingerprint;
      this.requestKey = crypto.randomUUID();
    }
    return this.requestKey;
  }
  complete() {
    this.requestKey = '';
  }
}
