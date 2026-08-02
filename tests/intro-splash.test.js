const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const originalWindow = global.window;
global.window = global;

const { getIntroLayout, getIntroTheme } = require(path.join(__dirname, "..", "js", "introSplash.js"));

test.after(() => {
  global.window = originalWindow;
  delete global.innerWidth;
  delete global.innerHeight;
});

test("getIntroTheme uses the browser local hour at the day and night boundaries", () => {
  const cases = [
    [7, 59, "night"],
    [8, 0, "day"],
    [12, 0, "day"],
    [19, 59, "day"],
    [20, 0, "night"],
    [23, 59, "night"],
    [0, 0, "night"]
  ];

  for (const [hour, minute, expectedTheme] of cases) {
    const date = new Date(2026, 7, 2, hour, minute);
    assert.equal(getIntroTheme(date), expectedTheme, `${hour}:${String(minute).padStart(2, "0")}`);
  }
});

test("getIntroLayout chooses the vertical artwork for narrow or portrait viewports", () => {
  const cases = [
    [390, 844, "mobile"],
    [430, 932, "mobile"],
    [844, 390, "desktop"],
    [768, 1024, "mobile"],
    [1024, 768, "desktop"],
    [1366, 768, "desktop"],
    [1920, 1080, "desktop"]
  ];

  for (const [width, height, expectedLayout] of cases) {
    global.innerWidth = width;
    global.innerHeight = height;
    assert.equal(getIntroLayout(), expectedLayout, `${width}x${height}`);
  }
});
