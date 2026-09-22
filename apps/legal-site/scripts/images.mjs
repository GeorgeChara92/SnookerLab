// Makes each screenshot in three sizes, so every slot gets a sharp image of the right weight.
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("public/screens");
const out = path.join(dir, "sized");
await mkdir(out, { recursive: true });
for (const file of (await readdir(dir)).filter((name) => name.endsWith(".png"))) {
  const name = file.replace(/\.png$/, "");
  for (const width of [360, 560, 820]) {
    await sharp(path.join(dir, file))
      .resize({ width, kernel: "lanczos3" })
      .sharpen({ sigma: 0.5 })
      .webp({ quality: 86, effort: 6 })
      .toFile(path.join(out, `${name}-${width}.webp`));
  }
}
console.log("screenshots sized");
