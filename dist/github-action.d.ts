type Mode = 'pre' | 'main' | 'post';

declare const run: (mode: Mode, version?: string) => Promise<void>;

export { run };
