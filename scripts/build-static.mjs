import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const outputDirectory = join(projectRoot, "dist");

const publicDirectories = ["assets", "js", "public", "src", "styles"];
const publicRootFiles = [
  "CNAME",
  "manifest.webmanifest",
  "robots.txt",
  "script.js",
  "sitemap.xml",
  "styles.css",
];
const publicRootExtensions = new Set([".css", ".html"]);
const excludedProductionPaths = new Set([
  "assets/forest-catcher",
  "flight.html",
  "forest-catcher.css",
  "forest-catcher.html",
  "js/catchGame.js",
  "js/forestCatcherGame.js",
]);

function shouldCopy(source) {
  const projectPath = relative(projectRoot, source);
  return ![...excludedProductionPaths].some(
    (excludedPath) => projectPath === excludedPath || projectPath.startsWith(`${excludedPath}/`),
  );
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const directory of publicDirectories) {
  await cp(join(projectRoot, directory), join(outputDirectory, directory), {
    filter: shouldCopy,
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

  if (excludedProductionPaths.has(entry.name)) {
    continue;
  }

  await cp(join(projectRoot, entry.name), join(outputDirectory, entry.name));
}

console.log(`Static site built in ${outputDirectory}`);
