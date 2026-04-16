import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");

const svgBuf = readFileSync(resolve(publicDir, "icon-512.svg"));

await sharp(svgBuf, { density: 300 })
  .resize(192, 192)
  .png()
  .toFile(resolve(publicDir, "icon-192.png"));

console.log("✓ icon-192.png");

await sharp(svgBuf, { density: 300 })
  .resize(512, 512)
  .png()
  .toFile(resolve(publicDir, "icon-512.png"));

console.log("✓ icon-512.png");
