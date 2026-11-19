/**
 * Whether this browser can draw WebGL. Asked once, in the browser only, by surfaces that pick a 3D renderer, so a
 * browser without it gets the plain fallback instead of an error. Its own module so tests can switch it off.
 */
export function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return Boolean(context);
  } catch {
    return false;
  }
}
