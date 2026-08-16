// Regenerates all brand icons from the Coach Lasso spider mascot art.
// Usage: node scripts/generate-icons.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const CACHE = path.join(ROOT, "node_modules", ".cache", "coach-lasso-spider.png");
const CDN_ORIGIN = "https://pilot-platform.charlotte-labs.dev";

const BG = { r: 0x0b, g: 0x2a, b: 0x4a, alpha: 1 }; // #0B2A4A

async function loadSource() {
  try {
    return await readFile(CACHE);
  } catch {
    const pointer = JSON.parse(
      await readFile(path.join(ROOT, "src/assets/coach-lasso-spider.png.asset.json"), "utf8"),
    );
    const res = await fetch(CDN_ORIGIN + pointer.url);
    if (!res.ok) throw new Error(`Failed to fetch source art: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(CACHE), { recursive: true });
    await writeFile(CACHE, buf);
    return buf;
  }
}

/** Drop the paper-white background to transparency and trim to the subject. */
async function spiderCutout() {
  const src = await loadSource();
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 243 && data[i + 1] > 243 && data[i + 2] > 243) data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** Spider centred on solid navy. `ratio` controls the subject's share of the tile. */
async function tile(spider, size, ratio = 0.84) {
  const inner = Math.round(size * ratio);
  const art = await sharp(spider)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: "centre" }])
    .flatten({ background: BG }) // iOS renders any transparency as black
    .png()
    .toBuffer();
}

async function ogImage(spider) {
  const art = await sharp(spider)
    .resize(470, 470, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="530" y="330" font-family="monospace" font-size="150" font-weight="bold" fill="#6FFAC6" letter-spacing="10">LASSO</text>
  <text x="536" y="400" font-family="monospace" font-size="42" fill="#C9D8E8" letter-spacing="6">BY CHARLOTTE LABS</text>
</svg>`);
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: BG } })
    .composite([
      { input: art, left: 40, top: 80 },
      { input: svg, left: 0, top: 0 },
    ])
    .flatten({ background: BG })
    .png()
    .toBuffer();
}

const spider = await spiderCutout();

const out = async (name, buf) => {
  await writeFile(path.join(PUBLIC_DIR, name), buf);
  const meta = await sharp(buf).metadata().catch(() => null);
  console.log(name.padEnd(28), meta ? `${meta.width}x${meta.height}` : "ico", `${buf.length} bytes`);
};

await out("apple-touch-icon.png", await tile(spider, 180));
await out("icon-192.png", await tile(spider, 192));
await out("icon-512.png", await tile(spider, 512));
// Maskable variants: subject inside the 80% safe zone so Android's mask never clips it.
await out("icon-192-maskable.png", await tile(spider, 192, 0.62));
await out("icon-512-maskable.png", await tile(spider, 512, 0.62));
await out("favicon.png", await tile(spider, 96));
await out("mcp-icon-48.png", await tile(spider, 48));
await out("mcp-icon-256.png", await tile(spider, 256));
await out("og-image.png", await ogImage(spider));

const ico = await pngToIco([await tile(spider, 16), await tile(spider, 32), await tile(spider, 48)]);
await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), ico);
console.log("favicon.ico".padEnd(28), "16/32/48", `${ico.length} bytes`);
