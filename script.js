/* =========================================================
   BOLU UBI 🐣
   Interactive Birthday / Story Website
   ---------------------------------------------------------
   script.js
   ---------------------------------------------------------
   Philosophy:
   HTML  = what the story says
   CSS   = what the story feels like
   JS    = when the story breathes
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     01. CONFIGURATION
     ========================================================= */

  const CONFIG = {
    totalScenes: 10,

    audio: {
      music1: "music1.mp3",
      music2: "music2.mp3",

      music1Volume: 0.34,
      music2Volume: 0.38,

      fadeInDuration: 2200,
      fadeOutDuration: 1500,

      fadeStep: 45
    },

    typing: {
      baseSpeed: 20,
      minimumSpeed: 8,
      maximumSpeed: 48,

      punctuationPause: 110,
      commaPause: 70,
      paragraphPause: 520,

      emotionalPause: 900
    },

    transition: {
      duration: 850,
      minimumDelay: 100
    },

    storage: {
      scene: "bolu-ubi-current-scene"
    }
  };


  /* =========================================================
     02. DOM HELPERS
     ========================================================= */

  const $ = (selector, parent = document) => {
    try {
      return parent.querySelector(selector);
    } catch {
      return null;
    }
  };

  const $$ = (selector, parent = document) => {
    try {
      return Array.from(parent.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const byId = (id) => document.getElementById(id);

  const safeClass = (element, className, state) => {
    if (!element) return;

    element.classList.toggle(className, Boolean(state));
  };


  /* =========================================================
     03. GLOBAL STATE
     ========================================================= */

  const state = {
    currentScene: 1,
    isTransitioning: false,

    music1Started: false,
    music2Started: false,

    music1Stopped: false,

    letterStarted: false,
    letterFinished: false,

    reducedMotion: false,

    revealedTraits: new Set(),
    openedMemories: new Set(),

    hydroponicsOpened: false,

    climaxOpened: false,
    epilogueShown: false,

    userInteracted: false
  };


  /* =========================================================
     04. REDUCED MOTION
     ========================================================= */

  const motionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  state.reducedMotion = Boolean(motionQuery?.matches);

  if (motionQuery) {
    const handleMotionChange = (event) => {
      state.reducedMotion = Boolean(event.matches);
    };

    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.addListener === "function") {
      motionQuery.addListener(handleMotionChange);
    }
  }


  /* =========================================================
     05. SCENE DISCOVERY
     ========================================================= */

  let scenes = [];

  function collectScenes() {
    let discovered = $$("[data-scene]");

    if (!discovered.length) {
      discovered = $$(".scene");
    }

    if (!discovered.length) {
      for (let i = 1; i <= CONFIG.totalScenes; i++) {
        const scene = byId(`scene-${i}`);

        if (scene) {
          discovered.push(scene);
        }
      }
    }

    const uniqueScenes = [...new Set(discovered)];

    uniqueScenes.sort((a, b) => {
      const aNumber = Number(
        a.dataset.scene ||
        a.id?.replace(/\D/g, "") ||
        0
      );

      const bNumber = Number(
        b.dataset.scene ||
        b.id?.replace(/\D/g, "") ||
        0
      );

      return aNumber - bNumber;
    });

    scenes = uniqueScenes;

    return scenes;
  }


  function getSceneNumber(scene) {
    if (!scene) return null;

    const fromData = Number(scene.dataset.scene);

    if (Number.isFinite(fromData) && fromData > 0) {
      return fromData;
    }

    const fromId = Number(
      scene.id?.replace(/\D/g, "")
    );

    if (Number.isFinite(fromId) && fromId > 0) {
      return fromId;
    }

    const index = scenes.indexOf(scene);

    return index >= 0 ? index + 1 : null;
  }


  function getScene(number) {
    if (!number) return null;

    return scenes.find(
      (scene) => getSceneNumber(scene) === Number(number)
    ) || null;
  }


  /* =========================================================
     06. SCENE VISIBILITY
     ========================================================= */

  function resetSceneAccessibility(scene) {
    if (!scene) return;

    const interactiveElements = $$(
      "a, button, input, textarea, select, [tabindex]",
      scene
    );

    interactiveElements.forEach((element) => {
      if (scene.classList.contains("is-active")) {
        if (element.dataset.originalTabindex !== undefined) {
          const original = element.dataset.originalTabindex;

          if (original === "") {
            element.removeAttribute("tabindex");
          } else {
            element.setAttribute("tabindex", original);
          }

          delete element.dataset.originalTabindex;
        }
      } else {
        if (element.dataset.originalTabindex === undefined) {
          element.dataset.originalTabindex =
            element.getAttribute("tabindex") ?? "";
        }

        element.setAttribute("tabindex", "-1");
      }
    });
  }


  function hideScene(scene) {
    if (!scene) return;

    scene.classList.remove("is-active");
    scene.setAttribute("aria-hidden", "true");

    resetSceneAccessibility(scene);
  }


  function showScene(scene) {
    if (!scene) return;

    scene.classList.add("is-active");
    scene.setAttribute("aria-hidden", "false");

    resetSceneAccessibility(scene);
  }


  function updateSceneCounter(number) {
    const counters = $$(
      "[data-scene-current], .scene-current"
    );

    counters.forEach((counter) => {
      counter.textContent = String(number).padStart(2, "0");
    });

    const progress = $$(
      "[data-scene-progress], .scene-progress"
    );

    progress.forEach((element) => {
      const percentage =
        (number / CONFIG.totalScenes) * 100;

      element.style.setProperty(
        "--scene-progress",
        `${percentage}%`
      );

      if (
        element.tagName === "PROGRESS" ||
        element instanceof HTMLProgressElement
      ) {
        element.max = CONFIG.totalScenes;
        element.value = number;
      }
    });
  }


  /* =========================================================
     07. SCROLL MANAGEMENT
     ---------------------------------------------------------
     IMPORTANT:
     Scroll does NOT change scenes.
     ========================================================= */

  function resetSceneScroll(scene) {
    if (!scene) return;

    const scrollContainers = [
      scene,
      $(".scene__content", scene),
      $(".scene-content", scene),
      $(".scene-inner", scene),
      $(".letter-scroll", scene),
      $(".letter-container", scene)
    ].filter(Boolean);

    scrollContainers.forEach((container) => {
      try {
        container.scrollTop = 0;
      } catch {
        /* intentionally silent */
      }
    });
  }


  function preserveInternalScroll(scene) {
    if (!scene) return;

    /*
     * Deliberately empty.
     *
     * This function exists as an explicit architectural reminder:
     * internal scrolling is allowed and must NEVER trigger
     * scene navigation.
     */
  }


  /* =========================================================
     08. TRANSITION OVERLAY
     ========================================================= */

  function getTransitionOverlay() {
    let overlay = byId("scene-transition");

    if (overlay) return overlay;

    overlay = document.createElement("div");

    overlay.id = "scene-transition";
    overlay.className = "scene-transition";
    overlay.setAttribute("aria-hidden", "true");

    document.body.appendChild(overlay);

    return overlay;
  }


  function transitionCover() {
    const overlay = getTransitionOverlay();

    if (!overlay) {
      return Promise.resolve();
    }

    overlay.classList.add("is-visible");

    const duration = state.reducedMotion
      ? 80
      : CONFIG.transition.duration / 2;

    return wait(duration);
  }


  function transitionReveal() {
    const overlay = getTransitionOverlay();

    if (!overlay) {
      return Promise.resolve();
    }

    overlay.classList.remove("is-visible");

    const duration = state.reducedMotion
      ? 50
      : CONFIG.transition.duration / 2;

    return wait(duration);
  }


  /* =========================================================
     09. GENERAL UTILITIES
     ========================================================= */

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }


  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }


  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }


  function isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0
    );
  }


  /* =========================================================
     10. AUDIO ENGINE
     ========================================================= */

  const audio = {
    music1: null,
    music2: null,

    initialized: false,

    init() {
      if (this.initialized) return;

      this.music1 = new Audio(CONFIG.audio.music1);
      this.music2 = new Audio(CONFIG.audio.music2);

      this.music1.preload = "auto";
      this.music2.preload = "auto";

      this.music1.loop = true;
      this.music2.loop = true;

      this.music1.volume = 0;
      this.music2.volume = 0;

      /*
       * Prevent browser from attempting to restore weird playback
       * states.
       */
      this.music1.autoplay = false;
      this.music2.autoplay = false;

      this.initialized = true;

      this.attachAudioDiagnostics();
    },

    attachAudioDiagnostics() {
      [this.music1, this.music2].forEach((track) => {
        if (!track) return;

        track.addEventListener("error", () => {
          /*
           * Audio failure must NEVER kill the website.
           */
          track.dataset.failed = "true";
        });
      });
    },

    async play(track) {
      if (!track) return false;

      try {
        await track.play();
        return true;
      } catch {
        /*
         * Browser may reject playback if user gesture was lost.
         * We intentionally do not throw.
         */
        return false;
      }
    },

    async fadeIn(track, targetVolume, duration) {
      if (!track) return false;

      const success = await this.play(track);

      if (!success) {
        return false;
      }

      const startVolume = track.volume;

      if (state.reducedMotion) {
        track.volume = targetVolume;
        return true;
      }

      const startTime = performance.now();

      return new Promise((resolve) => {
        const step = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = clamp(
            elapsed / duration,
            0,
            1
          );

          /*
           * Smooth ease-out.
           */
          const eased =
            1 - Math.pow(1 - progress, 3);

          track.volume =
            startVolume +
            (targetVolume - startVolume) * eased;

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            track.volume = targetVolume;
            resolve(true);
          }
        };

        requestAnimationFrame(step);
      });
    },

    async fadeOut(track, duration) {
      if (!track) return false;

      if (
        track.paused &&
        track.volume <= 0.001
      ) {
        track.volume = 0;
        return true;
      }

      if (state.reducedMotion) {
        track.volume = 0;

        try {
          track.pause();
        } catch {
          /* silent */
        }

        return true;
      }

      const startVolume = track.volume;
      const startTime = performance.now();

      return new Promise((resolve) => {
        const step = (currentTime) => {
          const elapsed = currentTime - startTime;

          const progress = clamp(
            elapsed / duration,
            0,
            1
          );

          const eased = progress * progress;

          track.volume =
            startVolume * (1 - eased);

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            track.volume = 0;

            try {
              track.pause();
              track.currentTime = 0;
            } catch {
              /* silent */
            }

            resolve(true);
          }
        };

        requestAnimationFrame(step);
      });
    },

    async startMusic1() {
      this.init();

      if (state.music1Started) {
        return;
      }

      state.music1Started = true;
      state.music1Stopped = false;

      this.music1.volume = 0;

      await this.fadeIn(
        this.music1,
        CONFIG.audio.music1Volume,
        CONFIG.audio.fadeInDuration
      );
    },

    async stopMusic1() {
      this.init();

      if (state.music1Stopped) {
        return;
      }

      state.music1Stopped = true;

      await this.fadeOut(
        this.music1,
        CONFIG.audio.fadeOutDuration
      );
    },

    async startMusic2() {
      this.init();

      if (state.music2Started) {
        return;
      }

      /*
       * Absolute safety:
       * music1 must be silent before music2 starts.
       */
      await this.stopMusic1();

      state.music2Started = true;

      this.music2.volume = 0;

      await this.fadeIn(
        this.music2,
        CONFIG.audio.music2Volume,
        CONFIG.audio.fadeInDuration
      );
    },

    async stopEverything() {
      this.init();

      await Promise.all([
        this.fadeOut(
          this.music1,
          CONFIG.audio.fadeOutDuration
        ),
        this.fadeOut(
          this.music2,
          CONFIG.audio.fadeOutDuration
        )
      ]);

      state.music1Stopped = true;
    }
  };


  /* =========================================================
     11. AUDIO BUTTON FALLBACK
     ---------------------------------------------------------
     Scene 1 -> Scene 2 is the user gesture that unlocks music.
     ========================================================= */

  async function ensureAudioUnlocked() {
    audio.init();

    /*
     * We do NOT attempt to play both tracks.
     * A silent, zero-volume play can still be problematic on
     * certain browsers and is unnecessary because Scene 1's
     * actual button click is already the user gesture.
     */
  }


  /* =========================================================
     12. SCENE ENTER HOOKS
     ========================================================= */

  async function onSceneEnter(number, previousNumber) {
    document.body.dataset.scene = String(number);

    updateSceneCounter(number);

    const scene = getScene(number);

    if (!scene) return;

    resetSceneScroll(scene);

    /*
     * Small semantic state.
     */
    scene.dataset.entered = "true";

    switch (number) {
      case 1:
        enterScene1();
        break;

      case 2:
        await enterScene2(previousNumber);
        break;

      case 3:
        enterScene3();
        break;

      case 4:
        enterScene4();
        break;

      case 5:
        enterScene5();
        break;

      case 6:
        enterScene6();
        break;

      case 7:
        enterScene7();
        break;

      case 8:
        enterScene8();
        break;

      case 9:
        await enterScene9();
        break;

      case 10:
        await enterScene10();
        break;

      default:
        break;
    }
  }


  /* =========================================================
     13. SCENE EXIT HOOKS
     ========================================================= */

  function onSceneExit(number, nextNumber) {
    const scene = getScene(number);

    if (!scene) return;

    scene.dataset.exited = "true";

    /*
     * Stop temporary scene-specific animation states.
     */
    if (number === 8 && nextNumber !== 8) {
      stopTypingAnimation();
    }
  }


  /* =========================================================
     14. MAIN SCENE NAVIGATION
     ========================================================= */

  async function goToScene(targetNumber, options = {}) {
    let target = Number(targetNumber);

    if (!Number.isFinite(target)) return false;

    target = clamp(
      Math.round(target),
      1,
      CONFIG.totalScenes
    );

    const targetScene = getScene(target);

    if (!targetScene) {
      console.warn(
        `[Bolu Ubi] Scene ${target} tidak ditemukan.`
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

    const previousNumber = state.currentScene;

    state.isTransitioning = true;
    state.userInteracted = true;

    /*
     * Special audio sequencing:
     *
     * Scene 9 = silence
     * Scene 10 = music2
     *
     * The actual music change happens during the transition,
     * never after Scene 10 has visibly appeared.
     */

    try {
      onSceneExit(
        previousNumber,
        target
      );

      /*
       * If going from Scene 9 -> Scene 10:
       * stop music1 BEFORE revealing Scene 10.
       */
      if (
        previousNumber === 9 &&
        target === 10
      ) {
        await audio.stopMusic1();
      }

      /*
       * Scene 1 -> Scene 2:
       * this click is the user's gesture.
       * Start music1 as early as possible.
       */
      if (
        previousNumber === 1 &&
        target === 2
      ) {
        await ensureAudioUnlocked();
        audio.startMusic1();
      }

      await transitionCover();

      scenes.forEach((scene) => {
        hideScene(scene);
      });

      showScene(targetScene);

      state.currentScene = target;

      /*
       * Store only current progress.
       * This is not used to automatically skip the story.
       */
      try {
        sessionStorage.setItem(
          CONFIG.storage.scene,
          String(target)
        );
      } catch {
        /* storage unavailable — no problem */
      }

      updateSceneCounter(target);

      await onSceneEnter(
        target,
        previousNumber
      );

      await wait(
        state.reducedMotion
          ? CONFIG.transition.minimumDelay
          : 90
      );

      await transitionReveal();

      /*
       * Music2 begins only after music1 is confirmed stopped.
       * The actual fade begins while Scene 10 is being revealed.
       */
      if (target === 10) {
        await audio.startMusic2();
      }

      return true;
    } finally {
      state.isTransitioning = false;
    }
  }


  /* =========================================================
     15. NEXT / PREVIOUS HELPERS
     ========================================================= */

  function nextScene() {
    return goToScene(
      state.currentScene + 1
    );
  }


  function previousScene() {
    return goToScene(
      state.currentScene - 1
    );
  }


  /* =========================================================
     16. NAVIGATION BUTTON DISCOVERY
     ========================================================= */

  function getNavigationTarget(button) {
    if (!button) return null;

    /*
     * Explicit data attributes have highest priority.
     */

    const explicit =
      button.dataset.sceneTarget ||
      button.dataset.goTo ||
      button.dataset.target;

    if (explicit !== undefined) {
      return explicit;
    }

    /*
     * data-next:
     *
     * data-next
     * data-next="5"
     */

    if (
      button.hasAttribute("data-next")
    ) {
      const value = button.dataset.next;

      if (
        value === undefined ||
        value === ""
      ) {
        return state.currentScene + 1;
      }

      return value;
    }

    /*
     * data-previous
     */

    if (
      button.hasAttribute("data-previous")
    ) {
      return state.currentScene - 1;
    }

    /*
     * Common fallback IDs.
     */

    const id = button.id || "";

    const nextMatch = id.match(
      /(?:next|continue|lanjut|open|start)[-_]?(\d+)/i
    );

    if (nextMatch) {
      return nextMatch[1];
    }

    return null;
  }


  function bindNavigationButtons() {
    const buttons = $$(
      [
        "[data-next]",
        "[data-scene-target]",
        "[data-go-to]",
        "[data-target]",
        "[data-previous]",
        ".js-next-scene",
        ".js-scene-next",
        ".scene-next",
        ".next-scene",
        ".continue-button",
        ".scene-button"
      ].join(",")
    );

    buttons.forEach((button) => {
      if (button.dataset.navigationBound === "true") {
        return;
      }

      button.dataset.navigationBound = "true";

      button.addEventListener("click", async (event) => {
        /*
         * Only prevent default when this is clearly a navigation
         * control. We don't want to break ordinary links.
         */

        const target = getNavigationTarget(button);

        if (target === null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const targetValue = String(target)
          .trim()
          .toLowerCase();

        if (
          targetValue === "next"
        ) {
          await nextScene();
          return;
        }

        if (
          targetValue === "previous" ||
          targetValue === "prev"
        ) {
          await previousScene();
          return;
        }

        await goToScene(
          Number(targetValue)
        );
      });
    });
  }


  /* =========================================================
     17. FALLBACK SCENE BUTTONS
     ---------------------------------------------------------
     If the HTML contains a scene with no explicit data-next,
     we can still recognize common IDs.
     ========================================================= */

  function bindFallbackSceneButtons() {
    const mappings = {
      "open-button": 2,
      "opening-button": 2,
      "btn-open": 2,
      "open-story": 2,

      "scene1-next": 2,
      "scene-1-next": 2,

      "scene2-next": 3,
      "scene-2-next": 3,

      "scene3-next": 4,
      "scene-3-next": 4,

      "scene4-next": 5,
      "scene-4-next": 5,

      "scene5-next": 6,
      "scene-5-next": 6,

      "scene6-next": 7,
      "scene-6-next": 7,

      "scene7-next": 8,
      "scene-7-next": 8,

      "scene8-next": 9,
      "scene-8-next": 9,

      "scene9-next": 10,
      "scene-9-next": 10
    };

    Object.entries(mappings).forEach(
      ([id, target]) => {
        const button = byId(id);

        if (!button) return;

        if (
          button.dataset.navigationBound === "true"
        ) {
          return;
        }

        button.dataset.navigationBound = "true";

        button.addEventListener(
          "click",
          async (event) => {
            event.preventDefault();
            event.stopPropagation();

            await goToScene(target);
          }
        );
      }
    );
  }


  /* =========================================================
     18. SCENE 1
     ---------------------------------------------------------
     Opening.
     ========================================================= */

  function enterScene1() {
    const scene = getScene(1);

    if (!scene) return;

    /*
     * Reset opening-specific animation states.
     */

    $$(
      ".opening-reveal, [data-opening-reveal]",
      scene
    ).forEach((element, index) => {
      element.style.setProperty(
        "--reveal-index",
        String(index)
      );

      element.classList.remove(
        "is-visible"
      );

      requestAnimationFrame(() => {
        element.classList.add(
          "is-visible"
        );
      });
    });
  }


  /* =========================================================
     19. SCENE 2
     ---------------------------------------------------------
     Birthday + mathematics.
     ========================================================= */

  async function enterScene2(previousNumber) {
    const scene = getScene(2);

    if (!scene) return;

    /*
     * Make math typesetting robust if MathJax exists.
     */

    await typesetMath(scene);

    /*
     * Scene 2 decorative reveal.
     */

    const revealElements = $$(
      "[data-scene2-reveal], .scene2-reveal",
      scene
    );

    revealElements.forEach((element, index) => {
      element.style.setProperty(
        "--reveal-index",
        String(index)
      );

      element.classList.remove(
        "is-visible"
      );

      window.setTimeout(
        () => {
          element.classList.add(
            "is-visible"
          );
        },
        state.reducedMotion
          ? 0
          : 120 + index * 130
      );
    });

    /*
     * Ensure stickers do not accidentally receive focus.
     */
    $(
      "img[alt=''], img.decorative, .sticker",
      scene
    )?.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  async function typesetMath(container) {
    if (!container) return;

    /*
     * MathJax 3
     */
    if (
      window.MathJax &&
      typeof window.MathJax.typesetPromise === "function"
    ) {
      try {
        await window.MathJax.typesetPromise(
          [container]
        );
      } catch (error) {
        console.warn(
          "[Bolu Ubi] MathJax typesetting failed:",
          error
        );
      }

      return;
    }

    /*
     * KaTeX fallback if the HTML uses renderMathInElement.
     */
    if (
      window.katex &&
      typeof window.renderMathInElement === "function"
    ) {
      try {
        window.renderMathInElement(
          container,
          {
            delimiters: [
              {
                left: "$$",
                right: "$$",
                display: true
              },
              {
                left: "\\[",
                right: "\\]",
                display: true
              },
              {
                left: "\\(",
                right: "\\)",
                display: false
              }
            ]
          }
        );
      } catch (error) {
        console.warn(
          "[Bolu Ubi] KaTeX rendering failed:",
          error
        );
      }
    }
  }


  /* =========================================================
     20. SCENE 3
     ---------------------------------------------------------
     Flashback / timeline.
     ========================================================= */

  function enterScene3() {
    const scene = getScene(3);

    if (!scene) return;

    const timelineItems = $$(
      "[data-timeline-item], .timeline-item",
      scene
    );

    timelineItems.forEach(
      (item, index) => {
        item.style.setProperty(
          "--timeline-index",
          String(index)
        );

        item.classList.remove(
          "is-revealed"
        );

        window.setTimeout(
          () => {
            item.classList.add(
              "is-revealed"
            );
          },
          state.reducedMotion
            ? 0
            : 180 + index * 230
        );
      }
    );

    /*
     * Highlight "kita flashback dl kali yee"
     * without forcing a dramatic animation.
     */

    const flashbackPhrase = $$(
      "[data-flashback], .flashback-highlight",
      scene
    );

    flashbackPhrase.forEach(
      (element) => {
        element.classList.add(
          "is-active"
        );
      }
    );
  }


  /* =========================================================
     21. SCENE 4
     ---------------------------------------------------------
     Subtle observations / traits.
     ========================================================= */

  function enterScene4() {
    const scene = getScene(4);

    if (!scene) return;

    const traitItems = $$(
      "[data-trait]",
      scene
    );

    traitItems.forEach((item, index) => {
      const button = $(
        "[data-trait-toggle], button, .trait-button",
        item
      );

      if (!button) return;

      /*
       * Initial state.
       */
      const content = $(
        "[data-trait-content], .trait-content",
        item
      );

      if (content) {
        content.hidden = !item.classList.contains(
          "is-open"
        );
      }

      button.setAttribute(
        "aria-expanded",
        String(
          item.classList.contains("is-open")
        )
      );

      button.style.setProperty(
        "--trait-index",
        String(index)
      );
    });
  }


  function toggleTrait(item) {
    if (!item) return;

    const key =
      item.dataset.trait ||
      item.id ||
      `trait-${Math.random()}`;

    const isOpen =
      item.classList.contains("is-open");

    const button = $(
      "[data-trait-toggle], button, .trait-button",
      item
    );

    const content = $(
      "[data-trait-content], .trait-content",
      item
    );

    if (isOpen) {
      item.classList.remove(
        "is-open"
      );

      state.revealedTraits.delete(key);

      if (content) {
        content.hidden = true;
      }

      button?.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    /*
     * Open.
     */
    item.classList.add("is-open");

    state.revealedTraits.add(key);

    if (content) {
      content.hidden = false;
    }

    button?.setAttribute(
      "aria-expanded",
      "true"
    );

    /*
     * A tiny tactile effect.
     */
    if (!state.reducedMotion) {
      item.classList.remove(
        "just-opened"
      );

      requestAnimationFrame(() => {
        item.classList.add(
          "just-opened"
        );
      });
    }
  }


  function bindTraitButtons() {
    const traitItems = $$(
      "[data-trait]"
    );

    traitItems.forEach((item) => {
      const button = $(
        "[data-trait-toggle], button, .trait-button",
        item
      );

      if (!button) return;

      if (
        button.dataset.traitBound === "true"
      ) {
        return;
      }

      button.dataset.traitBound = "true";

      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          toggleTrait(item);
        }
      );
    });
  }


  /* =========================================================
     22. SCENE 5
     ---------------------------------------------------------
     Shared memories / hydroponics side quest.
     ========================================================= */

  function enterScene5() {
    const scene = getScene(5);

    if (!scene) return;

    const memoryCards = $$(
      "[data-memory]",
      scene
    );

    memoryCards.forEach(
      (card, index) => {
        card.style.setProperty(
          "--memory-index",
          String(index)
        );
      }
    );
  }


  function toggleMemory(memory) {
    if (!memory) return;

    const key =
      memory.dataset.memory ||
      memory.id ||
      `memory-${Date.now()}`;

    const isOpen =
      memory.classList.contains("is-open");

    const content = $(
      "[data-memory-content], .memory-content",
      memory
    );

    const button = $(
      "[data-memory-toggle], button, .memory-button",
      memory
    );

    if (isOpen) {
      memory.classList.remove(
        "is-open"
      );

      state.openedMemories.delete(key);

      if (content) {
        content.hidden = true;
      }

      button?.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    memory.classList.add("is-open");

    state.openedMemories.add(key);

    if (content) {
      content.hidden = false;
    }

    button?.setAttribute(
      "aria-expanded",
      "true"
    );
  }


  function bindMemoryButtons() {
    const memories = $$(
      "[data-memory]"
    );

    memories.forEach((memory) => {
      const button = $(
        "[data-memory-toggle], button, .memory-button",
        memory
      );

      if (!button) return;

      if (
        button.dataset.memoryBound === "true"
      ) {
        return;
      }

      button.dataset.memoryBound = "true";

      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          toggleMemory(memory);
        }
      );
    });
  }


  /* =========================================================
     23. HYDROPONICS
     ========================================================= */

  function getHydroponicsElements() {
    const scene = getScene(5);

    if (!scene) {
      return {
        root: null,
        button: null,
        content: null
      };
    }

    const root =
      $(
        "[data-hydroponics]",
        scene
      ) ||
      $(
        ".hydroponics",
        scene
      ) ||
      scene;

    const button =
      $(
        "[data-hydroponics-toggle]",
        root
      ) ||
      $(
        ".hydroponics-toggle",
        root
      ) ||
      $(
        "button[data-memory='hydroponics']",
        root
      );

    const content =
      $(
        "[data-hydroponics-content]",
        root
      ) ||
      $(
        ".hydroponics-content",
        root
      );

    return {
      root,
      button,
      content
    };
  }


  function toggleHydroponics() {
    const {
      root,
      button,
      content
    } = getHydroponicsElements();

    if (!root) return;

    const isOpen =
      root.classList.contains(
        "is-open"
      );

    if (isOpen) {
      root.classList.remove(
        "is-open"
      );

      state.hydroponicsOpened = false;

      if (content) {
        content.hidden = true;
      }

      button?.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    root.classList.add(
      "is-open"
    );

    state.hydroponicsOpened = true;

    if (content) {
      content.hidden = false;
    }

    button?.setAttribute(
      "aria-expanded",
      "true"
    );

    /*
     * Animate individual pieces if present.
     */
    const pieces = $$(
      "[data-hydroponics-piece]",
      root
    );

    pieces.forEach(
      (piece, index) => {
        window.setTimeout(
          () => {
            piece.classList.add(
              "is-visible"
            );
          },
          state.reducedMotion
            ? 0
            : index * 100
        );
      }
    );
  }


  function bindHydroponics() {
    const {
      button
    } = getHydroponicsElements();

    if (!button) return;

    if (
      button.dataset.hydroponicsBound === "true"
    ) {
      return;
    }

    button.dataset.hydroponicsBound = "true";

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        toggleHydroponics();
      }
    );
  }


  /* =========================================================
     24. SCENE 6
     ---------------------------------------------------------
     Photo / realization.
     ========================================================= */

  function enterScene6() {
    const scene = getScene(6);

    if (!scene) return;

    const photo =
      $(
        "[data-tata-photo]",
        scene
      ) ||
      $(
        ".tata-photo",
        scene
      ) ||
      $(
        ".photo-frame img",
        scene
      ) ||
      $(
        "img",
        scene
      );

    if (photo) {
      /*
       * Defensive image behavior.
       *
       * CSS should also handle this, but JS helps when an image
       * loads after the scene enters.
       */
      photo.addEventListener(
        "load",
        () => {
          photo.classList.add(
            "is-loaded"
          );
        },
        { once: true }
      );

      if (photo.complete) {
        photo.classList.add(
          "is-loaded"
        );
      }
    }

    const photoFrame =
      $(
        "[data-photo-frame]",
        scene
      ) ||
      $(
        ".photo-frame",
        scene
      );

    if (photoFrame) {
      photoFrame.classList.add(
        "is-entered"
      );
    }
  }


  /* =========================================================
     25. SCENE 7
     ---------------------------------------------------------
     Emotional temperature shift.
     ========================================================= */

  function enterScene7() {
    const scene = getScene(7);

    if (!scene) return;

    /*
     * Remove "playful" state from previous scenes if the CSS
     * uses it globally.
     */
    document.body.classList.add(
      "entering-serious-tone"
    );

    const elements = $$(
      "[data-serious-reveal], .serious-reveal",
      scene
    );

    elements.forEach(
      (element, index) => {
        element.classList.remove(
          "is-visible"
        );

        window.setTimeout(
          () => {
            element.classList.add(
              "is-visible"
            );
          },
          state.reducedMotion
            ? 0
            : 180 + index * 180
        );
      }
    );
  }


  /* =========================================================
     26. SCENE 8
     ---------------------------------------------------------
     Long birthday letter + natural typing.
     ========================================================= */

  let typingController = null;


  function getLetterElements() {
    const scene = getScene(8);

    if (!scene) {
      return {
        container: null,
        target: null,
        source: null,
        cursor: null
      };
    }

    const container =
      $(
        "[data-letter]",
        scene
      ) ||
      $(
        ".letter",
        scene
      ) ||
      scene;

    const target =
      $(
        "[data-letter-output]",
        container
      ) ||
      $(
        ".letter-output",
        container
      ) ||
      $(
        ".typing-output",
        container
      );

    const source =
      $(
        "[data-letter-source]",
        container
      );

    const cursor =
      $(
        "[data-typing-cursor]",
        container
      ) ||
      $(
        ".typing-cursor",
        container
      );

    return {
      container,
      target,
      source,
      cursor
    };
  }


  /*
   * We support two approaches:
   *
   * 1. The HTML contains:
   *    data-letter-source
   *
   * 2. The HTML contains:
   *    data-letter-text
   *
   * This lets the JS remain compatible with slightly different
   * HTML implementations.
   */

  function getLetterText() {
    const {
      container,
      source
    } = getLetterElements();

    if (!container) return "";

    if (source) {
      return source.textContent.trim();
    }

    if (
      container.dataset.letterText
    ) {
      return container.dataset.letterText;
    }

    return "";
  }


  function normalizeLetterText(text) {
    if (!text) return "";

    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }


  function getTypingDelay(character, previousCharacter) {
    if (state.reducedMotion) {
      return 0;
    }

    let delay = randomBetween(
      CONFIG.typing.baseSpeed * 0.55,
      CONFIG.typing.baseSpeed * 1.45
    );

    /*
     * Spaces:
     * slightly faster.
     */
    if (character === " ") {
      delay *= 0.45;
    }

    /*
     * Commas.
     */
    if (
      character === "," ||
      character === ";"
    ) {
      delay += CONFIG.typing.commaPause;
    }

    /*
     * Strong punctuation.
     */
    if (
      character === "." ||
      character === "!" ||
      character === "?" ||
      character === "😭" ||
      character === "🥺" ||
      character === "🤍"
    ) {
      delay += CONFIG.typing.punctuationPause;
    }

    /*
     * New paragraph.
     */
    if (
      character === "\n" &&
      previousCharacter === "\n"
    ) {
      delay += CONFIG.typing.paragraphPause;
    }

    /*
     * Longer pause around emotional lines.
     */
    if (
      previousCharacter === "…" ||
      character === "…"
    ) {
      delay += CONFIG.typing.emotionalPause;
    }

    return clamp(
      delay,
      CONFIG.typing.minimumSpeed,
      CONFIG.typing.maximumSpeed +
        CONFIG.typing.emotionalPause
    );
  }


  function shouldPauseAfterLine(line) {
    if (!line) return false;

    const clean = line.trim();

    if (!clean) return true;

    const emotionalFragments = [
      "I hope you remember",
      "aku masih di sini",
      "HABEDEEE TALITAAA",
      "my biggest wish",
      "Semoga km tetap",
      "semoga km terus"
    ];

    return emotionalFragments.some(
      (fragment) =>
        clean.includes(fragment)
    );
  }


  function prepareTypingText(target, rawText) {
    if (!target) return;

    /*
     * We need to preserve:
     * - line breaks
     * - emojis
     * - punctuation
     *
     * textContent is deliberately used instead of innerHTML.
     * This avoids accidental HTML injection and keeps the letter
     * purely textual.
     */
    target.textContent = "";

    /*
     * Hide source if it is a hidden template.
     */
    const {
      source
    } = getLetterElements();

    if (source) {
      source.hidden = true;
      source.setAttribute(
        "aria-hidden",
        "true"
      );
    }
  }


  function stopTypingAnimation() {
    if (
      typingController &&
      typeof typingController.abort === "function"
    ) {
      typingController.abort();
    }

    typingController = null;
  }


  async function typeLetter() {
    const {
      container,
      target,
      cursor
    } = getLetterElements();

    if (!container || !target) {
      return false;
    }

    const rawText =
      getLetterText();

    const text =
      normalizeLetterText(rawText);

    if (!text) {
      console.warn(
        "[Bolu Ubi] Letter text tidak ditemukan."
      );

      return false;
    }

    stopTypingAnimation();

    const controller =
      new AbortController();

    typingController = controller;

    prepareTypingText(
      target,
      text
    );

    if (cursor) {
      cursor.classList.add(
        "is-active"
      );
    }

    container.classList.add(
      "typing"
    );

    state.letterStarted = true;
    state.letterFinished = false;

    let output = "";

    /*
     * We process characters rather than words so the typing feels
     * alive, but paragraph breaks receive special treatment.
     */
    for (
      let index = 0;
      index < text.length;
      index++
    ) {
      if (
        controller.signal.aborted
      ) {
        return false;
      }

      const character =
        text[index];

      const previousCharacter =
        text[index - 1] || "";

      output += character;

      target.textContent = output;

      /*
       * Keep the latest text visible in long letter.
       *
       * We intentionally do NOT force scroll on every character
       * because that makes the experience feel mechanical.
       */
      if (
        character === "\n" &&
        text[index + 1] === "\n"
      ) {
        if (
          shouldPauseAfterLine(
            output.split("\n").at(-2)
          )
        ) {
          await wait(
            state.reducedMotion
              ? 0
              : CONFIG.typing.emotionalPause
          );
        }
      }

      const delay =
        getTypingDelay(
          character,
          previousCharacter
        );

      await wait(delay);
    }

    if (
      controller.signal.aborted
    ) {
      return false;
    }

    state.letterFinished = true;

    if (cursor) {
      cursor.classList.remove(
        "is-active"
      );

      cursor.classList.add(
        "is-finished"
      );
    }

    container.classList.remove(
      "typing"
    );

    container.classList.add(
      "typing-finished"
    );

    typingController = null;

    return true;
  }


  function enterScene8() {
    const scene = getScene(8);

    if (!scene) return;

    document.body.classList.add(
      "letter-mode"
    );

    const intro =
      $(
        "[data-letter-intro]",
        scene
      ) ||
      $(
        ".letter-intro",
        scene
      );

    if (intro) {
      intro.classList.add(
        "is-visible"
      );
    }

    /*
     * Only start once.
     */
    if (!state.letterStarted) {
      /*
       * Let Scene 8 breathe for a moment before typing.
       */
      window.setTimeout(
        () => {
          if (
            state.currentScene === 8
          ) {
            typeLetter();
          }
        },
        state.reducedMotion
          ? 0
          : 700
      );
    }
  }


  /* =========================================================
     27. SCENE 9
     ---------------------------------------------------------
     Silence / breath.
     ========================================================= */

  async function enterScene9() {
    const scene = getScene(9);

    if (!scene) return;

    /*
     * Music1 must be completely gone.
     */
    await audio.stopMusic1();

    document.body.classList.add(
      "quiet-mode"
    );

    const elements = $$(
      "[data-quiet-reveal], .quiet-reveal",
      scene
    );

    elements.forEach(
      (element, index) => {
        element.classList.remove(
          "is-visible"
        );

        window.setTimeout(
          () => {
            element.classList.add(
              "is-visible"
            );
          },
          state.reducedMotion
            ? 0
            : 300 + index * 320
        );
      }
    );
  }


  /* =========================================================
     28. SCENE 10
     ---------------------------------------------------------
     Climax + continuation.
     ========================================================= */

  async function enterScene10() {
    const scene = getScene(10);

    if (!scene) return;

    document.body.classList.add(
      "climax-mode"
    );

    document.body.classList.remove(
      "quiet-mode"
    );

    state.climaxOpened = false;
    state.epilogueShown = false;

    /*
     * Reveal the visual layer gradually.
     */
    const elements = $$(
      "[data-climax-reveal], .climax-reveal",
      scene
    );

    elements.forEach(
      (element, index) => {
        element.classList.remove(
          "is-visible"
        );

        window.setTimeout(
          () => {
            element.classList.add(
              "is-visible"
            );
          },
          state.reducedMotion
            ? 0
            : 300 + index * 220
        );
      }
    );

    /*
     * Music2 is started by goToScene() after music1 has been
     * stopped and Scene 10 has become active.
     */
  }


  /* =========================================================
     29. CLIMAX INTERACTION
     ---------------------------------------------------------
     No manipulative yes/no trap.
     The interaction should feel like opening a new chapter.
     ========================================================= */

  function getClimaxElements() {
    const scene = getScene(10);

    if (!scene) {
      return {
        root: null,
        trigger: null,
        answer: null,
        epilogue: null
      };
    }

    const root =
      $(
        "[data-climax]",
        scene
      ) ||
      $(
        ".climax",
        scene
      ) ||
      scene;

    const trigger =
      $(
        "[data-climax-open]",
        root
      ) ||
      $(
        ".climax-open",
        root
      ) ||
      $(
        "#climax-button",
        root
      );

    const answer =
      $(
        "[data-climax-answer]",
        root
      ) ||
      $(
        ".climax-answer",
        root
      );

    const epilogue =
      $(
        "[data-epilogue]",
        root
      ) ||
      $(
        ".epilogue",
        root
      );

    return {
      root,
      trigger,
      answer,
      epilogue
    };
  }


  function revealClimax() {
    const {
      root,
      trigger,
      answer,
      epilogue
    } = getClimaxElements();

    if (!root) return;

    if (state.climaxOpened) {
      return;
    }

    state.climaxOpened = true;

    root.classList.add(
      "is-open"
    );

    if (trigger) {
      trigger.setAttribute(
        "aria-expanded",
        "true"
      );

      trigger.classList.add(
        "is-used"
      );
    }

    if (answer) {
      answer.hidden = false;

      window.setTimeout(
        () => {
          answer.classList.add(
            "is-visible"
          );
        },
        state.reducedMotion
          ? 0
          : 220
      );
    }

    /*
     * Epilogue is deliberately delayed.
     *
     * The website should not immediately jump from "answer"
     * into another block of text.
     */
    if (epilogue) {
      epilogue.hidden = true;

      window.setTimeout(
        () => {
          epilogue.hidden = false;

          window.requestAnimationFrame(
            () => {
              epilogue.classList.add(
                "is-visible"
              );

              state.epilogueShown = true;
            }
          );
        },
        state.reducedMotion
          ? 0
          : 1700
      );
    }
  }


  function bindClimax() {
    const {
      trigger
    } = getClimaxElements();

    if (!trigger) return;

    if (
      trigger.dataset.climaxBound === "true"
    ) {
      return;
    }

    trigger.dataset.climaxBound = "true";

    trigger.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        revealClimax();
      }
    );
  }


  /* =========================================================
     30. EPILOGUE INTERACTION
     ========================================================= */

  function bindEpilogue() {
    const scene = getScene(10);

    if (!scene) return;

    const buttons = $$(
      "[data-epilogue-action]",
      scene
    );

    buttons.forEach((button) => {
      if (
        button.dataset.epilogueBound === "true"
      ) {
        return;
      }

      button.dataset.epilogueBound = "true";

      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          const action =
            button.dataset.epilogueAction;

          handleEpilogueAction(
            action,
            button
          );
        }
      );
    });
  }


  function handleEpilogueAction(
    action,
    button
  ) {
    switch (action) {
      case "restart":
        restartExperience();
        break;

      case "replay-letter":
        replayLetter();
        break;

      case "stay":
        /*
         * This is intentionally quiet.
         * No forced navigation.
         */
        button?.classList.add(
          "is-selected"
        );
        break;

      default:
        /*
         * Allow HTML to define a scene target.
         */
        if (
          button?.dataset.sceneTarget
        ) {
          goToScene(
            Number(
              button.dataset.sceneTarget
            )
          );
        }

        break;
    }
  }


  /* =========================================================
     31. REPLAY LETTER
     ========================================================= */

  async function replayLetter() {
    const targetScene = getScene(8);

    if (!targetScene) return;

    /*
     * Reset typing state.
     */
    state.letterStarted = false;
    state.letterFinished = false;

    await goToScene(8, {
      force: true
    });
  }


  /* =========================================================
     32. RESTART
     ========================================================= */

  async function restartExperience() {
    stopTypingAnimation();

    await audio.stopEverything();

    state.currentScene = 1;
    state.music1Started = false;
    state.music2Started = false;
    state.music1Stopped = false;

    state.letterStarted = false;
    state.letterFinished = false;

    state.revealedTraits.clear();
    state.openedMemories.clear();

    state.hydroponicsOpened = false;
    state.climaxOpened = false;
    state.epilogueShown = false;

    document.body.classList.remove(
      "letter-mode",
      "quiet-mode",
      "climax-mode",
      "entering-serious-tone"
    );

    try {
      sessionStorage.removeItem(
        CONFIG.storage.scene
      );
    } catch {
      /* silent */
    }

    scenes.forEach(hideScene);

    const firstScene = getScene(1);

    if (firstScene) {
      showScene(firstScene);
    }

    updateSceneCounter(1);
  }


  /* =========================================================
     33. KEYBOARD ACCESSIBILITY
     ---------------------------------------------------------
     Keyboard can navigate scenes without introducing scroll
     navigation.
     ========================================================= */

  function bindKeyboardNavigation() {
    document.addEventListener(
      "keydown",
      (event) => {
        /*
         * Don't hijack typing.
         */
        const activeElement =
          document.activeElement;

        const isTypingField =
          activeElement &&
          (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
          );

        if (isTypingField) {
          return;
        }

        /*
         * Escape closes local interactive elements.
         */
        if (event.key === "Escape") {
          closeOpenLocalInteractions();
          return;
        }

        /*
         * Arrow navigation.
         *
         * Deliberately NOT tied to wheel/scroll.
         */
        if (
          event.key === "ArrowRight" ||
          event.key === "PageDown"
        ) {
          event.preventDefault();

          if (
            !state.isTransitioning
          ) {
            nextScene();
          }

          return;
        }

        if (
          event.key === "ArrowLeft" ||
          event.key === "PageUp"
        ) {
          event.preventDefault();

          if (
            !state.isTransitioning
          ) {
            previousScene();
          }

          return;
        }
      }
    );
  }


  function closeOpenLocalInteractions() {
    /*
     * Close trait cards.
     */
    $$(".is-open[data-trait]").forEach(
      (item) => {
        toggleTrait(item);
      }
    );

    /*
     * Close memory cards.
     */
    $$(".is-open[data-memory]").forEach(
      (item) => {
        toggleMemory(item);
      }
    );

    /*
     * Hydroponics.
     */
    const {
      root
    } = getHydroponicsElements();

    if (
      root?.classList.contains(
        "is-open"
      )
    ) {
      toggleHydroponics();
    }
  }


  /* =========================================================
     34. BUTTON PRESS MICRO-INTERACTION
     ---------------------------------------------------------
     Small tactile response without excessive effects.
     ========================================================= */

  function bindButtonFeedback() {
    const buttons = $$(
      "button, [role='button']"
    );

    buttons.forEach((button) => {
      if (
        button.dataset.feedbackBound === "true"
      ) {
        return;
      }

      button.dataset.feedbackBound = "true";

      button.addEventListener(
        "pointerdown",
        () => {
          button.classList.add(
            "is-pressing"
          );
        }
      );

      const release = () => {
        button.classList.remove(
          "is-pressing"
        );
      };

      button.addEventListener(
        "pointerup",
        release
      );

      button.addEventListener(
        "pointercancel",
        release
      );

      button.addEventListener(
        "pointerleave",
        release
      );
    });
  }


  /* =========================================================
     35. STICKER HANDLING
     ---------------------------------------------------------
     Decorative only.
     No stickers should accidentally interfere with clicks.
     ========================================================= */

  function initializeStickers() {
    const stickers = $$(
      "img[src*='stiker'], .sticker, [data-sticker]"
    );

    stickers.forEach(
      (sticker, index) => {
        sticker.setAttribute(
          "draggable",
          "false"
        );

        /*
         * If not explicitly interactive, make decorative.
         */
        if (
          !sticker.hasAttribute(
            "data-interactive"
          )
        ) {
          sticker.setAttribute(
            "aria-hidden",
            "true"
          );
        }

        sticker.style.setProperty(
          "--sticker-index",
          String(index)
        );
      }
    );
  }


  /* =========================================================
     36. IMAGE LOADING
     ---------------------------------------------------------
     Prevent images from causing weird "empty" states.
     ========================================================= */

  function initializeImages() {
    const images = $$("img");

    images.forEach((image) => {
      image.addEventListener(
        "load",
        () => {
          image.classList.add(
            "is-loaded"
          );
        },
        { once: true }
      );

      image.addEventListener(
        "error",
        () => {
          image.classList.add(
            "is-broken"
          );

          /*
           * Don't throw.
           */
          console.warn(
            `[Bolu Ubi] Gambar gagal dimuat: ${image.src}`
          );
        },
        { once: true }
      );

      if (image.complete) {
        if (
          image.naturalWidth > 0
        ) {
          image.classList.add(
            "is-loaded"
          );
        }
      }
    });
  }


  /* =========================================================
     37. RESIZE / VIEWPORT
     --------------------------------------------------------- */

  let resizeTimer = null;

  function handleResize() {
    document.documentElement.style.setProperty(
      "--viewport-height",
      `${window.innerHeight}px`
    );

    /*
     * We deliberately do NOT recalculate scene navigation.
     */
  }


  function bindResize() {
    handleResize();

    window.addEventListener(
      "resize",
      () => {
        window.clearTimeout(
          resizeTimer
        );

        resizeTimer = window.setTimeout(
          handleResize,
          100
        );
      },
      {
        passive: true
      }
    );
  }


  /* =========================================================
     38. VISIBILITY CHANGE
     ---------------------------------------------------------
     We do not restart music unexpectedly when tab returns.
     Browser controls audio state.
     ========================================================= */

  function bindVisibilityHandling() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.hidden
        ) {
          return;
        }

        /*
         * No automatic play call here.
         *
         * This avoids browsers interpreting the return from a
         * background tab as an unauthorized autoplay attempt.
         */
      }
    );
  }


  /* =========================================================
     39. PAGE LIFECYCLE
     ========================================================= */

  function initializeInitialScene() {
    collectScenes();

    if (!scenes.length) {
      console.error(
        "[Bolu Ubi] Tidak ada scene yang ditemukan."
      );

      return;
    }

    /*
     * Always begin from Scene 1.
     *
     * We intentionally do NOT restore the previous scene from
     * storage because this is a story website. Refreshing should
     * return the user to the opening rather than dropping them
     * into the middle of the emotional arc.
     */
    const initialScene =
      getScene(1) ||
      scenes[0];

    scenes.forEach(hideScene);

    showScene(initialScene);

    state.currentScene =
      getSceneNumber(initialScene) || 1;

    updateSceneCounter(
      state.currentScene
    );

    document.body.dataset.scene =
      String(state.currentScene);
  }


  /* =========================================================
     40. INITIALIZATION
     ========================================================= */

  async function initialize() {
    /*
     * Defensive global initialization.
     *
     * Every subsystem is isolated so one optional feature
     * cannot destroy the rest of the website.
     */

    try {
      initializeInitialScene();
    } catch (error) {
      console.error(
        "[Bolu Ubi] Scene initialization error:",
        error
      );
    }

    try {
      audio.init();
    } catch (error) {
      console.warn(
        "[Bolu Ubi] Audio initialization failed:",
        error
      );
    }

    try {
      bindNavigationButtons();
      bindFallbackSceneButtons();
    } catch (error) {
      console.error(
        "[Bolu Ubi] Navigation initialization error:",
        error
      );
    }

    try {
      bindTraitButtons();
      bindMemoryButtons();
      bindHydroponics();
      bindClimax();
      bindEpilogue();
    } catch (error) {
      console.error(
        "[Bolu Ubi] Interactive component error:",
        error
      );
    }

    try {
      bindKeyboardNavigation();
      bindButtonFeedback();
    } catch (error) {
      console.warn(
        "[Bolu Ubi] Accessibility initialization error:",
        error
      );
    }

    try {
      initializeStickers();
      initializeImages();
    } catch (error) {
      console.warn(
        "[Bolu Ubi] Media initialization error:",
        error
      );
    }

    try {
      bindResize();
      bindVisibilityHandling();
    } catch (error) {
      console.warn(
        "[Bolu Ubi] Viewport initialization error:",
        error
      );
    }

    /*
     * Enter Scene 1 after everything is bound.
     */
    try {
      await onSceneEnter(
        state.currentScene,
        null
      );
    } catch (error) {
      console.error(
        "[Bolu Ubi] Initial scene hook error:",
        error
      );
    }

    /*
     * Expose a very small debugging interface.
     *
     * This does NOT affect normal use.
     */
    window.BoluUbi = {
      goToScene,
      nextScene,
      previousScene,

      getState: () => ({
        ...state,
        revealedTraits: [
          ...state.revealedTraits
        ],
        openedMemories: [
          ...state.openedMemories
        ]
      }),

      audio,

      replayLetter,
      restartExperience
    };
  }


  /* =========================================================
     41. DOM READY
     ========================================================= */

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