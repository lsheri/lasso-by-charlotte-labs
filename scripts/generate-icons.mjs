// Regenerates all brand icons from the Charlotte Labs mascot art.
// Subject: the green "Coach Lasso" spider, cropped out of src/assets/lasso-mascots.png.
// Usage: node scripts/generate-icons.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const CACHE = path.join(ROOT, "node_modules", ".cache", "lasso-mascots.png");
const CDN_ORIGIN = "https://pilot-platform.charlotte-labs.dev";

const BG = { r: 0x0b, g: 0x2a, b: 0x4a, alpha: 1 }; // #0B2A4A
// Final crop of the spider inside the 1536x1024 source art.
const CROP = { left: 110, top: 280, width: 712, height: 730 };

async function loadSource() {
  try {
    return await readFile(CACHE);
  } catch {
    const pointer = JSON.parse(
      await readFile(path.join(ROOT, "src/assets/lasso-mascots.png.asset.json"), "utf8"),
    );
    const res = await fetch(CDN_ORIGIN + pointer.url);
    if (!res.ok) throw new Error(`Failed to fetch source art: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(CACHE), { recursive: true });
    await writeFile(CACHE, buf);
    return buf;
  }
}

/** Keep only spider colours (green / navy outline / white) in the right strip,
 *  so no fragment of the neighbouring blue pig mascot survives the crop. */
function maskNeighbour(data, w, h) {
  const STRIP_X = 560;
  for (let y = 0; y < h; y++) {
    for (let x = STRIP_X; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const isGreen = g > 120 && g > b + 35 && g >= r;
      const isNavy = r < 90 && g < 110 && b < 150 && b >= g;
      const isLight = r > 225 && g > 225 && b > 225;
      const keep = y > 300 && (isGreen || isNavy || isLight);
      if (!keep) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 0;
      }
    }
  }
  return data;
}

/** Flood-fill the paper-white background in from the borders and make it
 *  transparent, so leftover white between the two mascots does not show up
 *  as a pale block on the navy tile. Interior whites (cap, circuits) stay. */
function clearBackground(data, w, h) {
  const isBg = (i) =>
    data[i + 3] < 8 || (data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
}

async function spiderCutout() {
  const src = await loadSource();
  const cropped = sharp(src).extract(CROP).ensureAlpha();
  const { data, info } = await cropped.raw().toBuffer({ resolveWithObject: true });
  maskNeighbour(data, info.width, info.height);
  clearBackground(data, info.width, info.height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/** Spider centred on solid navy with ~9% margin. */
async function tile(spider, size) {
  const inner = Math.round(size * 0.82);
  const art = await sharp(spider).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function ogImage(spider) {
  const art = await sharp(spider).resize(470, 470, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="530" y="330" font-family="monospace" font-size="150" font-weight="bold" fill="#6FFAC6" letter-spacing="10">LASSO</text>
  <text x="536" y="400" font-family="monospace" font-size="42" fill="#C9D8E8" letter-spacing="6">BY CHARLOTTE LABS</text>
</svg>`);
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: BG } })
    .composite([
      { input: art, left: 40, top: 80 },
      { input: svg, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

const spider = await spiderCutout();

const out = async (name, buf) => {
  await writeFile(path.join(PUBLIC_DIR, name), buf);
  const meta = await sharp(buf).metadata().catch(() => null);
  console.log(name.padEnd(24), meta ? `${meta.width}x${meta.height}` : "ico", `${buf.length} bytes`);
};

await out("apple-touch-icon.png", await tile(spider, 180));
await out("icon-192.png", await tile(spider, 192));
await out("icon-512.png", await tile(spider, 512));
await out("favicon.png", await tile(spider, 96));
await out("mcp-icon-48.png", await tile(spider, 48));
await out("mcp-icon-256.png", await tile(spider, 256));
await out("og-image.png", await ogImage(spider));

const ico = await pngToIco([await tile(spider, 16), await tile(spider, 32), await tile(spider, 48)]);
await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), ico);
console.log("favicon.ico".padEnd(24), "16/32/48", `${ico.length} bytes`);
