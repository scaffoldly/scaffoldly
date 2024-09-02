import { hostname } from 'os';
export const isDebug = !!process.env.SLY_DEBUG;
const name = hostname();

export const error = (message: unknown, obj?: Record<string, unknown>): void => {
  const msg = `[scaffoldly@${name}] ${message}`;
  if (!obj) {
    console.error(msg);
    return;
  }
  console.error(msg, JSON.stringify(obj));
};

export const info = (message: unknown, obj?: Record<string, unknown>): void => {
  const msg = `[scaffoldly@${name}] ${message}`;
  if (!obj) {
    console.log(msg);
    return;
  }
  console.log(msg, JSON.stringify(obj));
};

export const log = (message: unknown, obj?: Record<string, unknown>): void => {
  if (!process.env.SLY_DEBUG) return;
  info(message, obj);
};
