import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { FIRM_MAP_COPY, type MapNode, type Vec3 } from "@/lib/firm-map-shared";

import {
  crowdedLabels,
  KEEP_CLEAR_ATTR,
  labelRank,
  type ClearBox,
  type LabelBox,
} from "./firm-map-labels";
import { SEW_MS, type FirmMapRendererProps } from "./firm-map-renderer";

/**
 * The 3D firm map (Firm Brain Build Spec step 3, after the Firm Brain Mock-ups): a white stage, navy points and lime
 * stitched threads that turn slowly. Loaded only by dynamic import from FirmBrainMap, so three.js never reaches the
 * main bundle. It draws only the layout it is given and reports hovers and picks; FirmBrainMap holds every decision.
 * With reduced motion nothing turns, no bead travels and Replay does nothing.
 *
 * Colours come from the skin's tokens at mount (a probe element resolves each to rgb), never literals, so a reskin
 * reaches the 3D map too.
 */

const SEG = 170;
const RADIAL = 8;
const TUBE = 1.55;
const FEW = 9;
const FOV = 42;
/** How far the deeper green outline stands out past a thread. */
const EDGE = 0.55;

type Palette = {
  stage: THREE.Color;
  ink: THREE.Color;
  method: THREE.Color;
  live: THREE.Color;
  edge: THREE.Color;
  sunk: THREE.Color;
  mark: THREE.Color;
};

function resolvePalette(host: HTMLElement): Palette {
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.appendChild(probe);
  // Each token is read through the same utility class the flat map uses, so both renderers take one colour per job.
  const read = (className: string) => {
    probe.className = className;
    return new THREE.Color(getComputedStyle(probe).color || "black");
  };
  const palette = {
    stage: read("text-(--surface-raised)"),
    ink: read("text-(--text-primary)"),
    method: read("text-[var(--t-talk,var(--text-secondary))]"),
    live: read("text-(--live)"),
    edge: read("text-(--live-edge)"),
    sunk: read("text-(--surface-sunk)"),
    mark: read("text-(--text-secondary)"),
  };
  probe.remove();
  return palette;
}

const v3 = (point: Vec3) => new THREE.Vector3(point[0], point[1], point[2]);

function curveOf(path: Vec3[]): THREE.CurvePath<THREE.Vector3> {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i + 1 < path.length; i += 2)
    curve.add(new THREE.QuadraticBezierCurve3(v3(path[i - 1]!), v3(path[i]!), v3(path[i + 1]!)));
  return curve;
}

function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (g) draw(g);
  return new THREE.CanvasTexture(canvas);
}

type NodeView = {
  node: MapNode;
  mesh: THREE.Mesh;
  material: THREE.MeshLambertMaterial;
  halo: THREE.Sprite;
  haloMaterial: THREE.SpriteMaterial;
  label: HTMLSpanElement | null;
  /** The label's natural size, measured once it has one, and whether it was showing on the last frame. */
  labelWidth: number;
  labelHeight: number;
  showing: boolean;
};
type ThreadView = {
  id: string;
  curve: THREE.CurvePath<THREE.Vector3>;
  mesh: THREE.Mesh<THREE.TubeGeometry>;
  stitch: THREE.MeshLambertMaterial;
  solid: THREE.MeshLambertMaterial;
  /** The outline: a slightly wider tube drawn inside out, so only its rim shows around the thread. */
  edge: THREE.Mesh<THREE.TubeGeometry>;
  edgeStitch: THREE.MeshBasicMaterial;
  edgeSolid: THREE.MeshBasicMaterial;
  beads: THREE.Mesh[];
};

type Api = {
  apply: (lit: Set<string> | null, litNodes: Set<string> | null, selected: string | null) => void;
  replay: (delays: Map<string, number>) => void;
};

