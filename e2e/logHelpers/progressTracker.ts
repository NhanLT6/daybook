/**
 * Progress tracker for logging task entries
 * Updates the same line in console (no spam)
 * Displays initial 0% progress immediately
 */
class ProgressTracker {
  private total: number;
  private current: number = 0;
  private readonly barLength: number = 50; // Max characters for progress bar

  constructor(total: number) {
    this.total = Math.max(total, 1); // Prevent division by zero
    this.update(); // Display initial 0% progress
  }

  /**
   * Increment progress and update display
   */
  increment(): void {
    if (this.current < this.total) {
      this.current++;
      this.update();
    }
  }

  /**
   * Update the progress bar display
   */
  private update(): void {
    const percentage = Math.round((this.current / this.total) * 100);
    const filled = Math.round((percentage * this.barLength) / 100);
    const empty = this.barLength - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    // \r moves cursor to start of line, overwriting previous content
    process.stdout.write(`\r⏳ Progress: [${bar}] ${this.current}/${this.total} (${percentage}%)`);

    // Add newline when complete
    if (this.current === this.total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Mark progress as complete
   */
  complete(): void {
    this.current = this.total;
    this.update();
  }
}

export { ProgressTracker };
