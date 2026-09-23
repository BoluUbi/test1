/* ============================================================
   BOLU UBI 🐣
   ============================================================
   script.js
   ------------------------------------------------------------
   Responsibilities:
   - Scene navigation
   - Emotional pacing
   - Music state machine
   - Typing engine
   - Interactive reveals
   - Hydroponics side quest
   - Proposal climax
   - Accessibility
   - Responsive-safe behavior
   - Scroll/swipe protection
   - Micro interactions
   - Epilogue / afterglow
   ============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     01. CONFIGURATION
     ========================================================== */

  const CONFIG = {
    totalScenes: 10,

    selectors: {
      site: [
        ".site",
        "#site",
        "main",
        "body"
      ],

      scenes: [
        ".scene",
        "[data-scene]"
      ],

      sceneButtons: [
        "[data-next]",
        "[data-prev]",
        "[data-go]",
        "[data-scene-target]",
        ".scene-next",
        ".scene-prev",
        ".next-btn",
        ".prev-btn",
        ".continue-btn",
        ".transition-btn",
        "button[data-target]"
      ],

      typingTargets: [
        "[data-typing]",
        ".typing-text",
        ".letter-text",
        "#letterText",
        "#typingText"
      ],

      revealButtons: [
        "[data-reveal]",
        ".trait-toggle",
        ".plus-btn",
        ".reveal-btn",
        ".memory-toggle"
      ],

      hydroponicsButtons: [
        "[data-hydroponics]",
        ".hydroponics-card",
        ".hydro-card",
        "#hydroponicsCard"
      ],

      closeButtons: [
        "[data-close]",
        ".modal-close",
        ".close-modal",
        ".close-btn"
      ],

      proposalButtons: [
        "[data-proposal]",
        "[data-proposal-answer]",
        ".proposal-btn"
      ]
    },

    audio: {
      music1: "music1.mp3",
      music2: "music2.mp3",

      music1Volume: 0.46,
      music2Volume: 0.54,

      fadeIn: 1500,
      fadeOut: 1300,

      silenceBeforeMusic2: 850
    },

    typing: {
      minDelay: 17,
      maxDelay: 46,

      punctuationPause: {
        comma: 90,
        period: 210,
        question: 240,
        exclamation: 240,
        colon: 120,
        newline: 250
      },

      startDelay: 650
    },

    animation: {
      sceneEnter: 850,
      revealStagger: 85
    },

    storageKey: "bolu-ubi-progress"
  };


  /* ==========================================================
     02. DOM HELPERS
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

    selectors.forEach((selector) => {
      $$(selector, root).forEach((element) => {
        if (!result.includes(element)) {
          result.push(element);
        }
      });
    });

    return result;
  };

  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };

  const sleep = (ms) => {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  };

  const isReducedMotion = () => {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };


  /* ==========================================================
     03. APPLICATION STATE
     ========================================================== */

  const state = {
    initialized: false,

    currentScene: 1,
    previousScene: null,

    isTransitioning: false,

    hasStarted: false,

    music1Started: false,
    music2Started: false,

    music1Fading: false,
    music2Fading: false,

    typingStarted: false,
    typingFinished: false,

    hydroponicsOpen: false,

    proposalAnswered: false,

    lastInteractionAt: 0,

    touchStartX: 0,
    touchStartY: 0,

    sceneHistory: [],

    audioUnlocked: false,

    introButtonUsed: false,

    isPageVisible: true
  };


  /* ==========================================================
     04. DOM REFERENCES
     ========================================================== */

  let site = null;
  let scenes = [];

  let music1 = null;
  let music2 = null;

  let activeTypingController = null;

  let hydroponicsModal = null;

  let progressIndicator = null;


  /* ==========================================================
     05. EXACT BIRTHDAY LETTER
     ==========================================================
     The HTML remains the primary source if it already contains
     the letter.

     This fallback exists so the website does not become blank
     if the typing target is empty or missing its text.
     ========================================================== */

  const FULL_BIRTHDAY_LETTER = `aalooo bolu ubii, umm mungkin aku seharusnya skrng manggil kamu nenek talita kali yak. bhaap walaupun cuman beda 1 tahun doang sihh. hehee

aku harap aku yg jadi orang pertama yg ngucapin kamu, walaupun sebatas text sii. karna kita sekarang kepisah jarak, alhasil keduluan ur mom atau ga ur bapack yang ngucapin secara langsung. tapi ndak apa, it's okay. (ini aja malah pas ganti tanggal sung aku kirim yg di wa😭, 00.00)

umm, jujur banyak sebenernya yg pengen disampein, malah saking banyak ga tau harus mulai dari mana dan kayak gimana kata²nya. Asiikkk. Ini aku typingnya biasa aja kali yak😭, agak romantis sikit dah kali yee. bhapp. Soalnya tuh kalo kata²nya serius banget takutnya nanti kamu nangis. huhuhuuu. terharu. ntar kalo kamu nangis kan ga ada aku di samping yang ngusapin air matanya🥺. ehh aku elapin dari jauh ajaa deh. cupcupcup... aku elap pake kanebo 🫶🏻🫰🏻

nah tuh kann, ga kerasa aku ngetik intronya aja dah sepanjang ini. uda ngalahin kata pengantar di fisika erlangga inimah wok😭. Dah ahh, serius dulu nih ngucapin nya. asiikkk

umm

HABEDEEE TALITAAA, aku di sini ga pake kata² template tahunan yg mungkin uda sering kamu dengar sebelumnya. Biar lebih spesial dan beda gitu sii, ada unique selling pointnya gitu lahh. Asikk.

Soo, my biggest wish is to keep seeing you smile, not just today, but for all the years to come. I want to be the one who stands by you through life's brightest days and darkest nights, standing proud of your triumphs, being the anchor you lean on during the roughest seas, and keeping you safe when the ground shakes. (harapan terbesarku adalah untuk terus ngeliat kamu tersenyum, ga cuma hari ini, tapi untuk bertahun-tahun ke depan. ku ingin jadi orang yang berdiri di sampingmu ngelewatin hari² tercerah dan malam² tergelap sekalipun dalam hidup km, berdiri bangga atas pencapaianmu, jd jangkar tempat kamu bersandar saat lautan paling berombak, dan ngejaga kamu tetap aman saat dunia kamu lagi ga baik² aja).

dan seperti biasa, semoga apa yg km harapkan dpt tercapai di usia ini, berbagai harapan, wishlist, pencapaian, dan apapun itu. dan tentunya semakin diperlancar dan dipermudah jalannya. dan yg pasti sehat² yaap, semoga di usia ini bisa jadi pribadi yg lebih baik lg, lebih dewasa, ceria, dan jadi diri sendiri. bisa terus berprogress bareng. Saling support, saling ngingetin jugak

Semoga km tetap jd km yg ceria, bertanggung jawab, dewasa, random, kadang ngambek, kadang plenger😭

semoga km terus bertumbuh jd seseorang yang lebih baik, tanpa harus kehilangan sisi dirimu yang sekarang.

oiyak satu lagi, makin lancar jg dah rezekinya. rejeki ga cuma duit ajaa loh yaak. wkwk

umm, dah kabisan kata² aku wok😭. intinya semua do'a yg baik² turut nyertain km. btw kado ultahnya nanti pas kita di kopken yaaps. mwehehee

Dan kalau suatu hari nanti kamu lagi capek, lagi sedih, atau dunia rasanya lagi nggak terlalu baik sama kamu...

I hope you remember that you don't always have to face everything alone.

Karena, setidaknya untuk sekarang,

aku masih di sini.

sebagai penutup,

makan seblak pake nasi

habedee bolu ubiii🤍

~ Tongzi🤾‍♂️`;


  /* ==========================================================
     06. PROPOSAL CONTENT
     ========================================================== */

  const PROPOSAL_COPY = {
    eyebrow: "one last thing...",

    opening:
      "Kalau dipikir-pikir lagi, lucu juga ya.",

    journey:
      "Dulu kamu yang lebih dulu berani ngomong.",

    response:
      "Dan waktu itu aku belum memilih untuk menjadikan kita sesuatu yang resmi.",

    reason:
      "Bukan karena aku nggak menghargai perasaanmu. Justru karena aku ingin waktu untuk benar-benar mengenal kamu, belajar memahami kamu, dan belajar apakah aku bisa berdiri di sampingmu dengan sungguh-sungguh.",

    realization:
      "Ternyata selama waktu itu berjalan, kita malah tumbuh semakin dekat.",

    hts:
      "Kita ngobrol. Kita belajar. Kita beradaptasi. Kita saling support. Kadang random. Kadang ngambek. Kadang plenger. Hehee.",

    callback:
      "Dan mungkin selama ini pertanyaan tentang \"kapan?\" memang belum punya jawaban.",

    turn:
      "Jadi kali ini...",

    ownership:
      "biar aku yang bertanya.",

    question:
      "Talita, mau nggak kamu jadi pacarku?",

    smallNote:
      "Bukan karena semuanya tiba-tiba dimulai hari ini.",
    
    finalNote:
      "Tapi karena sesuatu yang sudah tumbuh di antara kita akhirnya ingin aku beri nama."
  };


  /* ==========================================================
     07. INITIALIZATION
     ========================================================== */

  function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    site = firstExisting(CONFIG.selectors.site);

    collectScenes();
    setupAudio();
    setupNavigation();
    setupRevealInteractions();
    setupHydroponics();
    setupTyping();
    setupProposal();
    setupTouchProtection();
    setupKeyboardNavigation();
    setupVisibilityHandling();
    setupCursorEffects();
    setupProgressIndicator();
    setupInitialScene();
    setupSafetyFallbacks();

    document.documentElement.classList.add("js-ready");
    document.body.classList.add("website-ready");

    window.setTimeout(() => {
      document.body.classList.add("website-loaded");
    }, 80);
  }


  /* ==========================================================
     08. SCENE COLLECTION
     ========================================================== */

  function collectScenes() {
    scenes = allExisting(CONFIG.selectors.scenes);

    /*
     * If .scene elements exist without data-scene, assign
     * numerical scene identifiers based on DOM order.
     */

    scenes.forEach((scene, index) => {
      const number = index + 1;

      if (!scene.dataset.scene) {
        scene.dataset.scene = String(number);
      }

      if (!scene.id) {
        scene.id = `scene-${String(number).padStart(2, "0")}`;
      }

      scene.setAttribute("aria-hidden", number === 1 ? "false" : "true");
    });

    /*
     * Fallback for common ID architecture:
     * #scene1, #scene2, ... #scene10
     */

    if (!scenes.length) {
      for (let i = 1; i <= CONFIG.totalScenes; i++) {
        const candidate =
          document.getElementById(`scene${i}`) ||
          document.getElementById(`scene-${i}`) ||
          document.getElementById(`scene-${String(i).padStart(2, "0")}`);

        if (candidate && !scenes.includes(candidate)) {
          scenes.push(candidate);
        }
      }
    }
  }


  /* ==========================================================
     09. INITIAL SCENE
     ========================================================== */

  function setupInitialScene() {
    if (!scenes.length) {
      return;
    }

    let initialScene = 1;

    /*
     * Never restore a later scene automatically.
     * The birthday experience should always begin from the
     * beginning when the page is freshly opened.
     */

    state.currentScene = initialScene;

    scenes.forEach((scene, index) => {
      const number = index + 1;

      scene.classList.toggle("is-active", number === initialScene);
      scene.classList.toggle("active", number === initialScene);
      scene.classList.toggle("current", number === initialScene);

      scene.setAttribute(
        "aria-hidden",
        number === initialScene ? "false" : "true"
      );

      if (number !== initialScene) {
        scene.style.setProperty("--scene-progress", "0");
      }
    });

    updateProgressIndicator();

    /*
     * Important:
     * NO music starts here.
     *
     * Browser autoplay policies require a user gesture.
     * Music 1 starts when Scene 1's "bukaa duluuu" button
     * is clicked.
     */
  }


  /* ==========================================================
     10. AUDIO ENGINE
     ========================================================== */

  function setupAudio() {
    music1 = new Audio();
    music2 = new Audio();

    music1.src = CONFIG.audio.music1;
    music2.src = CONFIG.audio.music2;

    music1.preload = "auto";
    music2.preload = "auto";

    music1.loop = true;
    music2.loop = true;

    music1.volume = 0;
    music2.volume = 0;

    music1.setAttribute("aria-hidden", "true");
    music2.setAttribute("aria-hidden", "true");

    /*
     * Avoid browser media session controls causing weird
     * playback behavior on mobile.
     */

    try {
      music1.playsInline = true;
      music2.playsInline = true;
    } catch {
      /* no-op */
    }

    /*
     * Recover gracefully from failed audio loading.
     */

    music1.addEventListener("error", () => {
      document.body.classList.add("music1-error");
    });

    music2.addEventListener("error", () => {
      document.body.classList.add("music2-error");
    });
  }


  /* ==========================================================
     11. AUDIO UTILITIES
     ========================================================== */

  function safePlay(audio) {
    if (!audio) {
      return Promise.resolve(false);
    }

    try {
      const promise = audio.play();

      if (promise && typeof promise.then === "function") {
        return promise
          .then(() => true)
          .catch(() => false);
      }

      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }


  function stopAudio(audio, reset = true) {
    if (!audio) {
      return;
    }

    try {
      audio.pause();

      if (reset) {
        audio.currentTime = 0;
      }
    } catch {
      /* no-op */
    }
  }


  function fadeAudio(audio, targetVolume, duration = 1000) {
    if (!audio) {
      return Promise.resolve();
    }

    if (isReducedMotion()) {
      audio.volume = clamp(targetVolume, 0, 1);
      return Promise.resolve();
    }

    const startVolume = audio.volume;
    const difference = targetVolume - startVolume;

    if (Math.abs(difference) < 0.001 || duration <= 0) {
      audio.volume = clamp(targetVolume, 0, 1);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startTime = performance.now();

      const tick = (now) => {
        const elapsed = now - startTime;
        const progress = clamp(elapsed / duration, 0, 1);

        /*
         * Smoothstep gives a softer emotional fade than a
         * linear volume change.
         */

        const eased =
          progress * progress * (3 - 2 * progress);

        audio.volume = clamp(
          startVolume + difference * eased,
          0,
          1
        );

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          audio.volume = clamp(targetVolume, 0, 1);
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }


  /* ==========================================================
     12. MUSIC 1
     ========================================================== */

  async function startMusic1() {
    if (!music1) {
      return;
    }

    /*
     * Never restart Music 1 unnecessarily.
     */

    if (state.music1Started && !music1.paused) {
      return;
    }

    state.audioUnlocked = true;
    state.music1Started = true;

    document.body.classList.add("music1-active");
    document.body.classList.remove("music2-active");

    music1.volume = 0;

    const played = await safePlay(music1);

    if (!played) {
      /*
       * If autoplay/user gesture somehow fails, do not
       * destroy the experience. The next user interaction
       * will try again.
       */
      state.music1Started = false;
      document.body.classList.add("audio-awaiting-gesture");
      return;
    }

    document.body.classList.remove("audio-awaiting-gesture");

    await fadeAudio(
      music1,
      CONFIG.audio.music1Volume,
      CONFIG.audio.fadeIn
    );
  }


  /* ==========================================================
     13. MUSIC 1 STOP
     ========================================================== */

  async function stopMusic1() {
    if (!music1) {
      return;
    }

    if (music1.paused && music1.volume === 0) {
      return;
    }

    state.music1Fading = true;

    await fadeAudio(
      music1,
      0,
      CONFIG.audio.fadeOut
    );

    /*
     * Critical:
     * pause + reset.
     *
     * Merely setting volume to 0 is NOT enough.
     */

    stopAudio(music1, true);

    state.music1Fading = false;

    document.body.classList.remove("music1-active");
  }


  /* ==========================================================
     14. MUSIC 2
     ========================================================== */

  async function startMusic2() {
    if (!music2) {
      return;
    }

    if (state.music2Started && !music2.paused) {
      return;
    }

    /*
     * Music 1 must be completely dead before Music 2.
     */

    await stopMusic1();

    /*
     * Emotional silence.
     */

    document.body.classList.add("between-music");

    await sleep(
      isReducedMotion()
        ? 0
        : CONFIG.audio.silenceBeforeMusic2
    );

    document.body.classList.remove("between-music");

    state.music2Started = true;
    state.audioUnlocked = true;

    document.body.classList.add("music2-active");
    document.body.classList.remove("music1-active");

    music2.volume = 0;

    const played = await safePlay(music2);

    if (!played) {
      state.music2Started = false;
      document.body.classList.add("audio-awaiting-gesture");
      return;
    }

    state.music2Fading = true;

    await fadeAudio(
      music2,
      CONFIG.audio.music2Volume,
      CONFIG.audio.fadeIn + 500
    );

    state.music2Fading = false;
  }


  /* ==========================================================
     15. NAVIGATION
     ========================================================== */

  function setupNavigation() {
    const buttons = allExisting(CONFIG.selectors.sceneButtons);

    buttons.forEach((button) => {
      if (button.dataset.jsBound === "true") {
        return;
      }

      button.dataset.jsBound = "true";

      button.addEventListener("click", async (event) => {
        event.preventDefault();

        const target = resolveButtonTarget(button);

        if (target === null) {
          return;
        }

        /*
         * If this is the first scene's opening button,
         * music1 begins from the same user gesture.
         */

        const isIntroButton =
          state.currentScene === 1 &&
          (
            button.matches(".intro-btn") ||
            button.matches("[data-intro]") ||
            /bukaa|buka dulu|open/i.test(
              button.textContent || ""
            )
          );

        if (isIntroButton) {
          state.introButtonUsed = true;
          await startMusic1();
        }

        await goToScene(target);
      });
    });

    /*
     * Additional semantic fallback:
     * buttons with data-next="true".
     */

    $$("[data-next='true']").forEach((button) => {
      if (button.dataset.jsBound === "true") {
        return;
      }

      button.dataset.jsBound = "true";

      button.addEventListener("click", async (event) => {
        event.preventDefault();

        if (state.currentScene === 1) {
          await startMusic1();
        }

        await goToScene(state.currentScene + 1);
      });
    });

    $$("[data-prev='true']").forEach((button) => {
      if (button.dataset.jsBound === "true") {
        return;
      }

      button.dataset.jsBound = "true";

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        await goToScene(state.currentScene - 1);
      });
    });
  }


  /* ==========================================================
     16. RESOLVE BUTTON TARGET
     ========================================================== */

  function resolveButtonTarget(button) {
    const data = button.dataset;

    /*
     * data-go="3"
     */

    if (data.go) {
      return parseSceneNumber(data.go);
    }

    /*
     * data-scene-target="scene-03"
     */

    if (data.sceneTarget) {
      return resolveSceneReference(data.sceneTarget);
    }

    /*
     * data-target="#scene3"
     */

    if (data.target) {
      return resolveSceneReference(data.target);
    }

    /*
     * data-next
     */

    if (
      button.hasAttribute("data-next") &&
      button.dataset.next !== "false"
    ) {
      return state.currentScene + 1;
    }

    /*
     * data-prev
     */

    if (
      button.hasAttribute("data-prev") &&
      button.dataset.prev !== "false"
    ) {
      return state.currentScene - 1;
    }

    /*
     * class-based fallback
     */

    if (
      button.matches(
        ".scene-next, .next-btn, .continue-btn, .transition-btn"
      )
    ) {
      return state.currentScene + 1;
    }

    if (
      button.matches(
        ".scene-prev, .prev-btn"
      )
    ) {
      return state.currentScene - 1;
    }

    /*
     * Text-based fallback.
     *
     * This is intentionally conservative.
     */

    const text = (
      button.textContent || ""
    ).trim().toLowerCase();

    if (
      /^(next|lanjut|lanjutkan|terus|gas|ayo|yuk|okee|oke)$/.test(text)
    ) {
      return state.currentScene + 1;
    }

    return null;
  }


  function parseSceneNumber(value) {
    const number = Number.parseInt(
      String(value).replace(/\D/g, ""),
      10
    );

    if (!Number.isFinite(number)) {
      return null;
    }

    return clamp(
      number,
      1,
      CONFIG.totalScenes
    );
  }


  function resolveSceneReference(reference) {
    if (!reference) {
      return null;
    }

    const value = String(reference).trim();

    /*
     * Direct numeric reference.
     */

    if (/^\d+$/.test(value)) {
      return parseSceneNumber(value);
    }

    /*
     * #scene3 / scene3 / scene-03
     */

    const numericMatch = value.match(
      /scene[-_ ]?0*(\d+)/i
    );

    if (numericMatch) {
      return parseSceneNumber(numericMatch[1]);
    }

    /*
     * Actual DOM lookup.
     */

    const target =
      document.querySelector(value) ||
      document.getElementById(value.replace(/^#/, ""));

    if (!target) {
      return null;
    }

    const index = scenes.indexOf(target);

    if (index >= 0) {
      return index + 1;
    }

    return null;
  }


  /* ==========================================================
     17. GO TO SCENE
     ========================================================== */

  async function goToScene(targetScene, options = {}) {
    const target = clamp(
      Number.parseInt(targetScene, 10) || 1,
      1,
      CONFIG.totalScenes
    );

    if (target === state.currentScene && !options.force) {
      return;
    }

    if (state.isTransitioning) {
      return;
    }

    const targetElement = getScene(target);

    if (!targetElement) {
      return;
    }

    state.isTransitioning = true;

    const previous = state.currentScene;

    state.previousScene = previous;

    state.sceneHistory.push(previous);

    /*
     * Keep history sane.
     */

    if (state.sceneHistory.length > 30) {
      state.sceneHistory.shift();
    }

    /*
     * Music transitions are tied to emotional scene changes,
     * not random button presses.
     */

    if (target === 1 && previous !== 1) {
      await stopMusic2();
    }

    /*
     * Scene 9 = intentional breath.
     * Music 1 ends HERE, not merely at Scene 10.
     */

    if (target === 9 && previous < 9) {
      await stopMusic1();
    }

    /*
     * Scene 10 = threshold.
     *
     * Music 1 is guaranteed stopped before music 2.
     */

    if (target === 10 && previous < 10) {
      await startMusic2();
    }

    await transitionScenes(
      previous,
      target,
      options
    );

    state.currentScene = target;

    /*
     * Scene-specific orchestration.
     */

    await handleSceneEnter(target, previous);

    updateProgressIndicator();

    saveProgress(target);

    state.isTransitioning = false;
  }


  /* ==========================================================
     18. SCENE TRANSITION
     ========================================================== */

  async function transitionScenes(
    previousNumber,
    nextNumber,
    options = {}
  ) {
    const previousScene = getScene(previousNumber);
    const nextScene = getScene(nextNumber);

    if (!nextScene) {
      return;
    }

    /*
     * Stop accidental browser focus from remaining on an
     * invisible scene button.
     */

    if (
      document.activeElement &&
      previousScene &&
      previousScene.contains(document.activeElement)
    ) {
      try {
        document.activeElement.blur();
      } catch {
        /* no-op */
      }
    }

    if (previousScene) {
      previousScene.classList.add("is-leaving");
      previousScene.classList.remove("is-active");
      previousScene.classList.remove("active");
      previousScene.classList.remove("current");
      previousScene.setAttribute("aria-hidden", "true");
    }

    nextScene.classList.add("is-entering");

    nextScene.classList.add("is-active");
    nextScene.classList.add("active");
    nextScene.classList.add("current");

    nextScene.setAttribute("aria-hidden", "false");

    /*
     * Reset internal reading position.
     *
     * This does NOT use page scrolling to change scenes.
     * Each scene owns its own reading area.
     */

    resetSceneScroll(nextScene);

    /*
     * Allow CSS to catch up before reveal.
     */

    await nextFrame();

    nextScene.classList.add("has-entered");

    /*
     * Re-trigger reveal animations inside the new scene.
     */

    revealSceneContent(nextScene);

    const duration =
      options.instant || isReducedMotion()
        ? 0
        : CONFIG.animation.sceneEnter;

    if (duration > 0) {
      await sleep(duration);
    }

    if (previousScene) {
      previousScene.classList.remove("is-leaving");
    }

    nextScene.classList.remove("is-entering");
  }


  function nextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }


  function getScene(number) {
    return scenes[number - 1] || null;
  }


  function resetSceneScroll(scene) {
    if (!scene) {
      return;
    }

    const scrollTargets = [
      scene,
      $(".scene__inner", scene),
      $(".scene-inner", scene),
      $(".scene-content", scene),
      $(".scene__content", scene)
    ].filter(Boolean);

    scrollTargets.forEach((element) => {
      try {
        element.scrollTop = 0;
      } catch {
        /* no-op */
      }
    });
  }


  /* ==========================================================
     19. SCENE ENTER LOGIC
     ========================================================== */

  async function handleSceneEnter(sceneNumber, previousScene) {
    const scene = getScene(sceneNumber);

    if (!scene) {
      return;
    }

    document.body.dataset.scene = String(sceneNumber);

    document.body.classList.forEach((className) => {
      if (className.startsWith("scene-current-")) {
        document.body.classList.remove(className);
      }
    });

    document.body.classList.add(
      `scene-current-${sceneNumber}`
    );

    /*
     * Scene 1:
     * no automatic music.
     */

    if (sceneNumber === 1) {
      document.body.classList.remove(
        "birthday-journey-started"
      );
    }

    /*
     * Scene 2:
     * Music 1 should already be playing if the intro button
     * was used. If not, do not violate autoplay restrictions.
     */

    if (sceneNumber === 2) {
      document.body.classList.add(
        "birthday-journey-started"
      );

      if (!state.music1Started) {
        document.body.classList.add(
          "music-awaiting-intro"
        );
      }

      pulseSpecialElements(scene);
    }

    /*
     * Scene 3:
     * Flashback / timeline.
     */

    if (sceneNumber === 3) {
      animateTimeline(scene);
    }

    /*
     * Scene 4:
     * Traits reveal.
     */

    if (sceneNumber === 4) {
      prepareTraitScene(scene);
    }

    /*
     * Scene 5:
     * Side quest.
     */

    if (sceneNumber === 5) {
      prepareSideQuest(scene);
    }

    /*
     * Scene 6:
     * Portrait / emotional quiet.
     */

    if (sceneNumber === 6) {
      preparePortraitScene(scene);
    }

    /*
     * Scene 7:
     * Tone transition.
     */

    if (sceneNumber === 7) {
      prepareSeriousTransition(scene);
    }

    /*
     * Scene 8:
     * Birthday letter typing.
     */

    if (sceneNumber === 8) {
      await prepareBirthdayLetter(scene);
    }

    /*
     * Scene 9:
     * Quietest moment.
     */

    if (sceneNumber === 9) {
      prepareQuietScene(scene);
    }

    /*
     * Scene 10:
     * Proposal climax.
     */

    if (sceneNumber === 10) {
      prepareProposalScene(scene, previousScene);
    }
  }


  /* ==========================================================
     20. GENERIC SCENE REVEALS
     ========================================================== */

  function revealSceneContent(scene) {
    if (!scene) {
      return;
    }

    const elements = $$(
      [
        "[data-reveal-on-enter]",
        ".reveal",
        ".fade-up",
        ".stagger-item",
        ".timeline-item",
        ".trait-card",
        ".memory-card"
      ].join(","),
      scene
    );

    elements.forEach((element, index) => {
      element.style.setProperty(
        "--reveal-delay",
        `${index * CONFIG.animation.revealStagger}ms`
      );

      element.classList.add("js-reveal-ready");
    });

    /*
     * A second pass prevents some CSS transition engines from
     * getting stuck if a scene was revisited.
     */

    window.setTimeout(() => {
      elements.forEach((element) => {
        element.classList.add("js-revealed");
      });
    }, isReducedMotion() ? 0 : 60);
  }


  /* ==========================================================
     21. SCENE 2 — PLAYFUL BIRTHDAY
     ========================================================== */

  function pulseSpecialElements(scene) {
    const special = $$(
      [
        ".birthday-age",
        ".age-number",
        ".scene-title",
        ".math-equation",
        ".math-block",
        "[data-age]"
      ].join(","),
      scene
    );

    special.forEach((element, index) => {
      element.style.setProperty(
        "--pulse-delay",
        `${index * 110}ms`
      );

      element.classList.add("birthday-reveal");
    });
  }


  /* ==========================================================
     22. SCENE 3 — TIMELINE
     ========================================================== */

  function animateTimeline(scene) {
    const items = $$(
      [
        ".timeline-item",
        ".timeline__item",
        "[data-timeline]",
        ".flashback-card"
      ].join(","),
      scene
    );

    items.forEach((item, index) => {
      item.style.setProperty(
        "--timeline-delay",
        `${index * 180}ms`
      );

      item.classList.add("timeline-ready");
    });
  }


  /* ==========================================================
     23. SCENE 4 — TRAITS
     ========================================================== */

  function prepareTraitScene(scene) {
    const buttons = allExisting(
      CONFIG.selectors.revealButtons,
      scene
    );

    buttons.forEach((button) => {
      button.classList.add("reveal-interactive");

      if (!button.hasAttribute("aria-expanded")) {
        button.setAttribute("aria-expanded", "false");
      }
    });
  }


  /* ==========================================================
     24. SCENE 5 — SIDE QUEST
     ========================================================== */

  function prepareSideQuest(scene) {
    /*
     * Ensure Tongzi signature remains visible to assistive
     * technology and CSS.
     */

    const signatures = $$(
      ".tongzi, .signature, [data-tongzi]",
      scene
    );

    signatures.forEach((signature) => {
      signature.classList.add("tongzi-visible");
    });

    /*
     * Hydroponics cards become clearly interactive.
     */

    const cards = allExisting(
      CONFIG.selectors.hydroponicsButtons,
      scene
    );

    cards.forEach((card) => {
      card.classList.add("side-quest-ready");

      if (
        card.tagName === "BUTTON" ||
        card.getAttribute("role") === "button"
      ) {
        card.setAttribute("aria-expanded", "false");
      }
    });
  }


  /* ==========================================================
     25. SCENE 6 — PORTRAIT
     ========================================================== */

  function preparePortraitScene(scene) {
    const photo =
      firstExisting(
        [
          ".portrait-photo",
          ".photo-frame img",
          ".photo-card img",
          "[data-portrait]",
          ".bolu-photo"
        ],
        scene
      );

    if (photo) {
      photo.classList.add("portrait-prepared");

      /*
       * Avoid broken image layout.
       */

      photo.addEventListener("load", () => {
        photo.classList.add("portrait-loaded");
      }, { once: true });
    }

    const favorite = firstExisting(
      [
        ".favorite-one",
        "[data-favorite]",
        ".my-favorite-one"
      ],
      scene
    );

    if (favorite) {
      favorite.classList.add("favorite-ready");
    }
  }


  /* ==========================================================
     26. SCENE 7 — SERIOUS TRANSITION
     ========================================================== */

  function prepareSeriousTransition(scene) {
    document.body.classList.add("entering-serious");

    const lead = firstExisting(
      [
        ".serious-lead",
        ".transition-lead",
        "[data-serious-lead]"
      ],
      scene
    );

    if (lead) {
      lead.classList.add("serious-lead-visible");
    }

    /*
     * Slightly delay the scene's atmosphere class so the
     * emotional transition feels gradual.
     */

    window.setTimeout(() => {
      document.body.classList.add("serious-mode");
    }, isReducedMotion() ? 0 : 500);
  }


  /* ==========================================================
     27. SCENE 8 — TYPING ENGINE SETUP
     ========================================================== */

  function setupTyping() {
    const targets = allExisting(
      CONFIG.selectors.typingTargets
    );

    targets.forEach((target) => {
      if (target.dataset.typingPrepared === "true") {
        return;
      }

      target.dataset.typingPrepared = "true";

      /*
       * Preserve existing HTML content as the primary source.
       * If data-typing-text exists, use that.
       */

      if (!target.dataset.originalText) {
        const supplied =
          target.dataset.typingText ||
          target.textContent ||
          "";

        target.dataset.originalText = supplied.trim();
      }
    });
  }


  async function prepareBirthdayLetter(scene) {
    if (state.typingStarted) {
      return;
    }

    state.typingStarted = true;

    document.body.classList.add("typing-scene");

    /*
     * Exact intro line requested for Scene 8.
     */

    const intro = firstExisting(
      [
        ".typing-intro",
        ".letter-intro",
        "[data-letter-intro]"
      ],
      scene
    );

    if (intro) {
      intro.classList.add("letter-intro-visible");
    }

    const target = firstExisting(
      CONFIG.selectors.typingTargets,
      scene
    );

    if (!target) {
      state.typingFinished = true;
      return;
    }

    /*
     * HTML content is preferred.
     * If empty, fallback to the exact birthday letter.
     */

    let text =
      target.dataset.originalText ||
      target.dataset.typingText ||
      target.textContent ||
      "";

    text = text.trim();

    if (!text || text.length < 10) {
      text = FULL_BIRTHDAY_LETTER;
    }

    /*
     * Keep an untouched source.
     */

    target.dataset.letterSource = text;

    /*
     * Don't type if it is already completed.
     */

    if (target.dataset.typingComplete === "true") {
      state.typingFinished = true;
      return;
    }

    /*
     * Hide original content before typing.
     */

    target.classList.add("typing-active");
    target.classList.remove("typing-complete");

    await sleep(
      isReducedMotion()
        ? 0
        : CONFIG.typing.startDelay
    );

    activeTypingController = createTypingController(
      target,
      text
    );

    await activeTypingController.start();

    state.typingFinished = true;

    target.dataset.typingComplete = "true";

    target.classList.remove("typing-active");
    target.classList.add("typing-complete");

    document.body.classList.add("typing-finished");

    /*
     * Give the next button a subtle "now you can continue"
     * state after the letter has actually been read.
     */

    enablePostTypingControls(scene);
  }


  /* ==========================================================
     28. TYPING CONTROLLER
     * ========================================================== */

  function createTypingController(target, text) {
    let cancelled = false;
    let skipRequested = false;

    const controller = {
      cancel() {
        cancelled = true;
      },

      skip() {
        skipRequested = true;
      },

      async start() {
        /*
         * Create a safe text node.
         */

        target.textContent = "";

        const cursor = document.createElement("span");

        cursor.className = "typing-cursor";
        cursor.setAttribute("aria-hidden", "true");

        /*
         * Use a text container so cursor does not become part
         * of the actual letter content.
         */

        const textNode = document.createTextNode("");

        target.appendChild(textNode);
        target.appendChild(cursor);

        let output = "";

        for (let i = 0; i < text.length; i++) {
          if (cancelled) {
            return;
          }

          if (skipRequested) {
            output = text;
            textNode.nodeValue = output;
            break;
          }

          const character = text[i];

          output += character;
          textNode.nodeValue = output;

          const delay = getTypingDelay(
            character,
            text[i + 1]
          );

          await sleep(
            isReducedMotion()
              ? 0
              : delay
          );
        }

        /*
         * Cursor remains for a short moment after typing.
         */

        if (!cancelled) {
          await sleep(
            isReducedMotion()
              ? 0
              : 700
          );
        }

        cursor.remove();
      }
    };

    return controller;
  }


  function getTypingDelay(character, nextCharacter) {
    /*
     * Natural human-ish rhythm:
     * not every character gets exactly the same delay.
     */

    let delay =
      CONFIG.typing.minDelay +
      Math.random() *
      (
        CONFIG.typing.maxDelay -
        CONFIG.typing.minDelay
      );

    /*
     * Spaces are slightly faster.
     */

    if (character === " ") {
      delay *= 0.55;
    }

    /*
     * Punctuation gets breathing room.
     */

    if (character === ",") {
      delay += CONFIG.typing.punctuationPause.comma;
    }

    if (character === ".") {
      delay += CONFIG.typing.punctuationPause.period;
    }

    if (character === "?") {
      delay += CONFIG.typing.punctuationPause.question;
    }

    if (character === "!") {
      delay += CONFIG.typing.punctuationPause.exclamation;
    }

    if (character === ":") {
      delay += CONFIG.typing.punctuationPause.colon;
    }

    /*
     * Newlines should feel like a real pause.
     */

    if (character === "\n") {
      delay += CONFIG.typing.punctuationPause.newline;
    }

    /*
     * Ellipsis.
     */

    if (
      character === "." &&
      nextCharacter === "."
    ) {
      delay += 70;
    }

    return clamp(delay, 5, 500);
  }


  /* ==========================================================
     29. SKIP TYPING
     ========================================================== */

  function enablePostTypingControls(scene) {
    const controls = $$(
      [
        "[data-after-typing]",
        ".after-typing",
        ".letter-next",
        ".birthday-next"
      ].join(","),
      scene
    );

    controls.forEach((control) => {
      control.classList.add("typing-unlocked");
      control.removeAttribute("disabled");
      control.setAttribute("aria-disabled", "false");
    });
  }


  function skipCurrentTyping() {
    if (
      activeTypingController &&
      state.typingStarted &&
      !state.typingFinished
    ) {
      activeTypingController.skip();
    }
  }


  /* ==========================================================
     30. REVEAL / PLUS BUTTONS
     ========================================================== */

  function setupRevealInteractions() {
    const buttons = allExisting(
      CONFIG.selectors.revealButtons
    );

    buttons.forEach((button) => {
      if (button.dataset.revealBound === "true") {
        return;
      }

      button.dataset.revealBound = "true";

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        toggleReveal(button);
      });

      button.addEventListener("keydown", (event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          toggleReveal(button);
        }
      });
    });
  }


  function toggleReveal(button) {
    const expanded =
      button.getAttribute("aria-expanded") === "true";

    const target = resolveRevealTarget(button);

    /*
     * Accordion-like behavior only inside the nearest scene
     * and only when the HTML explicitly asks for it.
     */

    const group =
      button.closest(
        "[data-reveal-group], .traits-grid, .trait-list"
      );

    if (
      group &&
      button.dataset.exclusive === "true"
    ) {
      const siblings = allExisting(
        CONFIG.selectors.revealButtons,
        group
      );

      siblings.forEach((sibling) => {
        if (sibling !== button) {
          closeReveal(sibling);
        }
      });
    }

    button.setAttribute(
      "aria-expanded",
      String(!expanded)
    );

    button.classList.toggle(
      "is-open",
      !expanded
    );

    button.classList.toggle(
      "is-closed",
      expanded
    );

    if (target) {
      target.hidden = expanded;
      target.classList.toggle(
        "is-visible",
        !expanded
      );

      target.classList.toggle(
        "is-hidden",
        expanded
      );

      target.setAttribute(
        "aria-hidden",
        String(expanded)
      );
    }

    /*
     * Rotate plus icon if present.
     */

    const icon =
      firstExisting(
        [
          ".plus",
          ".plus-icon",
          ".reveal-icon",
          "svg"
        ],
        button
      );

    if (icon) {
      icon.classList.toggle(
        "rotated",
        !expanded
      );
    }

    /*
     * Tiny haptic feedback where supported.
     */

    softHaptic();
  }


  function closeReveal(button) {
    button.setAttribute(
      "aria-expanded",
      "false"
    );

    button.classList.remove("is-open");
    button.classList.add("is-closed");

    const target = resolveRevealTarget(button);

    if (target) {
      target.hidden = true;
      target.classList.remove("is-visible");
      target.classList.add("is-hidden");
      target.setAttribute("aria-hidden", "true");
    }
  }


  function resolveRevealTarget(button) {
    const targetReference =
      button.dataset.reveal ||
      button.dataset.target ||
      button.getAttribute("aria-controls");

    if (targetReference) {
      const reference = targetReference.trim();

      /*
       * ID selector.
       */

      const byId =
        document.getElementById(
          reference.replace(/^#/, "")
        );

      if (byId) {
        return byId;
      }

      try {
        const bySelector = $(reference);

        if (bySelector) {
          return bySelector;
        }
      } catch {
        /* invalid selector */
      }
    }

    /*
     * Automatic sibling detection.
     */

    const parent =
      button.parentElement;

    if (!parent) {
      return null;
    }

    const sibling =
      parent.querySelector(
        ".reveal-content, .trait-detail, .trait-text, .memory-detail, [data-reveal-content]"
      );

    if (sibling) {
      return sibling;
    }

    return null;
  }


  /* ==========================================================
     31. HYDROPONICS SIDE QUEST
     ========================================================== */

  function setupHydroponics() {
    const cards = allExisting(
      CONFIG.selectors.hydroponicsButtons
    );

    cards.forEach((card) => {
      if (card.dataset.hydroBound === "true") {
        return;
      }

      card.dataset.hydroBound = "true";

      card.addEventListener("click", (event) => {
        /*
         * If it is a normal anchor that has an actual URL,
         * don't hijack it.
         */

        if (
          card.tagName === "A" &&
          card.getAttribute("href") &&
          card.getAttribute("href") !== "#"
        ) {
          return;
        }

        event.preventDefault();

        openHydroponics(card);
      });
    });
  }


  function openHydroponics(sourceCard) {
    if (state.hydroponicsOpen) {
      return;
    }

    state.hydroponicsOpen = true;

    document.body.classList.add(
      "hydroponics-open"
    );

    const existingModal =
      firstExisting(
        [
          "#hydroponicsModal",
          ".hydroponics-modal",
          "[data-hydroponics-modal]"
        ]
      );

    if (existingModal) {
      hydroponicsModal = existingModal;

      showHydroponicsModal(
        hydroponicsModal
      );

      return;
    }

    /*
     * If HTML doesn't contain a modal, create one.
     *
     * This makes the JS resilient rather than allowing the
     * PKWU interaction to silently fail.
     */

    hydroponicsModal =
      createHydroponicsModal();

    document.body.appendChild(
      hydroponicsModal
    );

    requestAnimationFrame(() => {
      showHydroponicsModal(
        hydroponicsModal
      );
    });
  }


  function createHydroponicsModal() {
    const modal =
      document.createElement("div");

    modal.className =
      "hydroponics-modal js-created-modal";

    modal.id =
      "hydroponicsModal";

    modal.setAttribute(
      "role",
      "dialog"
    );

    modal.setAttribute(
      "aria-modal",
      "true"
    );

    modal.setAttribute(
      "aria-label",
      "PKWU Hydroponics"
    );

    modal.innerHTML = `
      <div class="hydroponics-modal__backdrop" data-close></div>

      <div class="hydroponics-modal__dialog">

        <button
          class="hydroponics-modal__close modal-close"
          type="button"
          data-close
          aria-label="Tutup"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div class="hydroponics-modal__eyebrow">
          SIDE QUEST // PKWU
        </div>

        <h2 class="hydroponics-modal__title">
          hydroponics.
        </h2>

        <p class="hydroponics-modal__text">
          Salah satu bagian kecil dari perjalanan kita yang
          ternyata ikut menyimpan banyak cerita.
        </p>

        <p class="hydroponics-modal__text">
          Kerangkanya sudah selesai.
          Tapi kalau dipikir-pikir...
        </p>

        <p class="hydroponics-modal__accent">
          our little side quest isn't over yet.
        </p>

        <div class="hydroponics-modal__signature">
          ~ Tongzi🤾‍♂️
        </div>

      </div>
    `;

    setupModalCloseEvents(modal);

    return modal;
  }


  function showHydroponicsModal(modal) {
    modal.hidden = false;

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    modal.classList.add("is-open");

    /*
     * Lock body only for modal, not for scene navigation.
     */

    document.body.classList.add(
      "modal-open"
    );

    const closeButton =
      firstExisting(
        CONFIG.selectors.closeButtons,
        modal
      );

    if (closeButton) {
      window.setTimeout(() => {
        try {
          closeButton.focus();
        } catch {
          /* no-op */
        }
      }, 80);
    }
  }


  function setupModalCloseEvents(modal) {
    const closeButtons = allExisting(
      CONFIG.selectors.closeButtons,
      modal
    );

    closeButtons.forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          closeHydroponics();
        }
      );
    });
  }


  function closeHydroponics() {
    if (!state.hydroponicsOpen) {
      return;
    }

    state.hydroponicsOpen = false;

    document.body.classList.remove(
      "hydroponics-open"
    );

    document.body.classList.remove(
      "modal-open"
    );

    if (hydroponicsModal) {
      hydroponicsModal.classList.remove(
        "is-open"
      );

      hydroponicsModal.setAttribute(
        "aria-hidden",
        "true"
      );

      /*
       * Only hide generated modal.
       * Existing HTML modal remains reusable.
       */

      if (
        hydroponicsModal.classList.contains(
          "js-created-modal"
        )
      ) {
        window.setTimeout(() => {
          if (
            hydroponicsModal &&
            hydroponicsModal.parentNode
          ) {
            hydroponicsModal.remove();
          }

          hydroponicsModal = null;
        }, 350);
      } else {
        hydroponicsModal.hidden = true;
      }
    }
  }


  /* ==========================================================
     32. SCENE 9 — QUIET MOMENT
     ========================================================== */

  function prepareQuietScene(scene) {
    document.body.classList.add(
      "quiet-mode"
    );

    const quietElements = $$(
      [
        ".quiet-line",
        ".reassurance",
        ".quiet-message",
        "[data-quiet]"
      ].join(","),
      scene
    );

    quietElements.forEach((element, index) => {
      element.style.setProperty(
        "--quiet-delay",
        `${index * 350}ms`
      );

      element.classList.add(
        "quiet-ready"
      );
    });

    /*
     * Ensure music1 is not secretly still running.
     */

    if (
      music1 &&
      !music1.paused
    ) {
      stopMusic1();
    }
  }


  /* ==========================================================
     33. SCENE 10 — PROPOSAL
     ========================================================== */

  function setupProposal() {
    const buttons = allExisting(
      CONFIG.selectors.proposalButtons
    );

    buttons.forEach((button) => {
      if (button.dataset.proposalBound === "true") {
        return;
      }

      button.dataset.proposalBound = "true";

      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          handleProposalAnswer(
            button
          );
        }
      );
    });
  }


  function prepareProposalScene(
    scene,
    previousScene
  ) {
    document.body.classList.remove(
      "quiet-mode"
    );

    document.body.classList.add(
      "proposal-mode"
    );

    /*
     * Music 2 is already orchestrated by goToScene().
     * We do NOT call it blindly here because that could cause
     * duplicate transitions.
     */

    const proposalContainer =
      firstExisting(
        [
          ".proposal",
          ".proposal-card",
          "[data-proposal-container]",
          ".confession"
        ],
        scene
      );

    if (!proposalContainer) {
      /*
       * If the HTML doesn't yet have a proposal container,
       * construct a graceful fallback.
       */

      createProposalFallback(scene);

      return;
    }

    /*
     * Populate empty semantic placeholders only.
     *
     * This avoids overwriting carefully designed HTML.
     */

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-opening]",
      PROPOSAL_COPY.opening
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-journey]",
      PROPOSAL_COPY.journey
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-response]",
      PROPOSAL_COPY.response
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-reason]",
      PROPOSAL_COPY.reason
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-realization]",
      PROPOSAL_COPY.realization
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-hts]",
      PROPOSAL_COPY.hts
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-callback]",
      PROPOSAL_COPY.callback
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-turn]",
      PROPOSAL_COPY.turn
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-ownership]",
      PROPOSAL_COPY.ownership
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-question]",
      PROPOSAL_COPY.question
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-small-note]",
      PROPOSAL_COPY.smallNote
    );

    fillProposalPlaceholder(
      proposalContainer,
      "[data-proposal-final-note]",
      PROPOSAL_COPY.finalNote
    );

    /*
     * Proposal elements enter in a controlled order.
     */

    const elements = $$(
      [
        "[data-proposal-opening]",
        "[data-proposal-journey]",
        "[data-proposal-response]",
        "[data-proposal-reason]",
        "[data-proposal-realization]",
        "[data-proposal-hts]",
        "[data-proposal-callback]",
        "[data-proposal-turn]",
        "[data-proposal-ownership]",
        "[data-proposal-question]",
        ".proposal-actions",
        "[data-proposal-small-note]",
        "[data-proposal-final-note]"
      ].join(","),
      proposalContainer
    );

    elements.forEach((element, index) => {
      element.style.setProperty(
        "--proposal-delay",
        `${index * 230}ms`
      );

      element.classList.add(
        "proposal-reveal"
      );
    });

    /*
     * Stagger stickers separately.
     */

    const stickers = $$(
      ".sticker, [data-sticker], .proposal-sticker",
      scene
    );

    stickers.forEach((sticker, index) => {
      sticker.style.setProperty(
        "--sticker-delay",
        `${700 + index * 180}ms`
      );

      sticker.classList.add(
        "proposal-sticker-reveal"
      );
    });
  }


  function fillProposalPlaceholder(
    container,
    selector,
    text
  ) {
    const element = $(selector, container);

    if (
      element &&
      !element.textContent.trim()
    ) {
      element.textContent = text;
    }
  }


  function createProposalFallback(scene) {
    const wrapper =
      document.createElement("div");

    wrapper.className =
      "proposal proposal-card js-proposal-fallback";

    wrapper.innerHTML = `
      <div class="proposal__eyebrow">
        ${escapeHTML(PROPOSAL_COPY.eyebrow)}
      </div>

      <div class="proposal__opening">
        ${escapeHTML(PROPOSAL_COPY.opening)}
      </div>

      <p class="proposal__journey">
        ${escapeHTML(PROPOSAL_COPY.journey)}
      </p>

      <p class="proposal__response">
        ${escapeHTML(PROPOSAL_COPY.response)}
      </p>

      <p class="proposal__reason">
        ${escapeHTML(PROPOSAL_COPY.reason)}
      </p>

      <p class="proposal__realization">
        ${escapeHTML(PROPOSAL_COPY.realization)}
      </p>

      <p class="proposal__hts">
        ${escapeHTML(PROPOSAL_COPY.hts)}
      </p>

      <p class="proposal__callback">
        ${escapeHTML(PROPOSAL_COPY.callback)}
      </p>

      <p class="proposal__turn">
        ${escapeHTML(PROPOSAL_COPY.turn)}
      </p>

      <p class="proposal__ownership">
        ${escapeHTML(PROPOSAL_COPY.ownership)}
      </p>

      <h2 class="proposal__question">
        ${escapeHTML(PROPOSAL_COPY.question)}
      </h2>

      <div class="proposal__actions">

        <button
          type="button"
          class="proposal-btn proposal-btn--yes"
          data-proposal-answer="yes"
        >
          iya.
        </button>

        <button
          type="button"
          class="proposal-btn proposal-btn--soft"
          data-proposal-answer="yes"
        >
          hehee... iya.
        </button>

      </div>

      <p class="proposal__small-note">
        ${escapeHTML(PROPOSAL_COPY.smallNote)}
      </p>

      <p class="proposal__final-note">
        ${escapeHTML(PROPOSAL_COPY.finalNote)}
      </p>
    `;

    scene.appendChild(wrapper);

    /*
     * Bind generated buttons.
     */

    setupProposal();

    requestAnimationFrame(() => {
      prepareProposalScene(
        scene,
        state.previousScene
      );
    });
  }


  function handleProposalAnswer(button) {
    if (state.proposalAnswered) {
      return;
    }

    state.proposalAnswered = true;

    const answer =
      button.dataset.proposalAnswer ||
      button.dataset.proposal ||
      "yes";

    document.body.classList.add(
      "proposal-answered"
    );

    document.body.dataset.proposalAnswer =
      answer;

    const scene =
      getScene(10);

    if (!scene) {
      return;
    }

    /*
     * Disable proposal buttons after answer.
     */

    const buttons = allExisting(
      CONFIG.selectors.proposalButtons,
      scene
    );

    buttons.forEach((item) => {
      item.disabled = true;
      item.classList.add(
        "proposal-answered-button"
      );
    });

    /*
     * Reveal afterglow.
     */

    revealProposalAfterglow(scene);

    softHaptic();
  }


  function revealProposalAfterglow(scene) {
    let afterglow =
      firstExisting(
        [
          ".proposal-afterglow",
          "[data-afterglow]",
          ".afterglow"
        ],
        scene
      );

    /*
     * If no afterglow exists in HTML, create one.
     */

    if (!afterglow) {
      afterglow =
        document.createElement("div");

      afterglow.className =
        "proposal-afterglow";

      afterglow.dataset.afterglow = "true";

      afterglow.innerHTML = `
        <div class="afterglow__line">
          okay...
        </div>

        <div class="afterglow__main">
          then let's see where this little story goes next.
        </div>

        <div class="afterglow__signature">
          ~ Tongzi🤾‍♂️
        </div>
      `;

      const container =
        firstExisting(
          [
            ".proposal-card",
            ".proposal",
            ".confession"
          ],
          scene
        ) || scene;

      container.appendChild(
        afterglow
      );
    }

    window.setTimeout(() => {
      afterglow.hidden = false;

      afterglow.classList.add(
        "is-visible"
      );

      /*
       * Let music2 breathe rather than restarting it.
       */

      document.body.classList.add(
        "proposal-afterglow-active"
      );
    }, isReducedMotion() ? 0 : 450);
  }


  /* ==========================================================
     34. STOP MUSIC 2
     ========================================================== */

  async function stopMusic2() {
    if (!music2) {
      return;
    }

    await fadeAudio(
      music2,
      0,
      CONFIG.audio.fadeOut
    );

    stopAudio(
      music2,
      true
    );

    state.music2Started = false;

    document.body.classList.remove(
      "music2-active"
    );
  }


  /* ==========================================================
     35. TOUCH / SWIPE PROTECTION
     ========================================================== */

  function setupTouchProtection() {
    document.addEventListener(
      "touchstart",
      (event) => {
        if (!event.touches.length) {
          return;
        }

        const touch =
          event.touches[0];

        state.touchStartX =
          touch.clientX;

        state.touchStartY =
          touch.clientY;
      },
      {
        passive: true
      }
    );

    document.addEventListener(
      "touchend",
      (event) => {
        if (!event.changedTouches.length) {
          return;
        }

        const touch =
          event.changedTouches[0];

        const deltaX =
          touch.clientX -
          state.touchStartX;

        const deltaY =
          touch.clientY -
          state.touchStartY;

        /*
         * We intentionally do NOTHING here.
         *
         * A swipe must never switch scenes.
         *
         * This is a deliberate architectural choice.
         */

        if (
          Math.abs(deltaX) > 60 &&
          Math.abs(deltaX) > Math.abs(deltaY)
        ) {
          /*
           * Consume only the conceptual gesture.
           * The browser is still allowed to perform normal
           * scrolling when appropriate.
           */
        }
      },
      {
        passive: true
      }
    );

    /*
     * Prevent wheel events from becoming scene navigation.
     *
     * We DO NOT prevent ordinary internal scene scrolling.
     */

    document.addEventListener(
      "wheel",
      (event) => {
        /*
         * Deliberately empty.
         *
         * Scene transitions happen only through buttons.
         */
      },
      {
        passive: true
      }
    );
  }


  /* ==========================================================
     36. KEYBOARD NAVIGATION
     * ========================================================== */

  function setupKeyboardNavigation() {
    document.addEventListener(
      "keydown",
      async (event) => {
        /*
         * Never hijack typing inside input/textarea/contenteditable.
         */

        const active =
          document.activeElement;

        const isTypingField =
          active &&
          (
            active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable
          );

        if (isTypingField) {
          return;
        }

        /*
         * Escape closes modal.
         */

        if (event.key === "Escape") {
          if (state.hydroponicsOpen) {
            closeHydroponics();
            return;
          }

          /*
           * If typing is active, first Escape skips typing
           * rather than leaving the experience.
           */

          if (
            state.typingStarted &&
            !state.typingFinished
          ) {
            skipCurrentTyping();
          }

          return;
        }

        /*
         * Space can skip typing.
         */

        if (
          event.key === " " &&
          state.typingStarted &&
          !state.typingFinished
        ) {
          event.preventDefault();
          skipCurrentTyping();
          return;
        }

        /*
         * Arrow navigation is optional convenience, but it
         * still respects the click-first architecture.
         */

        if (event.key === "ArrowRight") {
          await goToScene(
            state.currentScene + 1
          );
        }

        if (event.key === "ArrowLeft") {
          await goToScene(
            state.currentScene - 1
          );
        }
      }
    );
  }


  /* ==========================================================
     37. VISIBILITY HANDLING
     * ========================================================== */

  function setupVisibilityHandling() {
    document.addEventListener(
      "visibilitychange",
      () => {
        state.isPageVisible =
          !document.hidden;

        if (!document.hidden) {
          document.body.classList.remove(
            "page-hidden"
          );

          /*
           * Don't restart music automatically.
           * Browser policies can reject it.
           */

          return;
        }

        document.body.classList.add(
          "page-hidden"
        );
      }
    );
  }


  /* ==========================================================
     38. CURSOR MICRO INTERACTION
     ========================================================== */

  function setupCursorEffects() {
    /*
     * Avoid expensive cursor systems on touch devices.
     */

    const hasFinePointer =
      window.matchMedia &&
      window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      ).matches;

    if (!hasFinePointer) {
      return;
    }

    document.body.classList.add(
      "fine-pointer"
    );

    let raf = null;
    let pointerX = 0;
    let pointerY = 0;

    const cursor =
      document.createElement("div");

    cursor.className =
      "js-cursor";

    cursor.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.appendChild(
      cursor
    );

    document.addEventListener(
      "pointermove",
      (event) => {
        pointerX =
          event.clientX;

        pointerY =
          event.clientY;

        if (!raf) {
          raf = requestAnimationFrame(() => {
            cursor.style.transform =
              `translate3d(${pointerX}px, ${pointerY}px, 0)`;

            raf = null;
          });
        }
      },
      {
        passive: true
      }
    );

    const interactiveSelector = [
      "button",
      "a",
      "[role='button']",
      ".interactive",
      ".trait-card",
      ".memory-card",
      ".hydroponics-card",
      ".proposal-btn"
    ].join(",");

    document.addEventListener(
      "pointerover",
      (event) => {
        const target =
          event.target.closest(
            interactiveSelector
          );

        if (target) {
          cursor.classList.add(
            "is-hovering"
          );
        }
      },
      {
        passive: true
      }
    );

    document.addEventListener(
      "pointerout",
      (event) => {
        const target =
          event.target.closest(
            interactiveSelector
          );

        if (target) {
          cursor.classList.remove(
            "is-hovering"
          );
        }
      },
      {
        passive: true
      }
    );

    document.addEventListener(
      "pointerdown",
      () => {
        cursor.classList.add(
          "is-pressed"
        );
      },
      {
        passive: true
      }
    );

    document.addEventListener(
      "pointerup",
      () => {
        cursor.classList.remove(
          "is-pressed"
        );
      },
      {
        passive: true
      }
    );
  }


  /* ==========================================================
     39. PROGRESS INDICATOR
     ========================================================== */

  function setupProgressIndicator() {
    progressIndicator =
      firstExisting(
        [
          "[data-progress]",
          ".scene-progress",
          ".progress-dots",
          ".story-progress"
        ]
      );

    if (!progressIndicator) {
      /*
       * Don't create a visible UI element automatically.
       * The CSS/HTML can decide whether a progress system
       * belongs to the visual language.
       */

      return;
    }

    updateProgressIndicator();
  }


  function updateProgressIndicator() {
    if (!progressIndicator) {
      return;
    }

    const percentage =
      (
        (state.currentScene - 1) /
        (CONFIG.totalScenes - 1)
      ) * 100;

    progressIndicator.style.setProperty(
      "--progress",
      `${clamp(percentage, 0, 100)}%`
    );

    progressIndicator.dataset.scene =
      String(state.currentScene);

    /*
     * If progress contains individual dots, update them.
     */

    const dots =
      $$(
        "[data-progress-scene], .progress-dot",
        progressIndicator
      );

    dots.forEach((dot, index) => {
      const sceneNumber =
        parseSceneNumber(
          dot.dataset.progressScene ||
          String(index + 1)
        );

      dot.classList.toggle(
        "is-active",
        sceneNumber === state.currentScene
      );

      dot.classList.toggle(
        "is-complete",
        sceneNumber < state.currentScene
      );
    });
  }


  /* ==========================================================
     40. SAVE PROGRESS
     ========================================================== */

  function saveProgress(sceneNumber) {
    /*
     * Do not persist the actual scene on reload.
     * Only store harmless metadata useful for debugging.
     */

    try {
      sessionStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify({
          lastScene: sceneNumber,
          timestamp: Date.now()
        })
      );
    } catch {
      /* storage unavailable */
    }
  }


  /* ==========================================================
     41. SAFETY FALLBACKS
     ========================================================== */

  function setupSafetyFallbacks() {
    /*
     * Prevent buttons from submitting a surrounding form.
     */

    $$("button").forEach((button) => {
      if (!button.getAttribute("type")) {
        button.setAttribute(
          "type",
          "button"
        );
      }
    });

    /*
     * Fix empty href="#" links.
     */

    $$("a[href='#']").forEach((link) => {
      link.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
        }
      );
    });

    /*
     * Broken local images should not visually destroy layout.
     */

    $$("img").forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          image.classList.add(
            "image-load-error"
          );
        },
        {
          once: true
        }
      );
    });
  }


  /* ==========================================================
     42. MODAL GLOBAL CLOSE
     ========================================================== */

  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target;

      if (
        target &&
        target.matches &&
        target.matches(
          "[data-close], .modal-backdrop, .hydroponics-modal__backdrop"
        )
      ) {
        closeHydroponics();
      }
    }
  );


  /* ==========================================================
     43. HAPTIC FEEDBACK
     ========================================================== */

  function softHaptic() {
    /*
     * Very subtle.
     * Not required for functionality.
     */

    if (
      "vibrate" in navigator &&
      typeof navigator.vibrate === "function"
    ) {
      try {
        navigator.vibrate(8);
      } catch {
        /* no-op */
      }
    }
  }


  /* ==========================================================
     44. ESCAPE HTML
     ========================================================== */

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* ==========================================================
     45. EXTERNAL DEBUG API
     ==========================================================
     Useful during development.

     These methods are intentionally tiny and harmless.
     They allow testing individual scenes from DevTools
     without modifying the website.
     ========================================================== */

  window.BoluUbi = {
    goToScene,

    next: () => {
      return goToScene(
        state.currentScene + 1
      );
    },

    previous: () => {
      return goToScene(
        state.currentScene - 1
      );
    },

    startMusic1,

    stopMusic1,

    startMusic2,

    stopMusic2,

    skipTyping: skipCurrentTyping,

    openHydroponics,

    closeHydroponics,

    getState: () => ({
      ...state
    })
  };


  /* ==========================================================
     46. INITIAL BOOT
     ========================================================== */

  if (
    document.readyState === "loading"
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


  /* ==========================================================
     47. GLOBAL ERROR GUARD
     ==========================================================
     The site should never completely die because one optional
     animation or interaction throws an error.
     ========================================================== */

  window.addEventListener(
    "error",
    (event) => {
      /*
       * Keep the error visible in development but prevent
       * decorative JS from breaking the rest of the page.
       */

      document.body.classList.add(
        "js-runtime-warning"
      );

      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        console.warn(
          "[Bolu Ubi] Runtime warning:",
          event.error || event.message
        );
      }
    }
  );


  window.addEventListener(
    "unhandledrejection",
    (event) => {
      document.body.classList.add(
        "js-runtime-warning"
      );

      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        console.warn(
          "[Bolu Ubi] Promise warning:",
          event.reason
        );
      }
    }
  );

})();