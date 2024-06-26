import inquirer from 'inquirer';

export const isHeadless = (): boolean => {
  return !!process.argv.find((arg) => arg === '--headless');
};

export const hasOutput = (): boolean => {
  return !!process.argv.find((arg) => arg === '--output' || arg === '-o');
};

export class BottomBar {
  headless = false;
  hasOutput = false;
  bottomBar: inquirer.ui.BottomBar;
  interval?: NodeJS.Timeout;
  constructor(private stream: NodeJS.WriteStream) {
    this.headless = isHeadless();
    this.hasOutput = hasOutput();
    this.bottomBar = new inquirer.ui.BottomBar({ output: this.stream });
  }

  public updateBottomBar(text: string) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    if (!text) {
      this.bottomBar.updateBottomBar('');
      return;
    }

    if (!this.headless && !this.hasOutput) {
      if (process.platform === 'win32') {
        // BottomBar on windows causes yarn start commands to emit a exit code of 1 for some reason
        // Write it an ugly way on this edge case
        process.stderr.write(`${text}\n`);
        return;
      }

      let count = 3;
      this.interval = setInterval(() => {
        this.bottomBar.updateBottomBar(`${text}${'.'.repeat(count % 4)}`);
        count++;
      }, 500);
    }
  }
}
