import inquirer from 'inquirer';

export const isInteractive = (): boolean => {
  return process.stdout.isTTY && process.stdin.isTTY;
};

export const isHeadless = (): boolean => {
  return !!process.argv.find((arg) => arg === '--headless');
};

export const isDebug = (): boolean => {
  return !!process.argv.find((arg) => arg === '--debug');
};

export const isLocalDeps = (): boolean => {
  return !!process.argv.find((arg) => arg === '--local-deps');
};

export const hasOutput = (): boolean => {
  return !!process.argv.find((arg) => arg === '--output' || arg === '-o');
};

const PRIMARY_LOADING = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
const SECONDARY_LOADING = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SECONDARY_SPACES = '   ';

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
    if (text === '\\n') {
      return;
    }

    if (text && (isDebug() || !isInteractive())) {
      this.stream.write(`${SECONDARY_SPACES}${text.trim()}\n`);
      return;
    }

    this.subtext = text;
  }

  public updateBottomBar(text: string): void {
    if (text === '\\n') {
      return;
    }

    if (text && (isDebug() || !isInteractive())) {
      this.stream.write(`${text.trim()}\n`);
      return;
    }

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
        let message = `${PRIMARY_LOADING[count % PRIMARY_LOADING.length]} ${text.substring(
          0,
          process.stdout.columns - 10,
        )}...`;
        if (this.subtext) {
          message = `${message}\n${SECONDARY_SPACES}${
            SECONDARY_LOADING[count % SECONDARY_LOADING.length]
          } ${this.subtext.substring(0, process.stdout.columns - 10)}`;
        }
        this.bottomBar.updateBottomBar(message);
        count++;
      }, 100);
    }
  }
}
