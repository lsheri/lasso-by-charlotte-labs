import { useLayoutEffect, useRef, type CSSProperties } from "react";

import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

export const CONTEXT_CORONA_MOTION_CAP = 12;
export const CONTEXT_CORONA_EXIT_MS = 200;
export const CORONA_LOOK = { reach: 33, speed: 0.6, heat: 1.07, wisp: 0.89 } as const;
const CORONA_CULL_PAD = CORONA_LOOK.reach * 4.2 + 30;
const FRAME_MS = 33;

export type CoronaPoint = { x: number; y: number };
export type CoronaSize = { width: number; height: number };
export type CoronaRect = CoronaPoint & CoronaSize;

type CoronaEntry = {
  node: LabNode;
  height: number;
  enteredAt: number;
  leftAt?: number;
};

type CoronaGl = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

/** Stable negative phase, in milliseconds, reused as a deterministic card seed. */
export function contextCoronaPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return -(Math.abs(hash) % 13000);
}

export function contextCoronaSeed(id: string): number {
  return (Math.abs(contextCoronaPhase(id)) % 997) / 10;
}

/** Reading order decides which twelve context cards receive shader light. */
export function contextCoronaMotionIds(nodes: readonly LabNode[]): string[] {
  return [...nodes]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, CONTEXT_CORONA_MOTION_CAP)
    .map((node) => node.id);
}

export function coronaLook(zoom: number): number {
  return Math.min(1.45, Math.max(0.5, zoom));
}

export function coronaScreenRect(node: LabNode, pan: CoronaPoint, zoom: number, height: number): CoronaRect {
  return { x: node.x * zoom + pan.x, y: node.y * zoom + pan.y, width: node.width * zoom, height: height * zoom };
}

export function coronaLookRect(rect: CoronaRect, look: number): CoronaRect {
  return { x: rect.x / look, y: rect.y / look, width: rect.width / look, height: rect.height / look };
}

export function coronaTouchesViewport(rect: CoronaRect, viewport: CoronaSize, look: number): boolean {
  const pad = CORONA_CULL_PAD * look;
  return rect.x - pad < viewport.width && rect.x + rect.width + pad > 0 && rect.y - pad < viewport.height && rect.y + rect.height + pad > 0;
}

export function contextCoronaAge(now: number, enteredAt: number, still: boolean): number {
  return still ? 5 : now - enteredAt;
}

export function contextCoronaFade(now: number, leftAt: number | undefined): number {
  if (leftAt === undefined) return 1;
  const elapsedMs = (now - leftAt) * 1000;
  if (elapsedMs >= CONTEXT_CORONA_EXIT_MS - 0.000001) return 0;
  return Math.max(0, Math.min(1, 1 - elapsedMs / CONTEXT_CORONA_EXIT_MS));
}

const VERTEX_SHADER = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAGMENT_SHADER = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;            // backing store size in device px
uniform float uScale;         // device px per look unit (s * look)
uniform float uTime;          // seconds, frozen while the board moves
uniform int uCount;
uniform vec4 uRects[12];      // x, y, w, h in look units, relative to the canvas top-left, y down
uniform float uAge[12];       // seconds since entering context (negative while waiting on the stagger)
uniform float uFade[12];      // 1 in context, to 0 over 200ms when leaving
uniform float uSeed[12];      // stable per card id
uniform float uReach, uSpeed, uHeat, uWisp;
uniform vec3 uLime;

