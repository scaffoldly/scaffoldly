import inquirer from 'inquirer';

export const isHeadless = (): boolean => {
  return !!process.argv.find((arg) => arg === '--headless');
};

export const isDebug = (): boolean => {
  console.log('!!! process.argv', process.argv);
  const debug = !!process.argv.find((arg) => arg === '--debug');
  console.log('!!! isDebug', debug);
  return debug;
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

    if (text && isDebug()) {
      console.log(`${SECONDARY_SPACES}${text.trim()}`);
      return;
    }

    this.subtext = text;
  }

  public updateBottomBar(text: string): void {
    if (text === '\\n') {
      return;
    }

    if (text && isDebug()) {
      console.log(text.trim());
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
        let message = `${PRIMARY_LOADING[count % PRIMARY_LOADING.length]} ${text}...`;
        if (this.subtext) {
          message = `${message}\n${SECONDARY_SPACES}${
            SECONDARY_LOADING[count % SECONDARY_LOADING.length]
          } ${this.subtext}`;
        }
        this.bottomBar.updateBottomBar(message);
        count++;
      }, 100);
    }
  }
}