export default function FirmMap3D({
  layout,
  lit,
  litNodes,
  selected,
  reduceMotion,
  replayKey,
  replayDelays,
  onHover,
  onPick,
  onFail,
}: FirmMapRendererProps) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  // The scene reads the latest callbacks and state without being rebuilt.
  const live = useRef({ onHover, onPick, onFail, reduceMotion, lit, litNodes, selected });
  live.current = { onHover, onPick, onFail, reduceMotion, lit, litNodes, selected };

  useEffect(() => {
    const stage = host.current;
    const labelBox = labels.current;
    if (!stage || !labelBox) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      live.current.onFail?.();
      return;
    }
    const reduce = live.current.reduceMotion;
    const palette = resolvePalette(stage);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(palette.stage);
    const canvas = renderer.domElement;
    canvas.className = "block h-full w-full cursor-grab active:cursor-grabbing";
    canvas.setAttribute("aria-hidden", "true");
    stage.insertBefore(canvas, stage.firstChild);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(palette.stage, 560, 1250);
    scene.add(new THREE.HemisphereLight(palette.stage, palette.sunk, 1.02));
    const sun = new THREE.DirectionalLight(palette.stage, 0.32);
    sun.position.set(1, 2, 1.5);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);
    camera.position.set(250, 160, 650);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 260;
    controls.maxDistance = 1100;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.5;

    const disposables: { dispose: () => void }[] = [];
    const haloTexture = canvasTexture(64, 64, (g) => {
      const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.4, "rgba(255,255,255,0.35)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gradient;
      g.fillRect(0, 0, 64, 64);
    });
    // One stitch: a soft-ended dash with a gap after it. Alpha only; the colour is the material's.
    const dashTexture = canvasTexture(64, 4, (g) => {
      const gradient = g.createLinearGradient(0, 0, 64, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.08, "rgba(255,255,255,1)");
      gradient.addColorStop(0.6, "rgba(255,255,255,1)");
      gradient.addColorStop(0.68, "rgba(255,255,255,0)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gradient;
      g.fillRect(0, 0, 64, 4);
    });
    dashTexture.wrapS = THREE.RepeatWrapping;
    disposables.push(haloTexture, dashTexture);

    const nodeViews = new Map<string, NodeView>();
    const meshes: THREE.Mesh[] = [];
    for (const node of layout.nodes) {
      const material = new THREE.MeshLambertMaterial({
        color: node.kind === "method" ? palette.method : palette.ink,
        transparent: true,
      });
      const geometry = new THREE.SphereGeometry(node.size, 28, 20);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(v3(node.position));
      mesh.userData["id"] = node.id;
      scene.add(mesh);
      meshes.push(mesh);
      const haloMaterial = new THREE.SpriteMaterial({
        map: haloTexture,
        color: palette.ink,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      });
      const halo = new THREE.Sprite(haloMaterial);
      halo.scale.setScalar(node.size * 5.2);
      halo.position.copy(mesh.position);
      scene.add(halo);
      disposables.push(material, geometry, haloMaterial);

      let label: HTMLSpanElement | null = null;
      if (node.kind !== "lesson") {
        label = document.createElement("span");
        label.textContent = node.label;
        label.dataset["node"] = node.id;
        label.className =
          node.kind === "situation"
            ? "absolute left-0 top-0 whitespace-nowrap text-(length:--type-small) font-semibold text-foreground transition-opacity duration-300 rounded-[var(--radius-control)] bg-(--surface-raised) px-1"
            : node.kind === "method"
              ? "absolute left-0 top-0 whitespace-nowrap font-mono text-(length:--type-label) uppercase tracking-wider text-muted-foreground transition-opacity duration-300 rounded-[var(--radius-control)] bg-(--surface-raised) px-1"
              : "absolute left-0 top-0 whitespace-nowrap text-(length:--type-small) font-medium text-foreground opacity-0 transition-opacity duration-300 rounded-[var(--radius-control)] bg-(--surface-raised) px-1";
        labelBox.appendChild(label);
      }
      nodeViews.set(node.id, {
        node,
        mesh,
        material,
        halo,
        haloMaterial,
        label,
        labelWidth: 0,
        labelHeight: 0,
        showing: false,
      });
    }

    const beadGeometry = new THREE.SphereGeometry(2.6, 12, 10);
    const beadMaterial = new THREE.MeshLambertMaterial({ color: palette.ink });
    disposables.push(beadGeometry, beadMaterial);
    const threadViews: ThreadView[] = [];
    for (const thread of layout.threads) {
      if (thread.path.length < 3) continue;
      const curve = curveOf(thread.path);
      const geometry = new THREE.TubeGeometry(curve, SEG, TUBE, RADIAL, false);
      const uv = geometry.attributes["uv"] as THREE.BufferAttribute;
      const repeat = curve.getLength() / 12;
      for (let j = 0; j < uv.count; j += 1) uv.setX(j, uv.getX(j) * repeat);
      const stitch = new THREE.MeshLambertMaterial({
        color: palette.live,
        emissive: palette.live,
        emissiveIntensity: 0.3,
        map: dashTexture,
        transparent: true,
        alphaTest: 0.5,
      });
      const solid = new THREE.MeshLambertMaterial({
        color: palette.live,
        emissive: palette.live,
        emissiveIntensity: 0.3,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometry, stitch);
      scene.add(mesh);
      const edgeGeometry = new THREE.TubeGeometry(curve, SEG, TUBE + EDGE, RADIAL, false);
      const edgeUv = edgeGeometry.attributes["uv"] as THREE.BufferAttribute;
      for (let j = 0; j < edgeUv.count; j += 1) edgeUv.setX(j, edgeUv.getX(j) * repeat);
      const edgeStitch = new THREE.MeshBasicMaterial({
        color: palette.edge,
        map: dashTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.BackSide,
      });
      const edgeSolid = new THREE.MeshBasicMaterial({
        color: palette.edge,
        transparent: true,
        side: THREE.BackSide,
      });
      const edge = new THREE.Mesh(edgeGeometry, edgeStitch);
      scene.add(edge);
      disposables.push(edgeGeometry, edgeStitch, edgeSolid);
      const beads = [0, 1, 2].map(() => {
        const bead = new THREE.Mesh(beadGeometry, beadMaterial);
        bead.visible = false;
        scene.add(bead);
        return bead;
      });
      disposables.push(geometry, stitch, solid);
      threadViews.push({
        id: thread.id,
        curve,
        mesh,
        stitch,
        solid,
        edge,
        edgeStitch,
        edgeSolid,
        beads,
      });
    }

    function apply(
      litThreads: Set<string> | null,
      bright: Set<string> | null,
      chosen: string | null,
    ) {
      const few = litThreads !== null && litThreads.size > 0 && litThreads.size <= FEW;
      for (const view of threadViews) {
        const on = litThreads?.has(view.id) ?? false;
        view.mesh.material = on ? view.solid : view.stitch;
        view.stitch.opacity = litThreads ? 0.09 : 1;
        view.edge.material = on ? view.edgeSolid : view.edgeStitch;
        view.edgeStitch.opacity = litThreads ? 0.09 : 1;
        for (const bead of view.beads) bead.visible = on;
      }
      for (const view of nodeViews.values()) {
        const on = !bright || bright.has(view.node.id) || view.node.id === chosen;
        view.material.opacity = on ? 1 : 0.1;
        view.haloMaterial.color.copy(litThreads && on ? palette.live : palette.ink);
        view.haloMaterial.opacity = litThreads ? (on ? 0.55 : 0.02) : 0.1;
        if (view.label) {
          if (view.node.kind === "deck")
            view.label.dataset["show"] = litThreads && on && few ? "true" : "";
          else view.label.dataset["dim"] = on ? "" : "true";
        }
      }
      controls.autoRotateSpeed = litThreads ? 0.22 : 0.5;
    }

    let replayAt: number | null = null;
    let delays = new Map<string, number>();
    const fullRange = SEG * RADIAL * 6;

    // The words the stage itself shows over the map (the counts, the key). Labels give way to them.
    let keepClear: ClearBox[] = [];
    const measureKeepClear = () => {
      const frame = stage.getBoundingClientRect();
      keepClear = [
        ...(stage.parentElement?.querySelectorAll<HTMLElement>(`[${KEEP_CLEAR_ATTR}]`) ?? []),
      ].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left - frame.left + rect.width / 2,
          y: rect.top - frame.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      });
    };
    const resize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      measureKeepClear();
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // On a tall stage (a phone) the view widens so the whole map still fits side to side.
      camera.fov = Math.min(
        76,
        THREE.MathUtils.radToDeg(
          2 *
            Math.atan(
              Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.max(1, 1.15 / camera.aspect),
            ),
        ),
      );
      camera.updateProjectionMatrix();
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    observer?.observe(stage);
    resize();

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    let hover: string | null = null;
    const pick = (event: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(
        meshes.filter((mesh) => ((mesh.material as THREE.Material).opacity ?? 1) > 0.5),
      );
      return hit.length ? (hit[0]!.object.userData["id"] as string) : null;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || down) return;
      const id = pick(event);
      if (id === hover) return;
      hover = id;
      canvas.style.cursor = id ? "pointer" : "";
      live.current.onHover(id);
    };
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      const moved = down && Math.abs(event.clientX - down.x) + Math.abs(event.clientY - down.y) > 6;
      down = null;
      if (!moved) live.current.onPick(pick(event));
    };
    const onLeave = () => {
      down = null;
      if (hover !== null) {
        hover = null;
        live.current.onHover(null);
      }
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      live.current.onFail?.();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("webglcontextlost", onLost);

    const point = new THREE.Vector3();
    const boxes: LabelBox[] = [];
    const wanted = new Map<string, number>();
    let frame = 0;
    let ticks = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // The overlays can change size after the first frame (a web font arriving), so they are measured again now and then.
      ticks += 1;
      if (ticks % 90 === 0) measureKeepClear();
      controls.update();
      if (replayAt !== null) {
        const elapsed = now - replayAt;
        let done = true;
        for (const view of threadViews) {
          const progress = Math.max(
            0,
            Math.min(1, (elapsed - (delays.get(view.id) ?? 0)) / SEW_MS),
          );
          if (progress < 1) done = false;
          const sewn = Math.floor(SEG * progress) * RADIAL * 6;
          view.mesh.geometry.setDrawRange(0, sewn);
          view.edge.geometry.setDrawRange(0, sewn);
        }
        if (done) {
          replayAt = null;
          for (const view of threadViews) {
            view.mesh.geometry.setDrawRange(0, fullRange);
            view.edge.geometry.setDrawRange(0, fullRange);
          }
        }
      }
      const seconds = now / 1000;
      for (const view of threadViews) {
        if (!view.beads[0]!.visible) continue;
        view.beads.forEach((bead, k) => {
          const u = live.current.reduceMotion ? (k + 0.5) / 3 : (seconds * 0.13 + k / 3) % 1;
          bead.position.copy(view.curve.getPointAt(u));
        });
      }
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      // Labels that would sit on top of each other give way by rank (firm-map-labels), so the dense middle of the
      // map stays readable; a hidden label comes back as the map turns or when its point is pulled.
      boxes.length = 0;
      wanted.clear();
      for (const view of nodeViews.values()) {
        const label = view.label;
        if (!label) continue;
        point.copy(view.mesh.position).project(camera);
        if (point.z > 1) {
          label.style.visibility = "hidden";
          view.showing = false;
          continue;
        }
        label.style.visibility = "";
        const distance = camera.position.distanceTo(view.mesh.position);
        const size = Math.max(0.74, Math.min(1.1, 640 / distance));
        const lift = view.node.kind === "deck" ? 170 : 200;
        if (!view.labelWidth) {
          view.labelWidth = label.offsetWidth;
          view.labelHeight = label.offsetHeight;
        }
        // A label near the side of the stage slides in so its words are never cut off.
        const half = (view.labelWidth * size) / 2 + 6;
        const at = (point.x * 0.5 + 0.5) * width;
        const x = half * 2 < width ? Math.max(half, Math.min(width - half, at)) : width / 2;
        const y = (-point.y * 0.5 + 0.5) * height;
        label.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-${lift}%) scale(${size.toFixed(2)})`;
        const dim = label.dataset["dim"] === "true";
        const opacity =
          view.node.kind === "deck"
            ? label.dataset["show"] === "true"
              ? 1
              : 0
            : dim
              ? 0.14
              : Math.max(0.8, Math.min(1, (1040 - distance) / 420));
        wanted.set(view.node.id, opacity);
        if (opacity === 0) continue;
        boxes.push({
          id: view.node.id,
          x,
          y: y - view.labelHeight * (lift / 100 - 0.5),
          width: view.labelWidth * size,
          height: view.labelHeight * size,
          rank: labelRank({ kind: view.node.kind, dim, distance, showing: view.showing }),
        });
      }
      const crowded = crowdedLabels(boxes, undefined, keepClear);
      for (const [id, opacity] of wanted) {
        const view = nodeViews.get(id)!;
        view.showing = opacity > 0 && !crowded.has(id);
        view.label!.style.opacity = view.showing ? opacity.toFixed(2) : "0";
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    api.current = {
      apply,
      replay: (next) => {
        if (live.current.reduceMotion) return;
        delays = next;
        replayAt = performance.now();
      },
    };
    apply(live.current.lit, live.current.litNodes, live.current.selected);

    return () => {
      api.current = null;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      controls.dispose();
      for (const item of disposables) item.dispose();
      renderer.dispose();
      canvas.remove();
      labelBox.replaceChildren();
    };
  }, [layout, reduceMotion]);

  useEffect(() => {
    api.current?.apply(lit, litNodes, selected);
  }, [lit, litNodes, selected]);

  useEffect(() => {
    if (replayKey && !reduceMotion) api.current?.replay(replayDelays);
  }, [replayKey, reduceMotion, replayDelays]);

  return (
    <div
      ref={host}
      data-testid="firm-map-3d"
      role="img"
      aria-label={FIRM_MAP_COPY.mapLabel}
      className="relative h-full w-full overflow-hidden"
    >
      <div
        ref={labels}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden [&>span]:will-change-transform [&>span]:[text-shadow:0_0_4px_var(--surface-raised),0_0_8px_var(--surface-raised)]"
      />
    </div>
  );
}
