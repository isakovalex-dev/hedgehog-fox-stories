"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadService(initialValue = []) {
  let savedValue = initialValue;
  global.window = {
    HFStorageService: {
      getJSON: () => savedValue,
      setJSON: (_key, value) => {
        savedValue = value;
        return true;
      },
      removeItem: () => {
        savedValue = [];
        return true;
      }
    }
  };

  const modulePath = path.join(__dirname, "..", "js", "journeyService.js");
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);

  return {
    service: window.HFJourneyService,
    readSaved: () => savedValue
  };
}

test("journey stores one normalized discovery per story", () => {
  const { service, readSaved } = loadService();
  const story = {
    id: "sea-bench",
    journeyPlace: "sea",
    keepsake: "shell",
    title: "Скамейка на краю моря",
    slides: ["Лишнее поле не должно сохраняться"]
  };

  const first = service.markDiscovered(story);
  const second = service.markDiscovered(story);

  assert.equal(first.storyId, "sea-bench");
  assert.deepEqual(second, first);
  assert.equal(readSaved().length, 1);
  assert.deepEqual(Object.keys(readSaved()[0]).sort(), [
    "discoveredAt",
    "keepsake",
    "place",
    "storyId"
  ]);
  assert.equal(service.isDiscovered("sea-bench"), true);
});

test("journey treats malformed storage as empty", () => {
  const { service } = loadService({ unexpected: true });
  assert.deepEqual(service.getDiscoveries(), []);
});

test("journey can clear local discoveries", () => {
  const { service } = loadService([
    {
      storyId: "lost-cloud",
      place: "cottage",
      keepsake: "feather",
      discoveredAt: "2026-07-28T00:00:00.000Z"
    }
  ]);

  assert.equal(service.clearDiscoveries(), true);
  assert.deepEqual(service.getDiscoveries(), []);
});
