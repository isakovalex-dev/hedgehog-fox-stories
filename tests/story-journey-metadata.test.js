"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadStoryService() {
  global.window = {
    HFSupabaseService: {},
    HFStorageService: {
      getJSON: (_key, fallback) => fallback,
      setJSON: () => true
    }
  };

  const modulePath = path.join(__dirname, "..", "js", "storyService.js");
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return window.HFStoryService;
}

test("built-in stories have curated journey places and keepsakes", () => {
  const service = loadStoryService();
  const actual = service.getBuiltInStories().map(({ id, journeyPlace, keepsake }) => ({
    id,
    journeyPlace,
    keepsake
  }));

  assert.deepEqual(actual, [
    { id: "lost-cloud", journeyPlace: "cottage", keepsake: "feather" },
    { id: "sea-bench", journeyPlace: "sea", keepsake: "shell" },
    { id: "hedgehog-bravery", journeyPlace: "forest", keepsake: "leaf" },
    { id: "warm-wind-map", journeyPlace: "meadow", keepsake: "feather" },
    { id: "rustling-grass", journeyPlace: "meadow", keepsake: "leaf" },
    { id: "star-for-friend", journeyPlace: "starry-hill", keepsake: "star" }
  ]);
});

test("user stories receive safe journey defaults", () => {
  const service = loadStoryService();
  window.HFStorageService.getJSON = () => [
    {
      id: "user-story",
      title: "Тихий вечер",
      age: "5–7",
      mood: "перед сном",
      slides: ["История"]
    }
  ];

  const [story] = service.getUserStories();
  assert.equal(story.journeyPlace, "starry-hill");
  assert.equal(story.journeyPlaceLabel, "Звёздная горка");
  assert.equal(story.keepsake, "star");
});
