/* =========================================================
   BOLU UBI 🐣
   ---------------------------------------------------------
   script.js — Complete Interaction & Scene System
   Version: 4.x
   ---------------------------------------------------------
   Design principle:
   HTML  = what the story says
   CSS   = what the story feels like
   JS    = when the story breathes
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     01. CONFIGURATION
     ======================================================= */

  const CONFIG = {
    totalScenes: 10,

    assets: {
      music1: "music1.mp3",
      music2: "music2.mp3",

      stickers: [
        "stiker1.png",
        "stiker2.png",
        "stiker3.png",
        "stiker4.png",
        "stiker5.png",
        "stiker6.png"
      ]
    },

    timing: {
      sceneTransition: 520,

      musicFadeIn: 1800,
      musicFadeOut: 1200,

      typingBase: 22,
      typingVariance: 18,

      paragraphPause: 480,
      sentencePause: 100,

      shortPause: 260,
      longPause: 850
    },

    audio: {
      defaultVolume1: 0.72,
      defaultVolume2: 0.78
    },

    storage: {
      scene: "bolu-ubi-current-scene",
      visited: "bolu-ubi-visited"
    }
  };


  /* =======================================================
     02. GLOBAL STATE
     ======================================================= */

  const state = {
    currentScene: 1,

    isTransitioning: false,

    initialized: false,

    reducedMotion:
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,

    letterStarted: false,
    letterCompleted: false,

    finalStarted: false,
    epilogueShown: false,

    music1Started: false,
    music2Started: false,

    activeAudioTrack: null,

    transitionTimer: null,

    typingAbort: null,

    sceneElements: [],

    visitedScenes: new Set(),

    audio: {
      music1: null,
      music2: null
    }
  };


  /* =======================================================
     03. BASIC UTILITIES
     ======================================================= */

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


  const safeCall = (fn, fallback = null) => {
    try {
      return typeof fn === "function" ? fn() : fallback;
    } catch (error) {
      console.warn("[Bolu Ubi] Safe call failed:", error);
      return fallback;
    }
  };


  const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);


  const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));


  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();


  const isElement = value =>
    value instanceof HTMLElement;


  /* =======================================================
     04. DOCUMENT BOOTSTRAP
     ======================================================= */

  function bootstrapDocument() {
    try {
      document.title = "Bolu Ubi 🐣";
    } catch {
      // Nothing critical.
    }

    document.documentElement.classList.add("bolu-ubi-js");

    if (state.reducedMotion) {
      document.documentElement.classList.add("reduced-motion");
    }
  }


  /* =======================================================
     05. SCENE DISCOVERY
     -------------------------------------------------------
     We intentionally support several possible HTML patterns:

       .scene
       [data-scene]
       #scene-1
       #scene1

     This makes the JS much less fragile.
     ======================================================= */

  function discoverScenes() {
    let scenes = $$(".scene");

    if (!scenes.length) {
      scenes = $$("[data-scene]");
    }

    if (!scenes.length) {
      scenes = Array.from(
        { length: CONFIG.totalScenes },
        (_, index) => {
          const number = index + 1;

          return (
            document.getElementById(`scene-${number}`) ||
            document.getElementById(`scene${number}`)
          );
        }
      ).filter(Boolean);
    }

    /*
     * Remove duplicates while preserving document order.
     */
    scenes = [...new Set(scenes)];

    state.sceneElements = scenes;

    return scenes;
  }


  function getSceneNumber(scene) {
    if (!scene) return null;

    const explicit =
      scene.dataset.scene ||
      scene.dataset.sceneNumber ||
      scene.getAttribute("data-page");

    if (explicit && /^\d+$/.test(String(explicit).trim())) {
      return Number(explicit);
    }

    const id = scene.id || "";

    let match = id.match(/^scene[-_]?(\d+)$/i);

    if (match) {
      return Number(match[1]);
    }

    /*
     * Fallback:
     * if the HTML simply has .scene elements,
     * use their DOM position.
     */
    const index = state.sceneElements.indexOf(scene);

    if (index !== -1) {
      return index + 1;
    }

    return null;
  }


  function getScene(number) {
    const target = Number(number);

    if (!Number.isFinite(target)) return null;

    /*
     * First: use our discovered list.
     */
    const fromList = state.sceneElements.find(
      scene => getSceneNumber(scene) === target
    );

    if (fromList) return fromList;

    /*
     * Second: conventional IDs.
     */
    return (
      document.getElementById(`scene-${target}`) ||
      document.getElementById(`scene${target}`) ||
      document.querySelector(`[data-scene="${target}"]`)
    );
  }


  function getCurrentSceneElement() {
    return getScene(state.currentScene);
  }


  /* =======================================================
     06. SCENE VISIBILITY
     ======================================================= */

  function setSceneVisible(scene, visible) {
    if (!scene) return;

    if (visible) {
      scene.hidden = false;

      scene.classList.add("active");
      scene.classList.add("is-active");
      scene.classList.add("scene-active");

      scene.setAttribute("aria-hidden", "false");

      /*
       * Do not force display:flex/grid/block here.
       * CSS remains responsible for visual layout.
       */
    } else {
      scene.classList.remove("active");
      scene.classList.remove("is-active");
      scene.classList.remove("scene-active");

      scene.setAttribute("aria-hidden", "true");

      /*
       * hidden is useful as a fallback if CSS has no
       * .scene.active rule.
       */
      scene.hidden = true;
    }
  }


  function initializeSceneVisibility() {
    const scenes = state.sceneElements;

    if (!scenes.length) {
      console.warn("[Bolu Ubi] No scenes discovered.");
      return;
    }

    let initialScene = 1;

    /*
     * If an HTML scene already has active/is-active,
     * respect it.
     */
    const existingActive = scenes.find(scene =>
      scene.classList.contains("active") ||
      scene.classList.contains("is-active") ||
      scene.classList.contains("scene-active")
    );

    if (existingActive) {
      initialScene = getSceneNumber(existingActive) || 1;
    }

    /*
     * Only use saved scene if explicitly supported and valid.
     * We intentionally default to Scene 1 on fresh opening.
     */
    const savedScene = Number(
      localStorage.getItem(CONFIG.storage.scene)
    );

    if (
      Number.isFinite(savedScene) &&
      savedScene >= 1 &&
      savedScene <= CONFIG.totalScenes
    ) {
      /*
       * Do NOT automatically jump into the story if the
       * saved scene is > 1.
       *
       * A birthday website should open from its beginning.
       */
      initialScene = existingActive
        ? initialScene
        : 1;
    }

    state.currentScene = initialScene;

    scenes.forEach(scene => {
      const number = getSceneNumber(scene);
      setSceneVisible(scene, number === initialScene);
    });

    state.visitedScenes.add(initialScene);
  }


  /* =======================================================
     07. FOCUS MANAGEMENT
     ======================================================= */

  function focusScene(scene) {
    if (!scene) return;

    const focusTarget =
      scene.querySelector(
        "button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex='-1'])"
      );

    if (!focusTarget) return;

    /*
     * Do not aggressively steal focus from touch devices.
     * Only focus when keyboard navigation is likely.
     */
    if (document.activeElement === document.body) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        focusTarget.focus();
      }
    }
  }


  /* =======================================================
     08. SCROLL RESET
     -------------------------------------------------------
     Important:
     We reset the newly entered scene's internal scroll.
     We NEVER listen to scroll to change scenes.
     ======================================================= */

  function resetSceneScroll(scene) {
    if (!scene) return;

    const scrollContainers = [
      scene,
      scene.querySelector(".scene-content"),
      scene.querySelector(".scene-inner"),
      scene.querySelector(".scene-body"),
      scene.querySelector(".letter-content"),
      scene.querySelector(".letter"),
      scene.querySelector(".content-scroll")
    ].filter(Boolean);

    /*
     * Only reset elements that actually have scrollable
     * overflow / dimensions.
     */
    scrollContainers.forEach(element => {
      try {
        if (element.scrollTop > 0) {
          element.scrollTop = 0;
        }
      } catch {
        // Ignore.
      }
    });
  }


  /* =======================================================
     09. TRANSITION OVERLAY
     -------------------------------------------------------
     Optional overlay. If CSS already contains one, reuse it.
     If not, create a minimal one that won't break layout.
     ======================================================= */

  function getTransitionOverlay() {
    let overlay =
      document.getElementById("scene-transition") ||
      document.querySelector(".scene-transition");

    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "scene-transition";
    overlay.className = "scene-transition";

    overlay.setAttribute("aria-hidden", "true");

    /*
     * Only provide minimal inline behavior.
     * Your CSS remains the authority for appearance.
     */
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      opacity: "0",
      zIndex: "9999",
      transition: "opacity 320ms ease"
    });

    document.body.appendChild(overlay);

    return overlay;
  }


  async function transitionOut() {
    if (state.reducedMotion) return;

    const overlay = getTransitionOverlay();

    if (!overlay) return;

    overlay.classList.add("is-visible");
    overlay.classList.add("active");

    overlay.style.opacity = "1";

    await sleep(180);
  }


  async function transitionIn() {
    if (state.reducedMotion) return;

    const overlay = getTransitionOverlay();

    if (!overlay) return;

    overlay.style.opacity = "0";

    overlay.classList.remove("is-visible");
    overlay.classList.remove("active");

    await sleep(260);
  }


  /* =======================================================
     10. AUDIO ENGINE
     ------------------------------------------------------- */

  function createAudioEngine() {
    if (state.audio.music1 || state.audio.music2) {
      return;
    }

    const music1 = new Audio(CONFIG.assets.music1);
    const music2 = new Audio(CONFIG.assets.music2);

    music1.preload = "auto";
    music2.preload = "auto";

    music1.loop = true;
    music2.loop = true;

    music1.volume = 0;
    music2.volume = 0;

    /*
     * Helps avoid browser retaining unexpected state.
     */
    music1.setAttribute("playsinline", "");
    music2.setAttribute("playsinline", "");

    state.audio.music1 = music1;
    state.audio.music2 = music2;

    /*
     * Errors should never kill the website.
     */
    [music1, music2].forEach(audio => {
      audio.addEventListener("error", event => {
        console.warn(
          "[Bolu Ubi] Audio could not be loaded:",
          audio.src,
          event
        );
      });
    });
  }


  function getAudio(name) {
    createAudioEngine();

    if (name === "music1") {
      return state.audio.music1;
    }

    if (name === "music2") {
      return state.audio.music2;
    }

    return null;
  }


  function fadeAudio(audio, targetVolume, duration) {
    return new Promise(resolve => {
      if (!audio) {
        resolve();
        return;
      }

      targetVolume = clamp(targetVolume, 0, 1);

      if (state.reducedMotion || duration <= 0) {
        audio.volume = targetVolume;
        resolve();
        return;
      }

      const startVolume = Number(audio.volume) || 0;
      const difference = targetVolume - startVolume;

      if (Math.abs(difference) < 0.01) {
        audio.volume = targetVolume;
        resolve();
        return;
      }

      const startTime = performance.now();

      const tick = now => {
        const progress = clamp(
          (now - startTime) / duration,
          0,
          1
        );

        /*
         * Smoothstep easing.
         */
        const eased =
          progress * progress * (3 - 2 * progress);

        audio.volume =
          startVolume + difference * eased;

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          audio.volume = targetVolume;
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }


  async function safelyPlay(audio) {
    if (!audio) return false;

    try {
      await audio.play();
      return true;
    } catch (error) {
      /*
       * Autoplay restrictions or missing asset should not
       * break navigation.
       */
      console.warn(
        "[Bolu Ubi] Audio playback was blocked:",
        error
      );

      return false;
    }
  }


  async function startMusic1() {
    const music1 = getAudio("music1");
    const music2 = getAudio("music2");

    if (!music1) return;

    /*
     * If Music 2 is accidentally playing, stop it first.
     */
    if (music2 && !music2.paused) {
      await stopAudio(music2, CONFIG.timing.musicFadeOut);
    }

    /*
     * Already active.
     */
    if (
      state.activeAudioTrack === "music1" &&
      !music1.paused
    ) {
      return;
    }

    try {
      music1.volume = 0;

      const played = await safelyPlay(music1);

      if (!played) {
        return;
      }

      state.music1Started = true;
      state.activeAudioTrack = "music1";

      await fadeAudio(
        music1,
        CONFIG.audio.defaultVolume1,
        CONFIG.timing.musicFadeIn
      );
    } catch (error) {
      console.warn("[Bolu Ubi] Music 1 error:", error);
    }
  }


  async function stopMusic1() {
    const music1 = getAudio("music1");

    if (!music1) return;

    try {
      if (!music1.paused) {
        await fadeAudio(
          music1,
          0,
          CONFIG.timing.musicFadeOut
        );
      }

      music1.pause();

      /*
       * Reset position so if the story is restarted,
       * music starts naturally from the beginning.
       */
      try {
        music1.currentTime = 0;
      } catch {
        // Ignore.
      }

      if (state.activeAudioTrack === "music1") {
        state.activeAudioTrack = null;
      }
    } catch (error) {
      console.warn("[Bolu Ubi] Music 1 stop error:", error);
    }
  }


  async function startMusic2() {
    const music1 = getAudio("music1");
    const music2 = getAudio("music2");

    if (!music2) return;

    /*
     * HARD RULE:
     * Music 1 must be stopped before Music 2 begins.
     */
    if (music1 && !music1.paused) {
      await stopAudio(
        music1,
        CONFIG.timing.musicFadeOut
      );
    }

    try {
      music2.volume = 0;

      const played = await safelyPlay(music2);

      if (!played) {
        return;
      }

      state.music2Started = true;
      state.activeAudioTrack = "music2";

      await fadeAudio(
        music2,
        CONFIG.audio.defaultVolume2,
        CONFIG.timing.musicFadeIn
      );
    } catch (error) {
      console.warn("[Bolu Ubi] Music 2 error:", error);
    }
  }


  async function stopAudio(audio, duration = 500) {
    if (!audio) return;

    try {
      if (!audio.paused) {
        await fadeAudio(audio, 0, duration);
      }

      audio.pause();

      try {
        audio.currentTime = 0;
      } catch {
        // Ignore.
      }
    } catch (error) {
      console.warn("[Bolu Ubi] stopAudio error:", error);
    }
  }


  async function stopAllAudio() {
    await Promise.all([
      stopAudio(state.audio.music1, 500),
      stopAudio(state.audio.music2, 500)
    ]);

    state.activeAudioTrack = null;
  }


  /* =======================================================
     11. NAVIGATION TARGET RESOLUTION
     -------------------------------------------------------
     THIS IS THE IMPORTANT PART FOR THE BUG YOU EXPERIENCED.

     We support:

       data-next-scene="2"
       data-scene-target="2"
       data-go-to="2"
       data-target="2"
       data-next="2"
       href="#scene-2"

     plus semantic fallback:

       "bukaa duluuu" in Scene 1 -> Scene 2
     ======================================================= */

  function normalizeSceneTarget(rawTarget) {
    if (
      rawTarget === null ||
      rawTarget === undefined ||
      rawTarget === ""
    ) {
      return null;
    }

    const raw = String(rawTarget).trim();

    /*
     * Plain number:
     * "2"
     */
    if (/^\d+$/.test(raw)) {
      const number = Number(raw);

      if (
        number >= 1 &&
        number <= CONFIG.totalScenes
      ) {
        return number;
      }
    }

    /*
     * "#scene-2"
     */
    let match = raw.match(
      /^#?scene[-_]?(\d+)$/i
    );

    if (match) {
      return Number(match[1]);
    }

    /*
     * "scene2"
     */
    match = raw.match(
      /^scene\s*(\d+)$/i
    );

    if (match) {
      return Number(match[1]);
    }

    /*
     * "next"
     */
    if (normalizeText(raw) === "next") {
      return clamp(
        state.currentScene + 1,
        1,
        CONFIG.totalScenes
      );
    }

    /*
     * "previous"
     */
    if (
      normalizeText(raw) === "previous" ||
      normalizeText(raw) === "prev"
    ) {
      return clamp(
        state.currentScene - 1,
        1,
        CONFIG.totalScenes
      );
    }

    return null;
  }


  function inferTargetFromButton(button) {
    if (!button) return null;

    /*
     * 1. Explicit attributes.
     */
    const explicitAttributes = [
      "data-next-scene",
      "data-scene-target",
      "data-go-to",
      "data-target",
      "data-next",
      "data-scene"
    ];

    for (const attribute of explicitAttributes) {
      const value = button.getAttribute(attribute);

      const target = normalizeSceneTarget(value);

      if (target) {
        return target;
      }
    }

    /*
     * 2. href="#scene-2"
     */
    const href = button.getAttribute("href");

    if (href) {
      const target = normalizeSceneTarget(href);

      if (target) {
        return target;
      }
    }

    /*
     * 3. ID conventions.
     */
    const id = button.id || "";

    let idTarget = normalizeSceneTarget(id);

    if (idTarget) {
      return idTarget;
    }

    /*
     * 4. Semantic class conventions.
     */
    const className = button.className || "";

    const classMatch =
      String(className).match(
        /scene[-_]?(\d+)/i
      );

    if (classMatch) {
      return Number(classMatch[1]);
    }

    /*
     * 5. Textual fallbacks.
     *
     * This is deliberately specific.
     */
    const text = normalizeText(button.innerText);

    if (
      text.includes("bukaa duluuu") ||
      text.includes("buka duluuu") ||
      text.includes("buka dulu")
    ) {
      return 2;
    }

    /*
     * Other common next-button language.
     */
    if (
      text === "next" ||
      text.includes("lanjut") ||
      text.includes("lanjutkan") ||
      text.includes("berikutnya")
    ) {
      return clamp(
        state.currentScene + 1,
        1,
        CONFIG.totalScenes
      );
    }

    /*
     * Back buttons.
     */
    if (
      text === "back" ||
      text.includes("kembali") ||
      text.includes("sebelumnya")
    ) {
      return clamp(
        state.currentScene - 1,
        1,
        CONFIG.totalScenes
      );
    }

    return null;
  }


  function isNavigationButton(button) {
    if (!button || !isElement(button)) {
      return false;
    }

    if (
      button.matches(
        "[data-next-scene], [data-scene-target], [data-go-to], [data-target], [data-next], [data-previous], [data-prev]"
      )
    ) {
      return true;
    }

    if (
      button.matches(
        ".next-btn, .scene-next, .next-scene, .js-next, .js-next-scene, .prev-btn, .scene-prev, .js-prev, .navigation-button"
      )
    ) {
      return true;
    }

    const target = inferTargetFromButton(button);

    return Boolean(target);
  }


  /* =======================================================
     12. BUTTON INTERACTION
     -------------------------------------------------------
     ONE delegated listener only.
     No duplicate bindNavigationButtons().
     No capture/bubble hacks layered on top of each other.
     ======================================================= */

  function handleNavigationClick(event) {
    const button = event.target.closest(
      "button, a, [role='button']"
    );

    if (!button) return;

    /*
     * Ignore disabled controls.
     */
    if (
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    /*
     * Ignore links that are clearly external.
     */
    if (
      button.tagName === "A" &&
      button.getAttribute("target") === "_blank"
    ) {
      return;
    }

    const target = inferTargetFromButton(button);

    /*
     * If the element is not a navigation element,
     * leave it alone.
     */
    if (!target) return;

    /*
     * Critical Scene 1 fallback:
     * If this is the opening button, always go to Scene 2.
     */
    const buttonText = normalizeText(
      button.innerText
    );

    const currentSceneElement =
      getCurrentSceneElement();

    const currentNumber =
      getSceneNumber(currentSceneElement);

    const isOpeningButton =
      currentNumber === 1 &&
      (
        buttonText.includes("bukaa duluuu") ||
        buttonText.includes("buka duluuu") ||
        buttonText.includes("buka dulu")
      );

    if (isOpeningButton) {
      event.preventDefault();
      event.stopPropagation();

      /*
       * The click itself is the user gesture.
       * Therefore music1 can safely attempt playback here.
       */
      goToScene(2, {
        source: "scene-1-opening",
        startMusic1: true
      });

      return;
    }

    /*
     * Normal navigation.
     */
    event.preventDefault();

    /*
     * If an <a> is being used as a button, prevent
     * browser hash navigation.
     */
    if (button.tagName === "A") {
      event.stopPropagation();
    }

    const startMusic =
      button.getAttribute("data-start-music");

    const stopMusic =
      button.getAttribute("data-stop-music");

    goToScene(target, {
      source: "button",
      startMusic,
      stopMusic
    });
  }


  function bindNavigationSystem() {
    /*
     * Exactly ONE delegated listener.
     *
     * This is deliberately attached to document rather than
     * querying a specific button collection. Therefore buttons
     * dynamically revealed later can still work.
     */
    document.addEventListener(
      "click",
      handleNavigationClick,
      false
    );
  }


  /* =======================================================
     13. KEYBOARD NAVIGATION
     ======================================================= */

  function bindKeyboardNavigation() {
    document.addEventListener("keydown", event => {
      /*
       * Never hijack keyboard input inside form fields.
       */
      const tag = event.target?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }

      /*
       * Escape does not change scenes.
       */
      if (event.key === "Escape") {
        return;
      }

      /*
       * ArrowRight / Enter:
       * Only Enter when focus is actually on a navigation
       * button. ArrowRight can progress.
       */
      if (event.key === "ArrowRight") {
        event.preventDefault();

        if (!state.isTransitioning) {
          goToScene(
            clamp(
              state.currentScene + 1,
              1,
              CONFIG.totalScenes
            ),
            {
              source: "keyboard"
            }
          );
        }
      }

      /*
       * ArrowLeft:
       * Previous scene.
       */
      if (event.key === "ArrowLeft") {
        event.preventDefault();

        if (!state.isTransitioning) {
          goToScene(
            clamp(
              state.currentScene - 1,
              1,
              CONFIG.totalScenes
            ),
            {
              source: "keyboard"
            }
          );
        }
      }

      /*
       * Enter:
       * Let native button behavior work normally.
       */
      if (event.key === "Enter") {
        const focused = document.activeElement;

        if (
          focused &&
          isNavigationButton(focused)
        ) {
          /*
           * Native click will be generated by browser.
           * Do not call goToScene here to avoid duplicate
           * navigation.
           */
          return;
        }
      }
    });
  }


  /* =======================================================
     14. SCENE TRANSITION HOOKS
     ======================================================= */

  async function beforeLeaveScene(number) {
    /*
     * Scene-specific cleanup.
     */

    if (number === 8) {
      /*
       * We don't forcibly stop typing here.
       * The animation can safely finish in the background,
       * but aborting avoids unnecessary work if leaving early.
       */
      if (state.typingAbort) {
        state.typingAbort();
        state.typingAbort = null;
      }
    }

    /*
     * Scene 9:
     * Music 1 should already be silent.
     */
    if (number === 9) {
      // Intentionally quiet.
    }
  }


  async function afterEnterScene(number, previousNumber) {
    /*
     * Reset internal scroll.
     */
    const scene = getScene(number);

    resetSceneScroll(scene);

    /*
     * Scene 2.
     */
    if (number === 2) {
      prepareScene2();
    }

    /*
     * Scene 3.
     */
    if (number === 3) {
      prepareScene3();
    }

    /*
     * Scene 4.
     */
    if (number === 4) {
      prepareScene4();
    }

    /*
     * Scene 5.
     */
    if (number === 5) {
      prepareScene5();
    }

    /*
     * Scene 6.
     */
    if (number === 6) {
      prepareScene6();
    }

    /*
     * Scene 7.
     */
    if (number === 7) {
      prepareScene7();
    }

    /*
     * Scene 8.
     */
    if (number === 8) {
      prepareScene8();
    }

    /*
     * Scene 9:
     * Make sure Music 1 is OFF.
     */
    if (number === 9) {
      await stopMusic1();
      prepareScene9();
    }

    /*
     * Scene 10:
     * Music 1 must be completely stopped first.
     */
    if (number === 10) {
      await stopMusic1();
      prepareScene10();

      /*
       * Music 2 starts ONLY here.
       */
      await startMusic2();
    }

    /*
     * Opening scene:
     * We deliberately don't start music here.
     */
    if (number === 1) {
      /*
       * If user restarts, stop all music.
       */
      await stopAllAudio();
    }

    /*
     * Keyboard focus.
     */
    setTimeout(() => {
      focusScene(scene);
    }, 80);
  }


  /* =======================================================
     15. MAIN SCENE MANAGER
     ======================================================= */

  async function goToScene(targetNumber, options = {}) {
    const target = normalizeSceneTarget(targetNumber);

    if (!target) {
      console.warn(
        "[Bolu Ubi] Invalid scene target:",
        targetNumber
      );
      return false;
    }

    if (
      target < 1 ||
      target > CONFIG.totalScenes
    ) {
      console.warn(
        "[Bolu Ubi] Scene outside range:",
        target
      );
      return false;
    }

    const targetScene = getScene(target);

    if (!targetScene) {
      console.error(
        `[Bolu Ubi] Scene ${target} was not found in HTML.`
      );

      return false;
    }

    /*
     * Don't transition to the same scene.
     *
     * EXCEPTION:
     * If Scene 1 opening button explicitly asks for
     * music1, allow audio start.
     */
    if (
      target === state.currentScene &&
      !options.startMusic1
    ) {
      return false;
    }

    if (state.isTransitioning) {
      return false;
    }

    state.isTransitioning = true;

    const previousNumber = state.currentScene;
    const previousScene = getScene(previousNumber);

    try {
      /*
       * Mark visited.
       */
      state.visitedScenes.add(target);

      try {
        localStorage.setItem(
          CONFIG.storage.visited,
          JSON.stringify(
            Array.from(state.visitedScenes)
          )
        );
      } catch {
        // localStorage may be blocked.
      }

      /*
       * Before leaving.
       */
      await beforeLeaveScene(previousNumber);

      /*
       * Transition visual.
       */
      await transitionOut();

      /*
       * Scene 1 -> 2 music:
       *
       * The button click enters this function directly,
       * meaning browser gesture context is preserved as much
       * as possible for audio playback.
       */
      if (
        target === 2 &&
        (
          options.startMusic1 === true ||
          options.startMusic === "music1" ||
          options.source === "scene-1-opening"
        )
      ) {
        /*
         * Start BEFORE leaving the page visually so the
         * gesture is associated with playback.
         */
        startMusic1();
      }

      /*
       * Hide previous.
       */
      if (previousScene) {
        setSceneVisible(previousScene, false);
      }

      /*
       * Update state.
       */
      state.currentScene = target;

      try {
        localStorage.setItem(
          CONFIG.storage.scene,
          String(target)
        );
      } catch {
        // Ignore.
      }

      /*
       * Show target.
       */
      setSceneVisible(targetScene, true);

      /*
       * Small browser layout flush.
       */
      void targetScene.offsetHeight;

      /*
       * Enter hook.
       */
      await afterEnterScene(
        target,
        previousNumber
      );

      /*
       * Reveal.
       */
      await transitionIn();

      /*
       * Scene-specific classes can use these hooks.
       */
      document.body.dataset.currentScene =
        String(target);

      document.documentElement.dataset.currentScene =
        String(target);

      /*
       * Dispatch a custom event for optional CSS/HTML logic.
       */
      document.dispatchEvent(
        new CustomEvent("boluubi:scenechange", {
          detail: {
            current: target,
            previous: previousNumber
          }
        })
      );

      return true;
    } catch (error) {
      console.error(
        "[Bolu Ubi] Scene transition error:",
        error
      );

      /*
       * Emergency recovery:
       * ensure target scene is visible.
       */
      try {
        state.currentScene = target;

        if (previousScene) {
          setSceneVisible(previousScene, false);
        }

        setSceneVisible(targetScene, true);

        await transitionIn();
      } catch {
        // Last-resort recovery.
      }

      return false;
    } finally {
      /*
       * Never leave the site permanently locked.
       */
      window.setTimeout(() => {
        state.isTransitioning = false;
      }, state.reducedMotion ? 0 : 80);
    }
  }


  /* =======================================================
     16. SCENE 2 — BIRTHDAY / MATH
     ======================================================= */

  function prepareScene2() {
    const scene = getScene(2);

    if (!scene) return;

    /*
     * Ensure stickers exist if corresponding HTML image
     * elements already exist.
     */
    setupStickerImages(scene);

    /*
     * Mark math container so CSS can animate it.
     */
    const math = scene.querySelector(
      ".math-expression, .equation, .math, [data-math]"
    );

    if (math) {
      math.classList.add("math-ready");
    }

    /*
     * If MathJax happens to be available, ask it to typeset.
     * The site does NOT depend on MathJax for navigation.
     */
    if (
      window.MathJax &&
      typeof window.MathJax.typesetPromise === "function"
    ) {
      try {
        window.MathJax.typesetPromise([scene]);
      } catch (error) {
        console.warn(
          "[Bolu Ubi] MathJax typeset failed:",
          error
        );
      }
    }
  }


  /* =======================================================
     17. STICKER SYSTEM
     ======================================================= */

  function setupStickerImages(root = document) {
    const images = $$("img", root);

    images.forEach(img => {
      const src =
        img.getAttribute("src") || "";

      const lowerSrc = src.toLowerCase();

      /*
       * If HTML already points to sticker assets,
       * add semantic classes automatically.
       */
      const match = lowerSrc.match(
        /stiker([1-6])\.(png|jpg|jpeg|webp)$/i
      );

      if (match) {
        const number = match[1];

        img.classList.add("sticker");
        img.classList.add(
          `sticker-${number}`
        );

        img.setAttribute(
          "data-sticker",
          number
        );

        /*
         * Decorative images should not interfere with
         * keyboard navigation.
         */
        img.setAttribute(
          "aria-hidden",
          "true"
        );

        /*
         * Don't let missing stickers produce ugly
         * broken-image layout.
         */
        img.addEventListener(
          "error",
          () => {
            img.classList.add("asset-missing");
          },
          { once: true }
        );
      }
    });
  }


  /* =======================================================
     18. SCENE 3 — TIMELINE
     ======================================================= */

  function prepareScene3() {
    const scene = getScene(3);

    if (!scene) return;

    const timelineItems = $$(
      ".timeline-item, [data-timeline], .timeline-card",
      scene
    );

    timelineItems.forEach((item, index) => {
      item.style.setProperty(
        "--timeline-index",
        index
      );

      item.classList.add(
        "timeline-ready"
      );
    });

    /*
     * We do not auto-reveal everything with JS.
     * CSS may handle staggered animation.
     */
  }


  /* =======================================================
     19. SCENE 4 — LITTLE DETAILS / TRAITS
     -------------------------------------------------------
     Each "+" button reveals its corresponding detail.
     We support several markup styles.
     ======================================================= */

  function prepareScene4() {
    const scene = getScene(4);

    if (!scene) return;

    const buttons = $$(
      "[data-trait], [data-detail], .trait-trigger, .trait-button, .plus-button, .trait-item button",
      scene
    );

    buttons.forEach((button, index) => {
      if (!button.dataset.traitBound) {
        button.dataset.traitBound = "true";

        button.addEventListener("click", event => {
          event.preventDefault();
          toggleTraitDetail(button, index);
        });
      }
    });
  }


  function findAssociatedDetail(button) {
    if (!button) return null;

    /*
     * Explicit target.
     */
    const target =
      button.dataset.detailTarget ||
      button.dataset.traitTarget ||
      button.getAttribute("aria-controls");

    if (target) {
      const cleanTarget =
        target.startsWith("#")
          ? target.slice(1)
          : target;

      const found =
        document.getElementById(cleanTarget) ||
        document.querySelector(target);

      if (found) return found;
    }

    /*
     * Parent item patterns.
     */
    const parent =
      button.closest(
        ".trait-item, .trait-card, .detail-item, .trait"
      );

    if (parent) {
      return (
        parent.querySelector(
          ".trait-detail, .detail, .trait-copy, .trait-description, [data-detail-content]"
        )
      );
    }

    /*
     * Next sibling fallback.
     */
    let sibling = button.nextElementSibling;

    while (sibling) {
      if (
        sibling.matches(
          ".trait-detail, .detail, .trait-copy, .trait-description, [data-detail-content]"
        )
      ) {
        return sibling;
      }

      sibling = sibling.nextElementSibling;
    }

    return null;
  }


  function toggleTraitDetail(button, index = 0) {
    const detail =
      findAssociatedDetail(button);

    if (!detail) {
      /*
       * Instead of silently doing nothing, still give the
       * button a tactile state.
       */
      button.classList.toggle("is-open");
      button.setAttribute(
        "aria-expanded",
        button.classList.contains("is-open")
          ? "true"
          : "false"
      );

      return;
    }

    const isOpen =
      detail.classList.contains("is-visible") ||
      detail.classList.contains("active") ||
      detail.hidden === false;

    if (isOpen) {
      detail.classList.remove("is-visible");
      detail.classList.remove("active");

      detail.hidden = true;

      button.classList.remove("is-open");
      button.setAttribute(
        "aria-expanded",
        "false"
      );
    } else {
      detail.hidden = false;

      detail.classList.add("is-visible");
      detail.classList.add("active");

      button.classList.add("is-open");
      button.setAttribute(
        "aria-expanded",
        "true"
      );

      /*
       * Subtle custom event.
       */
      detail.dispatchEvent(
        new CustomEvent("boluubi:detailopen", {
          bubbles: true,
          detail: { index }
        })
      );
    }
  }


  /* =======================================================
     20. SCENE 5 — SHARED MEMORY / HYDROPONICS
     ======================================================= */

  function prepareScene5() {
    const scene = getScene(5);

    if (!scene) return;

    const interactiveElements = $$(
      "[data-memory], [data-memory-target], [data-hydroponics], .hydroponics-trigger, .memory-trigger, .sidequest-trigger",
      scene
    );

    interactiveElements.forEach(element => {
      if (element.dataset.memoryBound) {
        return;
      }

      element.dataset.memoryBound = "true";

      element.addEventListener("click", event => {
        event.preventDefault();

        toggleMemoryElement(element);
      });
    });
  }


  function findMemoryTarget(element) {
    if (!element) return null;

    const explicit =
      element.dataset.memoryTarget ||
      element.dataset.target ||
      element.getAttribute("aria-controls");

    if (explicit) {
      const clean =
        explicit.startsWith("#")
          ? explicit.slice(1)
          : explicit;

      return (
        document.getElementById(clean) ||
        document.querySelector(explicit)
      );
    }

    const parent =
      element.closest(
        ".memory-card, .memory-item, .hydroponics, .sidequest, .memory"
      );

    if (parent) {
      return parent.querySelector(
        ".memory-detail, .memory-content, .hydroponics-detail, .sidequest-detail, [data-memory-content]"
      );
    }

    return element.nextElementSibling || null;
  }


  function toggleMemoryElement(element) {
    const target =
      findMemoryTarget(element);

    if (!target) {
      element.classList.toggle("is-open");
      return;
    }

    const opening =
      target.hidden ||
      !target.classList.contains("is-visible");

    if (opening) {
      target.hidden = false;

      target.classList.add("is-visible");
      target.classList.add("active");

      element.classList.add("is-open");

      element.setAttribute(
        "aria-expanded",
        "true"
      );
    } else {
      target.hidden = true;

      target.classList.remove("is-visible");
      target.classList.remove("active");

      element.classList.remove("is-open");

      element.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }


  /* =======================================================
     21. SCENE 6 — PHOTO
     ======================================================= */

  function prepareScene6() {
    const scene = getScene(6);

    if (!scene) return;

    setupStickerImages(scene);

    const photo = scene.querySelector(
      "img[data-photo], .photo-frame img, .portrait img, .photo img, img.photo"
    );

    if (!photo) return;

    photo.setAttribute(
      "loading",
      "eager"
    );

    /*
     * Do not crop the photo.
     */
    photo.style.objectFit = "contain";
    photo.style.maxWidth = "100%";
    photo.style.height = "auto";

    photo.addEventListener(
      "load",
      () => {
        photo.classList.add("photo-loaded");
      },
      { once: true }
    );

    photo.addEventListener(
      "error",
      () => {
        photo.classList.add("photo-error");

        console.warn(
          "[Bolu Ubi] Photo could not be loaded:",
          photo.src
        );
      },
      { once: true }
    );
  }


  /* =======================================================
     22. SCENE 7 — TEMPERATURE SHIFT
     ======================================================= */

  function prepareScene7() {
    const scene = getScene(7);

    if (!scene) return;

    /*
     * A class hook allows CSS to gradually quiet the scene.
     */
    scene.classList.add("serious-transition");

    /*
     * No spoiler logic.
     *
     * The scene should feel like the emotional temperature
     * changed, not like a giant "CONFESSION INCOMING" sign.
     */
  }


  /* =======================================================
     23. SCENE 8 — LONG LETTER
     -------------------------------------------------------
     The letter can be provided in one of these ways:

       [data-letter-source]
       #letter-source
       .letter-source

     OR the visible target can contain data-letter.

     We deliberately avoid hardcoding the entire letter in JS
     so the text remains in HTML and can be edited naturally.
     ======================================================= */

  function findLetterSource(scene) {
    if (!scene) return null;

    return (
      scene.querySelector(
        "[data-letter-source]"
      ) ||
      scene.querySelector(
        "#letter-source"
      ) ||
      scene.querySelector(
        ".letter-source"
      )
    );
  }


  function findLetterTarget(scene) {
    if (!scene) return null;

    return (
      scene.querySelector(
        "[data-letter-target]"
      ) ||
      scene.querySelector(
        "#letter-text"
      ) ||
      scene.querySelector(
        ".letter-text"
      ) ||
      scene.querySelector(
        ".typing-text"
      ) ||
      scene.querySelector(
        ".letter-content"
      )
    );
  }


  function extractLetterText(scene) {
    const source =
      findLetterSource(scene);

    if (source) {
      return (
        source.dataset.letterSource ||
        source.textContent ||
        ""
      ).trim();
    }

    const target =
      findLetterTarget(scene);

    if (!target) return "";

    /*
     * If HTML itself uses data-letter,
     * prefer that.
     */
    if (target.dataset.letter) {
      return target.dataset.letter.trim();
    }

    /*
     * Preserve existing content if no explicit source exists.
     *
     * This is useful if the HTML already contains the full
     * letter and the JS should simply animate it.
     */
    return target.textContent.trim();
  }


  function splitTypingText(text) {
    /*
     * Keep paragraph breaks.
     */
    return text.split(/\n{2,}/g);
  }


  function calculateCharacterDelay(character) {
    if (state.reducedMotion) {
      return 0;
    }

    /*
     * Base human-like typing rhythm.
     */
    let delay =
      CONFIG.timing.typingBase +
      (
        Math.random() *
        CONFIG.timing.typingVariance
      );

    /*
     * Natural punctuation pauses.
     */
    if (/[,.]/.test(character)) {
      delay += CONFIG.timing.shortPause;
    }

    if (/[!?]/.test(character)) {
      delay += 240;
    }

    if (/[—–]/.test(character)) {
      delay += 180;
    }

    return delay;
  }


  function createAbortableTyping() {
    let aborted = false;

    return {
      abort() {
        aborted = true;
      },

      get aborted() {
        return aborted;
      }
    };
  }


  async function typeParagraph(
    target,
    text,
    controller
  ) {
    if (!target) return;

    for (let i = 0; i < text.length; i++) {
      if (controller.aborted) {
        return;
      }

      const character =
        text.charAt(i);

      target.textContent += character;

      /*
       * Keep the latest line visible in long letters.
       * This only scrolls the letter container itself.
       * It does NOT change scenes.
       */
      keepTypingLineVisible(target);

      const delay =
        calculateCharacterDelay(character);

      if (delay > 0) {
        await sleep(delay);
      }
    }
  }


  function keepTypingLineVisible(target) {
    const container =
      target.closest(
        ".letter-content, .letter-scroll, .scene-content, .scene-inner"
      );

    if (!container) return;

    /*
     * Only auto-scroll if the container is genuinely
     * scrollable.
     */
    const canScroll =
      container.scrollHeight >
      container.clientHeight + 10;

    if (!canScroll) return;

    /*
     * Do not aggressively jump the whole scene.
     */
    try {
      const targetBottom =
        target.offsetTop +
        target.offsetHeight;

      const visibleBottom =
        container.scrollTop +
        container.clientHeight;

      if (
        targetBottom >
        visibleBottom - 80
      ) {
        container.scrollTo({
          top:
            targetBottom -
            container.clientHeight +
            100,
          behavior: state.reducedMotion
            ? "auto"
            : "smooth"
        });
      }
    } catch {
      // Ignore.
    }
  }


  async function startLetterTyping() {
    const scene = getScene(8);

    if (!scene) return;

    const target =
      findLetterTarget(scene);

    if (!target) {
      console.warn(
        "[Bolu Ubi] Scene 8 letter target was not found."
      );
      return;
    }

    if (state.letterStarted) {
      return;
    }

    state.letterStarted = true;

    const text =
      extractLetterText(scene);

    if (!text) {
      console.warn(
        "[Bolu Ubi] Scene 8 has no letter text."
      );
      return;
    }

    /*
     * Keep original text so we can restore it if needed.
     */
    if (!target.dataset.originalLetter) {
      target.dataset.originalLetter = text;
    }

    target.textContent = "";

    const controller =
      createAbortableTyping();

    state.typingAbort = controller.abort;

    const paragraphs =
      splitTypingText(text);

    for (
      let paragraphIndex = 0;
      paragraphIndex < paragraphs.length;
      paragraphIndex++
    ) {
      if (controller.aborted) {
        return;
      }

      const paragraph =
        paragraphs[paragraphIndex];

      await typeParagraph(
        target,
        paragraph,
        controller
      );

      if (
        paragraphIndex <
        paragraphs.length - 1
      ) {
        target.appendChild(
          document.createElement("br")
        );

        target.appendChild(
          document.createElement("br")
        );

        if (!state.reducedMotion) {
          await sleep(
            CONFIG.timing.paragraphPause
          );
        }
      }
    }

    if (!controller.aborted) {
      state.letterCompleted = true;
      state.typingAbort = null;

      scene.classList.add(
        "letter-complete"
      );

      document.dispatchEvent(
        new CustomEvent(
          "boluubi:lettercomplete"
        )
      );
    }
  }


  function prepareScene8() {
    const scene = getScene(8);

    if (!scene) return;

    /*
     * This class tells CSS that Scene 8 is a long-form
     * reading scene.
     */
    scene.classList.add("long-form-scene");

    /*
     * IMPORTANT:
     * No scroll listener is attached.
     */
    if (!state.letterStarted) {
      /*
       * Small pause before typing starts.
       */
      if (state.reducedMotion) {
        startLetterTyping();
      } else {
        window.setTimeout(() => {
          if (
            state.currentScene === 8
          ) {
            startLetterTyping();
          }
        }, 420);
      }
    }
  }


  /* =======================================================
     24. SCENE 9 — BREATH
     ======================================================= */

  function prepareScene9() {
    const scene = getScene(9);

    if (!scene) return;

    scene.classList.add("quiet-scene");

    /*
     * Music 1 is stopped by afterEnterScene().
     *
     * Scene 9 intentionally doesn't autoplay anything.
     */
  }


  /* =======================================================
     25. SCENE 10 — CLIMAX / AFTERGLOW
     ======================================================= */

  function prepareScene10() {
    const scene = getScene(10);

    if (!scene) return;

    setupStickerImages(scene);

    scene.classList.add("climax-scene");

    /*
     * Prevent repeated initialization.
     */
    if (scene.dataset.climaxPrepared === "true") {
      return;
    }

    scene.dataset.climaxPrepared = "true";

    /*
     * Find possible climax interaction.
     */
    const climaxTriggers = $$(
      "[data-climax], [data-confession], .climax-button, .confession-button, .continue-after-confession",
      scene
    );

    climaxTriggers.forEach(trigger => {
      trigger.addEventListener(
        "click",
        event => {
          event.preventDefault();

          revealClimaxResponse(trigger);
        }
      );
    });

    /*
     * Epilogue triggers.
     */
    const epilogueTriggers = $$(
      "[data-epilogue], .epilogue-button, .continue-button",
      scene
    );

    epilogueTriggers.forEach(trigger => {
      trigger.addEventListener(
        "click",
        event => {
          event.preventDefault();

          revealEpilogue();
        }
      );
    });
  }


  function revealClimaxResponse(trigger) {
    const scene = getScene(10);

    if (!scene) return;

    state.finalStarted = true;

    scene.classList.add(
      "climax-response-visible"
    );

    if (trigger) {
      trigger.classList.add("used");

      trigger.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    /*
     * Reveal possible response blocks.
     */
    const responses = $$(
      "[data-climax-response], .climax-response, .final-response",
      scene
    );

    responses.forEach(response => {
      response.hidden = false;

      response.classList.add(
        "is-visible",
        "active"
      );
    });

    /*
     * Reveal epilogue gate if one exists.
     */
    const gates = $$(
      "[data-show-after-climax], .after-climax, .epilogue-gate",
      scene
    );

    gates.forEach(gate => {
      gate.hidden = false;

      gate.classList.add(
        "is-visible",
        "active"
      );
    });

    /*
     * Dispatch event for optional external behavior.
     */
    document.dispatchEvent(
      new CustomEvent(
        "boluubi:climax",
        {
          detail: {
            scene: 10
          }
        }
      )
    );
  }


  function revealEpilogue() {
    const scene = getScene(10);

    if (!scene) return;

    state.epilogueShown = true;

    scene.classList.add(
      "epilogue-visible"
    );

    const epilogue =
      scene.querySelector(
        "[data-epilogue-content], .epilogue-content, .epilogue"
      );

    if (epilogue) {
      epilogue.hidden = false;

      epilogue.classList.add(
        "is-visible",
        "active"
      );

      /*
       * Scroll ONLY inside the scene if needed.
       */
      try {
        epilogue.scrollIntoView({
          behavior: state.reducedMotion
            ? "auto"
            : "smooth",
          block: "center"
        });
      } catch {
        // Ignore.
      }
    }

    document.dispatchEvent(
      new CustomEvent(
        "boluubi:epilogue",
        {
          detail: {
            scene: 10
          }
        }
      )
    );
  }


  /* =======================================================
     26. GENERIC REVEAL SYSTEM
     -------------------------------------------------------
     Useful for elements like:

       data-reveal
       data-toggle
       data-reveal-target
     ======================================================= */

  function bindGenericRevealSystem() {
    document.addEventListener(
      "click",
      event => {
        const trigger =
          event.target.closest(
            "[data-reveal]"
          );

        if (!trigger) return;

        const targetSelector =
          trigger.dataset.revealTarget ||
          trigger.getAttribute(
            "aria-controls"
          );

        let target = null;

        if (targetSelector) {
          const clean =
            targetSelector.startsWith("#")
              ? targetSelector.slice(1)
              : targetSelector;

          target =
            document.getElementById(clean) ||
            document.querySelector(
              targetSelector
            );
        }

        if (!target) {
          target =
            trigger.nextElementSibling;
        }

        if (!target) return;

        const isOpen =
          !target.hidden &&
          target.classList.contains(
            "is-visible"
          );

        if (isOpen) {
          target.hidden = true;

          target.classList.remove(
            "is-visible",
            "active"
          );

          trigger.classList.remove(
            "is-open"
          );

          trigger.setAttribute(
            "aria-expanded",
            "false"
          );
        } else {
          target.hidden = false;

          target.classList.add(
            "is-visible",
            "active"
          );

          trigger.classList.add(
            "is-open"
          );

          trigger.setAttribute(
            "aria-expanded",
            "true"
          );
        }
      }
    );
  }


  /* =======================================================
     27. PRESS / MICRO-INTERACTION
     -------------------------------------------------------
     Buttons get tactile feedback without requiring hover.
     ======================================================= */

  function bindButtonMicroInteractions() {
    document.addEventListener(
      "pointerdown",
      event => {
        const button =
          event.target.closest(
            "button, [role='button'], .clickable"
          );

        if (!button) return;

        button.classList.add(
          "is-pressing"
        );
      },
      { passive: true }
    );

    const removePress = event => {
      const button =
        event.target.closest(
          "button, [role='button'], .clickable"
        );

      if (!button) return;

      button.classList.remove(
        "is-pressing"
      );
    };

    document.addEventListener(
      "pointerup",
      removePress,
      { passive: true }
    );

    document.addEventListener(
      "pointercancel",
      removePress,
      { passive: true }
    );

    document.addEventListener(
      "pointerleave",
      removePress,
      { passive: true }
    );
  }


  /* =======================================================
     28. TOUCH SAFETY
     -------------------------------------------------------
     We intentionally DO NOT convert swipes into scene
     navigation.
     ======================================================= */

  function bindTouchSafety() {
    /*
     * No swipe navigation.
     *
     * This function only prevents accidental double-tap
     * zoom on certain interactive controls when appropriate.
     * We do NOT globally prevent touch scrolling.
     */

    document.addEventListener(
      "touchstart",
      event => {
        const target =
          event.target.closest(
            "button, [role='button']"
          );

        if (!target) return;

        target.classList.add(
          "touch-active"
        );
      },
      { passive: true }
    );

    document.addEventListener(
      "touchend",
      event => {
        const target =
          event.target.closest(
            "button, [role='button']"
          );

        if (!target) return;

        target.classList.remove(
          "touch-active"
        );
      },
      { passive: true }
    );
  }


  /* =======================================================
     29. RESIZE / VIEWPORT
     ======================================================= */

  function updateViewportVariables() {
    const viewportHeight =
      window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;

    document.documentElement.style.setProperty(
      "--viewport-height",
      `${viewportHeight}px`
    );
  }


  function bindViewportEvents() {
    updateViewportVariables();

    let resizeTimer = null;

    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {
          updateViewportVariables();
        }, 100);
      },
      { passive: true }
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        updateViewportVariables,
        { passive: true }
      );
    }
  }


  /* =======================================================
     30. IMAGE ERROR SAFETY
     ======================================================= */

  function bindImageSafety() {
    document.addEventListener(
      "error",
      event => {
        const image = event.target;

        if (
          !image ||
          image.tagName !== "IMG"
        ) {
          return;
        }

        image.classList.add(
          "asset-error"
        );

        /*
         * Don't replace the image source with a
         * fabricated fallback. Let CSS handle the visual
         * treatment.
         */
      },
      true
    );
  }


  /* =======================================================
     31. AUDIO UNLOCK / USER GESTURE SUPPORT
     -------------------------------------------------------
     Some browsers are stricter than others.

     We don't start music here automatically.
     We only make sure audio objects exist.
     ======================================================= */

  function prepareAudio() {
    createAudioEngine();

    /*
     * Preload metadata.
     */
    const music1 = state.audio.music1;
    const music2 = state.audio.music2;

    if (music1) {
      music1.load();
    }

    if (music2) {
      music2.load();
    }
  }


  /* =======================================================
     32. DEBUG API
     -------------------------------------------------------
     Helpful during development without affecting normal use.
     ======================================================= */

  function exposeDebugAPI() {
    window.BoluUbi = {
      state,

      goToScene,

      startMusic1,
      stopMusic1,

      startMusic2,

      stopAllAudio,

      revealClimaxResponse,
      revealEpilogue,

      getCurrentScene: () =>
        state.currentScene,

      getScene,

      getSceneNumber
    };
  }


  /* =======================================================
     33. OPTIONAL PROGRESS INDICATOR
     -------------------------------------------------------
     If HTML contains any of these, update them automatically.
     ======================================================= */

  function updateProgressIndicators() {
    const percentage =
      (
        (state.currentScene - 1) /
        Math.max(
          CONFIG.totalScenes - 1,
          1
        )
      ) * 100;

    const progressBars = $$(
      "[data-scene-progress], .scene-progress-bar, .progress-fill"
    );

    progressBars.forEach(bar => {
      bar.style.setProperty(
        "--scene-progress",
        `${percentage}%`
      );

      if (
        bar.matches(
          "progress"
        )
      ) {
        bar.value = percentage;
      } else {
        bar.style.width =
          `${percentage}%`;
      }
    });

    const counters = $$(
      "[data-scene-counter], .scene-counter"
    );

    counters.forEach(counter => {
      counter.textContent =
        `${state.currentScene} / ${CONFIG.totalScenes}`;
    });
  }


  function bindProgressUpdates() {
    document.addEventListener(
      "boluubi:scenechange",
      updateProgressIndicators
    );

    updateProgressIndicators();
  }


  /* =======================================================
     34. ACCESSIBILITY
     ======================================================= */

  function prepareAccessibility() {
    const scenes = state.sceneElements;

    scenes.forEach(scene => {
      if (!scene.hasAttribute("role")) {
        scene.setAttribute(
          "role",
          "region"
        );
      }

      if (!scene.hasAttribute("tabindex")) {
        scene.setAttribute(
          "tabindex",
          "-1"
        );
      }
    });

    /*
     * Ensure buttons have an accessible role naturally.
     */
    $$("button").forEach(button => {
      if (!button.getAttribute("aria-label")) {
        const text =
          button.innerText.trim();

        if (text) {
          button.setAttribute(
            "aria-label",
            text
          );
        }
      }
    });
  }


  /* =======================================================
     35. REDUCED MOTION
     ======================================================= */

  function bindReducedMotionWatcher() {
    if (
      !window.matchMedia
    ) {
      return;
    }

    const media =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

    const update = event => {
      state.reducedMotion =
        event.matches;

      document.documentElement.classList.toggle(
        "reduced-motion",
        state.reducedMotion
      );
    };

    try {
      media.addEventListener(
        "change",
        update
      );
    } catch {
      /*
       * Older Safari.
       */
      try {
        media.addListener(update);
      } catch {
        // Ignore.
      }
    }
  }


  /* =======================================================
     36. SAFE INITIAL SCENE SETUP
     ======================================================= */

  function finalizeInitialScene() {
    const scene =
      getCurrentSceneElement();

    if (!scene) return;

    document.body.dataset.currentScene =
      String(state.currentScene);

    document.documentElement.dataset.currentScene =
      String(state.currentScene);

    /*
     * Scene 1 should be completely silent.
     */
    if (state.currentScene === 1) {
      stopAllAudio();
    }

    /*
     * Prepare only the visible scene.
     */
    if (state.currentScene === 2) {
      prepareScene2();
    }

    if (state.currentScene === 3) {
      prepareScene3();
    }

    if (state.currentScene === 4) {
      prepareScene4();
    }

    if (state.currentScene === 5) {
      prepareScene5();
    }

    if (state.currentScene === 6) {
      prepareScene6();
    }

    if (state.currentScene === 7) {
      prepareScene7();
    }

    if (state.currentScene === 8) {
      prepareScene8();
    }

    if (state.currentScene === 9) {
      prepareScene9();
    }

    if (state.currentScene === 10) {
      prepareScene10();
    }
  }


  /* =======================================================
     37. INITIALIZATION
     ======================================================= */

  function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    /*
     * Order matters.
     */

    bootstrapDocument();

    discoverScenes();

    if (!state.sceneElements.length) {
      console.error(
        "[Bolu Ubi] Tidak ditemukan scene di HTML."
      );

      return;
    }

    initializeSceneVisibility();

    prepareAudio();

    setupStickerImages();

    prepareAccessibility();

    bindNavigationSystem();

    bindKeyboardNavigation();

    bindGenericRevealSystem();

    bindButtonMicroInteractions();

    bindTouchSafety();

    bindViewportEvents();

    bindImageSafety();

    bindProgressUpdates();

    bindReducedMotionWatcher();

    finalizeInitialScene();

    exposeDebugAPI();

    /*
     * Global ready event.
     */
    document.dispatchEvent(
      new CustomEvent(
        "boluubi:ready",
        {
          detail: {
            scene: state.currentScene
          }
        }
      )
    );

    console.info(
      "%cBolu Ubi 🐣",
      "font-size:18px;font-weight:bold;"
    );

    console.info(
      "[Bolu Ubi] Story system ready."
    );

    console.info(
      `[Bolu Ubi] Current scene: ${state.currentScene}`
    );
  }


  /* =======================================================
     38. DOM READY
     ======================================================= */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }


  /* =======================================================
     39. FAILSAFE
     -------------------------------------------------------
     If some unrelated initialization error occurs, do NOT
     leave the user with an empty page.
     ======================================================= */

  window.addEventListener(
    "error",
    event => {
      console.warn(
        "[Bolu Ubi] Runtime error:",
        event.error || event.message
      );

      /*
       * We intentionally don't manipulate scenes here.
       * A local component failure must not cause destructive
       * recovery that hides the entire story.
       */
    }
  );


  window.addEventListener(
    "unhandledrejection",
    event => {
      console.warn(
        "[Bolu Ubi] Promise rejection:",
        event.reason
      );
    }
  );

})();