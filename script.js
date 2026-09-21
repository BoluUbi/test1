/* =========================================================
   BOLU UBI 🐣
   script.js
   ---------------------------------------------------------
   Scene controller + navigation + audio + transitions +
   typing + interaction system

   IMPORTANT:
   - This file is designed to work with the existing HTML
     structure without forcing a specific class naming style.
   - Navigation is intentionally defensive.
   - Scene changes are CLICK/TAP based, never scroll based.
   - Scene 8 remains internally scrollable.
   - music1 and music2 are never allowed to overlap.
   ========================================================= */

(() => {
    "use strict";

    /* =====================================================
       01. CONFIGURATION
       ===================================================== */

    const CONFIG = Object.freeze({
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

        transition: {
            duration: 820,
            outDuration: 420,
            inDuration: 620,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
        },

        audio: {
            music1FadeIn: 1800,
            music1FadeOut: 1100,

            music2FadeIn: 1800,
            music2FadeOut: 1000,

            volumeMusic1: 0.42,
            volumeMusic2: 0.48,

            silenceBeforeMusic2: 380
        },

        typing: {
            defaultSpeed: {
                min: 18,
                max: 48
            },

            emotionalSpeed: {
                min: 34,
                max: 82
            },

            punctuationPause: {
                comma: 70,
                period: 210,
                exclamation: 260,
                question: 240,
                ellipsis: 420,
                newline: 250
            }
        },

        selectors: {
            scene:
                ".scene, [data-scene], [data-scene-id]",

            navigation:
                [
                    "button",
                    "a",
                    "[role='button']",
                    "[data-next-scene]",
                    "[data-scene-target]",
                    "[data-go-to]",
                    "[data-target]",
                    "[data-next]",
                    ".next-btn",
                    ".scene-next",
                    ".scene-button",
                    ".nav-button"
                ].join(","),

            typingTarget:
                [
                    "[data-typing]",
                    ".typing-text",
                    ".typewriter",
                    ".letter-typing"
                ].join(",")
        },

        debug: false
    });


    /* =====================================================
       02. STATE
       ===================================================== */

    const state = {
        initialized: false,

        currentScene: 1,
        previousScene: null,

        isTransitioning: false,
        isDestroyed: false,

        navigationLocked: false,

        transitionToken: 0,

        scenes: [],
        sceneMap: new Map(),

        audio: {
            music1: null,
            music2: null,

            active: null,

            fadeFrame: null,

            music1Started: false,
            music2Started: false
        },

        typing: {
            active: false,
            cancelled: false,
            timer: null,
            controller: null
        },

        interactions: {
            activatedElements: new WeakSet()
        },

        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };


    /* =====================================================
       03. SMALL UTILITIES
       ===================================================== */

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

    const isElement = (value) => {
        return value instanceof Element;
    };

    const isInteractiveElement = (element) => {
        if (!isElement(element)) return false;

        return (
            element.matches(
                "button, a, [role='button'], " +
                "[data-next-scene], [data-scene-target], " +
                "[data-go-to], [data-target], [data-next]"
            )
        );
    };

    const wait = (ms) => {
        return new Promise(resolve => {
            window.setTimeout(resolve, ms);
        });
    };

    const nextFrame = () => {
        return new Promise(resolve => {
            requestAnimationFrame(() => resolve());
        });
    };

    const safeNumber = (value, fallback = 0) => {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    };


    /* =====================================================
       04. DEBUG LOGGER
       ===================================================== */

    const debug = (...args) => {
        if (!CONFIG.debug) return;

        console.log(
            "%c[BOLU UBI]",
            "font-weight:700;",
            ...args
        );
    };

    const warn = (...args) => {
        console.warn(
            "%c[BOLU UBI]",
            "font-weight:700;",
            ...args
        );
    };


    /* =====================================================
       05. SCENE DISCOVERY
       ===================================================== */

    function normalizeSceneNumber(value) {
        if (value === null || value === undefined) {
            return null;
        }

        const raw = String(value).trim();

        if (!raw) {
            return null;
        }

        /*
         * Accept:
         * 1
         * "1"
         * "scene-1"
         * "scene1"
         * "#scene-1"
         * "scene_1"
         * "Scene 1"
         */

        const match = raw.match(
            /(?:scene[\s_-]*)?(\d+)/i
        );

        if (!match) {
            return null;
        }

        const number = Number(match[1]);

        if (
            !Number.isInteger(number) ||
            number < 1 ||
            number > CONFIG.totalScenes
        ) {
            return null;
        }

        return number;
    }


    function getSceneNumber(element, fallbackIndex = null) {
        if (!isElement(element)) {
            return fallbackIndex;
        }

        const candidates = [
            element.dataset.scene,
            element.dataset.sceneId,
            element.getAttribute("data-scene"),
            element.getAttribute("data-scene-id"),
            element.id,
            element.getAttribute("aria-label")
        ];

        for (const candidate of candidates) {
            const number = normalizeSceneNumber(candidate);

            if (number !== null) {
                return number;
            }
        }

        return fallbackIndex;
    }


    function discoverScenes() {
        let candidates = $$(CONFIG.selectors.scene);

        /*
         * Fallback:
         * If HTML uses IDs like #scene1, #scene2 etc.
         */
        if (candidates.length === 0) {
            candidates = Array.from(
                { length: CONFIG.totalScenes },
                (_, index) => {
                    return (
                        document.getElementById(
                            `scene${index + 1}`
                        ) ||
                        document.getElementById(
                            `scene-${index + 1}`
                        )
                    );
                }
            ).filter(Boolean);
        }

        const normalized = [];

        candidates.forEach((element, index) => {
            const number = getSceneNumber(
                element,
                index + 1
            );

            if (!number) {
                return;
            }

            normalized.push({
                element,
                number
            });
        });

        /*
         * Sort by actual scene number.
         */
        normalized.sort(
            (a, b) => a.number - b.number
        );

        state.scenes = normalized;
        state.sceneMap.clear();

        normalized.forEach(item => {
            state.sceneMap.set(
                item.number,
                item.element
            );
        });

        debug(
            "Scenes discovered:",
            normalized.map(item => item.number)
        );

        return normalized;
    }


    function getScene(number) {
        const normalized = normalizeSceneNumber(number);

        if (!normalized) {
            return null;
        }

        return (
            state.sceneMap.get(normalized) ||
            null
        );
    }


    /* =====================================================
       06. SCENE VISIBILITY
       ===================================================== */

    function prepareSceneElement(scene, isActive) {
        if (!isElement(scene)) {
            return;
        }

        scene.classList.toggle(
            "active",
            isActive
        );

        scene.classList.toggle(
            "is-active",
            isActive
        );

        scene.setAttribute(
            "aria-hidden",
            String(!isActive)
        );

        /*
         * Do NOT use display:none directly here.
         * CSS controls the visual transition.
         * Hidden attribute is used only when the project
         * already supports it safely.
         */

        if (isActive) {
            scene.removeAttribute("inert");

            /*
             * We intentionally do not remove scroll position
             * automatically here. Scene 8 may need its own
             * internal reading position.
             */
        } else {
            scene.setAttribute("inert", "");
        }
    }


    function initializeSceneVisibility() {
        if (state.scenes.length === 0) {
            warn(
                "No scenes detected. " +
                "Check .scene / data-scene / scene IDs."
            );

            return;
        }

        let detectedActive = state.scenes.find(
            item =>
                item.element.classList.contains("active") ||
                item.element.classList.contains("is-active")
        );

        let initialScene =
            detectedActive?.number ||
            1;

        if (!state.sceneMap.has(initialScene)) {
            initialScene =
                state.scenes[0]?.number || 1;
        }

        state.currentScene = initialScene;

        state.scenes.forEach(item => {
            prepareSceneElement(
                item.element,
                item.number === initialScene
            );
        });

        debug(
            "Initial scene:",
            state.currentScene
        );
    }


    /* =====================================================
       07. NAVIGATION TARGET RESOLUTION
       ===================================================== */

    function getNavigationAttribute(element, names) {
        for (const name of names) {
            const value =
                element.getAttribute(name);

            if (
                value !== null &&
                String(value).trim() !== ""
            ) {
                return String(value).trim();
            }
        }

        return null;
    }


    function resolveTargetFromHref(element) {
        const href =
            element.getAttribute("href");

        if (!href) {
            return null;
        }

        /*
         * Only interpret hash links as scene navigation.
         */
        if (href.startsWith("#")) {
            return normalizeSceneNumber(
                href.slice(1)
            );
        }

        return null;
    }


    function resolveTargetFromElement(element) {
        if (!isElement(element)) {
            return null;
        }

        /*
         * Priority 1:
         * Explicit navigation attributes.
         *
         * This is the preferred and most reliable system.
         */
        const explicit = getNavigationAttribute(
            element,
            [
                "data-next-scene",
                "data-scene-target",
                "data-go-to",
                "data-target",
                "data-next"
            ]
        );

        if (explicit) {
            const explicitNumber =
                normalizeSceneNumber(explicit);

            if (explicitNumber !== null) {
                return explicitNumber;
            }
        }

        /*
         * Priority 2:
         * href="#scene-9"
         */
        const hrefTarget =
            resolveTargetFromHref(element);

        if (hrefTarget !== null) {
            return hrefTarget;
        }

        /*
         * Priority 3:
         * data attributes with common naming.
         */
        const datasetCandidates = [
            element.dataset.nextScene,
            element.dataset.sceneTarget,
            element.dataset.goTo,
            element.dataset.target,
            element.dataset.next
        ];

        for (const candidate of datasetCandidates) {
            const number =
                normalizeSceneNumber(candidate);

            if (number !== null) {
                return number;
            }
        }

        /*
         * Priority 4:
         * Element ID itself can represent destination.
         *
         * Example:
         * <button id="scene-9">...</button>
         *
         * This is only used if it actually resolves to
         * an existing scene.
         */
        const idTarget =
            normalizeSceneNumber(
                element.id
            );

        if (
            idTarget !== null &&
            state.sceneMap.has(idTarget)
        ) {
            /*
             * Avoid accidentally treating a button
             * called "scene-9" as a destination when it
             * is actually the scene itself.
             */
            if (
                !state.scenes.some(
                    item =>
                        item.element === element
                )
            ) {
                return idTarget;
            }
        }

        return null;
    }


    function inferSequentialTarget(element) {
        if (!isElement(element)) {
            return null;
        }

        const scene =
            element.closest(
                ".scene, [data-scene], [data-scene-id]"
            );

        if (!scene) {
            return null;
        }

        const current =
            getSceneNumber(scene);

        if (!current) {
            return null;
        }

        const text =
            (element.innerText ||
                element.textContent ||
                "")
                .trim()
                .toLowerCase();

        /*
         * IMPORTANT:
         * We only infer "next" from strongly obvious wording.
         * This prevents random buttons from accidentally
         * changing scenes.
         */
        const looksLikeNext =
            /\b(next|lanjut|continue|selanjutnya|berikutnya)\b/i
                .test(text) ||
            /→|›|»/.test(text);

        if (!looksLikeNext) {
            return null;
        }

        const next =
            current + 1;

        if (
            next >= 1 &&
            next <= CONFIG.totalScenes &&
            state.sceneMap.has(next)
        ) {
            return next;
        }

        return null;
    }


    function resolveNavigationTarget(element) {
        const explicit =
            resolveTargetFromElement(element);

        if (explicit !== null) {
            return explicit;
        }

        /*
         * Sequential fallback.
         */
        const sequential =
            inferSequentialTarget(element);

        if (sequential !== null) {
            return sequential;
        }

        return null;
    }


    /* =====================================================
       08. SPECIAL SCENE 8 SAFETY
       ===================================================== */

    function isSceneEightButton(element) {
        if (!isElement(element)) {
            return false;
        }

        const scene =
            element.closest(
                ".scene, [data-scene], [data-scene-id]"
            );

        if (!scene) {
            return false;
        }

        return (
            getSceneNumber(scene) === 8
        );
    }


    function repairSceneEightNavigation() {
        const scene8 =
            getScene(8);

        if (!scene8) {
            return;
        }

        /*
         * Find possible navigation controls inside Scene 8.
         */
        const candidates = $$(
            CONFIG.selectors.navigation,
            scene8
        );

        candidates.forEach(button => {
            const target =
                resolveTargetFromElement(button);

            /*
             * If the button has no explicit destination
             * but its wording clearly means "next",
             * attach Scene 9 explicitly.
             */
            if (
                target === null &&
                inferSequentialTarget(button) === 9
            ) {
                button.dataset.nextScene = "9";
            }

            /*
             * If the button is visually intended to move
             * onward and Scene 8 is the current context,
             * give it an explicit destination.
             */
            const text =
                (
                    button.innerText ||
                    button.textContent ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            const likelyNext =
                /\b(lanjut|next|continue|selanjutnya|berikutnya)\b/i
                    .test(text) ||
                /→|›|»/.test(text);

            if (
                likelyNext &&
                !button.dataset.nextScene &&
                !button.dataset.sceneTarget &&
                !button.dataset.goTo &&
                !button.dataset.target &&
                !button.dataset.next
            ) {
                button.dataset.nextScene = "9";
            }
        });

        debug(
            "Scene 8 navigation repaired."
        );
    }


    /* =====================================================
       09. TRANSITION OVERLAY
       ===================================================== */

    function createTransitionOverlay() {
        let overlay =
            document.getElementById(
                "scene-transition"
            );

        if (overlay) {
            return overlay;
        }

        overlay =
            document.createElement("div");

        overlay.id =
            "scene-transition";

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

        /*
         * JS supplies fallback styling so the transition
         * still works even if CSS has not yet defined it.
         */
        Object.assign(
            overlay.style,
            {
                position: "fixed",
                inset: "0",
                zIndex: "99999",
                pointerEvents: "none",
                opacity: "0",
                background:
                    "rgba(255,250,245,0.96)",
                transition:
                    `opacity ${CONFIG.transition.outDuration}ms ${CONFIG.transition.easing}`,
                willChange: "opacity"
            }
        );

        document.body.appendChild(
            overlay
        );

        return overlay;
    }


    async function transitionOut(token) {
        const overlay =
            createTransitionOverlay();

        if (token !== state.transitionToken) {
            return false;
        }

        overlay.style.transition =
            `opacity ${CONFIG.transition.outDuration}ms ${CONFIG.transition.easing}`;

        overlay.style.opacity = "0";

        await nextFrame();

        if (token !== state.transitionToken) {
            return false;
        }

        overlay.style.opacity = "1";

        await wait(
            CONFIG.transition.outDuration
        );

        return token === state.transitionToken;
    }


    async function transitionIn(token) {
        const overlay =
            createTransitionOverlay();

        if (token !== state.transitionToken) {
            return false;
        }

        overlay.style.transition =
            `opacity ${CONFIG.transition.inDuration}ms ${CONFIG.transition.easing}`;

        overlay.style.opacity = "1";

        await nextFrame();

        if (token !== state.transitionToken) {
            return false;
        }

        overlay.style.opacity = "0";

        await wait(
            CONFIG.transition.inDuration
        );

        return token === state.transitionToken;
    }


    /* =====================================================
       10. AUDIO ENGINE
       ===================================================== */

    function createAudio(src, loop = true) {
        const audio =
            document.createElement("audio");

        audio.preload = "auto";
        audio.loop = loop;
        audio.src = src;

        /*
         * Keep the audio element alive but invisible.
         */
        audio.style.display = "none";

        document.body.appendChild(
            audio
        );

        return audio;
    }


    function initializeAudio() {
        if (!state.audio.music1) {
            state.audio.music1 =
                createAudio(
                    CONFIG.assets.music1,
                    true
                );
        }

        if (!state.audio.music2) {
            state.audio.music2 =
                createAudio(
                    CONFIG.assets.music2,
                    true
                );
        }

        state.audio.music1.volume = 0;
        state.audio.music2.volume = 0;

        /*
         * Defensive:
         * both tracks start paused.
         */
        try {
            state.audio.music1.pause();
            state.audio.music2.pause();

            state.audio.music1.currentTime = 0;
            state.audio.music2.currentTime = 0;
        } catch {
            /* ignored */
        }
    }


    function cancelAudioFade() {
        if (
            state.audio.fadeFrame !== null
        ) {
            cancelAnimationFrame(
                state.audio.fadeFrame
            );

            state.audio.fadeFrame = null;
        }
    }


    function fadeAudio(
        audio,
        from,
        to,
        duration
    ) {
        return new Promise(resolve => {
            if (!audio) {
                resolve();
                return;
            }

            cancelAudioFade();

            const start =
                performance.now();

            audio.volume =
                clamp(from, 0, 1);

            const animate = now => {
                const progress =
                    clamp(
                        (now - start) /
                        duration,
                        0,
                        1
                    );

                /*
                 * Smoothstep-like easing.
                 */
                const eased =
                    progress *
                    progress *
                    (3 - 2 * progress);

                audio.volume =
                    clamp(
                        from +
                        (to - from) *
                        eased,
                        0,
                        1
                    );

                if (progress < 1) {
                    state.audio.fadeFrame =
                        requestAnimationFrame(
                            animate
                        );
                } else {
                    state.audio.fadeFrame =
                        null;

                    audio.volume =
                        clamp(to, 0, 1);

                    resolve();
                }
            };

            state.audio.fadeFrame =
                requestAnimationFrame(
                    animate
                );
        });
    }


    async function safePlay(audio) {
        if (!audio) {
            return false;
        }

        try {
            const result =
                audio.play();

            if (
                result &&
                typeof result.then === "function"
            ) {
                await result;
            }

            return true;
        } catch (error) {
            /*
             * Autoplay restrictions are expected on
             * some browsers. We do not crash the website.
             */
            debug(
                "Audio play blocked:",
                error
            );

            return false;
        }
    }


    async function startMusic1() {
        const music1 =
            state.audio.music1;

        const music2 =
            state.audio.music2;

        if (!music1) {
            return false;
        }

        /*
         * Absolute anti-overlap guarantee.
         */
        if (music2) {
            try {
                music2.pause();
                music2.currentTime = 0;
                music2.volume = 0;
            } catch {
                /* ignored */
            }
        }

        cancelAudioFade();

        const played =
            await safePlay(music1);

        if (!played) {
            return false;
        }

        state.audio.active = "music1";
        state.audio.music1Started = true;

        await fadeAudio(
            music1,
            music1.volume,
            CONFIG.audio.volumeMusic1,
            CONFIG.audio.music1FadeIn
        );

        return true;
    }


    async function stopMusic1() {
        const music1 =
            state.audio.music1;

        if (!music1) {
            return;
        }

        cancelAudioFade();

        const startVolume =
            safeNumber(
                music1.volume,
                CONFIG.audio.volumeMusic1
            );

        await fadeAudio(
            music1,
            startVolume,
            0,
            CONFIG.audio.music1FadeOut
        );

        try {
            music1.pause();
            music1.currentTime = 0;
        } catch {
            /* ignored */
        }

        if (
            state.audio.active === "music1"
        ) {
            state.audio.active = null;
        }
    }


    async function startMusic2() {
        const music1 =
            state.audio.music1;

        const music2 =
            state.audio.music2;

        if (!music2) {
            return false;
        }

        /*
         * HARD STOP music1 BEFORE music2.
         */
        if (music1) {
            try {
                music1.pause();
                music1.currentTime = 0;
                music1.volume = 0;
            } catch {
                /* ignored */
            }
        }

        cancelAudioFade();

        music2.volume = 0;

        const played =
            await safePlay(music2);

        if (!played) {
            return false;
        }

        state.audio.active = "music2";
        state.audio.music2Started = true;

        await fadeAudio(
            music2,
            0,
            CONFIG.audio.volumeMusic2,
            CONFIG.audio.music2FadeIn
        );

        return true;
    }


    async function transitionMusic1ToSilence() {
        await stopMusic1();

        /*
         * Deliberate silence.
         * This is part of Scene 9's emotional design,
         * not an accidental gap.
         */
        await wait(
            CONFIG.audio.silenceBeforeMusic2
        );
    }


    async function stopAllAudio() {
        cancelAudioFade();

        const tracks = [
            state.audio.music1,
            state.audio.music2
        ];

        tracks.forEach(audio => {
            if (!audio) return;

            try {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 0;
            } catch {
                /* ignored */
            }
        });

        state.audio.active = null;
    }


    /* =====================================================
       11. TYPING ENGINE
       ===================================================== */

    function cancelTyping() {
        state.typing.cancelled = true;

        if (state.typing.timer !== null) {
            clearTimeout(
                state.typing.timer
            );

            state.typing.timer = null;
        }

        if (
            state.typing.controller
        ) {
            try {
                state.typing.controller.abort();
            } catch {
                /* ignored */
            }
        }

        state.typing.controller = null;
        state.typing.active = false;
    }


    function randomBetween(min, max) {
        return (
            Math.random() *
            (max - min) +
            min
        );
    }


    function getTypingDelay(
        character,
        previousCharacter,
        emotional = false
    ) {
        const speed =
            emotional
                ? CONFIG.typing.emotionalSpeed
                : CONFIG.typing.defaultSpeed;

        let delay =
            randomBetween(
                speed.min,
                speed.max
            );

        /*
         * Natural typing rhythm.
         */
        if (character === ",") {
            delay +=
                CONFIG.typing
                    .punctuationPause
                    .comma;
        }

        if (character === ".") {
            delay +=
                CONFIG.typing
                    .punctuationPause
                    .period;
        }

        if (character === "!") {
            delay +=
                CONFIG.typing
                    .punctuationPause
                    .exclamation;
        }

        if (character === "?") {
            delay +=
                CONFIG.typing
                    .punctuationPause
                    .question;
        }

        if (character === "…") {
            delay +=
                CONFIG.typing
                    .punctuationPause
                    .ellipsis;
        }

        if (
            character === "\n"
        ) {
            delay +=
                CONFIG.typing
                    .punctuationPause
                    .newline;
        }

        /*
         * Slightly longer pauses after paragraph endings.
         */
        if (
            previousCharacter === "\n" &&
            character === "\n"
        ) {
            delay += 160;
        }

        return delay;
    }


    async function typeText(
        element,
        text,
        options = {}
    ) {
        if (!isElement(element)) {
            return false;
        }

        cancelTyping();

        state.typing.cancelled = false;
        state.typing.active = true;

        state.typing.controller =
            new AbortController();

        const {
            emotional = false,
            clear = true,
            scrollIntoView = false
        } = options;

        if (clear) {
            element.textContent = "";
        }

        const source =
            String(text ?? "");

        /*
         * Preserve whitespace/newlines exactly.
         */
        for (
            let index = 0;
            index < source.length;
            index++
        ) {
            if (
                state.typing.cancelled
            ) {
                state.typing.active = false;
                return false;
            }

            const character =
                source[index];

            const previous =
                source[index - 1] || "";

            element.textContent +=
                character;

            if (
                scrollIntoView &&
                character === "\n"
            ) {
                /*
                 * Do not violently jump the whole page.
                 * Only gently reveal the typing area.
                 */
                try {
                    element.scrollIntoView({
                        block: "nearest",
                        behavior: "smooth"
                    });
                } catch {
                    /* ignored */
                }
            }

            const delay =
                getTypingDelay(
                    character,
                    previous,
                    emotional
                );

            await new Promise(resolve => {
                state.typing.timer =
                    setTimeout(
                        resolve,
                        delay
                    );
            });
        }

        state.typing.timer = null;
        state.typing.active = false;

        return true;
    }


    function findScene8TypingTarget() {
        const scene8 =
            getScene(8);

        if (!scene8) {
            return null;
        }

        return $(
            CONFIG.selectors.typingTarget,
            scene8
        );
    }


    /*
     * If HTML stores the letter inside a data attribute,
     * this function can use it.
     *
     * Examples:
     * data-typing="true"
     * data-typing-text="..."
     */
    function getTypingSource(element) {
        if (!isElement(element)) {
            return "";
        }

        const fromAttribute =
            element.getAttribute(
                "data-typing-text"
            );

        if (fromAttribute !== null) {
            return fromAttribute;
        }

        /*
         * <template data-letter>
         */
        const template =
            element.querySelector(
                "template[data-letter]"
            );

        if (template) {
            return template.innerHTML
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]*>/g, "")
                .trim();
        }

        return element.textContent || "";
    }


    async function runScene8Typing() {
        const target =
            findScene8TypingTarget();

        if (!target) {
            debug(
                "Scene 8 typing target not found."
            );

            return;
        }

        /*
         * If the element has a dedicated source,
         * preserve it before clearing.
         */
        let source =
            getTypingSource(target);

        /*
         * If there is already an external original
         * text cache, prefer that.
         */
        if (
            target.dataset.originalText
        ) {
            source =
                target.dataset.originalText;
        } else {
            target.dataset.originalText =
                source;
        }

        /*
         * If HTML is already visually populated and
         * no typing source exists, do not erase it.
         */
        if (!source.trim()) {
            return;
        }

        /*
         * Scene 8 should not instantly slam the user
         * into a massive block of text.
         */
        await wait(420);

        await typeText(
            target,
            source,
            {
                emotional: true,
                clear: true,
                scrollIntoView: false
            }
        );
    }


    /* =====================================================
       12. SCENE-SPECIFIC LIFECYCLE
       ===================================================== */

    async function beforeLeaveScene(
        sceneNumber
    ) {
        /*
         * Stop typing if leaving Scene 8.
         */
        if (sceneNumber === 8) {
            cancelTyping();
        }
    }


    async function afterEnterScene(
        sceneNumber,
        previousScene
    ) {
        /*
         * Scene 2:
         * music1 begins ONLY when entering Scene 2.
         *
         * Normally this is already triggered by the
         * navigation transaction from Scene 1.
         */
        if (sceneNumber === 2) {
            /*
             * Do not call startMusic1 here blindly.
             * The navigation transaction handles it because
             * it retains the original user gesture.
             */
        }

        /*
         * Scene 8:
         * prepare and start typing.
         */
        if (sceneNumber === 8) {
            runScene8Typing();
        }

        /*
         * Scene 9:
         * music1 is already stopped by the transition
         * transaction before this scene becomes visible.
         */
        if (sceneNumber === 9) {
            /*
             * Deliberately quiet.
             */
        }

        /*
         * Scene 10:
         * music2 begins only after music1 has been completely
         * stopped and the silence interval has passed.
         */
        if (
            sceneNumber === 10 &&
            previousScene === 9
        ) {
            /*
             * This is intentionally handled by
             * goToScene() so audio and scene timing stay
             * synchronized.
             */
        }

        initializeSceneInteractions(
            sceneNumber
        );
    }


    /* =====================================================
       13. INTERACTIVE ELEMENTS
       ===================================================== */

    function initializeSceneInteractions(
        sceneNumber
    ) {
        const scene =
            getScene(sceneNumber);

        if (!scene) {
            return;
        }

        /*
         * Generic reveal triggers.
         *
         * Supports existing structures such as:
         * data-reveal-target="#something"
         * data-toggle-target="#something"
         */
        $$(
            "[data-reveal-target], [data-toggle-target]",
            scene
        ).forEach(trigger => {
            if (
                state.interactions
                    .activatedElements
                    .has(trigger)
            ) {
                return;
            }

            state.interactions
                .activatedElements
                .add(trigger);

            trigger.addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const selector =
                        trigger.getAttribute(
                            "data-reveal-target"
                        ) ||
                        trigger.getAttribute(
                            "data-toggle-target"
                        );

                    if (!selector) {
                        return;
                    }

                    const target =
                        $(selector, scene) ||
                        $(selector);

                    if (!target) {
                        return;
                    }

                    const isHidden =
                        target.hidden ||
                        target.classList.contains(
                            "hidden"
                        ) ||
                        target.classList.contains(
                            "is-hidden"
                        );

                    target.hidden = !isHidden;

                    target.classList.toggle(
                        "hidden",
                        !isHidden
                    );

                    target.classList.toggle(
                        "is-hidden",
                        !isHidden
                    );

                    trigger.classList.toggle(
                        "is-open",
                        isHidden
                    );

                    trigger.setAttribute(
                        "aria-expanded",
                        String(isHidden)
                    );
                }
            );
        });
    }


    /* =====================================================
       14. BUTTON MICRO-INTERACTIONS
       ===================================================== */

    function initializeButtonMicroInteractions() {
        /*
         * Pointer-based effect.
         *
         * This does NOT replace CSS hover.
         * It gives CSS a small set of variables to work with.
         */
        document.addEventListener(
            "pointermove",
            event => {
                const target =
                    event.target;

                if (!isElement(target)) {
                    return;
                }

                const button =
                    target.closest(
                        "button, a, [role='button']"
                    );

                if (!button) {
                    return;
                }

                /*
                 * Avoid affecting navigation controls
                 * that are disabled.
                 */
                if (
                    button.disabled ||
                    button.getAttribute(
                        "aria-disabled"
                    ) === "true"
                ) {
                    return;
                }

                const rect =
                    button.getBoundingClientRect();

                if (
                    rect.width <= 0 ||
                    rect.height <= 0
                ) {
                    return;
                }

                const x =
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width;

                const y =
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height;

                const px =
                    clamp(
                        (x - 0.5) * 2,
                        -1,
                        1
                    );

                const py =
                    clamp(
                        (y - 0.5) * 2,
                        -1,
                        1
                    );

                button.style.setProperty(
                    "--pointer-x",
                    `${(x * 100).toFixed(2)}%`
                );

                button.style.setProperty(
                    "--pointer-y",
                    `${(y * 100).toFixed(2)}%`
                );

                button.style.setProperty(
                    "--pointer-tilt-x",
                    `${(py * -1.2).toFixed(2)}deg`
                );

                button.style.setProperty(
                    "--pointer-tilt-y",
                    `${(px * 1.2).toFixed(2)}deg`
                );
            },
            {
                passive: true
            }
        );


        /*
         * Pointer down/up gives a much more natural
         * tactile feeling than a giant scale animation.
         */
        document.addEventListener(
            "pointerdown",
            event => {
                const button =
                    event.target?.closest?.(
                        "button, a, [role='button']"
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


        const releaseButton =
            event => {
                const button =
                    event.target?.closest?.(
                        "button, a, [role='button']"
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
            releaseButton,
            { passive: true }
        );

        document.addEventListener(
            "pointercancel",
            releaseButton,
            { passive: true }
        );

        document.addEventListener(
            "pointerleave",
            releaseButton,
            { passive: true }
        );
    }


    /* =====================================================
       15. SCENE 1 → SCENE 2
       ===================================================== */

    function isOpeningButton(element) {
        if (!isElement(element)) {
            return false;
        }

        const text =
            (
                element.innerText ||
                element.textContent ||
                ""
            )
                .trim()
                .toLowerCase();

        return (
            text.includes(
                "bukaa duluuu"
            ) ||
            element.matches(
                "[data-open-story]"
            )
        );
    }


    /* =====================================================
       16. MAIN NAVIGATION TRANSACTION
       ===================================================== */

    async function goToScene(
        targetScene,
        options = {}
    ) {
        const target =
            normalizeSceneNumber(
                targetScene
            );

        if (!target) {
            warn(
                "Invalid target scene:",
                targetScene
            );

            return false;
        }

        const destination =
            getScene(target);

        if (!destination) {
            warn(
                "Scene does not exist:",
                target
            );

            return false;
        }

        /*
         * Prevent accidental duplicate navigation.
         */
        if (
            state.isTransitioning ||
            state.navigationLocked
        ) {
            debug(
                "Navigation ignored while busy."
            );

            return false;
        }

        if (
            target === state.currentScene
        ) {
            return false;
        }

        state.isTransitioning = true;
        state.navigationLocked = true;

        const token =
            ++state.transitionToken;

        const previous =
            state.currentScene;

        state.previousScene =
            previous;

        debug(
            `Scene ${previous} → Scene ${target}`
        );

        try {
            /*
             * =============================================
             * PHASE A
             * Prepare outgoing scene
             * =============================================
             */

            await beforeLeaveScene(
                previous
            );

            /*
             * =============================================
             * PHASE B
             * Special audio logic BEFORE visual change
             * =============================================
             *
             * Scene 9:
             * music1 must die before Scene 9 becomes
             * emotionally quiet.
             *
             * Scene 10:
             * music1 must already be stopped before music2.
             */

            let requiresMusic2 =
                target === 10 &&
                previous === 9;

            if (
                target === 9 &&
                previous === 8
            ) {
                await transitionMusic1ToSilence();
            }

            if (
                requiresMusic2
            ) {
                /*
                 * Absolute safety:
                 * stop music1 before any possibility
                 * of music2 playback.
                 */
                await stopMusic1();

                await wait(
                    CONFIG.audio
                        .silenceBeforeMusic2
                );
            }

            /*
             * =============================================
             * PHASE C
             * Transition OUT
             * =============================================
             */

            const outSuccess =
                await transitionOut(
                    token
                );

            if (!outSuccess) {
                throw new Error(
                    "Transition token invalidated."
                );
            }

            /*
             * =============================================
             * PHASE D
             * Switch scene
             * =============================================
             */

            const oldScene =
                getScene(previous);

            if (oldScene) {
                prepareSceneElement(
                    oldScene,
                    false
                );
            }

            prepareSceneElement(
                destination,
                true
            );

            /*
             * Force browser to acknowledge scene change
             * before visual transition back in.
             */
            await nextFrame();

            /*
             * Reset only scene-local scroll positions.
             * This is important for Scene 8.
             */
            resetSceneScroll(
                destination,
                target
            );

            /*
             * =============================================
             * PHASE E
             * Scene-specific audio
             * =============================================
             */

            /*
             * Scene 1 → 2:
             * Start music1 from the same click gesture.
             */
            if (
                target === 2 &&
                previous === 1
            ) {
                /*
                 * We intentionally await play before
                 * transition-in finishes.
                 */
                startMusic1();
            }

            /*
             * Scene 10:
             * music2 starts only now.
             */
            if (
                requiresMusic2
            ) {
                await startMusic2();
            }

            /*
             * =============================================
             * PHASE F
             * Scene-specific setup
             * =============================================
             */

            await afterEnterScene(
                target,
                previous
            );

            /*
             * =============================================
             * PHASE G
             * Transition IN
             * =============================================
             */

            await transitionIn(
                token
            );

            /*
             * =============================================
             * PHASE H
             * Commit
             * =============================================
             */

            state.currentScene =
                target;

            updateSceneMetadata(
                target
            );

            return true;

        } catch (error) {
            console.error(
                "[BOLU UBI] Scene transition failed:",
                error
            );

            /*
             * Safety recovery:
             * ensure at least one scene remains visible.
             */
            recoverSceneState(
                previous,
                target
            );

            return false;

        } finally {
            /*
             * Tiny breathing room prevents a double-click
             * from immediately starting another transition.
             */
            await wait(80);

            state.isTransitioning =
                false;

            state.navigationLocked =
                false;
        }
    }


    /* =====================================================
       17. SCROLL HANDLING
       ===================================================== */

    function resetSceneScroll(
        scene,
        sceneNumber
    ) {
        if (!scene) {
            return;
        }

        /*
         * Scene 8 should start from the beginning when
         * first entered.
         *
         * We do not force every arbitrary descendant to
         * scroll; only likely scene containers.
         */
        const scrollables = [
            scene
        ];

        if (sceneNumber === 8) {
            $$(
                ".scene-content, " +
                ".scene-inner, " +
                ".letter, " +
                ".letter-content, " +
                "[data-scroll-container]",
                scene
            ).forEach(element => {
                scrollables.push(element);
            });
        }

        scrollables.forEach(element => {
            try {
                element.scrollTop = 0;
            } catch {
                /* ignored */
            }
        });
    }


    /*
     * Absolutely NO wheel-to-scene navigation.
     *
     * We only use wheel events to protect nested scroll
     * containers from accidental scene navigation if an
     * older version of the project had such behavior.
     */
    function disableWheelSceneNavigation() {
        /*
         * Intentionally empty.
         *
         * This function exists as a guardrail/documentation.
         * There is no global wheel listener.
         */
    }


    /* =====================================================
       18. METADATA / ACCESSIBILITY
       ===================================================== */

    function updateSceneMetadata(sceneNumber) {
        document.documentElement.dataset.scene =
            String(sceneNumber);

        document.body.dataset.scene =
            String(sceneNumber);

        document.body.classList.forEach(
            className => {
                if (
                    /^scene-\d+$/.test(
                        className
                    )
                ) {
                    document.body.classList.remove(
                        className
                    );
                }
            }
        );

        document.body.classList.add(
            `scene-${sceneNumber}`
        );

        /*
         * Optional document title remains personal.
         */
        document.title =
            "Bolu Ubi 🐣";
    }


    /* =====================================================
       19. RECOVERY
       ===================================================== */

    function recoverSceneState(
        previousScene,
        targetScene
    ) {
        const previous =
            getScene(previousScene);

        const target =
            getScene(targetScene);

        /*
         * Prefer the previous scene if the transition failed.
         */
        state.scenes.forEach(item => {
            prepareSceneElement(
                item.element,
                item.number === previousScene
            );
        });

        if (previous) {
            prepareSceneElement(
                previous,
                true
            );
        }

        if (
            target &&
            target !== previous
        ) {
            prepareSceneElement(
                target,
                false
            );
        }

        /*
         * Restore audio consistency.
         */
        if (
            state.audio.active === "music2" &&
            previousScene < 10
        ) {
            try {
                state.audio.music2.pause();
                state.audio.music2.currentTime = 0;
                state.audio.music2.volume = 0;
            } catch {
                /* ignored */
            }

            state.audio.active = null;
        }

        debug(
            "Navigation state recovered."
        );
    }


    /* =====================================================
       20. GLOBAL CLICK DELEGATION
       ===================================================== */

    function handleNavigationClick(event) {
        if (
            event.defaultPrevented
        ) {
            return;
        }

        /*
         * Find the actual interactive ancestor.
         *
         * This is especially important when the button
         * contains spans/icons/text wrappers.
         */
        const clicked =
            event.target;

        if (!isElement(clicked)) {
            return;
        }

        const control =
            clicked.closest(
                CONFIG.selectors.navigation
            );

        if (!control) {
            return;
        }

        /*
         * Ignore controls that are explicitly disabled.
         */
        if (
            control.disabled ||
            control.getAttribute(
                "aria-disabled"
            ) === "true"
        ) {
            return;
        }

        /*
         * Do not intercept external links.
         */
        const href =
            control.getAttribute("href");

        if (
            href &&
            !href.startsWith("#") &&
            !href.startsWith("javascript:")
        ) {
            return;
        }

        /*
         * =============================================
         * SCENE 1 OPENING
         * =============================================
         *
         * This is intentionally detected BEFORE target
         * resolution because it is the first trusted
         * user gesture that unlocks audio playback.
         */

        if (
            state.currentScene === 1 &&
            isOpeningButton(control)
        ) {
            event.preventDefault();

            /*
             * Start music1 immediately from this exact
             * user gesture context.
             *
             * We intentionally don't wait for the scene
             * transition before requesting play().
             */
            startMusic1();

            goToScene(2, {
                source: control,
                reason: "opening"
            });

            return;
        }

        /*
         * =============================================
         * NORMAL SCENE NAVIGATION
         * =============================================
         */

        const target =
            resolveNavigationTarget(
                control
            );

        /*
         * If the button has no known scene target,
         * leave it alone. This is important because Scene 4
         * and Scene 5 have local interactive buttons that
         * should NOT accidentally navigate.
         */
        if (target === null) {
            return;
        }

        event.preventDefault();

        /*
         * Scene 8 special safeguard.
         */
        if (
            state.currentScene === 8 &&
            target === 9
        ) {
            /*
             * There is intentionally no separate special
             * implementation here.
             *
             * It goes through the SAME central transaction.
             * That is what fixes the previous architecture
             * where Scene 8 could bypass the main navigation.
             */
            goToScene(
                9,
                {
                    source: control,
                    reason: "scene8-next"
                }
            );

            return;
        }

        goToScene(
            target,
            {
                source: control,
                reason: "navigation"
            }
        );
    }


    /* =====================================================
       21. KEYBOARD NAVIGATION
       ===================================================== */

    function handleKeyboardNavigation(event) {
        /*
         * Enter/Space should naturally activate native
         * buttons. We only provide keyboard scene navigation
         * for explicitly marked navigation controls.
         */
        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {
            return;
        }

        const target =
            event.target;

        if (!isElement(target)) {
            return;
        }

        if (
            !isInteractiveElement(target)
        ) {
            return;
        }

        /*
         * Native button behavior already handles itself.
         */
        if (
            target.tagName === "BUTTON"
        ) {
            return;
        }

        const destination =
            resolveNavigationTarget(
                target
            );

        if (destination === null) {
            return;
        }

        event.preventDefault();

        goToScene(
            destination,
            {
                source: target,
                reason: "keyboard"
            }
        );
    }


    /* =====================================================
       22. TOUCH SAFETY
       ===================================================== */

    function initializeTouchSafety() {
        /*
         * We deliberately do NOT attach swipe-to-scene
         * navigation.
         *
         * This prevents Scene 8's long letter from fighting
         * with touch scrolling.
         */

        document.addEventListener(
            "touchstart",
            event => {
                if (
                    event.touches.length > 1
                ) {
                    return;
                }

                const target =
                    event.target;

                if (!isElement(target)) {
                    return;
                }

                /*
                 * Allow normal touch scrolling.
                 */
            },
            {
                passive: true
            }
        );
    }


    /* =====================================================
       23. VIEWPORT MANAGEMENT
       ===================================================== */

    function updateViewportVariables() {
        const width =
            window.innerWidth;

        const height =
            window.innerHeight;

        state.viewport.width =
            width;

        state.viewport.height =
            height;

        document.documentElement
            .style
            .setProperty(
                "--viewport-width",
                `${width}px`
            );

        document.documentElement
            .style
            .setProperty(
                "--viewport-height",
                `${height}px`
            );
    }


    function initializeViewport() {
        updateViewportVariables();

        let resizeTimer = null;

        window.addEventListener(
            "resize",
            () => {
                clearTimeout(
                    resizeTimer
                );

                resizeTimer =
                    setTimeout(
                        updateViewportVariables,
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
                setTimeout(
                    updateViewportVariables,
                    180
                );
            },
            {
                passive: true
            }
        );
    }


    /* =====================================================
       24. IMAGE SAFETY
       ===================================================== */

    function initializeImageSafety() {
        $$("img").forEach(image => {
            image.addEventListener(
                "error",
                () => {
                    image.classList.add(
                        "image-load-error"
                    );

                    /*
                     * Don't collapse layout when an image
                     * fails to load.
                     */
                    image.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                },
                {
                    once: true
                }
            );
        });
    }


    /* =====================================================
       25. REDUCED MOTION
       ===================================================== */

    function prefersReducedMotion() {
        return (
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        );
    }


    function initializeMotionPreference() {
        if (
            prefersReducedMotion()
        ) {
            document.documentElement
                .classList
                .add(
                    "reduced-motion"
                );
        }
    }


    /* =====================================================
       26. DOCUMENT VISIBILITY
       ===================================================== */

    function initializeVisibilityHandling() {
        document.addEventListener(
            "visibilitychange",
            () => {
                /*
                 * We do NOT reset the story when the user
                 * switches tabs.
                 *
                 * Browser audio policies may pause audio
                 * automatically; that is acceptable.
                 */
                if (
                    document.hidden
                ) {
                    cancelTyping();
                }
            }
        );
    }


    /* =====================================================
       27. BEFORE UNLOAD CLEANUP
       ===================================================== */

    function initializeCleanup() {
        window.addEventListener(
            "beforeunload",
            () => {
                cancelTyping();
                stopAllAudio();
            }
        );
    }


    /* =====================================================
       28. PUBLIC API
       ===================================================== */

    function exposeDebugAPI() {
        /*
         * Useful while developing.
         *
         * Does not affect normal website behavior.
         */
        window.BoluUbi = {
            version: "2.0.0",

            get currentScene() {
                return state.currentScene;
            },

            get isTransitioning() {
                return state.isTransitioning;
            },

            goToScene,

            nextScene() {
                const next =
                    state.currentScene + 1;

                if (
                    next <= CONFIG.totalScenes
                ) {
                    return goToScene(next);
                }

                return Promise.resolve(
                    false
                );
            },

            previousScene() {
                const previous =
                    state.currentScene - 1;

                if (previous >= 1) {
                    return goToScene(previous);
                }

                return Promise.resolve(
                    false
                );
            },

            startMusic1,
            stopMusic1,
            startMusic2,
            stopAllAudio,

            cancelTyping,

            state
        };
    }


    /* =====================================================
       29. INITIALIZATION
       ===================================================== */

    function initialize() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;

        debug(
            "Initializing Bolu Ubi experience..."
        );

        /*
         * Order matters.
         */

        discoverScenes();

        initializeSceneVisibility();

        createTransitionOverlay();

        initializeAudio();

        initializeViewport();

        initializeMotionPreference();

        initializeImageSafety();

        initializeTouchSafety();

        initializeVisibilityHandling();

        initializeCleanup();

        initializeButtonMicroInteractions();

        document.addEventListener(
            "click",
            handleNavigationClick
        );

        document.addEventListener(
            "keydown",
            handleKeyboardNavigation
        );

        /*
         * Scene-specific repairs after all systems exist.
         */
        repairSceneEightNavigation();

        disableWheelSceneNavigation();

        updateSceneMetadata(
            state.currentScene
        );

        initializeSceneInteractions(
            state.currentScene
        );

        exposeDebugAPI();

        debug(
            "Initialization complete."
        );
    }


    /* =====================================================
       30. DOM READY
       ===================================================== */

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