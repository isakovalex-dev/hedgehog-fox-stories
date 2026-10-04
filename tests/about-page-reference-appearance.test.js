"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");

async function readProjectFile(path) {
  return readFile(resolve(root, path), "utf8");
}

test("About page loads only its reference geometry rules after global styles", async () => {
  const html = await readProjectFile("about.html");
  const css = await readProjectFile("styles-about-reference.css");

  const globalStylesIndex = html.indexOf('href="styles.css?v=18"');
  const referenceStylesIndex = html.indexOf('href="styles-about-reference.css?v=1"');

  assert.ok(globalStylesIndex >= 0, "about.html must keep the global stylesheet");
  assert.ok(referenceStylesIndex > globalStylesIndex, "reference stylesheet must load after global styles");
  assert.match(
    css,
    /\.about-page \.note-sketch,[\s\S]*?\.about-page \.future-sketch img\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;[\s\S]*?aspect-ratio:\s*auto !important;[\s\S]*?object-fit:\s*contain;/
  );
  assert.match(
    css,
    /\.about-page \.nav-brand,[\s\S]*?\.about-page \.site-footer a\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/
  );
});
