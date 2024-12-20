declare const outputStream: (NodeJS.WriteStream & {
    fd: 2;
}) | (NodeJS.WriteStream & {
    fd: 1;
});
declare const customConsole: Console;
declare const run: (version?: string) => Promise<void>;

export { customConsole, outputStream, run };
