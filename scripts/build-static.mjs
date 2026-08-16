import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { buildBrowserRuntimeConfig, renderBrowserRuntimeConfig } from "./browser-runtime-config.mjs";

const projectRoot = process.cwd();
const outputDirectory = join(projectRoot, "dist");

const publicDirectories = ["assets", "js", "public", "src"];
const publicRootFiles = [
  "CNAME",
  "manifest.webmanifest",
  "robots.txt",
  "script.js",
  "sitemap.xml",
  "styles.css",
];
const publicRootExtensions = new Set([".css", ".html"]);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const directory of publicDirectories) {
  await cp(join(projectRoot, directory), join(outputDirectory, directory), {
    recursive: true,
  });
}

await cp(join(projectRoot, "public", "assets"), join(outputDirectory, "assets"), {
  recursive: true,
});

for (const file of publicRootFiles) {
  await cp(join(projectRoot, file), join(outputDirectory, file));
}

const rootEntries = await readdir(projectRoot, { withFileTypes: true });

for (const entry of rootEntries) {
  if (!entry.isFile() || !publicRootExtensions.has(extname(entry.name))) {
    continue;
  }

  await cp(join(projectRoot, entry.name), join(outputDirectory, entry.name));
}

await writeFile(
  join(outputDirectory, "js", "config.js"),
  renderBrowserRuntimeConfig(buildBrowserRuntimeConfig(process.env)),
  "utf8"
);

console.log(`Static site built in ${outputDirectory}`);
