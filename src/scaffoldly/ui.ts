import inquirer from 'inquirer';

export const isHeadless = (): boolean => {
  return !!process.argv.find((arg) => arg === '--headless');
};

export const isDebug = (): boolean => {
  return !!process.argv.find((arg) => arg === '--debug');
};

export const hasOutput = (): boolean => {
  return !!process.argv.find((arg) => arg === '--output' || arg === '-o');
};

const PRIMARY_LOADING = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
const SECONDARY_LOADING = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class BottomBar {
  headless = false;

  hasOutput = false;

  bottomBar: inquirer.ui.BottomBar;

  interval?: NodeJS.Timeout;

  subtext?: string;

  constructor(private stream: NodeJS.WriteStream) {
    this.headless = isHeadless();
    this.hasOutput = hasOutput();
    this.bottomBar = new inquirer.ui.BottomBar({ output: this.stream });
  }

  public updateBottomBarSubtext(text: string): void {
    this.subtext = text;
  }

  public updateBottomBar(text: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.subtext = undefined;
      this.interval = undefined;
    }

    if (!text) {
      this.bottomBar.updateBottomBar('');
      this.subtext = undefined;
      return;
    }

    if (!this.headless && !this.hasOutput) {
      if (process.platform === 'win32') {
        // BottomBar on windows causes yarn start commands to emit a exit code of 1 for some reason
        // Write it an ugly way on this edge case
        process.stderr.write(`${text}\n`);
        return;
      }

      let count = 0;
      this.interval = setInterval(() => {
        let message = `${PRIMARY_LOADING[count % PRIMARY_LOADING.length]} ${text}...`;
        if (this.subtext) {
          message = `${message}\n   ${SECONDARY_LOADING[count % SECONDARY_LOADING.length]} ${
            this.subtext
          }`;
        }
        this.bottomBar.updateBottomBar(message);
        count++;
      }, 100);
    }
  }
}
