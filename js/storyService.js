(function (window) {
  "use strict";

  const USER_STORIES_KEY = "hedgehogFoxUserStories";
  const DEFAULT_COLORS = ["#cfeaf1", "#f8e9be", "#9fca84"];
  const DEFAULT_IMAGE = "assets/stories/lost-cloud.png";

  const builtInStories = [
    {
      id: "lost-cloud",
      title: "Облако, которое заблудилось",
      age: "5–7",
      ageGroup: "5-7",
      time: "5 минут",
      tags: ["5-7", "bedtime", "friendship"],
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

    if (source.includes("сон")) tags.push("bedtime");
    if (source.includes("друж") || source.includes("friend")) tags.push("friendship");
    if (source.includes("смел") || source.includes("bravery")) tags.push("bravery");

    return tags;
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

    return {
      ...story,
      id: story.id || `user-story-${Date.now()}`,
      title: story.title || "Новая история",
      age: story.age || ageGroup.replace("-", "–"),
      ageGroup,
      time: story.time || `${Math.max(3, slides.length || 1)} минут`,
      tags,
      imageUrl: story.imageUrl || DEFAULT_IMAGE,
      baseLikes: Number.isFinite(story.baseLikes) ? story.baseLikes : 0,
      colors: Array.isArray(story.colors) && story.colors.length >= 3 ? story.colors : DEFAULT_COLORS,
      description: story.description || "Добрая история про Ежонка и Лисёнка.",
      slides,
      pages,
      source
    };
  }

  function getBuiltInStories() {
    return builtInStories.map((story) => normalizeStory(cloneStory(story), "built-in"));
  }

  function getUserStories() {
    const stories = window.HFStorageService.getJSON(USER_STORIES_KEY, []);
    if (!Array.isArray(stories)) return [];

    return stories.map((story) => normalizeStory(story, "user"));
  }

  function getAllStories() {
    return [...getBuiltInStories(), ...getUserStories()];
  }

  function getStoryById(storyId) {
    return getAllStories().find((story) => story.id === storyId) || null;
  }

  function saveUserStory(story) {
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
    const savedStories = getUserStories().filter((item) => item.id !== storyToSave.id);

    window.HFStorageService.setJSON(USER_STORIES_KEY, [...savedStories, storyToSave]);
    return storyToSave;
  }

  function deleteUserStory(storyId) {
    const nextStories = getUserStories().filter((story) => story.id !== storyId);
    window.HFStorageService.setJSON(USER_STORIES_KEY, nextStories);
  }

  function getSlideImageUrl(storyId, slideIndex) {
    return `assets/slides-web/${storyId}-${slideIndex + 1}.jpg`;
  }

  function getSlideFallbackImageUrl(storyId, slideIndex) {
    return `assets/slides/${storyId}-${slideIndex + 1}.png`;
  }

  function prepareStoryForReader(story) {
    const normalizedStory = normalizeStory(story, story.source || "built-in");

    return {
      ...normalizedStory,
      readerPages: normalizedStory.slides.map((text, index) => ({
        pageNumber: index + 1,
        text,
        imageUrl: getSlideImageUrl(normalizedStory.id, index),
        fallbackImageUrl: getSlideFallbackImageUrl(normalizedStory.id, index)
      }))
    };
  }

  window.HFStoryService = {
    getBuiltInStories,
    getUserStories,
    getAllStories,
    getStoryById,
    saveUserStory,
    deleteUserStory,
    prepareStoryForReader
  };
})(window);
