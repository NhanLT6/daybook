class ProgressTracker {
  private total: number;
  private current: number = 0;

  constructor(total: number) {
    this.total = total;
  }

  increment(): string {
    this.current++;
    return `[${this.current}/${this.total}]`;
  }
}

export { ProgressTracker };
