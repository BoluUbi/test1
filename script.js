/* ============================================================
   BOLU UBI 🐣
   ------------------------------------------------------------
   script.js
   Emotional choreography + interaction engine

   PRINCIPLES
   ------------------------------------------------------------
   HTML = story
   CSS  = feeling
   JS   = timing

   This file intentionally does NOT use:
   - scroll-based scene navigation
   - framework
   - external animation library
   - autoplay on initial load

   It DOES handle:
   - scene navigation
   - progressive enhancement
   - keyboard navigation
   - touch/click interaction
   - music state machine
   - music fading
   - typing rhythm
   - expandable cards
   - hydroponics memory
   - timeline interaction
   - photo reveal
   - confession transition
   - afterglow
   - reduced-motion support
   - resize/orientation safety
   - defensive error handling
   ============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     01. GLOBAL CONFIGURATION
     ========================================================== */

  const CONFIG = Object.freeze({
    selectors: {
      root: "#app",
      scenes: ".scene",
      sceneViewport: ".scene__viewport",

      next: "[data-next]",
      previous: "[data-prev]",
      go: "[data-go]",
      action: "[data-action]",

      typing: "[data-typing]",
      reveal: "[data-reveal]",
      expandable: "[data-expand]",
      timelineItem: "[data-timeline]",

      hydroponics: "[data-hydroponics]",
      musicToggle: "[data-music-toggle]",

      audio1: "#music1",
      audio2: "#music2",

      progress: "[data-progress]",
      progressCurrent: "[data-progress-current]",
      progressTotal: "[data-progress-total]",

      photo: "[data-photo]",
      photoReveal: "[data-photo-reveal]",

      confetti: "[data-confetti]",
      replay: "[data-replay]",

      status: "[data-status]"
    },

    scenes: {
      opening: "opening",
      birthday: "birthday",
      flashback: "flashback",
      personal: "personal",
      memories: "memories",
      photo: "photo",
      bridge: "bridge",
      letter: "letter",
      quiet: "quiet",
      confession: "confession",
      afterglow: "afterglow"
    },

    audio: {
      music1MaxVolume: 0.46,
      music2MaxVolume: 0.50,

      fadeIn: 1600,
      fadeOut: 1700,

      silenceBeforeMusic2: 1100,

      defaultVolume: 0.46,

      crossfadeInterval: 30
    },

    typing: {
      defaultSpeed: 28,
      minimumDelay: 8,
      punctuationPause: 95,
      commaPause: 55,
      paragraphPause: 240,
      sentencePause: 80
    },

    animation: {
      sceneEnterDelay: 60,
      sceneLeaveDelay: 20,
      revealStagger: 75,
      confettiDuration: 4300
    }
  });


  /* ==========================================================
     02. SMALL UTILITIES
     ========================================================== */

  const $ = (selector, scope = document) => {
    if (!selector || !scope) return null;

    try {
      return scope.querySelector(selector);
    } catch (error) {
      console.warn("[Bolu Ubi] Invalid selector:", selector, error);
      return null;
    }
  };


  const $$ = (selector, scope = document) => {
    if (!selector || !scope) return [];

    try {
      return Array.from(scope.querySelectorAll(selector));
    } catch (error) {
      console.warn("[Bolu Ubi] Invalid selector:", selector, error);
      return [];
    }
  };


  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };


  const sleep = (milliseconds) => {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  };


  const prefersReducedMotion = () => {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  };


  const isTouchDevice = () => {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  };


  const safePlay = async (audio) => {
    if (!audio) return false;

    try {
      const result = audio.play();

      if (result && typeof result.then === "function") {
        await result;
      }

      return true;
    } catch (error) {
      console.warn("[Bolu Ubi] Audio playback blocked:", error);

      return false;
    }
  };


  const safePause = (audio) => {
    if (!audio) return;

    try {
      audio.pause();
    } catch (error) {
      console.warn("[Bolu Ubi] Unable to pause audio:", error);
    }
  };


  const resetAudio = (audio) => {
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (error) {
      console.warn("[Bolu Ubi] Unable to reset audio:", error);
    }
  };


  const getSceneName = (scene) => {
    if (!scene) return null;

    return (
      scene.dataset.scene ||
      scene.id?.replace(/^scene-/, "") ||
      null
    );
  };


  const getSceneByName = (name) => {
    if (!name) return null;

    const normalized = String(name)
      .trim()
      .replace(/^#/, "")
      .replace(/^scene-/, "");

    return (
      document.querySelector(
        `[data-scene="${CSS.escape(normalized)}"]`
      ) ||
      document.getElementById(`scene-${normalized}`) ||
      null
    );
  };


  const announce = (message) => {
    const status = $(CONFIG.selectors.status);

    if (!status) return;

    status.textContent = message;

    window.clearTimeout(announce.timeout);

    announce.timeout = window.setTimeout(() => {
      status.textContent = "";
    }, 1800);
  };


  /* ==========================================================
     03. APPLICATION STATE
     ========================================================== */

  const state = {
    ready: false,

    currentSceneIndex: 0,
    previousSceneIndex: -1,

    isTransitioning: false,

    music: {
      started: false,
      current: "none",
      transitioning: false,
      music1Played: false,
      music2Played: false
    },

    typing: {
      active: false,
      controller: null
    },

    interaction: {
      expandedCards: new Set(),
      openedHydroponics: false,
      revealedPhoto: false
    },

    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };


  /* ==========================================================
     04. DOM REFERENCES
     ========================================================== */

  const root =
    $(CONFIG.selectors.root) ||
    document.documentElement;

  const scenes = $$(CONFIG.selectors.scenes);

  const audio1 = $(CONFIG.selectors.audio1);
  const audio2 = $(CONFIG.selectors.audio2);

  let sceneMap = new Map();


  /* ==========================================================
     05. BUILD SCENE MAP
     ========================================================== */

  const buildSceneMap = () => {
    sceneMap = new Map();

    scenes.forEach((scene, index) => {
      const name = getSceneName(scene);

      if (!name) return;

      scene.dataset.sceneIndex = String(index);

      sceneMap.set(name, {
        element: scene,
        index
      });
    });
  };


  /* ==========================================================
     06. PROGRESSIVE ENHANCEMENT
     ----------------------------------------------------------
     Critical:
     CSS should be able to show content before JS.
     Once JS initializes, the application takes over.
     ========================================================== */

  const initializeProgressiveEnhancement = () => {
    document.documentElement.classList.add("js-ready");

    root.classList.add("is-ready");

    scenes.forEach((scene, index) => {
      scene.classList.toggle(
        "is-active",
        index === state.currentSceneIndex
      );

      scene.setAttribute(
        "aria-hidden",
        index === state.currentSceneIndex
          ? "false"
          : "true"
      );
    });
  };


  /* ==========================================================
     07. ACCESSIBILITY
     ========================================================== */

  const updateAccessibility = (activeScene) => {
    scenes.forEach((scene) => {
      const isActive = scene === activeScene;

      scene.setAttribute(
        "aria-hidden",
        isActive ? "false" : "true"
      );

      if (isActive) {
        scene.removeAttribute("inert");
      } else {
        scene.setAttribute("inert", "");
      }
    });
  };


  const focusScene = (scene) => {
    if (!scene) return;

    const heading =
      $("h1, h2, h3, [data-scene-heading]", scene);

    if (heading) {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }

      window.setTimeout(() => {
        try {
          heading.focus({
            preventScroll: true
          });
        } catch {
          heading.focus();
        }
      }, 100);
    }
  };


  /* ==========================================================
     08. PROGRESS INDICATOR
     ========================================================== */

  const updateProgress = () => {
    const current =
      $(CONFIG.selectors.progressCurrent);

    const total =
      $(CONFIG.selectors.progressTotal);

    const progress =
      $(CONFIG.selectors.progress);

    const totalScenes = scenes.length;

    if (current) {
      current.textContent =
        String(state.currentSceneIndex + 1).padStart(2, "0");
    }

    if (total) {
      total.textContent =
        String(totalScenes).padStart(2, "0");
    }

    if (progress && totalScenes > 1) {
      const percentage =
        (state.currentSceneIndex /
          (totalScenes - 1)) *
        100;

      progress.style.setProperty(
        "--scene-progress",
        `${percentage}%`
      );

      progress.setAttribute(
        "aria-valuenow",
        String(state.currentSceneIndex + 1)
      );

      progress.setAttribute(
        "aria-valuemax",
        String(totalScenes)
      );
    }
  };


  /* ==========================================================
     09. SCENE ENTER / EXIT ANIMATION
     ========================================================== */

  const prepareSceneForEntry = (scene) => {
    if (!scene) return;

    scene.classList.remove(
      "is-entering",
      "is-leaving"
    );

    /*
      Force browser to acknowledge the state before
      adding the next class.
    */
    void scene.offsetWidth;

    scene.classList.add("is-entering");

    window.setTimeout(() => {
      scene.classList.remove("is-entering");
    }, prefersReducedMotion() ? 1 : 700);
  };


  const prepareSceneForExit = (scene) => {
    if (!scene) return;

    scene.classList.add("is-leaving");

    window.setTimeout(() => {
      scene.classList.remove("is-leaving");
    }, prefersReducedMotion() ? 1 : 700);
  };


  /* ==========================================================
     10. SCENE NAVIGATION
     ========================================================== */

  const getIndexForTarget = (target) => {
    if (!target) return -1;

    /*
      Direct numerical target:
      data-go="4"
    */
    if (/^\d+$/.test(target)) {
      const numericIndex = Number(target);

      if (
        numericIndex >= 0 &&
        numericIndex < scenes.length
      ) {
        return numericIndex;
      }
    }

    /*
      Scene name:
      data-go="photo"
    */
    const sceneInfo = sceneMap.get(
      target.replace(/^#/, "").replace(/^scene-/, "")
    );

    if (sceneInfo) {
      return sceneInfo.index;
    }

    /*
      Selector / ID fallback
    */
    const element =
      document.querySelector(target) ||
      document.getElementById(
        target.replace(/^#/, "")
      );

    if (element) {
      const index = scenes.indexOf(element);

      if (index !== -1) {
        return index;
      }
    }

    return -1;
  };


  const resolveNavigationTarget = (control) => {
    if (!control) return null;

    const explicitTarget =
      control.dataset.go ||
      control.getAttribute("href");

    if (explicitTarget) {
      return getIndexForTarget(explicitTarget);
    }

    if (control.hasAttribute("data-next")) {
      return state.currentSceneIndex + 1;
    }

    if (control.hasAttribute("data-prev")) {
      return state.currentSceneIndex - 1;
    }

    return null;
  };


  const navigateToIndex = async (
    targetIndex,
    options = {}
  ) => {
    const {
      force = false,
      announceChange = true,
      focus = true
    } = options;

    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= scenes.length
    ) {
      return false;
    }

    if (
      targetIndex === state.currentSceneIndex &&
      !force
    ) {
      return false;
    }

    if (state.isTransitioning && !force) {
      return false;
    }

    const previousIndex =
      state.currentSceneIndex;

    const previousScene =
      scenes[previousIndex];

    const nextScene =
      scenes[targetIndex];

    if (!nextScene) return false;

    state.isTransitioning = true;
    state.previousSceneIndex = previousIndex;

    /*
      Before leaving the current scene:
      stop any scene-specific typing.
    */
    stopTyping();

    prepareSceneForExit(previousScene);

    /*
      Allow CSS to begin its exit state.
    */
    await sleep(
      prefersReducedMotion()
        ? 1
        : CONFIG.animation.sceneLeaveDelay
    );

    /*
      Remove active state from old scene.
    */
    previousScene?.classList.remove("is-active");

    /*
      Activate target.
    */
    nextScene.classList.add("is-active");

    nextScene.setAttribute(
      "aria-hidden",
      "false"
    );

    prepareSceneForEntry(nextScene);

    state.currentSceneIndex =
      targetIndex;

    /*
      Update all accessibility states.
    */
    updateAccessibility(nextScene);

    /*
      Internal scroll reset only.
      This is NOT scene navigation by scrolling.
    */
    const viewport =
      $(CONFIG.selectors.sceneViewport, nextScene);

    if (viewport) {
      try {
        viewport.scrollTop = 0;
      } catch {}
    }

    updateProgress();

    /*
      Scene-specific behavior.
    */
    await handleSceneEnter(nextScene);

    /*
      Small breathing room after activation.
    */
    await sleep(
      prefersReducedMotion()
        ? 1
        : CONFIG.animation.sceneEnterDelay
    );

    state.isTransitioning = false;

    if (focus) {
      focusScene(nextScene);
    }

    if (announceChange) {
      const sceneName =
        getSceneName(nextScene);

      if (sceneName) {
        announce(
          `Scene ${targetIndex + 1} dari ${scenes.length}`
        );
      }
    }

    return true;
  };


  const nextScene = () => {
    return navigateToIndex(
      state.currentSceneIndex + 1
    );
  };


  const previousScene = () => {
    return navigateToIndex(
      state.currentSceneIndex - 1
    );
  };


  const goToScene = (target) => {
    const index =
      typeof target === "number"
        ? target
        : getIndexForTarget(target);

    return navigateToIndex(index);
  };


  /* ==========================================================
     11. BUTTON / LINK NAVIGATION
     ========================================================== */

  const handleNavigationControl = (event) => {
    const control =
      event.target.closest(
        `${CONFIG.selectors.next}, ${CONFIG.selectors.previous}, ${CONFIG.selectors.go}`
      );

    if (!control) return;

    /*
      Do not hijack:
      - modifier clicks
      - external links
      - normal anchor behavior
    */
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target =
      resolveNavigationTarget(control);

    if (target === null || target === -1) {
      return;
    }

    event.preventDefault();

    void navigateToIndex(target);
  };


  /* ==========================================================
     12. SCENE-SPECIFIC ENTER HANDLER
     ========================================================== */

  const handleSceneEnter = async (scene) => {
    if (!scene) return;

    const sceneName =
      getSceneName(scene);

    /*
      ------------------------------------------
      BIRTHDAY
      ------------------------------------------
      music1 is already started by the opening
      button. We do NOT restart it here.
    */
    if (
      sceneName === CONFIG.scenes.birthday
    ) {
      if (!state.music.started) {
        /*
          Defensive fallback:
          if somebody jumps directly into scene 2,
          we still try to start music1.
        */
        await startMusic1();
      }

      runSceneReveals(scene);
    }


    /*
      ------------------------------------------
      FLASHBACK
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.flashback
    ) {
      runSceneReveals(scene);

      setupTimeline(scene);
    }


    /*
      ------------------------------------------
      PERSONAL
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.personal
    ) {
      runSceneReveals(scene);
    }


    /*
      ------------------------------------------
      MEMORIES
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.memories
    ) {
      runSceneReveals(scene);

      setupHydroponics(scene);
    }


    /*
      ------------------------------------------
      PHOTO
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.photo
    ) {
      runSceneReveals(scene);

      /*
        If HTML already marks photo as revealed,
        respect it.
      */
      if (
        scene.dataset.photoAutoReveal === "true"
      ) {
        revealPhoto(scene);
      }
    }


    /*
      ------------------------------------------
      BRIDGE
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.bridge
    ) {
      runSceneReveals(scene);
    }


    /*
      ------------------------------------------
      LETTER
      ------------------------------------------
      Typing is intentionally started only when
      the scene enters.
    */
    if (
      sceneName === CONFIG.scenes.letter
    ) {
      runSceneReveals(scene);

      await runTypingInScene(scene);
    }


    /*
      ------------------------------------------
      QUIET
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.quiet
    ) {
      runSceneReveals(scene);
    }


    /*
      ------------------------------------------
      CONFESSION
      ------------------------------------------
      This is the exact threshold:
      music1 -> silence -> music2.
    */
    if (
      sceneName === CONFIG.scenes.confession
    ) {
      await enterConfession(scene);
    }


    /*
      ------------------------------------------
      AFTERGLOW
      ------------------------------------------
    */
    if (
      sceneName === CONFIG.scenes.afterglow
    ) {
      runSceneReveals(scene);

      triggerConfetti(scene);
    }
  };


  /* ==========================================================
     13. GENERIC REVEALS
     ========================================================== */

  const runSceneReveals = (scene) => {
    if (!scene) return;

    const revealItems =
      $$(
        CONFIG.selectors.reveal,
        scene
      );

    revealItems.forEach((element, index) => {
      element.classList.remove("is-revealed");

      const delay =
        prefersReducedMotion()
          ? 0
          : index *
            CONFIG.animation.revealStagger;

      window.setTimeout(() => {
        element.classList.add("is-revealed");
      }, delay);
    });
  };


  /* ==========================================================
     14. OPENING BUTTON
     ========================================================== */

  const handleOpeningAction = async (control) => {
    if (!control) return;

    const action =
      control.dataset.action;

    if (
      action !== "open" &&
      action !== "enter" &&
      action !== "start"
    ) {
      return;
    }

    /*
      This click is the user's gesture.
      Therefore it is the correct moment to
      request audio playback.
    */

    control.disabled = true;
    control.setAttribute(
      "aria-busy",
      "true"
    );

    await startMusic1();

    /*
      Find the intended next scene.
    */
    let target =
      resolveNavigationTarget(control);

    /*
      If no data-next/data-go exists,
      default to scene after opening.
    */
    if (
      target === null ||
      target === -1
    ) {
      target = state.currentSceneIndex + 1;
    }

    await navigateToIndex(target);

    control.disabled = false;
    control.removeAttribute(
      "aria-busy"
    );
  };


  /* ==========================================================
     15. MUSIC SYSTEM
     ========================================================== */

  const prepareAudio = () => {
    if (audio1) {
      audio1.preload = "auto";
      audio1.loop = true;
      audio1.volume = 0;
    }

    if (audio2) {
      audio2.preload = "auto";
      audio2.loop = true;
      audio2.volume = 0;
    }
  };


  const fadeAudio = (
    audio,
    from,
    to,
    duration
  ) => {
    if (!audio) {
      return Promise.resolve();
    }

    if (prefersReducedMotion()) {
      audio.volume = clamp(to, 0, 1);

      return Promise.resolve();
    }

    const start =
      performance.now();

    return new Promise((resolve) => {
      const tick = (now) => {
        const elapsed =
          now - start;

        const progress =
          clamp(
            elapsed / duration,
            0,
            1
          );

        /*
          Smoothstep easing.
        */
        const eased =
          progress *
          progress *
          (3 - 2 * progress);

        const value =
          from +
          (to - from) *
          eased;

        try {
          audio.volume =
            clamp(value, 0, 1);
        } catch {}

        if (progress < 1) {
          window.requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      window.requestAnimationFrame(tick);
    });
  };


  const startMusic1 = async () => {
    if (!audio1) {
      console.warn(
        "[Bolu Ubi] #music1 tidak ditemukan."
      );

      return false;
    }

    /*
      If already active, do nothing.
    */
    if (
      state.music.current === "music1" &&
      !audio1.paused
    ) {
      state.music.started = true;

      return true;
    }

    /*
      Make absolutely sure music2 is not playing.
    */
    if (audio2) {
      safePause(audio2);
      audio2.volume = 0;
    }

    audio1.volume = 0;

    const played =
      await safePlay(audio1);

    if (!played) {
      return false;
    }

    state.music.started = true;
    state.music.current = "music1";
    state.music.music1Played = true;

    await fadeAudio(
      audio1,
      0,
      CONFIG.audio.music1MaxVolume,
      CONFIG.audio.fadeIn
    );

    updateMusicUI();

    return true;
  };


  const stopMusic1 = async () => {
    if (!audio1) return;

    const startingVolume =
      Number.isFinite(audio1.volume)
        ? audio1.volume
        : CONFIG.audio.music1MaxVolume;

    await fadeAudio(
      audio1,
      startingVolume,
      0,
      CONFIG.audio.fadeOut
    );

    safePause(audio1);

    try {
      audio1.currentTime = 0;
    } catch {}

    state.music.current = "silence";

    updateMusicUI();
  };


  const startMusic2 = async () => {
    if (!audio2) {
      console.warn(
        "[Bolu Ubi] #music2 tidak ditemukan."
      );

      return false;
    }

    /*
      Music1 must be completely stopped first.
    */
    if (
      audio1 &&
      !audio1.paused
    ) {
      await stopMusic1();
    }

    /*
      Small silence is intentional.
    */
    await sleep(
      prefersReducedMotion()
        ? 1
        : CONFIG.audio.silenceBeforeMusic2
    );

    audio2.volume = 0;

    const played =
      await safePlay(audio2);

    if (!played) {
      return false;
    }

    state.music.current = "music2";
    state.music.music2Played = true;

    await fadeAudio(
      audio2,
      0,
      CONFIG.audio.music2MaxVolume,
      CONFIG.audio.fadeIn
    );

    updateMusicUI();

    return true;
  };


  const toggleMusic = async () => {
    /*
      This is optional UI functionality.
      It never controls scene navigation.
    */

    if (
      state.music.current === "music1" &&
      audio1
    ) {
      if (audio1.paused) {
        await safePlay(audio1);
        await fadeAudio(
          audio1,
          0,
          CONFIG.audio.music1MaxVolume,
          700
        );
      } else {
        const volume = audio1.volume;

        await fadeAudio(
          audio1,
          volume,
          0,
          500
        );

        safePause(audio1);
      }
    }

    else if (
      state.music.current === "music2" &&
      audio2
    ) {
      if (audio2.paused) {
        await safePlay(audio2);

        await fadeAudio(
          audio2,
          0,
          CONFIG.audio.music2MaxVolume,
          700
        );
      } else {
        const volume = audio2.volume;

        await fadeAudio(
          audio2,
          volume,
          0,
          500
        );

        safePause(audio2);
      }
    }

    updateMusicUI();
  };


  const updateMusicUI = () => {
    const controls =
      $$(CONFIG.selectors.musicToggle);

    controls.forEach((control) => {
      const active =
        state.music.current !== "none" &&
        (
          (state.music.current === "music1" &&
            audio1 &&
            !audio1.paused) ||
          (state.music.current === "music2" &&
            audio2 &&
            !audio2.paused)
        );

      control.classList.toggle(
        "is-playing",
        active
      );

      control.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );

      const label =
        active
          ? "pause music"
          : "play music";

      control.setAttribute(
        "aria-label",
        label
      );
    });
  };


  /* ==========================================================
     16. CONFESSION THRESHOLD
     ========================================================== */

  const enterConfession = async (scene) => {
    if (!scene) return;

    /*
      Prevent duplicate music transitions
      if the scene is re-entered.
    */
    if (
      !state.music.music2Played
    ) {
      await startMusic2();
    }

    runSceneReveals(scene);

    /*
      Give the visual scene time to breathe.
    */
    await sleep(
      prefersReducedMotion()
        ? 1
        : 250
    );

    setupConfessionInteraction(scene);
  };


  /* ==========================================================
     17. TYPING ENGINE
     ========================================================== */

  const getTypingText = (element) => {
    if (!element) return "";

    /*
      data-typing-text is safest because it preserves
      whitespace and avoids reading child markup.
    */
    if (
      element.dataset.typingText
    ) {
      return element.dataset.typingText;
    }

    return element.textContent || "";
  };


  const calculateCharacterDelay = (
    character,
    previousCharacter,
    element
  ) => {
    const base =
      Number(
        element.dataset.typingSpeed
      ) ||
      CONFIG.typing.defaultSpeed;

    /*
      Slight natural variation.
    */
    const variation =
      Math.random() * 18 - 9;

    let delay =
      Math.max(
        CONFIG.typing.minimumDelay,
        base + variation
      );

    /*
      Human-like pauses.
    */
    if (
      character === "." ||
      character === "!" ||
      character === "?"
    ) {
      delay +=
        CONFIG.typing.sentencePause;
    }

    if (
      character === "," ||
      character === ";"
    ) {
      delay +=
        CONFIG.typing.commaPause;
    }

    if (
      previousCharacter === "\n" &&
      character !== "\n"
    ) {
      delay +=
        CONFIG.typing.paragraphPause;
    }

    return delay;
  };


  const typeIntoElement = async (
    element,
    options = {}
  ) => {
    if (!element) return;

    const {
      skipIfDone = false
    } = options;

    const text =
      getTypingText(element);

    if (!text) return;

    if (
      skipIfDone &&
      element.dataset.typed === "true"
    ) {
      return;
    }

    /*
      Cancel any existing typing operation.
    */
    stopTyping();

    const controller =
      new AbortController();

    state.typing.controller =
      controller;

    state.typing.active = true;

    element.classList.add(
      "is-typing"
    );

    /*
      Store original text once.
    */
    if (
      !element.dataset.originalTypingText
    ) {
      element.dataset.originalTypingText =
        text;
    }

    /*
      Clear only visual text.
    */
    element.textContent = "";

    const chars =
      Array.from(text);

    let previousCharacter = "";

    for (
      let index = 0;
      index < chars.length;
      index++
    ) {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      const character =
        chars[index];

      element.textContent +=
        character;

      /*
        Keep caret / cursor behavior CSS-driven.
      */
      element.classList.add(
        "has-typed-content"
      );

      if (
        prefersReducedMotion()
      ) {
        continue;
      }

      const delay =
        calculateCharacterDelay(
          character,
          previousCharacter,
          element
        );

      await sleep(delay);

      previousCharacter =
        character;
    }

    element.dataset.typed =
      "true";

    element.classList.remove(
      "is-typing"
    );

    state.typing.active = false;
    state.typing.controller = null;
  };


  const stopTyping = () => {
    if (
      state.typing.controller
    ) {
      try {
        state.typing.controller.abort();
      } catch {}
    }

    state.typing.controller = null;
    state.typing.active = false;

    $$(CONFIG.selectors.typing)
      .forEach((element) => {
        element.classList.remove(
          "is-typing"
        );
      });
  };


  const restoreTyping = (
    element
  ) => {
    if (!element) return;

    const original =
      element.dataset.originalTypingText;

    if (
      original
    ) {
      element.textContent =
        original;

      element.dataset.typed =
        "false";
    }
  };


  const runTypingInScene = async (
    scene
  ) => {
    const typingElements =
      $$(CONFIG.selectors.typing, scene);

    if (!typingElements.length) {
      return;
    }

    for (
      const element of typingElements
    ) {
      if (
        element.dataset.autotype === "false"
      ) {
        continue;
      }

      await typeIntoElement(
        element,
        {
          skipIfDone: true
        }
      );

      /*
        Natural breathing space between
        separate blocks.
      */
      if (
        !prefersReducedMotion()
      ) {
        await sleep(180);
      }
    }
  };


  /* ==========================================================
     18. EXPANDABLE PERSONAL CARDS
     ========================================================== */

  const toggleExpandable = (
    control
  ) => {
    if (!control) return;

    const targetSelector =
      control.dataset.expand;

    if (!targetSelector) return;

    let target = null;

    try {
      target =
        document.querySelector(
          targetSelector
        );
    } catch {}

    /*
      Also support:
      data-expand="hydroponics"
      => #hydroponics
    */
    if (!target) {
      target =
        document.getElementById(
          targetSelector
        );
    }

    if (!target) return;

    const currentlyOpen =
      target.classList.contains(
        "is-open"
      ) ||
      target.hidden === false;

    if (currentlyOpen) {
      target.classList.remove(
        "is-open"
      );

      target.hidden = true;

      control.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    target.hidden = false;

    /*
      Force layout before animation class.
    */
    void target.offsetWidth;

    target.classList.add(
      "is-open"
    );

    control.setAttribute(
      "aria-expanded",
      "true"
    );

    state.interaction.expandedCards.add(
      target
    );
  };


  const initializeExpandableElements = () => {
    const controls =
      $$(
        CONFIG.selectors.expandable
      );

    controls.forEach((control) => {
      const targetSelector =
        control.dataset.expand;

      if (!targetSelector) return;

      let target = null;

      try {
        target =
          document.querySelector(
            targetSelector
          );
      } catch {}

      if (!target) {
        target =
          document.getElementById(
            targetSelector
          );
      }

      if (!target) return;

      /*
        Important:
        Don't rely on CSS hidden alone.
      */
      if (
        !target.classList.contains(
          "is-open"
        )
      ) {
        target.hidden = true;
      }

      control.setAttribute(
        "aria-expanded",
        target.classList.contains(
          "is-open"
        )
          ? "true"
          : "false"
      );
    });
  };


  /* ==========================================================
     19. HYDROPONICS MEMORY
     ========================================================== */

  const setupHydroponics = (
    scene
  ) => {
    if (!scene) return;

    const nativeDetails =
      $("details[data-hydroponics]", scene);

    if (nativeDetails) {
      nativeDetails.addEventListener(
        "toggle",
        () => {
          state.interaction.openedHydroponics =
            nativeDetails.open;

          nativeDetails.classList.toggle(
            "is-open",
            nativeDetails.open
          );
        }
      );
    }

    /*
      Custom button-based version.
    */
    const controls =
      $$(
        CONFIG.selectors.hydroponics,
        scene
      );

    controls.forEach((control) => {
      if (
        control.dataset.hydroBound === "true"
      ) {
        return;
      }

      control.dataset.hydroBound = "true";

      control.addEventListener(
        "click",
        () => {
          toggleHydroponics(
            control,
            scene
          );
        }
      );
    });
  };


  const toggleHydroponics = (
    control,
    scene
  ) => {
    const targetId =
      control.dataset.hydroponics ||
      control.dataset.expand;

    if (!targetId) return;

    let target =
      document.getElementById(
        targetId.replace(/^#/, "")
      );

    if (!target) {
      try {
        target =
          document.querySelector(
            targetId
          );
      } catch {}
    }

    if (!target) {
      console.warn(
        "[Bolu Ubi] Hydroponics target tidak ditemukan:",
        targetId
      );

      return;
    }

    const isOpen =
      target.classList.contains(
        "is-open"
      );

    if (isOpen) {
      target.classList.remove(
        "is-open"
      );

      target.hidden = true;

      control.classList.remove(
        "is-open"
      );

      control.setAttribute(
        "aria-expanded",
        "false"
      );

      state.interaction.openedHydroponics =
        false;

      return;
    }

    target.hidden = false;

    void target.offsetWidth;

    target.classList.add(
      "is-open"
    );

    control.classList.add(
      "is-open"
    );

    control.setAttribute(
      "aria-expanded",
      "true"
    );

    state.interaction.openedHydroponics =
      true;
  };


  /* ==========================================================
     20. TIMELINE
     ========================================================== */

  const setupTimeline = (
    scene
  ) => {
    if (!scene) return;

    const items =
      $$(
        CONFIG.selectors.timelineItem,
        scene
      );

    items.forEach((item, index) => {
      if (
        item.dataset.timelineBound === "true"
      ) {
        return;
      }

      item.dataset.timelineBound =
        "true";

      item.setAttribute(
        "tabindex",
        "0"
      );

      item.setAttribute(
        "role",
        "button"
      );

      item.setAttribute(
        "aria-expanded",
        item.classList.contains(
          "is-active"
        )
          ? "true"
          : "false"
      );

      const activate = () => {
        items.forEach((other) => {
          if (other !== item) {
            other.classList.remove(
              "is-active"
            );

            other.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        });

        item.classList.toggle(
          "is-active"
        );

        item.setAttribute(
          "aria-expanded",
          item.classList.contains(
            "is-active"
          )
            ? "true"
            : "false"
        );
      };

      item.addEventListener(
        "click",
        activate
      );

      item.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            activate();
          }
        }
      );

      /*
        First item can be active if requested
        by HTML.
      */
      if (
        index === 0 &&
        item.dataset.timelineDefault === "true"
      ) {
        item.classList.add(
          "is-active"
        );
      }
    });
  };


  /* ==========================================================
     21. PHOTO REVEAL
     ========================================================== */

  const revealPhoto = (
    scene
  ) => {
    if (!scene) return;

    const photo =
      $(
        CONFIG.selectors.photo,
        scene
      );

    if (!photo) return;

    const wrapper =
      photo.closest(
        ".photo-reveal, [data-photo-wrap]"
      ) ||
      photo.parentElement;

    if (wrapper) {
      wrapper.classList.add(
        "is-revealed"
      );
    }

    photo.classList.add(
      "is-revealed"
    );

    state.interaction.revealedPhoto =
      true;
  };


  const setupPhoto = (
    scene
  ) => {
    if (!scene) return;

    const controls =
      $$(
        CONFIG.selectors.photoReveal,
        scene
      );

    controls.forEach((control) => {
      if (
        control.dataset.photoBound === "true"
      ) {
        return;
      }

      control.dataset.photoBound =
        "true";

      control.addEventListener(
        "click",
        () => {
          revealPhoto(scene);

          control.classList.add(
            "is-used"
          );

          control.setAttribute(
            "aria-expanded",
            "true"
          );
        }
      );
    });
  };


  /* ==========================================================
     22. CONFESSION INTERACTION
     ========================================================== */

  const setupConfessionInteraction = (
    scene
  ) => {
    if (!scene) return;

    const buttons =
      $$(
        "[data-confession-action]",
        scene
      );

    buttons.forEach((button) => {
      if (
        button.dataset.confessionBound === "true"
      ) {
        return;
      }

      button.dataset.confessionBound =
        "true";

      button.addEventListener(
        "click",
        async () => {
          const action =
            button.dataset.confessionAction;

          if (
            action === "reveal"
          ) {
            revealConfession(scene);
          }

          if (
            action === "continue"
          ) {
            const target =
              resolveNavigationTarget(
                button
              );

            if (
              target !== null &&
              target !== -1
            ) {
              await navigateToIndex(
                target
              );
            }
          }
        }
      );
    });
  };


  const revealConfession = (
    scene
  ) => {
    if (!scene) return;

    const hiddenParts =
      $$(
        "[data-confession-reveal]",
        scene
      );

    hiddenParts.forEach(
      (element, index) => {
        const delay =
          prefersReducedMotion()
            ? 0
            : index * 260;

        window.setTimeout(() => {
          element.classList.add(
            "is-revealed"
          );
        }, delay);
      }
    );

    scene.classList.add(
      "confession-awakened"
    );

    /*
      Optional final celebration.
    */
    if (
      scene.dataset.confettiOnReveal ===
      "true"
    ) {
      triggerConfetti(scene);
    }
  };


  /* ==========================================================
     23. CONFETTI
     ----------------------------------------------------------
     Lightweight DOM implementation.
     No external library.
     ========================================================== */

  const triggerConfetti = (
    scene
  ) => {
    if (!scene) return;

    if (
      prefersReducedMotion()
    ) {
      return;
    }

    const host =
      $(
        CONFIG.selectors.confetti,
        scene
      ) ||
      scene;

    /*
      Avoid duplicate bursts.
    */
    if (
      host.dataset.confettiActive ===
      "true"
    ) {
      return;
    }

    host.dataset.confettiActive =
      "true";

    const container =
      document.createElement(
        "div"
      );

    container.className =
      "confetti-layer";

    container.setAttribute(
      "aria-hidden",
      "true"
    );

    const count =
      window.innerWidth < 600
        ? 28
        : 44;

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const piece =
        document.createElement(
          "span"
        );

      piece.className =
        "confetti-piece";

      const left =
        Math.random() * 100;

      const delay =
        Math.random() * 500;

      const duration =
        2400 +
        Math.random() * 1900;

      const rotation =
        Math.random() * 720 - 360;

      const drift =
        Math.random() * 160 - 80;

      piece.style.left =
        `${left}%`;

      piece.style.animationDelay =
        `${delay}ms`;

      piece.style.animationDuration =
        `${duration}ms`;

      piece.style.setProperty(
        "--confetti-rotation",
        `${rotation}deg`
      );

      piece.style.setProperty(
        "--confetti-drift",
        `${drift}px`
      );

      /*
        We intentionally avoid forcing colors here.
        CSS controls the visual palette.
      */

      container.appendChild(
        piece
      );
    }

    host.appendChild(
      container
    );

    window.setTimeout(() => {
      container.remove();

      host.dataset.confettiActive =
        "false";
    }, CONFIG.animation.confettiDuration);
  };


  /* ==========================================================
     24. REPLAY
     ========================================================== */

  const resetExperience = async () => {
    /*
      Stop music completely.
    */
    if (audio1) {
      resetAudio(audio1);
      audio1.volume = 0;
    }

    if (audio2) {
      resetAudio(audio2);
      audio2.volume = 0;
    }

    state.music.started = false;
    state.music.current = "none";
    state.music.transitioning = false;
    state.music.music1Played = false;
    state.music.music2Played = false;

    stopTyping();

    /*
      Restore typing blocks.
    */
    $$(CONFIG.selectors.typing)
      .forEach((element) => {
        restoreTyping(element);
      });

    /*
      Close expandable cards.
    */
    $$(CONFIG.selectors.expandable)
      .forEach((control) => {
        const targetSelector =
          control.dataset.expand;

        if (!targetSelector) return;

        let target = null;

        try {
          target =
            document.querySelector(
              targetSelector
            );
        } catch {}

        if (!target) {
          target =
            document.getElementById(
              targetSelector
            );
        }

        if (!target) return;

        target.hidden = true;

        target.classList.remove(
          "is-open"
        );

        control.setAttribute(
          "aria-expanded",
          "false"
        );
      });

    /*
      Reset photo reveal.
    */
    $$(CONFIG.selectors.photo)
      .forEach((photo) => {
        photo.classList.remove(
          "is-revealed"
        );
      });

    $$(CONFIG.selectors.photoReveal)
      .forEach((button) => {
        button.classList.remove(
          "is-used"
        );

        button.setAttribute(
          "aria-expanded",
          "false"
        );
      });

    /*
      Reset generic reveals.
    */
    $$(CONFIG.selectors.reveal)
      .forEach((element) => {
        element.classList.remove(
          "is-revealed"
        );
      });

    /*
      Reset confession.
    */
    $$(".confession-awakened")
      .forEach((element) => {
        element.classList.remove(
          "confession-awakened"
        );
      });

    $$(
      "[data-confession-reveal]"
    ).forEach((element) => {
      element.classList.remove(
        "is-revealed"
      );
    });

    /*
      Return to opening.
    */
    state.currentSceneIndex = 0;
    state.previousSceneIndex = -1;

    scenes.forEach((scene, index) => {
      scene.classList.toggle(
        "is-active",
        index === 0
      );

      scene.classList.remove(
        "is-entering",
        "is-leaving"
      );
    });

    updateAccessibility(
      scenes[0]
    );

    updateProgress();

    updateMusicUI();

    /*
      Let the first scene settle.
    */
    await sleep(100);

    focusScene(
      scenes[0]
    );
  };


  /* ==========================================================
     25. EVENT DELEGATION
     ========================================================== */

  const handleClick = async (event) => {
    const target =
      event.target;

    if (!(target instanceof Element)) {
      return;
    }

    /*
      ----------------------------------------------------------
      OPENING
      ----------------------------------------------------------
    */
    const openingControl =
      target.closest(
        '[data-action="open"], [data-action="enter"], [data-action="start"]'
      );

    if (openingControl) {
      event.preventDefault();

      await handleOpeningAction(
        openingControl
      );

      return;
    }


    /*
      ----------------------------------------------------------
      NORMAL SCENE NAVIGATION
      ----------------------------------------------------------
    */
    const navControl =
      target.closest(
        `${CONFIG.selectors.next}, ${CONFIG.selectors.previous}, ${CONFIG.selectors.go}`
      );

    if (navControl) {
      handleNavigationControl(
        event
      );

      return;
    }


    /*
      ----------------------------------------------------------
      EXPANDABLE CARD
      ----------------------------------------------------------
    */
    const expandable =
      target.closest(
        CONFIG.selectors.expandable
      );

    if (expandable) {
      event.preventDefault();

      toggleExpandable(
        expandable
      );

      return;
    }


    /*
      ----------------------------------------------------------
      HYDROPONICS
      ----------------------------------------------------------
    */
    const hydroponics =
      target.closest(
        CONFIG.selectors.hydroponics
      );

    if (hydroponics) {
      event.preventDefault();

      const scene =
        hydroponics.closest(
          CONFIG.selectors.scenes
        );

      toggleHydroponics(
        hydroponics,
        scene
      );

      return;
    }


    /*
      ----------------------------------------------------------
      PHOTO
      ----------------------------------------------------------
    */
    const photoControl =
      target.closest(
        CONFIG.selectors.photoReveal
      );

    if (photoControl) {
      event.preventDefault();

      const scene =
        photoControl.closest(
          CONFIG.selectors.scenes
        );

      revealPhoto(scene);

      return;
    }


    /*
      ----------------------------------------------------------
      MUSIC
      ----------------------------------------------------------
    */
    const musicControl =
      target.closest(
        CONFIG.selectors.musicToggle
      );

    if (musicControl) {
      event.preventDefault();

      await toggleMusic();

      return;
    }


    /*
      ----------------------------------------------------------
      CONFESSION
      ----------------------------------------------------------
    */
    const confessionButton =
      target.closest(
        "[data-confession-action]"
      );

    if (confessionButton) {
      const scene =
        confessionButton.closest(
          CONFIG.selectors.scenes
        );

      const action =
        confessionButton.dataset
          .confessionAction;

      if (
        action === "reveal"
      ) {
        event.preventDefault();

        revealConfession(
          scene
        );

        return;
      }

      if (
        action === "continue"
      ) {
        const next =
          resolveNavigationTarget(
            confessionButton
          );

        if (
          next !== null &&
          next !== -1
        ) {
          event.preventDefault();

          await navigateToIndex(
            next
          );
        }

        return;
      }
    }


    /*
      ----------------------------------------------------------
      REPLAY
      ----------------------------------------------------------
    */
    const replay =
      target.closest(
        CONFIG.selectors.replay
      );

    if (replay) {
      event.preventDefault();

      await resetExperience();

      return;
    }
  };


  /* ==========================================================
     26. KEYBOARD NAVIGATION
     ========================================================== */

  const handleKeydown = (event) => {
    /*
      Do not hijack typing inside form fields.
    */
    const active =
      document.activeElement;

    if (
      active &&
      (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        active.isContentEditable
      )
    ) {
      return;
    }

    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
        event.preventDefault();
        void nextScene();
        break;

      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();
        void previousScene();
        break;

      case "Home":
        event.preventDefault();
        void goToScene(0);
        break;

      case "End":
        event.preventDefault();
        void goToScene(
          scenes.length - 1
        );
        break;

      case " ":
        /*
          Space is deliberately NOT used for
          scene navigation because it should
          still be usable for buttons/details.
        */
        break;

      default:
        break;
    }
  };


  /* ==========================================================
     27. NO SCROLL-BASED NAVIGATION
     ----------------------------------------------------------
     This is intentional.
     Scrolling inside a scene is allowed.
     Scrolling never changes scenes.
     ========================================================== */

  const preventSceneScrollNavigation = () => {
    /*
      We do NOT attach wheel/touchmove handlers
      that call nextScene().

      This function exists as documentation and
      future-proofing for the project architecture.
    */
  };


  /* ==========================================================
     28. VIEWPORT HANDLING
     ========================================================== */

  const handleViewportChange = () => {
    state.viewport.width =
      window.innerWidth;

    state.viewport.height =
      window.innerHeight;

    document.documentElement.style.setProperty(
      "--viewport-width",
      `${state.viewport.width}px`
    );

    document.documentElement.style.setProperty(
      "--viewport-height",
      `${state.viewport.height}px`
    );

    /*
      CSS itself handles layout.
      JS only provides safe viewport variables.
    */
  };


  /* ==========================================================
     29. VISIBILITY / TAB SAFETY
     ========================================================== */

  const handleVisibilityChange = () => {
    /*
      We don't automatically pause music because
      browsers may behave differently and the
      emotional state should remain stable.

      But we DO avoid creating duplicate playback.
    */

    if (
      document.visibilityState === "hidden"
    ) {
      return;
    }

    updateMusicUI();
  };


  /* ==========================================================
     30. AUDIO ERROR HANDLING
     ========================================================== */

  const setupAudioDiagnostics = () => {
    [audio1, audio2]
      .filter(Boolean)
      .forEach((audio) => {
        audio.addEventListener(
          "error",
          () => {
            console.warn(
              `[Bolu Ubi] Audio error: ${audio.id}`
            );

            announce(
              "Musiknya belum tersedia / belum bisa diputar."
            );
          }
        );

        audio.addEventListener(
          "play",
          updateMusicUI
        );

        audio.addEventListener(
          "pause",
          updateMusicUI
        );

        audio.addEventListener(
          "ended",
          updateMusicUI
        );
      });
  };


  /* ==========================================================
     31. IMAGE SAFETY
     ========================================================== */

  const setupImageSafety = () => {
    const images =
      $$("img");

    images.forEach((image) => {
      /*
        Native lazy loading for non-critical images.
      */
      if (
        !image.hasAttribute(
          "loading"
        )
      ) {
        image.loading =
          "lazy";
      }

      /*
        Prevent broken image from destroying
        layout.
      */
      image.addEventListener(
        "error",
        () => {
          image.classList.add(
            "is-broken"
          );

          console.warn(
            "[Bolu Ubi] Image gagal dimuat:",
            image.currentSrc ||
              image.src
          );
        }
      );
    });
  };


  /* ==========================================================
     32. INITIAL SCENE DISCOVERY
     ========================================================== */

  const determineInitialScene = () => {
    /*
      Explicit HTML preference:
      <body data-start-scene="opening">
    */
    const requested =
      document.body.dataset.startScene;

    if (requested) {
      const index =
        getIndexForTarget(
          requested
        );

      if (
        index >= 0
      ) {
        return index;
      }
    }

    /*
      Otherwise first scene.
    */
    return 0;
  };


  /* ==========================================================
     33. BIND EVENTS
     ========================================================== */

  const bindEvents = () => {
    document.addEventListener(
      "click",
      handleClick
    );

    document.addEventListener(
      "keydown",
      handleKeydown
    );

    window.addEventListener(
      "resize",
      handleViewportChange,
      {
        passive: true
      }
    );

    window.addEventListener(
      "orientationchange",
      handleViewportChange,
      {
        passive: true
      }
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    /*
      Prevent accidental browser restoration
      from putting the page halfway through.
    */
    if (
      "scrollRestoration" in history
    ) {
      try {
        history.scrollRestoration =
          "manual";
      } catch {}
    }

    window.addEventListener(
      "beforeunload",
      () => {
        if (audio1) {
          safePause(audio1);
        }

        if (audio2) {
          safePause(audio2);
        }
      }
    );
  };


  /* ==========================================================
     34. INITIALIZATION
     ========================================================== */

  const initialize = async () => {
    try {
      /*
        ------------------------------------------
        STEP 1
        ------------------------------------------
        Build scene map before anything else.
      */
      buildSceneMap();

      /*
        If there are no scenes, don't crash.
      */
      if (!scenes.length) {
        console.warn(
          "[Bolu Ubi] Tidak ada .scene yang ditemukan."
        );

        return;
      }

      /*
        ------------------------------------------
        STEP 2
        ------------------------------------------
        Determine initial scene.
      */
      state.currentSceneIndex =
        determineInitialScene();

      /*
        ------------------------------------------
        STEP 3
        ------------------------------------------
        Progressive enhancement.
      */
      initializeProgressiveEnhancement();

      /*
        ------------------------------------------
        STEP 4
        ------------------------------------------
        Audio.
      */
      prepareAudio();
      setupAudioDiagnostics();

      /*
        ------------------------------------------
        STEP 5
        ------------------------------------------
        UI systems.
      */
      updateProgress();

      initializeExpandableElements();

      setupImageSafety();

      handleViewportChange();

      /*
        ------------------------------------------
        STEP 6
        ------------------------------------------
        Scene-specific systems that must exist
        before user interaction.
      */
      scenes.forEach((scene) => {
        setupTimeline(scene);
        setupHydroponics(scene);
        setupPhoto(scene);
        setupConfessionInteraction(scene);
      });

      /*
        ------------------------------------------
        STEP 7
        ------------------------------------------
        Event listeners.
      */
      bindEvents();

      preventSceneScrollNavigation();

      /*
        ------------------------------------------
        STEP 8
        ------------------------------------------
        Make sure only initial scene is active.
      */
      scenes.forEach(
        (scene, index) => {
          scene.classList.toggle(
            "is-active",
            index ===
              state.currentSceneIndex
          );
        }
      );

      updateAccessibility(
        scenes[
          state.currentSceneIndex
        ]
      );

      /*
        ------------------------------------------
        STEP 9
        ------------------------------------------
        Initial scene reveal.
      */
      await handleSceneEnter(
        scenes[
          state.currentSceneIndex
        ]
      );

      /*
        ------------------------------------------
        STEP 10
        ------------------------------------------
        Mark app ready.
      */
      state.ready = true;

      root.classList.add(
        "app-ready"
      );

      document.documentElement.classList.add(
        "app-ready"
      );

      /*
        ------------------------------------------
        STEP 11
        ------------------------------------------
        Debug surface.
      */
      exposeDebugAPI();

      console.info(
        "%cBolu Ubi 🐣",
        "font-size:20px;font-weight:bold;"
      );

      console.info(
        "Website engine initialized successfully."
      );

    } catch (error) {
      /*
        CRITICAL:
        One JS error must NEVER leave the
        website completely blank.

        We intentionally catch initialization
        errors and restore first-scene visibility.
      */

      console.error(
        "[Bolu Ubi] Initialization error:",
        error
      );

      recoverFromInitializationError();
    }
  };


  /* ==========================================================
     35. ERROR RECOVERY
     ========================================================== */

  const recoverFromInitializationError = () => {
    /*
      Make sure first scene remains visible.
    */
    if (scenes.length) {
      scenes.forEach(
        (scene, index) => {
          scene.classList.toggle(
            "is-active",
            index === 0
          );

          scene.setAttribute(
            "aria-hidden",
            index === 0
              ? "false"
              : "true"
          );

          scene.removeAttribute(
            "inert"
          );
        }
      );
    }

    /*
      Remove potentially dangerous loading state.
    */
    root.classList.remove(
      "is-loading"
    );

    document.documentElement.classList.add(
      "js-recovery"
    );

    /*
      Do not attempt autoplay.
      User can still interact with visible
      HTML.
    */
  };


  /* ==========================================================
     36. DEBUG API
     ----------------------------------------------------------
     Open DevTools console and use:

       BoluUbi.inspect()

       BoluUbi.next()

       BoluUbi.previous()

       BoluUbi.go("photo")

       BoluUbi.go("confession")

       BoluUbi.music()

       BoluUbi.music2()

       BoluUbi.reset()

     This is intentionally exposed only for
     debugging and can be removed before deployment.
     ========================================================== */

  const exposeDebugAPI = () => {
    window.BoluUbi = {
      inspect() {
        return {
          ready: state.ready,
          currentScene:
            getSceneName(
              scenes[
                state.currentSceneIndex
              ]
            ),
          currentSceneIndex:
            state.currentSceneIndex,

          totalScenes:
            scenes.length,

          music: {
            current:
              state.music.current,

            started:
              state.music.started,

            music1Played:
              state.music.music1Played,

            music2Played:
              state.music.music2Played,

            music1Paused:
              audio1
                ? audio1.paused
                : null,

            music2Paused:
              audio2
                ? audio2.paused
                : null
          },

          typing: {
            active:
              state.typing.active
          },

          viewport: {
            width:
              state.viewport.width,

            height:
              state.viewport.height
          }
        };
      },

      next() {
        return nextScene();
      },

      previous() {
        return previousScene();
      },

      go(target) {
        return goToScene(target);
      },

      music() {
        return startMusic1();
      },

      music2() {
        return startMusic2();
      },

      pauseMusic() {
        if (audio1) {
          safePause(audio1);
        }

        if (audio2) {
          safePause(audio2);
        }

        updateMusicUI();
      },

      reset() {
        return resetExperience();
      },

      type(sceneName) {
        const scene =
          getSceneByName(
            sceneName
          );

        if (!scene) {
          return Promise.resolve(
            false
          );
        }

        return runTypingInScene(
          scene
        );
      }
    };
  };


  /* ==========================================================
     37. GLOBAL ERROR GUARD
     ----------------------------------------------------------
     Prevent one asynchronous error from destroying
     the entire interactive experience.
     ========================================================== */

  window.addEventListener(
    "error",
    (event) => {
      console.error(
        "[Bolu Ubi] Runtime error:",
        event.error ||
          event.message
      );

      /*
        We deliberately don't display a scary
        error message to the recipient.
      */
    }
  );


  window.addEventListener(
    "unhandledrejection",
    (event) => {
      console.error(
        "[Bolu Ubi] Promise error:",
        event.reason
      );
    }
  );


  /* ==========================================================
     38. START
     ========================================================== */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

})();