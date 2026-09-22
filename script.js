/* ============================================================
   BOLU UBI — STORY ENGINE
   Tongzi 🤾‍♂️
   ------------------------------------------------------------
   HTML  = what the story says
   CSS   = what the story feels like
   JS    = when the story breathes

   This file controls:
   - scene navigation
   - scene transitions
   - audio state
   - typing
   - interactive reveals
   - responsive safety
   - accessibility
   - scene-specific behavior
   - navigation recovery/fallbacks
   ============================================================ */

(() => {
  "use strict";

  /* ============================================================
     01. CONFIGURATION
     ============================================================ */

  const CONFIG = {
    sceneSelector: [
      ".scene",
      "[data-scene]",
      '[id^="scene-"]',
      '[id^="scene"]'
    ].join(","),

    activeClass: "is-active",
    hiddenClass: "is-hidden",
    enteringClass: "is-entering",
    leavingClass: "is-leaving",

    transitionDuration: 520,
    transitionSafetyTimeout: 1100,

    audio: {
      music1: "music1.mp3",
      music2: "music2.mp3",

      music1Volume: 0.34,
      music2Volume: 0.38,

      fadeInDuration: 1600,
      fadeOutDuration: 1100,

      silenceBetweenTracks: 260
    },

    typing: {
      baseDelay: 18,
      punctuationExtra: 90,
      commaExtra: 45,
      paragraphPause: 560,
      sentencePause: 220,
      emotionalPause: 780
    },

    selectors: {
      navigationButton: [
        "[data-next-scene]",
        "[data-go-scene]",
        "[data-scene-target]",
        "[data-target-scene]",
        "[data-nav]",
        ".scene-next",
        ".next-scene",
        ".continue-button",
        ".scene-continue",
        ".scene-navigation button",
        ".scene-actions button",
        ".scene-footer button",
        ".letter-actions button",
        ".next-button",
        ".continue"
      ].join(","),

      revealButton: [
        "[data-reveal]",
        "[data-reveal-target]",
        ".reveal-trigger",
        ".trait-trigger",
        ".memory-trigger",
        ".detail-trigger"
      ].join(","),

      transitionOverlay: [
        ".scene-transition",
        ".transition-overlay",
        "#scene-transition",
        "#transition-overlay"
      ].join(","),

      letterSource: [
        "[data-letter-source]",
        "[data-letter]",
        ".letter-source"
      ].join(","),

      letterTarget: [
        "[data-letter-target]",
        ".letter-text",
        ".letter-content",
        ".typing-text",
        ".typed-letter"
      ].join("")
    },

    navigationText: {
      next: [
        "next",
        "lanjut",
        "selanjutnya",
        "terus",
        "continue",
        "buka",
        "lihat",
        "lihat lagi",
        "masuk",
        "ayo",
        "yuk",
        "gas",
        "flashback",
        "flashback dulu",
        "buka side quest"
      ],

      back: [
        "back",
        "kembali",
        "sebelumnya",
        "balik"
      ]
    }
  };


  /* ============================================================
     02. STATE
     ============================================================ */

  const state = {
    initialized: false,

    scenes: [],
    sceneMap: new Map(),

    currentScene: 1,
    previousScene: null,

    isTransitioning: false,
    transitionToken: 0,

    reducedMotion: false,

    letter: {
      running: false,
      completed: false,
      timerIds: [],
      abortController: null
    },

    audio: {
      music1: null,
      music2: null,

      activeTrack: null,

      fading: false,
      fadeAnimation: null,

      userHasInteracted: false
    },

    touch: {
      startX: 0,
      startY: 0,
      moved: false
    }
  };


  /* ============================================================
     03. BASIC UTILITIES
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


  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };


  const sleep = (ms) => {
    return new Promise(resolve => {
      window.setTimeout(resolve, ms);
    });
  };


  const isElement = (value) => {
    return value instanceof Element;
  };


  const normalizeText = (text) => {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };


  const escapeRegExp = (value) => {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };


  /* ============================================================
     04. SCENE DISCOVERY
     ============================================================ */

  function extractSceneNumber(element) {
    if (!element) return null;

    const dataScene =
      element.getAttribute("data-scene") ||
      element.getAttribute("data-scene-number");

    if (dataScene && /^\d+$/.test(dataScene.trim())) {
      return Number(dataScene.trim());
    }

    const id = element.id || "";

    const match = id.match(/scene[-_]?(\d+)/i);

    if (match) {
      return Number(match[1]);
    }

    const className =
      typeof element.className === "string"
        ? element.className
        : "";

    const classMatch = className.match(/scene[-_]?(\d+)/i);

    if (classMatch) {
      return Number(classMatch[1]);
    }

    return null;
  }


  function discoverScenes() {
    const candidates = $$(CONFIG.sceneSelector);

    const unique = [];
    const seen = new Set();

    for (const element of candidates) {
      if (!isElement(element)) continue;

      const number = extractSceneNumber(element);

      if (!number) continue;
      if (seen.has(number)) continue;

      seen.add(number);

      unique.push({
        number,
        element
      });
    }

    unique.sort((a, b) => a.number - b.number);

    state.scenes = unique;
    state.sceneMap.clear();

    for (const scene of unique) {
      state.sceneMap.set(scene.number, scene.element);
    }

    return unique;
  }


  function getScene(number) {
    return state.sceneMap.get(Number(number)) || null;
  }


  function getSceneNumberFromElement(element) {
    if (!element) return null;

    const direct = extractSceneNumber(element);

    if (direct) return direct;

    const sceneParent = element.closest(CONFIG.sceneSelector);

    if (!sceneParent) return null;

    return extractSceneNumber(sceneParent);
  }


  function getCurrentSceneElement() {
    return getScene(state.currentScene);
  }


  /* ============================================================
     05. SCENE VISIBILITY
     ============================================================ */

  function setSceneVisibility(sceneElement, visible) {
    if (!sceneElement) return;

    sceneElement.classList.toggle(
      CONFIG.activeClass,
      visible
    );

    sceneElement.classList.toggle(
      CONFIG.hiddenClass,
      !visible
    );

    sceneElement.setAttribute(
      "aria-hidden",
      visible ? "false" : "true"
    );

    if (visible) {
      sceneElement.removeAttribute("inert");
    } else {
      sceneElement.setAttribute("inert", "");
    }
  }


  function prepareScenes() {
    for (const scene of state.scenes) {
      setSceneVisibility(
        scene.element,
        scene.number === state.currentScene
      );

      scene.element.classList.remove(
        CONFIG.enteringClass,
        CONFIG.leavingClass
      );
    }
  }


  function resetSceneScroll(sceneElement) {
    if (!sceneElement) return;

    const scrollTargets = [
      sceneElement,
      $(".scene-content", sceneElement),
      $(".scene-inner", sceneElement),
      $(".scene-scroll", sceneElement),
      $(".letter-scroll", sceneElement)
    ].filter(Boolean);

    for (const target of scrollTargets) {
      try {
        target.scrollTop = 0;
        target.scrollLeft = 0;
      } catch {
        // Safe failure.
      }
    }
  }


  /* ============================================================
     06. TRANSITION OVERLAY
     ============================================================ */

  function ensureTransitionOverlay() {
    let overlay = $(CONFIG.selectors.transitionOverlay);

    if (overlay) {
      return overlay;
    }

    overlay = document.createElement("div");

    overlay.className = "scene-transition";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      pointerEvents: "none",
      opacity: "0",
      background: "var(--transition-bg, #f7f0e6)",
      transition: "opacity 420ms ease"
    });

    overlay.setAttribute("aria-hidden", "true");

    document.body.appendChild(overlay);

    return overlay;
  }


  async function transitionCover() {
    const overlay = ensureTransitionOverlay();

    if (!overlay || state.reducedMotion) {
      return;
    }

    overlay.style.transition =
      `opacity ${CONFIG.transitionDuration}ms ease`;

    overlay.style.opacity = "0";

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";

          window.setTimeout(
            resolve,
            Math.min(CONFIG.transitionDuration, 500)
          );
        });
      });
    });
  }


  async function transitionReveal() {
    const overlay = ensureTransitionOverlay();

    if (!overlay || state.reducedMotion) {
      return;
    }

    overlay.style.opacity = "1";

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.opacity = "0";

          window.setTimeout(
            resolve,
            Math.min(CONFIG.transitionDuration, 500)
          );
        });
      });
    });
  }


  /* ============================================================
     07. AUDIO ENGINE
     ============================================================ */

  function createAudio(src) {
    const audio = new Audio();

    audio.src = src;
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0;

    /*
     * Prevents mobile browsers from trying to show
     * unnecessary media behavior.
     */
    audio.setAttribute("playsinline", "");

    return audio;
  }


  function initializeAudio() {
    if (!state.audio.music1) {
      state.audio.music1 =
        createAudio(CONFIG.audio.music1);
    }

    if (!state.audio.music2) {
      state.audio.music2 =
        createAudio(CONFIG.audio.music2);
    }

    /*
     * Preload without playing.
     *
     * Important:
     * We intentionally DO NOT autoplay here.
     */
    try {
      state.audio.music1.load();
      state.audio.music2.load();
    } catch {
      // Browser may reject preload. Playback can still attempt later.
    }
  }


  function cancelAudioFade() {
    if (state.audio.fadeAnimation) {
      cancelAnimationFrame(
        state.audio.fadeAnimation
      );

      state.audio.fadeAnimation = null;
    }

    state.audio.fading = false;
  }


  function getTrackVolume(track) {
    if (track === state.audio.music1) {
      return CONFIG.audio.music1Volume;
    }

    if (track === state.audio.music2) {
      return CONFIG.audio.music2Volume;
    }

    return 0.35;
  }


  function fadeAudio(
    audio,
    from,
    to,
    duration,
    stopAtEnd = false
  ) {
    return new Promise(resolve => {
      if (!audio) {
        resolve();
        return;
      }

      cancelAudioFade();

      if (state.reducedMotion) {
        audio.volume = clamp(to, 0, 1);

        if (stopAtEnd && to <= 0.001) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {
            // Ignore.
          }
        }

        resolve();
        return;
      }

      const start = performance.now();

      audio.volume = clamp(from, 0, 1);

      state.audio.fading = true;

      const tick = (now) => {
        const elapsed = now - start;

        const progress = clamp(
          elapsed / Math.max(duration, 1),
          0,
          1
        );

        /*
         * Smoothstep.
         * Softer than a linear audio fade.
         */
        const eased =
          progress * progress *
          (3 - 2 * progress);

        audio.volume =
          clamp(
            from + (to - from) * eased,
            0,
            1
          );

        if (progress >= 1) {
          state.audio.fadeAnimation = null;
          state.audio.fading = false;

          if (
            stopAtEnd &&
            to <= 0.001
          ) {
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch {
              // Ignore.
            }
          }

          resolve();
          return;
        }

        state.audio.fadeAnimation =
          requestAnimationFrame(tick);
      };

      state.audio.fadeAnimation =
        requestAnimationFrame(tick);
    });
  }


  async function startTrack(
    trackName,
    fadeIn = true
  ) {
    const audio =
      state.audio[trackName];

    if (!audio) return false;

    const targetVolume =
      getTrackVolume(audio);

    cancelAudioFade();

    try {
      audio.volume = fadeIn ? 0 : targetVolume;

      /*
       * play() is intentionally called from navigation
       * initiated by user interaction whenever possible.
       */
      const playPromise = audio.play();

      if (
        playPromise &&
        typeof playPromise.then === "function"
      ) {
        await playPromise;
      }

      state.audio.activeTrack = trackName;

      if (fadeIn) {
        await fadeAudio(
          audio,
          0,
          targetVolume,
          CONFIG.audio.fadeInDuration
        );
      }

      return true;
    } catch (error) {
      /*
       * Autoplay restrictions should never crash the
       * navigation system.
       */
      console.warn(
        `[Bolu Ubi] Could not play ${trackName}:`,
        error
      );

      return false;
    }
  }


  async function stopTrack(
    trackName,
    fadeOut = true
  ) {
    const audio =
      state.audio[trackName];

    if (!audio) return;

    cancelAudioFade();

    try {
      if (fadeOut && audio.paused === false) {
        await fadeAudio(
          audio,
          audio.volume,
          0,
          CONFIG.audio.fadeOutDuration,
          true
        );
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
      }
    } catch {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
      } catch {
        // Ignore.
      }
    }

    if (
      state.audio.activeTrack === trackName
    ) {
      state.audio.activeTrack = null;
    }
  }


  async function transitionMusic1ToMusic2() {
    /*
     * This is intentionally sequential:
     *
     * MUSIC 1
     *    ↓
     * fade out
     *    ↓
     * STOP
     *    ↓
     * SILENCE
     *    ↓
     * MUSIC 2
     *    ↓
     * fade in
     */

    await stopTrack("music1", true);

    await sleep(
      CONFIG.audio.silenceBetweenTracks
    );

    await startTrack("music2", true);
  }


  async function handleAudioForSceneChange(
    from,
    to
  ) {
    /*
     * Scene 1 → 2:
     * Start music1.
     */
    if (
      from === 1 &&
      to === 2
    ) {
      state.audio.userHasInteracted = true;

      await startTrack(
        "music1",
        true
      );

      return;
    }

    /*
     * Scene 9 → 10:
     * music1 must be completely stopped before music2.
     */
    if (
      from === 9 &&
      to === 10
    ) {
      await transitionMusic1ToMusic2();

      return;
    }

    /*
     * Safety:
     * If somehow music1 survives beyond Scene 9,
     * kill it when entering Scene 10.
     */
    if (
      to === 10 &&
      state.audio.music1 &&
      !state.audio.music1.paused
    ) {
      await stopTrack("music1", true);

      if (
        !state.audio.music2 ||
        state.audio.music2.paused
      ) {
        await sleep(
          CONFIG.audio.silenceBetweenTracks
        );

        await startTrack(
          "music2",
          true
        );
      }
    }
  }


  /* ============================================================
     08. NAVIGATION TARGET NORMALIZATION
     ============================================================ */

  function normalizeSceneTarget(rawTarget) {
    if (
      rawTarget === null ||
      rawTarget === undefined
    ) {
      return null;
    }

    const raw = String(rawTarget)
      .trim()
      .toLowerCase();

    if (!raw) return null;

    /*
     * Direct number:
     * "8"
     */
    if (/^\d+$/.test(raw)) {
      return Number(raw);
    }

    /*
     * scene-8
     * scene_8
     * scene8
     */
    const sceneMatch =
      raw.match(/scene[-_]?(\d+)/i);

    if (sceneMatch) {
      return Number(sceneMatch[1]);
    }

    /*
     * "#scene-8"
     */
    const hashMatch =
      raw.match(/#scene[-_]?(\d+)/i);

    if (hashMatch) {
      return Number(hashMatch[1]);
    }

    /*
     * data target may be written:
     * "next:8"
     */
    const colonMatch =
      raw.match(/(?:next|go|goto|target)[:\-_ ]?(\d+)/i);

    if (colonMatch) {
      return Number(colonMatch[1]);
    }

    return null;
  }


  /* ============================================================
     09. EXPLICIT TARGET RESOLUTION
     ============================================================ */

  function resolveExplicitTarget(button) {
    if (!button) return null;

    const attributes = [
      "data-next-scene",
      "data-go-scene",
      "data-scene-target",
      "data-target-scene",
      "data-target",
      "data-nav"
    ];

    for (const attr of attributes) {
      const value =
        button.getAttribute(attr);

      const target =
        normalizeSceneTarget(value);

      if (target) {
        return target;
      }
    }

    /*
     * href="#scene-9"
     */
    const href =
      button.getAttribute("href");

    if (href) {
      const target =
        normalizeSceneTarget(href);

      if (target) {
        return target;
      }
    }

    /*
     * id itself may contain the target.
     */
    const idTarget =
      normalizeSceneTarget(
        button.id
      );

    if (idTarget) {
      return idTarget;
    }

    /*
     * aria-label may explicitly reveal navigation.
     */
    const aria =
      button.getAttribute("aria-label");

    const ariaTarget =
      normalizeSceneTarget(aria);

    if (ariaTarget) {
      return ariaTarget;
    }

    return null;
  }


  /* ============================================================
     10. SEMANTIC TARGET RESOLUTION
     ============================================================ */

  function inferDirectionFromText(text) {
    const normalized =
      normalizeText(text);

    if (!normalized) return null;

    for (
      const word of CONFIG.navigationText.back
    ) {
      if (
        normalized === word ||
        normalized.includes(word)
      ) {
        return "back";
      }
    }

    for (
      const word of CONFIG.navigationText.next
    ) {
      if (
        normalized === word ||
        normalized.includes(word)
      ) {
        return "next";
      }
    }

    return null;
  }


  function inferTargetFromClasses(button) {
    if (!button) return null;

    const className =
      typeof button.className === "string"
        ? button.className.toLowerCase()
        : "";

    /*
     * Explicit "next" class.
     */
    if (
      /\b(next|continue|lanjut|forward)\b/.test(
        className
      )
    ) {
      return "next";
    }

    /*
     * Explicit "back" class.
     */
    if (
      /\b(back|previous|prev|kembali)\b/.test(
        className
      )
    ) {
      return "back";
    }

    return null;
  }


  function inferTargetDirection(button) {
    if (!button) return null;

    const semanticFromClass =
      inferTargetFromClasses(button);

    if (semanticFromClass) {
      return semanticFromClass;
    }

    const text =
      button.textContent || "";

    return inferDirectionFromText(text);
  }


  /* ============================================================
     11. CONTEXTUAL NAVIGATION DETECTION
     ============================================================ */

  function isInsideNavigationContainer(button) {
    if (!button) return false;

    const navigationContainer =
      button.closest(
        [
          ".scene-actions",
          ".scene-action",
          ".scene-navigation",
          ".scene-nav",
          ".scene-footer",
          ".navigation",
          ".nav-actions",
          ".letter-actions",
          ".letter-navigation",
          ".next-wrap",
          ".continue-wrap",
          ".continue-area",
          ".story-actions",
          ".story-navigation",
          ".scene-controls",
          ".footer-actions"
        ].join(",")
      );

    return Boolean(
      navigationContainer
    );
  }


  function isInteractiveRevealButton(button) {
    if (!button) return false;

    if (
      button.matches(
        CONFIG.selectors.revealButton
      )
    ) {
      return true;
    }

    /*
     * These controls belong to internal interactions,
     * not scene navigation.
     */
    const revealParent =
      button.closest(
        [
          ".trait-card",
          ".trait-item",
          ".memory-card",
          ".memory-item",
          ".detail-card",
          ".hydroponics",
          ".hydro-card",
          ".fact-card",
          "[data-reveal-container]"
        ].join(",")
      );

    return Boolean(revealParent);
  }


  function isNavigationCandidate(
    button,
    sceneNumber
  ) {
    if (!button) return false;

    if (
      button.disabled ||
      button.getAttribute("aria-disabled") === "true"
    ) {
      return false;
    }

    /*
     * We only treat buttons/links/role-buttons as
     * navigation candidates.
     */
    const tag =
      button.tagName.toLowerCase();

    const validElement =
      tag === "button" ||
      tag === "a" ||
      button.getAttribute("role") === "button";

    if (!validElement) {
      return false;
    }

    /*
     * Never hijack reveal interactions.
     */
    if (
      isInteractiveRevealButton(button)
    ) {
      return false;
    }

    /*
     * Explicit navigation attributes always win.
     */
    if (
      resolveExplicitTarget(button)
    ) {
      return true;
    }

    /*
     * Navigation class / container.
     */
    if (
      inferTargetFromClasses(button)
    ) {
      return true;
    }

    if (
      isInsideNavigationContainer(button)
    ) {
      return true;
    }

    /*
     * Scene 8 is special.
     *
     * This is the exact architecture fix for the
     * previous bug.
     *
     * If Scene 8 contains a normal button intended
     * to continue, we should NOT require its text to
     * literally contain "next".
     */
    if (sceneNumber === 8) {
      const currentScene =
        getScene(8);

      if (!currentScene) {
        return false;
      }

      const allButtons =
        $$(
          "button, a, [role='button']",
          currentScene
        ).filter(
          candidate =>
            !candidate.disabled &&
            !isInteractiveRevealButton(candidate)
        );

      /*
       * If this is the only usable control in Scene 8,
       * it is almost certainly the continuation button.
       */
      if (
        allButtons.length === 1 &&
        allButtons[0] === button
      ) {
        return true;
      }

      /*
       * If it is visually placed toward the lower
       * action area, allow contextual navigation.
       */
      const rect =
        button.getBoundingClientRect();

      const sceneRect =
        currentScene.getBoundingClientRect();

      const relativeTop =
        rect.top - sceneRect.top;

      const relativeHeight =
        sceneRect.height || window.innerHeight;

      if (
        relativeTop >
        relativeHeight * 0.55
      ) {
        return true;
      }
    }

    /*
     * Scene 9 has the same safety principle.
     */
    if (sceneNumber === 9) {
      const currentScene =
        getScene(9);

      if (!currentScene) {
        return false;
      }

      const allButtons =
        $$(
          "button, a, [role='button']",
          currentScene
        ).filter(
          candidate =>
            !candidate.disabled &&
            !isInteractiveRevealButton(candidate)
        );

      if (
        allButtons.length === 1 &&
        allButtons[0] === button
      ) {
        return true;
      }
    }

    return false;
  }


  /* ============================================================
     12. CONTEXTUAL FALLBACK TARGET
     ============================================================ */

  function getContextualFallbackTarget(
    button,
    currentScene
  ) {
    if (!button || !currentScene) {
      return null;
    }

    /*
     * IMPORTANT:
     * Scene 8 → 9 is deliberately hard-defined.
     *
     * This is not a guess based on button wording.
     * It is part of the story architecture.
     */
    if (
      currentScene === 8 &&
      isNavigationCandidate(
        button,
        currentScene
      )
    ) {
      return 9;
    }

    /*
     * Scene 9 → 10.
     */
    if (
      currentScene === 9 &&
      isNavigationCandidate(
        button,
        currentScene
      )
    ) {
      return 10;
    }

    /*
     * Scene 1 → 2.
     */
    if (
      currentScene === 1 &&
      isNavigationCandidate(
        button,
        currentScene
      )
    ) {
      return 2;
    }

    /*
     * Generic fallback for remaining story scenes.
     *
     * Only applies to controls that have already
     * been classified as navigation candidates.
     */
    if (
      isNavigationCandidate(
        button,
        currentScene
      )
    ) {
      const next =
        currentScene + 1;

      if (getScene(next)) {
        return next;
      }
    }

    return null;
  }


  /* ============================================================
     13. COMPLETE TARGET RESOLUTION
     ============================================================ */

  function resolveNavigationTarget(button) {
    if (!button) return null;

    const currentScene =
      getSceneNumberFromElement(button) ||
      state.currentScene;

    /*
     * PRIORITY 1
     * Explicit target.
     */
    const explicit =
      resolveExplicitTarget(button);

    if (
      explicit &&
      getScene(explicit)
    ) {
      return explicit;
    }

    /*
     * PRIORITY 2
     * Semantic direction.
     */
    const direction =
      inferTargetDirection(button);

    if (direction === "next") {
      const next =
        currentScene + 1;

      if (getScene(next)) {
        return next;
      }
    }

    if (direction === "back") {
      const previous =
        currentScene - 1;

      if (
        previous >= 1 &&
        getScene(previous)
      ) {
        return previous;
      }
    }

    /*
     * PRIORITY 3
     * Contextual scene fallback.
     *
     * This is the part missing from the previous version.
     */
    const contextual =
      getContextualFallbackTarget(
        button,
        currentScene
      );

    if (
      contextual &&
      getScene(contextual)
    ) {
      return contextual;
    }

    return null;
  }


  /* ============================================================
     14. NAVIGATION CLICK HANDLER
     ============================================================ */

  async function handleNavigationClick(event) {
    const clicked =
      event.target;

    if (!isElement(clicked)) {
      return;
    }

    const button =
      clicked.closest(
        "button, a, [role='button']"
      );

    if (!button) {
      return;
    }

    /*
     * If the element is inside a reveal interaction,
     * do not let scene navigation steal it.
     */
    if (
      isInteractiveRevealButton(button)
    ) {
      return;
    }

    /*
     * External links must remain normal links.
     */
    if (
      button.tagName.toLowerCase() === "a"
    ) {
      const href =
        button.getAttribute("href");

      if (
        href &&
        !href.startsWith("#scene") &&
        !href.startsWith("javascript:")
      ) {
        return;
      }
    }

    const currentScene =
      getSceneNumberFromElement(button) ||
      state.currentScene;

    /*
     * Resolve target BEFORE preventing default.
     */
    let target =
      resolveNavigationTarget(button);

    /*
     * ABSOLUTE RECOVERY:
     *
     * If this is a recognized navigation button
     * in Scene 8, Scene 8 MUST lead to Scene 9.
     *
     * This prevents the exact failure where the
     * previous resolver returned null.
     */
    if (
      !target &&
      currentScene === 8 &&
      isNavigationCandidate(
        button,
        8
      )
    ) {
      target = 9;
    }

    /*
     * Same principle for Scene 9.
     */
    if (
      !target &&
      currentScene === 9 &&
      isNavigationCandidate(
        button,
        9
      )
    ) {
      target = 10;
    }

    if (!target) {
      return;
    }

    /*
     * Only now prevent default.
     */
    event.preventDefault();
    event.stopPropagation();

    /*
     * Scene 8 must never accidentally remain Scene 8.
     */
    if (
      currentScene === 8 &&
      target !== 9
    ) {
      target = 9;
    }

    /*
     * Scene 9 must never accidentally remain Scene 9.
     */
    if (
      currentScene === 9 &&
      target !== 10
    ) {
      target = 10;
    }

    /*
     * Scene 1's first click is the music gesture.
     */
    if (
      currentScene === 1 &&
      target === 2
    ) {
      state.audio.userHasInteracted = true;
    }

    await goToScene(target);
  }


  function bindNavigationSystem() {
    /*
     * ONE delegated click listener.
     *
     * We intentionally do not attach individual listeners
     * to every button because scenes may be dynamically
     * changed/revealed.
     */
    document.addEventListener(
      "click",
      handleNavigationClick,
      false
    );
  }


  /* ============================================================
     15. SCENE TRANSITION ENGINE
     ============================================================ */

  async function goToScene(targetScene) {
    const target =
      Number(targetScene);

    if (
      !Number.isFinite(target)
    ) {
      return false;
    }

    if (
      !getScene(target)
    ) {
      console.warn(
        `[Bolu Ubi] Scene ${target} does not exist.`
      );

      return false;
    }

    if (
      state.isTransitioning
    ) {
      return false;
    }

    if (
      target === state.currentScene
    ) {
      return false;
    }

    const from =
      state.currentScene;

    const fromElement =
      getScene(from);

    const toElement =
      getScene(target);

    if (!toElement) {
      return false;
    }

    state.isTransitioning = true;

    const transitionToken =
      ++state.transitionToken;

    try {
      /*
       * Prepare outgoing scene.
       */
      if (fromElement) {
        fromElement.classList.add(
          CONFIG.leavingClass
        );
      }

      /*
       * Fade/cover visual.
       */
      await transitionCover();

      if (
        transitionToken !==
        state.transitionToken
      ) {
        return false;
      }

      /*
       * Change scene.
       */
      state.previousScene = from;
      state.currentScene = target;

      for (const scene of state.scenes) {
        setSceneVisibility(
          scene.element,
          scene.number === target
        );
      }

      resetSceneScroll(toElement);

      toElement.classList.remove(
        CONFIG.leavingClass
      );

      toElement.classList.add(
        CONFIG.enteringClass
      );

      /*
       * Audio transition occurs according
       * to the emotional architecture.
       */
      await handleAudioForSceneChange(
        from,
        target
      );

      /*
       * Scene-specific initialization.
       */
      await runSceneEnterHook(
        target,
        from
      );

      /*
       * Reveal.
       */
      await transitionReveal();

      /*
       * Give CSS entrance animation a moment.
       */
      if (!state.reducedMotion) {
        await sleep(80);
      }

      toElement.classList.remove(
        CONFIG.enteringClass
      );

      if (fromElement) {
        fromElement.classList.remove(
          CONFIG.leavingClass
        );
      }

      updateProgressIndicators();

      updateDocumentTitle(target);

      return true;
    } catch (error) {
      console.error(
        "[Bolu Ubi] Scene transition error:",
        error
      );

      /*
       * Recovery:
       * ensure target is still visible.
       */
      for (const scene of state.scenes) {
        setSceneVisibility(
          scene.element,
          scene.number === target
        );
      }

      return false;
    } finally {
      state.isTransitioning = false;
    }
  }


  /* ============================================================
     16. DOCUMENT TITLE
     ============================================================ */

  function updateDocumentTitle(sceneNumber) {
    /*
     * Keep the requested browser tab title.
     */
    document.title = "Bolu Ubi 🐣";
  }


  /* ============================================================
     17. SCENE 2 — MATH / BIRTHDAY
     ============================================================ */

  function typesetMathIfAvailable() {
    /*
     * MathJax is optional.
     *
     * The page should NEVER depend on MathJax
     * to initialize navigation.
     */
    if (
      window.MathJax &&
      typeof window.MathJax.typesetPromise === "function"
    ) {
      try {
        return window.MathJax.typesetPromise();
      } catch {
        return Promise.resolve();
      }
    }

    return Promise.resolve();
  }


  async function enterScene2() {
    await typesetMathIfAvailable();

    /*
     * Subtle entrance treatment for math blocks.
     */
    const scene =
      getScene(2);

    if (!scene) return;

    const equation =
      $(
        ".equation, .math-equation, [data-equation]",
        scene
      );

    if (equation) {
      equation.classList.add(
        "math-ready"
      );
    }
  }


  /* ============================================================
     18. SCENE 3 — TIMELINE
     ============================================================ */

  function enterScene3() {
    const scene =
      getScene(3);

    if (!scene) return;

    const timelineItems =
      $$(
        ".timeline-item, [data-timeline-item]",
        scene
      );

    timelineItems.forEach(
      (item, index) => {
        item.style.setProperty(
          "--timeline-index",
          index
        );
      }
    );
  }


  /* ============================================================
     19. SCENE 4 — TRAIT REVEALS
     ============================================================ */

  function initializeRevealSystem(sceneNumber) {
    const scene =
      getScene(sceneNumber);

    if (!scene) return;

    const revealButtons =
      $$(
        CONFIG.selectors.revealButton,
        scene
      );

    revealButtons.forEach(
      (button, index) => {
        /*
         * If there is no target attribute,
         * try to infer the adjacent reveal content.
         */
        let targetSelector =
          button.getAttribute(
            "data-reveal"
          ) ||
          button.getAttribute(
            "data-reveal-target"
          );

        let target = null;

        if (targetSelector) {
          try {
            target =
              scene.querySelector(
                targetSelector
              );
          } catch {
            target = null;
          }

          /*
           * It may be an ID without "#".
           */
          if (!target) {
            target =
              document.getElementById(
                targetSelector.replace(/^#/, "")
              );
          }
        }

        /*
         * Try aria-controls.
         */
        if (!target) {
          const controls =
            button.getAttribute(
              "aria-controls"
            );

          if (controls) {
            target =
              document.getElementById(
                controls
              );
          }
        }

        /*
         * Try common adjacent structures.
         */
        if (!target) {
          target =
            button.parentElement?.querySelector(
              ".reveal-content, .trait-detail, .detail, .hidden-detail, [data-reveal-content]"
            );
        }

        /*
         * Try closest card.
         */
        if (!target) {
          const card =
            button.closest(
              ".trait-card, .trait-item, .memory-card, .memory-item, .detail-card"
            );

          if (card) {
            target =
              $(".reveal-content, .trait-detail, .detail, .hidden-detail, [data-reveal-content]", card);
          }
        }

        if (!target) return;

        button.setAttribute(
          "aria-expanded",
          "false"
        );

        target.setAttribute(
          "aria-hidden",
          "true"
        );

        target.classList.add(
          "reveal-hidden"
        );

        /*
         * Prevent duplicate listeners.
         */
        if (
          button.dataset.revealBound === "true"
        ) {
          return;
        }

        button.dataset.revealBound = "true";

        button.addEventListener(
          "click",
          event => {
            /*
             * Stop delegated scene navigation.
             */
            event.preventDefault();
            event.stopPropagation();

            const isOpen =
              button.getAttribute(
                "aria-expanded"
              ) === "true";

            button.setAttribute(
              "aria-expanded",
              String(!isOpen)
            );

            target.setAttribute(
              "aria-hidden",
              String(isOpen)
            );

            target.classList.toggle(
              "reveal-hidden",
              isOpen
            );

            target.classList.toggle(
              "is-revealed",
              !isOpen
            );

            button.classList.toggle(
              "is-open",
              !isOpen
            );
          }
        );

        /*
         * Stagger metadata for CSS.
         */
        button.style.setProperty(
          "--reveal-index",
          index
        );
      }
    );
  }


  /* ============================================================
     20. SCENE 5 — HYDROPONICS / MEMORY
     ============================================================ */

  function initializeHydroponics() {
    const scene =
      getScene(5);

    if (!scene) return;

    /*
     * Support the existing reveal system.
     */
    initializeRevealSystem(5);

    /*
     * Dedicated hydroponics controls, if present.
     */
    const hydroButtons =
      $$(
        [
          "[data-hydroponics]",
          "[data-hydro-reveal]",
          ".hydroponics-trigger",
          ".hydro-trigger"
        ].join(","),
        scene
      );

    hydroButtons.forEach(
      button => {
        if (
          button.dataset.hydroBound === "true"
        ) {
          return;
        }

        button.dataset.hydroBound = "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const targetSelector =
              button.getAttribute(
                "data-hydroponics"
              ) ||
              button.getAttribute(
                "data-hydro-reveal"
              );

            let target = null;

            if (targetSelector) {
              try {
                target =
                  scene.querySelector(
                    targetSelector
                  );
              } catch {
                target = null;
              }

              if (!target) {
                target =
                  document.getElementById(
                    targetSelector.replace(/^#/, "")
                  );
              }
            }

            if (!target) {
              target =
                button.parentElement?.querySelector(
                  ".hydro-detail, .hydro-content, .hydroponics-detail"
                );
            }

            if (!target) {
              return;
            }

            const currentlyOpen =
              target.classList.contains(
                "is-revealed"
              );

            target.classList.toggle(
              "is-revealed",
              !currentlyOpen
            );

            target.setAttribute(
              "aria-hidden",
              String(currentlyOpen)
            );

            button.setAttribute(
              "aria-expanded",
              String(!currentlyOpen)
            );
          }
        );
      }
    );
  }


  /* ============================================================
     21. SCENE 6 — PHOTO
     ============================================================ */

  function preparePhoto(sceneNumber) {
    const scene =
      getScene(sceneNumber);

    if (!scene) return;

    const images =
      $$("img", scene);

    images.forEach(image => {
      image.setAttribute(
        "draggable",
        "false"
      );

      /*
       * Do not force a crop.
       */
      image.style.maxWidth = "100%";
      image.style.height = "auto";

      /*
       * Preserve the user's actual photo.
       */
      image.style.objectFit = "contain";

      /*
       * If image failed, don't let it break layout.
       */
      if (
        image.dataset.imageSafetyBound !== "true"
      ) {
        image.dataset.imageSafetyBound = "true";

        image.addEventListener(
          "error",
          () => {
            image.classList.add(
              "image-load-failed"
            );

            console.warn(
              "[Bolu Ubi] Image could not be loaded:",
              image.src
            );
          }
        );
      }
    });
  }


  /* ============================================================
     22. SCENE 7 — TONE SHIFT
     ============================================================ */

  function enterScene7() {
    const scene =
      getScene(7);

    if (!scene) return;

    scene.classList.add(
      "tone-serious"
    );
  }


  /* ============================================================
     23. LETTER SOURCE
     ============================================================ */

  function getLetterSource(scene) {
    if (!scene) return null;

    /*
     * First priority:
     * explicitly marked source.
     */
    let source =
      $(CONFIG.selectors.letterSource, scene);

    if (source) {
      return source;
    }

    /*
     * Then hidden source blocks.
     */
    source =
      $(
        ".letter-full-text, .letter-source-text, #letter-source",
        scene
      );

    return source || null;
  }


  function getLetterTarget(scene) {
    if (!scene) return null;

    return $(
      CONFIG.selectors.letterTarget,
      scene
    ) || $(
      ".letter-body, .letter-copy, .message-body",
      scene
    );
  }


  function extractLetterText(scene) {
    const source =
      getLetterSource(scene);

    if (source) {
      return source.textContent.trim();
    }

    const target =
      getLetterTarget(scene);

    if (
      target &&
      target.dataset.originalText
    ) {
      return target.dataset.originalText;
    }

    if (target) {
      return target.textContent.trim();
    }

    return "";
  }


  /* ============================================================
     24. NATURAL TYPING ENGINE
     ============================================================ */

  function clearTypingTimers() {
    for (
      const timer of state.letter.timerIds
    ) {
      clearTimeout(timer);
    }

    state.letter.timerIds = [];
  }


  function stopTyping() {
    clearTypingTimers();

    state.letter.running = false;

    if (
      state.letter.abortController
    ) {
      try {
        state.letter.abortController.abort();
      } catch {
        // Ignore.
      }

      state.letter.abortController = null;
    }
  }


  function getCharacterDelay(
    character,
    previousCharacter
  ) {
    let delay =
      CONFIG.typing.baseDelay;

    /*
     * Slight natural variance.
     */
    const variance =
      Math.floor(
        Math.random() * 12
      ) - 6;

    delay += variance;

    /*
     * Punctuation creates thought pauses.
     */
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
        CONFIG.typing.sentencePause;
    }

    if (
      character === "…" ||
      character === "😭" ||
      character === "🥺"
    ) {
      delay +=
        CONFIG.typing.emotionalPause;
    }

    /*
     * Paragraph / line breaks.
     */
    if (character === "\n") {
      delay +=
        CONFIG.typing.paragraphPause;
    }

    /*
     * Slight hesitation after long words.
     */
    if (
      previousCharacter &&
      /\S/.test(previousCharacter) &&
      character === " "
    ) {
      delay += 4;
    }

    return clamp(
      delay,
      7,
      1200
    );
  }


  function prepareLetterTarget(target) {
    if (!target) return;

    if (
      !target.dataset.originalText
    ) {
      target.dataset.originalText =
        target.textContent.trim();
    }

    target.setAttribute(
      "aria-live",
      "polite"
    );

    target.classList.add(
      "typing-active"
    );
  }


  async function typeLetter(
    scene,
    options = {}
  ) {
    const {
      force = false
    } = options;

    if (!scene) return;

    const target =
      getLetterTarget(scene);

    if (!target) {
      return;
    }

    if (
      state.letter.running
    ) {
      return;
    }

    if (
      state.letter.completed &&
      !force
    ) {
      return;
    }

    const sourceText =
      extractLetterText(scene);

    if (!sourceText) {
      return;
    }

    stopTyping();

    state.letter.running = true;
    state.letter.completed = false;

    state.letter.abortController =
      new AbortController();

    prepareLetterTarget(target);

    /*
     * Save original text.
     */
    target.dataset.originalText =
      sourceText;

    /*
     * If reduced motion:
     * show everything immediately.
     */
    if (state.reducedMotion) {
      target.textContent =
        sourceText;

      state.letter.running = false;
      state.letter.completed = true;

      target.classList.remove(
        "typing-active"
      );

      target.classList.add(
        "typing-complete"
      );

      return;
    }

    /*
     * Build progressively.
     */
    target.textContent = "";

    let index = 0;

    while (
      index < sourceText.length
    ) {
      if (
        state.currentScene !== 8
      ) {
        break;
      }

      const character =
        sourceText[index];

      const previous =
        index > 0
          ? sourceText[index - 1]
          : "";

      target.textContent += character;

      const delay =
        getCharacterDelay(
          character,
          previous
        );

      await sleep(delay);

      index++;
    }

    /*
     * If scene changed during typing,
     * don't mark it as complete.
     */
    if (
      state.currentScene !== 8
    ) {
      state.letter.running = false;
      return;
    }

    /*
     * Guarantee exact final content.
     */
    target.textContent =
      sourceText;

    state.letter.running = false;
    state.letter.completed = true;

    target.classList.remove(
      "typing-active"
    );

    target.classList.add(
      "typing-complete"
    );
  }


  async function enterScene8() {
    const scene =
      getScene(8);

    if (!scene) return;

    /*
     * Important:
     * We do not reset the letter if Tata goes
     * back to Scene 8 after already reading it.
     *
     * This prevents the site from becoming annoying.
     */
    if (
      state.letter.completed
    ) {
      return;
    }

    /*
     * Small intro line can fade before the typing starts.
     */
    scene.classList.add(
      "letter-scene-ready"
    );

    await sleep(
      state.reducedMotion
        ? 0
        : 380
    );

    await typeLetter(scene);
  }


  /* ============================================================
     25. SCENE 9 — QUIET MOMENT
     ============================================================ */

  function enterScene9() {
    const scene =
      getScene(9);

    if (!scene) return;

    /*
     * Scene 9 is intentionally quiet.
     */
    scene.classList.add(
      "quiet-scene"
    );

    /*
     * Safety:
     * music1 should not continue here.
     *
     * We do not wait for the stop here because
     * the actual fade belongs to 9 → 10.
     */
    if (
      state.audio.music1 &&
      !state.audio.music1.paused
    ) {
      stopTrack(
        "music1",
        true
      );
    }
  }


  /* ============================================================
     26. SCENE 10 — CLIMAX / EPILOGUE
     ============================================================ */

  function enterScene10() {
    const scene =
      getScene(10);

    if (!scene) return;

    scene.classList.add(
      "climax-scene"
    );

    /*
     * Stagger stickers if they exist.
     */
    const stickers =
      $$(
        [
          "[data-sticker]",
          ".sticker",
          ".stiker"
        ].join(","),
        scene
      );

    stickers.forEach(
      (sticker, index) => {
        sticker.style.setProperty(
          "--sticker-index",
          index
        );
      }
    );

    /*
     * Optional epilogue interaction.
     */
    initializeEpilogue(scene);
  }


  function initializeEpilogue(scene) {
    if (!scene) return;

    const buttons =
      $$(
        [
          "[data-epilogue]",
          ".epilogue-trigger",
          ".climax-trigger"
        ].join(","),
        scene
      );

    buttons.forEach(button => {
      if (
        button.dataset.epilogueBound === "true"
      ) {
        return;
      }

      button.dataset.epilogueBound = "true";

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          const targetSelector =
            button.getAttribute(
              "data-epilogue"
            );

          let target = null;

          if (targetSelector) {
            try {
              target =
                scene.querySelector(
                  targetSelector
                );
            } catch {
              target = null;
            }

            if (!target) {
              target =
                document.getElementById(
                  targetSelector.replace(/^#/, "")
                );
            }
          }

          if (!target) {
            target =
              button.parentElement?.querySelector(
                ".epilogue-content, .epilogue-text, .after-content"
              );
          }

          if (!target) return;

          target.classList.add(
            "is-revealed"
          );

          target.setAttribute(
            "aria-hidden",
            "false"
          );

          button.classList.add(
            "is-open"
          );

          button.setAttribute(
            "aria-expanded",
            "true"
          );
        }
      );
    });
  }


  /* ============================================================
     27. SCENE ENTER HOOKS
     ============================================================ */

  async function runSceneEnterHook(
    sceneNumber,
    previousScene
  ) {
    switch (sceneNumber) {
      case 1:
        enterScene1();
        break;

      case 2:
        await enterScene2();
        break;

      case 3:
        enterScene3();
        break;

      case 4:
        initializeRevealSystem(4);
        break;

      case 5:
        initializeHydroponics();
        break;

      case 6:
        preparePhoto(6);
        break;

      case 7:
        enterScene7();
        break;

      case 8:
        await enterScene8();
        break;

      case 9:
        enterScene9();
        break;

      case 10:
        enterScene10();
        break;

      default:
        break;
    }

    /*
     * General scene reveal hook.
     */
    const scene =
      getScene(sceneNumber);

    if (scene) {
      scene.classList.add(
        "scene-ready"
      );
    }
  }


  function enterScene1() {
    const scene =
      getScene(1);

    if (!scene) return;

    scene.classList.add(
      "entrance-scene"
    );
  }


  /* ============================================================
     28. KEYBOARD NAVIGATION
     ============================================================ */

  function bindKeyboardNavigation() {
    document.addEventListener(
      "keydown",
      event => {
        /*
         * Do not interfere with typing/input.
         */
        const target =
          event.target;

        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target?.isContentEditable
        ) {
          return;
        }

        /*
         * Escape:
         * only stops active transition animation,
         * it does NOT change scene.
         */
        if (
          event.key === "Escape"
        ) {
          return;
        }

        /*
         * ArrowRight / PageDown:
         * optional desktop convenience.
         *
         * Still follows scene navigation logic,
         * not scroll-based navigation.
         */
        if (
          event.key === "ArrowRight" ||
          event.key === "PageDown"
        ) {
          const current =
            state.currentScene;

          const next =
            current + 1;

          const scene =
            getScene(current);

          if (!scene) return;

          const candidates =
            $$(
              "button, a, [role='button']",
              scene
            ).filter(
              candidate =>
                isNavigationCandidate(
                  candidate,
                  current
                )
            );

          if (
            candidates.length > 0
          ) {
            event.preventDefault();

            const button =
              candidates[candidates.length - 1];

            const targetScene =
              resolveNavigationTarget(
                button
              ) || next;

            if (
              getScene(targetScene)
            ) {
              goToScene(
                targetScene
              );
            }
          }
        }

        if (
          event.key === "ArrowLeft" ||
          event.key === "PageUp"
        ) {
          const current =
            state.currentScene;

          const previous =
            current - 1;

          if (
            previous >= 1 &&
            getScene(previous)
          ) {
            event.preventDefault();

            goToScene(
              previous
            );
          }
        }
      }
    );
  }


  /* ============================================================
     29. TOUCH SAFETY
     ============================================================ */

  function bindTouchSafety() {
    document.addEventListener(
      "touchstart",
      event => {
        if (!event.touches?.length) {
          return;
        }

        const touch =
          event.touches[0];

        state.touch.startX =
          touch.clientX;

        state.touch.startY =
          touch.clientY;

        state.touch.moved = false;
      },
      {
        passive: true
      }
    );


    document.addEventListener(
      "touchmove",
      event => {
        if (!event.touches?.length) {
          return;
        }

        const touch =
          event.touches[0];

        const dx =
          Math.abs(
            touch.clientX -
            state.touch.startX
          );

        const dy =
          Math.abs(
            touch.clientY -
            state.touch.startY
          );

        if (
          dx > 12 ||
          dy > 12
        ) {
          state.touch.moved = true;
        }
      },
      {
        passive: true
      }
    );


    /*
     * IMPORTANT:
     *
     * We deliberately DO NOT navigate scenes
     * from swipe / wheel / scroll.
     *
     * This is what allows Scene 8 to be freely scrolled.
     */
  }


  /* ============================================================
     30. WHEEL SAFETY
     * ------------------------------------------------------------
     * No scene navigation here.
     * Scroll remains scroll.
     ============================================================ */

  function bindScrollSafety() {
    /*
     * We intentionally leave wheel/touch scrolling alone.
     *
     * Previous architecture risk:
     * scroll accidentally becoming scene navigation.
     *
     * Current architecture:
     * click/tap = scene navigation
     * scroll = reading
     */
  }


  /* ============================================================
     31. BUTTON MICRO-INTERACTIONS
     ============================================================ */

  function initializeButtonMicroInteractions() {
    const buttons =
      $$(
        "button, [role='button'], .button"
      );

    buttons.forEach(button => {
      if (
        button.dataset.microInteractionBound === "true"
      ) {
        return;
      }

      button.dataset.microInteractionBound = "true";

      button.addEventListener(
        "pointerdown",
        () => {
          button.classList.add(
            "is-pressed"
          );
        },
        {
          passive: true
        }
      );

      const release =
        () => {
          button.classList.remove(
            "is-pressed"
          );
        };

      button.addEventListener(
        "pointerup",
        release,
        {
          passive: true
        }
      );

      button.addEventListener(
        "pointercancel",
        release,
        {
          passive: true
        }
      );

      button.addEventListener(
        "pointerleave",
        release,
        {
          passive: true
        }
      );
    });
  }


  /* ============================================================
     32. IMAGE SAFETY
     ============================================================ */

  function initializeImages() {
    const images =
      $$("img");

    images.forEach(image => {
      image.setAttribute(
        "draggable",
        "false"
      );

      image.addEventListener(
        "contextmenu",
        event => {
          /*
           * We do not completely block context menu.
           * This is primarily a mobile/drag safety measure.
           */
        },
        {
          passive: true
        }
      );
    });
  }


  /* ============================================================
     33. PROGRESS INDICATORS
     ============================================================ */

  function updateProgressIndicators() {
    const indicators =
      $$(
        [
          "[data-scene-progress]",
          ".scene-progress",
          ".progress-dot"
        ].join(",")
      );

    indicators.forEach(
      indicator => {
        const target =
          normalizeSceneTarget(
            indicator.getAttribute(
              "data-scene-progress"
            ) ||
            indicator.getAttribute(
              "data-scene"
            )
          );

        if (!target) return;

        const active =
          target === state.currentScene;

        indicator.classList.toggle(
          "is-active",
          active
        );

        indicator.setAttribute(
          "aria-current",
          active
            ? "step"
            : "false"
        );
      }
    );
  }


  /* ============================================================
     34. REDUCED MOTION
     ============================================================ */

  function initializeMotionPreference() {
    const media =
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      );

    if (!media) {
      state.reducedMotion = false;
      return;
    }

    state.reducedMotion =
      media.matches;

    const update =
      event => {
        state.reducedMotion =
          event.matches;
      };

    try {
      media.addEventListener(
        "change",
        update
      );
    } catch {
      try {
        media.addListener(update);
      } catch {
        // Ignore.
      }
    }
  }


  /* ============================================================
     35. VIEWPORT SAFETY
     ============================================================ */

  function updateViewportHeight() {
    const height =
      window.visualViewport?.height ||
      window.innerHeight;

    document.documentElement.style.setProperty(
      "--app-height",
      `${height}px`
    );
  }


  function initializeViewport() {
    updateViewportHeight();

    window.addEventListener(
      "resize",
      updateViewportHeight,
      {
        passive: true
      }
    );

    if (
      window.visualViewport
    ) {
      window.visualViewport.addEventListener(
        "resize",
        updateViewportHeight,
        {
          passive: true
        }
      );
    }
  }


  /* ============================================================
     36. VISIBILITY CHANGE / TAB SAFETY
     ============================================================ */

  function bindVisibilitySafety() {
    document.addEventListener(
      "visibilitychange",
      () => {
        /*
         * Do not restart music automatically when
         * returning to the tab.
         *
         * Browser/user interaction should remain
         * in control.
         */
        if (
          document.hidden
        ) {
          return;
        }
      }
    );
  }


  /* ============================================================
     37. DEBUG HELPERS
     ============================================================ */

  function exposeDebugAPI() {
    /*
     * Development helper.
     *
     * It does not alter the experience.
     */
    window.BoluUbi = {
      state,

      goToScene,

      getScene,

      resolveNavigationTarget,

      getCurrentScene: () =>
        state.currentScene,

      next: () =>
        goToScene(
          state.currentScene + 1
        ),

      previous: () =>
        goToScene(
          state.currentScene - 1
        ),

      stopMusic: async () => {
        await stopTrack(
          "music1",
          true
        );

        await stopTrack(
          "music2",
          true
        );
      }
    };
  }


  /* ============================================================
     38. FAILSAFE
     ============================================================ */

  function installGlobalErrorSafety() {
    window.addEventListener(
      "error",
      event => {
        /*
         * We log the error but DO NOT replace the website
         * with an error screen.
         */
        console.error(
          "[Bolu Ubi] Runtime error:",
          event.error || event.message
        );
      }
    );

    window.addEventListener(
      "unhandledrejection",
      event => {
        console.error(
          "[Bolu Ubi] Unhandled promise rejection:",
          event.reason
        );
      }
    );
  }


  /* ============================================================
     39. INITIAL SCENE
     ============================================================ */

  function determineInitialScene() {
    /*
     * Prefer explicit data.
     */
    const explicit =
      document.body.getAttribute(
        "data-start-scene"
      );

    const explicitNumber =
      normalizeSceneTarget(
        explicit
      );

    if (
      explicitNumber &&
      getScene(explicitNumber)
    ) {
      return explicitNumber;
    }

    /*
     * Otherwise use Scene 1.
     */
    if (
      getScene(1)
    ) {
      return 1;
    }

    /*
     * Last resort:
     * first discovered scene.
     */
    if (
      state.scenes.length
    ) {
      return state.scenes[0].number;
    }

    return 1;
  }


  function applyInitialScene() {
    state.currentScene =
      determineInitialScene();

    prepareScenes();

    const initial =
      getScene(
        state.currentScene
      );

    if (initial) {
      initial.classList.add(
        CONFIG.activeClass,
        "scene-ready"
      );

      initial.setAttribute(
        "aria-hidden",
        "false"
      );

      resetSceneScroll(
        initial
      );
    }

    updateDocumentTitle(
      state.currentScene
    );

    updateProgressIndicators();
  }


  /* ============================================================
     40. INITIALIZE
     ============================================================ */

  async function initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    /*
     * Motion preference first.
     */
    initializeMotionPreference();

    /*
     * Discover scenes.
     */
    discoverScenes();

    if (
      state.scenes.length === 0
    ) {
      console.warn(
        "[Bolu Ubi] No scenes were found. " +
        "Expected .scene, [data-scene], or scene-* elements."
      );

      return;
    }

    /*
     * Prepare initial scene.
     */
    applyInitialScene();

    /*
     * Audio objects are prepared but NEVER played here.
     */
    initializeAudio();

    /*
     * Navigation.
     */
    bindNavigationSystem();

    /*
     * Keyboard convenience.
     */
    bindKeyboardNavigation();

    /*
     * Touch safety.
     */
    bindTouchSafety();

    /*
     * Wheel intentionally does nothing.
     */
    bindScrollSafety();

    /*
     * UI micro interactions.
     */
    initializeButtonMicroInteractions();

    /*
     * Images.
     */
    initializeImages();

    /*
     * Viewport.
     */
    initializeViewport();

    /*
     * Visibility.
     */
    bindVisibilitySafety();

    /*
     * Runtime error safety.
     */
    installGlobalErrorSafety();

    /*
     * Debug API.
     */
    exposeDebugAPI();

    /*
     * Scene-specific initialization that should exist
     * even before navigation.
     */
    initializeRevealSystem(4);
    initializeHydroponics();
    preparePhoto(6);

    /*
     * Small final delay lets the browser paint the
     * first scene before any optional work begins.
     */
    await sleep(
      state.reducedMotion
        ? 0
        : 50
    );

    console.info(
      "[Bolu Ubi] Story engine initialized.",
      {
        scenes:
          state.scenes.map(
            scene => scene.number
          ),
        initialScene:
          state.currentScene
      }
    );
  }


  /* ============================================================
     41. DOM READY
     ============================================================ */

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