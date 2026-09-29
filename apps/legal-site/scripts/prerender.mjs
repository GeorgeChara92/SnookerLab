// Renders every page to static HTML after the build, so each URL loads with its content in place.
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const template = await readFile(path.join(dist, "index.html"), "utf8");
const { render, ROUTES } = await import(pathToFileURL(path.resolve("dist-server/entry-server.js")).href);

for (const route of ROUTES) {
  const { html, head } = render(route.path);
  const page = template.replace("<!--head-->", head).replace("<!--app-->", html);
  const file = route.path === "/" ? "index.html" : `${route.path.slice(1)}.html`;
  const dest = path.join(dist, file);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, page);
  console.log("prerendered", route.path, "->", file);
}

const today = new Date().toISOString().slice(0, 10);
// The home page changes most; the legal pages barely move.
const weight = (path) => (path === "/" ? "1.0" : path === "/privacy" || path === "/terms" ? "0.3" : "0.8");
const urls = ROUTES.filter((route) => route.path !== "/404" && !route.path.startsWith("/admin"))
  .map(
    (route) =>
      `
  <url><loc>https://snookeredapp.com${route.path === "/" ? "/" : route.path}</loc>` +
      `<lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${weight(route.path)}</priority></url>`
  )
  .join("");
await writeFile(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`
);
await writeFile(
  path.join(dist, "robots.txt"),
  "User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://snookeredapp.com/sitemap.xml\n"
);
await rm(path.resolve("dist-server"), { recursive: true, force: true });
