(function (window) {
  "use strict";

  const USER_STORIES_KEY = "hedgehogFoxUserStories";
  const REMOTE_STORY_META_KEY = "hedgehogFoxSupabaseStoryMeta";
  const DEFAULT_COLORS = ["#cfeaf1", "#f8e9be", "#9fca84"];
  const DEFAULT_SCENE_TAG = "forest_day";
  const JOURNEY_PLACES = {
    forest: "Лес",
    meadow: "Поляна",
    cottage: "Домик",
    sea: "Море",
    "starry-hill": "Звёздная горка"
  };
  const supabaseService = window.HFSupabaseService;

  // Built-in stories have curated art. User stories never borrow it: a borrowed
  // scene would falsely imply that OpenAI created an illustration for this page.
  const sceneIllustrationSets = {
    sea_bench: "sea-bench",
    river_bank: "sea-bench",
    hill_clouds: "lost-cloud",
    forest_day: "rustling-grass",
    sunny_meadow: "hedgehog-bravery",
    mushroom_glade: "hedgehog-bravery",
    forest_night: "star-for-friend",
    starry_sky: "star-for-friend",
    cozy_house: "warm-wind-map",
    warm_kitchen: "warm-wind-map",
    rainy_forest: "rustling-grass",
    autumn_path: "rustling-grass",
    winter_forest: "lost-cloud",
    small_bridge: "hedgehog-bravery",
    campfire_evening: "star-for-friend"
  };

  let remoteUserStories = [];
  let storageMode = "local";
  let lastStorageError = "";

  const builtInStories = [
    {
      id: "lost-cloud",
      title: "Облако, которое заблудилось",
      age: "5–7",
      ageGroup: "5-7",
      time: "5 минут",
      tags: ["5-7", "bedtime", "friendship"],
      journeyPlace: "cottage",
      keepsake: "feather",
      imageUrl: "assets/stories/lost-cloud.png",
      baseLikes: 12,
      colors: ["#cfeaf1", "#f8e9be", "#9fca84"],
      description:
        "Ежонок и Лисёнок встречают маленькое облако, которое никак не может найти дорогу к своему небу.",
      slides: [
        "Ежонок сидел на старой деревянной скамейке и смотрел, как по небу плывёт большое пушистое облако. Рядом устроился Лисёнок и тихо сказал: «Кажется, оно кого-то ищет».",
        "Облако опустилось ниже и стало похоже на мягкую подушку. «Я заблудилось», — прошептало оно тоненьким дождевым голосом.",
        "Лисёнок посмотрел на ветер, на чаек и на светлую дорожку над морем. «Мы пойдём рядом, пока ты не узнаешь свой дом», — сказал он.",
        "Ежонок нашёл в траве блестящую каплю и поднял её к солнцу. В капле отразилось небо, и облако вдруг вспомнило дорогу.",
        "Когда облако поднялось высоко-высоко, оно подарило друзьям маленькую тень. В этой тени было прохладно, спокойно и очень по-дружески."
      ]
    },
    {
      id: "sea-bench",
      title: "Скамейка на краю моря",
      age: "5–7",
      ageGroup: "5-7",
      time: "6 минут",
      tags: ["5-7", "bedtime", "friendship"],
      journeyPlace: "sea",
      keepsake: "shell",
      imageUrl: "assets/stories/sea-bench.png",
      baseLikes: 18,
      colors: ["#b9dfe9", "#efd6a6", "#d88b5b"],
      description:
        "На тихой скамейке у моря друзья учатся слушать волны и замечать маленькие радости.",
      slides: [
        "У самого моря стояла скамейка, тёплая от солнца и немного солёная от ветра. Ежонок сел на край, чтобы не занять слишком много места.",
        "Лисёнок сел рядом и положил между ними ракушку. Внутри ракушки тихо шумело море, будто рассказывало сонную сказку.",
        "«А вдруг море грустит?» — спросил Ежонок. Лисёнок покачал хвостом: «Может быть, оно просто говорит медленно».",
        "Они слушали волны, пока не поняли: каждая волна приносит что-то доброе — блеск, прохладу, песчинку или новый вопрос.",
        "Перед уходом друзья оставили на скамейке гладкий камушек. Пусть следующий, кто присядет, тоже найдёт маленькую радость."
      ]
    },
    {
      id: "hedgehog-bravery",
      title: "Как Ежонок искал смелость",
      age: "5–7",
      ageGroup: "5-7",
      time: "7 минут",
      tags: ["5-7", "bravery", "friendship"],
      journeyPlace: "forest",
      keepsake: "leaf",
      imageUrl: "assets/stories/hedgehog-bravery.png",
      baseLikes: 15,
      colors: ["#d9eac5", "#f4d39a", "#8fb779"],
      description:
        "Ежонок думает, что смелость где-то прячется, а Лисёнок помогает ему найти её внутри.",
      slides: [
        "Ежонок услышал в кустах шорох и спрятался за маленьким пнём. «Мне бы найти смелость», — вздохнул он. «Наверное, она живёт у кого-то другого».",
        "Лисёнок не засмеялся. Он сел рядом и сказал: «Давай искать вместе. Только начнём с одного маленького шага».",
        "Первый шаг был к травинке. Второй — к листику. Третий — к кусту, который шуршал всё громче и громче.",
        "Из куста выкатился орех. Он зацепился за сухую веточку и поэтому так страшно шептал. Ежонок осторожно освободил его.",
        "«Вот она», — улыбнулся Лисёнок. «Смелость не всегда громкая. Иногда она просто делает один добрый шаг»."
      ]
    },
    {
      id: "warm-wind-map",
      title: "Лисёнок и карта тёплого ветра",
      age: "8–10",
      ageGroup: "8-10",
      time: "8 минут",
      tags: ["8-10", "bravery", "friendship"],
      journeyPlace: "meadow",
      keepsake: "feather",
      imageUrl: "assets/stories/warm-wind-map.png",
      baseLikes: 9,
      colors: ["#f5c98d", "#cfeaf1", "#d76632"],
      description:
        "Лисёнок рисует карту ветра, чтобы помочь друзьям найти место, где всегда пахнет летом.",
      slides: [
        "Однажды Лисёнок решил нарисовать карту тёплого ветра. Он водил лапкой по песку и отмечал места, где воздух пах смолой, мятой и солнцем.",
        "Ежонок нёс за ним маленький карандаш и спрашивал: «А как узнать, куда ветер повернёт?» Лисёнок отвечал: «Надо слушать листья».",
        "Листья рассказывали не сразу. Одни молчали, другие путались, третьи кружились так весело, что карта становилась похожа на танец.",
        "Когда ветер унёс часть рисунка, Лисёнок расстроился. Но Ежонок заметил: оставшиеся линии ведут прямо к поляне с тёплыми камнями.",
        "Друзья поняли, что карта не обязана быть точной до последней песчинки. Иногда она просто помогает идти вместе и не бояться поворотов."
      ]
    },
    {
      id: "rustling-grass",
      title: "Тайна шуршащей травы",
      age: "8–10",
      ageGroup: "8-10",
      time: "7 минут",
      tags: ["8-10", "friendship"],
      journeyPlace: "meadow",
      keepsake: "leaf",
      imageUrl: "assets/stories/rustling-grass.png",
      baseLikes: 11,
      colors: ["#b8d79a", "#fff2bd", "#7ebccc"],
      description:
        "В высокой траве кто-то шепчет по вечерам, и друзья решают узнать, что это за тайна.",
      slides: [
        "Вечером высокая трава у лесной тропинки начинала шуршать, хотя ветер спал. Ежонок прислушался и услышал: «ш-ш-ш, тише, тише».",
        "Лисёнок взял фонарик из светлячков — просто попросил их лететь рядом. Свет был мягкий, зелёный и совсем не страшный.",
        "В траве друзья нашли маленькую тропу. Она вела к месту, где сухие колоски касались друг друга и разговаривали при каждом шаге.",
        "Но в самом центре травы сидел жук и старательно складывал соломинки. Он строил крышу для своей семьи перед ночной росой.",
        "Ежонок и Лисёнок помогли ему. С тех пор трава шуршала не тайно, а благодарно, будто говорила: «доброй ночи»."
      ]
    },
    {
      id: "star-for-friend",
      title: "Звезда для маленького друга",
      age: "8–10",
      ageGroup: "8-10",
      time: "6 минут",
      tags: ["8-10", "bedtime", "friendship"],
      journeyPlace: "starry-hill",
      keepsake: "star",
      imageUrl: "assets/stories/star-for-friend.png",
      baseLikes: 20,
      colors: ["#9dccd8", "#f4d39a", "#6f9a67"],
      description:
        "Друзья ищут подарок для самого маленького жителя леса и находят свет, который можно разделить.",
      slides: [
        "Ночью над лесом появилась первая звезда. Ежонок сказал: «Она такая маленькая, но светит для всех». Лисёнок задумался и улыбнулся.",
        "Утром они узнали, что мышонок боится темноты в своей норке. Тогда Лисёнок предложил подарить ему звезду.",
        "Конечно, достать звезду с неба было нельзя. Зато можно было собрать светлячков, лунный камушек и кусочек зеркальной росы.",
        "Ежонок поставил росинку у входа в норку, Лисёнок положил рядом светлый камушек, а светлячки устроились вокруг тихим кругом.",
        "Мышонок больше не боялся. А звезда сверху мигнула друзьям так, будто знала: настоящий свет становится больше, когда им делятся."
      ]
    }
  ];

  function cloneStory(story) {
    return JSON.parse(JSON.stringify(story));
  }

  function toAgeTag(ageValue) {
    const normalizedAge = String(ageValue || "5-7").replace("–", "-");
    return normalizedAge.includes("8-10") ? "8-10" : "5-7";
  }

  function getLessonTags(story) {
    const source = `${story.mood || ""} ${story.lesson || ""}`.toLowerCase();
    const tags = [];

    if (source.includes("сон") || source.includes("сном") || source.includes("ноч")) tags.push("bedtime");
    if (source.includes("друж") || source.includes("friend")) tags.push("friendship");
    if (source.includes("смел") || source.includes("bravery")) tags.push("bravery");

    return tags;
  }

  function inferJourneyPlace(story, tags) {
    if (story.journeyPlace && JOURNEY_PLACES[story.journeyPlace]) return story.journeyPlace;
    if (tags.includes("bedtime")) return "starry-hill";
    if (tags.includes("bravery")) return "forest";
    if (tags.includes("friendship")) return "meadow";
    return "cottage";
  }

  function inferKeepsake(story, journeyPlace) {
    if (["leaf", "shell", "star", "feather"].includes(story.keepsake)) return story.keepsake;
    return {
      forest: "leaf",
      meadow: "feather",
      cottage: "feather",
      sea: "shell",
      "starry-hill": "star"
    }[journeyPlace];
  }

  function normalizeStory(story, source) {
    const pages = Array.isArray(story.pages) ? story.pages : [];
    const slides = Array.isArray(story.slides)
      ? story.slides
      : pages.map((page) => page.text).filter(Boolean);
    const ageGroup = toAgeTag(story.ageGroup || story.age);
    const tags = Array.from(
      new Set([ageGroup, ...(Array.isArray(story.tags) ? story.tags : []), ...getLessonTags(story)])
    );
    const journeyPlace = inferJourneyPlace(story, tags);

    return {
      ...story,
      id: story.id || `user-story-${Date.now()}`,
      title: story.title || "Новая история",
      age: story.age || ageGroup.replace("-", "–"),
      ageGroup,
      time: story.time || `${Math.max(3, slides.length || 1)} минут`,
      tags,
      journeyPlace,
      journeyPlaceLabel: JOURNEY_PLACES[journeyPlace],
      keepsake: inferKeepsake(story, journeyPlace),
      imageUrl: story.imageUrl || "",
      baseLikes: Number.isFinite(story.baseLikes) ? story.baseLikes : 0,
      colors: Array.isArray(story.colors) && story.colors.length >= 3 ? story.colors : DEFAULT_COLORS,
      description: story.description || "Добрая история про Ежонка и Лисёнка.",
      slides,
      pages,
      useIllustrations: story.useIllustrations !== false,
      source
    };
  }

  function getBuiltInStories() {
    return builtInStories.map((story) => normalizeStory(cloneStory(story), "built-in"));
  }

  function getLocalUserStories() {
    const stories = window.HFStorageService.getJSON(USER_STORIES_KEY, []);
    if (!Array.isArray(stories)) return [];

    return stories.map((story) => normalizeStory({ ...story, storage: "local" }, "user"));
  }

  function saveLocalUserStory(story) {
    const storyToSave = normalizeStory(
      {
        ...story,
        id: story.id || `user-story-${Date.now()}`,
        storage: "local",
        baseLikes: Number.isFinite(story.baseLikes) ? story.baseLikes : 0,
        createdAt: story.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      "user"
    );
    const savedStories = getLocalUserStories().filter((item) => item.id !== storyToSave.id);

    window.HFStorageService.setJSON(USER_STORIES_KEY, [...savedStories, storyToSave]);
    return storyToSave;
  }

  function deleteLocalUserStory(storyId) {
    const nextStories = getLocalUserStories().filter((story) => story.id !== storyId);
    window.HFStorageService.setJSON(USER_STORIES_KEY, nextStories);
  }

  function getRemoteStoryMeta() {
    const meta = window.HFStorageService.getJSON(REMOTE_STORY_META_KEY, {});
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  }

  function saveRemoteStoryMeta(story) {
    const meta = getRemoteStoryMeta();
    meta[story.id] = {
      colors: story.colors,
      description: story.description,
      imageUrl: story.imageUrl,
      tags: story.tags,
      time: story.time,
      useIllustrations: story.useIllustrations
    };
    window.HFStorageService.setJSON(REMOTE_STORY_META_KEY, meta);
  }

  function deleteRemoteStoryMeta(storyId) {
    const meta = getRemoteStoryMeta();
    delete meta[storyId];
    window.HFStorageService.setJSON(REMOTE_STORY_META_KEY, meta);
  }

  function applyRemoteStoryMeta(story) {
    const meta = getRemoteStoryMeta()[story.id];
    return meta ? { ...story, ...meta } : story;
  }

  function canUseSupabaseStories() {
    return Boolean(supabaseService?.isEnabled?.() && supabaseService?.isAuthenticated?.());
  }

  async function initializeUserStories() {
    if (!canUseSupabaseStories()) {
      remoteUserStories = [];
      storageMode = "local";
      lastStorageError = "";
      return getUserStories();
    }

    try {
      const stories = await supabaseService.fetchUserStories();
      remoteUserStories = stories.map((story) =>
        normalizeStory({ ...applyRemoteStoryMeta(story), storage: "supabase" }, "user")
      );
      storageMode = "supabase";
      lastStorageError = "";
    } catch (error) {
      console.warn("[storyService] Supabase stories unavailable, using localStorage", error);
      remoteUserStories = [];
      storageMode = "local_fallback";
      lastStorageError = error.message || "Supabase недоступен";
    }

    return getUserStories();
  }

  function getUserStories() {
    if (storageMode === "supabase") {
      return remoteUserStories.map((story) => normalizeStory(cloneStory(story), "user"));
    }

    return getLocalUserStories();
  }

  function getAllStories() {
    return [...getBuiltInStories(), ...getUserStories()];
  }

  function getStoryById(storyId) {
    return getAllStories().find((story) => story.id === storyId) || null;
  }

  async function saveUserStory(story) {
    const storyToSave = normalizeStory(
      {
        ...story,
        id: story.id || `user-story-${Date.now()}`,
        baseLikes: Number.isFinite(story.baseLikes) ? story.baseLikes : 0,
        createdAt: story.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      "user"
    );

    if (canUseSupabaseStories()) {
      try {
        const savedStory = normalizeStory(
          {
            ...(await supabaseService.saveUserStory(storyToSave)),
            storage: "supabase"
          },
          "user"
        );

        remoteUserStories = [
          savedStory,
          ...remoteUserStories.filter((item) => item.id !== savedStory.id)
        ];
        saveRemoteStoryMeta(savedStory);
        storageMode = "supabase";
        lastStorageError = "";
        return savedStory;
      } catch (error) {
        console.warn("[storyService] Cannot save to Supabase, using localStorage fallback", error);
        storageMode = "local_fallback";
        lastStorageError = error.message || "Supabase недоступен";
      }
    }

    return saveLocalUserStory(storyToSave);
  }

  async function deleteUserStory(storyId) {
    if (storageMode === "supabase" && canUseSupabaseStories()) {
      try {
        await supabaseService.deleteUserStory(storyId);
        remoteUserStories = remoteUserStories.filter((story) => story.id !== storyId);
        deleteRemoteStoryMeta(storyId);
        lastStorageError = "";
        return;
      } catch (error) {
        console.warn("[storyService] Cannot delete from Supabase", error);
        lastStorageError = error.message || "Не удалось удалить историю из Supabase";
        throw error;
      }
    }

    deleteLocalUserStory(storyId);
  }

  function getUserStoriesStorageState() {
    return {
      mode: storageMode,
      isRemote: storageMode === "supabase",
      isFallback: storageMode === "local_fallback",
      lastError: lastStorageError
    };
  }

  function getSlideImageUrl(storyId, slideIndex) {
    return `assets/slides-web/${storyId}-${slideIndex + 1}.jpg`;
  }

  function getSlideFallbackImageUrl(storyId, slideIndex) {
    return `assets/slides/${storyId}-${slideIndex + 1}.png`;
  }

  function getSceneIllustrationStoryId(sceneTag) {
    return sceneIllustrationSets[sceneTag] || sceneIllustrationSets[DEFAULT_SCENE_TAG];
  }

  function getSceneIllustrationUrls(sceneTag, pageNumber) {
    const storyId = getSceneIllustrationStoryId(sceneTag);
    const slideIndex = Math.max(0, (Number(pageNumber) || 1) - 1) % 5;

    return {
      imageUrl: getSlideImageUrl(storyId, slideIndex),
      fallbackImageUrl: getSlideFallbackImageUrl(storyId, slideIndex)
    };
  }

  function prepareStoryForReader(story) {
    const normalizedStory = normalizeStory(story, story.source || "built-in");
    const isBuiltInStory = normalizedStory.source === "built-in";

    return {
      ...normalizedStory,
      readerPages: normalizedStory.slides.map((text, index) => {
        const page = normalizedStory.pages[index] || {};
        const sceneTag = page.sceneTag || normalizedStory.sceneTag || DEFAULT_SCENE_TAG;
        const pageImageUrl = page.imageUrl || (isBuiltInStory ? getSlideImageUrl(normalizedStory.id, index) : "");

        return {
          pageNumber: index + 1,
          text,
          sceneTag,
          imagePrompt: page.imagePrompt || "",
          imageUrl: pageImageUrl,
          illustrationUnavailable: Boolean(page.illustrationUnavailable),
          fallbackImageUrl: isBuiltInStory
            ? getSlideFallbackImageUrl(normalizedStory.id, index)
            : "",
          useSceneIllustration: !pageImageUrl && !page.illustrationUnavailable && !isBuiltInStory
        };
      })
    };
  }

  window.HFStoryService = {
    getBuiltInStories,
    getUserStories,
    getAllStories,
    getStoryById,
    initializeUserStories,
    saveUserStory,
    deleteUserStory,
    getUserStoriesStorageState,
    getSceneIllustrationUrls,
    prepareStoryForReader
  };
})(window);