float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)), hash3(i+vec3(1,0,0)), u.x),
                 mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), u.x), u.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), u.x),
                 mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm3(vec3 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a*noise3(p); p = p*2.02 + vec3(11.3, 7.1, 3.7); a *= 0.5; }
  return v;
}
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
float sdR(vec2 p, vec2 b){ return sdRound(p, b, 10.0); }

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  float flame = 0.0, glow = 0.0, rim = 0.0;
  float t = uTime * uSpeed;
  for (int i = 0; i < 12; i++){
    if (i >= uCount) break;
    vec4 r = uRects[i];
    vec2 hb = r.zw*0.5;
    vec2 lp = px - (r.xy + hb);
    float d0 = sdR(lp, hb);
    if (d0 < -1.0 || d0 > uReach*4.5 + 30.0) continue;   // never inside the card; skip far pixels
    float d = max(d0, 0.0);
    float age = uAge[i];
    float grow = smoothstep(0.0, 0.35, age) * uFade[i];
    float burst = 1.0 + 0.7*exp(-age*2.6)*smoothstep(0.0, 0.08, age);
    float seed = uSeed[i];
    vec2 e = vec2(1.0, 0.0);
    vec2 n = normalize(vec2(sdR(lp+e.xy,hb) - sdR(lp-e.xy,hb), sdR(lp+e.yx,hb) - sdR(lp-e.yx,hb)) + 1e-5);
    vec2 edge = lp - n*d;
    vec2 ray = edge / (1.0 + d*0.007);                     // rays fan outward like a sun
    float plume  = fbm3(vec3(ray*0.011 + seed, t*0.13));
    float streak = fbm3(vec3(ray*0.05 + seed*0.6, t*0.33));
    float active = smoothstep(0.38, 0.78, plume);
    float len = min(uReach * grow * burst * (0.3 + 0.6*streak + 1.6*active*active), uReach*3.0);
    float w = fbm3(vec3(ray*0.028 + seed*1.3, d*0.055 - t*0.8));
    float body = exp(-d / max(len, 1.0));
    body *= mix(1.0, 0.3 + 1.3*w, uWisp * smoothstep(1.0, 12.0, d));
    body *= 1.0 - smoothstep(uReach*2.6, uReach*4.2, d);
    float bright = 0.45 + 0.8*smoothstep(0.25, 0.75, fbm3(vec3(ray*0.007 + seed*2.1, t*0.09)));
    flame = max(flame, body * bright);
    glow = max(glow, exp(-d/(uReach*1.1 + 1.0)) * 0.16 * grow * burst * bright * (1.0 - smoothstep(uReach*2.6, uReach*4.2, d)));
    rim  = max(rim, exp(-d/1.3) * grow * (0.55 + 0.45*bright));
  }
  float h = clamp(flame * uHeat, 0.0, 1.6);
  vec3 deep = uLime * vec3(0.55, 0.78, 0.6);
  vec3 hot  = mix(uLime, vec3(1.0), 0.35);
  vec3 col = mix(deep, uLime, smoothstep(0.08, 0.5, h));
  col = mix(col, hot, clamp(smoothstep(0.85, 1.35, h)*0.9 + rim*0.35, 0.0, 1.0));
  float a = clamp(pow(h, 1.15)*0.85 + glow + rim*0.6, 0.0, 0.95);
  gl_FragColor = vec4(col*a, a);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function createCoronaGl(canvas: HTMLCanvasElement): CoronaGl | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  } catch {
    return null;
  }
  if (!gl) return null;
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  const names = ["uRes", "uScale", "uTime", "uCount", "uRects[0]", "uAge[0]", "uFade[0]", "uSeed[0]", "uReach", "uSpeed", "uHeat", "uWisp", "uLime"];
  const uniformKey = (name: string) => name.replace("[0]", "");
  return { gl, program, buffer, uniforms: Object.fromEntries(names.map((name) => [uniformKey(name), gl?.getUniformLocation(program, name) ?? null])) };
}

export function parseCoronaColour(value: string): [number, number, number] | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    const body = trimmed.slice(1);
    if (!/^[\da-f]{6}$/i.test(body)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(body.slice(offset, offset + 2), 16) / 255) as [number, number, number];
  }
  const match = trimmed.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return null;
  const channels = match.slice(1, 4).map(Number);
  if (channels.some((channel) => !Number.isFinite(channel))) return null;
  return channels.map((channel) => channel / 255) as [number, number, number];
}

