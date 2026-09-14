let loading: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

/**
 * One pdf.js for the whole client, rendering on the main thread.
 *
 * Two worker forms were tried and both failed to construct in this
 * deployment: `pdf.worker.min.mjs?url` and `new Worker(new URL(...,
 * import.meta.url), { type: "module" })`. Both showed negative resource-timing
 * durations, pdfjs fell back to its fake worker, and rendering hung after the
 * initial white page fill with zero content pixels drawn.
 *
 * Setting `globalThis.pdfjsWorker` is the documented no-worker path and is
 * what item-text.server.ts already does. Rendering moves onto the main thread,
 * which is acceptable here: the preview is capped at 30 pages and page one is
 * painted before the rest. A preview that renders on the main thread beats a
 * preview that never renders.
 */
export function loadPdfjs() {
  if (!loading) {
    loading = (async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore the worker build ships no types
      const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
      return await import("pdfjs-dist/legacy/build/pdf.mjs");
    })();
  }
  return loading;
}
