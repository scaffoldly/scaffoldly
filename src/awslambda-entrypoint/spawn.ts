import { ChildProcess, spawn } from 'child_process';
import { Command, Schedule } from '../config';
import { info, log } from './log';
import chalk from 'chalk';

export const spawnAsync = async (
  command: Command,
  env: Record<string, string>,
  schedule?: Schedule,
): Promise<{ proc: ChildProcess; output?: Buffer } | undefined> => {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    if (!!schedule && command.schedule !== schedule) {
      resolve(undefined);
      return;
    }

    info('Spawning command', { command });

    const [cmd, ...args] = command.cmd.split(' ');
    const proc = spawn(cmd, args, {
      detached: !schedule, // Run detached for unscheduled events
      stdio: !schedule ? 'inherit' : undefined,
      cwd: command.workdir,
      env: { ...process.env, ...env },
    });

    proc.stdout?.on('data', (data) => {
      chunks.push(Buffer.from(data));
    });

    proc.stderr?.on('data', (data) => {
      chunks.push(Buffer.from(chalk.red(data)));
    });

    proc.on('spawn', () => {
      log('Process spawned', { schedule, command });
    });

    proc.on('error', (err) => {
      log('Process error', { schedule, command, err });
      reject(err);
    });

    proc.on('exit', (code) => {
      log('Process exited', { schedule, command, code });
      if (code !== 0) {
        reject(new Error(`${cmd} exited with code ${code}`));
        return;
      }

      if (schedule) {
        // Scheduled event, wait for exit before resolution
        resolve({ proc, output: Buffer.concat(chunks) });
        return;
      }
    });

    if (!schedule) {
      // Unscheduled event, resolve immediately
      resolve({ proc });
      return;
    }
  });
};
