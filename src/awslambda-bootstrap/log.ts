export const info = (message: any, obj?: Record<string, any>): void => {
  const msg = `[awslambda-bootstrap] ${message}`;
  if (!obj) {
    console.log(msg);
    return;
  }
  console.log(msg, obj);
};

export const log = (message: any, obj?: Record<string, any>): void => {
  if (!process.env.SLY_DEBUG) return;
  info(message, obj);
};
