/**
 * MOVE-2: run async jobs one after another. A second section move waits for
 * the first save to come back, so it is sent with the versions that save
 * returned instead of the ones it replaced (8 Nov: two moves 1.4 s apart, the
 * second refused as a conflict).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
}
