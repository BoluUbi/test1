/* ============================================================
   BOLU UBI 🐣
   script.js — COMPLETE STORY ENGINE
   ------------------------------------------------------------
   Architecture:
   1. Scene state manager
   2. Robust navigation resolver
   3. Audio state machine
   4. Scene-specific interactions
   5. Letter typing engine
   6. Memory / trait / hydroponics interactions
   7. Climax + epilogue
   8. Accessibility + reduced motion
   9. Defensive DOM handling
   10. Mobile / desktop safe behavior

   IMPORTANT:
   - Scene changes happen by CLICK/TAP.
   - Scrolling NEVER changes scenes.
   - Scene 1 -> Scene 2 starts music1.mp3.
   - Scene 9 -> Scene 10 fully stops music1 and starts music2.
   ============================================================ */

(() => {
  "use strict";

  /* ============================================================
     0. GLOBAL CONFIG
     ============================================================ */

  const CONFIG = {
    TOTAL_SCENES: 10,

    SELECTORS: {
      scene: [
        ".scene",
        "[data-scene]",
        "[id^='scene-']",
        "[id^='scene']"
      ],

      navigationButton: [
        "[data-scene-target]",
        "[data-go-to]",
        "[data-target-scene]",
        "[data-next-scene]",
        "[data-next]",
        "[data-previous]",
        "[data-prev]",
        ".scene-next",
        ".scene-prev",
        ".next-scene",
        ".prev-scene",
        ".js-next",
        ".js-prev",
        "button"
      ].join(",")
    },

    AUDIO: {
      music1: "music1.mp3",
      music2: "music2.mp3",

      music1Volume: 0.48,
      music2Volume: 0.56,

      fadeInDuration: 1800,
      fadeOutDuration: 1400,

      fadeStep: 40
    },

    TRANSITION: {
      duration: 650
    },

    TYPING: {
      baseSpeed: 16,
      punctuationPause: 110,
      commaPause: 55,
      paragraphPause: 420,
      emotionalPause: 650
    }
  };


  /* ============================================================
     1. STATE
     ============================================================ */

  const state = {
    currentScene: 1,
    previousScene: null,

    isTransitioning: false,

    initialized: false,

    reducedMotion:
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,

    audio: {
      currentTrack: null,
      fadeTimer: null,
      generation: 0
    },

    letter: {
      initialized: false,
      started: false,
      completed: false,
      typingTimer: null
    },

    traits: {
      revealed: new Set()
    },

    memories: {
      revealed: new Set()
    },

    hydroponics: {
      opened: false
    },

    climax: {
      initialized: false,
      stage: 0,
      completed: false
    }
  };


  /* ============================================================
     2. BASIC DOM HELPERS
     ============================================================ */

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


  const byId = (id) => document.getElementById(id);


  const safeText = (element) => {
    if (!element) return "";
    return (element.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };


  const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);


  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));


  /* ============================================================
     3. SCENE DISCOVERY
     ============================================================ */

  function getSceneElements() {
    const possible = [];

    const selectors = [
      ".scene",
      "[data-scene]",
      "[id^='scene-']",
      "[id^='scene']"
    ];

    selectors.forEach((selector) => {
      $$(selector).forEach((element) => {
        if (!possible.includes(element)) {
          possible.push(element);
        }
      });
    });

    return possible;
  }


  function getSceneNumber(sceneElement) {
    if (!sceneElement) return null;

    const dataNumber =
      sceneElement.dataset &&
      (
        sceneElement.dataset.scene ||
        sceneElement.dataset.sceneNumber
      );

    if (dataNumber && /^\d+$/.test(dataNumber)) {
      return Number(dataNumber);
    }

    const id = sceneElement.id || "";

    const idMatch = id.match(/scene[-_]?(\d+)/i);

    if (idMatch) {
      return Number(idMatch[1]);
    }

    const classMatch =
      Array.from(sceneElement.classList || []).join(" ")
        .match(/scene[-_]?(\d+)/i);

    if (classMatch) {
      return Number(classMatch[1]);
    }

    return null;
  }


  function getScene(number) {
    const scenes = getSceneElements();

    return (
      scenes.find(
        (scene) => getSceneNumber(scene) === Number(number)
      ) || null
    );
  }


  function getAllSceneNumbers() {
    return getSceneElements()
      .map(getSceneNumber)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }


  /* ============================================================
     4. NORMALIZE SCENE TARGET
     ============================================================ */

  function normalizeSceneTarget(rawTarget) {
    if (
      rawTarget === null ||
      rawTarget === undefined ||
      rawTarget === ""
    ) {
      return null;
    }

    if (typeof rawTarget === "number") {
      return Number.isFinite(rawTarget)
        ? clamp(
            Math.round(rawTarget),
            1,
            CONFIG.TOTAL_SCENES
          )
        : null;
    }

    const raw = String(rawTarget).trim();

    if (!raw) return null;

    /* direct number */
    if (/^\d+$/.test(raw)) {
      return clamp(
        Number(raw),
        1,
        CONFIG.TOTAL_SCENES
      );
    }

    /* scene-2 / scene2 / scene_2 */
    const sceneMatch =
      raw.match(/^#?scene[-_]?(\d+)$/i);

    if (sceneMatch) {
      return clamp(
        Number(sceneMatch[1]),
        1,
        CONFIG.TOTAL_SCENES
      );
    }

    /* target IDs such as #scene-2 */
    const hashMatch =
      raw.match(/^#.*?(\d+)$/);

    if (hashMatch) {
      return clamp(
        Number(hashMatch[1]),
        1,
        CONFIG.TOTAL_SCENES
      );
    }

    return null;
  }


  /* ============================================================
     5. ROBUST NAVIGATION TARGET RESOLUTION
     ============================================================ */

  function getNavigationTarget(button) {
    if (!button) return null;

    const dataset = button.dataset || {};

    const possibleTargets = [
      dataset.sceneTarget,
      dataset.targetScene,
      dataset.goTo,
      dataset.nextScene,
      dataset.scene,
      dataset.target,
      dataset.next,
      dataset.previous,
      dataset.prev,

      button.getAttribute("aria-controls"),
      button.getAttribute("href")
    ];

    for (const candidate of possibleTargets) {
      const normalized =
        normalizeSceneTarget(candidate);

      if (normalized !== null) {
        return normalized;
      }
    }


    /* ----------------------------------------------------------
       CLASS BASED NAVIGATION
       ---------------------------------------------------------- */

    const classes =
      Array.from(button.classList || []).join(" ")
        .toLowerCase();

    if (
      /\b(next|continue|forward|open|start)\b/.test(classes)
    ) {
      return state.currentScene + 1;
    }

    if (
      /\b(prev|previous|back|return)\b/.test(classes)
    ) {
      return state.currentScene - 1;
    }


    /* ----------------------------------------------------------
       TEXT BASED FALLBACK
       ---------------------------------------------------------- */

    const text = safeText(button);

    /*
      Scene 1's exact emotional button.
      This is intentionally explicit because this was
      the button that previously failed.
    */

    if (
      text.includes("bukaa duluuu") ||
      text.includes("buka duluuu") ||
      text.includes("buka dulu")
    ) {
      return 2;
    }


    /*
      Other common textual navigation.
      These are intentionally conservative.
    */

    if (
      text === "next" ||
      text.includes("lanjut") ||
      text.includes("lanjutt") ||
      text.includes("selanjutnya")
    ) {
      return state.currentScene + 1;
    }


    if (
      text === "back" ||
      text.includes("kembali")
    ) {
      return state.currentScene - 1;
    }


    return null;
  }


  /* ============================================================
     6. SCENE VISIBILITY
     ============================================================ */

  function applySceneVisibility(targetNumber) {
    const scenes = getSceneElements();

    scenes.forEach((scene) => {
      const number = getSceneNumber(scene);
      const isActive = number === targetNumber;

      scene.classList.toggle("active", isActive);
      scene.classList.toggle("is-active", isActive);
      scene.classList.toggle("inactive", !isActive);

      if (isActive) {
        scene.removeAttribute("aria-hidden");
        scene.setAttribute("aria-current", "true");

        /*
          Do NOT use display:none universally.
          Existing CSS may already control layout/animation.
        */
        scene.style.pointerEvents = "auto";
        scene.style.visibility = "visible";
        scene.style.opacity = "1";
        scene.style.zIndex = "10";
      } else {
        scene.setAttribute("aria-hidden", "true");
        scene.removeAttribute("aria-current");

        scene.style.pointerEvents = "none";
        scene.style.visibility = "hidden";
        scene.style.opacity = "0";
        scene.style.zIndex = "0";
      }
    });
  }


  /* ============================================================
     7. SCENE SCROLL MANAGEMENT
     ============================================================ */

  function resetSceneScroll(sceneElement) {
    if (!sceneElement) return;

    try {
      sceneElement.scrollTop = 0;
    } catch {
      /* intentionally ignored */
    }

    const scrollableChildren = [
      ".scene-content",
      ".scene-inner",
      ".scene-scroll",
      ".letter-scroll",
      ".letter-container"
    ];

    scrollableChildren.forEach((selector) => {
      $$(selector, sceneElement).forEach((element) => {
        try {
          element.scrollTop = 0;
        } catch {
          /* ignored */
        }
      });
    });
  }


  /*
    Important:
    There is deliberately NO wheel listener that changes scenes.

    Scrolling remains normal browser scrolling.
  */


  /* ============================================================
     8. TRANSITION OVERLAY
     ============================================================ */

  function getTransitionOverlay() {
    let overlay = byId("scene-transition");

    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "scene-transition";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      pointerEvents: "none",
      opacity: "0",
      background: "var(--transition-bg, #f7f1e8)",
      transition:
        `opacity ${CONFIG.TRANSITION.duration / 2}ms ease`,
      visibility: "hidden"
    });

    document.body.appendChild(overlay);

    return overlay;
  }


  async function transitionOut() {
    if (state.reducedMotion) {
      return;
    }

    const overlay = getTransitionOverlay();

    overlay.style.visibility = "visible";
    overlay.style.opacity = "0";

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        overlay.style.opacity = "1";

        setTimeout(
          resolve,
          CONFIG.TRANSITION.duration / 2
        );
      });
    });
  }


  async function transitionIn() {
    if (state.reducedMotion) {
      return;
    }

    const overlay = getTransitionOverlay();

    overlay.style.opacity = "0";

    await new Promise((resolve) => {
      setTimeout(() => {
        overlay.style.visibility = "hidden";
        resolve();
      }, CONFIG.TRANSITION.duration / 2);
    });
  }


  /* ============================================================
     9. AUDIO ENGINE
     ============================================================ */

  const audio = {
    music1: null,
    music2: null,

    initialized: false,

    init() {
      if (this.initialized) return;

      this.music1 = new Audio(CONFIG.AUDIO.music1);
      this.music2 = new Audio(CONFIG.AUDIO.music2);

      this.music1.preload = "auto";
      this.music2.preload = "auto";

      this.music1.loop = true;
      this.music2.loop = true;

      this.music1.volume = 0;
      this.music2.volume = 0;

      /*
        Do not allow browser errors to break the entire
        website.
      */
      [this.music1, this.music2].forEach((track) => {
        if (!track) return;

        track.addEventListener(
          "error",
          () => {
            console.warn(
              "[Bolu Ubi] Audio could not be loaded:",
              track.src
            );
          }
        );
      });

      this.initialized = true;
    },


    getTrack(name) {
      if (name === "music1") return this.music1;
      if (name === "music2") return this.music2;
      return null;
    },


    clearFadeTimer() {
      if (state.audio.fadeTimer) {
        clearInterval(state.audio.fadeTimer);
        state.audio.fadeTimer = null;
      }
    },


    async fadeIn(track, targetVolume, duration) {
      if (!track) return;

      this.clearFadeTimer();

      if (state.reducedMotion) {
        track.volume = targetVolume;
        return;
      }

      track.volume = 0;

      const start = performance.now();

      await new Promise((resolve) => {
        const tick = () => {
          if (!track) {
            resolve();
            return;
          }

          const elapsed = performance.now() - start;
          const progress =
            clamp(elapsed / duration, 0, 1);

          track.volume =
            targetVolume * progress;

          if (progress >= 1) {
            track.volume = targetVolume;
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });
    },


    async fadeOut(track, duration) {
      if (!track) return;

      if (state.reducedMotion) {
        track.volume = 0;
        track.pause();
        return;
      }

      const startVolume =
        Number.isFinite(track.volume)
          ? track.volume
          : 0;

      if (startVolume <= 0) {
        track.pause();
        track.volume = 0;
        return;
      }

      const start = performance.now();

      await new Promise((resolve) => {
        const tick = () => {
          const elapsed = performance.now() - start;

          const progress =
            clamp(elapsed / duration, 0, 1);

          track.volume =
            startVolume * (1 - progress);

          if (progress >= 1) {
            track.volume = 0;
            track.pause();
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });
    },


    async stopTrack(name, immediate = false) {
      const track = this.getTrack(name);

      if (!track) return;

      if (immediate || state.reducedMotion) {
        track.pause();
        track.currentTime = 0;
        track.volume = 0;
        return;
      }

      await this.fadeOut(
        track,
        CONFIG.AUDIO.fadeOutDuration
      );

      try {
        track.currentTime = 0;
      } catch {
        /* ignored */
      }

      track.volume = 0;
    },


    async playTrack(name, volume) {
      const track = this.getTrack(name);

      if (!track) return false;

      try {
        const result = track.play();

        if (result && typeof result.then === "function") {
          await result;
        }

        await this.fadeIn(
          track,
          volume,
          CONFIG.AUDIO.fadeInDuration
        );

        state.audio.currentTrack = name;

        return true;
      } catch (error) {
        /*
          Autoplay can still be blocked by some browsers.
          We deliberately don't crash the story.
        */

        console.warn(
          "[Bolu Ubi] Audio playback was blocked:",
          error
        );

        return false;
      }
    },


    async startMusic1() {
      this.init();

      /*
        Prevent music2 from ever overlapping music1.
      */
      await this.stopTrack("music2", true);

      const current = this.music1;

      if (
        state.audio.currentTrack === "music1" &&
        current &&
        !current.paused
      ) {
        return;
      }

      await this.playTrack(
        "music1",
        CONFIG.AUDIO.music1Volume
      );
    },


    async startMusic2() {
      this.init();

      /*
        CRITICAL:
        music1 MUST be fully stopped before music2 starts.
      */

      await this.stopTrack("music1", false);

      state.audio.currentTrack = null;

      await this.playTrack(
        "music2",
        CONFIG.AUDIO.music2Volume
      );
    },


    async silenceAll() {
      this.init();

      await Promise.all([
        this.stopTrack("music1", false),
        this.stopTrack("music2", false)
      ]);

      state.audio.currentTrack = null;
    }
  };


  /* ============================================================
     10. NAVIGATION CORE
     ============================================================ */

  async function goToScene(targetNumber, options = {}) {
    const target = normalizeSceneTarget(targetNumber);

    if (target === null) {
      console.warn(
        "[Bolu Ubi] Invalid scene target:",
        targetNumber
      );
      return false;
    }

    const targetScene = getScene(target);

    if (!targetScene) {
      console.warn(
        `[Bolu Ubi] Scene ${target} was not found in the DOM.`
      );
      return false;
    }

    if (state.isTransitioning) {
      return false;
    }

    if (
      target === state.currentScene &&
      !options.force
    ) {
      return false;
    }

    state.isTransitioning = true;

    const previous =
      state.currentScene;

    state.previousScene = previous;

    try {
      await transitionOut();

      /*
        AUDIO TIMING
        --------------------------------------------------------
        Scene 1 -> Scene 2:
          start music1 immediately after user's click.

        Scene 9 -> Scene 10:
          music1 is fully faded out first,
          then music2 starts.
      */

      if (
        target === 2 &&
        previous === 1
      ) {
        /*
          Because this function is ultimately triggered by
          the Scene 1 click, browser autoplay policy is
          normally satisfied here.
        */

        audio.init();

        /*
          Start the track while we are still inside the
          user-gesture chain.
        */
        audio.startMusic1();
      }


      if (
        target === 10 &&
        previous === 9
      ) {
        /*
          Explicitly wait for music1 to finish fading out
          before music2 begins.
        */
        await audio.stopTrack(
          "music1",
          false
        );

        state.audio.currentTrack = null;

        await audio.playTrack(
          "music2",
          CONFIG.AUDIO.music2Volume
        );
      }


      /*
        If someone jumps directly into Scene 10,
        still make sure music1 cannot overlap.
      */
      if (
        target === 10 &&
        previous !== 9
      ) {
        await audio.stopTrack(
          "music1",
          false
        );

        await audio.playTrack(
          "music2",
          CONFIG.AUDIO.music2Volume
        );
      }


      /*
        Scene 9 is intentionally quiet.
      */
      if (
        target === 9 &&
        previous !== 10
      ) {
        await audio.stopTrack(
          "music1",
          false
        );
      }


      applySceneVisibility(target);

      const newScene = getScene(target);

      resetSceneScroll(newScene);

      await runSceneEnterHook(
        target,
        previous
      );

      await transitionIn();

      state.currentScene = target;

      updateDocumentState();

      return true;

    } catch (error) {
      console.error(
        "[Bolu Ubi] Scene transition failed:",
        error
      );

      /*
        Fail-safe:
        even if an optional animation/audio fails,
        the scene itself should still become visible.
      */

      applySceneVisibility(target);

      state.currentScene = target;

      updateDocumentState();

      try {
        await transitionIn();
      } catch {
        /* ignored */
      }

      return true;

    } finally {
      state.isTransitioning = false;
    }
  }


  /* ============================================================
     11. BUTTON NAVIGATION
     ============================================================ */

  function isButtonLike(element) {
    if (!element) return false;

    const tag = element.tagName
      ? element.tagName.toLowerCase()
      : "";

    return (
      tag === "button" ||
      tag === "a" ||
      element.getAttribute("role") === "button" ||
      element.hasAttribute("data-scene-target") ||
      element.hasAttribute("data-next") ||
      element.hasAttribute("data-go-to")
    );
  }


  function handleNavigationClick(event) {
    const clickable =
      event.target &&
      event.target.closest
        ? event.target.closest(
            "button, a, [role='button'], [data-scene-target], [data-go-to], [data-next], [data-target-scene]"
          )
        : null;

    if (!clickable) return;

    /*
      Ignore external links.
    */
    if (
      clickable.tagName &&
      clickable.tagName.toLowerCase() === "a"
    ) {
      const href =
        clickable.getAttribute("href");

      if (
        href &&
        !href.startsWith("#scene") &&
        !href.startsWith("#")
      ) {
        return;
      }
    }

    const target =
      getNavigationTarget(clickable);

    if (target === null) {
      return;
    }

    /*
      IMPORTANT:
      Scene 1's "bukaa duluuu" is explicitly mapped
      to Scene 2.
    */

    if (
      safeText(clickable).includes("bukaa duluuu") ||
      safeText(clickable).includes("buka duluuu")
    ) {
      event.preventDefault();
      event.stopPropagation();

      goToScene(2);

      return;
    }

    event.preventDefault();
    event.stopPropagation();

    goToScene(target);
  }


  /*
    ONE navigation system only.
    No duplicate listeners.
    No bindNavigationButtons() dependency.
  */

  function initNavigation() {
    document.addEventListener(
      "click",
      handleNavigationClick,
      false
    );

    /*
      Keyboard support.
    */
    document.addEventListener(
      "keydown",
      (event) => {
        const activeElement =
          document.activeElement;

        if (
          !activeElement ||
          !isButtonLike(activeElement)
        ) {
          return;
        }

        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }

        const target =
          getNavigationTarget(activeElement);

        if (target === null) return;

        event.preventDefault();

        goToScene(target);
      }
    );
  }


  /* ============================================================
     12. SCENE 1 HARD GUARANTEE
     ============================================================ */

  function initOpeningButtonProtection() {
    /*
      This is deliberately independent from IDs/classes.

      Even if the Scene 1 HTML contains something like:

        <button>
          bukaa duluuu
        </button>

      it will still work.
    */

    const candidates = $$("button, a, [role='button']");

    const openingButton =
      candidates.find((element) => {
        const text = safeText(element);

        return (
          text.includes("bukaa duluuu") ||
          text.includes("buka duluuu") ||
          text.includes("buka dulu")
        );
      });

    if (!openingButton) {
      console.warn(
        "[Bolu Ubi] Opening button text was not found."
      );
      return;
    }

    /*
      Make sure it behaves like a button.
    */
    openingButton.setAttribute(
      "data-scene-target",
      "2"
    );

    /*
      Capture phase guarantees this click is caught
      even if another handler on the button/container
      interferes.
    */

    openingButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (state.isTransitioning) {
          return;
        }

        goToScene(2);
      },
      true
    );

    console.info(
      "[Bolu Ubi] Opening button connected successfully."
    );
  }


  /* ============================================================
     13. TRAIT INTERACTIONS — SCENE 4
     ============================================================ */

  function initTraitInteractions() {
    const buttons = $$(
      [
        "[data-trait]",
        ".trait-button",
        ".trait-toggle",
        ".trait-card button",
        ".trait-item button"
      ].join(",")
    );

    buttons.forEach((button, index) => {
      if (button.dataset.traitBound === "true") {
        return;
      }

      button.dataset.traitBound = "true";

      button.addEventListener("click", () => {
        const key =
          button.dataset.trait ||
          String(index);

        state.traits.revealed.add(key);

        const container =
          button.closest(
            "[data-trait-item], .trait-item, .trait-card, .trait"
          );

        if (container) {
          container.classList.toggle(
            "revealed",
            true
          );

          container.classList.toggle(
            "is-open",
            true
          );
        }

        const targetSelector =
          button.dataset.reveal;

        if (targetSelector) {
          const target =
            document.querySelector(
              targetSelector
            );

          if (target) {
            target.hidden = false;
            target.classList.add("revealed");
          }
        }
      });
    });


    /*
      Generic "+" support.
      This fixes the previous issue where the plus buttons
      visually existed but did not reveal their content.
    */

    const plusButtons = $$(
      [
        ".plus-button",
        ".trait-plus",
        "[data-plus]",
        "[data-reveal-trait]"
      ].join(",")
    );

    plusButtons.forEach((button, index) => {
      if (button.dataset.plusBound === "true") {
        return;
      }

      button.dataset.plusBound = "true";

      button.addEventListener("click", () => {
        const targetSelector =
          button.dataset.reveal ||
          button.dataset.revealTrait;

        let target = null;

        if (targetSelector) {
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
          const parent =
            button.closest(
              "[data-trait-item], .trait-item, .trait-card, .trait"
            );

          if (parent) {
            target =
              parent.querySelector(
                ".trait-description, .trait-text, .trait-detail, [data-trait-content]"
              );
          }
        }

        if (!target) {
          return;
        }

        const hidden =
          target.hidden ||
          target.getAttribute("aria-hidden") === "true" ||
          !target.classList.contains("revealed");

        target.hidden = !hidden;

        target.classList.toggle(
          "revealed",
          hidden
        );

        target.setAttribute(
          "aria-hidden",
          String(!hidden)
        );

        button.classList.toggle(
          "is-open",
          hidden
        );

        button.setAttribute(
          "aria-expanded",
          String(hidden)
        );
      });
    });
  }


  /* ============================================================
     14. MEMORY INTERACTIONS — SCENE 5
     ============================================================ */

  function initMemoryInteractions() {
    const buttons = $$(
      [
        "[data-memory]",
        ".memory-button",
        ".memory-toggle",
        ".memory-card button",
        ".side-quest-button"
      ].join(",")
    );

    buttons.forEach((button, index) => {
      if (button.dataset.memoryBound === "true") {
        return;
      }

      button.dataset.memoryBound = "true";

      button.addEventListener("click", () => {
        const key =
          button.dataset.memory ||
          String(index);

        state.memories.revealed.add(key);

        const parent =
          button.closest(
            "[data-memory-item], .memory-item, .memory-card, .side-quest"
          );

        if (parent) {
          parent.classList.add("revealed");
          parent.classList.add("is-open");
        }

        const targetSelector =
          button.dataset.reveal;

        if (targetSelector) {
          try {
            const target =
              document.querySelector(
                targetSelector
              );

            if (target) {
              target.hidden = false;
              target.classList.add("revealed");
            }
          } catch {
            /* ignored */
          }
        }
      });
    });


    /*
      Text fallback for PKWU / hydroponics.
    */

    const hydroCandidates = $$(
      "button, [role='button'], a"
    );

    hydroCandidates.forEach((button) => {
      const text = safeText(button);

      if (
        text.includes("hydropon") ||
        text.includes("pkwu")
      ) {
        if (
          button.dataset.hydroBound === "true"
        ) {
          return;
        }

        button.dataset.hydroBound = "true";

        button.addEventListener("click", () => {
          openHydroponics(button);
        });
      }
    });
  }


  function openHydroponics(trigger = null) {
    state.hydroponics.opened = true;

    const possibleTargets = [
      "#hydroponics-detail",
      "#hydroponics-frame",
      "#hydroponics-panel",
      ".hydroponics-detail",
      ".hydroponics-panel",
      "[data-hydroponics-detail]"
    ];

    let target = null;

    for (const selector of possibleTargets) {
      target = $(selector);

      if (target) break;
    }

    if (target) {
      target.hidden = false;

      target.classList.add("revealed");
      target.classList.add("is-open");

      target.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    if (trigger) {
      trigger.classList.add("is-open");
      trigger.setAttribute(
        "aria-expanded",
        "true"
      );
    }
  }


  /* ============================================================
     15. PHOTO HANDLING — SCENE 6
     ============================================================ */

  function initPhotoHandling() {
    const images = $$(
      [
        ".scene img",
        "[data-photo]",
        ".photo-frame img",
        ".portrait img"
      ].join(",")
    );

    images.forEach((image) => {
      image.addEventListener(
        "load",
        () => {
          image.classList.add("is-loaded");
        },
        { once: true }
      );

      image.addEventListener(
        "error",
        () => {
          image.classList.add("is-error");

          console.warn(
            "[Bolu Ubi] Image could not be loaded:",
            image.src
          );
        },
        { once: true }
      );
    });
  }


  /* ============================================================
     16. LETTER SOURCE
     ============================================================ */

  const LETTER_PARAGRAPHS = [
    `aalooo bolu ubii, umm mungkin aku seharusnya skrng manggil kamu nenek talita kali yak. bhaap walaupun cuman beda 1 tahun doang sihh. hehee`,

    `aku harap aku yg jadi orang pertama yg ngucapin kamu, walaupun sebatas text sii. karna kita sekarang kepisah jarak, alhasil keduluan ur mom atau ga ur bapack yang ngucapin secara langsung. tapi ndak apa, it's okay. (ini aja malah pas ganti tanggal sung aku kirim yg di wa😭, 00.00)`,

    `umm, jujur banyak sebenernya yg pengen disampein, malah saking banyak ga tau harus mulai dari mana dan kayak gimana kata²nya. Asiikkk. Ini aku typingnya biasa aja kali yak😭, agak romantis sikit dah kali yee. bhapp. Soalnya tuh kalo kata²nya serius banget takutnya nanti kamu nangis. huhuhuuu. terharu. ntar kalo kamu nangis kan ga ada aku di samping yang ngusapin air matanya🥺. ehh ntar aku elapin dari jauh ajaa deh. cupcupcup... ntar aku elapin pake kanebo 🫶🏻🫰🏻`,

    `nah tuh kann, ga kerasa aku ngetik intronya aja dah sepanjang ini. uda ngalahin kata pengantar di fisika erlangga inimah wok😭. Dah ahh, serius dulu nih ngucapin nya. asiikkk`,

    `umm`,

    `HABEDEEE TALITAAA, aku di sini ga pake kata² template tahunan yg mungkin uda sering kamu dengar sebelumnya. Biar lebih spesial dan beda gitu sii, ada unique selling pointnya gitu lahh. Asikk.`,

    `Soo, my biggest wish is to keep seeing you smile, not just today, but for all the years to come. I want to be the one who stands by you through life's brightest days and darkest nights, standing proud of your triumphs, being the anchor you lean on during the roughest seas, and keeping you safe when the ground shakes. (harapan terbesarku adalah untuk terus ngeliat kamu tersenyum, ga cuma hari ini, tapi untuk bertahun-tahun ke depan. ku ingin jadi orang yang berdiri di sampingmu ngelewatin hari² tercerah dan malam² tergelap sekalipun dalam hidup km, berdiri bangga atas pencapaianmu, jd jangkar tempat kamu bersandar saat lautan paling berombak, dan ngejaga kamu tetap aman saat dunia kamu lagi ga baik² aja).`,

    `dan seperti biasa, semoga apa yg km harapkan dpt tercapai di usia ini, berbagai harapan, wishlist, pencapaian, dan apapun itu. dan tentunya semakin diperlancar dan dipermudah jalannya. dan yg pasti sehat² yaap, semoga di usia ini bisa jadi pribadi yg lebih baik lg, lebih dewasa, ceria, dan jadi diri sendiri. bisa terus berprogress bareng. Saling support, saling ngingetin jugak`,

    `Semoga km tetap jd km yg ceria, bertanggung jawab, dewasa, random, kadang ngambek, kadang plenger😭`,

    `semoga km terus bertumbuh jd seseorang yang lebih baik, tanpa harus kehilangan sisi dirimu yang sekarang.`,

    `oiyak satu lagi, makin lancar jg dah rezekinya. rejeki ga cuma duit ajaa loh yaak. wkwk`,

    `umm, dah kabisan kata² aku wok😭. intinya semua do'a yg baik² turut nyertain km. btw kado ultahnya nanti pas kita di kopken yaaps. mwehehee`,

    `Dan kalau suatu hari nanti kamu lagi capek, lagi sedih, atau dunia rasanya lagi nggak terlalu baik sama kamu...`,

    `I hope you remember that you don't always have to face everything alone.`,

    `Karena, setidaknya untuk sekarang,`,

    `aku masih di sini.`,

    `sebagai penutup,`,

    `makan seblak pake nasi`,

    `habedee bolu ubiii🤍`,

    `~ Tongzi🤾‍♂️`
  ];


  /* ============================================================
     17. LETTER ELEMENT RESOLUTION
     ============================================================ */

  function findLetterContainer() {
    const candidates = [
      "#birthday-letter",
      "#letter",
      "#letter-content",
      "#scene-8-letter",
      ".birthday-letter",
      ".letter-content",
      ".letter-body",
      "[data-letter]"
    ];

    for (const selector of candidates) {
      const element = $(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }


  function findLetterIntro() {
    const candidates = [
      "[data-letter-intro]",
      ".letter-intro",
      "#letter-intro"
    ];

    for (const selector of candidates) {
      const element = $(selector);

      if (element) return element;
    }

    return null;
  }


  /* ============================================================
     18. LETTER TYPING ENGINE
     ============================================================ */

  function calculateTypingDelay(character, paragraph) {
    let delay =
      CONFIG.TYPING.baseSpeed +
      Math.random() * 13;

    if (character === ",") {
      delay += CONFIG.TYPING.commaPause;
    }

    if (
      character === "." ||
      character === "!" ||
      character === "?"
    ) {
      delay +=
        CONFIG.TYPING.punctuationPause;
    }

    /*
      Emotional / reflective lines breathe longer.
    */

    const trimmed =
      paragraph.trim().toLowerCase();

    if (
      trimmed.includes("i hope") ||
      trimmed.includes("aku masih di sini") ||
      trimmed.includes("my biggest wish") ||
      trimmed.includes("setidaknya untuk sekarang")
    ) {
      delay += 12;
    }

    return delay;
  }


  async function typeParagraph(
    container,
    paragraph
  ) {
    const p =
      document.createElement("p");

    p.className =
      "typed-paragraph";

    container.appendChild(p);

    let output = "";

    for (let i = 0; i < paragraph.length; i++) {
      if (!state.letter.started) {
        return;
      }

      const character =
        paragraph[i];

      output += character;

      p.textContent = output;

      const delay =
        state.reducedMotion
          ? 0
          : calculateTypingDelay(
              character,
              paragraph
            );

      if (delay > 0) {
        await wait(delay);
      }

      /*
        Keep the newest text visible, but do NOT force
        the entire page to scroll.
      */

      if (
        p.parentElement &&
        p.parentElement.scrollHeight >
          p.parentElement.clientHeight
      ) {
        /*
          Only gently keep the letter near the newest line.
          This does not affect scene navigation.
        */
        p.parentElement.scrollTop =
          p.parentElement.scrollHeight;
      }
    }

    await wait(
      state.reducedMotion
        ? 0
        : CONFIG.TYPING.paragraphPause
    );
  }


  async function startLetterTyping() {
    if (state.letter.started) {
      return;
    }

    const container =
      findLetterContainer();

    if (!container) {
      console.warn(
        "[Bolu Ubi] Letter container not found."
      );
      return;
    }

    state.letter.initialized = true;
    state.letter.started = true;
    state.letter.completed = false;

    container.innerHTML = "";

    for (
      let index = 0;
      index < LETTER_PARAGRAPHS.length;
      index++
    ) {
      const paragraph =
        LETTER_PARAGRAPHS[index];

      await typeParagraph(
        container,
        paragraph
      );

      /*
        Give the emotional paragraphs slightly more air.
      */

      if (
        index === 5 ||
        index === 6 ||
        index === 11 ||
        index === 12 ||
        index === 14 ||
        index === 15
      ) {
        await wait(
          state.reducedMotion
            ? 0
            : CONFIG.TYPING.emotionalPause
        );
      }
    }

    state.letter.completed = true;

    container.classList.add(
      "typing-complete"
    );

    document.dispatchEvent(
      new CustomEvent(
        "boluubi:letter-complete"
      )
    );
  }


  function initLetter() {
    const intro =
      findLetterIntro();

    if (intro) {
      /*
        Exact opening requested for Scene 8.
      */
      intro.textContent =
        "tenang aja kokk, yg ini beda sama yg di wa teksnya, soalnya di sini tuh yg lebih serius nya, hehee";
    }


    const container =
      findLetterContainer();

    if (!container) {
      return;
    }

    /*
      If HTML already contains letter content,
      don't immediately erase it.
      The typing engine takes control only when
      Scene 8 is entered.
    */

    state.letter.initialized = true;
  }


  /* ============================================================
     19. SCENE 9 QUIET MOMENT
     ============================================================ */

  function initScene9() {
    /*
      Scene 9 should feel like a breath.

      Music1 must be silent here.
    */

    audio.stopTrack(
      "music1",
      false
    );

    const scene = getScene(9);

    if (!scene) return;

    scene.classList.add(
      "quiet-scene"
    );

    /*
      Keep "you are loved" subtle if such text exists.
      We do NOT make it huge.
    */

    const allElements =
      $$("*", scene);

    allElements.forEach((element) => {
      const text = safeText(element);

      if (
        text === "you are loved" ||
        text.includes("you are loved")
      ) {
        element.classList.add(
          "quiet-message"
        );
      }
    });
  }


  /* ============================================================
     20. SCENE 10 CLIMAX
     ============================================================ */

  function findClimaxContainer() {
    const candidates = [
      "#climax",
      "#scene-10-content",
      "#scene10-content",
      ".climax-content",
      ".scene-10-content",
      "[data-climax]"
    ];

    for (const selector of candidates) {
      const element = $(selector);

      if (element) {
        return element;
      }
    }

    return getScene(10);
  }


  function initClimax() {
    if (state.climax.initialized) {
      return;
    }

    state.climax.initialized = true;

    const scene =
      getScene(10);

    if (!scene) return;

    scene.classList.add(
      "climax-scene"
    );

    /*
      We intentionally do not create a generic
      "YES / NO" proposal UI here.

      The climax should feel like the continuation of
      something that already exists between them.
    */

    const interactive =
      $$(
        [
          "[data-climax-action]",
          ".climax-action",
          ".climax-button",
          "[data-next-chapter]"
        ].join(","),
        scene
      );

    interactive.forEach((button) => {
      if (
        button.dataset.climaxBound === "true"
      ) {
        return;
      }

      button.dataset.climaxBound = "true";

      button.addEventListener(
        "click",
        () => {
          advanceClimax(button);
        }
      );
    });


    /*
      Also recognize buttons whose text suggests
      continuing the story.
    */

    $$(
      "button, [role='button'], a",
      scene
    ).forEach((button) => {
      const text =
        safeText(button);

      if (
        text.includes("lanjut") ||
        text.includes("next chapter") ||
        text.includes("lihat") ||
        text.includes("buka")
      ) {
        if (
          button.dataset.climaxBound === "true"
        ) {
          return;
        }

        button.dataset.climaxBound = "true";

        button.addEventListener(
          "click",
          () => {
            advanceClimax(button);
          }
        );
      }
    });
  }


  function advanceClimax(button = null) {
    state.climax.stage += 1;

    const scene =
      getScene(10);

    if (!scene) return;

    scene.classList.add(
      `climax-stage-${state.climax.stage}`
    );

    if (button) {
      button.classList.add(
        "is-complete"
      );

      button.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    /*
      Reveal hidden epilogue elements progressively.
    */

    const revealTargets = $$(
      [
        "[data-epilogue]",
        ".epilogue",
        ".after-yes",
        ".next-chapter",
        "[data-final-message]"
      ].join(","),
      scene
    );

    revealTargets.forEach((element) => {
      element.hidden = false;
      element.classList.add("revealed");
    });

    if (
      revealTargets.length > 0 &&
      state.climax.stage >= 1
    ) {
      state.climax.completed = true;
    }
  }


  /* ============================================================
     21. STICKER INITIALIZATION
     ============================================================ */

  function initStickers() {
    const stickers = $$(
      [
        "img[src*='stiker1']",
        "img[src*='stiker2']",
        "img[src*='stiker3']",
        "img[src*='stiker4']",
        "img[src*='stiker5']",
        "img[src*='stiker6']"
      ].join(",")
    );

    stickers.forEach((sticker) => {
      sticker.setAttribute(
        "draggable",
        "false"
      );

      sticker.addEventListener(
        "dragstart",
        (event) => {
          event.preventDefault();
        }
      );
    });
  }


  /* ============================================================
     22. SCENE ENTER HOOKS
     ============================================================ */

  async function runSceneEnterHook(
    sceneNumber,
    previousScene
  ) {
    switch (sceneNumber) {

      case 1:
        /*
          Opening:
          no music yet.
        */
        break;


      case 2:
        /*
          Music1 already starts when button is clicked.
          Do not restart it here.
        */
        break;


      case 3:
        break;


      case 4:
        break;


      case 5:
        break;


      case 6:
        break;


      case 7:
        break;


      case 8:
        /*
          Start typing once.
        */
        await wait(
          state.reducedMotion
            ? 0
            : 180
        );

        startLetterTyping();

        break;


      case 9:
        initScene9();

        break;


      case 10:
        /*
          Music transition was already handled by
          goToScene() before this hook.
        */

        initClimax();

        break;


      default:
        break;
    }
  }


  /* ============================================================
     23. DOCUMENT STATE
     ============================================================ */

  function updateDocumentState() {
    document.documentElement.dataset.scene =
      String(state.currentScene);

    document.body.dataset.scene =
      String(state.currentScene);

    document.body.classList.remove(
      ...Array.from({
        length: CONFIG.TOTAL_SCENES
      }, (_, index) =>
        `scene-${index + 1}-active`
      )
    );

    document.body.classList.add(
      `scene-${state.currentScene}-active`
    );
  }


  /* ============================================================
     24. INITIAL SCENE DETECTION
     ============================================================ */

  function detectInitialScene() {
    const scenes =
      getAllSceneNumbers();

    if (!scenes.length) {
      console.warn(
        "[Bolu Ubi] No scene elements were detected."
      );

      return 1;
    }

    /*
      Look for existing active scene first.
    */

    const activeScene =
      getSceneElements()
        .find((scene) =>
          scene.classList.contains("active") ||
          scene.classList.contains("is-active")
        );

    if (activeScene) {
      const number =
        getSceneNumber(activeScene);

      if (number) {
        return number;
      }
    }

    /*
      Otherwise use Scene 1.
    */

    return scenes.includes(1)
      ? 1
      : scenes[0];
  }


  /* ============================================================
     25. INITIAL SCENE SANITIZATION
     ============================================================ */

  function initializeScenes() {
    const initial =
      detectInitialScene();

    state.currentScene = initial;

    applySceneVisibility(initial);

    const initialScene =
      getScene(initial);

    resetSceneScroll(
      initialScene
    );

    updateDocumentState();
  }


  /* ============================================================
     26. RESIZE HANDLING
     ============================================================ */

  function initResizeHandling() {
    let resizeTimer = null;

    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {
          document.documentElement.style.setProperty(
            "--viewport-height",
            `${window.innerHeight}px`
          );
        }, 100);
      }
    );

    document.documentElement.style.setProperty(
      "--viewport-height",
      `${window.innerHeight}px`
    );
  }


  /* ============================================================
     27. VISIBILITY / TAB SAFETY
     ============================================================ */

  function initVisibilityHandling() {
    document.addEventListener(
      "visibilitychange",
      () => {
        /*
          Do not destroy audio state.
          Browser itself may pause it.

          When user returns, don't aggressively restart,
          because doing so can violate user expectations.
        */
      }
    );
  }


  /* ============================================================
     28. TOUCH SAFETY
     ============================================================ */

  function initTouchSafety() {
    /*
      We deliberately do NOT disable touch scrolling.

      This is especially important for Scene 8.
    */

    document.addEventListener(
      "touchmove",
      () => {
        /* intentionally empty */
      },
      {
        passive: true
      }
    );
  }


  /* ============================================================
     29. GLOBAL DEBUG API
     ============================================================ */

  function exposeDebugAPI() {
    /*
      This does not affect normal users.

      It makes debugging from DevTools much easier.
    */

    window.BoluUbi = {
      state,

      goToScene,

      audio,

      getScene,

      getSceneElements,

      startLetterTyping,

      openHydroponics,

      reset() {
        state.currentScene = 1;
        state.previousScene = null;
        state.isTransitioning = false;

        state.letter.started = false;
        state.letter.completed = false;

        state.traits.revealed.clear();
        state.memories.revealed.clear();

        state.hydroponics.opened = false;

        state.climax.stage = 0;
        state.climax.completed = false;

        audio.silenceAll();

        initializeScenes();
      }
    };
  }


  /* ============================================================
     30. ERROR CONTAINMENT
     ============================================================ */

  function initGlobalErrorContainment() {
    window.addEventListener(
      "error",
      (event) => {
        console.error(
          "[Bolu Ubi] Runtime error:",
          event.error || event.message
        );
      }
    );

    window.addEventListener(
      "unhandledrejection",
      (event) => {
        console.error(
          "[Bolu Ubi] Promise error:",
          event.reason
        );

        /*
          Prevent an audio / animation rejection from
          becoming a fatal-looking page error.
        */
        event.preventDefault();
      }
    );
  }


  /* ============================================================
     31. INITIALIZATION
     ============================================================ */

  function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    console.info(
      "%cBolu Ubi 🐣",
      "font-weight:700;font-size:18px;"
    );

    console.info(
      "[Bolu Ubi] Story engine initializing..."
    );


    /*
      1. Global safety
    */

    initGlobalErrorContainment();


    /*
      2. Scene system
    */

    initializeScenes();


    /*
      3. Navigation
    */

    initNavigation();

    /*
      Critical Scene 1 guarantee.
    */
    initOpeningButtonProtection();


    /*
      4. Audio
    */

    audio.init();


    /*
      5. Interactions
    */

    initTraitInteractions();

    initMemoryInteractions();

    initPhotoHandling();

    initLetter();

    initStickers();

    initClimax();


    /*
      6. Responsive behavior
    */

    initResizeHandling();

    initVisibilityHandling();

    initTouchSafety();


    /*
      7. Debug API
    */

    exposeDebugAPI();


    /*
      Final state.
    */

    updateDocumentState();

    console.info(
      "[Bolu Ubi] Story engine ready."
    );

    console.info(
      "[Bolu Ubi] Current scene:",
      state.currentScene
    );
  }


  /* ============================================================
     32. DOM READY
     ============================================================ */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();