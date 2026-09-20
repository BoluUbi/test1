/* =========================================================
   BOLU UBI 🐣
   script.js
   ---------------------------------------------------------
   JS = TIMING + INTERACTION + EMOTIONAL CHOREOGRAPHY

   Prinsip:
   - Scroll = membaca
   - Button / intentional action = berpindah scene
   - Tidak ada scene navigation berbasis scroll
   - Music 1 = perjalanan
   - Silence = threshold
   - Music 2 = confession
   - Typing = intimacy
   - Scene 9 = breath
   - Scene 10 = "my turn"
   - Epilogue = afterglow, bukan ending mendadak

   Designed to work with semantic scene markup:
   <section class="scene scene--opening"
            data-scene="opening"
            id="scene-opening">

   Navigation:
   data-next="scene-id"
   data-prev="scene-id"
   data-go="scene-id"

   Audio:
   <audio id="music1" ...>
   <audio id="music2" ...>

   Optional:
   data-typing
   data-typing-speed="..."
   data-typing-delay="..."
   data-delay="..."
   data-start-journey
   data-confession
   data-afterglow
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     00. GLOBAL CONFIG
     ======================================================= */

  const CONFIG = Object.freeze({
    selectors: {
      root: "#app",
      scenes: ".scene",
      sceneScroller:
        ".scene__scroll, .scene-scroll, .scene__body, .scene-body, .scene-content, .scene__content",

      audio1:
        "#music1, audio[data-music='music1'], audio[data-track='music1']",

      audio2:
        "#music2, audio[data-music='music2'], audio[data-track='music2']",

      typing:
        "[data-typing]",

      hydroponics:
        "[data-hydroponics], #hydroponics, .hydroponics-card, .js-hydroponics",

      photo:
        "[data-photo], .photo-frame img, .memory-photo img",

      startJourney:
        "[data-start-journey], .js-start-journey",

      confession:
        "[data-confession], .js-confession",

      afterglow:
        "[data-afterglow], .js-afterglow"
    },

    scenes: {
      opening: "opening",
      birthday: "birthday",
      flashback: "flashback",
      traits: "traits",
      memories: "memories",
      photo: "photo",
      serious: "serious",
      letter: "letter",
      breath: "breath",
      confession: "confession",
      afterglow: "afterglow"
    },

    audio: {
      music1Volume: 0.48,
      music2Volume: 0.58,

      fadeInMs: 1800,
      fadeOutMs: 1200,

      silenceBeforeMusic2Ms: 900,

      // Jangan terlalu cepat memotong emotional breath.
      confessionTransitionMs: 1050
    },

    typing: {
      defaultSpeed: 26,
      minimumSpeed: 12,
      maximumSpeed: 85,

      defaultDelay: 250,

      // Randomization membuat typing tidak terasa seperti
      // text animation template.
      variance: 0.38,

      punctuationPause: {
        comma: 110,
        period: 230,
        question: 260,
        exclamation: 240,
        newline: 300,
        ellipsis: 420
      }
    },

    transition: {
      sceneMs: 720,
      focusDelay: 90,
      scrollResetBehavior: "instant"
    },

    confetti: {
      amount: 34,
      duration: 2600
    }
  });


  /* =======================================================
     01. DOM HELPERS
     ======================================================= */

  const $ = (selector, scope = document) =>
    scope.querySelector(selector);

  const $$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  const byId = (id) =>
    document.getElementById(id);

  const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);

  const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  const prefersReducedMotion = () =>
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isTypingTarget = (element) =>
    element &&
    (
      element.matches?.(CONFIG.selectors.typing) ||
      element.closest?.(CONFIG.selectors.typing)
    );


  /* =======================================================
     02. APP STATE
     ======================================================= */

  const state = {
    initialized: false,

    currentScene: null,
    previousScene: null,

    journeyStarted: false,
    confessionReached: false,
    afterglowReached: false,

    music1Started: false,
    music1Stopped: false,

    music2Started: false,

    audioUnlocked: false,

    isTransitioning: false,

    typingJobs: new Map(),

    interactionCount: 0,

    // Prevents accidental double-click scene skipping.
    lastNavigationAt: 0,

    // Stores the initial scene for replay/debug.
    initialScene: null,

    reducedMotion: false,

    resizeTimer: null,

    visibilityPaused: false
  };


  /* =======================================================
     03. DEBUG LOGGER
     ======================================================= */

  const DEBUG =
    window.location.search.includes("debug") ||
    window.localStorage?.getItem("bolu-ubi-debug") === "true";

  const log = (...args) => {
    if (!DEBUG) return;

    console.log(
      "%c[BOLU UBI]",
      "font-weight:700;",
      ...args
    );
  };

  const warn = (...args) => {
    console.warn(
      "[BOLU UBI]",
      ...args
    );
  };


  /* =======================================================
     04. ROOT INITIALIZATION
     ======================================================= */

  const root =
    $(CONFIG.selectors.root) ||
    document.documentElement;

  /*
   * Progressive enhancement:
   *
   * HTML harus tetap punya isi walaupun JS gagal.
   *
   * CSS kemudian bisa menggunakan:
   *
   * .js-ready .scene:not(.is-active) { ... }
   *
   * Jadi blank screen tidak terjadi hanya karena script gagal.
   */
  document.documentElement.classList.add("js");

  if (root && root !== document.documentElement) {
    root.classList.add("js-ready");
  } else {
    document.documentElement.classList.add("js-ready");
  }

  state.reducedMotion = prefersReducedMotion();

  if (state.reducedMotion) {
    document.documentElement.classList.add("reduce-motion");
  }


  /* =======================================================
     05. SCENE REGISTRY
     ======================================================= */

  const sceneElements = $$(
    CONFIG.selectors.scenes
  );

  const scenes = new Map();

  sceneElements.forEach((scene, index) => {
    const name =
      scene.dataset.scene ||
      scene.id?.replace(/^scene-/, "") ||
      `scene-${index + 1}`;

    scene.dataset.scene = name;

    scenes.set(name, scene);
  });

  if (!sceneElements.length) {
    warn(
      "Tidak ditemukan .scene. Pastikan setiap scene menggunakan class='scene'."
    );
  }

  state.initialScene =
    findInitialScene()?.dataset.scene ||
    sceneElements[0]?.dataset.scene ||
    null;


  function findInitialScene() {
    return (
      sceneElements.find(scene =>
        scene.classList.contains("is-active")
      ) ||

      sceneElements.find(scene =>
        scene.dataset.initial === "true"
      ) ||

      sceneElements[0]
    );
  }


  function getScene(name) {
    if (!name) return null;

    const normalized =
      String(name)
        .replace(/^#/, "")
        .replace(/^scene-/, "");

    return scenes.get(normalized) || null;
  }


  function getSceneName(scene) {
    if (!scene) return null;

    return (
      scene.dataset.scene ||
      scene.id?.replace(/^scene-/, "") ||
      null
    );
  }


  function getCurrentScene() {
    return state.currentScene
      ? getScene(state.currentScene)
      : null;
  }


  function getNextScene(scene = getCurrentScene()) {
    if (!scene) return null;

    const explicit = scene.dataset.next;

    if (explicit) {
      return getScene(explicit);
    }

    const index = sceneElements.indexOf(scene);

    if (
      index >= 0 &&
      index < sceneElements.length - 1
    ) {
      return sceneElements[index + 1];
    }

    return null;
  }


  function getPreviousScene(scene = getCurrentScene()) {
    if (!scene) return null;

    const explicit = scene.dataset.prev;

    if (explicit) {
      return getScene(explicit);
    }

    const index = sceneElements.indexOf(scene);

    if (index > 0) {
      return sceneElements[index - 1];
    }

    return null;
  }


  /* =======================================================
     06. SCENE STATE / ACCESSIBILITY
     ======================================================= */

  function prepareScene(scene) {
    if (!scene) return;

    scene.setAttribute(
      "aria-hidden",
      "true"
    );

    /*
     * Jangan langsung memakai hidden attribute di HTML.
     * CSS + aria state lebih aman untuk progressive enhancement.
     */
    scene.classList.remove(
      "is-active",
      "is-entering",
      "is-leaving",
      "is-before",
      "is-after"
    );
  }


  function prepareAllScenes() {
    sceneElements.forEach(prepareScene);
  }


  function markScenePositions(activeScene) {
    const activeIndex =
      sceneElements.indexOf(activeScene);

    sceneElements.forEach((scene, index) => {
      scene.classList.toggle(
        "is-before",
        index < activeIndex
      );

      scene.classList.toggle(
        "is-after",
        index > activeIndex
      );
    });
  }


  function setSceneActive(scene) {
    if (!scene) return;

    sceneElements.forEach(other => {
      const active = other === scene;

      other.classList.toggle(
        "is-active",
        active
      );

      other.setAttribute(
        "aria-hidden",
        active ? "false" : "true"
      );
    });

    markScenePositions(scene);
  }


  /* =======================================================
     07. SCENE SCROLL RESET
     ======================================================= */

  function getScrollableContainers(scene) {
    if (!scene) return [];

    const candidates = [
      scene,
      ...$$(
        CONFIG.selectors.sceneScroller,
        scene
      )
    ];

    return [...new Set(candidates)];
  }


  function resetSceneScroll(scene) {
    if (!scene) return;

    const behavior =
      state.reducedMotion
        ? "auto"
        : CONFIG.transition.scrollResetBehavior;

    getScrollableContainers(scene).forEach(element => {
      try {
        element.scrollTo({
          top: 0,
          left: 0,
          behavior
        });
      } catch {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      }
    });
  }


  /* =======================================================
     08. FOCUS MANAGEMENT
     ======================================================= */

  function findFocusable(scene) {
    if (!scene) return null;

    const selectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ];

    return scene.querySelector(
      selectors.join(",")
    );
  }


  function focusScene(scene) {
    if (!scene) return;

    const target =
      scene.querySelector("[data-scene-heading]") ||
      scene.querySelector("h1, h2, h3") ||
      findFocusable(scene);

    if (!target) return;

    /*
     * Jangan membuat heading non-semantic secara permanen.
     * Hanya beri tabindex sementara jika memang diperlukan.
     */
    const hadTabIndex =
      target.hasAttribute("tabindex");

    if (!hadTabIndex) {
      target.setAttribute("tabindex", "-1");
    }

    window.setTimeout(() => {
      try {
        target.focus({
          preventScroll: true
        });
      } catch {
        target.focus();
      }

      if (!hadTabIndex) {
        window.setTimeout(() => {
          target.removeAttribute("tabindex");
        }, 800);
      }
    }, CONFIG.transition.focusDelay);
  }


  /* =======================================================
     09. AUDIO DISCOVERY
     ======================================================= */

  const music1 =
    $(CONFIG.selectors.audio1);

  const music2 =
    $(CONFIG.selectors.audio2);

  if (music1) {
    music1.preload = "auto";
    music1.loop = true;
    music1.volume = 0;
  }

  if (music2) {
    music2.preload = "auto";
    music2.loop = true;
    music2.volume = 0;
  }


  /* =======================================================
     10. AUDIO HELPERS
     ======================================================= */

  function safePlay(audio) {
    if (!audio) {
      return Promise.resolve(false);
    }

    try {
      const result = audio.play();

      if (result && typeof result.then === "function") {
        return result
          .then(() => {
            state.audioUnlocked = true;
            return true;
          })
          .catch(error => {
            log("Audio play rejected:", error);
            return false;
          });
      }

      return Promise.resolve(true);
    } catch (error) {
      log("Audio play error:", error);
      return Promise.resolve(false);
    }
  }


  function safePause(audio) {
    if (!audio) return;

    try {
      audio.pause();
    } catch (error) {
      log("Audio pause error:", error);
    }
  }


  function resetAudio(audio) {
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    } catch (error) {
      log("Audio reset error:", error);
    }
  }


  function animateAudioVolume(
    audio,
    targetVolume,
    duration = 1000
  ) {
    if (!audio) {
      return Promise.resolve();
    }

    if (state.reducedMotion) {
      audio.volume =
        clamp(targetVolume, 0, 1);

      return Promise.resolve();
    }

    const startVolume =
      Number.isFinite(audio.volume)
        ? audio.volume
        : 0;

    const target =
      clamp(targetVolume, 0, 1);

    if (duration <= 0) {
      audio.volume = target;
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const startTime =
        performance.now();

      const tick = now => {
        const progress =
          clamp(
            (now - startTime) / duration,
            0,
            1
          );

        /*
         * Smoothstep.
         * Tidak terasa seperti linear mechanical fade.
         */
        const eased =
          progress *
          progress *
          (3 - 2 * progress);

        audio.volume =
          startVolume +
          (target - startVolume) *
          eased;

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          audio.volume = target;
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }


  /* =======================================================
     11. MUSIC 1
     ======================================================= */

  async function startMusic1() {
    if (!music1) {
      warn("music1 tidak ditemukan.");
      return false;
    }

    if (state.music1Started) {
      return true;
    }

    /*
     * Music2 tidak boleh aktif bersamaan.
     */
    if (music2) {
      safePause(music2);
      music2.volume = 0;
    }

    music1.loop = true;

    try {
      music1.volume = 0;

      const played =
        await safePlay(music1);

      if (!played) {
        return false;
      }

      state.music1Started = true;
      state.music1Stopped = false;

      await animateAudioVolume(
        music1,
        CONFIG.audio.music1Volume,
        CONFIG.audio.fadeInMs
      );

      document.documentElement.classList.add(
        "music1-playing"
      );

      document.documentElement.classList.remove(
        "music1-stopped"
      );

      log("Music 1 started.");

      return true;
    } catch (error) {
      warn("Gagal memulai music1:", error);
      return false;
    }
  }


  /* =======================================================
     12. MUSIC 1 → SILENCE
     ======================================================= */

  async function stopMusic1({
    reset = true
  } = {}) {
    if (!music1) return;

    if (state.music1Stopped) {
      return;
    }

    state.music1Stopped = true;

    await animateAudioVolume(
      music1,
      0,
      CONFIG.audio.fadeOutMs
    );

    safePause(music1);

    if (reset) {
      try {
        music1.currentTime = 0;
      } catch {
        // Some browsers can reject currentTime before metadata.
      }
    }

    document.documentElement.classList.remove(
      "music1-playing"
    );

    document.documentElement.classList.add(
      "music1-stopped"
    );

    log("Music 1 stopped. Silence begins.");
  }


  /* =======================================================
     13. MUSIC 2
     ======================================================= */

  async function startMusic2() {
    if (!music2) {
      warn("music2 tidak ditemukan.");
      return false;
    }

    if (state.music2Started) {
      return true;
    }

    /*
     * Safety:
     * music1 HARUS berhenti dahulu.
     */
    if (music1) {
      safePause(music1);
      music1.volume = 0;
    }

    music2.loop = true;
    music2.volume = 0;

    try {
      const played =
        await safePlay(music2);

      if (!played) {
        return false;
      }

      state.music2Started = true;

      await animateAudioVolume(
        music2,
        CONFIG.audio.music2Volume,
        CONFIG.audio.fadeInMs
      );

      document.documentElement.classList.add(
        "music2-playing"
      );

      log("Music 2 started.");

      return true;
    } catch (error) {
      warn("Gagal memulai music2:", error);
      return false;
    }
  }


  /* =======================================================
     14. MUSIC TRANSITION
     ======================================================= */

  async function transitionToMusic2() {
    /*
     * Jangan menjalankan transition berkali-kali.
     */
    if (state.music2Started) {
      return;
    }

    log(
      "Starting emotional audio threshold..."
    );

    await stopMusic1({
      reset: true
    });

    /*
     * Ini penting.
     * Silence bukan bug.
     * Silence adalah bagian dari choreography.
     */
    if (!state.reducedMotion) {
      await sleep(
        CONFIG.audio.silenceBeforeMusic2Ms
      );
    }

    await startMusic2();
  }


  /* =======================================================
     15. AUDIO UNLOCK
     * Dipanggil oleh user gesture pertama.
     * Tidak memaksa autoplay.
     * ======================================================= */

  function bindAudioUnlock() {
    const unlock = async () => {
      if (state.audioUnlocked) return;

      /*
       * Kita tidak memainkan audio diam-diam.
       * Audio baru dijalankan melalui action yang memang
       * memulai journey.
       */
    };

    document.addEventListener(
      "pointerdown",
      unlock,
      {
        passive: true,
        once: false
      }
    );
  }


  /* =======================================================
     16. JOURNEY START
     * Tombol "bukaa duluuu"
     * ======================================================= */

  async function startJourney(trigger = null) {
    if (state.journeyStarted) {
      return;
    }

    state.journeyStarted = true;
    state.interactionCount++;

    document.documentElement.classList.add(
      "journey-started"
    );

    if (trigger) {
      trigger.classList.add("is-activated");

      /*
       * Hindari tombol tertekan berulang kali.
       */
      trigger.setAttribute(
        "aria-disabled",
        "true"
      );
    }

    await startMusic1();

    const current =
      getCurrentScene() ||
      findInitialScene();

    const next =
      getNextScene(current);

    if (next) {
      await goToScene(
        getSceneName(next),
        {
          reason: "journey-start",
          fromJourneyStart: true
        }
      );
    }
  }


  /* =======================================================
     17. SCENE ENTER HOOKS
     ======================================================= */

  function sceneWillEnter(scene, meta = {}) {
    if (!scene) return;

    scene.classList.add("is-entering");

    /*
     * Dynamic scene state.
     */
    scene.dataset.enteredAt =
      String(Date.now());

    /*
     * Scene-specific body classes.
     */
    const name =
      getSceneName(scene);

    document.documentElement.dataset.scene =
      name || "";

    document.documentElement.classList.toggle(
      "scene-opening",
      name === CONFIG.scenes.opening
    );

    document.documentElement.classList.toggle(
      "scene-birthday",
      name === CONFIG.scenes.birthday
    );

    document.documentElement.classList.toggle(
      "scene-flashback",
      name === CONFIG.scenes.flashback
    );

    document.documentElement.classList.toggle(
      "scene-traits",
      name === CONFIG.scenes.traits
    );

    document.documentElement.classList.toggle(
      "scene-memories",
      name === CONFIG.scenes.memories
    );

    document.documentElement.classList.toggle(
      "scene-photo",
      name === CONFIG.scenes.photo
    );

    document.documentElement.classList.toggle(
      "scene-serious",
      name === CONFIG.scenes.serious
    );

    document.documentElement.classList.toggle(
      "scene-letter",
      name === CONFIG.scenes.letter
    );

    document.documentElement.classList.toggle(
      "scene-breath",
      name === CONFIG.scenes.breath
    );

    document.documentElement.classList.toggle(
      "scene-confession",
      name === CONFIG.scenes.confession
    );

    document.documentElement.classList.toggle(
      "scene-afterglow",
      name === CONFIG.scenes.afterglow
    );

    /*
     * Accessibility announcement.
     */
    const announcement =
      scene.querySelector(
        "[data-scene-announcement]"
      );

    if (announcement) {
      announcement.setAttribute(
        "aria-live",
        "polite"
      );
    }

    log(
      "Entering scene:",
      name,
      meta.reason || ""
    );
  }


  function sceneDidEnter(scene, meta = {}) {
    if (!scene) return;

    scene.classList.remove(
      "is-entering"
    );

    scene.classList.add(
      "has-entered"
    );

    const name =
      getSceneName(scene);

    /*
     * Start all deferred scene interactions.
     */
    runSceneTyping(scene);
    initializeSceneDetails(scene);
    initializeScenePhoto(scene);
    initializeSceneTimeline(scene);
    initializeSceneMicroInteractions(scene);

    /*
     * MathJax:
     * Jika Scene 2 baru masuk, render ulang equation.
     */
    typesetMath(scene);

    /*
     * Scene-specific timing.
     */
    if (
      name === CONFIG.scenes.confession
    ) {
      handleConfessionEnter(scene);
    }

    if (
      name === CONFIG.scenes.afterglow
    ) {
      handleAfterglowEnter(scene);
    }

    log(
      "Entered scene:",
      name,
      meta.reason || ""
    );
  }


  /* =======================================================
     18. SCENE LEAVE HOOK
     ======================================================= */

  function sceneWillLeave(scene) {
    if (!scene) return;

    scene.classList.add(
      "is-leaving"
    );

    cancelTypingInScene(scene);

    log(
      "Leaving scene:",
      getSceneName(scene)
    );
  }


  /* =======================================================
     19. MAIN NAVIGATION
     * The most important rule:
     * NO SCROLL NAVIGATION.
     * ======================================================= */

  async function goToScene(
    targetName,
    meta = {}
  ) {
    const target =
      getScene(targetName);

    if (!target) {
      warn(
        "Target scene tidak ditemukan:",
        targetName
      );
      return false;
    }

    const targetSceneName =
      getSceneName(target);

    const current =
      getCurrentScene();

    if (
      current &&
      current === target
    ) {
      return true;
    }

    /*
     * Prevent rapid accidental multi-navigation.
     */
    const now = Date.now();

    if (
      now - state.lastNavigationAt < 180
    ) {
      return false;
    }

    state.lastNavigationAt = now;

    if (state.isTransitioning) {
      return false;
    }

    state.isTransitioning = true;

    try {
      /*
       * CONFESSION THRESHOLD
       *
       * Ketika masuk scene confession:
       *
       * music1 fade out
       * ↓
       * silence
       * ↓
       * scene changes
       * ↓
       * music2 fades in
       */
      const isConfession =
        targetSceneName ===
        CONFIG.scenes.confession;

      if (
        isConfession &&
        !state.confessionReached
      ) {
        state.confessionReached = true;

        document.documentElement.classList.add(
          "approaching-confession"
        );

        /*
         * Audio threshold dimulai sebelum scene benar-benar
         * tampil supaya perubahan atmosfer terasa seamless.
         */
        await stopMusic1({
          reset: true
        });

        if (!state.reducedMotion) {
          await sleep(
            CONFIG.audio.silenceBeforeMusic2Ms
          );
        }
      }

      if (current) {
        sceneWillLeave(current);
      }

      state.previousScene =
        state.currentScene;

      state.currentScene =
        targetSceneName;

      resetSceneScroll(target);

      /*
       * Set visual state.
       */
      sceneWillEnter(
        target,
        meta
      );

      setSceneActive(target);

      /*
       * CSS transition mendapat kesempatan bekerja.
       */
      if (!state.reducedMotion) {
        await nextAnimationFrame();
        await nextAnimationFrame();
      }

      sceneDidEnter(
        target,
        meta
      );

      /*
       * Music 2 dimulai setelah visual threshold.
       */
      if (isConfession) {
        await startMusic2();

        document.documentElement.classList.remove(
          "approaching-confession"
        );

        document.documentElement.classList.add(
          "confession-unlocked"
        );
      }

      /*
       * Focus hanya setelah scene stabil.
       */
      if (!meta.silentFocus) {
        focusScene(target);
      }

      return true;
    } finally {
      /*
       * Sedikit delay supaya double click tidak
       * langsung menembak scene berikutnya.
       */
      window.setTimeout(() => {
        state.isTransitioning = false;
      }, state.reducedMotion ? 0 : 100);
    }
  }


  function nextAnimationFrame() {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }


  /* =======================================================
     20. BUTTON NAVIGATION
     ======================================================= */

  function handleNavigationElement(element) {
    if (!element) return;

    /*
     * Start journey punya prioritas tertinggi.
     */
    if (
      element.matches(
        CONFIG.selectors.startJourney
      )
    ) {
      startJourney(element);
      return;
    }

    /*
     * Explicit target.
     */
    const explicitTarget =
      element.dataset.go;

    if (explicitTarget) {
      state.interactionCount++;

      goToScene(
        explicitTarget,
        {
          reason: "button",
          trigger: element
        }
      );

      return;
    }

    /*
     * Next.
     */
    if (
      element.hasAttribute("data-next")
    ) {
      const target =
        element.dataset.next ||
        getSceneName(
          getNextScene()
        );

      if (target) {
        state.interactionCount++;

        goToScene(
          target,
          {
            reason: "next-button",
            trigger: element
          }
        );
      }

      return;
    }

    /*
     * Previous.
     */
    if (
      element.hasAttribute("data-prev")
    ) {
      const target =
        element.dataset.prev ||
        getSceneName(
          getPreviousScene()
        );

      if (target) {
        state.interactionCount++;

        goToScene(
          target,
          {
            reason: "previous-button",
            trigger: element
          }
        );
      }

      return;
    }

    /*
     * Generic next class fallback.
     */
    if (
      element.matches(
        ".js-next, .scene-next, .btn-next, [data-action='next']"
      )
    ) {
      const target =
        getNextScene();

      if (target) {
        state.interactionCount++;

        goToScene(
          getSceneName(target),
          {
            reason: "generic-next",
            trigger: element
          }
        );
      }
    }
  }


  /* =======================================================
     21. EVENT DELEGATION
     ======================================================= */

  function bindNavigation() {
    document.addEventListener(
      "click",
      event => {
        const target =
          event.target.closest(
            "button, a, [role='button']"
          );

        if (!target) return;

        /*
         * Jangan mengambil alih anchor external.
         */
        if (
          target.tagName === "A" &&
          target.hasAttribute("href") &&
          !target.dataset.go &&
          !target.dataset.next &&
          !target.dataset.prev &&
          !target.dataset.startJourney
        ) {
          return;
        }

        /*
         * Don't hijack text selection / nested controls.
         */
        if (
          target.closest(
            "summary"
          )
        ) {
          return;
        }

        const isNavigation =
          target.matches(
            [
              "[data-go]",
              "[data-next]",
              "[data-prev]",
              "[data-start-journey]",
              ".js-next",
              ".scene-next",
              ".btn-next",
              ".js-start-journey",
              "[data-action='next']"
            ].join(",")
          );

        if (!isNavigation) return;

        event.preventDefault();

        handleNavigationElement(
          target
        );
      },
      false
    );
  }


  /* =======================================================
     22. ABSOLUTE RULE:
     * NEVER NAVIGATE FROM SCROLL
     * ======================================================= */

  function explicitlyDisableScrollNavigation() {
    /*
     * Tidak ada wheel handler.
     * Tidak ada touchmove handler.
     * Tidak ada IntersectionObserver yang mengubah scene.
     * Tidak ada scroll listener yang memanggil goToScene().
     *
     * Scroll event hanya boleh dipakai untuk efek visual
     * lokal jika dibutuhkan.
     */

    document.addEventListener(
      "wheel",
      event => {
        /*
         * Sengaja kosong.
         * Ini dokumentasi bahwa wheel bukan navigation.
         */
      },
      {
        passive: true
      }
    );
  }


  /* =======================================================
     23. TOUCH / MOBILE SAFETY
     * ======================================================= */

  function bindMobileSafety() {
    /*
     * Kita tidak melakukan preventDefault terhadap vertical
     * touch. Browser harus tetap boleh scroll normal.
     */

    document.addEventListener(
      "touchstart",
      () => {
        // Deliberately empty.
      },
      {
        passive: true
      }
    );

    document.addEventListener(
      "touchmove",
      () => {
        // Deliberately empty.
      },
      {
        passive: true
      }
    );
  }


  /* =======================================================
     24. TYPING ENGINE
     * Natural typing, not robotic.
     * ======================================================= */

  function parseTypingOptions(element) {
    const rawSpeed =
      Number(
        element.dataset.typingSpeed
      );

    const rawDelay =
      Number(
        element.dataset.typingDelay
      );

    const speed =
      Number.isFinite(rawSpeed)
        ? clamp(
            rawSpeed,
            CONFIG.typing.minimumSpeed,
            CONFIG.typing.maximumSpeed
          )
        : CONFIG.typing.defaultSpeed;

    const delay =
      Number.isFinite(rawDelay)
        ? Math.max(rawDelay, 0)
        : CONFIG.typing.defaultDelay;

    return {
      speed,
      delay
    };
  }


  function getTypingSource(element) {
    /*
     * Priority:
     *
     * data-typing="..."
     * ↓
     * data-text="..."
     * ↓
     * innerHTML snapshot
     */

    if (
      element.dataset.typing &&
      element.dataset.typing.trim()
    ) {
      return {
        type: "text",
        value: element.dataset.typing
      };
    }

    if (
      element.dataset.text &&
      element.dataset.text.trim()
    ) {
      return {
        type: "text",
        value: element.dataset.text
      };
    }

    /*
     * Kalau HTML sudah mengandung <br>, <em>, etc.,
     * jangan menghancurkannya.
     */
    return {
      type: "html",
      value: element.innerHTML
    };
  }


  function calculateTypingDelay(
    char,
    baseSpeed
  ) {
    let delay = baseSpeed;

    /*
     * Sedikit random.
     * Tidak setiap karakter muncul dengan tempo identik.
     */
    const variance =
      CONFIG.typing.variance;

    const randomFactor =
      1 +
      ((Math.random() * 2 - 1) * variance);

    delay *= randomFactor;

    if (char === ",") {
      delay +=
        CONFIG.typing.punctuationPause.comma;
    }

    if (char === ".") {
      delay +=
        CONFIG.typing.punctuationPause.period;
    }

    if (char === "?") {
      delay +=
        CONFIG.typing.punctuationPause.question;
    }

    if (char === "!") {
      delay +=
        CONFIG.typing.punctuationPause.exclamation;
    }

    if (char === "\n") {
      delay +=
        CONFIG.typing.punctuationPause.newline;
    }

    return Math.max(
      5,
      delay
    );
  }


  async function typePlainText(
    element,
    text,
    options,
    token
  ) {
    element.textContent = "";

    /*
     * Cursor optional:
     * CSS dapat menarget .is-typing.
     */
    element.classList.add(
      "is-typing"
    );

    for (
      let index = 0;
      index < text.length;
      index++
    ) {
      /*
       * Cancel-safe.
       */
      if (
        state.typingJobs.get(element) !== token
      ) {
        return false;
      }

      const char =
        text[index];

      element.textContent += char;

      if (state.reducedMotion) {
        continue;
      }

      const delay =
        calculateTypingDelay(
          char,
          options.speed
        );

      await sleep(delay);
    }

    element.classList.remove(
      "is-typing"
    );

    element.classList.add(
      "typing-complete"
    );

    return true;
  }


  async function typeHTML(
    element,
    html,
    options,
    token
  ) {
    /*
     * Untuk HTML rich text kita tidak bisa sekadar
     * menghapus semua markup.
     *
     * Cara aman:
     * parsing ke DOM, lalu mengetik text node,
     * mempertahankan element structure.
     */

    const template =
      document.createElement("template");

    template.innerHTML = html;

    element.innerHTML = "";

    const fragment =
      template.content.cloneNode(true);

    const walker =
      document.createTreeWalker(
        fragment,
        NodeFilter.SHOW_TEXT
      );

    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(
        walker.currentNode
      );
    }

    /*
     * Build empty structure first.
     */
    const structuralClone =
      fragment.cloneNode(true);

    const structuralWalker =
      document.createTreeWalker(
        structuralClone,
        NodeFilter.SHOW_TEXT
      );

    while (structuralWalker.nextNode()) {
      structuralWalker.currentNode.textContent = "";
    }

    element.appendChild(
      structuralClone
    );

    const outputWalker =
      document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT
      );

    const outputNodes = [];

    while (outputWalker.nextNode()) {
      outputNodes.push(
        outputWalker.currentNode
      );
    }

    element.classList.add(
      "is-typing"
    );

    for (
      let nodeIndex = 0;
      nodeIndex < textNodes.length;
      nodeIndex++
    ) {
      const sourceNode =
        textNodes[nodeIndex];

      const targetNode =
        outputNodes[nodeIndex];

      if (!targetNode) continue;

      const text =
        sourceNode.textContent || "";

      for (
        let index = 0;
        index < text.length;
        index++
      ) {
        if (
          state.typingJobs.get(element) !== token
        ) {
          return false;
        }

        const char =
          text[index];

        targetNode.textContent += char;

        if (state.reducedMotion) {
          continue;
        }

        await sleep(
          calculateTypingDelay(
            char,
            options.speed
          )
        );
      }
    }

    element.classList.remove(
      "is-typing"
    );

    element.classList.add(
      "typing-complete"
    );

    return true;
  }


  async function runTyping(element) {
    if (!element) return;

    /*
     * Jangan restart typing setiap kali scene
     * mendapatkan internal event.
     */
    if (
      element.dataset.typingDone === "true" &&
      element.dataset.typingReplay !== "true"
    ) {
      return;
    }

    const source =
      getTypingSource(element);

    const options =
      parseTypingOptions(element);

    const token =
      Symbol("typing");

    state.typingJobs.set(
      element,
      token
    );

    const delay =
      options.delay;

    if (
      delay > 0 &&
      !state.reducedMotion
    ) {
      await sleep(delay);
    }

    let completed = false;

    if (source.type === "html") {
      completed =
        await typeHTML(
          element,
          source.value,
          options,
          token
        );
    } else {
      completed =
        await typePlainText(
          element,
          source.value,
          options,
          token
        );
    }

    if (
      completed &&
      state.typingJobs.get(element) === token
    ) {
      element.dataset.typingDone = "true";

      state.typingJobs.delete(
        element
      );
    }
  }


  function runSceneTyping(scene) {
    if (!scene) return;

    const elements =
      $$(CONFIG.selectors.typing, scene);

    if (!elements.length) return;

    elements.forEach(element => {
      /*
       * Jika element memiliki data-typing-on:
       *
       * "enter" = otomatis saat scene masuk
       * "click" = tunggu trigger
       */
      const mode =
        element.dataset.typingOn ||
        "enter";

      if (mode === "enter") {
        runTyping(element);
      }
    });
  }


  function cancelTypingInScene(scene) {
    if (!scene) return;

    const elements =
      $$(CONFIG.selectors.typing, scene);

    elements.forEach(element => {
      state.typingJobs.delete(
        element
      );
    });
  }


  function replayTyping(element) {
    if (!element) return;

    delete element.dataset.typingDone;

    runTyping(element);
  }


  /* =======================================================
     25. TYPING CLICK TRIGGERS
     ======================================================= */

  function bindTypingTriggers() {
    document.addEventListener(
      "click",
      event => {
        const trigger =
          event.target.closest(
            "[data-typing-trigger]"
          );

        if (!trigger) return;

        event.preventDefault();

        const selector =
          trigger.dataset.typingTrigger;

        if (!selector) return;

        let target = null;

        try {
          target = $(selector);
        } catch {
          target = null;
        }

        if (!target) {
          target =
            document.querySelector(
              `[data-typing-id="${selector}"]`
            );
        }

        if (target) {
          replayTyping(target);
        }
      }
    );
  }


  /* =======================================================
     26. HYDROPONICS SIDE QUEST
     ======================================================= */

  function initializeSceneDetails(scene) {
    if (!scene) return;

    const details =
      $$(
        "details[data-memory-details], details[data-hydroponics-details], .memory-details details",
        scene
      );

    details.forEach(detail => {
      detail.addEventListener(
        "toggle",
        () => {
          detail.classList.toggle(
            "is-open",
            detail.open
          );

          if (detail.open) {
            state.interactionCount++;

            /*
             * Give the browser a moment before scrolling
             * inside the scene.
             */
            window.setTimeout(() => {
              const content =
                detail.querySelector(
                  "[data-detail-content], .details-content, .memory-details__content"
                );

              if (!content) return;

              /*
               * Only scroll if content is actually outside
               * viewport. Never force a dramatic jump.
               */
              const rect =
                content.getBoundingClientRect();

              const viewportHeight =
                window.innerHeight;

              if (
                rect.bottom >
                viewportHeight - 24
              ) {
                content.scrollIntoView({
                  behavior:
                    state.reducedMotion
                      ? "auto"
                      : "smooth",
                  block: "nearest"
                });
              }
            }, 80);
          }
        }
      );
    });
  }


  function bindHydroponicsFallback() {
    document.addEventListener(
      "click",
      event => {
        const trigger =
          event.target.closest(
            "[data-hydroponics-toggle], .js-hydroponics-toggle"
          );

        if (!trigger) return;

        const selector =
          trigger.dataset.hydroponicsToggle;

        let target = null;

        if (selector) {
          try {
            target = $(selector);
          } catch {
            target = null;
          }
        }

        if (!target) {
          target =
            trigger.parentElement?.querySelector(
              "[data-hydroponics-content], .hydroponics-content"
            );
        }

        if (!target) return;

        event.preventDefault();

        const open =
          target.classList.toggle(
            "is-open"
          );

        trigger.classList.toggle(
          "is-active",
          open
        );

        trigger.setAttribute(
          "aria-expanded",
          String(open)
        );

        target.setAttribute(
          "aria-hidden",
          String(!open)
        );
      }
    );
  }


  /* =======================================================
     27. TIMELINE INTERACTION
     ======================================================= */

  function initializeSceneTimeline(scene) {
    if (!scene) return;

    const items =
      $$(
        "[data-timeline-item]",
        scene
      );

    if (!items.length) return;

    items.forEach((item, index) => {
      item.style.setProperty(
        "--timeline-index",
        String(index)
      );

      /*
       * Optional manual reveal.
       */
      const button =
        item.querySelector(
          "[data-timeline-open]"
        );

      if (!button) return;

      button.addEventListener(
        "click",
        () => {
          const wasActive =
            item.classList.contains(
              "is-open"
            );

          items.forEach(other => {
            other.classList.remove(
              "is-open"
            );
          });

          if (!wasActive) {
            item.classList.add(
              "is-open"
            );
          }

          state.interactionCount++;
        }
      );
    });
  }


  /* =======================================================
     28. PHOTO INITIALIZATION
     ======================================================= */

  function initializeScenePhoto(scene) {
    if (!scene) return;

    const images =
      $$(
        "img",
        scene
      );

    images.forEach(img => {
      /*
       * Jangan biarkan gambar rusak membuat layout
       * terlihat seperti elemen kosong misterius.
       */
      img.addEventListener(
        "error",
        () => {
          img.classList.add(
            "is-image-error"
          );

          const frame =
            img.closest(
              ".photo-frame, .memory-photo, [data-photo]"
            );

          if (frame) {
            frame.classList.add(
              "has-image-error"
            );
          }
        },
        {
          once: true
        }
      );

      /*
       * Pastikan browser tidak melakukan
       * layout shift besar.
       */
      if (!img.hasAttribute("loading")) {
        img.loading = "lazy";
      }

      if (!img.hasAttribute("decoding")) {
        img.decoding = "async";
      }
    });
  }


  /* =======================================================
     29. MICRO INTERACTIONS
     ======================================================= */

  function initializeSceneMicroInteractions(scene) {
    if (!scene) return;

    /*
     * Sticker "fingerprint" interaction.
     */
    const stickers =
      $$(
        ".sticker, [data-sticker]",
        scene
      );

    stickers.forEach(sticker => {
      if (
        sticker.dataset.microBound === "true"
      ) {
        return;
      }

      sticker.dataset.microBound = "true";

      sticker.addEventListener(
        "pointerenter",
        () => {
          if (state.reducedMotion) return;

          sticker.classList.add(
            "is-hovering"
          );
        }
      );

      sticker.addEventListener(
        "pointerleave",
        () => {
          sticker.classList.remove(
            "is-hovering"
          );
        }
      );
    });

    /*
     * Cards can get a tiny cursor response on desktop.
     * No parallax-heavy gimmick.
     */
    const interactiveCards =
      $$(
        "[data-card, .memory-card, .trait-card, .lore-card]",
        scene
      );

    interactiveCards.forEach(card => {
      if (
        card.dataset.pointerBound === "true"
      ) {
        return;
      }

      card.dataset.pointerBound = "true";

      card.addEventListener(
        "pointermove",
        event => {
          if (
            state.reducedMotion ||
            window.matchMedia(
              "(hover: none)"
            ).matches
          ) {
            return;
          }

          const rect =
            card.getBoundingClientRect();

          const x =
            ((event.clientX - rect.left) /
              rect.width) *
            100;

          const y =
            ((event.clientY - rect.top) /
              rect.height) *
            100;

          card.style.setProperty(
            "--pointer-x",
            `${x}%`
          );

          card.style.setProperty(
            "--pointer-y",
            `${y}%`
          );
        }
      );

      card.addEventListener(
        "pointerleave",
        () => {
          card.style.removeProperty(
            "--pointer-x"
          );

          card.style.removeProperty(
            "--pointer-y"
          );
        }
      );
    });
  }


  /* =======================================================
     30. MATHJAX
     ======================================================= */

  function typesetMath(scene) {
    if (!scene) return;

    if (
      !window.MathJax ||
      typeof window.MathJax.typesetPromise !==
        "function"
    ) {
      return;
    }

    /*
     * Delay satu frame supaya scene sudah display:block /
     * visible sebelum MathJax menghitung layout.
     */
    requestAnimationFrame(() => {
      window.MathJax.typesetPromise([
        scene
      ]).catch(error => {
        log(
          "MathJax typeset error:",
          error
        );
      });
    });
  }


  /* =======================================================
     31. SCENE 9 → SCENE 10
     ======================================================= */

  function handleConfessionEnter(scene) {
    if (!scene) return;

    /*
     * Scene 10 adalah perubahan atmosfer.
     * Bukan confetti sejak awal.
     * Bukan giant "WILL YOU BE MY GIRLFRIEND?"
     * Bukan tombol YES/NO.
     */

    document.documentElement.classList.add(
      "confession-scene-active"
    );

    /*
     * Beri waktu kepada scene untuk "settle".
     */
    if (!state.reducedMotion) {
      window.setTimeout(() => {
        scene.classList.add(
          "confession-settled"
        );
      }, 650);
    } else {
      scene.classList.add(
        "confession-settled"
      );
    }
  }


  /* =======================================================
     32. CONFESSION REVEAL
     * Optional explicit button.
     *
     * Bisa dipakai jika Scene 10 punya:
     * data-confession-reveal
     *
     * Tapi website tidak akan memaksa jawaban.
     * ======================================================= */

  function bindConfessionReveal() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-confession-reveal]"
          );

        if (!button) return;

        event.preventDefault();

        revealConfession(
          button
        );
      }
    );
  }


  function revealConfession(trigger = null) {
    const scene =
      getScene(
        CONFIG.scenes.confession
      );

    if (!scene) return;

    state.interactionCount++;

    scene.classList.add(
      "is-confession-revealed"
    );

    document.documentElement.classList.add(
      "confession-revealed"
    );

    if (trigger) {
      trigger.classList.add(
        "is-activated"
      );

      trigger.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    /*
     * Confetti hanya setelah reveal.
     * Bukan saat masuk scene.
     */
    if (!state.reducedMotion) {
      createConfetti(
        CONFIG.confetti.amount
      );
    }

    /*
     * Optional hidden text.
     */
    const hidden =
      scene.querySelector(
        "[data-confession-hidden]"
      );

    if (hidden) {
      hidden.hidden = false;
      hidden.classList.add(
        "is-visible"
      );
    }

    /*
     * Optional typing.
     */
    const typing =
      scene.querySelector(
        "[data-confession-typing]"
      );

    if (typing) {
      delete typing.dataset.typingDone;
      runTyping(typing);
    }
  }


  /* =======================================================
     33. AFTERGLOW
     ======================================================= */

  function handleAfterglowEnter(scene) {
    if (!scene) return;

    if (
      state.afterglowReached
    ) {
      return;
    }

    state.afterglowReached = true;

    document.documentElement.classList.add(
      "afterglow-active"
    );

    /*
     * No abrupt ending.
     *
     * Music2 remains alive.
     * Visual atmosphere remains.
     */
    if (!state.reducedMotion) {
      window.setTimeout(() => {
        scene.classList.add(
          "afterglow-settled"
        );
      }, 900);
    } else {
      scene.classList.add(
        "afterglow-settled"
      );
    }
  }


  /* =======================================================
     34. CONFETTI
     * Subtle, lightweight, DOM-based.
     * ======================================================= */

  function createConfetti(amount = 30) {
    /*
     * Remove old confetti first.
     */
    $$(".confetti-particle").forEach(
      particle => particle.remove()
    );

    const layer =
      document.createElement("div");

    layer.className =
      "confetti-layer";

    layer.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.appendChild(
      layer
    );

    for (
      let index = 0;
      index < amount;
      index++
    ) {
      const particle =
        document.createElement("span");

      particle.className =
        "confetti-particle";

      const x =
        Math.random() * 100;

      const delay =
        Math.random() * 420;

      const duration =
        1800 +
        Math.random() * 1000;

      const rotation =
        Math.random() * 720 -
        360;

      const drift =
        Math.random() * 180 -
        90;

      particle.style.left =
        `${x}%`;

      particle.style.setProperty(
        "--confetti-delay",
        `${delay}ms`
      );

      particle.style.setProperty(
        "--confetti-duration",
        `${duration}ms`
      );

      particle.style.setProperty(
        "--confetti-rotation",
        `${rotation}deg`
      );

      particle.style.setProperty(
        "--confetti-drift",
        `${drift}px`
      );

      /*
       * CSS menentukan warna / bentuk.
       * JS hanya mengatur physics.
       */
      layer.appendChild(
        particle
      );
    }

    window.setTimeout(
      () => {
        layer.classList.add(
          "is-fading"
        );

        window.setTimeout(
          () => {
            layer.remove();
          },
          800
        );
      },
      CONFIG.confetti.duration
    );
  }


  /* =======================================================
     35. KEYBOARD NAVIGATION
     * Keyboard hanya intentional.
     * Arrow navigation tidak mengganggu scroll normal
     * karena hanya dipakai ketika fokus ada di button /
     * body-level dengan modifier tertentu.
     * ======================================================= */

  function bindKeyboard() {
    document.addEventListener(
      "keydown",
      event => {
        /*
         * Jangan mengganggu typing/input.
         */
        const active =
          document.activeElement;

        if (
          active &&
          (
            active.matches(
              "input, textarea, select"
            ) ||
            active.isContentEditable
          )
        ) {
          return;
        }

        /*
         * Escape:
         * close details / overlays.
         */
        if (
          event.key === "Escape"
        ) {
          const openDetails =
            $$("details[open]");

          if (openDetails.length) {
            openDetails.forEach(
              detail => {
                detail.open = false;
              }
            );

            return;
          }
        }

        /*
         * ENTER pada focused navigation button
         * dibiarkan browser.
         */

        /*
         * Arrow keys TIDAK digunakan sebagai scene
         * navigation secara global.
         *
         * Ini sengaja.
         *
         * User bisa memakai keyboard untuk scroll,
         * dan website tidak mengambil alih behavior browser.
         */
      }
    );
  }


  /* =======================================================
     36. VISIBILITY / TAB SWITCH
     * Audio tidak boleh rusak ketika user pindah tab.
     * ======================================================= */

  function bindVisibilityHandling() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.hidden
        ) {
          state.visibilityPaused =
            true;

          /*
           * Browser sendiri biasanya menangani audio.
           * Kita tidak reset currentTime.
           */
          return;
        }

        if (
          state.visibilityPaused
        ) {
          state.visibilityPaused =
            false;

          /*
           * Jangan force-play karena browser autoplay policy.
           * Jika audio masih paused, biarkan user interaction
           * berikutnya menghidupkannya.
           */
        }
      }
    );
  }


  /* =======================================================
     37. RESIZE / ORIENTATION
     * ======================================================= */

  function bindViewportHandling() {
    const update =
      () => {
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${window.innerHeight}px`
        );

        /*
         * CSS utama tetap menggunakan svh/dvh.
         * Variable ini hanya fallback.
         */
      };

    update();

    window.addEventListener(
      "resize",
      () => {
        clearTimeout(
          state.resizeTimer
        );

        state.resizeTimer =
          window.setTimeout(
            update,
            120
          );
      },
      {
        passive: true
      }
    );

    window.addEventListener(
      "orientationchange",
      () => {
        window.setTimeout(
          update,
          160
        );
      },
      {
        passive: true
      }
    );
  }


  /* =======================================================
     38. IMAGE LOAD / LAYOUT STABILITY
     ======================================================= */

  function bindImageStability() {
    $$("img").forEach(img => {
      if (img.complete) {
        return;
      }

      img.addEventListener(
        "load",
        () => {
          const scene =
            img.closest(
              ".scene"
            );

          if (scene) {
            scene.classList.add(
              "images-ready"
            );
          }
        },
        {
          once: true
        }
      );
    });
  }


  /* =======================================================
     39. BUTTON PRESS FEEDBACK
     ======================================================= */

  function bindButtonFeedback() {
    document.addEventListener(
      "pointerdown",
      event => {
        const button =
          event.target.closest(
            "button, [role='button'], a"
          );

        if (!button) return;

        button.classList.add(
          "is-pressed"
        );
      },
      {
        passive: true
      }
    );

    const removePressed =
      event => {
        const button =
          event.target.closest(
            "button, [role='button'], a"
          );

        if (!button) return;

        button.classList.remove(
          "is-pressed"
        );
      };

    document.addEventListener(
      "pointerup",
      removePressed,
      {
        passive: true
      }
    );

    document.addEventListener(
      "pointercancel",
      removePressed,
      {
        passive: true
      }
    );

    document.addEventListener(
      "pointerleave",
      removePressed,
      {
        passive: true
      }
    );
  }


  /* =======================================================
     40. OPTIONAL "BACK" BUTTON
     ======================================================= */

  function bindBackButtons() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-action='back'], .js-back"
          );

        if (!button) return;

        event.preventDefault();

        const previous =
          getPreviousScene();

        if (!previous) return;

        goToScene(
          getSceneName(previous),
          {
            reason: "back-button",
            trigger: button
          }
        );
      }
    );
  }


  /* =======================================================
     41. REPLAY
     * Useful after website has been completed.
     * ======================================================= */

  async function replayJourney() {
    /*
     * Stop both tracks.
     */
    if (music1) {
      resetAudio(music1);
    }

    if (music2) {
      resetAudio(music2);
    }

    /*
     * Reset state.
     */
    state.currentScene = null;
    state.previousScene = null;

    state.journeyStarted = false;
    state.confessionReached = false;
    state.afterglowReached = false;

    state.music1Started = false;
    state.music1Stopped = false;
    state.music2Started = false;

    document.documentElement.classList.remove(
      "journey-started",
      "music1-playing",
      "music1-stopped",
      "music2-playing",
      "approaching-confession",
      "confession-unlocked",
      "confession-scene-active",
      "confession-revealed",
      "afterglow-active"
    );

    /*
     * Reset scene-specific states.
     */
    sceneElements.forEach(scene => {
      scene.classList.remove(
        "is-active",
        "has-entered",
        "is-entering",
        "is-leaving",
        "is-confession-revealed",
        "confession-settled",
        "afterglow-settled"
      );

      scene
        .querySelectorAll(
          ".is-typing, .typing-complete"
        )
        .forEach(element => {
          element.classList.remove(
            "is-typing",
            "typing-complete"
          );
        });
    });

    /*
     * Reset typing.
     */
    $$(CONFIG.selectors.typing).forEach(
      element => {
        delete element.dataset.typingDone;
      }
    );

    /*
     * Restore initial scene.
     */
    const initial =
      findInitialScene();

    if (initial) {
      setSceneActive(initial);

      state.currentScene =
        getSceneName(initial);

      resetSceneScroll(initial);

      focusScene(initial);
    }

    log("Journey replayed.");
  }


  function bindReplay() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-replay], .js-replay"
          );

        if (!button) return;

        event.preventDefault();

        replayJourney();
      }
    );
  }


  /* =======================================================
     42. HASH SUPPORT
     * Optional.
     *
     * URL:
     * #scene-letter
     *
     * Ini tidak dipakai sebagai primary navigation,
     * tetapi berguna untuk debugging/deep linking.
     * ======================================================= */

  function getHashScene() {
    const hash =
      window.location.hash;

    if (!hash) return null;

    return getScene(
      hash
    );
  }


  async function handleInitialHash() {
    const target =
      getHashScene();

    if (!target) return;

    /*
     * Jangan memulai music dari hash.
     * Browser autoplay policy + emotional flow.
     */
    setSceneActive(target);

    state.currentScene =
      getSceneName(target);

    resetSceneScroll(target);

    sceneDidEnter(
      target,
      {
        reason: "initial-hash",
        silentFocus: true
      }
    );
  }


  function bindHashNavigation() {
    window.addEventListener(
      "hashchange",
      () => {
        const target =
          getHashScene();

        if (!target) return;

        /*
         * Hash navigation bersifat intentional.
         */
        goToScene(
          getSceneName(target),
          {
            reason: "hash"
          }
        );
      }
    );
  }


  /* =======================================================
     43. OPTIONAL HASH UPDATE
     * Tidak memaksa URL berubah setiap scene.
     * Default: disabled.
     *
     * Bisa diaktifkan HTML:
     * <html data-sync-hash="true">
     * ======================================================= */

  function syncHash(scene) {
    if (!scene) return;

    if (
      document.documentElement.dataset.syncHash !==
      "true"
    ) {
      return;
    }

    const name =
      getSceneName(scene);

    if (!name) return;

    try {
      history.replaceState(
        null,
        "",
        `#scene-${name}`
      );
    } catch {
      // Ignore.
    }
  }


  /* =======================================================
     44. INITIAL SCENE
     ======================================================= */

  async function initializeInitialScene() {
    prepareAllScenes();

    const hashScene =
      getHashScene();

    const initial =
      hashScene ||
      findInitialScene();

    if (!initial) {
      warn(
        "Tidak ada scene yang bisa dijadikan initial scene."
      );

      return;
    }

    state.currentScene =
      getSceneName(initial);

    /*
     * Only after JS is ready:
     * activate exactly one scene.
     */
    setSceneActive(initial);

    resetSceneScroll(initial);

    sceneDidEnter(
      initial,
      {
        reason: "initialization",
        silentFocus: true
      }
    );

    syncHash(initial);

    log(
      "Initial scene:",
      state.currentScene
    );
  }


  /* =======================================================
     45. DATA-NEXT AUTO FALLBACK
     *
     * Jika HTML memiliki button tanpa data-next,
     * tapi class `.js-next`, getNextScene() akan dipakai.
     * ======================================================= */

  function decorateNavigationButtons() {
    sceneElements.forEach(scene => {
      const next =
        getNextScene(scene);

      const previous =
        getPreviousScene(scene);

      /*
       * Jangan menimpa explicit data.
       */
      const nextButtons =
        $$(
          ".js-next, .scene-next, .btn-next, [data-action='next']",
          scene
        );

      nextButtons.forEach(button => {
        if (
          !button.dataset.next &&
          next
        ) {
          button.dataset.next =
            getSceneName(next);
        }
      });

      const prevButtons =
        $$(
          ".js-back, [data-action='back']",
          scene
        );

      prevButtons.forEach(button => {
        if (
          !button.dataset.prev &&
          previous
        ) {
          button.dataset.prev =
            getSceneName(previous);
        }
      });
    });
  }


  /* =======================================================
     46. OPEN/CLOSE SMALL PANELS
     * General purpose interaction untuk:
     * + cards
     * hidden text
     * memory annotations
     * personal notes
     * ======================================================= */

  function bindExpandablePanels() {
    document.addEventListener(
      "click",
      event => {
        const trigger =
          event.target.closest(
            "[data-expand]"
          );

        if (!trigger) return;

        const selector =
          trigger.dataset.expand;

        if (!selector) return;

        let panel = null;

        try {
          panel = $(selector);
        } catch {
          panel = null;
        }

        if (!panel) {
          panel =
            document.querySelector(
              `[data-expand-target="${selector}"]`
            );
        }

        if (!panel) return;

        event.preventDefault();

        const willOpen =
          !panel.classList.contains(
            "is-open"
          );

        panel.classList.toggle(
          "is-open",
          willOpen
        );

        trigger.classList.toggle(
          "is-active",
          willOpen
        );

        trigger.setAttribute(
          "aria-expanded",
          String(willOpen)
        );

        panel.setAttribute(
          "aria-hidden",
          String(!willOpen)
        );

        state.interactionCount++;
      }
    );
  }


  /* =======================================================
     47. "PLUS" BUTTON SAFETY
     * Specifically addresses Scene 4.
     *
     * Supports:
     * data-plus
     * data-toggle
     * .js-plus
     * ======================================================= */

  function bindPlusButtons() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-plus], .js-plus, [data-toggle]"
          );

        if (!button) return;

        /*
         * Jika tombol juga merupakan scene nav,
         * navigation handler sudah punya job.
         * Di sini hanya proses target panel.
         */
        const selector =
          button.dataset.plus ||
          button.dataset.toggle;

        if (!selector) return;

        let panel = null;

        try {
          panel = $(selector);
        } catch {
          panel = null;
        }

        if (!panel) {
          panel =
            button.parentElement?.querySelector(
              ".plus-content, .trait-detail, [data-plus-content]"
            );
        }

        if (!panel) return;

        event.preventDefault();

        const open =
          !panel.classList.contains(
            "is-open"
          );

        panel.classList.toggle(
          "is-open",
          open
        );

        button.classList.toggle(
          "is-open",
          open
        );

        button.setAttribute(
          "aria-expanded",
          String(open)
        );

        panel.setAttribute(
          "aria-hidden",
          String(!open)
        );

        state.interactionCount++;
      }
    );
  }


  /* =======================================================
     48. "SPECIAL BUTTON" EFFECT
     *
     * Buttons are not generic.
     * CSS can style according to data-button-role.
     * JS adds state classes.
     * ======================================================= */

  function bindSpecialButtonStates() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "button, [role='button'], a"
          );

        if (!button) return;

        const role =
          button.dataset.buttonRole;

        if (!role) return;

        button.dataset.lastActivated =
          String(Date.now());

        button.classList.add(
          "is-special-activated"
        );

        window.setTimeout(
          () => {
            button.classList.remove(
              "is-special-activated"
            );
          },
          700
        );
      }
    );
  }


  /* =======================================================
     49. SCENE PROGRESS
     * Optional tiny progress indicator.
     *
     * HTML:
     * <div data-scene-progress></div>
     * ======================================================= */

  function updateProgress(scene) {
    if (!scene) return;

    const indicator =
      $("[data-scene-progress]");

    if (!indicator) return;

    const index =
      sceneElements.indexOf(scene);

    const progress =
      sceneElements.length <= 1
        ? 1
        : (index + 1) /
          sceneElements.length;

    indicator.style.setProperty(
      "--scene-progress",
      String(progress)
    );

    indicator.setAttribute(
      "aria-valuenow",
      String(
        Math.round(progress * 100)
      )
    );
  }


  /* =======================================================
     50. PATCH SCENE ENTER TO UPDATE PROGRESS/HASH
     ======================================================= */

  const originalSceneDidEnter =
    sceneDidEnter;

  sceneDidEnter = function patchedSceneDidEnter(
    scene,
    meta = {}
  ) {
    originalSceneDidEnter(
      scene,
      meta
    );

    updateProgress(scene);
    syncHash(scene);
  };


  /* =======================================================
     51. START JOURNEY TEXT FALLBACK
     *
     * Jika HTML lupa data-start-journey,
     * kita tetap dapat mengenali tombol opening.
     * ======================================================= */

  function findStartButtons() {
    const explicit =
      $$(
        CONFIG.selectors.startJourney
      );

    if (explicit.length) {
      return explicit;
    }

    /*
     * Text fallback.
     */
    return $$(
      "button, [role='button']"
    ).filter(button => {
      const text =
        (
          button.textContent ||
          ""
        )
          .trim()
          .toLowerCase();

      return (
        text.includes("bukaa dulu") ||
        text.includes("buka dulu")
      );
    });
  }


  function bindStartFallback() {
    const buttons =
      findStartButtons();

    buttons.forEach(button => {
      if (
        button.dataset.startBound === "true"
      ) {
        return;
      }

      button.dataset.startBound = "true";

      button.addEventListener(
        "click",
        event => {
          /*
           * Jika handler utama sudah menangani,
           * state.journeyStarted mencegah duplikasi.
           */
          if (
            state.journeyStarted
          ) {
            return;
          }

          event.preventDefault();

          startJourney(button);
        }
      );
    });
  }


  /* =======================================================
     52. CONFESSION BUTTON FALLBACK
     ======================================================= */

  function findConfessionButton() {
    const explicit =
      $(
        CONFIG.selectors.confession
      );

    if (explicit) return explicit;

    return $$(
      "button, [role='button']"
    ).find(button => {
      const text =
        (
          button.textContent ||
          ""
        )
          .trim()
          .toLowerCase();

      return (
        text.includes("giliran aku") ||
        text.includes("sekarang giliranku") ||
        text.includes("my turn")
      );
    });
  }


  /* =======================================================
     53. CONFESSION BUTTON BINDING
     ======================================================= */

  function bindConfessionFallback() {
    const button =
      findConfessionButton();

    if (!button) return;

    /*
     * Hanya digunakan jika HTML memang menyediakan
     * explicit confession action.
     */
    if (
      button.dataset.confessionBound === "true"
    ) {
      return;
    }

    button.dataset.confessionBound =
      "true";

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();

        revealConfession(
          button
        );
      }
    );
  }


  /* =======================================================
     54. ESCAPE SAFETY
     ======================================================= */

  function bindEscapeSafety() {
    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key !== "Escape"
        ) {
          return;
        }

        /*
         * Close custom expandable panels.
         */
        $$(".is-open").forEach(
          element => {
            if (
              element.matches(
                "details"
              )
            ) {
              element.open = false;
            } else {
              element.classList.remove(
                "is-open"
              );
            }
          }
        );
      }
    );
  }


  /* =======================================================
     55. SCENE-SPECIFIC ATMOSPHERE
     *
     * CSS dapat menggunakan body class:
     *
     * html[data-scene="letter"]
     * html[data-scene="breath"]
     * html[data-scene="confession"]
     *
     * JS hanya menentukan state.
     * CSS yang menentukan feeling.
     * ======================================================= */

  function applyAtmosphere(scene) {
    if (!scene) return;

    const name =
      getSceneName(scene);

    document.documentElement.dataset.atmosphere =
      name || "";

    /*
     * Emotional compression menuju confession.
     */
    const intimateScenes = [
      CONFIG.scenes.serious,
      CONFIG.scenes.letter,
      CONFIG.scenes.breath,
      CONFIG.scenes.confession
    ];

    document.documentElement.classList.toggle(
      "atmosphere-intimate",
      intimateScenes.includes(name)
    );

    document.documentElement.classList.toggle(
      "atmosphere-quiet",
      name === CONFIG.scenes.breath
    );

    document.documentElement.classList.toggle(
      "atmosphere-peak",
      name === CONFIG.scenes.confession
    );
  }


  /* =======================================================
     56. PATCH ATMOSPHERE INTO SCENE ENTER
     ======================================================= */

  const originalSceneDidEnter2 =
    sceneDidEnter;

  sceneDidEnter = function patchedSceneDidEnter2(
    scene,
    meta = {}
  ) {
    originalSceneDidEnter2(
      scene,
      meta
    );

    applyAtmosphere(scene);
  };


  /* =======================================================
     57. PRELOAD MUSIC
     *
     * Jangan play.
     * Hanya membantu browser menyiapkan resource.
     * ======================================================= */

  function preloadAudio() {
    [music1, music2]
      .filter(Boolean)
      .forEach(audio => {
        try {
          audio.load();
        } catch {
          // Browser may already be loading it.
        }
      });
  }


  /* =======================================================
     58. AUDIO ERROR HANDLING
     ======================================================= */

  function bindAudioErrors() {
    [music1, music2]
      .filter(Boolean)
      .forEach(audio => {
        audio.addEventListener(
          "error",
          () => {
            warn(
              "Audio error:",
              audio.currentSrc ||
              audio.src ||
              "(source tidak diketahui)"
            );

            audio.closest(
              "[data-audio-container]"
            )?.classList.add(
              "audio-error"
            );
          }
        );
      });
  }


  /* =======================================================
     59. SCENE BUTTON ACCESSIBILITY
     ======================================================= */

  function improveButtonAccessibility() {
    $$(
      "[data-next], [data-prev], [data-go]"
    ).forEach(button => {
      if (
        button.tagName === "BUTTON"
      ) {
        return;
      }

      if (
        !button.hasAttribute(
          "role"
        )
      ) {
        button.setAttribute(
          "role",
          "button"
        );
      }

      if (
        !button.hasAttribute(
          "tabindex"
        )
      ) {
        button.setAttribute(
          "tabindex",
          "0"
        );
      }
    });
  }


  /* =======================================================
     60. ENTER / SPACE FOR ROLE=BUTTON
     ======================================================= */

  function bindRoleButtonKeyboard() {
    document.addEventListener(
      "keydown",
      event => {
        const element =
          event.target.closest(
            "[role='button']"
          );

        if (!element) return;

        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }

        event.preventDefault();

        element.click();
      }
    );
  }


  /* =======================================================
     61. SCENE TRANSITION CLEANUP
     ======================================================= */

  function cleanupPreviousScene(
    scene
  ) {
    if (!scene) return;

    scene.classList.remove(
      "is-leaving"
    );
  }


  /* =======================================================
     62. PATCH GO TO SCENE CLEANUP
     ======================================================= */

  const originalGoToScene =
    goToScene;

  goToScene = async function patchedGoToScene(
    targetName,
    meta = {}
  ) {
    const previous =
      getCurrentScene();

    const result =
      await originalGoToScene(
        targetName,
        meta
      );

    if (
      result &&
      previous &&
      previous !== getCurrentScene()
    ) {
      window.setTimeout(
        () => {
          cleanupPreviousScene(
            previous
          );
        },
        state.reducedMotion
          ? 0
          : CONFIG.transition.sceneMs
      );
    }

    return result;
  };


  /* =======================================================
     63. SAFE CLICK ON SCENE-BACKDROP
     *
     * Default OFF.
     * We do not want accidental scene navigation.
     * ======================================================= */

  function bindOptionalBackdropAdvance() {
    /*
     * Only activated if:
     *
     * <section data-backdrop-next="true">
     *
     * Even then, mobile remains conservative.
     */
    document.addEventListener(
      "click",
      event => {
        const scene =
          event.target.closest(
            ".scene[data-backdrop-next='true']"
          );

        if (!scene) return;

        /*
         * Only actual empty backdrop.
         */
        if (
          event.target !== scene
        ) {
          return;
        }

        const next =
          getNextScene(scene);

        if (!next) return;

        goToScene(
          getSceneName(next),
          {
            reason: "backdrop-click"
          }
        );
      }
    );
  }


  /* =======================================================
     64. SCENE DATA CONTRACT VALIDATION
     * Helpful during development.
     * ======================================================= */

  function validateSceneContract() {
    if (!DEBUG) return;

    sceneElements.forEach(scene => {
      const name =
        getSceneName(scene);

      if (!name) {
        warn(
          "Scene tanpa data-scene:",
          scene
        );
      }

      const next =
        getNextScene(scene);

      const previous =
        getPreviousScene(scene);

      log(
        `Scene "${name}"`,
        {
          next:
            next
              ? getSceneName(next)
              : null,
          previous:
            previous
              ? getSceneName(previous)
              : null
        }
      );
    });
  }


  /* =======================================================
     65. PUBLIC DEBUG API
     *
     * Console:
     *
     * BoluUbi.inspect()
     * BoluUbi.next()
     * BoluUbi.previous()
     * BoluUbi.go("letter")
     * BoluUbi.music()
     * BoluUbi.music2()
     * BoluUbi.confession()
     * BoluUbi.replay()
     * ======================================================= */

  window.BoluUbi = {
    get state() {
      return {
        ...state,
        currentScene:
          state.currentScene,
        previousScene:
          state.previousScene
      };
    },

    inspect() {
      const current =
        getCurrentScene();

      const result = {
        initialized:
          state.initialized,

        currentScene:
          state.currentScene,

        previousScene:
          state.previousScene,

        journeyStarted:
          state.journeyStarted,

        confessionReached:
          state.confessionReached,

        music1Started:
          state.music1Started,

        music1Stopped:
          state.music1Stopped,

        music2Started:
          state.music2Started,

        sceneCount:
          sceneElements.length,

        interactionCount:
          state.interactionCount,

        currentElement:
          current
            ? current
            : null
      };

      console.table({
        initialized:
          result.initialized,

        currentScene:
          result.currentScene,

        previousScene:
          result.previousScene,

        journeyStarted:
          result.journeyStarted,

        confessionReached:
          result.confessionReached,

        music1Started:
          result.music1Started,

        music1Stopped:
          result.music1Stopped,

        music2Started:
          result.music2Started,

        sceneCount:
          result.sceneCount,

        interactionCount:
          result.interactionCount
      });

      return result;
    },

    next() {
      const next =
        getNextScene();

      if (!next) {
        return false;
      }

      return goToScene(
        getSceneName(next),
        {
          reason: "debug-next"
        }
      );
    },

    previous() {
      const previous =
        getPreviousScene();

      if (!previous) {
        return false;
      }

      return goToScene(
        getSceneName(previous),
        {
          reason: "debug-previous"
        }
      );
    },

    go(name) {
      return goToScene(
        name,
        {
          reason: "debug-go"
        }
      );
    },

    music() {
      return startMusic1();
    },

    stopMusic() {
      return stopMusic1();
    },

    music2() {
      return startMusic2();
    },

    confession() {
      return revealConfession();
    },

    replay() {
      return replayJourney();
    },

    scenes() {
      return Array.from(
        scenes.keys()
      );
    }
  };


  /* =======================================================
     66. INITIALIZATION
     ======================================================= */

  async function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    log(
      "Initializing Bolu Ubi experience..."
    );

    /*
     * Base.
     */
    document.documentElement.classList.add(
      "js-ready"
    );

    /*
     * Prepare audio.
     */
    preloadAudio();
    bindAudioErrors();

    /*
     * Prepare scene architecture.
     */
    await initializeInitialScene();

    decorateNavigationButtons();

    /*
     * Core interactions.
     */
    bindNavigation();
    bindStartFallback();
    bindConfessionFallback();

    bindTypingTriggers();

    bindHydroponicsFallback();

    bindPlusButtons();
    bindExpandablePanels();

    bindSpecialButtonStates();

    bindConfessionReveal();

    bindReplay();

    bindBackButtons();

    /*
     * Platform safety.
     */
    explicitlyDisableScrollNavigation();
    bindMobileSafety();

    bindKeyboard();
    bindRoleButtonKeyboard();
    bindEscapeSafety();

    bindVisibilityHandling();
    bindViewportHandling();

    bindImageStability();
    bindButtonFeedback();

    bindHashNavigation();

    bindOptionalBackdropAdvance();

    improveButtonAccessibility();

    /*
     * Audio gesture awareness.
     */
    bindAudioUnlock();

    /*
     * Development helpers.
     */
    validateSceneContract();

    /*
     * Initial hash:
     * only visual navigation, no audio autoplay.
     */
    await handleInitialHash();

    log(
      "Bolu Ubi experience ready."
    );

    /*
     * Body-level ready marker.
     */
    document.documentElement.classList.add(
      "app-ready"
    );

    /*
     * Dispatch custom event.
     * Berguna jika CSS / future code ingin tahu
     * bahwa JS sudah selesai bootstrap.
     */
    document.dispatchEvent(
      new CustomEvent(
        "boluubi:ready",
        {
          detail: {
            state,
            scenes:
              Array.from(
                scenes.keys()
              )
          }
        }
      )
    );
  }


  /* =======================================================
     67. DOM READY
     ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
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


  /* =======================================================
     68. GLOBAL ERROR GUARD
     *
     * Satu interaction yang gagal tidak boleh
     * menghancurkan seluruh website.
     * ======================================================= */

  window.addEventListener(
    "error",
    event => {
      /*
       * Jangan expose error ke user.
       * Hanya console saat debug.
       */
      if (DEBUG) {
        console.error(
          "[BOLU UBI ERROR]",
          event.error ||
          event.message
        );
      }
    }
  );


  window.addEventListener(
    "unhandledrejection",
    event => {
      if (DEBUG) {
        console.error(
          "[BOLU UBI PROMISE ERROR]",
          event.reason
        );
      }
    }
  );

})();