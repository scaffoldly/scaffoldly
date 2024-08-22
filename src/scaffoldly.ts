import { ErrorWithReturnCode } from './scaffoldly/errors';
import { Command } from './scaffoldly/command';
import { Console } from 'console';
import { isDebug, isHeadless } from './scaffoldly/ui';

// Disables (node:64080) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
process.emitWarning = () => {};

export const outputStream = isHeadless() ? process.stderr : process.stdout;
export const customConsole = new Console(outputStream, process.stderr);

console.log = customConsole.log;
console.info = customConsole.info;
console.warn = customConsole.warn;
console.error = customConsole.error;
console.debug = customConsole.debug;
console.clear = customConsole.clear;
console.trace = customConsole.trace;

export const run = async (version?: string): Promise<void> => {
  const command = new Command(process.argv, version);
  try {
    await command.run(process.argv);
    process.exit(0);
  } catch (e) {
    if (e instanceof Error) {
      if (isDebug()) {
        console.error(e);
      } else {
        if (e.cause && e.cause instanceof Error) {
          console.error(`Error: ${e.message}:\n  ${e.cause.message}`);
        } else {
          console.error(`Error: ${e.message}`);
        }
        console.error(`\nRun with --debug for more information.`);
      }
    } else {
      console.error(e);
    }
    if (e instanceof ErrorWithReturnCode) {
      process.exit(e.returnCode);
    }
    process.exit(-1);
  }
};
