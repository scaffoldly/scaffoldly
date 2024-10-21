#!/usr/bin/env node
declare class AbortEvent extends AbortController {
    constructor();
    abort(reason: unknown): void;
}

declare const run: (abortEvent: AbortEvent) => Promise<void>;

export { run };
