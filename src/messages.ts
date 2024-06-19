export const NO_GITHUB_CLIENT = 'There was an unknown issue loading GitHub client libraries';
export const NOT_LOGGED_IN = (processName: string): string =>
  `Invalid or missing token. Please login using the \`${processName} login\` command to save your identity to this system.`;
export const ERROR_LOADING_FILE = (file: string, error: Error): string =>
  `Error loading file: ${file}: ${error.message}.`;
export const ERROR_LOGGING_IN = (message: string): string => `Unable to login. ${message}.`;
