// Renders every page to static HTML after the build, so each URL loads with its content in place.
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const template = await readFile(path.join(dist, "index.html"), "utf8");
const { render, ROUTES } = await import(pathToFileURL(path.resolve("dist-server/entry-server.js")).href);

for (const route of ROUTES) {
  const { html, head } = render(route.path);
  const page = template.replace("<!--head-->", head).replace("<!--app-->", html);
  const file = route.path === "/" ? "index.html" : `${route.path.slice(1)}.html`;
  await writeFile(path.join(dist, file), page);
  console.log("prerendered", route.path, "->", file);
}

const urls = ROUTES.filter((route) => route.path !== "/404")
  .map((route) => `<url><loc>https://snookeredapp.com${route.path}</loc></url>`)
  .join("");
await writeFile(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`
);
await writeFile(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://snookeredapp.com/sitemap.xml\n");
await rm(path.resolve("dist-server"), { recursive: true, force: true });
