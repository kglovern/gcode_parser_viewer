import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src", "viewer", "viewcube.css");
const outDir = path.join(root, "dist", "viewer");
const dest = path.join(outDir, "viewcube.css");

await mkdir(outDir, { recursive: true });
await copyFile(src, dest);
console.log(`Copied ${src} -> ${dest}`);

