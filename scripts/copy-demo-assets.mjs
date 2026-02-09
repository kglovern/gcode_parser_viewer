import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src", "viewer", "viewcube.css");
const destDir = path.join(root, "examples");
const dest = path.join(destDir, "viewcube.css");

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log(`Copied ${src} -> ${dest}`);

