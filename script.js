/* =========================================================
   BOLU UBI — STORY ENGINE
   ---------------------------------------------------------
   Structure:
   Scene 01 → Opening
   Scene 02 → Birthday / Math
   Scene 03 → Flashback / Timeline
   Scene 04 → Little Things
   Scene 05 → Side Quest / Hydroponics
   Scene 06 → The Girl Behind The Stories
   Scene 07 → Emotional Temperature Shift
   Scene 08 → Birthday Letter
   Scene 09 → Breath
   Scene 10 → Climax / New Chapter

   IMPORTANT:
   - Navigation is CLICK / TAP based.
   - Scrolling never changes scenes.
   - Audio is controlled by scene transitions.
   - Scene 08 → 09 is explicitly protected.
   - Scene 09 → 10 is explicitly protected.
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     01. CONFIGURATION
     ========================================================= */

  const CONFIG = {
    totalScenes: 10,

    selectors: {
      scene: [
        ".scene",
        "[data-scene]",
        "[id^='scene-']",
        "[id^='scene']"
      ],

      navigationButton: [
        "button",
        "a",
        "[role='button']"
      ],

      letter: [
        "[data-letter]",
        ".letter-text",
        ".birthday-letter",
        ".letter-content",
        "#letterText"
      ],

      photo: [
        "img",
        "picture img"
      ]
    },

    audio: {
      fadeInDuration: 1800,
      fadeOutDuration: 1100,
      transitionGap: 180,

      music1: "music1.mp3",
      music2: "music2.mp3",

      music1Volume: 0.34,
      music2Volume: 0.38
    },

    transition: {
      duration: 720,
      coverDuration: 300,
      revealDuration: 420
    },

    typing: {
      baseDelay: 19,
      punctuationExtra: 85,
      commaExtra: 35,
      paragraphPause: 720,
      longPause: 1200,
      emotionalPause: 950
    },

    classes: {
      active: "is-active",
      leaving: "is-leaving",
      entering: "is-entering",
      hidden: "is-hidden",
      disabled: "is-disabled",
      transitionActive: "transition-active",
      reducedMotion: "reduced-motion"
    }
  };


  /* =========================================================
     02. GLOBAL STATE
     ========================================================= */

  const state = {
    initialized: false,

    currentScene: 1,
    previousScene: null,

    isTransitioning: false,
    transitionLockUntil: 0,

    reducedMotion: false,

    letterStarted: false,
    letterFinished: false,

    scene4Revealed: new Set(),
    scene5Opened: new Set(),

    music1Started: false,
    music2Started: false,

    audioTransitioning: false,

    transitionTimer: null,

    resizeTimer: null,

    lastInteractionTime: 0
  };


  /* =========================================================
     03. DOM CACHE
     ========================================================= */

  const DOM = {
    scenes: [],
    sceneMap: new Map(),

    transition: null,
    transitionCurtain: null,

    music1: null,
    music2: null,

    letterTargets: [],

    initialized: false
  };


  /* =========================================================
     04. UTILITY HELPERS
     ========================================================= */

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
    return new Promise(resolve => setTimeout(resolve, ms));
  };


  const isElement = (value) => {
    return value instanceof Element;
  };


  const isButtonLike = (element) => {
    if (!isElement(element)) return false;

    return (
      element.matches("button") ||
      element.matches("a") ||
      element.matches("[role='button']")
    );
  };


  const getSceneNumber = (scene) => {
    if (!scene) return null;

    const explicit = scene.getAttribute("data-scene");

    if (explicit && /^\d+$/.test(explicit)) {
      return Number(explicit);
    }

    const id = scene.id || "";

    let match = id.match(/scene[-_]?(\d+)/i);

    if (match) {
      return Number(match[1]);
    }

    const classMatch = Array.from(scene.classList)
      .join(" ")
      .match(/scene[-_]?(\d+)/i);

    if (classMatch) {
      return Number(classMatch[1]);
    }

    return null;
  };


  const getCurrentSceneElement = () => {
    return DOM.sceneMap.get(state.currentScene) || null;
  };


  const getVisibleScene = () => {
    return (
      DOM.scenes.find(scene => {
        const style = window.getComputedStyle(scene);

        return (
          scene.classList.contains(CONFIG.classes.active) &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }) || getCurrentSceneElement()
    );
  };


  const safeFocus = (element) => {
    if (!element || typeof element.focus !== "function") return;

    try {
      element.focus({
        preventScroll: true
      });
    } catch {
      try {
        element.focus();
      } catch {
        // Intentionally ignored.
      }
    }
  };


  const log = (...args) => {
    if (window.location.hostname === "localhost") {
      console.log("[Bolu Ubi]", ...args);
    }
  };


  const warn = (...args) => {
    console.warn("[Bolu Ubi]", ...args);
  };


  const error = (...args) => {
    console.error("[Bolu Ubi]", ...args);
  };


  /* =========================================================
     05. SCENE DISCOVERY
     ========================================================= */

  function discoverScenes() {
    const candidates = [];

    CONFIG.selectors.scene.forEach(selector => {
      $$(selector).forEach(scene => {
        if (!candidates.includes(scene)) {
          candidates.push(scene);
        }
      });
    });

    const normalized = candidates
      .map(scene => ({
        element: scene,
        number: getSceneNumber(scene)
      }))
      .filter(item => Number.isInteger(item.number))
      .sort((a, b) => a.number - b.number);

    DOM.scenes = normalized.map(item => item.element);
    DOM.sceneMap.clear();

    normalized.forEach(item => {
      DOM.sceneMap.set(item.number, item.element);
    });

    log(
      "Scenes discovered:",
      normalized.map(item => item.number)
    );

    return normalized.length;
  }


  /* =========================================================
     06. SCENE VALIDATION
     ========================================================= */

  function validateSceneStructure() {
    const missing = [];

    for (let i = 1; i <= CONFIG.totalScenes; i++) {
      if (!DOM.sceneMap.has(i)) {
        missing.push(i);
      }
    }

    if (missing.length) {
      warn(
        "Missing scenes:",
        missing.join(", ")
      );
    }

    return missing.length === 0;
  }


  /* =========================================================
     07. ACCESSIBILITY / VISIBILITY
     ========================================================= */

  function setSceneAccessibility(scene, active) {
    if (!scene) return;

    scene.setAttribute(
      "aria-hidden",
      active ? "false" : "true"
    );

    if (!active) {
      scene.setAttribute("inert", "");
    } else {
      scene.removeAttribute("inert");
    }
  }


  function deactivateAllScenes() {
    DOM.scenes.forEach(scene => {
      scene.classList.remove(
        CONFIG.classes.active,
        CONFIG.classes.entering,
        CONFIG.classes.leaving
      );

      setSceneAccessibility(scene, false);
    });
  }


  function activateScene(sceneNumber) {
    const scene = DOM.sceneMap.get(sceneNumber);

    if (!scene) {
      error(
        `Cannot activate Scene ${sceneNumber}: scene not found.`
      );

      return false;
    }

    scene.classList.add(CONFIG.classes.active);
    setSceneAccessibility(scene, true);

    return true;
  }


  /* =========================================================
     08. INITIAL SCENE
     ========================================================= */

  function initializeSceneVisibility() {
    deactivateAllScenes();

    const firstScene = DOM.sceneMap.get(1);

    if (!firstScene) {
      error(
        "Scene 1 was not found. Check your HTML scene IDs/data-scene attributes."
      );

      return false;
    }

    activateScene(1);

    state.currentScene = 1;
    state.previousScene = null;

    return true;
  }


  /* =========================================================
     09. TRANSITION ELEMENT
     ========================================================= */

  function createTransitionElement() {
    let transition = $("#scene-transition");

    if (!transition) {
      transition = document.createElement("div");
      transition.id = "scene-transition";
      transition.setAttribute("aria-hidden", "true");

      transition.innerHTML = `
        <div class="scene-transition__veil"></div>
        <div class="scene-transition__grain"></div>
      `;

      document.body.appendChild(transition);
    }

    DOM.transition = transition;
    DOM.transitionCurtain =
      $(".scene-transition__veil", transition);

    return transition;
  }


  function transitionClass(add = true) {
    if (!DOM.transition) return;

    if (add) {
      DOM.transition.classList.add(
        CONFIG.classes.transitionActive
      );
    } else {
      DOM.transition.classList.remove(
        CONFIG.classes.transitionActive
      );
    }
  }


  async function coverScreen() {
    if (!DOM.transition) return;

    if (state.reducedMotion) {
      transitionClass(true);
      await sleep(80);
      return;
    }

    transitionClass(true);

    await sleep(
      CONFIG.transition.coverDuration
    );
  }


  async function revealScreen() {
    if (!DOM.transition) return;

    if (state.reducedMotion) {
      transitionClass(false);
      return;
    }

    await sleep(
      CONFIG.transition.revealDuration
    );

    transitionClass(false);
  }


  /* =========================================================
     10. AUDIO ENGINE
     ========================================================= */

  function createAudioEngine() {
    if (!DOM.music1) {
      DOM.music1 = new Audio(CONFIG.audio.music1);
      DOM.music1.preload = "auto";
      DOM.music1.loop = true;
      DOM.music1.volume = 0;
    }

    if (!DOM.music2) {
      DOM.music2 = new Audio(CONFIG.audio.music2);
      DOM.music2.preload = "auto";
      DOM.music2.loop = true;
      DOM.music2.volume = 0;
    }

    DOM.music1.setAttribute("aria-hidden", "true");
    DOM.music2.setAttribute("aria-hidden", "true");
  }


  async function playAudioSafely(audio) {
    if (!audio) return false;

    try {
      const result = audio.play();

      if (result && typeof result.then === "function") {
        await result;
      }

      return true;
    } catch (err) {
      warn(
        "Audio playback was blocked or unavailable:",
        err
      );

      return false;
    }
  }


  function setAudioVolume(audio, volume) {
    if (!audio) return;

    audio.volume = clamp(
      Number(volume) || 0,
      0,
      1
    );
  }


  async function fadeAudioIn(
    audio,
    targetVolume,
    duration
  ) {
    if (!audio) return;

    targetVolume = clamp(
      targetVolume,
      0,
      1
    );

    if (state.reducedMotion) {
      setAudioVolume(audio, targetVolume);
      return;
    }

    const startVolume = audio.volume;
    const startTime = performance.now();

    return new Promise(resolve => {
      const step = now => {
        const progress = clamp(
          (now - startTime) / duration,
          0,
          1
        );

        const eased =
          1 - Math.pow(1 - progress, 3);

        audio.volume =
          startVolume +
          (targetVolume - startVolume) *
          eased;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          audio.volume = targetVolume;
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }


  async function fadeAudioOut(
    audio,
    duration
  ) {
    if (!audio) return;

    if (state.reducedMotion) {
      setAudioVolume(audio, 0);
      return;
    }

    const startVolume = audio.volume;
    const startTime = performance.now();

    return new Promise(resolve => {
      const step = now => {
        const progress = clamp(
          (now - startTime) / duration,
          0,
          1
        );

        const eased =
          1 - Math.pow(1 - progress, 3);

        audio.volume =
          startVolume * (1 - eased);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          audio.volume = 0;
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }


  async function startMusic1() {
    if (!DOM.music1) return;

    if (state.music1Started) {
      if (DOM.music1.paused) {
        await playAudioSafely(DOM.music1);
      }

      return;
    }

    state.music1Started = true;

    setAudioVolume(DOM.music1, 0);

    const played = await playAudioSafely(
      DOM.music1
    );

    if (!played) {
      return;
    }

    await fadeAudioIn(
      DOM.music1,
      CONFIG.audio.music1Volume,
      CONFIG.audio.fadeInDuration
    );

    log("music1 started.");
  }


  async function stopMusic1() {
    if (!DOM.music1) return;

    await fadeAudioOut(
      DOM.music1,
      CONFIG.audio.fadeOutDuration
    );

    try {
      DOM.music1.pause();
      DOM.music1.currentTime = 0;
    } catch {
      // Ignore media reset errors.
    }

    state.music1Started = false;

    log("music1 stopped.");
  }


  async function startMusic2() {
    if (!DOM.music2) return;

    if (state.music2Started) {
      if (DOM.music2.paused) {
        await playAudioSafely(DOM.music2);
      }

      return;
    }

    state.music2Started = true;

    setAudioVolume(DOM.music2, 0);

    const played = await playAudioSafely(
      DOM.music2
    );

    if (!played) {
      return;
    }

    await fadeAudioIn(
      DOM.music2,
      CONFIG.audio.music2Volume,
      CONFIG.audio.fadeInDuration
    );

    log("music2 started.");
  }


  async function stopMusic2() {
    if (!DOM.music2) return;

    await fadeAudioOut(
      DOM.music2,
      CONFIG.audio.fadeOutDuration
    );

    try {
      DOM.music2.pause();
      DOM.music2.currentTime = 0;
    } catch {
      // Ignore media reset errors.
    }

    state.music2Started = false;
  }


  async function transitionMusicForScene(
    from,
    to
  ) {
    /*
      Scene 1 → 2
      music1 starts.

      Scene 9 → 10
      music1 FULLY stops first.
      Then music2 starts.
    */

    if (from === 1 && to === 2) {
      await startMusic1();
      return;
    }

    if (from === 9 && to === 10) {
      state.audioTransitioning = true;

      await stopMusic1();

      await sleep(
        CONFIG.audio.transitionGap
      );

      await startMusic2();

      state.audioTransitioning = false;

      return;
    }
  }


  /* =========================================================
     11. NAVIGATION TARGET NORMALIZATION
     ========================================================= */

  function normalizeSceneTarget(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (typeof value === "number") {
      if (
        Number.isInteger(value) &&
        value >= 1 &&
        value <= CONFIG.totalScenes
      ) {
        return value;
      }

      return null;
    }

    let text = String(value).trim();

    if (!text) return null;

    /*
      Supported examples:

      9
      "9"
      "scene-9"
      "#scene-9"
      "scene9"
      "#scene9"
      "Scene 9"
      "scene_9"
    */

    if (/^\d+$/.test(text)) {
      return normalizeSceneTarget(
        Number(text)
      );
    }

    const match = text.match(
      /(?:scene[\s_-]*|#scene[\s_-]*)(\d+)/i
    );

    if (match) {
      return normalizeSceneTarget(
        Number(match[1])
      );
    }

    return null;
  }


  /* =========================================================
     12. EXPLICIT NAVIGATION RESOLUTION
     ========================================================= */

  function resolveExplicitTarget(button) {
    if (!button) return null;

    const attributes = [
      "data-next-scene",
      "data-target-scene",
      "data-scene-target",
      "data-goto",
      "data-target",
      "data-scene"
    ];

    for (const attribute of attributes) {
      const value =
        button.getAttribute(attribute);

      const target =
        normalizeSceneTarget(value);

      if (target) {
        return target;
      }
    }

    const href =
      button.getAttribute("href");

    if (href) {
      const target =
        normalizeSceneTarget(href);

      if (target) {
        return target;
      }
    }

    const id = button.id || "";

    const idTarget =
      normalizeSceneTarget(id);

    if (idTarget) {
      return idTarget;
    }

    return null;
  }


  /* =========================================================
     13. SEMANTIC NAVIGATION RESOLUTION
     ========================================================= */

  function resolveSemanticTarget(
    button,
    currentScene
  ) {
    if (!button) return null;

    const className =
      typeof button.className === "string"
        ? button.className.toLowerCase()
        : "";

    const text =
      (
        button.innerText ||
        button.textContent ||
        ""
      )
        .trim()
        .toLowerCase();

    /*
      BACK
    */

    const looksBack =
      className.includes("back") ||
      className.includes("prev") ||
      className.includes("previous") ||
      text.includes("kembali") ||
      text.includes("balik") ||
      text.includes("back");

    if (looksBack) {
      return currentScene > 1
        ? currentScene - 1
        : null;
    }


    /*
      NEXT / CONTINUE
    */

    const looksNext =
      className.includes("next") ||
      className.includes("continue") ||
      className.includes("proceed") ||
      className.includes("forward") ||
      text.includes("lanjut") ||
      text.includes("selanjutnya") ||
      text.includes("continue") ||
      text.includes("next") ||
      text.includes("buka") ||
      text.includes("mulai");

    if (looksNext) {
      return currentScene < CONFIG.totalScenes
        ? currentScene + 1
        : null;
    }

    return null;
  }


  /* =========================================================
     14. NAVIGATION CONTAINER DETECTION
     ========================================================= */

  function isInsideNavigationContainer(
    button
  ) {
    if (!button) return false;

    const navigationContainers = [
      ".scene-actions",
      ".scene-action",
      ".scene-footer",
      ".scene-navigation",
      ".scene-nav",
      ".navigation",
      ".nav",
      ".actions",
      ".action-area",
      ".next-wrap",
      ".next-button",
      ".continue-wrap",
      ".continue-button",
      ".letter-actions",
      ".letter-navigation",
      ".story-navigation",
      "[data-navigation]",
      "[data-scene-navigation]"
    ];

    return Boolean(
      button.closest(
        navigationContainers.join(",")
      )
    );
  }


  /* =========================================================
     15. CONTROL EXCLUSION
     ========================================================= */

  function isInteractiveContentControl(
    button
  ) {
    if (!button) return false;

    /*
      These controls must NOT accidentally become
      Scene 8 → 9 navigation buttons.
    */

    const protectedContainers = [
      "[data-reveal]",
      "[data-memory]",
      "[data-trait]",
      "[data-hydroponics]",
      ".trait",
      ".trait-card",
      ".memory",
      ".memory-card",
      ".hydroponics",
      ".hydroponic-card",
      ".accordion",
      ".accordion-item",
      ".reveal",
      ".reveal-item",
      ".gallery-control",
      ".photo-control"
    ];

    if (
      button.closest(
        protectedContainers.join(",")
      )
    ) {
      return true;
    }

    const role =
      button.getAttribute("data-role");

    if (
      role === "reveal" ||
      role === "memory" ||
      role === "interactive"
    ) {
      return true;
    }

    return false;
  }


  /* =========================================================
     16. CONTEXTUAL NAVIGATION RESOLUTION
     ========================================================= */

  function resolveContextualTarget(
    button,
    currentScene
  ) {
    if (!button) return null;

    /*
      SCENE 1
      The opening button always goes to Scene 2.
    */

    if (
      currentScene === 1 &&
      !isInteractiveContentControl(button)
    ) {
      return 2;
    }


    /*
      SCENE 8
      This is deliberately deterministic.

      The previous implementation had a structural weakness:
      it tried to infer the target first and returned early
      when inference failed.

      Now Scene 8 navigation is resolved by CONTEXT.

      If a button is inside an actual navigation/action
      container, it means:
          Scene 8 → Scene 9

      If the scene has only one navigation-looking button,
      it also becomes Scene 9.

      Interactive letter/content controls remain protected.
    */

    if (
      currentScene === 8 &&
      !isInteractiveContentControl(button)
    ) {
      if (
        isInsideNavigationContainer(button)
      ) {
        return 9;
      }

      const scene =
        DOM.sceneMap.get(8);

      if (scene) {
        const candidates =
          $$(
            "button, a, [role='button']",
            scene
          ).filter(candidate => {
            if (!candidate.offsetParent) {
              return false;
            }

            if (
              isInteractiveContentControl(
                candidate
              )
            ) {
              return false;
            }

            return true;
          });

        /*
          If only one meaningful button exists
          in Scene 8, it is necessarily the
          "continue" control.
        */

        if (
          candidates.length === 1 &&
          candidates[0] === button
        ) {
          return 9;
        }
      }
    }


    /*
      SCENE 9
      Same deterministic protection.
    */

    if (
      currentScene === 9 &&
      !isInteractiveContentControl(button)
    ) {
      if (
        isInsideNavigationContainer(button)
      ) {
        return 10;
      }

      const scene =
        DOM.sceneMap.get(9);

      if (scene) {
        const candidates =
          $$(
            "button, a, [role='button']",
            scene
          ).filter(candidate => {
            if (!candidate.offsetParent) {
              return false;
            }

            if (
              isInteractiveContentControl(
                candidate
              )
            ) {
              return false;
            }

            return true;
          });

        if (
          candidates.length === 1 &&
          candidates[0] === button
        ) {
          return 10;
        }
      }
    }


    /*
      Generic scene progression.
      Used only when the button is clearly
      part of navigation.
    */

    if (
      isInsideNavigationContainer(button)
    ) {
      if (
        currentScene < CONFIG.totalScenes
      ) {
        return currentScene + 1;
      }
    }

    return null;
  }


  /* =========================================================
     17. MASTER NAVIGATION TARGET RESOLVER
     ========================================================= */

  function resolveNavigationTarget(
    button
  ) {
    if (!button) return null;

    const currentScene =
      state.currentScene;

    /*
      Priority:

      1. Explicit data attribute
      2. Explicit href/id
      3. Semantic class/text
      4. Scene-context fallback
    */

    let target =
      resolveExplicitTarget(button);

    if (target) {
      return target;
    }

    target =
      resolveSemanticTarget(
        button,
        currentScene
      );

    if (target) {
      return target;
    }

    target =
      resolveContextualTarget(
        button,
        currentScene
      );

    if (target) {
      return target;
    }

    return null;
  }


  /* =========================================================
     18. BUTTON DISABLED CHECK
     ========================================================= */

  function isButtonDisabled(button) {
    if (!button) return true;

    if (
      button.disabled === true
    ) {
      return true;
    }

    if (
      button.getAttribute("aria-disabled") ===
      "true"
    ) {
      return true;
    }

    if (
      button.classList.contains(
        CONFIG.classes.disabled
      )
    ) {
      return true;
    }

    return false;
  }


  /* =========================================================
     19. NAVIGATION CLICK HANDLER
     ========================================================= */

  async function handleNavigationClick(
    event
  ) {
    const rawTarget =
      event.target;

    if (!isElement(rawTarget)) {
      return;
    }

    const button =
      rawTarget.closest(
        "button, a, [role='button']"
      );

    if (!button) {
      return;
    }

    /*
      Ignore links that genuinely point
      outside the scene system.
    */

    const href =
      button.getAttribute("href");

    const isExternalHref =
      href &&
      (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      );

    if (isExternalHref) {
      return;
    }

    if (
      button.getAttribute(
        "data-no-scene-navigation"
      ) === "true"
    ) {
      return;
    }

    if (
      isButtonDisabled(button)
    ) {
      event.preventDefault();
      return;
    }

    const target =
      resolveNavigationTarget(button);

    /*
      IMPORTANT:

      Do not do:
          if (!target) return;

      before the contextual fallbacks.

      This was the architectural weakness
      behind the Scene 8 issue.
    */

    if (!target) {
      log(
        "No navigation target found for:",
        button
      );

      return;
    }

    /*
      Prevent normal anchor behavior for
      internal scene navigation.
    */

    if (
      href &&
      (
        href.startsWith("#scene") ||
        href.startsWith("#")
      )
    ) {
      event.preventDefault();
    }

    /*
      Explicit safety correction.
      These two are intentionally absolute.
    */

    let finalTarget = target;

    if (state.currentScene === 8) {
      finalTarget = 9;
    }

    if (state.currentScene === 9) {
      finalTarget = 10;
    }

    /*
      Scene 1 opening gesture:
      start music1 immediately from the
      user's click/tap before browser
      autoplay restrictions can interfere.
    */

    if (
      state.currentScene === 1 &&
      finalTarget === 2
    ) {
      await startMusic1();
    }

    await goToScene(
      finalTarget,
      {
        source: "user"
      }
    );
  }


  /* =========================================================
     20. GLOBAL NAVIGATION BINDING
     ========================================================= */

  function bindNavigationSystem() {
    /*
      ONE delegated listener only.

      This prevents duplicate listeners
      when initialization happens again.
    */

    if (
      document.documentElement.dataset
        .boluNavigationBound === "true"
    ) {
      return;
    }

    document.documentElement.dataset
      .boluNavigationBound = "true";

    document.addEventListener(
      "click",
      event => {
        handleNavigationClick(event)
          .catch(err => {
            error(
              "Navigation error:",
              err
            );
          });
      },
      false
    );
  }


  /* =========================================================
     21. SCENE-SPECIFIC HOOKS
     ========================================================= */

  async function beforeSceneEnter(
    targetScene,
    fromScene
  ) {
    /*
      Audio transitions are handled here,
      BEFORE visual reveal.
    */

    await transitionMusicForScene(
      fromScene,
      targetScene
    );
  }


  async function afterSceneEnter(
    targetScene,
    fromScene
  ) {
    switch (targetScene) {
      case 2:
        onScene2Enter();
        break;

      case 3:
        onScene3Enter();
        break;

      case 4:
        onScene4Enter();
        break;

      case 5:
        onScene5Enter();
        break;

      case 6:
        onScene6Enter();
        break;

      case 7:
        onScene7Enter();
        break;

      case 8:
        onScene8Enter();
        break;

      case 9:
        onScene9Enter();
        break;

      case 10:
        onScene10Enter();
        break;

      default:
        break;
    }
  }


  /* =========================================================
     22. MAIN SCENE TRANSITION
     ========================================================= */

  async function goToScene(
    targetScene,
    options = {}
  ) {
    const normalized =
      normalizeSceneTarget(
        targetScene
      );

    if (!normalized) {
      warn(
        "Invalid scene target:",
        targetScene
      );

      return false;
    }

    if (
      !DOM.sceneMap.has(normalized)
    ) {
      error(
        `Scene ${normalized} does not exist in DOM.`
      );

      return false;
    }

    if (
      normalized === state.currentScene
    ) {
      return false;
    }

    const now =
      performance.now();

    if (
      state.isTransitioning
    ) {
      return false;
    }

    if (
      now < state.transitionLockUntil
    ) {
      return false;
    }

    state.isTransitioning = true;

    state.transitionLockUntil =
      now + CONFIG.transition.duration + 250;

    const fromScene =
      state.currentScene;

    const oldScene =
      DOM.sceneMap.get(fromScene);

    const newScene =
      DOM.sceneMap.get(normalized);

    log(
      `Scene ${fromScene} → Scene ${normalized}`
    );

    try {
      /*
        STEP 1
        Cover screen.
      */

      await coverScreen();


      /*
        STEP 2
        Audio transition while screen
        is covered.
      */

      await beforeSceneEnter(
        normalized,
        fromScene
      );


      /*
        STEP 3
        Deactivate old scene.
      */

      if (oldScene) {
        oldScene.classList.remove(
          CONFIG.classes.active
        );

        oldScene.classList.add(
          CONFIG.classes.leaving
        );

        setSceneAccessibility(
          oldScene,
          false
        );
      }


      /*
        STEP 4
        Activate new scene.
      */

      newScene.classList.remove(
        CONFIG.classes.leaving
      );

      newScene.classList.add(
        CONFIG.classes.entering
      );

      setSceneAccessibility(
        newScene,
        true
      );

      newScene.classList.add(
        CONFIG.classes.active
      );

      state.previousScene =
        fromScene;

      state.currentScene =
        normalized;


      /*
        STEP 5
        Reset scene scroll position.

        IMPORTANT:
        This does NOT bind scroll to navigation.
        It only starts the new scene at the top.
      */

      resetSceneScroll(
        newScene
      );


      /*
        STEP 6
        Scene-specific logic.
      */

      await afterSceneEnter(
        normalized,
        fromScene
      );


      /*
        STEP 7
        Reveal.
      */

      await revealScreen();


      /*
        STEP 8
        Remove transient classes.
      */

      newScene.classList.remove(
        CONFIG.classes.entering
      );

      if (oldScene) {
        oldScene.classList.remove(
          CONFIG.classes.leaving
        );
      }

      updateProgressIndicator();

      state.lastInteractionTime =
        Date.now();

      return true;

    } catch (err) {
      error(
        "Scene transition failed:",
        err
      );

      /*
        Emergency recovery:
        make sure the target scene is visible
        rather than leaving the user behind
        a transition curtain.
      */

      deactivateAllScenes();

      activateScene(
        normalized
      );

      state.currentScene =
        normalized;

      transitionClass(false);

      return false;

    } finally {
      state.isTransitioning = false;
    }
  }


  /* =========================================================
     23. SCENE SCROLL RESET
     ========================================================= */

  function resetSceneScroll(scene) {
    if (!scene) return;

    const scrollTargets = [
      scene,
      $(".scene-content", scene),
      $(".scene-inner", scene),
      $(".scene-scroll", scene),
      $(".letter-scroll", scene)
    ].filter(Boolean);

    scrollTargets.forEach(target => {
      try {
        target.scrollTop = 0;
      } catch {
        // Ignore.
      }
    });
  }


  /* =========================================================
     24. SCENE 2
     ========================================================= */

  function onScene2Enter() {
    const scene =
      DOM.sceneMap.get(2);

    if (!scene) return;

    /*
      Ensure math content gets typeset if
      MathJax exists.

      This is defensive:
      MathJax failure must NOT break the page.
    */

    requestMathTypeset(scene);

    animateSceneElements(
      scene,
      [
        ".equation",
        ".math",
        ".math-display",
        ".scene-text",
        ".sticker",
        "img"
      ]
    );
  }


  function requestMathTypeset(scene) {
    try {
      if (
        window.MathJax &&
        typeof window.MathJax.typesetPromise ===
          "function"
      ) {
        window.MathJax
          .typesetPromise([scene])
          .catch(err => {
            warn(
              "MathJax typeset failed:",
              err
            );
          });
      }
    } catch (err) {
      warn(
        "Math rendering unavailable:",
        err
      );
    }
  }


  /* =========================================================
     25. SCENE 3
     ========================================================= */

  function onScene3Enter() {
    const scene =
      DOM.sceneMap.get(3);

    if (!scene) return;

    animateSceneElements(
      scene,
      [
        ".timeline-item",
        ".timeline-card",
        ".timeline-point",
        ".flashback-line",
        ".scene-text"
      ]
    );

    /*
      Keep timeline details discoverable
      rather than dumping everything at once.
    */

    prepareTimeline(scene);
  }


  function prepareTimeline(scene) {
    const items =
      $$(
        ".timeline-item, .timeline-card",
        scene
      );

    items.forEach((item, index) => {
      item.style.setProperty(
        "--timeline-delay",
        `${index * 90}ms`
      );
    });
  }


  /* =========================================================
     26. SCENE 4 — LITTLE THINGS
     ========================================================= */

  function onScene4Enter() {
    const scene =
      DOM.sceneMap.get(4);

    if (!scene) return;

    bindRevealControls(scene);

    animateSceneElements(
      scene,
      [
        ".trait-card",
        ".trait-item",
        ".detail-card"
      ]
    );
  }


  function bindRevealControls(scene) {
    const controls =
      $$(
        "[data-reveal], [data-trait], .trait-toggle, .plus-button",
        scene
      );

    controls.forEach(control => {
      if (
        control.dataset.boluRevealBound ===
        "true"
      ) {
        return;
      }

      control.dataset.boluRevealBound =
        "true";

      control.addEventListener(
        "click",
        event => {
          /*
            IMPORTANT:
            This is an internal interactive control.
            It must NEVER bubble into Scene navigation.
          */

          event.stopPropagation();

          revealAssociatedContent(
            control
          );
        }
      );
    });
  }


  function revealAssociatedContent(
    control
  ) {
    const explicitTarget =
      control.getAttribute(
        "data-reveal"
      );

    let target = null;

    if (explicitTarget) {
      try {
        target =
          document.querySelector(
            explicitTarget
          );
      } catch {
        target = null;
      }
    }

    if (!target) {
      const parent =
        control.closest(
          "[data-trait], .trait-item, .trait-card, .detail-card"
        );

      if (parent) {
        target =
          $(
            ".trait-detail, .detail, .reveal-content, .trait-description, .hidden-text",
            parent
          );
      }
    }

    if (!target) {
      return;
    }

    const isVisible =
      target.classList.contains(
        "is-visible"
      ) ||
      target.hidden === false;

    if (isVisible) {
      target.classList.remove(
        "is-visible"
      );

      target.hidden = true;

      control.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    target.hidden = false;

    target.classList.add(
      "is-visible"
    );

    control.setAttribute(
      "aria-expanded",
      "true"
    );

    state.scene4Revealed.add(
      target
    );
  }


  /* =========================================================
     27. SCENE 5 — SIDE QUEST
     ========================================================= */

  function onScene5Enter() {
    const scene =
      DOM.sceneMap.get(5);

    if (!scene) return;

    bindHydroponicsControls(scene);

    animateSceneElements(
      scene,
      [
        ".memory-card",
        ".side-quest",
        ".hydroponics-card",
        ".memory-item"
      ]
    );
  }


  function bindHydroponicsControls(
    scene
  ) {
    const controls =
      $$(
        "[data-hydroponics], .hydroponics-toggle, .memory-toggle",
        scene
      );

    controls.forEach(control => {
      if (
        control.dataset.boluMemoryBound ===
        "true"
      ) {
        return;
      }

      control.dataset.boluMemoryBound =
        "true";

      control.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          openMemoryCard(
            control
          );
        }
      );
    });
  }


  function openMemoryCard(control) {
    let target = null;

    const selector =
      control.getAttribute(
        "data-hydroponics"
      ) ||
      control.getAttribute(
        "data-memory"
      );

    if (selector) {
      try {
        target =
          document.querySelector(
            selector
          );
      } catch {
        target = null;
      }
    }

    if (!target) {
      const parent =
        control.closest(
          ".hydroponics-card, .memory-card, .memory-item, [data-memory]"
        );

      if (parent) {
        target =
          $(
            ".memory-detail, .hydroponics-detail, .reveal-content, .memory-body",
            parent
          );
      }
    }

    if (!target) return;

    const open =
      target.classList.contains(
        "is-open"
      ) ||
      target.hidden === false;

    if (open) {
      target.hidden = true;

      target.classList.remove(
        "is-open"
      );

      control.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    target.hidden = false;

    target.classList.add(
      "is-open"
    );

    control.setAttribute(
      "aria-expanded",
      "true"
    );

    state.scene5Opened.add(
      target
    );
  }


  /* =========================================================
     28. SCENE 6 — PHOTO
     ========================================================= */

  function onScene6Enter() {
    const scene =
      DOM.sceneMap.get(6);

    if (!scene) return;

    prepareResponsiveImages(
      scene
    );

    animateSceneElements(
      scene,
      [
        ".photo-frame",
        ".portrait",
        ".photo-caption",
        ".favorite-one",
        ".scene-text"
      ]
    );
  }


  function prepareResponsiveImages(
    scene
  ) {
    const images =
      $$("img", scene);

    images.forEach(image => {
      image.loading = "eager";
      image.decoding = "async";

      image.addEventListener(
        "load",
        () => {
          image.classList.add(
            "is-loaded"
          );
        },
        {
          once: true
        }
      );

      image.addEventListener(
        "error",
        () => {
          image.classList.add(
            "is-missing"
          );

          warn(
            "Image failed to load:",
            image.src
          );
        },
        {
          once: true
        }
      );
    });
  }


  /* =========================================================
     29. SCENE 7
     ========================================================= */

  function onScene7Enter() {
    const scene =
      DOM.sceneMap.get(7);

    if (!scene) return;

    animateSceneElements(
      scene,
      [
        ".transition-copy",
        ".scene-text",
        ".english-line",
        ".quiet-line"
      ]
    );
  }


  /* =========================================================
     30. SCENE 8 — LETTER
     ========================================================= */

  function onScene8Enter() {
    const scene =
      DOM.sceneMap.get(8);

    if (!scene) return;

    prepareLetter(scene);

    if (
      !state.letterStarted
    ) {
      startLetterTyping(scene)
        .catch(err => {
          error(
            "Letter typing failed:",
            err
          );

          revealLetterImmediately(
            scene
          );
        });
    }
  }


  function prepareLetter(scene) {
    DOM.letterTargets = [];

    const possibleTargets = [];

    CONFIG.selectors.letter.forEach(
      selector => {
        $$(selector, scene).forEach(
          element => {
            if (
              !possibleTargets.includes(
                element
              )
            ) {
              possibleTargets.push(
                element
              );
            }
          }
        );
      }
    );

    /*
      If there is a specific letter container,
      use it.

      Otherwise, find the largest text block
      inside the scene that looks like letter content.
    */

    if (possibleTargets.length) {
      DOM.letterTargets =
        possibleTargets;
      return;
    }

    const paragraphs =
      $$(
        "p",
        scene
      );

    const likelyLetter =
      paragraphs.filter(
        p =>
          p.textContent.trim().length > 80
      );

    if (likelyLetter.length) {
      DOM.letterTargets =
        likelyLetter;
    }
  }


  function extractLetterText(element) {
    if (!element) return "";

    /*
      Preserve line breaks if the source
      contains <br>.
    */

    const clone =
      element.cloneNode(true);

    clone
      .querySelectorAll("br")
      .forEach(br => {
        br.replaceWith("\n");
      });

    return (
      clone.textContent || ""
    );
  }


  function setTextPreservingMarkup(
    element,
    text
  ) {
    if (!element) return;

    element.textContent = text;
  }


  function calculateTypingDelay(
    character
  ) {
    let delay =
      CONFIG.typing.baseDelay;

    /*
      Slight natural variation.
    */

    const random =
      Math.random();

    if (random < 0.08) {
      delay += 45;
    } else if (random > 0.93) {
      delay += 90;
    }

    if (
      character === "," ||
      character === ";"
    ) {
      delay +=
        CONFIG.typing.commaExtra;
    }

    if (
      character === "." ||
      character === "!" ||
      character === "?"
    ) {
      delay +=
        CONFIG.typing.punctuationExtra;
    }

    if (
      character === "😭" ||
      character === "🥺" ||
      character === "🤍"
    ) {
      delay += 100;
    }

    return delay;
  }


  function getParagraphPause(
    text,
    index
  ) {
    const previous =
      text[index - 1];

    const current =
      text[index];

    if (
      previous === "\n" &&
      current === "\n"
    ) {
      return CONFIG.typing.longPause;
    }

    if (
      previous === "." ||
      previous === "!" ||
      previous === "?"
    ) {
      return CONFIG.typing.paragraphPause;
    }

    return 0;
  }


  async function typeText(
    element,
    text
  ) {
    if (!element) return;

    element.textContent = "";

    let output = "";

    for (
      let i = 0;
      i < text.length;
      i++
    ) {
      const character =
        text[i];

      output += character;

      element.textContent =
        output;

      const extra =
        getParagraphPause(
          text,
          i
        );

      const delay =
        calculateTypingDelay(
          character
        );

      if (
        state.reducedMotion
      ) {
        await sleep(
          Math.min(delay, 5)
        );
      } else {
        await sleep(
          delay + extra
        );
      }

      /*
        Keep the letter readable while
        typing.

        IMPORTANT:
        This scrolls WITHIN Scene 8.
        It does NOT trigger scene navigation.
      */

      if (
        i % 5 === 0
      ) {
        keepLetterReadable(
          element
        );
      }
    }
  }


  function keepLetterReadable(
    element
  ) {
    if (!element) return;

    const scene =
      element.closest(
        ".scene"
      );

    if (!scene) return;

    const scrollContainer =
      findScrollContainer(
        element,
        scene
      );

    if (!scrollContainer) {
      return;
    }

    const elementRect =
      element.getBoundingClientRect();

    const containerRect =
      scrollContainer.getBoundingClientRect();

    const bottomOverflow =
      elementRect.bottom -
      containerRect.bottom;

    if (
      bottomOverflow > 0
    ) {
      try {
        scrollContainer.scrollBy({
          top:
            bottomOverflow + 40,
          behavior:
            state.reducedMotion
              ? "auto"
              : "smooth"
        });
      } catch {
        scrollContainer.scrollTop +=
          bottomOverflow + 40;
      }
    }
  }


  function findScrollContainer(
    element,
    scene
  ) {
    const candidates = [
      element.closest(
        ".letter-scroll"
      ),
      element.closest(
        ".scene-content"
      ),
      element.closest(
        ".scene-inner"
      ),
      element.closest(
        ".scene-scroll"
      ),
      scene
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;

      const style =
        window.getComputedStyle(
          candidate
        );

      const scrollable =
        /(auto|scroll)/.test(
          style.overflowY
        ) &&
        candidate.scrollHeight >
          candidate.clientHeight;

      if (scrollable) {
        return candidate;
      }
    }

    return scene;
  }


  async function startLetterTyping(
    scene
  ) {
    if (
      state.letterStarted
    ) {
      return;
    }

    state.letterStarted =
      true;

    state.letterFinished =
      false;

    /*
      If no recognized target exists,
      don't break Scene 8.
    */

    if (
      !DOM.letterTargets.length
    ) {
      warn(
        "No letter target found in Scene 8."
      );

      state.letterFinished =
        true;

      return;
    }

    /*
      Hide original content temporarily
      while preserving the actual source.
    */

    for (
      const target of
      DOM.letterTargets
    ) {
      if (
        !target.dataset
          .boluOriginalText
      ) {
        target.dataset
          .boluOriginalText =
          extractLetterText(
            target
          );
      }

      target.textContent = "";

      target.classList.add(
        "is-typing"
      );
    }

    /*
      Type targets sequentially.

      This allows multiple paragraphs
      without one giant mechanical stream.
    */

    for (
      const target of
      DOM.letterTargets
    ) {
      const text =
        target.dataset
          .boluOriginalText ||
        "";

      if (!text.trim()) {
        continue;
      }

      await typeText(
        target,
        text
      );

      if (
        !state.reducedMotion
      ) {
        await sleep(180);
      }
    }

    state.letterFinished =
      true;

    DOM.letterTargets.forEach(
      target => {
        target.classList.remove(
          "is-typing"
        );

        target.classList.add(
          "is-complete"
        );
      }
    );

    /*
      Re-check Scene 8 navigation after
      the letter has finished.

      This is important if the navigation
      button exists below the letter.
    */

    prepareScene8Navigation(
      scene
    );
  }


  function revealLetterImmediately(
    scene
  ) {
    if (!scene) return;

    DOM.letterTargets.forEach(
      target => {
        const text =
          target.dataset
            .boluOriginalText ||
          extractLetterText(
            target
          );

        target.textContent =
          text;

        target.classList.remove(
          "is-typing"
        );

        target.classList.add(
          "is-complete"
        );
      }
    );

    state.letterStarted =
      true;

    state.letterFinished =
      true;
  }


  function prepareScene8Navigation(
    scene
  ) {
    if (!scene) return;

    /*
      We don't attach another click listener.

      The global navigation system handles
      everything.

      We simply mark obvious navigation
      buttons so they are explicit.
    */

    const candidates =
      $$(
        "button, a, [role='button']",
        scene
      );

    candidates.forEach(
      button => {
        if (
          isInteractiveContentControl(
            button
          )
        ) {
          return;
        }

        if (
          isInsideNavigationContainer(
            button
          )
        ) {
          /*
            Do not overwrite an explicit target.
          */

          const explicit =
            resolveExplicitTarget(
              button
            );

          if (!explicit) {
            button.setAttribute(
              "data-next-scene",
              "9"
            );
          }
        }
      }
    );
  }


  /* =========================================================
     31. SCENE 9
     ========================================================= */

  function onScene9Enter() {
    const scene =
      DOM.sceneMap.get(9);

    if (!scene) return;

    /*
      Music1 should already be stopped
      before Scene 9 is revealed.

      This defensive check makes sure
      there is no accidental continuation.
    */

    if (DOM.music1) {
      setAudioVolume(
        DOM.music1,
        0
      );

      if (
        !DOM.music1.paused
      ) {
        try {
          DOM.music1.pause();
        } catch {
          // Ignore.
        }
      }
    }

    animateSceneElements(
      scene,
      [
        ".quiet-line",
        ".breath",
        ".scene-text",
        ".final-pause"
      ]
    );

    prepareScene9Navigation(
      scene
    );
  }


  function prepareScene9Navigation(
    scene
  ) {
    if (!scene) return;

    const candidates =
      $$(
        "button, a, [role='button']",
        scene
      );

    candidates.forEach(
      button => {
        if (
          isInteractiveContentControl(
            button
          )
        ) {
          return;
        }

        if (
          isInsideNavigationContainer(
            button
          )
        ) {
          const explicit =
            resolveExplicitTarget(
              button
            );

          if (!explicit) {
            button.setAttribute(
              "data-next-scene",
              "10"
            );
          }
        }
      }
    );
  }


  /* =========================================================
     32. SCENE 10 — CLIMAX
     ========================================================= */

  function onScene10Enter() {
    const scene =
      DOM.sceneMap.get(10);

    if (!scene) return;

    /*
      Ensure music1 is completely silent.
    */

    if (DOM.music1) {
      setAudioVolume(
        DOM.music1,
        0
      );

      try {
        DOM.music1.pause();
      } catch {
        // Ignore.
      }
    }

    /*
      music2 is normally started by
      transitionMusicForScene() before
      this hook.

      This fallback protects against
      unusual initialization paths.
    */

    if (
      !state.music2Started &&
      !state.reducedMotion
    ) {
      startMusic2().catch(
        err => {
          warn(
            "music2 fallback failed:",
            err
          );
        }
      );
    }

    animateSceneElements(
      scene,
      [
        ".climax",
        ".confession",
        ".answer",
        ".sticker",
        ".epilogue",
        ".new-chapter",
        ".scene-text"
      ]
    );

    prepareClimaxInteraction(
      scene
    );
  }


  function prepareClimaxInteraction(
    scene
  ) {
    const controls =
      $$(
        "[data-climax], [data-answer], .climax-button, .answer-button",
        scene
      );

    controls.forEach(
      control => {
        if (
          control.dataset
            .boluClimaxBound ===
          "true"
        ) {
          return;
        }

        control.dataset
          .boluClimaxBound =
          "true";

        control.addEventListener(
          "click",
          event => {
            /*
              Prevent the global scene
              navigation listener from
              interpreting this as Scene 11.
            */

            event.stopPropagation();

            revealClimaxContent(
              control
            );
          }
        );
      }
    );
  }


  function revealClimaxContent(
    control
  ) {
    const selector =
      control.getAttribute(
        "data-climax"
      ) ||
      control.getAttribute(
        "data-answer"
      );

    let target = null;

    if (selector) {
      try {
        target =
          document.querySelector(
            selector
          );
      } catch {
        target = null;
      }
    }

    if (!target) {
      const parent =
        control.closest(
          ".climax, .confession, .answer-wrap, .climax-content"
        );

      if (parent) {
        target =
          $(
            ".climax-reveal, .answer-reveal, .epilogue, .new-chapter",
            parent
          );
      }
    }

    if (!target) return;

    target.hidden = false;

    target.classList.add(
      "is-visible"
    );

    control.setAttribute(
      "aria-expanded",
      "true"
    );

    /*
      Give the epilogue a little breathing
      room rather than instantly jumping.
    */

    setTimeout(() => {
      try {
        target.scrollIntoView({
          behavior:
            state.reducedMotion
              ? "auto"
              : "smooth",
          block: "center"
        });
      } catch {
        // Ignore.
      }
    }, state.reducedMotion ? 0 : 100);
  }


  /* =========================================================
     33. GENERIC ELEMENT ANIMATION
     ========================================================= */

  function animateSceneElements(
    scene,
    selectors
  ) {
    if (!scene) return;

    let elements = [];

    selectors.forEach(selector => {
      $$(selector, scene).forEach(
        element => {
          if (
            !elements.includes(
              element
            )
          ) {
            elements.push(
              element
            );
          }
        }
      );
    });

    elements.forEach(
      (element, index) => {
        element.style.setProperty(
          "--scene-delay",
          `${index * 55}ms`
        );

        element.classList.add(
          "scene-element"
        );
      }
    );
  }


  /* =========================================================
     34. BUTTON MICRO INTERACTIONS
     ========================================================= */

  function bindButtonMicroInteractions() {
    if (
      document.documentElement.dataset
        .boluButtonEffectsBound ===
      "true"
    ) {
      return;
    }

    document.documentElement.dataset
      .boluButtonEffectsBound =
      "true";

    document.addEventListener(
      "pointerdown",
      event => {
        const target =
          event.target;

        if (
          !isElement(target)
        ) {
          return;
        }

        const button =
          target.closest(
            "button, a, [role='button']"
          );

        if (!button) return;

        button.classList.add(
          "is-pressed"
        );
      },
      true
    );

    document.addEventListener(
      "pointerup",
      event => {
        const target =
          event.target;

        if (
          !isElement(target)
        ) {
          return;
        }

        const button =
          target.closest(
            "button, a, [role='button']"
          );

        if (!button) return;

        setTimeout(() => {
          button.classList.remove(
            "is-pressed"
          );
        }, 90);
      },
      true
    );

    document.addEventListener(
      "pointercancel",
      event => {
        const target =
          event.target;

        if (
          !isElement(target)
        ) {
          return;
        }

        const button =
          target.closest(
            "button, a, [role='button']"
          );

        if (!button) return;

        button.classList.remove(
          "is-pressed"
        );
      },
      true
    );
  }


  /* =========================================================
     35. KEYBOARD NAVIGATION
     ========================================================= */

  function bindKeyboardControls() {
    if (
      document.documentElement.dataset
        .boluKeyboardBound ===
      "true"
    ) {
      return;
    }

    document.documentElement.dataset
      .boluKeyboardBound =
      "true";

    document.addEventListener(
      "keydown",
      event => {
        /*
          Don't interfere with typing,
          textarea, input, contenteditable,
          or other native controls.
        */

        const target =
          event.target;

        if (
          isElement(target) &&
          (
            target.matches(
              "input, textarea, select"
            ) ||
            target.isContentEditable
          )
        ) {
          return;
        }

        if (
          event.key === "Enter"
        ) {
          const active =
            document.activeElement;

          if (
            isButtonLike(active)
          ) {
            active.click();
          }

          return;
        }

        /*
          Arrow navigation is intentionally
          conservative.

          It does NOT activate while the user
          is scrolling a scene.
        */

        if (
          event.key === "ArrowRight"
        ) {
          const current =
            state.currentScene;

          if (
            current < CONFIG.totalScenes
          ) {
            goToScene(
              current + 1,
              {
                source: "keyboard"
              }
            );
          }
        }

        if (
          event.key === "ArrowLeft"
        ) {
          const current =
            state.currentScene;

          if (
            current > 1
          ) {
            goToScene(
              current - 1,
              {
                source: "keyboard"
              }
            );
          }
        }
      }
    );
  }


  /* =========================================================
     36. TOUCH SAFETY
     ========================================================= */

  function bindTouchSafety() {
    /*
      Intentionally NO swipe-to-change-scene.

      Touch scrolling remains completely native.

      This function exists as a deliberate
      architectural marker so future edits
      don't accidentally reintroduce swipe
      navigation.
    */

    document.documentElement.dataset
      .boluTouchNavigation =
      "disabled";
  }


  /* =========================================================
     37. VIEWPORT HANDLING
     ========================================================= */

  function updateViewportUnit() {
    const viewportHeight =
      window.innerHeight;

    document.documentElement.style
      .setProperty(
        "--app-height",
        `${viewportHeight}px`
      );

    document.documentElement.style
      .setProperty(
        "--vh",
        `${viewportHeight * 0.01}px`
      );
  }


  function bindViewportHandling() {
    updateViewportUnit();

    window.addEventListener(
      "resize",
      () => {
        clearTimeout(
          state.resizeTimer
        );

        state.resizeTimer =
          setTimeout(() => {
            updateViewportUnit();
          }, 120);
      },
      {
        passive: true
      }
    );
  }


  /* =========================================================
     38. REDUCED MOTION
     ========================================================= */

  function detectReducedMotion() {
    try {
      state.reducedMotion =
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
    } catch {
      state.reducedMotion =
        false;
    }

    if (
      state.reducedMotion
    ) {
      document.documentElement.classList.add(
        CONFIG.classes.reducedMotion
      );
    } else {
      document.documentElement.classList.remove(
        CONFIG.classes.reducedMotion
      );
    }
  }


  function bindReducedMotionListener() {
    try {
      const media =
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        );

      const handler = () => {
        detectReducedMotion();
      };

      if (
        typeof media.addEventListener ===
        "function"
      ) {
        media.addEventListener(
          "change",
          handler
        );
      } else if (
        typeof media.addListener ===
        "function"
      ) {
        media.addListener(
          handler
        );
      }
    } catch {
      // Ignore.
    }
  }


  /* =========================================================
     39. PROGRESS INDICATOR
     ========================================================= */

  function updateProgressIndicator() {
    const percentage =
      (
        (
          state.currentScene - 1
        ) /
        (
          CONFIG.totalScenes - 1
        )
      ) * 100;

    document.documentElement.style
      .setProperty(
        "--story-progress",
        `${clamp(
          percentage,
          0,
          100
        )}%`
      );

    const indicators =
      $$(
        "[data-scene-progress]"
      );

    indicators.forEach(
      indicator => {
        indicator.textContent =
          `${state.currentScene} / ${CONFIG.totalScenes}`;
      }
    );
  }


  /* =========================================================
     40. IMAGE SAFETY
     ========================================================= */

  function bindGlobalImageSafety() {
    $$("img").forEach(
      image => {
        if (
          image.dataset
            .boluImageSafety ===
          "true"
        ) {
          return;
        }

        image.dataset
          .boluImageSafety =
          "true";

        image.addEventListener(
          "error",
          () => {
            image.classList.add(
              "is-missing"
            );

            warn(
              "Image failed:",
              image.currentSrc ||
              image.src
            );
          }
        );
      }
    );
  }


  /* =========================================================
     41. AUDIO ERROR SAFETY
     ========================================================= */

  function bindAudioSafety() {
    [DOM.music1, DOM.music2]
      .filter(Boolean)
      .forEach(audio => {
        audio.addEventListener(
          "error",
          () => {
            warn(
              "Audio asset could not be loaded:",
              audio.src
            );
          }
        );
      });
  }


  /* =========================================================
     42. SCENE 8 BUTTON HARDENING
     ========================================================= */

  function hardenScene8Button() {
    const scene =
      DOM.sceneMap.get(8);

    if (!scene) return;

    const candidates =
      $$(
        "button, a, [role='button']",
        scene
      );

    /*
      Find buttons that are visibly located
      in navigation/action areas.
    */

    const navigationCandidates =
      candidates.filter(
        button => {
          if (
            isInteractiveContentControl(
              button
            )
          ) {
            return false;
          }

          if (
            isInsideNavigationContainer(
              button
            )
          ) {
            return true;
          }

          const className =
            (
              button.className ||
              ""
            )
              .toString()
              .toLowerCase();

          const text =
            (
              button.innerText ||
              button.textContent ||
              ""
            )
              .trim()
              .toLowerCase();

          return (
            className.includes("next") ||
            className.includes("continue") ||
            text.includes("lanjut") ||
            text.includes("next") ||
            text.includes("continue")
          );
        }
      );

    navigationCandidates.forEach(
      button => {
        const explicit =
          resolveExplicitTarget(
            button
          );

        if (!explicit) {
          button.setAttribute(
            "data-next-scene",
            "9"
          );
        }
      }
    );

    /*
      Absolute fallback:

      If Scene 8 contains exactly one
      non-interactive visible button,
      make it Scene 9.

      This is intentionally done only
      for Scene 8.
    */

    const visibleCandidates =
      candidates.filter(
        button => {
          if (
            isInteractiveContentControl(
              button
            )
          ) {
            return false;
          }

          return (
            button.offsetParent !==
            null
          );
        }
      );

    if (
      visibleCandidates.length === 1
    ) {
      const button =
        visibleCandidates[0];

      const explicit =
        resolveExplicitTarget(
          button
        );

      if (!explicit) {
        button.setAttribute(
          "data-next-scene",
          "9"
        );
      }
    }
  }


  /* =========================================================
     43. SCENE 9 BUTTON HARDENING
     ========================================================= */

  function hardenScene9Button() {
    const scene =
      DOM.sceneMap.get(9);

    if (!scene) return;

    const candidates =
      $$(
        "button, a, [role='button']",
        scene
      );

    const navigationCandidates =
      candidates.filter(
        button => {
          if (
            isInteractiveContentControl(
              button
            )
          ) {
            return false;
          }

          return (
            isInsideNavigationContainer(
              button
            ) ||
            button.className
              .toString()
              .toLowerCase()
              .includes("next") ||
            button.textContent
              .toLowerCase()
              .includes("lanjut")
          );
        }
      );

    navigationCandidates.forEach(
      button => {
        const explicit =
          resolveExplicitTarget(
            button
          );

        if (!explicit) {
          button.setAttribute(
            "data-next-scene",
            "10"
          );
        }
      }
    );
  }


  /* =========================================================
     44. INITIAL HARDENING
     ========================================================= */

  function hardenNavigation() {
    hardenScene8Button();
    hardenScene9Button();
  }


  /* =========================================================
     45. GLOBAL ERROR RECOVERY
     ========================================================= */

  function bindErrorRecovery() {
    window.addEventListener(
      "error",
      event => {
        /*
          We log rather than replacing the entire
          UI with an error screen.

          A single missing image/script dependency
          should not destroy the story.
        */

        error(
          "Runtime error:",
          event.error ||
          event.message
        );

        /*
          If a transition somehow gets stuck,
          release it.
        */

        if (
          state.isTransitioning &&
          DOM.transition
        ) {
          transitionClass(false);
        }
      }
    );

    window.addEventListener(
      "unhandledrejection",
      event => {
        error(
          "Unhandled promise rejection:",
          event.reason
        );

        if (
          state.isTransitioning
        ) {
          transitionClass(false);
        }
      }
    );
  }


  /* =========================================================
     46. PUBLIC DEBUG API
     ========================================================= */

  function exposeDebugAPI() {
    /*
      Useful while developing locally.

      Open console and use:

      BoluUbi.inspect()

      BoluUbi.go(8)

      BoluUbi.music()

      BoluUbi.music2()

      BoluUbi.reset()
    */

    window.BoluUbi = {
      inspect() {
        return {
          currentScene:
            state.currentScene,

          previousScene:
            state.previousScene,

          transitioning:
            state.isTransitioning,

          letterStarted:
            state.letterStarted,

          letterFinished:
            state.letterFinished,

          music1Playing:
            Boolean(
              DOM.music1 &&
              !DOM.music1.paused
            ),

          music2Playing:
            Boolean(
              DOM.music2 &&
              !DOM.music2.paused
            ),

          scenes:
            Array.from(
              DOM.sceneMap.keys()
            )
        };
      },

      go(scene) {
        return goToScene(
          scene,
          {
            source: "debug"
          }
        );
      },

      music() {
        return startMusic1();
      },

      music2() {
        return startMusic2();
      },

      stopMusic() {
        return Promise.all([
          stopMusic1(),
          stopMusic2()
        ]);
      },

      reset() {
        state.currentScene = 1;
        state.previousScene = null;

        state.letterStarted = false;
        state.letterFinished = false;

        state.music1Started = false;
        state.music2Started = false;

        deactivateAllScenes();
        activateScene(1);

        transitionClass(false);

        if (DOM.music1) {
          try {
            DOM.music1.pause();
            DOM.music1.currentTime = 0;
            DOM.music1.volume = 0;
          } catch {
            // Ignore.
          }
        }

        if (DOM.music2) {
          try {
            DOM.music2.pause();
            DOM.music2.currentTime = 0;
            DOM.music2.volume = 0;
          } catch {
            // Ignore.
          }
        }

        updateProgressIndicator();

        return true;
      }
    };
  }


  /* =========================================================
     47. PRELOAD IMPORTANT ASSETS
     ========================================================= */

  function preloadImportantAssets() {
    /*
      Audio
    */

    if (DOM.music1) {
      try {
        DOM.music1.load();
      } catch {
        // Ignore.
      }
    }

    if (DOM.music2) {
      try {
        DOM.music2.load();
      } catch {
        // Ignore.
      }
    }


    /*
      Images
    */

    const importantImages = [
      "stiker1.png",
      "stiker2.png",
      "stiker3.png",
      "stiker4.png",
      "stiker5.png",
      "stiker6.png",
      "photo.jpg"
    ];

    importantImages.forEach(
      src => {
        const image =
          new Image();

        image.src = src;
      }
    );
  }


  /* =========================================================
     48. PAGE TITLE
     ========================================================= */

  function ensureTitle() {
    document.title =
      "Bolu Ubi 🐣";
  }


  /* =========================================================
     49. PREVENT ACCIDENTAL DOUBLE INITIALIZATION
     ========================================================= */

  function isAlreadyInitialized() {
    return (
      document.documentElement.dataset
        .boluInitialized ===
      "true"
    );
  }


  /* =========================================================
     50. MAIN INITIALIZATION
     ========================================================= */

  function initialize() {
    if (
      state.initialized ||
      isAlreadyInitialized()
    ) {
      return;
    }

    state.initialized =
      true;

    document.documentElement.dataset
      .boluInitialized =
      "true";


    /*
      1. Preferences
    */

    detectReducedMotion();
    bindReducedMotionListener();


    /*
      2. Basic page metadata
    */

    ensureTitle();


    /*
      3. Discover scenes
    */

    const sceneCount =
      discoverScenes();

    if (!sceneCount) {
      error(
        "No scenes found. Check the HTML scene structure."
      );

      return;
    }

    validateSceneStructure();


    /*
      4. Transition system
    */

    createTransitionElement();


    /*
      5. Audio
    */

    createAudioEngine();
    bindAudioSafety();


    /*
      6. Initial scene
    */

    const initialized =
      initializeSceneVisibility();

    if (!initialized) {
      return;
    }


    /*
      7. Navigation
    */

    bindNavigationSystem();
    bindButtonMicroInteractions();
    bindKeyboardControls();
    bindTouchSafety();


    /*
      8. Responsive viewport
    */

    bindViewportHandling();


    /*
      9. Images
    */

    bindGlobalImageSafety();


    /*
      10. Error recovery
    */

    bindErrorRecovery();


    /*
      11. Navigation hardening
    */

    hardenNavigation();


    /*
      12. Progress
    */

    updateProgressIndicator();


    /*
      13. Preload
    */

    preloadImportantAssets();


    /*
      14. Debug API
    */

    exposeDebugAPI();


    /*
      15. Final state
    */

    DOM.initialized =
      true;

    log(
      "Bolu Ubi story engine initialized."
    );
  }


  /* =========================================================
     51. BOOT
     ========================================================= */

  if (
    document.readyState ===
    "loading"
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