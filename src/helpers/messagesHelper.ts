import { ui } from '../command';

export class MessagesHelper {
  processName = 'scaffoldly';

  _headless = false;

  set headless(value: boolean) {
    this._headless = value;
  }

  get headless(): boolean {
    return this._headless;
  }

  constructor(argv: string[]) {
    const cmd = argv[1];
    if (cmd && cmd.indexOf('_npx') !== -1) {
      this.processName = `npx ${this.processName}`;
    }
  }

  public status(str?: string): void {
    if (str) {
      ui.updateBottomBar(`${str}...`);
    } else {
      ui.updateBottomBar('');
    }
  }

  public write(str: string): void {
    if (this.headless) {
      return;
    }
    this.status();
    process.stderr.write(str);
    process.stderr.write('\n');
  }
}
