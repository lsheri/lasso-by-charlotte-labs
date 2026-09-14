let loading: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * One pdf.js for the whole client, with one worker.
 *
 * The worker is constructed here rather than handed to pdfjs as a URL string.
 * `pdfjs-dist/build/pdf.worker.min.mjs?url` produced a URL that failed to
 * construct a Worker in this deployment: both attempts showed negative
 * durations in resource timing, pdfjs silently fell back to its fake worker,
 * and page rendering then hung after the initial white fill. Constructing the
 * Worker with `new URL(..., import.meta.url)` is the form the bundler
 * understands, and `workerPort` skips pdfjs's own construction path entirely.
 */
export function loadPdfjs() {
  if (!loading) {
    loading = (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
      return pdfjs;
    })();
  }
  return loading;
}
