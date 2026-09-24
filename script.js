/* =========================================================
   BOLU UBI 🐣
   ---------------------------------------------------------
   script.js
   Personal Birthday / Confession Experience
   ---------------------------------------------------------
   Tongzi × Tata
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     01. CONFIGURATION
     ======================================================= */

  const CONFIG = {
    scenes: 10,

    /* -----------------------------------------------------
       Asset paths
       ----------------------------------------------------- */

    audio: {
      music1: [
        "music1.mp3",
        "./music1.mp3",
        "assets/music1.mp3",
        "./assets/music1.mp3"
      ],

      music2: [
        "music2.mp3",
        "./music2.mp3",
        "assets/music2.mp3",
        "./assets/music2.mp3"
      ]
    },

    /* -----------------------------------------------------
       Audio behavior
       ----------------------------------------------------- */

    audioTiming: {
      music1FadeIn: 1400,
      music1FadeOut: 1600,

      music2FadeIn: 2200,

      betweenMusicSilence: 900,

      music1Volume: 0.48,
      music2Volume: 0.52,

      volumeStep: 0.035,
      volumeInterval: 45
    },

    /* -----------------------------------------------------
       Scene transition
       ----------------------------------------------------- */

    transition: {
      duration: 700,
      lockDuration: 780,
      revealDelay: 90
    },

    /* -----------------------------------------------------
       Typing
       ----------------------------------------------------- */

    typing: {
      normal: 27,
      fast: 18,
      slow: 39,

      punctuationPause: {
        comma: 90,
        period: 210,
        question: 220,
        exclamation: 230,
        colon: 130,
        semicolon: 120
      },

      paragraphPause: 420,

      cursorBlink: 530
    },

    /* -----------------------------------------------------
       Local storage
       ----------------------------------------------------- */

    storage: {
      entered: "bolu-ubi-entered",
      lastScene: "bolu-ubi-last-scene"
    },

    /* -----------------------------------------------------
       Reduced motion
       ----------------------------------------------------- */

    respectReducedMotion: true
  };


  /* =======================================================
     02. DOM HELPERS
     ======================================================= */

  const $ = (selector, root = document) => {
    if (!root) return null;

    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };


  const $$ = (selector, root = document) => {
    if (!root) return [];

    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };


  const firstExisting = (selectors, root = document) => {
    for (const selector of selectors) {
      const element = $(selector, root);

      if (element) {
        return element;
      }
    }

    return null;
  };


  const allExisting = (selectors, root = document) => {
    const result = [];

    for (const selector of selectors) {
      $$(selector, root).forEach((element) => {
        if (!result.includes(element)) {
          result.push(element);
        }
      });
    }

    return result;
  };


  /* =======================================================
     03. GENERAL UTILITIES
     ======================================================= */

  const wait = (milliseconds) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });


  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };


  const prefersReducedMotion = () => {
    if (!CONFIG.respectReducedMotion) {
      return false;
    }

    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };


  const safeLocalStorage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },

    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Ignore storage restrictions */
      }
    },

    remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* Ignore storage restrictions */
      }
    }
  };


  const dispatch = (name, detail = {}) => {
    document.dispatchEvent(
      new CustomEvent(name, {
        detail
      })
    );
  };


  /* =======================================================
     04. APP STATE
     ======================================================= */

  const state = {
    initialized: false,

    currentScene: 1,
    previousScene: null,

    isTransitioning: false,

    userHasInteracted: false,

    music1Started: false,
    music2Started: false,

    music1Stopped: false,

    proposalOpened: false,
    proposalAnswered: false,

    activeTyping: null,

    sceneHistory: [],

    traitStates: new Set(),

    timelineStates: new Set(),

    memoryOpened: false,

    reducedMotion: prefersReducedMotion()
  };


  /* =======================================================
     05. SCENE DISCOVERY
     ======================================================= */

  const getScenes = () => {
    const selectors = [
      ".scene",
      "[data-scene]",
      ".page-scene",
      ".story-scene",
      "[id^='scene']"
    ];

    const found = allExisting(selectors);

    const unique = [];

    found.forEach((element) => {
      if (!unique.includes(element)) {
        unique.push(element);
      }
    });

    return unique;
  };


  const getSceneNumber = (element) => {
    if (!element) {
      return null;
    }

    const explicit =
      element.dataset?.scene ||
      element.getAttribute("data-scene-number") ||
      element.getAttribute("data-index");

    if (explicit && !Number.isNaN(Number(explicit))) {
      return Number(explicit);
    }

    const id = element.id || "";

    const idMatch = id.match(/scene[-_]?(\d+)/i);

    if (idMatch) {
      return Number(idMatch[1]);
    }

    const classMatch = Array.from(element.classList || [])
      .map((name) => name.match(/scene[-_]?(\d+)/i))
      .find(Boolean);

    if (classMatch) {
      return Number(classMatch[1]);
    }

    return null;
  };


  const getScene = (number) => {
    const scenes = getScenes();

    return (
      scenes.find(
        (scene) => getSceneNumber(scene) === Number(number)
      ) || null
    );
  };


  const getOrderedScenes = () => {
    return getScenes()
      .map((scene, originalIndex) => ({
        scene,
        number: getSceneNumber(scene) ?? originalIndex + 1,
        originalIndex
      }))
      .sort((a, b) => a.number - b.number)
      .map((item) => item.scene);
  };


  /* =======================================================
     06. SCENE NORMALIZATION
     ======================================================= */

  const normalizeSceneMarkup = () => {
    const scenes = getOrderedScenes();

    scenes.forEach((scene, index) => {
      const number = getSceneNumber(scene) ?? index + 1;

      scene.dataset.scene = String(number);

      scene.classList.add("scene");

      scene.setAttribute(
        "aria-hidden",
        number === state.currentScene ? "false" : "true"
      );

      if (number === state.currentScene) {
        scene.classList.add("is-active", "active");
      } else {
        scene.classList.remove("is-active", "active");
      }
    });
  };


  /* =======================================================
     07. SCENE MANAGER
     ======================================================= */

  const SceneManager = {
    async goTo(target, options = {}) {
      const destination = Number(target);

      if (!Number.isFinite(destination)) {
        return false;
      }

      const scenes = getOrderedScenes();

      if (!scenes.length) {
        return false;
      }

      const targetScene = getScene(destination);

      if (!targetScene) {
        return false;
      }

      if (
        destination === state.currentScene &&
        !options.force
      ) {
        return false;
      }

      if (state.isTransitioning) {
        return false;
      }

      const previous = state.currentScene;

      state.isTransitioning = true;
      state.previousScene = previous;

      if (previous) {
        state.sceneHistory.push(previous);
      }

      if (state.sceneHistory.length > 30) {
        state.sceneHistory.shift();
      }

      /*
       * Stop typing when leaving a scene.
       */
      TypingEngine.cancel();

      /*
       * Special scene logic.
       */
      await SceneManager.beforeEnter(destination, previous);

      const previousScene = getScene(previous);

      /*
       * Mark outgoing scene.
       */
      if (previousScene) {
        previousScene.classList.add("is-leaving");
        previousScene.classList.remove("is-active", "active");

        previousScene.setAttribute("aria-hidden", "true");
      }

      /*
       * Let CSS transition breathe.
       */
      if (!state.reducedMotion) {
        await wait(80);
      }

      /*
       * Activate target.
       */
      state.currentScene = destination;

      targetScene.classList.remove("is-leaving");
      targetScene.classList.add("is-active", "active");

      targetScene.setAttribute("aria-hidden", "false");

      /*
       * Accessibility focus.
       */
      SceneManager.focusScene(targetScene);

      /*
       * Reset internal scroll.
       */
      SceneManager.resetSceneScroll(targetScene);

      /*
       * Give CSS time to reveal.
       */
      if (!state.reducedMotion) {
        await wait(CONFIG.transition.revealDelay);
      }

      /*
       * Scene-specific entry choreography.
       */
      await SceneManager.afterEnter(destination, previous);

      safeLocalStorage.set(
        CONFIG.storage.lastScene,
        String(destination)
      );

      dispatch("bolu:scenechange", {
        current: destination,
        previous
      });

      state.isTransitioning = false;

      return true;
    },


    async next() {
      const scenes = getOrderedScenes();

      const currentIndex = scenes.findIndex(
        (scene) =>
          getSceneNumber(scene) === state.currentScene
      );

      if (currentIndex === -1) {
        return false;
      }

      const nextScene = scenes[currentIndex + 1];

      if (!nextScene) {
        return false;
      }

      const nextNumber = getSceneNumber(nextScene);

      return SceneManager.goTo(nextNumber);
    },


    async previous() {
      const scenes = getOrderedScenes();

      const currentIndex = scenes.findIndex(
        (scene) =>
          getSceneNumber(scene) === state.currentScene
      );

      if (currentIndex <= 0) {
        return false;
      }

      const previousScene = scenes[currentIndex - 1];

      if (!previousScene) {
        return false;
      }

      const previousNumber =
        getSceneNumber(previousScene);

      return SceneManager.goTo(previousNumber);
    },


    resetSceneScroll(scene) {
      if (!scene) return;

      /*
       * Only reset actual scrollable containers.
       * This prevents the whole page from becoming a
       * navigation mechanism.
       */
      const scrollTargets = [
        scene,
        $(".scene__inner", scene),
        $(".scene-inner", scene),
        $(".scene-content", scene),
        $(".scene__content", scene)
      ].filter(Boolean);

      scrollTargets.forEach((target) => {
        try {
          target.scrollTop = 0;
          target.scrollLeft = 0;
        } catch {
          /* Ignore */
        }
      });
    },


    focusScene(scene) {
      if (!scene) return;

      /*
       * Do not steal focus from an input/button if the
       * browser is already interacting with it.
       */
      const active = document.activeElement;

      if (
        active &&
        (
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "BUTTON"
        )
      ) {
        return;
      }

      if (!scene.hasAttribute("tabindex")) {
        scene.setAttribute("tabindex", "-1");
      }

      /*
       * Focus without causing browser scroll jump.
       */
      try {
        scene.focus({
          preventScroll: true
        });
      } catch {
        try {
          scene.focus();
        } catch {
          /* Ignore */
        }
      }
    },


    async beforeEnter(destination, previous) {
      /*
       * Entering Scene 10 is the exact threshold where
       * music1 must die completely before music2 starts.
       */
      if (
        destination === 10 &&
        previous !== 10
      ) {
        await AudioEngine.enterClimax();
      }


      /*
       * If somehow returning from Scene 10 to an earlier
       * scene, keep music2 from playing underneath music1.
       */
      if (
        destination < 10 &&
        previous === 10
      ) {
        await AudioEngine.leaveClimax();
      }
    },


    async afterEnter(destination, previous) {
      switch (destination) {
        case 1:
          SceneChoreography.scene1(previous);
          break;

        case 2:
          SceneChoreography.scene2(previous);
          break;

        case 3:
          SceneChoreography.scene3(previous);
          break;

        case 4:
          SceneChoreography.scene4(previous);
          break;

        case 5:
          SceneChoreography.scene5(previous);
          break;

        case 6:
          SceneChoreography.scene6(previous);
          break;

        case 7:
          SceneChoreography.scene7(previous);
          break;

        case 8:
          SceneChoreography.scene8(previous);
          break;

        case 9:
          SceneChoreography.scene9(previous);
          break;

        case 10:
          SceneChoreography.scene10(previous);
          break;

        default:
          break;
      }
    }
  };


  /* =======================================================
     08. AUDIO ENGINE
     ======================================================= */

  const AudioEngine = {
    music1: null,
    music2: null,

    music1Source: null,
    music2Source: null,

    fadeTimer1: null,
    fadeTimer2: null,

    initialized: false,

    async init() {
      if (this.initialized) {
        return;
      }

      this.music1 = document.createElement("audio");
      this.music2 = document.createElement("audio");

      this.music1.preload = "auto";
      this.music2.preload = "auto";

      this.music1.loop = true;
      this.music2.loop = true;

      this.music1.setAttribute("playsinline", "");
      this.music2.setAttribute("playsinline", "");

      this.music1.volume = 0;
      this.music2.volume = 0;

      /*
       * Try to find existing audio elements first.
       * This means the HTML can still explicitly provide
       * <audio> elements if desired.
       */
      const existingMusic1 = firstExisting([
        "#music1",
        "#audio1",
        "[data-audio='music1']",
        "[data-music='1']"
      ]);

      const existingMusic2 = firstExisting([
        "#music2",
        "#audio2",
        "[data-audio='music2']",
        "[data-music='2']"
      ]);

      if (existingMusic1 instanceof HTMLAudioElement) {
        this.music1 = existingMusic1;

        this.music1.loop = true;
        this.music1.preload = "auto";
        this.music1.volume = 0;
      }

      if (existingMusic2 instanceof HTMLAudioElement) {
        this.music2 = existingMusic2;

        this.music2.loop = true;
        this.music2.preload = "auto";
        this.music2.volume = 0;
      }

      /*
       * Resolve source files.
       */
      this.music1Source = await this.resolveAudioSource(
        CONFIG.audio.music1
      );

      this.music2Source = await this.resolveAudioSource(
        CONFIG.audio.music2
      );

      if (
        this.music1Source &&
        !this.music1.src
      ) {
        this.music1.src = this.music1Source;
      }

      if (
        this.music2Source &&
        !this.music2.src
      ) {
        this.music2.src = this.music2Source;
      }

      /*
       * Keep music2 silent until Scene 10.
       */
      this.music2.volume = 0;

      this.initialized = true;
    },


    async resolveAudioSource(candidates) {
      /*
       * If an audio file is already declared in HTML,
       * use that source.
       */
      if (!Array.isArray(candidates)) {
        return null;
      }

      for (const candidate of candidates) {
        try {
          const response = await fetch(
            candidate,
            {
              method: "HEAD",
              cache: "no-store"
            }
          );

          if (response.ok) {
            return candidate;
          }
        } catch {
          /*
           * Some static hosts block HEAD.
           * Continue trying.
           */
        }
      }

      /*
       * Fallback to the first path.
       * Browser will handle actual load failure.
       */
      return candidates[0] || null;
    },


    async startMusic1() {
      await this.init();

      if (state.music1Started) {
        return;
      }

      /*
       * User interaction should have happened before this.
       */
      try {
        this.music1.currentTime = 0;
      } catch {
        /* Ignore */
      }

      this.music1.volume = 0;

      try {
        await this.music1.play();
      } catch (error) {
        console.warn(
          "[Bolu Ubi] music1 could not start:",
          error
        );

        this.showAudioFallback("music1");
        return false;
      }

      state.music1Started = true;
      state.music1Stopped = false;

      await this.fadeTo(
        this.music1,
        CONFIG.audioTiming.music1Volume,
        CONFIG.audioTiming.music1FadeIn,
        0
      );

      dispatch("bolu:musicstart", {
        track: "music1"
      });

      return true;
    },


    async fadeOutMusic1() {
      await this.fadeTo(
        this.music1,
        0,
        CONFIG.audioTiming.music1FadeOut,
        this.music1.volume
      );
    },


    hardStopMusic1() {
      if (!this.music1) {
        return;
      }

      this.clearFade("music1");

      try {
        this.music1.pause();
      } catch {
        /* Ignore */
      }

      try {
        this.music1.currentTime = 0;
      } catch {
        /* Ignore */
      }

      this.music1.volume = 0;

      state.music1Stopped = true;
    },


    async startMusic2() {
      await this.init();

      /*
       * Safety:
       * music1 must not be playing.
       */
      if (!this.music1.paused) {
        this.hardStopMusic1();
      }

      this.music2.volume = 0;

      try {
        this.music2.currentTime = 0;
      } catch {
        /* Ignore */
      }

      try {
        await this.music2.play();
      } catch (error) {
        console.warn(
          "[Bolu Ubi] music2 could not start:",
          error
        );

        this.showAudioFallback("music2");
        return false;
      }

      state.music2Started = true;

      await this.fadeTo(
        this.music2,
        CONFIG.audioTiming.music2Volume,
        CONFIG.audioTiming.music2FadeIn,
        0
      );

      dispatch("bolu:musicstart", {
        track: "music2"
      });

      return true;
    },


    async enterClimax() {
      await this.init();

      /*
       * If music1 exists and is playing:
       *
       * fade out
       * ↓
       * hard stop
       * ↓
       * silence
       * ↓
       * music2
       */
      if (
        this.music1 &&
        !this.music1.paused
      ) {
        await this.fadeOutMusic1();
      }

      /*
       * This is deliberately a hard stop.
       * We do NOT leave music1 playing at volume 0.
       */
      this.hardStopMusic1();

      await wait(
        state.reducedMotion
          ? 250
          : CONFIG.audioTiming.betweenMusicSilence
      );

      await this.startMusic2();

      state.music2Started = true;
    },


    async leaveClimax() {
      if (!this.music2) {
        return;
      }

      this.clearFade("music2");

      try {
        this.music2.pause();
      } catch {
        /* Ignore */
      }

      try {
        this.music2.currentTime = 0;
      } catch {
        /* Ignore */
      }

      this.music2.volume = 0;

      state.music2Started = false;

      /*
       * If user intentionally travels backward,
       * restore music1 only after a deliberate transition.
       */
      await wait(
        state.reducedMotion ? 0 : 250
      );

      if (state.userHasInteracted) {
        await this.startMusic1();
      }
    },


    async fadeTo(audio, target, duration, startVolume) {
      if (!audio) {
        return;
      }

      if (this.music1 === audio) {
        this.clearFade("music1");
      }

      if (this.music2 === audio) {
        this.clearFade("music2");
      }

      if (state.reducedMotion) {
        audio.volume = clamp(target, 0, 1);
        return;
      }

      const initial =
        typeof startVolume === "number"
          ? startVolume
          : audio.volume;

      const difference = target - initial;

      if (Math.abs(difference) < 0.005) {
        audio.volume = target;
        return;
      }

      const startTime = performance.now();

      await new Promise((resolve) => {
        const tick = (now) => {
          const elapsed = now - startTime;
          const progress = clamp(
            elapsed / duration,
            0,
            1
          );

          /*
           * Smoothstep.
           */
          const eased =
            progress * progress *
            (3 - 2 * progress);

          audio.volume = clamp(
            initial + difference * eased,
            0,
            1
          );

          if (progress < 1) {
            const timer = window.setTimeout(
              () => tick(performance.now()),
              CONFIG.audioTiming.volumeInterval
            );

            if (this.music1 === audio) {
              this.fadeTimer1 = timer;
            }

            if (this.music2 === audio) {
              this.fadeTimer2 = timer;
            }
          } else {
            audio.volume = clamp(target, 0, 1);
            resolve();
          }
        };

        tick(performance.now());
      });
    },


    clearFade(track) {
      if (track === "music1" && this.fadeTimer1) {
        window.clearTimeout(this.fadeTimer1);
        this.fadeTimer1 = null;
      }

      if (track === "music2" && this.fadeTimer2) {
        window.clearTimeout(this.fadeTimer2);
        this.fadeTimer2 = null;
      }
    },


    showAudioFallback(track) {
      const candidates = [
        `[data-audio-fallback='${track}']`,
        `.audio-fallback--${track}`,
        `#audio-fallback-${track}`
      ];

      const element = firstExisting(candidates);

      if (element) {
        element.hidden = false;
        element.classList.add("is-visible");
      }
    }
  };


  /* =======================================================
     09. TYPING ENGINE
     ======================================================= */

  const TypingEngine = {
    token: 0,

    cancel() {
      this.token += 1;

      if (state.activeTyping) {
        state.activeTyping.cancelled = true;
        state.activeTyping = null;
      }

      /*
       * Remove any temporary cursor if present.
       */
      $$(".typing-cursor").forEach((cursor) => {
        cursor.remove();
      });
    },


    async type(element, text, options = {}) {
      if (!element) {
        return;
      }

      this.cancel();

      const token = ++this.token;

      const settings = {
        speed:
          options.speed ??
          CONFIG.typing.normal,

        startDelay:
          options.startDelay ?? 0,

        cursor:
          options.cursor !== false,

        preserveHTML:
          options.preserveHTML ?? false,

        onProgress:
          options.onProgress ?? null,

        onComplete:
          options.onComplete ?? null,

        autoScroll:
          options.autoScroll ?? true
      };

      const session = {
        cancelled: false
      };

      state.activeTyping = session;

      element.classList.add("is-typing");

      if (!settings.preserveHTML) {
        element.textContent = "";
      }

      await wait(settings.startDelay);

      if (
        session.cancelled ||
        token !== this.token
      ) {
        return;
      }

      /*
       * Cursor.
       */
      let cursor = null;

      if (settings.cursor) {
        cursor = document.createElement("span");

        cursor.className = "typing-cursor";
        cursor.setAttribute("aria-hidden", "true");
        cursor.textContent = "▋";

        element.appendChild(cursor);
      }

      const fragment = document.createDocumentFragment();

      /*
       * We type by code point rather than UTF-16 unit.
       * This prevents emoji from being split.
       */
      const characters = Array.from(text);

      let output = "";

      for (
        let index = 0;
        index < characters.length;
        index += 1
      ) {
        if (
          session.cancelled ||
          token !== this.token
        ) {
          return;
        }

        const character = characters[index];

        output += character;

        /*
         * Re-render only the text.
         */
        if (cursor) {
          element.textContent = output;
          element.appendChild(cursor);
        } else {
          element.textContent = output;
        }

        if (
          typeof settings.onProgress === "function"
        ) {
          settings.onProgress({
            index,
            total: characters.length,
            character,
            progress:
              (index + 1) / characters.length
          });
        }

        /*
         * Scroll the active scene gently as the letter
         * grows.
         */
        if (
          settings.autoScroll &&
          index % 7 === 0
        ) {
          this.keepTypingVisible(element);
        }

        const delay = this.calculateDelay(
          character,
          characters[index + 1],
          settings.speed
        );

        await wait(delay);
      }

      if (cursor) {
        cursor.classList.add("typing-cursor--idle");
      }

      element.classList.remove("is-typing");
      element.classList.add("typing-complete");

      state.activeTyping = null;

      if (
        typeof settings.onComplete === "function"
      ) {
        settings.onComplete();
      }
    },


    calculateDelay(character, nextCharacter, baseSpeed) {
      let delay = baseSpeed;

      if (character === " ") {
        delay *= 0.35;
      }

      if (
        character === "," ||
        character === "،"
      ) {
        delay += CONFIG.typing.punctuationPause.comma;
      }

      if (
        character === "." ||
        character === "…"
      ) {
        delay += CONFIG.typing.punctuationPause.period;
      }

      if (
        character === "?" ||
        character === "؟"
      ) {
        delay += CONFIG.typing.punctuationPause.question;
      }

      if (character === "!") {
        delay += CONFIG.typing.punctuationPause.exclamation;
      }

      if (
        character === ":" ||
        character === ";"
      ) {
        delay += CONFIG.typing.punctuationPause.colon;
      }

      /*
       * New paragraph.
       */
      if (
        character === "\n" &&
        nextCharacter === "\n"
      ) {
        delay += CONFIG.typing.paragraphPause;
      }

      /*
       * Emoji are visually meaningful.
       * Give them a tiny pause.
       */
      if (
        /\p{Extended_Pictographic}/u.test(character)
      ) {
        delay += 85;
      }

      /*
       * Don't allow ridiculous values.
       */
      return clamp(delay, 5, 900);
    },


    keepTypingVisible(element) {
      const rect = element.getBoundingClientRect();

      const viewportHeight =
        window.innerHeight ||
        document.documentElement.clientHeight;

      const lowerSafeZone =
        viewportHeight * 0.84;

      if (rect.bottom > lowerSafeZone) {
        const scrollTarget =
          element.closest(
            ".scene__inner, .scene-inner, .scene-content, .scene__content, .scene"
          );

        if (scrollTarget) {
          scrollTarget.scrollBy({
            top: Math.min(
              rect.bottom - lowerSafeZone + 40,
              150
            ),
            behavior:
              state.reducedMotion
                ? "auto"
                : "smooth"
          });
        }
      }
    },


    async typeLines(container, lines, options = {}) {
      if (!container) {
        return;
      }

      this.cancel();

      container.innerHTML = "";

      for (
        let index = 0;
        index < lines.length;
        index += 1
      ) {
        const line = document.createElement("span");

        line.className =
          options.lineClass ||
          "typing-line";

        container.appendChild(line);

        await this.type(
          line,
          lines[index],
          {
            speed:
              options.speed ??
              CONFIG.typing.normal,

            startDelay:
              index === 0
                ? options.startDelay ?? 0
                : options.lineDelay ?? 180,

            cursor:
              options.cursor !== false
          }
        );

        if (
          options.pauseBetween &&
          index < lines.length - 1
        ) {
          await wait(options.pauseBetween);
        }
      }
    }
  };


  /* =======================================================
     10. GENERIC REVEAL ENGINE
     ======================================================= */

  const RevealEngine = {
    reveal(container, options = {}) {
      if (!container) {
        return;
      }

      const children = options.children
        ? $$(options.children, container)
        : Array.from(container.children);

      children.forEach((child, index) => {
        child.classList.add("reveal-item");

        if (
          state.reducedMotion ||
          options.immediate
        ) {
          child.classList.add(
            "is-revealed",
            "revealed"
          );

          return;
        }

        window.setTimeout(
          () => {
            child.classList.add(
              "is-revealed",
              "revealed"
            );
          },
          (options.delay ?? 90) * index
        );
      });
    },


    scene(sceneNumber, selector = null) {
      const scene = getScene(sceneNumber);

      if (!scene) {
        return;
      }

      const target = selector
        ? $(selector, scene)
        : scene;

      if (!target) {
        return;
      }

      this.reveal(target);
    }
  };


  /* =======================================================
     11. BUTTON / NAVIGATION ENGINE
     ======================================================= */

  const Navigation = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      /*
       * Explicit navigation:
       *
       * data-next="2"
       * data-scene-next="2"
       * data-go="2"
       */
      document.addEventListener(
        "click",
        (event) => {
          const target =
            event.target.closest(
              "[data-next], [data-scene-next], [data-go], [data-prev], [data-back], [data-replay]"
            );

          if (!target) {
            return;
          }

          /*
           * Don't hijack links to actual URLs.
           */
          if (
            target.tagName === "A" &&
            target.getAttribute("href") &&
            target.getAttribute("href") !== "#"
          ) {
            return;
          }

          event.preventDefault();

          if (
            target.hasAttribute("data-next")
          ) {
            SceneManager.goTo(
              Number(target.dataset.next)
            );

            return;
          }

          if (
            target.hasAttribute("data-scene-next")
          ) {
            SceneManager.goTo(
              Number(target.dataset.sceneNext)
            );

            return;
          }

          if (
            target.hasAttribute("data-go")
          ) {
            SceneManager.goTo(
              Number(target.dataset.go)
            );

            return;
          }

          if (
            target.hasAttribute("data-prev") ||
            target.hasAttribute("data-back")
          ) {
            SceneManager.previous();

            return;
          }

          if (
            target.hasAttribute("data-replay")
          ) {
            SceneManager.goTo(1, {
              force: true
            });

            return;
          }
        },
        { passive: false }
      );


      /*
       * Generic semantic buttons.
       *
       * These are fallbacks for common HTML names.
       */
      document.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              ".next-btn, .next-button, .btn-next, .scene-next, .continue-btn, .continue-button"
            );

          if (!button) {
            return;
          }

          /*
           * If the button already has an explicit target,
           * the previous listener handles it.
           */
          if (
            button.hasAttribute("data-next") ||
            button.hasAttribute("data-scene-next") ||
            button.hasAttribute("data-go")
          ) {
            return;
          }

          event.preventDefault();

          SceneManager.next();
        },
        { passive: false }
      );


      /*
       * Back buttons.
       */
      document.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              ".prev-btn, .back-btn, .back-button, .scene-prev"
            );

          if (!button) {
            return;
          }

          event.preventDefault();

          SceneManager.previous();
        },
        { passive: false }
      );
    }
  };


  /* =======================================================
     12. ENTER / MUSIC TRIGGER
     ======================================================= */

  const EntranceController = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      const selectors = [
        "[data-enter]",
        "[data-start]",
        "[data-start-journey]",
        ".enter-btn",
        ".start-btn",
        ".start-button",
        ".tap-to-enter",
        ".hero-button"
      ];

      document.addEventListener(
        "click",
        async (event) => {
          const button =
            event.target.closest(
              selectors.join(",")
            );

          if (!button) {
            return;
          }

          event.preventDefault();

          state.userHasInteracted = true;

          button.classList.add("is-activated");

          /*
           * Critical browser requirement:
           * music starts directly from the user's gesture.
           */
          await AudioEngine.startMusic1();

          /*
           * Scene 1 -> Scene 2.
           */
          const target =
            Number(
              button.dataset?.next ||
              button.dataset?.sceneNext ||
              button.dataset?.go ||
              2
            );

          await SceneManager.goTo(
            Number.isFinite(target)
              ? target
              : 2
          );
        },
        { passive: false }
      );
    }
  };


  /* =======================================================
     13. SCENE CHOREOGRAPHY
     ======================================================= */

  const SceneChoreography = {
    scene1() {
      const scene = getScene(1);

      if (!scene) return;

      RevealEngine.reveal(scene, {
        children:
          ".scene__eyebrow, .eyebrow, .scene-title, .title, .scene-subtitle, .subtitle, button, .cta, .sticker"
      });

      /*
       * Do not autoplay here.
       */
    },


    scene2() {
      const scene = getScene(2);

      if (!scene) return;

      RevealEngine.reveal(scene, {
        children:
          ".scene__eyebrow, .eyebrow, .scene-title, .title, .scene-copy, .copy, .math-card, .equation, .sticker, button, .cta"
      });

      this.prepareMathReveal(scene);
    },


    prepareMathReveal(scene) {
      const equation =
        firstExisting(
          [
            "[data-equation]",
            ".equation",
            ".math-equation",
            ".formula",
            ".math-card"
          ],
          scene
        );

      if (!equation) {
        return;
      }

      /*
       * Don't alter the actual LaTeX.
       * Only reveal its wrapper.
       */
      equation.classList.add("equation-ready");
    },


    scene3() {
      const scene = getScene(3);

      if (!scene) return;

      RevealEngine.reveal(scene, {
        children:
          ".flashback-heading, .scene-title, .timeline, .timeline-item, .timeline-card, .memory-card, .sticker, button"
      });

      this.prepareTimeline(scene);
    },


    prepareTimeline(scene) {
      const items =
        allExisting(
          [
            ".timeline-item",
            ".timeline-card",
            "[data-timeline]",
            "[data-memory]"
          ],
          scene
        );

      items.forEach((item, index) => {
        item.dataset.timelineIndex = String(index);
      });
    },


    scene4() {
      const scene = getScene(4);

      if (!scene) return;

      RevealEngine.reveal(scene, {
        children:
          ".scene-title, .trait-card, .trait, .fact-card, .sticker, button"
      });

      InteractionEngine.prepareTraits(scene);
    },


    scene5() {
      const scene = getScene(5);

      if (!scene) return;

      RevealEngine.reveal(scene, {
        children:
          ".scene-title, .memory-card, .sidequest-card, .hydroponics-card, .sticker, button"
      });

      InteractionEngine.prepareHydroponics(scene);
    },


    scene6() {
      const scene = getScene(6);

      if (!scene) return;

      /*
       * Photo is intentionally revealed slower.
       */
      const photo =
        firstExisting(
          [
            "[data-photo]",
            ".photo-frame",
            ".portrait-frame",
            ".photo-card",
            ".hero-photo"
          ],
          scene
        );

      if (photo) {
        if (state.reducedMotion) {
          photo.classList.add(
            "is-revealed",
            "revealed"
          );
        } else {
          window.setTimeout(() => {
            photo.classList.add(
              "is-revealed",
              "revealed"
            );
          }, 350);
        }
      }

      const photoImage =
        $("img", photo);

      if (photoImage) {
        photoImage.addEventListener(
          "load",
          () => {
            photo.classList.add(
              "image-loaded"
            );
          },
          { once: true }
        );
      }

      const text =
        firstExisting(
          [
            "[data-photo-caption]",
            ".photo-caption",
            ".photo-copy"
          ],
          scene
        );

      if (text) {
        window.setTimeout(
          () => {
            text.classList.add(
              "is-revealed",
              "revealed"
            );
          },
          state.reducedMotion ? 0 : 800
        );
      }
    },


    scene7() {
      const scene = getScene(7);

      if (!scene) return;

      /*
       * Scene 7 intentionally reduces visual energy.
       */
      scene.classList.add("quiet-transition");

      RevealEngine.reveal(scene, {
        children:
          ".scene-title, .scene-copy, .transition-copy, .sticker, button",
        delay: 170
      });
    },


    scene8() {
      const scene = getScene(8);

      if (!scene) return;

      scene.classList.add("letter-mode");

      /*
       * Ensure music1 exists.
       * It should already be playing from Scene 1.
       */
      if (
        state.userHasInteracted &&
        !state.music1Started &&
        !state.music1Stopped
      ) {
        AudioEngine.startMusic1();
      }

      this.runLetterIntro(scene);
      this.prepareLetter(scene);
    },


    runLetterIntro(scene) {
      const intro =
        firstExisting(
          [
            "[data-letter-intro]",
            ".letter-intro",
            ".scene8-intro",
            ".typing-intro"
          ],
          scene
        );

      if (!intro) {
        return;
      }

      intro.classList.remove(
        "is-revealed",
        "revealed"
      );

      window.setTimeout(
        () => {
          intro.classList.add(
            "is-revealed",
            "revealed"
          );
        },
        state.reducedMotion ? 0 : 450
      );
    },


    prepareLetter(scene) {
      /*
       * We deliberately don't auto-type every text element.
       *
       * HTML can designate the intended typing target:
       *
       * data-typing="letter"
       *
       * This avoids accidentally typing headings/buttons.
       */
      const target =
        firstExisting(
          [
            "[data-typing='letter']",
            "[data-letter-text]",
            ".letter-text",
            ".typing-text",
            "#letterText"
          ],
          scene
        );

      if (!target) {
        return;
      }

      /*
       * Preserve existing HTML/text.
       */
      const source =
        target.dataset.typingContent ||
        target.textContent ||
        "";

      if (
        !target.dataset.typingPrepared
      ) {
        target.dataset.typingPrepared = "true";
        target.dataset.typingSource = source.trim();
      }
    },


    scene9() {
      const scene = getScene(9);

      if (!scene) return;

      scene.classList.add("breathing-room");

      /*
       * Music1 is intentionally NOT changed here.
       *
       * Scene 9 is the breath.
       * Music1 remains the emotional floor until Scene 10.
       */
      const elements =
        allExisting(
          [
            "[data-scene9-reveal]",
            ".scene9-reveal",
            ".quiet-copy",
            ".reassurance",
            ".one-last-thing"
          ],
          scene
        );

      elements.forEach((element, index) => {
        window.setTimeout(
          () => {
            element.classList.add(
              "is-revealed",
              "revealed"
            );
          },
          state.reducedMotion
            ? 0
            : 500 + index * 450
        );
      });
    },


    scene10() {
      const scene = getScene(10);

      if (!scene) return;

      scene.classList.add("climax-mode");

      /*
       * Music2 has already been started by beforeEnter().
       */

      const elements =
        allExisting(
          [
            ".proposal-prelude",
            "[data-proposal-prelude]",
            ".proposal-card",
            ".proposal-question",
            ".proposal-copy",
            ".proposal-actions",
            ".sticker",
            ".proposal-signature"
          ],
          scene
        );

      elements.forEach((element, index) => {
        window.setTimeout(
          () => {
            element.classList.add(
              "is-revealed",
              "revealed"
            );
          },
          state.reducedMotion
            ? 0
            : 450 + index * 420
        );
      });

      InteractionEngine.prepareProposal(scene);
    }
  };


  /* =======================================================
     14. INTERACTION ENGINE
     ======================================================= */

  const InteractionEngine = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      this.initTraitInteractions();
      this.initTimelineInteractions();
      this.initHydroponicsInteractions();
      this.initLetterInteraction();
      this.initProposalInteractions();
      this.initReplayInteractions();
    },


    /* -----------------------------------------------------
       TRAITS
       ----------------------------------------------------- */

    initTraitInteractions() {
      document.addEventListener(
        "click",
        (event) => {
          const trigger =
            event.target.closest(
              "[data-trait], .trait-plus, .trait-button, .trait-toggle"
            );

          if (!trigger) {
            return;
          }

          const scene =
            trigger.closest(".scene");

          if (
            !scene ||
            getSceneNumber(scene) !== 4
          ) {
            return;
          }

          event.preventDefault();

          this.toggleRevealTarget(
            trigger,
            scene
          );
        }
      );
    },


    prepareTraits(scene) {
      const traits =
        allExisting(
          [
            "[data-trait]",
            ".trait-card",
            ".trait"
          ],
          scene
        );

      traits.forEach((trait, index) => {
        trait.dataset.traitIndex =
          String(index);
      });
    },


    /* -----------------------------------------------------
       TIMELINE
       ----------------------------------------------------- */

    initTimelineInteractions() {
      document.addEventListener(
        "click",
        (event) => {
          const trigger =
            event.target.closest(
              "[data-timeline], [data-memory], .timeline-item, .timeline-card, .memory-toggle"
            );

          if (!trigger) {
            return;
          }

          const scene =
            trigger.closest(".scene");

          if (
            !scene ||
            getSceneNumber(scene) !== 3
          ) {
            return;
          }

          /*
           * If the item contains a real link/button,
           * let that interaction remain possible.
           */
          if (
            event.target.closest("a[href]")
          ) {
            return;
          }

          event.preventDefault();

          this.toggleRevealTarget(
            trigger,
            scene
          );
        }
      );
    },


    /* -----------------------------------------------------
       HYDROPONICS
       ----------------------------------------------------- */

    initHydroponicsInteractions() {
      document.addEventListener(
        "click",
        (event) => {
          const trigger =
            event.target.closest(
              "[data-hydroponics], [data-sidequest], .hydroponics-card, .sidequest-card, .sidequest-button"
            );

          if (!trigger) {
            return;
          }

          const scene =
            trigger.closest(".scene");

          if (
            !scene ||
            getSceneNumber(scene) !== 5
          ) {
            return;
          }

          event.preventDefault();

          this.toggleRevealTarget(
            trigger,
            scene
          );

          state.memoryOpened = true;

          scene.classList.add(
            "sidequest-open"
          );

          dispatch(
            "bolu:sidequestopen"
          );
        }
      );
    },


    prepareHydroponics(scene) {
      const cards =
        allExisting(
          [
            "[data-hydroponics]",
            "[data-sidequest]",
            ".hydroponics-card",
            ".sidequest-card"
          ],
          scene
        );

      cards.forEach((card) => {
        card.classList.add(
          "interaction-ready"
        );
      });
    },


    /* -----------------------------------------------------
       LETTER
       ----------------------------------------------------- */

    initLetterInteraction() {
      document.addEventListener(
        "click",
        async (event) => {
          const trigger =
            event.target.closest(
              "[data-start-typing], .start-letter, .letter-start, .read-letter"
            );

          if (!trigger) {
            return;
          }

          const scene =
            trigger.closest(".scene");

          if (
            !scene ||
            getSceneNumber(scene) !== 8
          ) {
            return;
          }

          event.preventDefault();

          await this.startLetterTyping(scene);

          trigger.classList.add(
            "is-complete"
          );
        }
      );
    },


    async startLetterTyping(scene) {
      const target =
        firstExisting(
          [
            "[data-typing='letter']",
            "[data-letter-text]",
            ".letter-text",
            ".typing-text",
            "#letterText"
          ],
          scene
        );

      if (!target) {
        return;
      }

      let source =
        target.dataset.typingSource ||
        target.dataset.typingContent ||
        "";

      /*
       * If no data attribute exists, use the existing
       * HTML text.
       */
      if (!source) {
        source =
          target.textContent || "";
      }

      /*
       * The text is deliberately kept as the user's
       * own wording. JS only controls its timing.
       */
      await TypingEngine.type(
        target,
        source.trim(),
        {
          speed:
            CONFIG.typing.normal,

          startDelay:
            state.reducedMotion
              ? 0
              : 350,

          cursor: true,

          autoScroll: true
        }
      );

      dispatch(
        "bolu:lettercomplete"
      );
    },


    /* -----------------------------------------------------
       PROPOSAL
       ----------------------------------------------------- */

    initProposalInteractions() {
      document.addEventListener(
        "click",
        async (event) => {
          const trigger =
            event.target.closest(
              "[data-proposal], .proposal-trigger, .proposal-button, .confession-trigger"
            );

          if (!trigger) {
            return;
          }

          const scene =
            trigger.closest(".scene");

          if (
            !scene ||
            getSceneNumber(scene) !== 10
          ) {
            return;
          }

          event.preventDefault();

          await this.openProposal(scene);
        }
      );


      /*
       * Answer buttons.
       *
       * No fake runaway "NO" button.
       * No coercive gamification.
       */
      document.addEventListener(
        "click",
        (event) => {
          const answer =
            event.target.closest(
              "[data-proposal-answer]"
            );

          if (!answer) {
            return;
          }

          const scene =
            answer.closest(".scene");

          if (
            !scene ||
            getSceneNumber(scene) !== 10
          ) {
            return;
          }

          event.preventDefault();

          const value =
            answer.dataset.proposalAnswer;

          this.handleProposalAnswer(
            value,
            scene
          );
        }
      );
    },


    prepareProposal(scene) {
      if (!scene) {
        return;
      }

      const proposal =
        firstExisting(
          [
            "[data-proposal]",
            ".proposal-card",
            ".proposal"
          ],
          scene
        );

      if (proposal) {
        proposal.classList.add(
          "proposal-ready"
        );
      }
    },


    async openProposal(scene) {
      if (state.proposalOpened) {
        return;
      }

      state.proposalOpened = true;

      /*
       * Reveal only after the threshold has been crossed.
       */
      const prelude =
        firstExisting(
          [
            "[data-proposal-prelude]",
            ".proposal-prelude",
            ".proposal-intro"
          ],
          scene
        );

      if (prelude) {
        prelude.classList.add(
          "is-revealed",
          "revealed"
        );
      }

      await wait(
        state.reducedMotion
          ? 100
          : 800
      );

      const question =
        firstExisting(
          [
            "[data-proposal-question]",
            ".proposal-question",
            ".proposal-final-question"
          ],
          scene
        );

      if (question) {
        question.classList.add(
          "is-revealed",
          "revealed"
        );
      }

      const actions =
        firstExisting(
          [
            "[data-proposal-actions]",
            ".proposal-actions",
            ".proposal-buttons"
          ],
          scene
        );

      if (actions) {
        await wait(
          state.reducedMotion
            ? 0
            : 700
        );

        actions.classList.add(
          "is-revealed",
          "revealed"
        );
      }

      dispatch(
        "bolu:proposalopen"
      );
    },


    handleProposalAnswer(value, scene) {
      if (state.proposalAnswered) {
        return;
      }

      /*
       * We do not force a particular answer.
       *
       * The page simply acknowledges the interaction
       * and moves into its epilogue.
       */
      state.proposalAnswered = true;

      scene.classList.add(
        "proposal-answered"
      );

      const actions =
        firstExisting(
          [
            "[data-proposal-actions]",
            ".proposal-actions",
            ".proposal-buttons"
          ],
          scene
        );

      if (actions) {
        actions.classList.add(
          "is-answered"
        );
      }

      const response =
        firstExisting(
          [
            `[data-proposal-response='${value}']`,
            `[data-answer='${value}']`,
            ".proposal-response"
          ],
          scene
        );

      if (response) {
        response.hidden = false;

        window.setTimeout(
          () => {
            response.classList.add(
              "is-visible",
              "is-revealed",
              "revealed"
            );
          },
          state.reducedMotion ? 0 : 180
        );
      }

      /*
       * Keep music2 alive.
       * The point is not to abruptly end the experience.
       */
      dispatch(
        "bolu:proposalanswer",
        {
          value
        }
      );

      /*
       * Allow epilogue to appear after a moment.
       */
      window.setTimeout(
        () => {
          this.showEpilogue(scene);
        },
        state.reducedMotion
          ? 350
          : 1300
      );
    },


    showEpilogue(scene) {
      const epilogue =
        firstExisting(
          [
            "[data-epilogue]",
            ".epilogue",
            ".proposal-afterglow",
            ".afterglow"
          ],
          scene
        );

      if (!epilogue) {
        return;
      }

      epilogue.hidden = false;

      epilogue.classList.add(
        "is-visible",
        "is-revealed",
        "revealed"
      );

      /*
       * Restrained celebration.
       */
      CelebrationEngine.start(scene);
    },


    /* -----------------------------------------------------
       GENERIC REVEAL
       ----------------------------------------------------- */

    toggleRevealTarget(trigger, scene) {
      if (!trigger) {
        return;
      }

      let target = null;

      const explicit =
        trigger.dataset?.target ||
        trigger.dataset?.reveal ||
        trigger.getAttribute("aria-controls");

      if (explicit) {
        target =
          document.getElementById(
            explicit.replace(/^#/, "")
          ) ||
          $(explicit, scene);
      }

      if (!target) {
        target =
          $(".reveal-content", trigger) ||
          $(".trait-detail", trigger) ||
          $(".timeline-detail", trigger) ||
          $(".memory-detail", trigger) ||
          $(".sidequest-detail", trigger) ||
          $(".card-detail", trigger);
      }

      /*
       * Parent-child fallback.
       */
      if (!target) {
        target =
          trigger.parentElement
            ? firstExisting(
                [
                  ".reveal-content",
                  ".trait-detail",
                  ".timeline-detail",
                  ".memory-detail",
                  ".sidequest-detail",
                  ".card-detail"
                ],
                trigger.parentElement
              )
            : null;
      }

      /*
       * If the markup uses a next sibling.
       */
      if (!target && trigger.nextElementSibling) {
        const sibling =
          trigger.nextElementSibling;

        if (
          sibling.matches(
            ".reveal-content, .trait-detail, .timeline-detail, .memory-detail, .sidequest-detail, .card-detail, [data-reveal-content]"
          )
        ) {
          target = sibling;
        }
      }

      if (!target) {
        /*
         * Last fallback:
         * toggle the trigger itself.
         */
        trigger.classList.toggle(
          "is-open"
        );

        return;
      }

      const isOpen =
        target.classList.contains(
          "is-visible"
        ) ||
        !target.hidden &&
        target.getAttribute("aria-hidden") !== "true";

      if (isOpen) {
        target.classList.remove(
          "is-visible",
          "revealed",
          "is-revealed"
        );

        target.setAttribute(
          "aria-hidden",
          "true"
        );

        target.hidden = true;

        trigger.classList.remove(
          "is-open"
        );

        trigger.setAttribute(
          "aria-expanded",
          "false"
        );
      } else {
        target.hidden = false;

        target.setAttribute(
          "aria-hidden",
          "false"
        );

        target.classList.add(
          "is-visible",
          "revealed",
          "is-revealed"
        );

        trigger.classList.add(
          "is-open"
        );

        trigger.setAttribute(
          "aria-expanded",
          "true"
        );

        /*
         * Give browser a moment to calculate layout,
         * then ensure revealed content is visible.
         */
        window.setTimeout(
          () => {
            try {
              target.scrollIntoView({
                behavior:
                  state.reducedMotion
                    ? "auto"
                    : "smooth",

                block: "nearest"
              });
            } catch {
              /* Ignore */
            }
          },
          state.reducedMotion ? 0 : 80
        );
      }
    },


    initReplayInteractions() {
      document.addEventListener(
        "click",
        (event) => {
          const trigger =
            event.target.closest(
              "[data-restart], .restart-experience, .replay-experience"
            );

          if (!trigger) {
            return;
          }

          event.preventDefault();

          state.sceneHistory = [];

          SceneManager.goTo(1, {
            force: true
          });
        }
      );
    }
  };


  /* =======================================================
     15. SCROLL SAFETY
     ======================================================= */

  const ScrollSafety = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      /*
       * CRITICAL:
       *
       * We intentionally DO NOT listen for wheel/touchmove
       * and convert them into scene navigation.
       *
       * Vertical scrolling is reading.
       * Navigation is clicking/tapping a deliberate control.
       */


      /*
       * Prevent accidental browser restoration from
       * placing the user halfway into a scene.
       */
      if ("scrollRestoration" in history) {
        try {
          history.scrollRestoration = "manual";
        } catch {
          /* Ignore */
        }
      }


      /*
       * When the window is resized/orientation changes,
       * do not change scenes.
       */
      window.addEventListener(
        "resize",
        this.handleViewportChange,
        {
          passive: true
        }
      );

      window.addEventListener(
        "orientationchange",
        this.handleViewportChange,
        {
          passive: true
        }
      );
    },


    handleViewportChange() {
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${window.innerHeight}px`
      );

      /*
       * Recalculate nothing involving scene index.
       *
       * This is deliberate.
       */
    }
  };


  /* =======================================================
     16. KEYBOARD NAVIGATION
     ======================================================= */

  const KeyboardController = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      document.addEventListener(
        "keydown",
        (event) => {
          /*
           * Don't interfere with typing/input.
           */
          const target = event.target;

          if (
            target &&
            (
              target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable
            )
          ) {
            return;
          }

          /*
           * Escape closes local reveal states.
           */
          if (event.key === "Escape") {
            this.closeOpenReveal();

            return;
          }

          /*
           * Arrow keys are intentionally conservative.
           * We don't use Space/PageDown because those are
           * natural scrolling controls.
           */
          if (
            event.key === "ArrowRight" ||
            event.key === "Enter"
          ) {
            /*
             * Only navigate Enter if the focused element
             * isn't a button/link.
             */
            if (
              target &&
              (
                target.tagName === "BUTTON" ||
                target.tagName === "A"
              )
            ) {
              return;
            }

            event.preventDefault();

            SceneManager.next();
          }

          if (
            event.key === "ArrowLeft"
          ) {
            event.preventDefault();

            SceneManager.previous();
          }
        }
      );
    },


    closeOpenReveal() {
      const scene =
        getScene(state.currentScene);

      if (!scene) return;

      const open =
        $$(".is-open", scene);

      open.forEach((element) => {
        element.classList.remove(
          "is-open"
        );
      });

      const visible =
        $$(".reveal-content.is-visible, .trait-detail.is-visible, .timeline-detail.is-visible, .memory-detail.is-visible, .sidequest-detail.is-visible", scene);

      visible.forEach((element) => {
        element.classList.remove(
          "is-visible"
        );

        element.hidden = true;

        element.setAttribute(
          "aria-hidden",
          "true"
        );
      });
    }
  };


  /* =======================================================
     17. CURSOR MICRO-INTERACTION
     ======================================================= */

  const CursorInteraction = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      /*
       * No custom cursor on touch devices.
       */
      if (
        !window.matchMedia ||
        !window.matchMedia(
          "(hover: hover) and (pointer: fine)"
        ).matches
      ) {
        return;
      }

      const cursor =
        document.createElement("div");

      cursor.className =
        "cursor-orb";

      cursor.setAttribute(
        "aria-hidden",
        "true"
      );

      document.body.appendChild(cursor);

      let mouseX = -100;
      let mouseY = -100;

      let currentX = mouseX;
      let currentY = mouseY;

      document.addEventListener(
        "pointermove",
        (event) => {
          mouseX = event.clientX;
          mouseY = event.clientY;
        },
        {
          passive: true
        }
      );

      const animate = () => {
        currentX +=
          (mouseX - currentX) * 0.18;

        currentY +=
          (mouseY - currentY) * 0.18;

        cursor.style.transform =
          `translate3d(${currentX}px, ${currentY}px, 0)`;

        requestAnimationFrame(
          animate
        );
      };

      animate();


      document.addEventListener(
        "pointerover",
        (event) => {
          const interactive =
            event.target.closest(
              "button, a, [role='button'], .trait-card, .timeline-card, .memory-card, .sidequest-card, .photo-frame"
            );

          if (interactive) {
            cursor.classList.add(
              "is-hovering"
            );
          }
        }
      );


      document.addEventListener(
        "pointerout",
        (event) => {
          const interactive =
            event.target.closest(
              "button, a, [role='button'], .trait-card, .timeline-card, .memory-card, .sidequest-card, .photo-frame"
            );

          if (interactive) {
            cursor.classList.remove(
              "is-hovering"
            );
          }
        }
      );
    }
  };


  /* =======================================================
     18. BUTTON PRESS FEEDBACK
     ======================================================= */

  const ButtonFeedback = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      document.addEventListener(
        "pointerdown",
        (event) => {
          const button =
            event.target.closest(
              "button, a, [role='button'], .cta, .next-btn, .trait-card, .timeline-card, .sidequest-card"
            );

          if (!button) {
            return;
          }

          button.classList.add(
            "is-pressed"
          );
        },
        {
          passive: true
        }
      );


      const clear = (event) => {
        const button =
          event.target.closest(
            "button, a, [role='button'], .cta, .next-btn, .trait-card, .timeline-card, .sidequest-card"
          );

        if (!button) {
          return;
        }

        button.classList.remove(
          "is-pressed"
        );
      };


      document.addEventListener(
        "pointerup",
        clear,
        {
          passive: true
        }
      );

      document.addEventListener(
        "pointercancel",
        clear,
        {
          passive: true
        }
      );
    }
  };


  /* =======================================================
     19. CELEBRATION ENGINE
     ======================================================= */

  const CelebrationEngine = {
    started: false,

    start(scene) {
      if (this.started) {
        return;
      }

      this.started = true;

      /*
       * Keep celebration restrained.
       * CSS handles actual visual styling.
       */
      scene.classList.add(
        "celebration-active"
      );

      const container =
        firstExisting(
          [
            "[data-confetti]",
            ".confetti-container",
            ".celebration"
          ],
          scene
        );

      if (!container) {
        return;
      }

      const count =
        state.reducedMotion
          ? 0
          : 22;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const piece =
          document.createElement("span");

        piece.className =
          "confetti-piece";

        piece.style.setProperty(
          "--confetti-index",
          String(index)
        );

        piece.style.setProperty(
          "--confetti-x",
          `${Math.random() * 100}%`
        );

        piece.style.setProperty(
          "--confetti-delay",
          `${Math.random() * 900}ms`
        );

        container.appendChild(piece);
      }
    }
  };


  /* =======================================================
     20. AUDIO VISUAL STATE
     ======================================================= */

  const AudioVisualState = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      document.addEventListener(
        "bolu:musicstart",
        (event) => {
          const track =
            event.detail?.track;

          document.documentElement.dataset.music =
            track || "none";

          document.body.classList.toggle(
            "music1-playing",
            track === "music1"
          );

          document.body.classList.toggle(
            "music2-playing",
            track === "music2"
          );
        }
      );
    }
  };


  /* =======================================================
     21. DOCUMENT VISIBILITY
     ======================================================= */

  const VisibilityController = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      document.addEventListener(
        "visibilitychange",
        () => {
          if (!AudioEngine.music1 && !AudioEngine.music2) {
            return;
          }

          if (document.hidden) {
            /*
             * Browser handles audio suspension naturally.
             * We don't destroy playback state.
             */
            return;
          }

          /*
           * Don't automatically call play().
           * This prevents unexpected audio behavior after
           * returning from another app/tab.
           */
        }
      );
    }
  };


  /* =======================================================
     22. IMAGE SAFETY
     ======================================================= */

  const ImageSafety = {
    initialized: false,

    init() {
      if (this.initialized) {
        return;
      }

      this.initialized = true;

      document.addEventListener(
        "error",
        (event) => {
          const image = event.target;

          if (
            !image ||
            image.tagName !== "IMG"
          ) {
            return;
          }

          image.classList.add(
            "image-load-failed"
          );

          const parent =
            image.closest(
              ".photo-frame, .photo-card, .portrait-frame, [data-photo]"
            );

          if (parent) {
            parent.classList.add(
              "has-image-error"
            );
          }
        },
        true
      );
    }
  };


  /* =======================================================
     23. ACCESSIBILITY STATE
     ======================================================= */

  const Accessibility = {
    init() {
      /*
       * Ensure scenes have sensible aria state.
       */
      getOrderedScenes().forEach(
        (scene) => {
          if (
            !scene.hasAttribute(
              "role"
            )
          ) {
            scene.setAttribute(
              "role",
              "region"
            );
          }

          const number =
            getSceneNumber(scene);

          if (number) {
            scene.setAttribute(
              "aria-label",
              `Scene ${number}`
            );
          }
        }
      );
    }
  };


  /* =======================================================
     24. SAFE INITIAL SCENE
     ======================================================= */

  const InitialState = {
    init() {
      const scenes =
        getOrderedScenes();

      if (!scenes.length) {
        console.warn(
          "[Bolu Ubi] No scenes found."
        );

        return;
      }

      /*
       * Always start at Scene 1.
       *
       * We intentionally do NOT restore the last scene
       * automatically because this is an emotional story.
       * Returning to the website should begin predictably.
       */
      state.currentScene = 1;

      scenes.forEach(
        (scene) => {
          const number =
            getSceneNumber(scene);

          const active =
            number === 1;

          scene.classList.toggle(
            "is-active",
            active
          );

          scene.classList.toggle(
            "active",
            active
          );

          scene.setAttribute(
            "aria-hidden",
            active ? "false" : "true"
          );
        }
      );

      ScrollSafety.handleViewportChange();
    }
  };


  /* =======================================================
     25. GLOBAL ERROR SAFETY
     ======================================================= */

  const ErrorSafety = {
    init() {
      window.addEventListener(
        "error",
        (event) => {
          /*
           * Don't break the entire experience because
           * of one optional decorative asset.
           */
          if (
            event.target instanceof HTMLImageElement ||
            event.target instanceof HTMLAudioElement
          ) {
            return;
          }

          console.warn(
            "[Bolu Ubi] runtime warning:",
            event.error || event.message
          );
        }
      );


      window.addEventListener(
        "unhandledrejection",
        (event) => {
          console.warn(
            "[Bolu Ubi] async warning:",
            event.reason
          );

          /*
           * Prevent one failed optional async operation
           * from becoming a browser-level unhandled
           * rejection.
           */
          event.preventDefault();
        }
      );
    }
  };


  /* =======================================================
     26. GLOBAL API
     ======================================================= */

  /*
   * Expose a small, intentional API.
   *
   * Useful for debugging from browser console:
   *
   * BoluUbi.go(5)
   * BoluUbi.next()
   * BoluUbi.previous()
   * BoluUbi.music1()
   * BoluUbi.music2()
   * BoluUbi.state()
   */
  window.BoluUbi = {
    go(scene) {
      return SceneManager.goTo(
        Number(scene)
      );
    },

    next() {
      return SceneManager.next();
    },

    previous() {
      return SceneManager.previous();
    },

    music1() {
      state.userHasInteracted = true;

      return AudioEngine.startMusic1();
    },

    music2() {
      state.userHasInteracted = true;

      return AudioEngine.startMusic2();
    },

    stopMusic1() {
      AudioEngine.hardStopMusic1();
    },

    cancelTyping() {
      TypingEngine.cancel();
    },

    state() {
      return {
        ...state,
        activeTyping: Boolean(
          state.activeTyping
        )
      };
    }
  };


  /* =======================================================
     27. INITIALIZATION
     ======================================================= */

  const App = {
    async init() {
      if (state.initialized) {
        return;
      }

      state.initialized = true;

      /*
       * DOM must be ready.
       */
      normalizeSceneMarkup();

      InitialState.init();

      Accessibility.init();

      Navigation.init();

      EntranceController.init();

      InteractionEngine.init();

      ScrollSafety.init();

      KeyboardController.init();

      ButtonFeedback.init();

      CursorInteraction.init();

      AudioVisualState.init();

      VisibilityController.init();

      ImageSafety.init();

      ErrorSafety.init();

      /*
       * Prepare audio objects but DO NOT PLAY.
       */
      await AudioEngine.init();

      /*
       * Start first-scene choreography.
       */
      SceneChoreography.scene1();

      dispatch(
        "bolu:ready"
      );

      /*
       * Developer console message kept intentionally
       * unobtrusive.
       */
      console.info(
        "%cBolu Ubi 🐣%c ready.",
        "font-weight:700;",
        "font-weight:400;"
      );
    }
  };


  /* =======================================================
     28. BOOT
     ======================================================= */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        App.init();
      },
      {
        once: true
      }
    );
  } else {
    App.init();
  }

})();