export function LabContextCoronas({
  nodes,
  entryDelays,
  pan,
  zoom,
  viewport,
  interacting,
  still,
  heightOf,
}: {
  nodes: readonly LabNode[];
  entryDelays: Readonly<Record<string, number>>;
  pan: CoronaPoint;
  zoom: number;
  viewport: CoronaSize;
  interacting: boolean;
  still: boolean;
  heightOf: (node: LabNode) => number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<CoronaGl | null>(null);
  const unavailableRef = useRef(false);
  const entriesRef = useRef(new Map<string, CoronaEntry>());
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const clockRef = useRef({ value: 0, last: 0 });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const now = clockRef.current.value;
    const currentIds = new Set(nodes.map((node) => node.id));
    for (const [id, entry] of entriesRef.current) {
      if (!currentIds.has(id) && entry.leftAt === undefined) entry.leftAt = now;
    }
    for (const node of nodes) {
      const existing = entriesRef.current.get(node.id);
      if (existing) {
        existing.node = node;
        existing.height = heightOf(node);
        delete existing.leftAt;
      } else {
        const delay = entryDelays[node.id];
        entriesRef.current.set(node.id, {
          node,
          height: heightOf(node),
          enteredAt: delay === undefined ? now - 5 : now + delay / 1000,
        });
      }
    }

    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(0, Math.round(viewport.width * scale));
    const height = Math.max(0, Math.round(viewport.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    if (!glRef.current && !unavailableRef.current && nodes.length > 0) {
      glRef.current = createCoronaGl(canvas);
      if (!glRef.current) unavailableRef.current = true;
    }

    const draw = (stamp: number) => {
      const corona = glRef.current;
      if (!corona) return false;
      const { gl, uniforms } = corona;
      const drawNow = clockRef.current.value;
      for (const [id, entry] of entriesRef.current) {
        if (contextCoronaFade(drawNow, entry.leftAt) <= 0) entriesRef.current.delete(id);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const lime = parseCoronaColour(getComputedStyle(canvas).getPropertyValue("--nb-lasso-green"));
      if (!lime || canvas.width === 0 || canvas.height === 0) return entriesRef.current.size > 0;
      const look = coronaLook(zoom);
      const orderedIds = contextCoronaMotionIds(nodes);
      const entries = [...entriesRef.current.values()]
        .filter((entry) => orderedIds.includes(entry.node.id) || entry.leftAt !== undefined)
        .sort((a, b) => {
          const ai = orderedIds.indexOf(a.node.id);
          const bi = orderedIds.indexOf(b.node.id);
          return (ai < 0 ? CONTEXT_CORONA_MOTION_CAP : ai) - (bi < 0 ? CONTEXT_CORONA_MOTION_CAP : bi);
        })
        .filter((entry) => coronaTouchesViewport(coronaScreenRect(entry.node, pan, zoom, entry.height), viewport, look))
        .slice(0, CONTEXT_CORONA_MOTION_CAP);
      if (entries.length === 0) return false;
      if (!still && !interacting) {
        if (clockRef.current.last > 0) clockRef.current.value += Math.max(0, (stamp - clockRef.current.last) / 1000);
        clockRef.current.last = stamp;
      } else {
        clockRef.current.last = 0;
      }
      const motionNow = clockRef.current.value;
      const rects = new Float32Array(CONTEXT_CORONA_MOTION_CAP * 4);
      const ages = new Float32Array(CONTEXT_CORONA_MOTION_CAP);
      const fades = new Float32Array(CONTEXT_CORONA_MOTION_CAP);
      const seeds = new Float32Array(CONTEXT_CORONA_MOTION_CAP);
      entries.forEach((entry, index) => {
        const rect = coronaLookRect(coronaScreenRect(entry.node, pan, zoom, entry.height), look);
        rects.set([rect.x, rect.y, rect.width, rect.height], index * 4);
        ages[index] = contextCoronaAge(motionNow, entry.enteredAt, still);
        fades[index] = contextCoronaFade(motionNow, entry.leftAt);
        seeds[index] = contextCoronaSeed(entry.node.id);
      });
      gl.useProgram(corona.program);
      gl.uniform2f(uniforms["uRes"] ?? null, canvas.width, canvas.height);
      gl.uniform1f(uniforms["uScale"] ?? null, scale * look);
      gl.uniform1f(uniforms["uTime"] ?? null, clockRef.current.value);
      gl.uniform1i(uniforms["uCount"] ?? null, entries.length);
      gl.uniform4fv(uniforms["uRects"] ?? null, rects);
      gl.uniform1fv(uniforms["uAge"] ?? null, ages);
      gl.uniform1fv(uniforms["uFade"] ?? null, fades);
      gl.uniform1fv(uniforms["uSeed"] ?? null, seeds);
      gl.uniform1f(uniforms["uReach"] ?? null, CORONA_LOOK.reach);
      gl.uniform1f(uniforms["uSpeed"] ?? null, CORONA_LOOK.speed);
      gl.uniform1f(uniforms["uHeat"] ?? null, CORONA_LOOK.heat);
      gl.uniform1f(uniforms["uWisp"] ?? null, CORONA_LOOK.wisp);
      gl.uniform3f(uniforms["uLime"] ?? null, lime[0], lime[1], lime[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return entriesRef.current.size > 0;
    };

    draw(performance.now());
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (!still && !interacting && entriesRef.current.size > 0 && glRef.current) {
      const loop = (stamp: number) => {
        if (stamp - lastFrameRef.current >= FRAME_MS) {
          lastFrameRef.current = stamp;
          if (!draw(stamp)) return;
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [entryDelays, heightOf, interacting, nodes, pan.x, pan.y, still, viewport.height, viewport.width, zoom]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onLost = (event: Event) => {
      event.preventDefault();
      unavailableRef.current = true;
      glRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      const gl = glRef.current?.gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      glRef.current = null;
    };
  }, []);

  const safeZoom = zoom > 0 ? zoom : 1;
  return (
    <canvas
      ref={canvasRef}
      data-testid="lab-context-coronas"
      className="canvas-lab-context-coronas pointer-events-none absolute"
      aria-hidden="true"
      style={{
        left: -pan.x / safeZoom,
        top: -pan.y / safeZoom,
        width: viewport.width / safeZoom,
        height: viewport.height / safeZoom,
      } as CSSProperties}
    />
  );
}
