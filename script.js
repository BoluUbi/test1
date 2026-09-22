/* ============================================================
   BOLU UBI — STORY ENGINE
   script.js

   Responsibility:
   - Scene navigation
   - Scene transitions
   - Audio state / cross-scene music
   - Scene 8 typing
   - Interactive scene elements
   - Touch / desktop interaction safety
   - Defensive DOM handling
   - Accessibility / reduced motion
   - Debug helpers

   IMPORTANT:
   HTML = story
   CSS  = feeling
   JS   = timing
   ============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     01. CONFIGURATION
     ========================================================== */

  const CONFIG = Object.freeze({
    totalScenes: 10,

    scenes: {
      first: 1,
      birthday: 2,
      flashback: 3,
      traits: 4,
      memories: 5,
      photo: 6,
      bridge: 7,
      letter: 8,
      breath: 9,
      climax: 10
    },

    audio: {
      music1: "music1.mp3",
      music2: "music2.mp3",

      music1Volume: 0.58,
      music2Volume: 0.64,

      fadeIn: 1800,
      fadeOut: 1500,

      /* emotional silence between music1 and music2 */
      musicGap: 1100
    },

    transition: {
      desktop: 780,
      mobile: 680,

      /*
       * Small delay after the outgoing scene is visually hidden
       * and before the incoming scene begins to reveal itself.
       */
      sceneBreath: 70
    },

    typing: {
      minimumDelay: 16,
      maximumDelay: 54,

      punctuationPause: 130,
      sentencePause: 230,
      paragraphPause: 500,

      emotionalPause: 680,

      /*
       * Characters in these ranges are intentionally slower.
       * The letter should feel typed, not machine-streamed.
       */
      slowWords: [
        "jujur",
        "harapan",
        "tersenyum",
        "sampingmu",
        "bersandar",
        "aman",
        "bertumbuh",
        "bersama",
        "capek",
        "sedih",
        "sendirian",
        "aku masih di sini"
      ]
    },

    selectors: {
      scene: [
        ".scene",
        "[data-scene]"
      ],

      navigation: [
        "button",
        "a",
        "[role='button']",
        "[data-next-scene]",
        "[data-scene-target]",
        "[data-go-to]",
        "[data-target]",
        "[data-next]"
      ],

      reveal: [
        "[data-reveal]",
        ".reveal-on-click",
        ".click-reveal"
      ],

      typing: [
        "[data-typing]",
        ".typing-text",
        "#letter-text"
      ]
    }
  });


  /* ==========================================================
     02. STATE
     ========================================================== */

  const state = {
    initialized: false,

    currentScene: 1,
    previousScene: null,

    isTransitioning: false,
    transitionToken: 0,

    navigationLockedUntil: 0,

    reducedMotion: false,

    viewport: {
      width: window.innerWidth || 1024,
      height: window.innerHeight || 768,
      isMobile: false
    },

    scenes: [],

    audio: {
      music1: null,
      music2: null,

      active: null,

      requestedTrack: null,

      music1Started: false,
      music2Started: false,

      fading: false,
      generation: 0
    },

    typing: {
      active: false,
      scene: null,
      token: 0,
      timer: null,
      completed: false,
      startedAt: 0
    },

    interactions: {
      revealed: new WeakSet()
    },

    touch: {
      lastTouchEnd: 0,
      lastPointerDown: 0
    }
  };


  /* ==========================================================
     03. SMALL UTILITIES
     ========================================================== */

  const $ = (selector, root = document) => {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };


  const $$ = (selector, root = document) => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };


  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };


  const sleep = (ms) => {
    return new Promise(resolve => {
      window.setTimeout(resolve, Math.max(0, ms));
    });
  };


  const nextFrame = () => {
    return new Promise(resolve => {
      requestAnimationFrame(() => resolve());
    });
  };


  const prefersReducedMotion = () => {
    try {
      return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    } catch {
      return false;
    }
  };


  const isElement = (value) => {
    return value instanceof Element;
  };


  const isButtonLike = (element) => {
    if (!isElement(element)) return false;

    return (
      element.matches("button") ||
      element.matches("a") ||
      element.matches("[role='button']") ||
      element.hasAttribute("data-next-scene") ||
      element.hasAttribute("data-scene-target") ||
      element.hasAttribute("data-go-to") ||
      element.hasAttribute("data-target") ||
      element.hasAttribute("data-next")
    );
  };


  const normalizeSceneNumber = (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const raw = String(value).trim();

    if (!raw) return null;

    /*
     * Accept:
     * 8
     * "8"
     * "scene-8"
     * "#scene-8"
     * "scene8"
     */
    const direct = Number(raw);

    if (
      Number.isInteger(direct) &&
      direct >= 1 &&
      direct <= CONFIG.totalScenes
    ) {
      return direct;
    }

    const match = raw.match(
      /(?:scene[\s_-]*)?(\d{1,2})/i
    );

    if (!match) return null;

    const number = Number(match[1]);

    if (
      Number.isInteger(number) &&
      number >= 1 &&
      number <= CONFIG.totalScenes
    ) {
      return number;
    }

    return null;
  };


  const getSceneId = (scene) => {
    if (!scene) return null;

    const explicit = scene.getAttribute("data-scene");

    if (explicit) {
      return normalizeSceneNumber(explicit);
    }

    const id = scene.id || "";

    return normalizeSceneNumber(id);
  };


  const getCurrentScene = () => {
    return state.scenes.find(
      scene => getSceneId(scene) === state.currentScene
    ) || null;
  };


  const getScene = (number) => {
    const normalized = normalizeSceneNumber(number);

    if (!normalized) return null;

    return state.scenes.find(
      scene => getSceneId(scene) === normalized
    ) || null;
  };


  const getTransitionDuration = () => {
    if (state.reducedMotion) return 0;

    return state.viewport.isMobile
      ? CONFIG.transition.mobile
      : CONFIG.transition.desktop;
  };


  /* ==========================================================
     04. VIEWPORT
     ========================================================== */

  function updateViewportState() {
    const width = window.innerWidth || 1024;
    const height = window.innerHeight || 768;

    state.viewport.width = width;
    state.viewport.height = height;

    /*
     * Do not use user-agent detection.
     *
     * The actual viewport is what matters for interaction.
     */
    state.viewport.isMobile =
      width <= 768 ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    document.documentElement.style.setProperty(
      "--viewport-height",
      `${height}px`
    );

    document.documentElement.style.setProperty(
      "--viewport-width",
      `${width}px`
    );

    document.documentElement.dataset.viewport =
      state.viewport.isMobile
        ? "mobile"
        : "desktop";
  }


  let resizeTimer = null;

  function handleResize() {
    window.clearTimeout(resizeTimer);

    resizeTimer = window.setTimeout(() => {
      updateViewportState();

      /*
       * Keep the currently active scene stable during resize.
       * Never navigate because of resize/orientation.
       */
      const current = getCurrentScene();

      if (current) {
        current.scrollTop = current.scrollTop;
      }
    }, 80);
  }


  /* ==========================================================
     05. SCENE DISCOVERY
     ========================================================== */

  function discoverScenes() {
    const candidates = [];

    CONFIG.selectors.scene.forEach(selector => {
      $$(selector).forEach(scene => {
        if (!candidates.includes(scene)) {
          candidates.push(scene);
        }
      });
    });

    /*
     * Sort by declared scene number.
     */
    candidates.sort((a, b) => {
      const sceneA = getSceneId(a) ?? 999;
      const sceneB = getSceneId(b) ?? 999;

      return sceneA - sceneB;
    });

    state.scenes = candidates;

    return candidates;
  }


  function ensureSceneAttributes() {
    state.scenes.forEach((scene, index) => {
      const number = getSceneId(scene);

      /*
       * If a scene somehow has no usable number,
       * assign one only as a defensive fallback.
       */
      if (!number) {
        scene.dataset.scene = String(index + 1);
      }

      scene.setAttribute(
        "aria-hidden",
        "true"
      );

      scene.setAttribute(
        "data-scene-state",
        "inactive"
      );
    });
  }


  /* ==========================================================
     06. SCENE VISIBILITY
     ========================================================== */

  function showScene(scene) {
    if (!scene) return;

    scene.hidden = false;

    scene.setAttribute(
      "aria-hidden",
      "false"
    );

    scene.setAttribute(
      "data-scene-state",
      "active"
    );

    scene.classList.add("is-active");

    /*
     * Do NOT scroll the entire page.
     * Scene itself may have internal scrolling.
     */
  }


  function hideScene(scene) {
    if (!scene) return;

    scene.classList.remove("is-active");

    scene.setAttribute(
      "aria-hidden",
      "true"
    );

    scene.setAttribute(
      "data-scene-state",
      "inactive"
    );

    scene.hidden = true;
  }


  function initializeSceneVisibility() {
    const requestedActive = state.scenes.find(
      scene =>
        scene.classList.contains("active") ||
        scene.classList.contains("is-active") ||
        scene.getAttribute("data-active") === "true"
    );

    let initialScene =
      requestedActive ||
      getScene(1) ||
      state.scenes[0];

    if (!initialScene) {
      console.warn(
        "[Bolu Ubi] No scene elements were found."
      );
      return;
    }

    const initialNumber =
      getSceneId(initialScene) || 1;

    state.currentScene = initialNumber;

    state.scenes.forEach(scene => {
      if (scene === initialScene) {
        showScene(scene);
      } else {
        hideScene(scene);
      }
    });
  }


  /* ==========================================================
     07. TRANSITION OVERLAY
     ========================================================== */

  function getTransitionOverlay() {
    let overlay = $("#scene-transition");

    if (overlay) {
      return overlay;
    }

    overlay = document.createElement("div");

    overlay.id = "scene-transition";

    overlay.setAttribute(
      "aria-hidden",
      "true"
    );

    /*
     * CSS is allowed to take over the visual design.
     * JS only provides safe structural defaults.
     */
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      pointerEvents: "none",
      opacity: "0",
      visibility: "hidden"
    });

    document.body.appendChild(overlay);

    return overlay;
  }


  async function transitionCover(token) {
    if (state.reducedMotion) {
      return;
    }

    if (token !== state.transitionToken) {
      return;
    }

    const overlay = getTransitionOverlay();

    overlay.style.visibility = "visible";
    overlay.style.pointerEvents = "none";

    /*
     * Allow browser to paint visibility before opacity.
     */
    await nextFrame();

    if (token !== state.transitionToken) return;

    overlay.style.transition =
      `opacity ${getTransitionDuration()}ms cubic-bezier(.22,.61,.36,1)`;

    overlay.style.opacity = "1";

    await sleep(
      getTransitionDuration()
    );
  }


  async function transitionReveal(token) {
    if (state.reducedMotion) {
      return;
    }

    if (token !== state.transitionToken) {
      return;
    }

    const overlay = getTransitionOverlay();

    /*
     * Keep the overlay for a tiny emotional breath.
     */
    await sleep(
      CONFIG.transition.sceneBreath
    );

    if (token !== state.transitionToken) return;

    overlay.style.transition =
      `opacity ${getTransitionDuration()}ms cubic-bezier(.22,.61,.36,1)`;

    overlay.style.opacity = "0";

    await sleep(
      getTransitionDuration()
    );

    if (token !== state.transitionToken) return;

    overlay.style.visibility = "hidden";
  }


  /* ==========================================================
     08. SCENE TARGET RESOLUTION
     ========================================================== */

  function getExplicitTarget(element) {
    if (!element) return null;

    const attributes = [
      "data-next-scene",
      "data-scene-target",
      "data-go-to",
      "data-target",
      "data-next"
    ];

    for (const attribute of attributes) {
      if (!element.hasAttribute(attribute)) {
        continue;
      }

      const value =
        element.getAttribute(attribute);

      const target =
        normalizeSceneNumber(value);

      if (target) {
        return target;
      }
    }

    return null;
  }


  function getTargetFromHref(element) {
    if (!element) return null;

    if (
      element.tagName.toLowerCase() !== "a"
    ) {
      return null;
    }

    const href =
      element.getAttribute("href");

    if (!href) return null;

    /*
     * Do not hijack ordinary external links.
     */
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      return null;
    }

    /*
     * #scene-9
     * #scene9
     * #9
     */
    if (href.startsWith("#")) {
      return normalizeSceneNumber(
        href.slice(1)
      );
    }

    return null;
  }


  function getTargetFromElementId(element) {
    if (!element) return null;

    /*
     * Defensive fallback:
     * id="next-scene-9"
     * id="to-scene-9"
     */
    const source =
      `${element.id || ""} ${
        element.className || ""
      }`;

    const match =
      source.match(
        /(?:next|to|go)[-_ ]?scene[-_ ]?(\d{1,2})/i
      );

    if (!match) return null;

    return normalizeSceneNumber(
      match[1]
    );
  }


  function getRelativeTarget(element) {
    if (!element) return null;

    const scene = element.closest(
      ".scene, [data-scene]"
    );

    if (!scene) return null;

    const current =
      getSceneId(scene);

    if (!current) return null;

    const explicitDirection =
      element.getAttribute("data-direction");

    if (
      explicitDirection === "next" ||
      element.classList.contains("next-scene")
    ) {
      return clamp(
        current + 1,
        1,
        CONFIG.totalScenes
      );
    }

    if (
      explicitDirection === "previous" ||
      explicitDirection === "prev" ||
      element.classList.contains("previous-scene") ||
      element.classList.contains("prev-scene")
    ) {
      return clamp(
        current - 1,
        1,
        CONFIG.totalScenes
      );
    }

    return null;
  }


  function getLegacyTextTarget(element) {
    if (!element) return null;

    const text =
      (element.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    if (!text) return null;

    const scene =
      element.closest(
        ".scene, [data-scene]"
      );

    const current =
      scene
        ? getSceneId(scene)
        : state.currentScene;

    /*
     * This is intentionally ONLY a fallback.
     * HTML data attributes remain the preferred method.
     */

    if (
      current === 1 &&
      (
        text.includes("bukaa duluuu") ||
        text.includes("buka dulu")
      )
    ) {
      return 2;
    }

    if (
      current >= 1 &&
      current < CONFIG.totalScenes &&
      (
        text === "next" ||
        text === "lanjut" ||
        text === "lanjut..." ||
        text.includes("lanjut ke") ||
        text.includes("lanjut lagi")
      )
    ) {
      return current + 1;
    }

    return null;
  }


  function resolveNavigationTarget(element) {
    if (!element) return null;

    /*
     * Priority matters.
     *
     * 1. Explicit data target
     * 2. href
     * 3. ID/class fallback
     * 4. relative next/previous
     * 5. legacy text fallback
     */

    const explicit =
      getExplicitTarget(element);

    if (explicit) {
      return explicit;
    }

    const hrefTarget =
      getTargetFromHref(element);

    if (hrefTarget) {
      return hrefTarget;
    }

    const idTarget =
      getTargetFromElementId(element);

    if (idTarget) {
      return idTarget;
    }

    const relative =
      getRelativeTarget(element);

    if (relative) {
      return relative;
    }

    const legacy =
      getLegacyTextTarget(element);

    if (legacy) {
      return legacy;
    }

    /*
     * FINAL DEFENSIVE RULE:
     *
     * If a navigation-like element exists inside Scene 8,
     * and it does not have a target, assume it means "continue"
     * ONLY if it is visually/navigation-wise a CTA.
     *
     * This specifically prevents the Scene 8 → 9 issue
     * from happening because of a harmless label mismatch.
     */
    const parentScene =
      element.closest(
        ".scene, [data-scene]"
      );

    const parentNumber =
      parentScene
        ? getSceneId(parentScene)
        : null;

    if (
      parentNumber === 8 &&
      (
        element.matches(
          "[data-continue]"
        ) ||
        element.classList.contains(
          "continue-scene"
        ) ||
        element.classList.contains(
          "letter-next"
        )
      )
    ) {
      return 9;
    }

    return null;
  }


  /* ==========================================================
     09. SPECIAL SCENE NAVIGATION
     ========================================================== */

  function validateSceneTarget(target) {
    const number =
      normalizeSceneNumber(target);

    if (!number) {
      return null;
    }

    if (!getScene(number)) {
      console.warn(
        `[Bolu Ubi] Scene ${number} was requested but not found.`
      );

      return null;
    }

    return number;
  }


  function isNavigationAllowed() {
    return (
      !state.isTransitioning &&
      Date.now() >= state.navigationLockedUntil
    );
  }


  function lockNavigation(duration = 900) {
    state.navigationLockedUntil =
      Date.now() + duration;
  }


  /* ==========================================================
     10. AUDIO ENGINE
     ========================================================== */

  function createAudio(src, id) {
    const audio =
      document.createElement("audio");

    audio.id = id;
    audio.preload = "auto";
    audio.loop = true;
    audio.playsInline = true;

    /*
     * Do not set autoplay.
     */
    audio.autoplay = false;

    audio.src = src;

    /*
     * Keep audio in the DOM but invisible.
     */
    audio.setAttribute(
      "aria-hidden",
      "true"
    );

    audio.style.position = "fixed";
    audio.style.width = "1px";
    audio.style.height = "1px";
    audio.style.opacity = "0";
    audio.style.pointerEvents = "none";
    audio.style.left = "-9999px";

    document.body.appendChild(audio);

    return audio;
  }


  function initializeAudio() {
    /*
     * Respect existing audio elements if the HTML already
     * contains them.
     */
    state.audio.music1 =
      $("#music1") ||
      $("#music-1") ||
      document.querySelector(
        "audio[data-music='1']"
      ) ||
      createAudio(
        CONFIG.audio.music1,
        "bolu-music-1"
      );

    state.audio.music2 =
      $("#music2") ||
      $("#music-2") ||
      document.querySelector(
        "audio[data-music='2']"
      ) ||
      createAudio(
        CONFIG.audio.music2,
        "bolu-music-2"
      );

    state.audio.music1.volume = 0;
    state.audio.music2.volume = 0;

    state.audio.music1.pause();
    state.audio.music2.pause();

    /*
     * Reset position only when initialization happens.
     */
    try {
      state.audio.music1.currentTime = 0;
      state.audio.music2.currentTime = 0;
    } catch {
      /* Some browsers can block currentTime before metadata. */
    }
  }


  function cancelAudioFade() {
    state.audio.generation++;
    state.audio.fading = false;
  }


  async function fadeAudio(
    audio,
    targetVolume,
    duration,
    token
  ) {
    if (!audio) return;

    if (state.reducedMotion) {
      audio.volume =
        clamp(targetVolume, 0, 1);

      return;
    }

    const startVolume =
      Number.isFinite(audio.volume)
        ? audio.volume
        : 0;

    const endVolume =
      clamp(targetVolume, 0, 1);

    if (duration <= 0) {
      audio.volume = endVolume;
      return;
    }

    const startTime =
      performance.now();

    await new Promise(resolve => {
      const step = now => {
        if (token !== state.audio.generation) {
          resolve();
          return;
        }

        const progress =
          clamp(
            (now - startTime) / duration,
            0,
            1
          );

        /*
         * Smoothstep easing.
         */
        const eased =
          progress * progress *
          (3 - 2 * progress);

        audio.volume =
          startVolume +
          (endVolume - startVolume) *
          eased;

        if (progress >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });
  }


  async function safePlay(audio) {
    if (!audio) return false;

    try {
      const promise = audio.play();

      if (promise instanceof Promise) {
        await promise;
      }

      return true;
    } catch (error) {
      /*
       * Autoplay restrictions are expected on some browsers.
       * Do not crash the entire application.
       */
      console.warn(
        "[Bolu Ubi] Audio playback was blocked:",
        error
      );

      return false;
    }
  }


  function stopAudioImmediately(audio) {
    if (!audio) return;

    try {
      audio.pause();
    } catch {
      /* noop */
    }

    try {
      audio.currentTime = 0;
    } catch {
      /* noop */
    }

    audio.volume = 0;
  }


  async function startMusic1() {
    const audio =
      state.audio.music1;

    if (!audio) return false;

    cancelAudioFade();

    /*
     * Absolutely prevent music2 overlap.
     */
    if (state.audio.music2) {
      stopAudioImmediately(
        state.audio.music2
      );
    }

    state.audio.active = "music1";
    state.audio.requestedTrack = "music1";
    state.audio.music1Started = true;

    const generation =
      state.audio.generation;

    /*
     * Start from current position if already playing,
     * otherwise from the beginning.
     */
    const playing =
      !audio.paused &&
      !audio.ended;

    if (!playing) {
      try {
        audio.currentTime = 0;
      } catch {
        /* noop */
      }

      const didPlay =
        await safePlay(audio);

      if (!didPlay) {
        return false;
      }
    }

    await fadeAudio(
      audio,
      CONFIG.audio.music1Volume,
      CONFIG.audio.fadeIn,
      generation
    );

    return true;
  }


  async function fadeOutAndStopMusic1() {
    const audio =
      state.audio.music1;

    if (!audio) return;

    cancelAudioFade();

    const generation =
      state.audio.generation;

    await fadeAudio(
      audio,
      0,
      CONFIG.audio.fadeOut,
      generation
    );

    /*
     * Critical:
     * volume 0 is NOT enough.
     *
     * We explicitly pause AND reset.
     */
    stopAudioImmediately(audio);

    if (
      state.audio.active === "music1"
    ) {
      state.audio.active = null;
    }
  }


  async function startMusic2() {
    const audio =
      state.audio.music2;

    if (!audio) return false;

    /*
     * Guarantee no music1 overlap.
     */
    await fadeOutAndStopMusic1();

    cancelAudioFade();

    /*
     * Start music2 from the beginning.
     */
    try {
      audio.currentTime = 0;
    } catch {
      /* noop */
    }

    audio.volume = 0;

    state.audio.active = "music2";
    state.audio.requestedTrack = "music2";
    state.audio.music2Started = true;

    const didPlay =
      await safePlay(audio);

    if (!didPlay) {
      return false;
    }

    const generation =
      state.audio.generation;

    await fadeAudio(
      audio,
      CONFIG.audio.music2Volume,
      CONFIG.audio.fadeIn,
      generation
    );

    return true;
  }


  async function transitionMusic1ToMusic2() {
    /*
     * The order here is intentional:
     *
     * MUSIC 1
     *   ↓ fade
     * STOP
     *   ↓ silence
     * MUSIC 2
     *   ↓ fade
     * PLAY
     */
    await fadeOutAndStopMusic1();

    await sleep(
      CONFIG.audio.musicGap
    );

    await startMusic2();
  }


  async function stopAllAudio() {
    cancelAudioFade();

    stopAudioImmediately(
      state.audio.music1
    );

    stopAudioImmediately(
      state.audio.music2
    );

    state.audio.active = null;
    state.audio.requestedTrack = null;
  }


  /* ==========================================================
     11. SCENE 8 TYPING ENGINE
     ========================================================== */

  function findTypingTarget(scene = getScene(8)) {
    if (!scene) return null;

    for (
      const selector of CONFIG.selectors.typing
    ) {
      const element =
        $(selector, scene);

      if (element) {
        return element;
      }
    }

    /*
     * Additional defensive selectors.
     */
    return (
      $(".letter-content", scene) ||
      $(".letter-body", scene) ||
      $(".letter-text", scene) ||
      null
    );
  }


  function clearTypingTimer() {
    if (state.typing.timer) {
      window.clearTimeout(
        state.typing.timer
      );

      state.typing.timer = null;
    }
  }


  function cancelTyping() {
    state.typing.token++;

    clearTypingTimer();

    state.typing.active = false;
    state.typing.scene = null;
    state.typing.startedAt = 0;
  }


  function isEmotionalText(text, index) {
    if (!text) return false;

    const lower =
      text.toLowerCase();

    /*
     * Longer sentence or emotionally loaded phrases.
     */
    if (
      lower.includes(
        "aku masih di sini"
      ) ||
      lower.includes(
        "you don't always"
      ) ||
      lower.includes(
        "i hope you remember"
      ) ||
      lower.includes(
        "my biggest wish"
      ) ||
      lower.includes(
        "bertumbuh"
      ) ||
      lower.includes(
        "sampingmu"
      )
    ) {
      return true;
    }

    /*
     * Every sufficiently long sentence receives
     * a slightly more human rhythm.
     */
    return (
      text.length > 100 &&
      index > 0
    );
  }


  function calculateTypingDelay(
    character,
    fullText,
    index
  ) {
    /*
     * Base human-ish variation.
     */
    const wave =
      Math.sin(index * 1.73);

    let delay =
      CONFIG.typing.minimumDelay +
      (
        (wave + 1) / 2
      ) *
      (
        CONFIG.typing.maximumDelay -
        CONFIG.typing.minimumDelay
      );

    /*
     * Whitespace is almost instantaneous.
     */
    if (
      character === " " ||
      character === "\n" ||
      character === "\t"
    ) {
      delay *= 0.45;
    }

    /*
     * Punctuation pauses.
     */
    if (
      character === "," ||
      character === ";" ||
      character === ":"
    ) {
      delay +=
        CONFIG.typing.punctuationPause;
    }

    if (
      character === "." ||
      character === "!" ||
      character === "?"
    ) {
      delay +=
        CONFIG.typing.sentencePause;
    }

    /*
     * Emotional text slows down.
     */
    const localWindow =
      fullText
        .slice(
          Math.max(0, index - 60),
          Math.min(
            fullText.length,
            index + 60
          )
        )
        .toLowerCase();

    if (
      CONFIG.typing.slowWords.some(
        word =>
          localWindow.includes(word)
      )
    ) {
      delay *= 1.18;
    }

    return clamp(
      delay,
      8,
      900
    );
  }


  function scrollTypingTargetIntoView(
    element
  ) {
    if (!element) return;

    /*
     * Do NOT scroll the page automatically.
     *
     * Only make a newly created line visible
     * if it would otherwise fall below the
     * internal scroll container.
     */
    const scene =
      element.closest(
        ".scene, [data-scene]"
      );

    if (!scene) return;

    const elementRect =
      element.getBoundingClientRect();

    const sceneRect =
      scene.getBoundingClientRect();

    const bottomOverflow =
      elementRect.bottom -
      sceneRect.bottom;

    if (bottomOverflow > 20) {
      scene.scrollTop +=
        bottomOverflow + 24;
    }
  }


  async function typeScene8() {
    const scene =
      getScene(8);

    const target =
      findTypingTarget(scene);

    if (!scene || !target) {
      return;
    }

    cancelTyping();

    const token =
      ++state.typing.token;

    state.typing.active = true;
    state.typing.scene = 8;
    state.typing.completed = false;
    state.typing.startedAt =
      performance.now();

    /*
     * Support either:
     *
     * <div data-typing>FULL TEXT</div>
     *
     * or
     *
     * <div data-typing="..."></div>
     */
    const source =
      target.getAttribute(
        "data-typing"
      ) ||
      target.dataset.content ||
      target.textContent ||
      "";

    const text =
      source.replace(
        /\r\n/g,
        "\n"
      );

    /*
     * If HTML contains actual markup,
     * this simple typing engine intentionally
     * treats it as text.
     *
     * The safest option is to put the letter
     * in data-typing or plain text.
     */
    target.textContent = "";

    if (state.reducedMotion) {
      target.textContent = text;
      state.typing.active = false;
      state.typing.completed = true;
      return;
    }

    let index = 0;

    while (
      index < text.length &&
      token === state.typing.token
    ) {
      const character =
        text[index];

      target.textContent +=
        character;

      index++;

      /*
       * Paragraph breathing.
       */
      if (
        character === "\n" &&
        text[index] === "\n"
      ) {
        await sleep(
          CONFIG.typing.paragraphPause
        );
      }

      const delay =
        calculateTypingDelay(
          character,
          text,
          index
        );

      await new Promise(resolve => {
        state.typing.timer =
          window.setTimeout(
            resolve,
            delay
          );
      });

      state.typing.timer = null;

      if (
        index % 12 === 0
      ) {
        scrollTypingTargetIntoView(
          target
        );
      }
    }

    if (
      token !== state.typing.token
    ) {
      return;
    }

    target.textContent = text;

    state.typing.active = false;
    state.typing.completed = true;

    scrollTypingTargetIntoView(
      target
    );
  }


  /* ==========================================================
     12. GENERIC REVEAL INTERACTIONS
     ========================================================== */

  function initializeRevealInteractions() {
    const elements = [];

    CONFIG.selectors.reveal.forEach(
      selector => {
        $$(selector).forEach(
          element => {
            if (!elements.includes(element)) {
              elements.push(element);
            }
          }
        );
      }
    );

    elements.forEach(element => {
      if (
        !element.hasAttribute(
          "aria-expanded"
        )
      ) {
        element.setAttribute(
          "aria-expanded",
          "false"
        );
      }

      const targetSelector =
        element.getAttribute(
          "data-reveal"
        );

      let target = null;

      if (
        targetSelector &&
        targetSelector !== "true"
      ) {
        try {
          target =
            document.querySelector(
              targetSelector
            );
        } catch {
          target = null;
        }
      }

      if (!target) {
        target =
          element.nextElementSibling;
      }

      if (!target) return;

      target.hidden = true;

      element.addEventListener(
        "click",
        event => {
          /*
           * A reveal button should not
           * accidentally navigate.
           */
          event.preventDefault();
          event.stopPropagation();

          const open =
            element.getAttribute(
              "aria-expanded"
            ) === "true";

          if (open) {
            target.hidden = true;

            element.setAttribute(
              "aria-expanded",
              "false"
            );
          } else {
            target.hidden = false;

            element.setAttribute(
              "aria-expanded",
              "true"
            );

            /*
             * Mark that this interaction
             * has actually happened.
             */
            state.interactions.revealed.add(
              target
            );
          }
        }
      );
    });
  }


  /* ==========================================================
     13. BUTTON MICRO-INTERACTION
     ========================================================== */

  function initializeButtonFeedback() {
    const elements =
      $$(
        "button, a, [role='button']"
      );

    elements.forEach(element => {
      /*
       * Keyboard focus is handled by CSS.
       * Here we only provide subtle pressed-state
       * behavior without fighting CSS transitions.
       */

      element.addEventListener(
        "pointerdown",
        () => {
          if (
            !element.hasAttribute(
              "disabled"
            )
          ) {
            element.dataset.pressed =
              "true";
          }
        },
        { passive: true }
      );

      const clearPressed = () => {
        delete element.dataset.pressed;
      };

      element.addEventListener(
        "pointerup",
        clearPressed,
        { passive: true }
      );

      element.addEventListener(
        "pointercancel",
        clearPressed,
        { passive: true }
      );

      element.addEventListener(
        "pointerleave",
        clearPressed,
        { passive: true }
      );

      element.addEventListener(
        "blur",
        clearPressed,
        { passive: true }
      );
    });
  }


  /* ==========================================================
     14. NAVIGATION CLICK HANDLER
     ========================================================== */

  function findNavigationElement(
    eventTarget
  ) {
    if (
      !isElement(eventTarget)
    ) {
      return null;
    }

    /*
     * closest() is critical.
     *
     * This means clicking:
     *
     * <button>
     *   <span>lanjut...</span>
     * </button>
     *
     * still finds the button.
     */
    const element =
      eventTarget.closest(
        CONFIG.selectors.navigation.join(",")
      );

    return element;
  }


  async function handleNavigationClick(
    event
  ) {
    const element =
      findNavigationElement(
        event.target
      );

    if (!element) return;

    /*
     * Do not intercept disabled controls.
     */
    if (
      element.hasAttribute(
        "disabled"
      ) ||
      element.getAttribute(
        "aria-disabled"
      ) === "true"
    ) {
      return;
    }

    /*
     * If the element is explicitly marked
     * as non-navigation, leave it alone.
     */
    if (
      element.hasAttribute(
        "data-no-navigation"
      )
    ) {
      return;
    }

    const target =
      resolveNavigationTarget(
        element
      );

    if (!target) {
      return;
    }

    /*
     * Once JS recognizes it as a scene-navigation
     * element, prevent normal anchor behavior.
     */
    event.preventDefault();

    /*
     * Stop another parent listener from accidentally
     * triggering a second navigation.
     */
    event.stopPropagation();

    /*
     * Touch browsers can sometimes fire click
     * shortly after pointer interactions.
     */
    if (
      Date.now() -
      state.touch.lastTouchEnd <
      350
    ) {
      /*
       * Do not return here.
       *
       * The actual click is still the safest
       * cross-browser navigation event.
       */
    }

    await goToScene(
      target,
      {
        source: "user",
        trigger: element
      }
    );
  }


  /* ==========================================================
     15. KEYBOARD NAVIGATION
     ========================================================== */

  async function handleKeyboardNavigation(
    event
  ) {
    /*
     * Enter / Space on a custom role button.
     */
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    const active =
      document.activeElement;

    if (!active) return;

    if (
      !active.matches(
        "[data-next-scene], [data-scene-target], [data-go-to], [data-target], [data-next], [role='button']"
      )
    ) {
      return;
    }

    const target =
      resolveNavigationTarget(
        active
      );

    if (!target) return;

    event.preventDefault();

    await goToScene(
      target,
      {
        source: "keyboard",
        trigger: active
      }
    );
  }


  /* ==========================================================
     16. TOUCH SAFETY
     ========================================================== */

  function initializeTouchSafety() {
    document.addEventListener(
      "touchstart",
      () => {
        state.touch.lastPointerDown =
          Date.now();
      },
      {
        passive: true
      }
    );

    document.addEventListener(
      "touchend",
      () => {
        state.touch.lastTouchEnd =
          Date.now();
      },
      {
        passive: true
      }
    );

    /*
     * VERY IMPORTANT:
     *
     * There is intentionally NO:
     *
     * touchmove -> change scene
     *
     * and NO:
     *
     * wheel -> change scene
     *
     * Scrolling is reading.
     * Navigation is intentional.
     */
  }


  /* ==========================================================
     17. SCENE LIFECYCLE
     ========================================================== */

  async function beforeLeaveScene(
    sceneNumber,
    targetNumber
  ) {
    /*
     * Scene 8:
     * stop typing when leaving.
     */
    if (sceneNumber === 8) {
      cancelTyping();
    }

    /*
     * Scene 9 → 10:
     * music transition belongs to the threshold
     * rather than to Scene 10's random initialization.
     */
    if (
      sceneNumber === 9 &&
      targetNumber === 10
    ) {
      /*
       * The actual audio transition is executed
       * after the outgoing scene is covered.
       *
       * This prevents the user from visually seeing
       * Scene 10 while music1 is still fading.
       */
    }
  }


  async function afterEnterScene(
    sceneNumber,
    previousScene
  ) {
    /*
     * Scene 1:
     * Nothing automatically plays.
     *
     * Music1 begins only when the user clicks
     * the opening CTA.
     */

    if (sceneNumber === 8) {
      /*
       * Let the scene settle before typing.
       */
      await sleep(
        state.reducedMotion
          ? 0
          : 260
      );

      if (
        state.currentScene !== 8
      ) {
        return;
      }

      typeScene8();
    }

    /*
     * Scene 9:
     * Explicitly ensure music1 is silent.
     */
    if (sceneNumber === 9) {
      /*
       * No music2 yet.
       *
       * Scene 9 is the breathing space.
       */
      if (
        state.audio.music1 &&
        !state.audio.music1.paused
      ) {
        await fadeOutAndStopMusic1();
      }
    }

    /*
     * Scene 10:
     * music2 begins only here.
     */
    if (sceneNumber === 10) {
      /*
       * Ensure music1 cannot survive in background.
       */
      await fadeOutAndStopMusic1();

      await sleep(
        state.reducedMotion
          ? 0
          : CONFIG.audio.musicGap
      );

      if (
        state.currentScene !== 10
      ) {
        return;
      }

      await startMusic2();
    }

    /*
     * Scene-specific reset for internal scroll.
     *
     * Only reset when entering a scene for the first time
     * through navigation. Do not touch document scroll.
     */
    if (sceneNumber !== 8) {
      const scene =
        getScene(sceneNumber);

      /*
       * If the scene itself is scrollable,
       * start at the top.
       */
      if (scene) {
        scene.scrollTop = 0;
      }
    }
  }


  /* ==========================================================
     18. MAIN SCENE ENGINE
     ========================================================== */

  async function goToScene(
    target,
    options = {}
  ) {
    const destination =
      validateSceneTarget(target);

    if (!destination) {
      return false;
    }

    /*
     * Ignore self-navigation unless explicitly forced.
     */
    if (
      destination === state.currentScene &&
      !options.force
    ) {
      return false;
    }

    /*
     * Prevent double-click race conditions.
     */
    if (
      !isNavigationAllowed() &&
      !options.force
    ) {
      return false;
    }

    const previous =
      state.currentScene;

    const outgoing =
      getScene(previous);

    const incoming =
      getScene(destination);

    if (!incoming) {
      return false;
    }

    state.isTransitioning = true;

    state.transitionToken++;

    const token =
      state.transitionToken;

    lockNavigation(
      getTransitionDuration() + 650
    );

    /*
     * Mark outgoing scene.
     */
    if (outgoing) {
      outgoing.dataset.transition =
        "out";
    }

    incoming.dataset.transition =
      "incoming";

    await beforeLeaveScene(
      previous,
      destination
    );

    /*
     * COVER
     */
    await transitionCover(token);

    if (
      token !== state.transitionToken
    ) {
      state.isTransitioning = false;
      return false;
    }

    /*
     * AUDIO RULE:
     *
     * Scene 1 → 2:
     * music1 begins from the user's gesture.
     *
     * Scene 9 → 10:
     * music1 must be fully stopped before music2.
     */
    if (
      previous === 1 &&
      destination === 2
    ) {
      /*
       * Start music1 BEFORE revealing Scene 2.
       *
       * This is still within the original click event
       * chain, so browser autoplay restrictions are
       * satisfied on most browsers.
       */
      startMusic1();
    }

    if (
      previous === 9 &&
      destination === 10
    ) {
      await fadeOutAndStopMusic1();

      await sleep(
        state.reducedMotion
          ? 0
          : CONFIG.audio.musicGap
      );
    }

    /*
     * HIDE OLD SCENE
     */
    if (outgoing) {
      hideScene(outgoing);

      delete outgoing.dataset.transition;
    }

    /*
     * SHOW NEW SCENE
     */
    showScene(incoming);

    state.previousScene =
      previous;

    state.currentScene =
      destination;

    /*
     * Make state visible to CSS.
     */
    document.documentElement.dataset.scene =
      String(destination);

    document.body.dataset.scene =
      String(destination);

    incoming.dataset.transition =
      "active";

    /*
     * Give the DOM one paint cycle.
     */
    await nextFrame();

    if (
      token !== state.transitionToken
    ) {
      return false;
    }

    /*
     * REVEAL
     */
    await transitionReveal(token);

    /*
     * Scene 10 audio:
     * start AFTER music1 has been fully stopped and
     * the visual threshold has happened.
     */
    if (
      destination === 10 &&
      previous === 9
    ) {
      await startMusic2();
    }

    /*
     * Scene-specific lifecycle.
     */
    await afterEnterScene(
      destination,
      previous
    );

    if (
      token !== state.transitionToken
    ) {
      return false;
    }

    delete incoming.dataset.transition;

    state.isTransitioning = false;

    /*
     * Allow a little breathing room before another
     * navigation can happen.
     */
    lockNavigation(
      state.reducedMotion
        ? 180
        : 420
    );

    return true;
  }


  /* ==========================================================
     19. INITIAL SCENE ENTRY
     ========================================================== */

  function initializeInitialScene() {
    const scene =
      getCurrentScene();

    if (!scene) return;

    document.documentElement.dataset.scene =
      String(state.currentScene);

    document.body.dataset.scene =
      String(state.currentScene);

    /*
     * No music.
     */
    stopAllAudio();

    /*
     * No automatic typing until Scene 8 is entered.
     */
  }


  /* ==========================================================
     20. GLOBAL SCENE CLASSES
     * ========================================================== */

  function applySceneState() {
    document.documentElement.dataset.scene =
      String(state.currentScene);

    document.body.dataset.scene =
      String(state.currentScene);

    state.scenes.forEach(scene => {
      const number =
        getSceneId(scene);

      const active =
        number === state.currentScene;

      scene.classList.toggle(
        "is-active",
        active
      );

      scene.classList.toggle(
        "is-before",
        number < state.currentScene
      );

      scene.classList.toggle(
        "is-after",
        number > state.currentScene
      );
    });
  }


  /* ==========================================================
     21. ERROR CONTAINMENT
     ========================================================== */

  function installErrorContainment() {
    /*
     * We do NOT swallow errors.
     *
     * Instead, we expose them in console while making sure
     * a non-critical interaction doesn't destroy the
     * rest of the website.
     */

    window.addEventListener(
      "unhandledrejection",
      event => {
        console.warn(
          "[Bolu Ubi] Unhandled promise rejection:",
          event.reason
        );
      }
    );
  }


  /* ==========================================================
     22. DEBUG API
     ========================================================== */

  function installDebugAPI() {
    /*
     * Useful while developing.
     *
     * Open browser console:
     *
     * BoluUbi.goTo(8)
     * BoluUbi.goTo(9)
     * BoluUbi.goTo(10)
     * BoluUbi.state()
     * BoluUbi.music1()
     * BoluUbi.music2()
     */
    window.BoluUbi = Object.freeze({
      goTo: (scene) =>
        goToScene(
          scene,
          {
            source: "debug",
            force: true
          }
        ),

      next: () =>
        goToScene(
          state.currentScene + 1,
          {
            source: "debug"
          }
        ),

      previous: () =>
        goToScene(
          state.currentScene - 1,
          {
            source: "debug"
          }
        ),

      music1: () =>
        startMusic1(),

      music2: () =>
        startMusic2(),

      stopMusic: () =>
        stopAllAudio(),

      typeLetter: () =>
        typeScene8(),

      cancelTyping: () =>
        cancelTyping(),

      state: () => ({
        currentScene:
          state.currentScene,

        previousScene:
          state.previousScene,

        isTransitioning:
          state.isTransitioning,

        viewport:
          {
            ...state.viewport
          },

        audio:
          {
            active:
              state.audio.active,

            music1Playing:
              !!state.audio.music1 &&
              !state.audio.music1.paused,

            music2Playing:
              !!state.audio.music2 &&
              !state.audio.music2.paused
          },

        typing:
          {
            active:
              state.typing.active,

            completed:
              state.typing.completed
          }
      })
    });
  }


  /* ==========================================================
     23. EVENT INSTALLATION
     ========================================================== */

  function installEvents() {
    /*
     * ONE global click controller.
     *
     * This avoids having 10 different navigation
     * systems fighting each other.
     */
    document.addEventListener(
      "click",
      handleNavigationClick,
      false
    );

    document.addEventListener(
      "keydown",
      handleKeyboardNavigation,
      false
    );

    window.addEventListener(
      "resize",
      handleResize,
      {
        passive: true
      }
    );

    window.addEventListener(
      "orientationchange",
      handleResize,
      {
        passive: true
      }
    );
  }


  /* ==========================================================
     24. OPENING BUTTON SAFETY
     ========================================================== */

  function initializeOpeningFallback() {
    /*
     * Scene 1's button is special.
     *
     * Even if the HTML forgot data-next-scene="2",
     * the opening phrase can still initiate the story.
     *
     * This fallback is intentionally limited to Scene 1.
     */
    const scene1 =
      getScene(1);

    if (!scene1) return;

    const candidates =
      $$(
        "button, a, [role='button']",
        scene1
      );

    candidates.forEach(element => {
      const text =
        (element.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      if (
        !text.includes("bukaa duluuu") &&
        !text.includes("buka dulu")
      ) {
        return;
      }

      /*
       * If no explicit target exists, provide one.
       *
       * We are not adding a second event listener.
       * The global navigation controller will handle it.
       */
      if (
        !getExplicitTarget(element)
      ) {
        element.setAttribute(
          "data-next-scene",
          "2"
        );
      }
    });
  }


  /* ==========================================================
     25. SCENE 8 HARDENING
     ========================================================== */

  function hardenScene8Navigation() {
    const scene8 =
      getScene(8);

    if (!scene8) return;

    /*
     * First priority:
     * explicit data attributes.
     *
     * If a CTA is intended to leave Scene 8,
     * these selectors cover common structures.
     */
    const candidates =
      $$(
        [
          "[data-next-scene]",
          "[data-scene-target]",
          "[data-go-to]",
          "[data-target]",
          "[data-next]",
          "[data-continue]",
          ".continue-scene",
          ".letter-next",
          ".next-scene"
        ].join(","),
        scene8
      );

    candidates.forEach(element => {
      /*
       * If an explicit target exists, respect it.
       */
      if (
        getExplicitTarget(element)
      ) {
        return;
      }

      /*
       * Otherwise a Scene 8 continue control
       * explicitly becomes Scene 9.
       */
      if (
        element.hasAttribute(
          "data-continue"
        ) ||
        element.classList.contains(
          "continue-scene"
        ) ||
        element.classList.contains(
          "letter-next"
        ) ||
        element.classList.contains(
          "next-scene"
        )
      ) {
        element.setAttribute(
          "data-next-scene",
          "9"
        );
      }
    });

    /*
     * Legacy fallback:
     *
     * If there is a button at the bottom of the letter
     * that looks like a continuation CTA but has no class,
     * recognize common wording.
     */
    const buttons =
      $$(
        "button, a, [role='button']",
        scene8
      );

    buttons.forEach(element => {
      if (
        getExplicitTarget(element)
      ) {
        return;
      }

      const text =
        (element.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      if (
        text === "next" ||
        text === "lanjut" ||
        text === "lanjut..." ||
        text.includes("lanjut ke") ||
        text.includes("satu lagi") ||
        text.includes("selanjutnya")
      ) {
        element.setAttribute(
          "data-next-scene",
          "9"
        );
      }
    });
  }


  /* ==========================================================
     26. PREVENT ACCIDENTAL FORM SUBMISSION
     ========================================================== */

  function preventNavigationFormSubmission() {
    /*
     * If a button lives inside a <form>, browser default
     * behavior can reload the page.
     *
     * Scene navigation buttons should never submit forms.
     */
    $$(
      ".scene button"
    ).forEach(button => {
      if (
        !button.hasAttribute("type")
      ) {
        button.setAttribute(
          "type",
          "button"
        );
      }
    });
  }


  /* ==========================================================
     27. ACCESSIBILITY
     ========================================================== */

  function initializeAccessibility() {
    state.reducedMotion =
      prefersReducedMotion();

    document.documentElement.dataset.motion =
      state.reducedMotion
        ? "reduced"
        : "full";

    /*
     * Scene itself should not automatically steal focus.
     *
     * This matters especially on mobile because forcing focus
     * can unexpectedly scroll the browser.
     */
    state.scenes.forEach(scene => {
      if (
        !scene.hasAttribute("tabindex")
      ) {
        scene.setAttribute(
          "tabindex",
          "-1"
        );
      }
    });
  }


  /* ==========================================================
     28. IMAGE SAFETY
     * ========================================================== */

  function initializeImages() {
    $$("img").forEach(image => {
      /*
       * Prevent dragging images from feeling like
       * accidental text selection.
       */
      image.setAttribute(
        "draggable",
        "false"
      );

      image.addEventListener(
        "error",
        () => {
          image.dataset.imageError =
            "true";
        },
        {
          once: true
        }
      );
    });
  }


  /* ==========================================================
     29. INITIALIZATION
     ========================================================== */

  async function initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    updateViewportState();

    state.reducedMotion =
      prefersReducedMotion();

    discoverScenes();

    if (!state.scenes.length) {
      console.error(
        "[Bolu Ubi] Initialization stopped: no scenes found."
      );
      return;
    }

    ensureSceneAttributes();

    initializeAccessibility();

    initializeSceneVisibility();

    initializeAudio();

    initializeRevealInteractions();

    initializeButtonFeedback();

    initializeTouchSafety();

    initializeImages();

    preventNavigationFormSubmission();

    initializeOpeningFallback();

    hardenScene8Navigation();

    installEvents();

    installErrorContainment();

    installDebugAPI();

    initializeInitialScene();

    applySceneState();

    /*
     * Wait one paint so CSS has a chance to settle.
     */
    await nextFrame();

    document.documentElement.dataset.ready =
      "true";

    document.body.dataset.ready =
      "true";

    console.info(
      "[Bolu Ubi] Story engine ready.",
      {
        scenes:
          state.scenes.length,
        currentScene:
          state.currentScene,
        mobile:
          state.viewport.isMobile,
        reducedMotion:
          state.reducedMotion
      }
    );
  }


  /* ==========================================================
     30. DOM READY
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