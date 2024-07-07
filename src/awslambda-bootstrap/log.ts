export const info = (message: unknown, obj?: Record<string, unknown>): void => {
  const msg = `[awslambda-bootstrap] ${message}`;
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
