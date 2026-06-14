import { LEVELS, STAGES } from './data/stages.js';
import { completedStages, totalPoints, highestStreak, tutorialComplete, setTutorialComplete, timedBest, saveTimedBest, markStageCompleted, unlockAchievement, unlockedAchievements, achievementProgress, learnStreak, updateLearnStreak, updateDailyStreak, setSyncHook, applyRemoteProgress } from './data/storage.js';
import { initSync, signIn, signUp, signOut, schedulePush, submitFeedback } from './data/sync.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, PLAY_CATEGORIES } from './data/achievements.js';
import { generateMatrices, formatAngleGate, getOccupiedQubits, canFit, GATE_MATRICES } from './quantum/gates.js';
import { computeStateVector, stateToString, statesMatch, computeVariationalState, computeExpectation, computeFidelity } from './quantum/engine.js';
import { toggleAllGates, getColumnHTML, renderDynamicCanvases, updateBlochSpheres, updateBlochSpheresFromState, hideVictoryModal, showVictoryModal, showInfoModal, hideInfoModal, nextTourStep, endTour, setGhostPointer, clearGhostPointer, parseMarkdownAndMath, updateTargetBlochSphere, updateTimedStatusBar, showDuelChallengeBanner, showPlayChallengeBanner, showDailyChallengeBanner, showAchievementToast, renderAchievementsPanel, renderLearnAchievements, showTutorialPrompt, fireQuantumConfetti, fireSectionConfetti, showRevealCircuit } from './game/ui.js';
import { handleCellTap, updateActiveRow } from './game/dragdrop.js';
import { submitGuess } from './game/validator.js';
import { trackSessionStart, trackGameStart, trackHintViewed, trackLessonViewed, trackTutorialSkipped, trackSectionComplete } from './data/analytics.js';
import {
    LAB_CONFIGS, QFT_LAB_CONFIGS, LAB_HINTS,
    initLabMode, initQftLabMode,
    selectLabNumber, selectQftInput,
    stopLabPlay, toggleQftLabPlay, toggleAdderLabPlay,
    toggleGroverLabPlay, showGroverLab, showQftExplanation, showBlochExplorerLab
} from './game/labs.js';

export let gameStartTime = 0;
let tutorialPromptShown = false;
let _isSignedIn = false;

// --- Global Application State ---
export const state = {
    currentMode: '',
    currentLvl: 1,
    currentP1: 0,
    currentP2: 0,
    numQubits: 1,
    numCols: 4,
    activeSet: [],
    secretCircuits: [],
    targetState: [],
    currentGuess: [],
    attempts: 0,
    gameOver: false,
    currentRzAngle: 'PI',
    currentStreak: 0,
    selectedBaseGate: null, 
    placement: { active: false, col: null, controls: [] },
    isTutorial: false,
    tutorialPhase: 'NONE',
    tutorialJustCompleted: false,
    timerRemaining: 0,
    _timerIntervalId: null,
    timedScore: 0,
    timedCircuitsSolved: 0,
    timedCircuitIndex: 0,
    timedNextPuzzle: null,
    timedEndSession: null,
    _timedSessionEnded: false,
    labTargetN: 0,
    labFromP2: 0,
    qftLabFromP2: 0,
    isDuelMode: false,
    duelSeed: 0,
    duelOpponentScore: 0,
    duelOpponentName: 'Challenger',
    randomSeed: 0,
    randomGateMask: 0,
    _usePresetSeed: false,
    quizScore: 0,
    quizTotal: 5,
    quizCurrentQ: 0,
    _quizSIdx: 0,
    _quizSessionSeed: 0,
    _quizContinuing: false,
    quizLives: 3,
    _quizQueue: [],
    _quizCurrentLevelIdx: 0,
    _quizCurrentSIdx: 0,
};

// ── URL Router ───────────────────────────────────────────────────────────────
let _routerNavigating = false;

function pushRoute(hash) {
    if (_routerNavigating) return;
    history.pushState(null, '', location.pathname + location.search + hash);
}

function handleRoute(hash) {
    _routerNavigating = true;
    window.stopLabPlay?.();
    document.getElementById('back-to-results-btn')?.classList.add('hidden');
    const parts = (hash || '#/').replace(/^#\//, '').split('/');
    const seg = parts[0] || '';
    const p1  = parseInt(parts[1] ?? '0');
    const p2  = Math.max(0, parseInt(parts[2] ?? '1') - 1);  // URL is 1-based
    if (!seg) {
        showMainMenu();
    } else if (seg === 'stages') {
        if (parts[1]) showSectionDetail(parts[1]);
        else showStagesPage();
    } else if (seg === 'play') {
        showPlayPage();
    } else if (seg === 'learn') {
        initGame('STAGE', p1, p2);
    } else if (seg === 'random') {
        initGame('RANDOM', p1);
    } else if (seg === 'daily') {
        initGame('DAILY', p1);
    } else if (seg === 'timed') {
        initGame('TIMED', p1);
    } else if (seg === 'sandbox') {
        initGame('FREEPLAY', p1);
    } else {
        showMainMenu();
    }
    _routerNavigating = false;
}

window.addEventListener('hashchange', () => handleRoute(location.hash));
// ─────────────────────────────────────────────────────────────────────────────

// --- Expose Global Hooks for dynamically created DOM elements ---
window.showHint = () => {
    trackHintViewed(state.currentMode, state.currentP1, state.currentP2, state.currentLvl);
    document.getElementById('hint-text').classList.remove('hidden');
    document.getElementById('hint-btn').classList.add('hidden');
};
window.showLesson = () => {
    trackLessonViewed(state.currentMode, state.currentP1, state.currentP2, state.currentLvl);
    document.getElementById('lesson-text').classList.remove('hidden');
    document.getElementById('lesson-text').innerHTML = parseMarkdownAndMath(document.getElementById('lesson-text').innerHTML);
    document.getElementById('lesson-btn').classList.add('hidden');
};
window.tryQftLab = () => { state.qftLabFromP2 = state.currentP2; window.initQftLab(0); };
window.tryAdderLab = () => { state.labFromP2 = state.currentP2; window.initLabGame(1); };


// A lightweight seeded PRNG
function getSeededRandom(seed) {
    return function() {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function shuffleArray(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// A local version of the angle formatter that accepts our custom RNG
function formatAngleGateSeeded(gNext, rng) {
    if (gNext.startsWith('RZ') || gNext.startsWith('CP')) {
        let angles = ['PI', 'PI2', 'PI4', 'PI8', 'MINUS_PI2', 'MINUS_PI4', 'MINUS_PI8'];
        let randAngle = angles[Math.floor(rng() * angles.length)];
        let prefix = gNext.startsWith('RZ') ? 'RZ' : 'CP';
        let qSuffix = gNext.startsWith('RZ') ? gNext.slice(-1) : gNext.slice(-2);
        return `${prefix}_${randAngle}_${qSuffix}`;
    }
    return gNext;
}

function showHome() {
    document.getElementById('menu-home').classList.remove('hidden');
    document.getElementById('menu-stages').classList.add('hidden');
    document.getElementById('menu-play-page').classList.add('hidden');
    document.getElementById('menu-section-detail').classList.add('hidden');
}

function showStagesPage() {
    pushRoute('#/stages');
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    state.isDuelMode = false;
    buildMenu();
    buildSectionsOverview();
    renderLearnAchievements(unlockedAchievements, achievementProgress);

    // Update learn streak banner
    const _lsBanner = document.getElementById('learn-streak-banner');
    if (_lsBanner) {
        if (learnStreak > 0) {
            _lsBanner.textContent = `🔥 ${learnStreak}-day learning streak`;
            _lsBanner.classList.remove('hidden');
        } else {
            _lsBanner.classList.add('hidden');
        }
    }

    // Update learn achievements count in summary
    const _learnAchs = ACHIEVEMENTS.filter(a => ['Getting Started', 'Learning'].includes(a.category));
    const _learnUnlocked = _learnAchs.filter(a => unlockedAchievements.has(a.id)).length;
    const _learnCount = document.getElementById('learn-ach-count');
    if (_learnCount) _learnCount.textContent = `${_learnUnlocked} / ${_learnAchs.length}`;

    document.getElementById('menu-home').classList.add('hidden');
    document.getElementById('menu-stages').classList.remove('hidden');
    document.getElementById('menu-play-page').classList.add('hidden');
    document.getElementById('menu-section-detail').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showStagesPage = showStagesPage;

function showPlayPage() {
    pushRoute('#/play');
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    state.isDuelMode = false;
    buildMenu();
    document.getElementById('menu-home').classList.add('hidden');
    document.getElementById('menu-stages').classList.add('hidden');
    document.getElementById('menu-play-page').classList.remove('hidden');
    document.getElementById('menu-section-detail').classList.add('hidden');
    showModeCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showPlayPage = showPlayPage;

function showMainMenu() {
    pushRoute('#/');
    document.getElementById('game-view').style.display = 'none';
    state.isDuelMode = false;
    buildMenu();
    document.getElementById('main-menu').style.display = 'flex';
    showHome();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (state.tutorialJustCompleted) {
        state.tutorialJustCompleted = false;
        setTimeout(() => {
            const learnBtn = document.getElementById('btn-go-learn');
            if (learnBtn) {
                learnBtn.classList.add('ghost-pulse');
                learnBtn.style.position = 'relative';
                const msg = document.createElement('div');
                msg.className = 'ghost-text';
                msg.innerText = 'Start your quantum journey here!';
                learnBtn.appendChild(msg);
                setTimeout(() => {
                    learnBtn.classList.remove('ghost-pulse');
                    learnBtn.style.position = '';
                    msg.remove();
                }, 5000);
            }
        }, 400);
    }
}

// ── Section Data & Rendering Helpers ────────────────────────────────────────
const SECTION_STYLES = {
    'Foundations':          { color: '#3b82f6', bg: 'rgba(59,130,246,0.13)',  icon: '🧩' },
    'Multi-Qubit Gates':    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.13)', icon: '🔗' },
    'Quantum Protocols':    { color: '#06b6d4', bg: 'rgba(6,182,212,0.13)',   icon: '🔬' },
    'Phase & QFT':          { color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  icon: '🌀' },
    'Quantum Algorithms':   { color: '#22c55e', bg: 'rgba(34,197,94,0.13)',   icon: '🔍' },
    'Variational Algorithms':{ color: '#f97316', bg: 'rgba(249,115,22,0.13)', icon: '⚡' },
};

// A stage "owns" a quiz node when it has >1 level, or is the last in a run of
// single-level stages (so single-level stages fold into the next multi-level stage's quiz).
function hasOwnQuizNode(sIdx) {
    if (STAGES[sIdx].levels.length > 1) return true;
    const next = sIdx + 1;
    return next >= STAGES.length || STAGES[next].levels.length > 1;
}

// Returns [{sIdx, lIdx}] pool of all levels contributing to the quiz for sIdx,
// including any preceding consecutive single-level stages absorbed into this quiz.
function getQuizStagePool(sIdx) {
    const chain = [sIdx];
    let i = sIdx - 1;
    while (i >= 0 && STAGES[i].levels.length === 1 && !hasOwnQuizNode(i)) {
        chain.unshift(i);
        i--;
    }
    const pool = [];
    chain.forEach(s => STAGES[s].levels.forEach((_, l) => pool.push({ sIdx: s, lIdx: l })));
    return pool;
}

function sectionSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
}

function computeSectionGroups() {
    const groups = [];
    STAGES.forEach((stage, sIdx) => {
        const last = groups[groups.length - 1];
        if (!last || last.name !== stage.section) {
            const style = SECTION_STYLES[stage.section] || { color: '#64748b', bg: 'rgba(100,116,139,0.13)', icon: '●' };
            groups.push({ name: stage.section, slug: sectionSlug(stage.section), style, stages: [] });
        }
        groups[groups.length - 1].stages.push({ stage, sIdx });
    });
    return groups;
}

function makeIsNodeUnlocked() {
    const completedQuizzes = new Set(JSON.parse(localStorage.getItem('quarks_quizzes') || '[]'));
    const groups = computeSectionGroups();
    const sectionBySIdx = new Map();
    groups.forEach((sec, secIdx) => sec.stages.forEach(({ sIdx }) => sectionBySIdx.set(sIdx, secIdx)));

    const allNodes = [];
    STAGES.forEach((stage, sIdx) => stage.levels.forEach((_, lIdx) => allNodes.push({ sIdx, lIdx })));
    const map = new Map(allNodes.map(({ sIdx, lIdx }, i) => [`${sIdx}-${lIdx}`, i]));

    return (sIdx, lIdx) => {
        const i = map.get(`${sIdx}-${lIdx}`);
        if (i === undefined) return false;
        if (i === 0) return true;
        const prev = allNodes[i - 1];
        if (!completedStages.includes(`${prev.sIdx}-${prev.lIdx}`)) return false;
        // Cross-section transition: all quizzes of the previous section must be done
        if (sectionBySIdx.get(prev.sIdx) !== sectionBySIdx.get(sIdx)) {
            const prevSec = groups[sectionBySIdx.get(prev.sIdx)];
            if (!prevSec.stages.every(({ sIdx: s }) => completedQuizzes.has(s))) return false;
        }
        return true;
    };
}

function buildSnakeMapEl(sec, isNodeUnlocked) {
    const NODES_PER_ROW = 3, X_POS = [20, 50, 80], NODE_R = 22, ROW_H = 96, PAD_TOP = 20;
    const ns = 'http://www.w3.org/2000/svg';
    let y = PAD_TOP, nodeInRow = 0, rowDir = 1;
    const nodes = [], pathPts = [];
    const completedQuizzes = JSON.parse(localStorage.getItem('quarks_quizzes') || '[]');

    function placeNode(nodeData) {
        const xIdx = rowDir > 0 ? nodeInRow : (NODES_PER_ROW - 1 - nodeInRow);
        nodeData.nx = X_POS[xIdx];
        nodeData.ny = y + NODE_R;
        nodes.push(nodeData);
        if (nodeData.unlocked) pathPts.push({ x: nodeData.nx, y: nodeData.ny });
        nodeInRow++;
        if (nodeInRow >= NODES_PER_ROW) { nodeInRow = 0; rowDir = -rowDir; y += ROW_H; }
    }

    sec.stages.forEach(({ stage, sIdx }) => {
        stage.levels.forEach((lvl, lIdx) => {
            const done = completedStages.includes(`${sIdx}-${lIdx}`);
            const unlocked = done || isNodeUnlocked(sIdx, lIdx);
            placeNode({ done, unlocked, sIdx, lIdx, name: lvl.name, isQuiz: false });
        });

        if (hasOwnQuizNode(sIdx)) {
            const pool = getQuizStagePool(sIdx);
            const allPoolLevelsDone = pool.every(({ sIdx: s, lIdx: l }) => completedStages.includes(`${s}-${l}`));
            const quizDone = completedQuizzes.includes(sIdx);
            placeNode({ done: quizDone, unlocked: allPoolLevelsDone, sIdx, lIdx: -1, name: stage.title, isQuiz: true });
        }
    });
    if (nodeInRow > 0) y += ROW_H;
    const totalH = y + PAD_TOP;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 100 ${totalH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(totalH));
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;overflow:visible;';

    function drawPath(pts, stroke, width, opacity) {
        if (pts.length < 2) return;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i - 1], q = pts[i];
            if (p.y === q.y) d += ` L ${q.x} ${q.y}`;
            else if (p.x === q.x) { const b = p.x > 50 ? 20 : -20; d += ` C ${p.x+b} ${p.y} ${q.x+b} ${q.y} ${q.x} ${q.y}`; }
            else { const m = (p.y + q.y) / 2; d += ` C ${p.x} ${m} ${q.x} ${m} ${q.x} ${q.y}`; }
        }
        const el = document.createElementNS(ns, 'path');
        el.setAttribute('d', d); el.setAttribute('fill', 'none');
        el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', String(width));
        el.setAttribute('stroke-opacity', String(opacity));
        el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(el);
    }

    if (pathPts.length >= 2) {
        drawPath(pathPts, '#1e3a5f', 10, 1);
        drawPath(pathPts, '#334155', 6, 1);
        drawPath(pathPts, sec.style.color, 3, 0.7);
    }

    const mapEl = document.createElement('div');
    mapEl.className = 'learn-map';
    mapEl.style.height = `${totalH}px`;
    mapEl.appendChild(svg);

    nodes.forEach(item => {
        const dot = document.createElement('div');
        if (item.isQuiz) {
            dot.className = 'map-node-dot quiz-node' + (item.done ? ' done' : '') + (!item.unlocked ? ' locked' : '');
            dot.style.cssText = `left:${item.nx}%;top:${item.ny}px;--nc:${item.unlocked ? '#f59e0b' : '#1e293b'};`;
            dot.textContent = !item.unlocked ? '🔒' : '★';
            if (item.unlocked) dot.onclick = () => initGame('QUIZ', item.sIdx);
        } else {
            dot.className = 'map-node-dot' + (item.done ? ' done' : '') + (!item.unlocked ? ' locked' : '');
            dot.style.cssText = `left:${item.nx}%;top:${item.ny}px;--nc:${item.unlocked ? sec.style.color : '#1e293b'};`;
            if (item.done) dot.textContent = '✓';
            else if (!item.unlocked) dot.textContent = '🔒';
            if (item.unlocked) dot.onclick = () => initGame('STAGE', item.sIdx, item.lIdx);
        }
        mapEl.appendChild(dot);

        const lbl = document.createElement('div');
        lbl.className = 'map-node-label' + (item.done ? ' done' : '') + (!item.unlocked ? ' locked' : '') + (item.isQuiz ? ' quiz-label' : '');
        lbl.style.cssText = `left:${item.nx}%;top:${item.ny + 22 + 5}px;`;
        lbl.textContent = item.isQuiz ? 'Quiz ★' : item.name.replace(/^[\d\.]+[\.:]?\s*/, '');
        if (item.unlocked) lbl.onclick = () => item.isQuiz ? initGame('QUIZ', item.sIdx) : initGame('STAGE', item.sIdx, item.lIdx);
        mapEl.appendChild(lbl);
    });

    return mapEl;
}

function buildSectionsOverview() {
    const container = document.getElementById('stages-container');
    container.innerHTML = '';
    const groups = computeSectionGroups();
    const isNodeUnlocked = makeIsNodeUnlocked();

    const _gqCard = document.getElementById('global-quiz-card');
    if (_gqCard) _gqCard.classList.toggle('hidden', completedStages.length === 0);

    groups.forEach(sec => {
        const { sIdx: firstSIdx } = sec.stages[0];
        const locked = !completedStages.some(cs => cs.startsWith(`${firstSIdx}-`)) && !isNodeUnlocked(firstSIdx, 0);
        const totalLevels = sec.stages.reduce((s, { stage }) => s + stage.levels.length, 0);
        const doneLevels  = sec.stages.reduce((s, { stage, sIdx }) =>
            s + stage.levels.filter((_, lIdx) => completedStages.includes(`${sIdx}-${lIdx}`)).length, 0);
        const pct = totalLevels ? Math.round((doneLevels / totalLevels) * 100) : 0;

        const card = document.createElement('button');
        card.className = 'section-overview-card' + (locked ? ' locked' : '');
        card.disabled = locked;
        card.innerHTML = `
            <div class="soc-left">
                <span class="soc-icon">${locked ? '🔒' : sec.style.icon}</span>
                <div class="soc-info">
                    <span class="soc-name">${sec.name}</span>
                    <div class="soc-bar"><div class="soc-fill" style="width:${pct}%;background:${sec.style.color};"></div></div>
                </div>
            </div>
            <div class="soc-right">
                <span class="soc-count">${doneLevels}/${totalLevels}</span>
                ${locked ? '' : '<span class="soc-arrow">→</span>'}
            </div>`;
        if (!locked) card.addEventListener('click', () => showSectionDetail(sec.slug));
        container.appendChild(card);
    });
}

function showSectionDetail(slug) {
    pushRoute(`#/stages/${slug}`);
    const groups = computeSectionGroups();
    const sec = groups.find(g => g.slug === slug);
    if (!sec) { showStagesPage(); return; }

    const isNodeUnlocked = makeIsNodeUnlocked();
    const totalLevels = sec.stages.reduce((s, { stage }) => s + stage.levels.length, 0);
    const doneLevels  = sec.stages.reduce((s, { stage, sIdx }) =>
        s + stage.levels.filter((_, lIdx) => completedStages.includes(`${sIdx}-${lIdx}`)).length, 0);
    const pct = totalLevels ? Math.round((doneLevels / totalLevels) * 100) : 0;

    document.getElementById('section-detail-header').innerHTML = `
        <div class="sd-title" style="color:${sec.style.color};">${sec.style.icon} ${sec.name}</div>
        <div class="sd-progress-wrap">
            <div class="sd-bar"><div class="sd-fill" style="width:${pct}%;background:${sec.style.color};"></div></div>
            <span class="sd-count">${doneLevels} / ${totalLevels} levels complete</span>
        </div>`;

    const mapContainer = document.getElementById('section-detail-container');
    mapContainer.innerHTML = '';
    mapContainer.appendChild(buildSnakeMapEl(sec, isNodeUnlocked));

    document.getElementById('game-view').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('menu-home').classList.add('hidden');
    document.getElementById('menu-stages').classList.add('hidden');
    document.getElementById('menu-play-page').classList.add('hidden');
    document.getElementById('menu-section-detail').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showSectionDetail = showSectionDetail;

function showCurrentSection() {
    const groups = computeSectionGroups();
    const sec = groups.find(g => g.stages.some(({ sIdx }) => sIdx === state.currentP1));
    if (sec) showSectionDetail(sec.slug);
    else showStagesPage();
}
window.showCurrentSection = showCurrentSection;

let _promptFeedbackOnOverlayDismiss = false;

function showSectionCompleteOverlay() {
    const groups = computeSectionGroups();
    const currentSec = groups.find(g => g.stages.some(({ sIdx }) => sIdx === state.currentP1));
    if (!currentSec) { showCurrentSection(); return; }
    const nextSec = groups[groups.indexOf(currentSec) + 1] || null;

    if (groups.indexOf(currentSec) === 0 && !localStorage.getItem('quiver_feedback_prompted')) {
        _promptFeedbackOnOverlayDismiss = true;
    }

    const overlay = document.getElementById('section-complete-overlay');
    overlay.style.setProperty('--sco-color', currentSec.style.color);
    overlay.style.setProperty('--sco-bg', currentSec.style.bg);

    document.getElementById('sco-done-icon').textContent = currentSec.style.icon;
    document.getElementById('sco-done-name').textContent = currentSec.name;
    document.getElementById('sco-done-name').style.color = currentSec.style.color;

    const unlockWrap = document.getElementById('sco-unlock-wrap');
    const exploreBtn = document.getElementById('sco-explore-btn');

    if (nextSec) {
        unlockWrap.style.display = '';
        document.getElementById('sco-next-icon').textContent = nextSec.style.icon;
        document.getElementById('sco-next-name').textContent = nextSec.name;
        document.getElementById('sco-next-name').style.color = nextSec.style.color;
        exploreBtn.textContent = `Explore ${nextSec.name} →`;
        exploreBtn.style.background = nextSec.style.color;
        exploreBtn.onclick = () => { hideSectionCompleteOverlay(); showSectionDetail(nextSec.slug); };
    } else {
        unlockWrap.style.display = 'none';
        exploreBtn.textContent = '🎉 View All Sections';
        exploreBtn.style.background = currentSec.style.color;
        exploreBtn.onclick = () => { hideSectionCompleteOverlay(); showStagesPage(); };
    }

    document.getElementById('sco-back-btn').onclick = () => { hideSectionCompleteOverlay(); showCurrentSection(); };

    overlay.classList.remove('hidden');

    trackSectionComplete(currentSec.name);
    fireSectionConfetti();
}

function hideSectionCompleteOverlay() {
    document.getElementById('section-complete-overlay').classList.add('hidden');
    if (_promptFeedbackOnOverlayDismiss) {
        _promptFeedbackOnOverlayDismiss = false;
        localStorage.setItem('quiver_feedback_prompted', '1');
        setTimeout(() => window.showFeedbackModal('after_section_1'), 300);
    }
}

// ── Quiz Helpers ─────────────────────────────────────────────────────────────
window.startGlobalQuiz = function() {
    state._quizContinuing = false;
    initGame('QUIZ', -1);
};

function showQuizVictory() {
    const sIdx = state._quizSIdx;

    if (sIdx === -1) {
        updateLearnStreak();
        updateDailyStreak();
        showVictoryModal('Review Complete! ★', `${state.quizScore} / ${state.quizTotal} correct`, null, false, null);
        const menuBtn = document.getElementById('modal-menu-btn');
        if (menuBtn) menuBtn.textContent = 'Back to Sections';
        const nextBtn = document.getElementById('modal-next-btn');
        if (nextBtn) nextBtn.classList.add('hidden');
        const againBtn = document.getElementById('modal-again-btn');
        if (againBtn) againBtn.classList.add('hidden');
        return;
    }

    // Persist completion — also mark any absorbed single-level stages as quiz-done
    const quizzes = JSON.parse(localStorage.getItem('quarks_quizzes') || '[]');
    const pool = getQuizStagePool(sIdx);
    [...new Set(pool.map(e => e.sIdx))].forEach(s => { if (!quizzes.includes(s)) quizzes.push(s); });
    localStorage.setItem('quarks_quizzes', JSON.stringify(quizzes));
    schedulePush();

    // Detect section completion (all levels + all quizzes of the section done)
    state._sectionJustCompleted = false;
    const groups = computeSectionGroups();
    const currentSec = groups.find(g => g.stages.some(({ sIdx: s }) => s === sIdx));
    if (currentSec) {
        const freshQuizzes = JSON.parse(localStorage.getItem('quarks_quizzes') || '[]');
        const allLevelsDone = currentSec.stages.every(({ stage, sIdx: s }) =>
            stage.levels.every((_, lIdx) => completedStages.includes(`${s}-${lIdx}`)));
        const allQuizzesDone = currentSec.stages.every(({ sIdx: s }) => freshQuizzes.includes(s));
        if (allLevelsDone && allQuizzesDone) state._sectionJustCompleted = true;
    }

    const hasNext = state._quizSIdx + 1 < STAGES.length;
    showVictoryModal('Quiz Complete! ★', `${state.quizScore} / ${state.quizTotal} correct`, null, hasNext || state._sectionJustCompleted, null);

    const menuBtn = document.getElementById('modal-menu-btn');
    if (menuBtn) menuBtn.textContent = 'Back to Section';
    const nextBtn = document.getElementById('modal-next-btn');
    if (nextBtn) nextBtn.textContent = state._sectionJustCompleted ? 'Next Section →' : 'Next Stage →';
    const againBtn = document.getElementById('modal-again-btn');
    if (againBtn) againBtn.classList.add('hidden');

    if (state._sectionJustCompleted) {
        if (currentSec) trackSectionComplete(currentSec.name);
        fireSectionConfetti();
    }
}

function showQuizFailed() {
    const score = state.quizScore;
    const total = state.quizTotal;
    const sIdx = state._quizSIdx;

    document.getElementById('qr-emoji').textContent = '💔';
    document.getElementById('qr-score').textContent = `${score} / ${total}`;
    document.getElementById('qr-message').textContent = "Don't worry — every attempt makes you stronger. Try again!";

    const dotsHTML = Array(total).fill(0).map((_, i) =>
        `<div class="quiz-dot ${i < score ? 'correct' : 'missed'}"></div>`
    ).join('');
    document.getElementById('qr-dots').innerHTML = dotsHTML;

    document.getElementById('qr-retry-btn').onclick = () => { hideQuizResult(); initGame('QUIZ', sIdx); };
    document.getElementById('qr-back-btn').onclick  = () => { hideQuizResult(); showCurrentSection(); };

    document.getElementById('quiz-result-overlay').classList.remove('hidden');
}

function hideQuizResult() {
    document.getElementById('quiz-result-overlay').classList.add('hidden');
}

window.showQuizVictory = showQuizVictory;
window.showQuizResult  = showQuizFailed;   // called by validator on quiz fail
window.hideQuizResult  = hideQuizResult;

window.quizNextQuestion = function() {
    if (state._quizQueue.length > 0) {
        const next = state._quizQueue.shift();
        state._quizCurrentSIdx = next.sIdx;
        state._quizCurrentLevelIdx = next.lIdx;
    }
    state.quizCurrentQ++;
    state._quizContinuing = true;
    initGame('QUIZ', state._quizSIdx);
};

window.quizRetryAfterFail = function() {
    document.getElementById('quiz-fail-actions')?.classList.add('hidden');
    state._quizQueue.push({ sIdx: state._quizCurrentSIdx, lIdx: state._quizCurrentLevelIdx });
    const next = state._quizQueue.shift();
    state._quizCurrentSIdx = next.sIdx;
    state._quizCurrentLevelIdx = next.lIdx;
    state.quizCurrentQ++;
    state._quizContinuing = true;
    initGame('QUIZ', state._quizSIdx);
};

window.quizGoToSubstage = function() {
    document.getElementById('quiz-fail-actions')?.classList.add('hidden');
    initGame('STAGE', state._quizCurrentSIdx ?? state._quizSIdx, state._quizCurrentLevelIdx ?? 0);
};
// ─────────────────────────────────────────────────────────────────────────────

// --- Main Menu Initialization ---
function buildMenu() {
    // 1. Update the Global Stats Bar (elements may not exist if stats bar is hidden)
    const _pts = document.getElementById('menu-total-points');
    if (_pts) _pts.innerText = totalPoints;
    const _str = document.getElementById('menu-highest-streak');
    if (_str) _str.innerText = highestStreak;
    const _ds = parseInt(localStorage.getItem('quiver_daily_streak') || '0');
    const _dsel = document.getElementById('menu-daily-streak');
    if (_dsel) _dsel.innerText = _ds;
    const _dss = document.getElementById('menu-daily-streak-s');
    if (_dss) _dss.innerText = _ds === 1 ? '' : 's';
    
    // --- NEW: Daily Puzzle Tracking ---
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    
    // Fetch saved daily data, or create a fresh slate if it doesn't exist
    let dailyStatus = JSON.parse(localStorage.getItem('quiver_daily') || '{"date":"","completed":[]}');
    
    // If the saved date isn't today, wipe the completed array clean!
    if (dailyStatus.date !== today) {
        dailyStatus = { date: today, completed: [] };
        localStorage.setItem('quiver_daily', JSON.stringify(dailyStatus));
    }

    // Apply the checkmarks and green color to finished daily buttons
    [1, 2, 3].forEach(lvl => {
        const btn = document.getElementById(`btn-daily-${lvl}`);
        if (btn) {
            let baseText = btn.innerText.replace('✓ ', ''); // Prevent duplicate checkmarks
            if (dailyStatus.completed.includes(lvl)) {
                btn.classList.add('completed');
                btn.innerText = `✓ ${baseText}`;
            } else {
                btn.classList.remove('completed');
                btn.innerText = baseText;
            }
        }
    });

    // Update timed best scores in menu
    [1, 2, 3].forEach(lvl => {
        const bestEl = document.getElementById(`timed-best-${lvl}`);
        if (bestEl) {
            const best = timedBest[lvl - 1];
            bestEl.innerText = best > 0 ? `Best: ${best}` : 'Best: —';
        }
    });

    // Update achievements card description — play achievements only
    const _playAchs = ACHIEVEMENTS.filter(a => PLAY_CATEGORIES.includes(a.category));
    const _playUnlocked = _playAchs.filter(a => unlockedAchievements.has(a.id)).length;
    const _achCard = document.getElementById('ach-card-desc');
    if (_achCard) _achCard.innerText = `${_playUnlocked} / ${_playAchs.length} play achievements unlocked`;
}

const GATE_MASK_ORDER = ['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'];
const GATE_CHECKBOX_IDS = { X:'chk-x', Y:'chk-y', Z:'chk-z', H:'chk-h', SX:'chk-sx', RZ:'chk-rz', CX:'chk-cx', CP:'chk-cp', SWAP:'chk-swap', CCX:'chk-ccx' };

// --- Logic Helpers ---
function expandGateSet(baseGates, numQubits) {
    let expanded = [];
    baseGates.forEach(g => {
        if (['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'RY'].includes(g)) {
            for (let i = 0; i < numQubits; i++) expanded.push(`${g}${i}`);
        } else if (['CX', 'CP', 'SWAP'].includes(g)) {
            if (numQubits > 1) {
                for (let i = 0; i < numQubits; i++) {
                    for (let j = 0; j < numQubits; j++) {
                        if (i !== j) expanded.push(`${g}${i}${j}`);
                    }
                }
            }
        } else if (g === 'CCX') {
            if (numQubits > 2) {
                expanded.push('CCX012', 'CCX021', 'CCX120');
            }
        }
    });
    return expanded;
}

// --- Game Initialization ---
function initGame(mode, p1, p2) {
    window.stopLabPlay?.();
    if (mode === 'RANDOM') {
        let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
        if (selectedBaseGates.length === 0) {
            alert("Please select at least one gate before starting!");
            return;
        }
    }

    if (mode === 'STAGE')         pushRoute(`#/learn/${p1}/${p2 + 1}`);  // 1-based level
    else if (mode === 'RANDOM')   pushRoute(`#/random/${p1}`);
    else if (mode === 'DAILY')    pushRoute(`#/daily/${p1}`);
    else if (mode === 'TIMED')    pushRoute(`#/timed/${p1}`);
    else if (mode === 'FREEPLAY') pushRoute(`#/sandbox/${p1}`);

    if (!state.isTutorial) state.tutorialJustCompleted = false;
    state.selectedBaseGate = null;
    state.isVariational = false;
    _stopOptimizer();

    // Reset variational UI state
    const _varPanel = document.getElementById('variational-panel');
    if (_varPanel) _varPanel.classList.add('hidden');
    document.getElementById('board')?.classList.remove('hidden');
    document.getElementById('palette-container')?.classList.remove('hidden');
    document.getElementById('attempts-counter')?.classList.remove('hidden');

    document.getElementById('main-menu').style.display = 'none';
    hideVictoryModal();
    document.getElementById('game-view').style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    state.currentMode = mode;
    let instructions = document.getElementById('instructions-text');
    let submitBtn = document.getElementById('submit-btn');
    let targetBox = document.getElementById('target-container');
    let liveBox = document.getElementById('live-state-container');
    let clearBtn = document.getElementById('clear-btn');
    
    submitBtn.classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('again-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    submitBtn.disabled = false;
    
    const stageNav = document.getElementById('stage-nav');
    if (mode === 'STAGE') {
        stageNav.classList.remove('hidden');
    } else {
        stageNav.classList.add('hidden');
    }

    if (mode === 'STAGE') {
        clearBtn.classList.add('hidden');
        state.currentP1 = p1;
        state.currentP2 = p2;
        let stage = STAGES[p1];
        let lvl = stage.levels[p2];

        const isFirst = (p1 === 0 && p2 === 0);
        const isLast = (p1 === STAGES.length - 1 && p2 === STAGES[p1].levels.length - 1);
        const currentDone = completedStages.includes(`${p1}-${p2}`);

        const lvlLabel = (s, l) => `${s}.${l + 1}`;
        const prevP1 = p2 > 0 ? p1 : p1 - 1;
        const prevP2 = p2 > 0 ? p2 - 1 : STAGES[p1 - 1]?.levels.length - 1;
        const nextP1 = p2 + 1 < STAGES[p1].levels.length ? p1 : p1 + 1;
        const nextP2 = p2 + 1 < STAGES[p1].levels.length ? p2 + 1 : 0;

        const prevBtn = document.getElementById('stage-prev-btn');
        const nextBtn = document.getElementById('stage-next-btn');
        prevBtn.disabled = isFirst;
        nextBtn.disabled = isLast || !currentDone;
        prevBtn.innerHTML = isFirst ? '&#8592; Prev' : `&#8592; ${lvlLabel(prevP1, prevP2)}`;
        nextBtn.innerHTML = (isLast || !currentDone) ? 'Next &#8594;' : `${lvlLabel(nextP1, nextP2)} &#8594;`;

        // Variational levels have a different spec and skip the normal circuit system
        state.isVariational = !!lvl.variational;
        if (state.isVariational) {
            const vspec = lvl.variational;
            state.numQubits = vspec.numQubits;
            state.numCols   = vspec.template.length;
            state.activeSet = [];
            state.secretCircuits = [[]];
            state.variationalSpec = vspec;
            state.variationalParams = Object.fromEntries(vspec.params.map(p => [p.id, p.init]));
            submitBtn.classList.add('hidden');
            targetBox.style.display = 'none';
        } else {
            state.numQubits = lvl.qubits || stage.qubits;
            state.numCols = lvl.cols || stage.cols;
            state.activeSet = lvl.set || stage.set;
            state.secretCircuits = lvl.circuits;
            targetBox.style.display = 'block';
        }

        let isStrict = (p1 >= 4);
        let rulesText = (!state.isVariational && isStrict) ? "<br><span style='color:#ef4444; font-size:0.85rem; font-weight:bold;'>Strict Mode: An exact implementation is required!</span>" : "";
        const lessonSrc = state.isVariational ? lvl.variational?.lesson || lvl.lesson : lvl.lesson;
        const hintSrc   = state.isVariational ? lvl.variational?.hint   || lvl.hint   : lvl.hint;
        let lessonHTML = lessonSrc ? `<button id="lesson-btn" class="hint-btn" style="background:#059669;" onclick="showLesson()">Read Lesson</button><div id="lesson-text" class="lesson-text hidden">${lessonSrc}</div>` : "";
        let labBtnHTML = p1 === 8 ? `<button class="hint-btn" style="background:#f59e0b;" onclick="tryQftLab()">Try the QFT</button>`
                       : p1 === 9 ? `<button class="hint-btn" style="background:#f59e0b;" onclick="tryAdderLab()">Try the QFT Adder</button>`
                       : (p1 === 11 && state.currentP2 === 2) ? `<button class="hint-btn" style="background:#22c55e;color:#0f172a;" onclick="showGroverLab()">Try Grover Iterations</button>`
                       : (p1 === 12 && state.currentP2 === 1) ? `<button class="hint-btn" style="background:#6366f1;" onclick="showBlochExplorerLab()">Explore the Bloch Sphere</button>`
                       : "";

        instructions.innerHTML = `<div class="stage-breadcrumb">${stage.title}</div>
                                  <div class="stage-level-title">${lvl.name}</div>
                                  ${rulesText}
                                  <div style="margin-top:8px;">
                                    <button id="hint-btn" class="hint-btn" onclick="showHint()">Show Hint</button>
                                    ${lessonHTML}
                                    ${labBtnHTML}
                                  </div>
                                  <div id="hint-text" class="hint-text hidden">Hint: ${hintSrc}</div>`;
        liveBox.style.display = 'none';
        
    } else if (mode === 'RANDOM' || mode === 'DAILY') {
        clearBtn.classList.add('hidden');
        state.currentLvl = p1;
        state.numQubits = LEVELS[p1].q;
        state.numCols = LEVELS[p1].g;
        
        let rng; // We will assign either Math.random or our daily seeded PRNG to this

        if (mode === 'DAILY') {
            const now = new Date();
            // Seed based on Year, Month, Day, and the puzzle difficulty (1, 2, or 3)
            const seed = now.getFullYear() * 100000 + (now.getMonth() + 1) * 1000 + now.getDate() * 10 + p1;
            rng = getSeededRandom(seed);
            
            // Daily uses ALL gates, ignoring user selection
            state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);
            instructions.innerHTML = `<div class="stage-breadcrumb">Daily Puzzle</div><div class="stage-level-title">${['Easy', 'Medium', 'Hard'][p1-1]}</div><div class="stage-subtitle">Any valid solution wins! Resets at midnight.</div>`;
        } else {
            if (state._usePresetSeed) {
                state._usePresetSeed = false;
            } else {
                state.randomSeed = Math.floor(Math.random() * 900000) + 100000;
            }
            rng = getSeededRandom(state.randomSeed);
            let selectedBaseGates = Array.from(document.querySelectorAll('#play-gate-selection input:checked')).map(cb => cb.value);
            state.activeSet = expandGateSet(selectedBaseGates, state.numQubits);

            if (state.activeSet.length === 0) {
                state.activeSet = expandGateSet(['X', 'H'], state.numQubits);
                selectedBaseGates = ['X', 'H'];
            }
            // Encode selected gates as bitmask for challenge sharing
            state.randomGateMask = selectedBaseGates.reduce((mask, g) => {
                const idx = GATE_MASK_ORDER.indexOf(g);
                return idx >= 0 ? mask | (1 << idx) : mask;
            }, 0);
            instructions.innerHTML = `<div class="stage-breadcrumb">Random Puzzle</div><div class="stage-level-title">${['Easy', 'Medium', 'Hard'][p1-1]}</div><div class="stage-subtitle">Guess the circuit. Any valid solution wins!</div>`;
        }
        
        generateMatrices(state.numQubits);
        let generatedCircuit = [];
        let activeLength = Math.floor(rng() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let singleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let singleGatesToPlace = 2;
        let randRunningState = computeStateVector([], state.numQubits, GATE_MATRICES);

        for (let i = 0; i < state.numCols; i++) {
            if (i < activeLength) {
                let col = [];
                let placedThisCol = 0;
                const isNonTrivial = (g) => !statesMatch(
                    computeStateVector([[g]], state.numQubits, GATE_MATRICES, randRunningState),
                    randRunningState, state.numQubits
                );

                if (singleGatesToPlace > 0 && singleQSet.length > 0) {
                    let g = formatAngleGateSeeded(singleQSet[Math.floor(rng() * singleQSet.length)], rng);
                    if (isNonTrivial(g)) { col.push(g); singleGatesToPlace--; placedThisCol++; }

                    if (singleGatesToPlace > 0 && state.numQubits >= 2) {
                        let g2 = formatAngleGateSeeded(singleQSet[Math.floor(rng() * singleQSet.length)], rng);
                        if (canFit(col, g2) && isNonTrivial(g2)) {
                            col.push(g2);
                            singleGatesToPlace--;
                            placedThisCol++;
                        }
                    }
                } else {
                    let baseGate = formatAngleGateSeeded(state.activeSet[Math.floor(rng() * state.activeSet.length)], rng);
                    if (isNonTrivial(baseGate)) { col.push(baseGate); placedThisCol++; }
                }

                for(let a=placedThisCol; a<state.numQubits; a++) {
                    if(rng() > 0.5) {
                        let gNext = formatAngleGateSeeded(state.activeSet[Math.floor(rng() * state.activeSet.length)], rng);
                        if(canFit(col, gNext) && isNonTrivial(gNext)) col.push(gNext);
                    }
                }
                randRunningState = computeStateVector([col], state.numQubits, GATE_MATRICES, randRunningState);
                generatedCircuit.push(col);
            } else generatedCircuit.push([]);
        }

        // Safety fallback: if all gates were trivial, ensure at least one non-trivial gate
        const zeroState = computeStateVector([], state.numQubits, GATE_MATRICES);
        if (statesMatch(computeStateVector(generatedCircuit, state.numQubits, GATE_MATRICES), zeroState, state.numQubits)) {
            generatedCircuit[0] = ['H0'];
        }

        state.secretCircuits = [generatedCircuit];
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

    } else if (mode === 'TIMED') {
        const isContinuingTimedSession = state._timerIntervalId !== null;

        clearBtn.classList.add('hidden');
        state.currentLvl = p1;
        state.numQubits = LEVELS[p1].q;
        state.numCols = LEVELS[p1].g;
        state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);

        if (!isContinuingTimedSession) {
            if (!state.isDuelMode) state.duelSeed = Math.floor(Math.random() * 900000) + 100000;
            state.timedCircuitIndex = 0;
            state.timedScore = 0;
            state.timedCircuitsSolved = 0;
        }
        const timedRng = getSeededRandom(state.duelSeed * 1000 + state.timedCircuitIndex);
        generateMatrices(state.numQubits);
        let timedCircuit = [];
        let timedActiveLength = Math.floor(timedRng() * (state.numCols - LEVELS[p1].minActive + 1)) + LEVELS[p1].minActive;
        let timedSingleQSet = state.activeSet.filter(g => getOccupiedQubits(g).length === 1);
        let timedSingleToPlace = 2;
        let timedRunningState = computeStateVector([], state.numQubits, GATE_MATRICES);
        for (let i = 0; i < state.numCols; i++) {
            if (i < timedActiveLength) {
                let col = [];
                let placed = 0;
                const isNonTrivialTimed = (g) => !statesMatch(
                    computeStateVector([[g]], state.numQubits, GATE_MATRICES, timedRunningState),
                    timedRunningState, state.numQubits
                );
                if (timedSingleToPlace > 0 && timedSingleQSet.length > 0) {
                    let g = formatAngleGateSeeded(timedSingleQSet[Math.floor(timedRng() * timedSingleQSet.length)], timedRng);
                    if (isNonTrivialTimed(g)) { col.push(g); timedSingleToPlace--; placed++; }
                    if (timedSingleToPlace > 0 && state.numQubits >= 2) {
                        let g2 = formatAngleGateSeeded(timedSingleQSet[Math.floor(timedRng() * timedSingleQSet.length)], timedRng);
                        if (canFit(col, g2) && isNonTrivialTimed(g2)) { col.push(g2); timedSingleToPlace--; placed++; }
                    }
                } else {
                    let g = formatAngleGateSeeded(state.activeSet[Math.floor(timedRng() * state.activeSet.length)], timedRng);
                    if (isNonTrivialTimed(g)) { col.push(g); placed++; }
                }
                for (let a = placed; a < state.numQubits; a++) {
                    if (timedRng() > 0.5) {
                        let gNext = formatAngleGateSeeded(state.activeSet[Math.floor(timedRng() * state.activeSet.length)], timedRng);
                        if (canFit(col, gNext) && isNonTrivialTimed(gNext)) col.push(gNext);
                    }
                }
                timedRunningState = computeStateVector([col], state.numQubits, GATE_MATRICES, timedRunningState);
                timedCircuit.push(col);
            } else timedCircuit.push([]);
        }

        // Safety fallback: if all gates were trivial, ensure at least one non-trivial gate
        const timedZeroState = computeStateVector([], state.numQubits, GATE_MATRICES);
        if (statesMatch(computeStateVector(timedCircuit, state.numQubits, GATE_MATRICES), timedZeroState, state.numQubits)) {
            timedCircuit[0] = ['H0'];
        }

        state.secretCircuits = [timedCircuit];

        const diffNames = ['Easy', 'Medium', 'Hard'];
        instructions.innerHTML = `<div class="stage-breadcrumb">Time Collapse</div><div class="stage-level-title">${diffNames[p1 - 1]}</div><div class="stage-subtitle">Solve as many circuits as possible! +20s per solve, −5s per wrong attempt.</div>`;
        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

        if (isContinuingTimedSession) {
            updateTimedStatusBar(state);
        } else {
            state._timedSessionEnded = false;
            state.timerRemaining = state.currentLvl === 3 ? 60 : 30;
            updateTimedStatusBar(state);
            state._timerIntervalId = setInterval(() => {
                state.timerRemaining--;
                updateTimedStatusBar(state);
                if (state.timerRemaining <= 0) {
                    endTimedSession();
                }
            }, 1000);
        }

        state.timedNextPuzzle = () => {
            if (state._timedSessionEnded || state.timerRemaining <= 0) return;
            initGame('TIMED', state.currentLvl);
        };
        state.timedEndSession = endTimedSession;

    } else if (mode === 'FREEPLAY') {
        clearBtn.classList.remove('hidden');
        state.numQubits = p1;
        state.numCols = 8;
        state.activeSet = expandGateSet(['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'CX', 'CP', 'SWAP', 'CCX'], state.numQubits);
        state.secretCircuits = [[]];

        instructions.innerHTML = `<div class="stage-breadcrumb">Sandbox</div><div class="stage-level-title">${state.numQubits} Qubit${state.numQubits>1?'s':''}</div><div class="stage-subtitle">Experiment freely. Click evaluate to take a snapshot of the state!</div>`;
        targetBox.style.display = 'none';
        liveBox.style.display = 'block';

    } else if (mode === 'QUIZ') {
        clearBtn.classList.add('hidden');
        stageNav.classList.add('hidden');
        const isGlobal = (p1 === -1);
        const quizStage = isGlobal ? null : STAGES[p1];
        state._quizSIdx = p1;
        state.currentP1 = p1;

        const _isContinuing = state._quizContinuing;

        if (!_isContinuing) {
            state.quizCurrentQ = 0;
            state.quizScore = 0;
            state.quizLives = 3;
            state._quizSessionSeed = Math.floor(Math.random() * 900000) + 100000;

            const pool = isGlobal
                ? completedStages.map(id => { const [s, l] = id.split('-').map(Number); return { sIdx: s, lIdx: l }; })
                : getQuizStagePool(p1);
            state.quizTotal = Math.min(5, pool.length);
            const shuffleRng = getSeededRandom(state._quizSessionSeed);
            const shuffled = shuffleArray(pool.map((_, i) => i), shuffleRng).slice(0, state.quizTotal);
            const firstEntry = pool[shuffled[0]];
            state._quizCurrentSIdx = firstEntry.sIdx;
            state._quizCurrentLevelIdx = firstEntry.lIdx;
            state._quizQueue = shuffled.slice(1).map(i => pool[i]);
        }
        state._quizContinuing = false;
        state.attempts = 0;

        // Reset fail-action buttons for this question
        const _failActions = document.getElementById('quiz-fail-actions');
        if (_failActions) {
            _failActions.classList.add('hidden');
            document.getElementById('quiz-fail-next-btn').onclick = () => window.quizRetryAfterFail?.();
            document.getElementById('quiz-fail-review-btn').onclick = () => window.quizGoToSubstage?.();
        }

        const _QUIZ_SPECIALS = new Set(['QFT', 'IQFT', 'IQFT2']);
        const _BASE_NAMES = ['X','Y','Z','H','SX','RZ','CX','CP','SWAP','CCX'];

        function buildActiveSet(rawSet, nQubits) {
            const baseNames = rawSet.filter(g => _BASE_NAMES.includes(g));
            const expanded  = rawSet.filter(g => !_QUIZ_SPECIALS.has(g) && !_BASE_NAMES.includes(g));
            const specials  = rawSet.filter(g => _QUIZ_SPECIALS.has(g));
            const set = [...expanded, ...expandGateSet(baseNames, nQubits), ...specials];
            return set.length ? set : expandGateSet(['X', 'H'], nQubits);
        }

        let taskHTML = '';
        let strictNotice = '';

        {
            const questionSIdx = state._quizCurrentSIdx ?? p1;
            const currentQuizStage = STAGES[questionSIdx];
            const chosenLevel = currentQuizStage.levels[state._quizCurrentLevelIdx ?? 0];

            if (chosenLevel.variational) {
                const vspec = chosenLevel.variational;
                state.isVariational = true;
                state.variationalSpec = vspec;
                state.variationalParams = Object.fromEntries(vspec.params.map(p => [p.id, p.init]));
                state.numQubits = vspec.numQubits;
                state.numCols   = vspec.template.length;
                state.activeSet = [];
                state.secretCircuits = [[]];
                submitBtn.classList.add('hidden');
            } else {
                state.numQubits = chosenLevel.qubits || currentQuizStage.qubits;
                state.numCols   = chosenLevel.cols   || currentQuizStage.cols;
                state.activeSet = buildActiveSet(chosenLevel.set || currentQuizStage.set || [], state.numQubits);
                state.secretCircuits = chosenLevel.circuits;
            }
            generateMatrices(state.numQubits);
            const contextHTML = isGlobal ? `<div class="quiz-context">${currentQuizStage.title} · ${chosenLevel.name.replace(/^[\d\.]+[\.:]?\s*/, '')}</div>` : '';
            taskHTML = `${contextHTML}<div class="quiz-task"><div class="quiz-task-label">Your task:</div><div class="quiz-task-desc">${chosenLevel.quizDesc || chosenLevel.name}</div></div>`;
            if (questionSIdx >= 4 && !chosenLevel.variational) strictNotice = `<div class="quiz-strict-notice">Strict Mode — exact circuit required</div>`;
        }
        const dotsHTML = Array(state.quizTotal).fill(0).map((_, i) => {
            const cls = i < state.quizScore ? 'correct' : (i === state.quizScore ? 'current' : '');
            return `<div class="quiz-dot ${cls}"></div>`;
        }).join('');
        const livesHTML = '❤️'.repeat(state.quizLives) + '🖤'.repeat(3 - state.quizLives);

        const attemptsCounter = document.getElementById('attempts-counter');
        if (attemptsCounter) attemptsCounter.innerText = '';

        instructions.innerHTML = `
            <div class="stage-breadcrumb">${isGlobal ? 'Review Quiz' : quizStage.title + ' · Quiz'}</div>
            <div class="quiz-header">
                <div class="quiz-progress-dots">${dotsHTML}</div>
                <div class="quiz-lives">${livesHTML}</div>
            </div>
            ${taskHTML}
            ${strictNotice}`;

        targetBox.style.display = 'block';
        liveBox.style.display = 'none';

    } else if (mode === 'LAB') {
        initLabMode(state, p1);
    } else if (mode === 'QFT_LAB') {
        initQftLabMode(state, p1);
    }

    generateMatrices(state.numQubits);
    if (state.numQubits === 3) document.getElementById('board').classList.add('hard-mode');
    else document.getElementById('board').classList.remove('hard-mode');
    
    let hasAngleGate = state.activeSet.some(g => g.startsWith('RZ') || g.startsWith('CP'));
    let angleContainer = document.getElementById('rz-angle-container');
    if(angleContainer) angleContainer.style.display = hasAngleGate ? 'inline-block' : 'none';
    
    if (mode !== 'FREEPLAY' && mode !== 'QFT_LAB' && !state.isVariational) {
        state.targetState = computeStateVector(state.secretCircuits[0], state.numQubits, GATE_MATRICES);
        document.getElementById('target-amplitudes').innerText = "|ψ⟩ = " + stateToString(state.targetState, state.numQubits);
        updateTargetBlochSphere(state.targetState, state.numQubits);
    } else {
        updateTargetBlochSphere(null, state.numQubits);
    }
    
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    if (mode === 'LAB') {
        state.currentGuess[1] = ['QFT'];
        state.currentGuess[4] = ['IQFT'];
    } else if (mode === 'QFT_LAB') {
        state.currentGuess[0] = [...QFT_LAB_CONFIGS[p1]];
        state.currentGuess[1] = ['QFT'];
    }
    state.attempts = 0;
    gameStartTime = Date.now();
    trackGameStart(state.currentMode, state.currentP1, state.currentP2, state.currentLvl,
        (mode !== 'FREEPLAY' && mode !== 'QFT_LAB') ? state.targetState : null,
        state.secretCircuits[0] || null,
        state.activeSet);
    state.gameOver = false;
    document.getElementById('message').innerText = "";
    
    // --- NEW: Force a hard wipe of the DOM for the new game ---
    document.getElementById('board').innerHTML = '';
    const historyBoard = document.getElementById('history-board');
    if (historyBoard) historyBoard.innerHTML = ''; 
    // Use querySelectorAll to catch any and all lingering canonical circuits
    document.querySelectorAll('#reveal-circuit-wrap').forEach(el => el.remove());

    renderDynamicCanvases(state.numQubits);
    renderPalette();
    renderBoard();

    if (state.isVariational) {
        initVariationalMode(state.variationalSpec);
    } else {
        updateBlochSpheres(state.currentGuess, state.numQubits);
    }

    if (_isSignedIn && !tutorialComplete && !tutorialPromptShown && mode !== 'TIMED' && mode !== 'FREEPLAY' && mode !== 'LAB' && mode !== 'QFT_LAB' && !state.isVariational) {
        tutorialPromptShown = true;
        setTimeout(() => {
            if (state.gameOver) return;
            showTutorialPrompt(
                () => {
                    state.isTutorial = true;
                    state.tutorialPhase = 'SELECT_GATE';
                    setGhostPointer('PALETTE_ANY');
                },
                () => { setTutorialComplete(); trackTutorialSkipped(); }
            );
        }, 400);
    }
}

window.initGame = initGame;
window._state = state;
window.initLabGame       = n => initGame('LAB', n);
window.initDailyGame     = n => initGame('DAILY', n);
window.initQftLab        = n => initGame('QFT_LAB', n);
window.labGoBack         = () => initGame('STAGE', 9, state.labFromP2);
window.qftLabGoBack      = () => initGame('STAGE', 8, state.qftLabFromP2);
window.stopLabPlay       = stopLabPlay;
window.showGroverLab       = showGroverLab;
window.showBlochExplorerLab = showBlochExplorerLab;
window.showQftExplanation  = showQftExplanation;
window.toggleQftLabPlay   = () => toggleQftLabPlay(state, renderBoard);
window.toggleAdderLabPlay = () => toggleAdderLabPlay(state, renderBoard);
window.toggleGroverLabPlay = toggleGroverLabPlay;
window.selectLabNumber   = n => selectLabNumber(n, state, renderBoard);
window.selectQftInput    = n => selectQftInput(n, state, renderBoard);

// ── Variational Mode ──────────────────────────────────────────────────────
let _varOptimizerTimer = null;

function initVariationalMode(vspec) {
    // Hide palette — circuit board stays visible (read-only)
    document.getElementById('palette-container').classList.add('hidden');
    document.getElementById('attempts-counter').classList.add('hidden');

    // Populate board with the fixed circuit template (read-only, no tap zones)
    state.currentGuess = vspec.template.map(col =>
        col.map(spec => typeof spec === 'string' ? spec : `${spec.gate}_VAR_${spec.param}_${spec.qubit}`)
    );
    renderBoard();

    const panel = document.getElementById('variational-panel');
    panel.classList.remove('hidden');

    // Build parameter sliders
    const paramsSection = document.getElementById('var-params-section');
    paramsSection.innerHTML = vspec.params.map(p => {
        const val = state.variationalParams[p.id] ?? p.init;
        return `<div class="var-param-row">
            <div class="var-param-label">${p.label} = <span id="var-param-${p.id}-val">${val.toFixed(2)}</span></div>
            <input type="range" id="var-param-${p.id}" class="var-param-slider"
                   min="${p.min}" max="${p.max}" step="0.02" value="${val}">
        </div>`;
    }).join('');

    // Attach live slider events
    vspec.params.forEach(p => {
        const slider = document.getElementById(`var-param-${p.id}`);
        slider.addEventListener('input', e => {
            state.variationalParams[p.id] = parseFloat(e.target.value);
            document.getElementById(`var-param-${p.id}-val`).textContent = state.variationalParams[p.id].toFixed(2);
            recomputeVariational(false);
        });
        slider.addEventListener('change', () => recomputeVariational(true));
    });

    // Show cost or fidelity section
    const costSection = document.getElementById('var-cost-section');
    const fidSection  = document.getElementById('var-fidelity-section');
    if (vspec.winMode === 'fidelity') {
        costSection.classList.add('hidden');
        fidSection.classList.remove('hidden');
    } else {
        fidSection.classList.add('hidden');
        costSection.classList.remove('hidden');
        document.getElementById('var-cost-label').textContent = (vspec.costLabel || '⟨H⟩') + ' = ';
        const goalThresh = vspec.winMode === 'prob'
            ? Math.round((vspec.probThreshold ?? 0.8) * 100) + '%'
            : (vspec.costThreshold ?? '?');
        const sign = (vspec.higherIsBetter || vspec.winMode === 'prob') ? '>' : '<';
        document.getElementById('var-cost-goal').textContent = `Goal: ${vspec.costLabel || '⟨H⟩'} ${sign} ${goalThresh}`;
    }

    // Landscape
    const landscapeWrap = document.getElementById('var-landscape-wrap');
    if (vspec.showLandscape && vspec.landscapeParam) {
        landscapeWrap.classList.remove('hidden');
    } else {
        landscapeWrap.classList.add('hidden');
    }

    // Optimizer button
    const optRow = document.getElementById('var-optimizer-row');
    if (vspec.showOptimizer) {
        optRow.classList.remove('hidden');
    } else {
        optRow.classList.add('hidden');
    }

    // Task description
    if (vspec.task) {
        const taskEl = document.getElementById('var-task');
        if (taskEl) taskEl.textContent = vspec.task;
    }

    recomputeVariational();
}

function _computeVariationalCost(vspec, paramValues) {
    const sv = computeVariationalState(vspec.template, paramValues, vspec.numQubits, GATE_MATRICES);

    if (vspec.winMode === 'fidelity') {
        return computeFidelity(sv, vspec.targetVec);
    } else if (vspec.winMode === 'prob') {
        const N = 1 << vspec.numQubits;
        let prob = 0;
        for (const bit of (vspec.targetBits || [])) {
            if (bit < N) prob += sv[bit].r * sv[bit].r + sv[bit].i * sv[bit].i;
        }
        return prob;
    } else {
        const raw = computeExpectation(sv, vspec.hamiltonian, vspec.numQubits);
        return raw + (vspec.constTerm || 0);
    }
}

function recomputeVariational(checkWin = true) {
    const vspec = state.variationalSpec;
    if (!vspec) return;

    const sv = computeVariationalState(vspec.template, state.variationalParams, vspec.numQubits, GATE_MATRICES);
    updateBlochSpheresFromState(sv, vspec.numQubits);

    const cost = _computeVariationalCost(vspec, state.variationalParams);

    if (vspec.winMode === 'fidelity') {
        const pct = Math.round(cost * 100);
        document.getElementById('var-fidelity-value').textContent = pct + '%';
        const bar = document.getElementById('var-fidelity-bar');
        if (bar) bar.style.width = pct + '%';
    } else {
        const display = vspec.winMode === 'prob' ? Math.round(cost * 100) + '%' : cost.toFixed(3);
        document.getElementById('var-cost-value').textContent = display;
        // Progress bar: map cost to a 0-100% visual
        const bar = document.getElementById('var-progress-bar');
        if (bar) {
            let pct;
            if (vspec.winMode === 'prob') {
                pct = Math.round(cost * 100);
            } else if (vspec.higherIsBetter) {
                pct = Math.min(100, Math.round((cost / (vspec.costThreshold || 1)) * 100));
            } else {
                const min = vspec.costThreshold ?? -1;
                pct = Math.max(0, Math.min(100, Math.round((1 - (cost - min) / (1 - min)) * 100)));
            }
            bar.style.width = pct + '%';
        }
    }

    if (vspec.showLandscape) _drawLandscape(vspec);

    if (checkWin) {
        const won = _checkVariationalWin(vspec, cost);
        if (won && !state.gameOver) {
            state.gameOver = true;
            _stopOptimizer();
            setTimeout(() => _fireVariationalVictory(), 300);
        }
    }
}

function _checkVariationalWin(vspec, cost) {
    if (vspec.winMode === 'fidelity') return cost >= (vspec.fidelityThreshold ?? 0.99);
    if (vspec.winMode === 'prob')     return cost >= (vspec.probThreshold ?? 0.8);
    if (vspec.higherIsBetter)         return cost >= (vspec.costThreshold ?? 0);
    return cost <= (vspec.costThreshold ?? -0.95);
}

function _fireVariationalVictory() {
    if (state.currentMode === 'QUIZ') {
        state.quizScore++;
        const msg = document.getElementById('message');
        msg.innerText = '✓ Correct!';
        msg.style.color = '#22c55e';
        setTimeout(() => {
            msg.innerText = '';
            if (state.quizScore >= state.quizTotal) window.showQuizVictory?.();
            else window.quizNextQuestion?.();
        }, 900);
        return;
    }

    const vspec = state.variationalSpec;
    const p1 = state.currentP1, p2 = state.currentP2;
    const stage = STAGES[p1];
    const hasNext = p2 + 1 < stage.levels.length || p1 + 1 < STAGES.length;

    fireQuantumConfetti();
    markStageCompleted(p1, p2);
    updateLearnStreak();
    buildSectionsOverview();

    // Achievement checks
    const tryUnlock = (id) => {
        if (unlockAchievement(id)) {
            const a = ACHIEVEMENT_MAP[id];
            if (a) setTimeout(() => showAchievementToast(a.name, a.icon), 900);
        }
    };
    tryUnlock('superposition');
    const stageComplete = stage.levels.every((_, lIdx) => completedStages.includes(`${p1}-${lIdx}`));
    if (stageComplete) tryUnlock(`stage_${p1}_complete`);
    const allStageIds = [];
    STAGES.forEach((s, sIdx) => s.levels.forEach((_, lIdx) => allStageIds.push(`${sIdx}-${lIdx}`)));
    if (allStageIds.every(id => completedStages.includes(id))) tryUnlock('quantum_literate');
    const ls = parseInt(localStorage.getItem('quiver_learn_streak') || '0');
    if (ls >= 7)  tryUnlock('learn_streak_7');
    if (ls >= 30) tryUnlock('learn_streak_30');

    const cost = _computeVariationalCost(vspec, state.variationalParams);
    const subtitle = vspec.winMode === 'fidelity'
        ? `Fidelity: ${Math.round(cost * 100)}%`
        : `${vspec.costLabel || '⟨H⟩'} = ${cost.toFixed(3)}`;

    showVictoryModal(`${stage.title} ${p2 + 1} Complete!`, subtitle, null, hasNext, null);

    const nextBtn = document.getElementById('modal-next-btn');
    if (nextBtn) {
        nextBtn.textContent = 'Next Level';
        nextBtn.onclick = () => {
            hideVictoryModal();
            if (p2 + 1 < stage.levels.length) initGame('STAGE', p1, p2 + 1);
            else if (p1 + 1 < STAGES.length)  initGame('STAGE', p1 + 1, 0);
        };
    }
    const againBtn = document.getElementById('modal-again-btn');
    if (againBtn) {
        againBtn.classList.remove('hidden');
        againBtn.textContent = 'Try Again';
        againBtn.onclick = () => { hideVictoryModal(); initGame('STAGE', p1, p2); };
    }
    const menuBtn = document.getElementById('modal-menu-btn');
    if (menuBtn) menuBtn.textContent = 'Back to Stages';
}

function _drawLandscape(vspec) {
    const svg = document.getElementById('var-landscape-svg');
    if (!svg) return;
    const W = 280, H = 80, PAD = 10;
    const param = vspec.params.find(p => p.id === vspec.landscapeParam);
    if (!param) return;

    const steps = 60;
    const min = param.min, max = param.max;
    const points = [];
    let costMin = Infinity, costMax = -Infinity;

    for (let i = 0; i <= steps; i++) {
        const t = min + (max - min) * (i / steps);
        const params = {...state.variationalParams, [param.id]: t};
        const c = _computeVariationalCost(vspec, params);
        points.push({t, c});
        if (c < costMin) costMin = c;
        if (c > costMax) costMax = c;
    }

    const range = costMax - costMin || 1;
    const toX = t => PAD + (t - min) / (max - min) * (W - 2*PAD);
    const toY = c => PAD + (1 - (c - costMin) / range) * (H - 2*PAD);

    const polyline = points.map(({t, c}) => `${toX(t).toFixed(1)},${toY(c).toFixed(1)}`).join(' ');

    const curVal = state.variationalParams[param.id];
    const curCost = _computeVariationalCost(vspec, state.variationalParams);
    const dotX = toX(curVal), dotY = toY(curCost);

    // Threshold line
    const threshVal = vspec.costThreshold ?? vspec.probThreshold;
    let threshLine = '';
    if (threshVal != null) {
        const ty = toY(threshVal);
        if (ty >= PAD && ty <= H - PAD) {
            threshLine = `<line x1="${PAD}" y1="${ty.toFixed(1)}" x2="${W-PAD}" y2="${ty.toFixed(1)}" stroke="#22c55e" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>`;
        }
    }

    svg.innerHTML = `
        <polyline points="${polyline}" fill="none" stroke="#f97316" stroke-width="2" stroke-linejoin="round"/>
        ${threshLine}
        <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="5" fill="#fbbf24" stroke="#fff" stroke-width="1.5"/>
    `;
}

function _stopOptimizer() {
    if (_varOptimizerTimer) { clearInterval(_varOptimizerTimer); _varOptimizerTimer = null; }
    const btn = document.getElementById('var-optimizer-btn');
    if (btn) { btn.textContent = '▶ Run Optimizer'; btn.disabled = false; }
}

window.runVariationalOptimizer = function() {
    if (_varOptimizerTimer) { _stopOptimizer(); return; }
    const vspec = state.variationalSpec;
    if (!vspec || state.gameOver) return;

    const btn = document.getElementById('var-optimizer-btn');
    if (btn) { btn.textContent = '⏹ Stop'; }

    const eps = 0.05;
    const lr0 = 0.25;
    let step = 0;
    const maxSteps = 80;
    const sign = (vspec.higherIsBetter || vspec.winMode === 'prob') ? -1 : 1;

    _varOptimizerTimer = setInterval(() => {
        if (state.gameOver || step >= maxSteps) { _stopOptimizer(); return; }
        step++;
        const lr = lr0 * Math.pow(0.98, step);

        // Finite-difference gradient
        vspec.params.forEach(p => {
            const curr = state.variationalParams[p.id];
            const cp = {...state.variationalParams, [p.id]: curr + eps};
            const cm = {...state.variationalParams, [p.id]: curr - eps};
            const grad = (_computeVariationalCost(vspec, cp) - _computeVariationalCost(vspec, cm)) / (2 * eps);
            // gradient descent: move against gradient (or ascent: move with it)
            state.variationalParams[p.id] = Math.max(p.min, Math.min(p.max, curr - sign * lr * grad));
            // Update slider and label
            const slider = document.getElementById(`var-param-${p.id}`);
            const label  = document.getElementById(`var-param-${p.id}-val`);
            if (slider) slider.value = state.variationalParams[p.id].toFixed(3);
            if (label)  label.textContent = state.variationalParams[p.id].toFixed(2);
        });

        recomputeVariational();
    }, vspec.optimizerInterval ?? 80);
};

// ── Auth UI ───────────────────────────────────────────────────────────────
let _authMode = 'signin'; // 'signin' | 'signup'

function _showApp(email) {
    _isSignedIn = true;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('auth-email-display').textContent = email;
}

function _showLoginScreen() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('auth-email-input').value = '';
    document.getElementById('auth-password-input').value = '';
    document.getElementById('auth-error-msg').classList.add('hidden');
}

window.togglePasswordVisibility = function() {
    const input = document.getElementById('auth-password-input');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    document.getElementById('eye-icon-show').classList.toggle('hidden', isHidden);
    document.getElementById('eye-icon-hide').classList.toggle('hidden', !isHidden);
};

window.toggleAuthMode = function() {
    _authMode = _authMode === 'signin' ? 'signup' : 'signin';
    const isSignIn = _authMode === 'signin';
    document.getElementById('login-title').textContent       = isSignIn ? 'Sign In' : 'Create Account';
    document.getElementById('auth-submit-btn').textContent   = isSignIn ? 'Sign In' : 'Create Account';
    document.getElementById('auth-toggle-btn').textContent   = isSignIn ? 'No account yet? Sign Up' : 'Already have an account? Sign In';
    document.getElementById('auth-error-msg').classList.add('hidden');
};

window.handleAuthSubmit = async function() {
    const email     = document.getElementById('auth-email-input').value.trim();
    const password  = document.getElementById('auth-password-input').value;
    const errEl     = document.getElementById('auth-error-msg');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !password) {
        errEl.textContent = 'Please enter your email and password.';
        errEl.style.color = '#f87171';
        errEl.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '…';
    errEl.classList.add('hidden');

    try {
        if (_authMode === 'signin') {
            const user = await signIn(email, password, applyRemoteProgress);
            _showApp(user.email);
        } else {
            const { user, session } = await signUp(email, password);
            if (session) {
                _showApp(user.email);
            } else {
                errEl.textContent = 'Account created! Check your email to confirm, then sign in.';
                errEl.style.color = '#22c55e';
                errEl.classList.remove('hidden');
            }
        }
    } catch (e) {
        errEl.textContent = e.message || 'Something went wrong. Please try again.';
        errEl.style.color = '#f87171';
        errEl.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = _authMode === 'signin' ? 'Sign In' : 'Create Account';
    }
};

window.handleSignOut = async function() {
    _isSignedIn = false;
    await signOut();
    _showLoginScreen();
};

// ── Feedback ──────────────────────────────────────────────────────────────
let _feedbackRating = 0;

function _updateStars(hovered) {
    const val = hovered ?? _feedbackRating;
    document.querySelectorAll('#feedback-stars .star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= val);
    });
}

window.showFeedbackModal = function(context) {
    const modal = document.getElementById('feedback-modal');
    _feedbackRating = 0;
    document.getElementById('feedback-form').classList.remove('hidden');
    document.getElementById('feedback-thanks').classList.add('hidden');
    document.getElementById('feedback-text').value = '';
    _updateStars(0);

    const subtitle = document.getElementById('feedback-subtitle');
    if (context === 'after_section_1') {
        subtitle.textContent = "How's your experience so far? Let us know how to improve.";
        subtitle.classList.remove('hidden');
    } else {
        subtitle.classList.add('hidden');
    }

    const starsEl = document.getElementById('feedback-stars');
    starsEl.onmouseleave = () => _updateStars(null);
    starsEl.querySelectorAll('.star').forEach(s => {
        s.onmouseenter = () => _updateStars(parseInt(s.dataset.value));
        s.onclick = () => { _feedbackRating = parseInt(s.dataset.value); _updateStars(null); };
    });

    modal.dataset.context = context || '';
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('feedback-text').focus(), 50);
};
window.hideFeedbackModal = function() {
    document.getElementById('feedback-modal').classList.add('hidden');
};
window.handleFeedbackSubmit = async function() {
    const text = document.getElementById('feedback-text').value.trim();
    if (!text && !_feedbackRating) return;
    const context = document.getElementById('feedback-modal').dataset.context;
    await submitFeedback(text, context, _feedbackRating || null);
    document.getElementById('feedback-form').classList.add('hidden');
    document.getElementById('feedback-thanks').classList.remove('hidden');
    setTimeout(window.hideFeedbackModal, 2000);
};
// ─────────────────────────────────────────────────────────────────────────

// --- Render Core ---

const GATE_TIPS = {
    X:    'Pauli-X (NOT): Flips |0⟩ ↔ |1⟩. The quantum bit flip.',
    Y:    'Pauli-Y: Combines bit flip and phase flip.',
    Z:    'Pauli-Z: Phase flip — leaves |0⟩ unchanged, negates |1⟩.',
    H:    'Hadamard: Creates equal superposition.\n|0⟩ → (|0⟩+|1⟩)/√2',
    SX:   '√X: Half a bit flip. Creates partial superposition.',
    RZ:   'RZ(θ): Rotation around Z-axis by θ. Adds relative phase between |0⟩ and |1⟩.',
    RY:   'RY(θ): Rotation around Y-axis by θ. Continuously interpolates between |0⟩ and |1⟩.',
    CX:   'CNOT: Flips target qubit only when control is |1⟩. Generates entanglement.',
    CP:   'Controlled Phase: Adds phase to the |11⟩ state. Used in QFT.',
    SWAP: 'SWAP: Exchanges the full states of two qubits.',
    CCX:  'Toffoli: 3-qubit gate. Flips target only when both controls are |1⟩.',
    QFT:  'Quantum Fourier Transform: The quantum analogue of the DFT. Core of many algorithms.',
    IQFT: 'Inverse QFT: Undoes the Quantum Fourier Transform.',
    IQFT2: 'IQFT₂: 2-qubit Inverse QFT on the top two qubits. Used in QPE to decode the eigenphase.',
};

function renderPalette() {
    const palette = document.getElementById('palette');
    palette.innerHTML = '';
    const h = Math.max(60, state.numQubits * 30);

    // Extract unique base gates instead of showing all permutations
    const allBases = ['X', 'Y', 'Z', 'H', 'SX', 'RZ', 'RY', 'CX', 'CP', 'SWAP', 'CCX', 'QFT', 'IQFT', 'IQFT2'];
    const exactMatchBases = new Set(['QFT', 'IQFT', 'IQFT2']);
    const uniqueBases = allBases.filter(base =>
        exactMatchBases.has(base)
            ? state.activeSet.includes(base)
            : state.activeSet.some(g => g.startsWith(base))
    );

    uniqueBases.forEach(baseType => {
        const item = document.createElement('div');
        item.className = `palette-item tt ${state.selectedBaseGate === baseType ? 'selected' : ''}`;
        if (GATE_TIPS[baseType]) item.dataset.tooltip = GATE_TIPS[baseType];
        item.style.height = `${h}px`;
        
        // Mock a beautifully formatted gate just for the palette display
        let renderGate = baseType;
        if (baseType.startsWith('RZ')) renderGate = `RZ_${state.currentRzAngle}_0`;
        else if (baseType.startsWith('RY')) renderGate = `RY_PI2_0`;
        else if (baseType.startsWith('CP')) renderGate = `CP_${state.currentRzAngle}_01`;
        else if (baseType === 'CX' || baseType === 'SWAP') renderGate = `${baseType}01`;
        else if (baseType === 'CCX') renderGate = `CCX012`;
        else if (baseType === 'QFT' || baseType === 'IQFT' || baseType === 'IQFT2') renderGate = baseType;
        else renderGate = `${baseType}0`;

        // NEW: Force QFT to have mockQubits = 1 so it fits neatly in the menu
        let mockQubits = (baseType === 'QFT' || baseType === 'IQFT' || baseType === 'IQFT2') ? 1 :
                         (baseType === 'CCX' && state.numQubits > 2) ? 3 : 
                         (['CX', 'CP', 'SWAP'].includes(baseType) && state.numQubits > 1) ? 2 : 1;
        
        // FIX: Force the toolbar container wrapper to establish a strict relative context with absolute alignment flex
        item.style.position = 'relative';
        item.style.height = `${h}px`;
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'center';

        // Wrap the standard column HTML generator inside an inner layout anchor that explicitly stretches full-width
        item.innerHTML = `<div style="position: relative; width: 100%; height: 100%;">${getColumnHTML([renderGate], mockQubits)}</div>`;
        
        item.addEventListener('click', () => {
            if(state.gameOver) return;
            state.selectedBaseGate = (state.selectedBaseGate === baseType) ? null : baseType;
            state.placement = { active: false, col: null, controls: [] }; 
            renderPalette(); 

            if (state.isTutorial && state.tutorialPhase === 'SELECT_GATE') {
                state.tutorialPhase = 'PLACE_GATE';
                setGhostPointer('GRID', 0);
            }
        });
        palette.appendChild(item);
    });
}

function renderBoard() {
    const board = document.getElementById('board');
    
    // Only clear history if row-active DOESN'T exist (meaning fresh game)
    let wrap = document.getElementById('row-active');
    if (!wrap) {
        const historyBoard = document.getElementById('history-board');
        if (historyBoard) historyBoard.innerHTML = ''; 
        const oldReveal = document.getElementById('reveal-circuit-wrap');
        if (oldReveal) oldReveal.remove();
        
        wrap = document.createElement('div');
        wrap.className = `row-wrapper active`;
        wrap.id = `row-active`;
        board.appendChild(wrap);
    } else {
        wrap.innerHTML = ''; // Just clear the inside for a redraw
    }

    const attemptsCounter = document.getElementById('attempts-counter');
    const timedBar = document.getElementById('timed-status-bar');
    if (state.isVariational || state.currentMode === 'FREEPLAY' || state.currentMode === 'LAB' || state.currentMode === 'QFT_LAB') {
        attemptsCounter.style.display = 'none';
        timedBar.classList.add('hidden');
    } else if (state.currentMode === 'TIMED') {
        attemptsCounter.style.display = 'none';
        timedBar.classList.remove('hidden');
        updateTimedStatusBar(state);
    } else if (state.currentMode === 'QUIZ') {
        attemptsCounter.style.display = 'block';
        attemptsCounter.innerText = `Attempts Remaining: ${3 - state.attempts}`;
    } else {
        attemptsCounter.style.display = 'block';
        attemptsCounter.innerText = `Attempts Remaining: ${6 - state.attempts}`;
        timedBar.classList.add('hidden');
    }

    const rowHeight = Math.max(60, state.numQubits * 30);
    const sub = ['₀', '₁', '₂'];
    
    const circuitRow = document.createElement('div');
    circuitRow.className = 'circuit-row';
    circuitRow.style.height = `${rowHeight}px`;
    
    const labels = document.createElement('div');
    labels.className = 'qubit-labels';
    let lbls = '';
    for(let q=0; q<state.numQubits; q++) lbls += `<span>q${sub[q]}</span>`;
    labels.innerHTML = lbls;
    circuitRow.appendChild(labels);
    
    // Build the Grid!
    for (let c = 0; c < state.numCols; c++) {
        const slotCol = document.createElement('div');
        slotCol.className = 'slot-column';
        slotCol.id = `slot-active-${c}`; // Validator uses this to lock the board
        
        // Layer 1: The visual gates
        const gatesLayer = document.createElement('div');
        gatesLayer.style.position = 'absolute';
        gatesLayer.style.top = '0'; gatesLayer.style.left = '0'; gatesLayer.style.right = '0'; gatesLayer.style.bottom = '0';
        gatesLayer.innerHTML = getColumnHTML(state.currentGuess[c] || [], state.numQubits);
        slotCol.appendChild(gatesLayer);

        // Layer 2: The invisible interactive tap zones
        if (!state.gameOver && !state.isVariational) {
            for(let q = 0; q < state.numQubits; q++) {
                const cell = document.createElement('div');
                cell.className = 'cell-zone';
                
                // Highlight yellow if currently placing a multi-qubit gate
                if (state.placement.active && state.placement.col === c && state.placement.controls.includes(q)) {
                    cell.classList.add('pending');
                }
                
                cell.addEventListener('click', () => handleCellTap(c, q, state, renderBoard));
                slotCol.appendChild(cell);
            }
        }
        
        circuitRow.appendChild(slotCol);
    }
    wrap.appendChild(circuitRow);
}

function endTimedSession() {
    if (state._timedSessionEnded) return;
    state._timedSessionEnded = true;
    if (state._timerIntervalId) {
        clearInterval(state._timerIntervalId);
        state._timerIntervalId = null;
    }
    state.gameOver = true;
    document.getElementById('submit-btn').classList.add('hidden');

    const diffNames = ['Easy', 'Medium', 'Hard'];

    if (state.isDuelMode) {
        // Player 2 result: compare against challenger's score
        const won = state.timedScore > state.duelOpponentScore;
        const tied = state.timedScore === state.duelOpponentScore;
        const opName = state.duelOpponentName || 'Challenger';
        const resultTitle = tied ? "It's a Tie!" : (won ? '⚔️ You Win!' : '⚔️ They Win!');
        const resultSub = tied
            ? `Both scored ${state.timedScore} — dead even!`
            : (won
                ? `You beat ${opName}'s score of ${state.duelOpponentScore}!`
                : `${opName} scored ${state.duelOpponentScore} — try again!`);
        if (won && unlockAchievement('win_challenge')) {
            const _a = ACHIEVEMENT_MAP['win_challenge'];
            if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 900);
        }
        setTimeout(() => {
            showVictoryModal(resultTitle, resultSub,
                `Your Score: ${state.timedScore} | ${opName}: ${state.duelOpponentScore}`,
                false, null);
        }, 300);
    } else {
        // Normal session: save best + offer challenge link
        const isNewBest = saveTimedBest(state.currentLvl, state.timedScore);
        const bestScore = timedBest[state.currentLvl - 1];
        const statsText = isNewBest
            ? `Score: ${state.timedScore} 🎉 New Best!`
            : `Score: ${state.timedScore} | Best: ${bestScore}`;

        // Achievement checks for timed session
        const timedAchToasts = [];
        const timedTryUnlock = (id) => {
            if (unlockAchievement(id)) {
                const a = ACHIEVEMENT_MAP[id];
                if (a) timedAchToasts.push({ name: a.name, icon: a.icon });
            }
        };
        if (state.timedScore >= 5)  timedTryUnlock('time_bender');
        if (state.timedScore >= 15) timedTryUnlock('clock_crusher');
        timedAchToasts.forEach((t, i) => setTimeout(() => showAchievementToast(t.name, t.icon), 900 + i * 1700));

        setTimeout(() => {
            showVictoryModal(
                "Time's Up!",
                `${diffNames[state.currentLvl - 1]} — ${state.timedCircuitsSolved} circuit${state.timedCircuitsSolved !== 1 ? 's' : ''} solved`,
                statsText, false, null
            );
            // Inject "Challenge a Friend" button into the modal
            const controls = document.querySelector('#victory-modal .victory-controls');
            if (controls && !document.getElementById('modal-duel-btn')) {
                const duelBtn = document.createElement('button');
                duelBtn.id = 'modal-duel-btn';
                duelBtn.className = 'btn';
                duelBtn.style.background = '#7c3aed';
                duelBtn.innerText = '⚔️ Challenge a Friend';
                duelBtn.addEventListener('click', () => {
                    if (unlockAchievement('challenge_friend')) {
                        const _a = ACHIEVEMENT_MAP['challenge_friend'];
                        if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 200);
                    }
                    const url = `${window.location.origin}${window.location.pathname}?duel=${state.currentLvl}-${state.duelSeed}-${state.timedScore}`;
                    navigator.clipboard.writeText(url).then(() => {
                        duelBtn.innerText = 'Link Copied! ✓';
                        duelBtn.style.background = '#059669';
                        setTimeout(() => {
                            duelBtn.innerText = '⚔️ Challenge a Friend';
                            duelBtn.style.background = '#7c3aed';
                        }, 2500);
                    });
                });
                controls.insertBefore(duelBtn, controls.firstChild);
            }
        }, 300);
    }
}

// --- Attach Static Event Listeners ---

// 1. Menu Accordions
function showModePanel(name) {
    document.getElementById('mode-cards').classList.add('hidden');
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`panel-${name}`).classList.remove('hidden');
    if (name === 'achievements') {
        renderAchievementsPanel(unlockedAchievements, achievementProgress);
    }
}
function showModeCards() {
    document.getElementById('mode-cards').classList.remove('hidden');
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
}

// Applies the result object returned by submitGuess() — all DOM work lives here.
function applySubmitResult(result, state, renderBoard) {
    // --- Snapshot modes (FREEPLAY, QFT_LAB) ---
    if (result.type === 'FREEPLAY_SNAPSHOT' || result.type === 'QFT_LAB_SNAPSHOT') {
        const wrap = document.getElementById('row-active');
        wrap.querySelectorAll('.amplitudes-result').forEach(el => el.remove());
        const ampDiv = document.createElement('div');
        ampDiv.className = 'amplitudes-result';
        ampDiv.innerText = result.ampText;
        wrap.appendChild(ampDiv);
        return;
    }

    if (result.type === 'LAB_WIN') {
        const wrap = document.getElementById('row-active');
        wrap.querySelectorAll('.amplitudes-result').forEach(el => el.remove());
        const ampDiv = document.createElement('div');
        ampDiv.className = 'amplitudes-result';
        ampDiv.innerText = result.ampText;
        wrap.appendChild(ampDiv);
        const submitBtnEl = document.getElementById('submit-btn');
        submitBtnEl.classList.add('hidden');
        wrap.classList.remove('active');
        fireQuantumConfetti(result.btnRect.left + result.btnRect.width / 2, result.btnRect.top);
        setTimeout(() => {
            showVictoryModal('Fourier Encoded!', `|0⟩ → |${result.labTargetN}⟩ — you encoded +${result.labTargetN} in the Fourier basis!`, null, false, null);
            const controls = document.querySelector('#victory-modal .victory-controls');
            if (controls && !document.getElementById('modal-lab-next-btn')) {
                const tryBtn = document.createElement('button');
                tryBtn.id = 'modal-lab-next-btn';
                tryBtn.className = 'btn';
                tryBtn.style.background = '#f59e0b';
                tryBtn.innerText = 'Try Another Number';
                tryBtn.addEventListener('click', () => hideVictoryModal());
                controls.insertBefore(tryBtn, controls.firstChild);
            }
        }, 500);
        return;
    }

    if (result.type === 'LAB_LOSE') {
        const wrap = document.getElementById('row-active');
        wrap.querySelectorAll('.amplitudes-result').forEach(el => el.remove());
        const ampDiv = document.createElement('div');
        ampDiv.className = 'amplitudes-result';
        ampDiv.innerText = result.ampText;
        wrap.appendChild(ampDiv);
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        const msg = document.getElementById('message');
        msg.style.color = '#eab308';
        msg.innerText = `Not |${result.labTargetN}⟩ yet — check the state vector and adjust the phases!`;
        setTimeout(() => { if (!state.gameOver) msg.innerText = ''; }, 3000);
        return;
    }

    // TIMED_EXPIRED: timer hit zero mid-guess — just update the status bar visual
    if (result.type === 'TIMED_EXPIRED') {
        const wrap = document.getElementById('row-active');
        for (let c = 0; c < result.colStatusMaps.length; c++) {
            const slot = document.getElementById(`slot-active-${c}`);
            if (slot) {
                const { guessGates, gateStatusMap } = result.colStatusMaps[c];
                slot.innerHTML = getColumnHTML(guessGates, state.numQubits, gateStatusMap);
            }
        }
        const ampDiv = document.createElement('div');
        ampDiv.className = 'amplitudes-result';
        ampDiv.innerText = result.ampText;
        wrap.appendChild(ampDiv);
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        updateTimedStatusBar(state);
        return;
    }

    // --- Main path: apply column colors (common to WIN and LOSE) ---
    const wrap = document.getElementById('row-active');
    for (let c = 0; c < result.colStatusMaps.length; c++) {
        const slot = document.getElementById(`slot-active-${c}`);
        if (slot) {
            const { guessGates, gateStatusMap } = result.colStatusMaps[c];
            slot.innerHTML = getColumnHTML(guessGates, state.numQubits, gateStatusMap);
        }
    }
    const ampDiv = document.createElement('div');
    ampDiv.className = 'amplitudes-result';
    ampDiv.innerText = result.ampText;
    wrap.appendChild(ampDiv);

    if (result.type === 'WIN') {
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.classList.add('hidden');
        wrap.classList.remove('active');
        fireQuantumConfetti(result.confettiOrigin.x, result.confettiOrigin.y);

        if (result.winMode === 'TIMED') {
            updateTimedStatusBar(state);
            const msg = document.getElementById('message');
            msg.innerText = `Solved! +${result.timeBonus}s`;
            msg.style.color = '#22c55e';
            setTimeout(() => { msg.innerText = ''; state.timedNextPuzzle && state.timedNextPuzzle(); }, 1500);
            return;
        }

        if (result.winMode === 'QUIZ') {
            const msg = document.getElementById('message');
            msg.innerText = '✓ Correct!';
            msg.style.color = '#22c55e';
            setTimeout(() => {
                msg.innerText = '';
                if (result.quizFinal) window.showQuizVictory?.();
                else window.quizNextQuestion?.();
            }, 900);
            return;
        }

        // STAGE_RANDOM_DAILY
        if (result.wasTutorial) clearGhostPointer();

        if (result.strictColorFixMaps) {
            for (let c = 0; c < result.strictColorFixMaps.length; c++) {
                const slot = document.getElementById(`slot-active-${c}`);
                if (slot) {
                    const { guessGates, gateStatusMap } = result.strictColorFixMaps[c];
                    slot.innerHTML = getColumnHTML(guessGates, state.numQubits, gateStatusMap);
                }
            }
        }

        result.achToasts.forEach((t, i) => setTimeout(() => showAchievementToast(t.name, t.icon), 900 + i * 1700));

        setTimeout(() => {
            showVictoryModal(result.mainTitle, result.subTitle, result.statsText, result.showNextBtn, result.revealObj);
            const _menuBtn = document.getElementById('modal-menu-btn');
            if (_menuBtn) _menuBtn.textContent = result.menuBtnLabel;

            if (result.isFinalSubstage) {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-test-yourself-btn')) {
                    const testBtn = document.createElement('button');
                    testBtn.id = 'modal-test-yourself-btn';
                    testBtn.className = 'btn';
                    testBtn.style.background = '#f59e0b';
                    testBtn.style.color = '#0f172a';
                    testBtn.style.fontWeight = '700';
                    testBtn.innerText = 'Test Yourself ★';
                    testBtn.addEventListener('click', () => { hideVictoryModal(); initGame('QUIZ', result.currentP1); });
                    controls.insertBefore(testBtn, controls.firstChild);
                }
            }

            if (result.currentMode === 'RANDOM') {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-restart-btn')) {
                    const retryBtn = document.createElement('button');
                    retryBtn.id = 'modal-restart-btn';
                    retryBtn.className = 'btn';
                    retryBtn.style.background = '#3b82f6';
                    retryBtn.innerText = 'Retry Same Circuit';
                    retryBtn.addEventListener('click', () => { document.dispatchEvent(new CustomEvent('restart-circuit')); });
                    controls.insertBefore(retryBtn, controls.firstChild);
                }
                if (controls && !document.getElementById('modal-play-challenge-btn')) {
                    const challengeBtn = document.createElement('button');
                    challengeBtn.id = 'modal-play-challenge-btn';
                    challengeBtn.className = 'btn';
                    challengeBtn.style.background = '#7c3aed';
                    challengeBtn.innerText = '⚔️ Challenge a Friend';
                    challengeBtn.addEventListener('click', () => {
                        if (unlockAchievement('challenge_friend')) {
                            const _a = ACHIEVEMENT_MAP['challenge_friend'];
                            if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 200);
                        }
                        const url = `${window.location.origin}${window.location.pathname}?play-challenge=${result.currentLvl}-${result.randomSeed}-${result.randomGateMask}`;
                        navigator.clipboard.writeText(url).then(() => {
                            challengeBtn.innerText = 'Link Copied! ✓';
                            challengeBtn.style.background = '#059669';
                            setTimeout(() => { challengeBtn.innerText = '⚔️ Challenge a Friend'; challengeBtn.style.background = '#7c3aed'; }, 2500);
                        });
                    });
                    controls.insertBefore(challengeBtn, controls.firstChild);
                }
            } else if (result.currentMode === 'DAILY') {
                const controls = document.querySelector('#victory-modal .victory-controls');
                if (controls && !document.getElementById('modal-daily-next-btn') && result.currentLvl < 3) {
                    const nextLvlName = result.currentLvl === 1 ? 'Medium' : 'Hard';
                    const nextBtn = document.createElement('button');
                    nextBtn.id = 'modal-daily-next-btn';
                    nextBtn.className = 'btn';
                    nextBtn.style.background = '#0ea5e9';
                    nextBtn.innerText = `Next: ${nextLvlName} →`;
                    nextBtn.addEventListener('click', () => { hideVictoryModal(); window.initDailyGame(result.currentLvl + 1); });
                    controls.insertBefore(nextBtn, controls.firstChild);
                }
                if (controls && !document.getElementById('modal-daily-challenge-btn')) {
                    const challengeBtn = document.createElement('button');
                    challengeBtn.id = 'modal-daily-challenge-btn';
                    challengeBtn.className = 'btn';
                    challengeBtn.style.background = '#059669';
                    challengeBtn.innerText = '📅 Challenge a Friend';
                    challengeBtn.addEventListener('click', () => {
                        if (unlockAchievement('challenge_friend')) {
                            const _a = ACHIEVEMENT_MAP['challenge_friend'];
                            if (_a) setTimeout(() => showAchievementToast(_a.name, _a.icon), 200);
                        }
                        const url = `${window.location.origin}${window.location.pathname}?daily-challenge=${result.currentLvl}`;
                        navigator.clipboard.writeText(url).then(() => {
                            challengeBtn.innerText = 'Link Copied! ✓';
                            challengeBtn.style.background = '#7c3aed';
                            setTimeout(() => { challengeBtn.innerText = '📅 Challenge a Friend'; challengeBtn.style.background = '#059669'; }, 2500);
                        });
                    });
                    controls.insertBefore(challengeBtn, controls.firstChild);
                }
            }
        }, 500);
        return;
    }

    // --- LOSE path ---
    if (result.loseMode === 'TIMED_OUT_OF_ATTEMPTS') {
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        wrap.classList.remove('active');
        document.getElementById('submit-btn').classList.add('hidden');
        updateTimedStatusBar(state);
        const msg = document.getElementById('message');
        msg.innerText = 'Out of attempts! Loading next...';
        msg.style.color = '#ef4444';
        setTimeout(() => { msg.innerText = ''; state.timedNextPuzzle && state.timedNextPuzzle(); }, 1500);
        return;
    }

    if (result.loseMode === 'TIMED') {
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        updateTimedStatusBar(state);
        const msg = document.getElementById('message');
        msg.innerText = result.timedPenaltyMsg;
        msg.style.color = '#eab308';
        setTimeout(() => { if (!state.gameOver) msg.innerText = ''; }, 2000);
        updateActiveRow(state, renderBoard);
        const newWrap = document.getElementById('row-active');
        result.prevAmps.forEach(text => {
            const el = document.createElement('div');
            el.className = 'amplitudes-result';
            el.innerText = text;
            newWrap.appendChild(el);
        });
        if (result.hintText) {
            const hintEl = document.createElement('div');
            hintEl.className = 'amplitudes-result';
            hintEl.style.color = '#38bdf8';
            hintEl.innerText = result.hintText;
            newWrap.appendChild(hintEl);
        }
        return;
    }

    if (result.loseMode === 'TUTORIAL') {
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        updateActiveRow(state, renderBoard);
        clearGhostPointer();
        setGhostPointer('EVALUATE');
        const msg = document.getElementById('message');
        msg.style.color = '#38bdf8';
        msg.innerText = "Here's the correct circuit — hit Evaluate to complete the tutorial!";
        return;
    }

    if (result.loseMode === 'QUIZ_OUT_OF_LIVES') {
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        document.getElementById('submit-btn').classList.add('hidden');
        wrap.classList.remove('active');
        const msg = document.getElementById('message');
        msg.innerText = result.quizMsg;
        msg.style.color = '#ef4444';
        setTimeout(() => { msg.innerText = ''; window.showQuizResult?.(); }, 1600);
        return;
    }

    if (result.loseMode === 'QUIZ_QUESTION_FAILED_LIVES_REMAIN') {
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        document.getElementById('submit-btn').classList.add('hidden');
        wrap.classList.remove('active');
        const msg = document.getElementById('message');
        msg.innerText = result.quizMsg;
        msg.style.color = result.quizMsgColor;
        const failActions = document.getElementById('quiz-fail-actions');
        const reviewBtn = document.getElementById('quiz-fail-review-btn');
        if (failActions && reviewBtn) {
            reviewBtn.textContent = `Review ${result.quizFailLevelLabel}`;
            failActions.classList.remove('hidden');
        }
        return;
    }

    if (result.loseMode === 'QUIZ_PARTIAL') {
        wrap.classList.add('wrong-attempt');
        wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });
        const msg = document.getElementById('message');
        msg.innerText = result.quizMsg;
        msg.style.color = result.quizMsgColor;
        setTimeout(() => { if (!state.gameOver) msg.innerText = ''; }, 2000);
        updateActiveRow(state, renderBoard);
        return;
    }

    // STAGE_WRONG / STAGE_GAME_OVER
    document.getElementById('attempts-counter').innerText = `Attempts Remaining: ${result.attemptsRemaining}`;
    wrap.classList.add('wrong-attempt');
    wrap.addEventListener('animationend', () => wrap.classList.remove('wrong-attempt'), { once: true });

    // Clone the colored row to history BEFORE resetting the board
    const historyWrap = wrap.cloneNode(true);
    historyWrap.removeAttribute('id');
    historyWrap.classList.remove('active', 'wrong-attempt');
    historyWrap.querySelectorAll('.slot').forEach(s => s.removeAttribute('id'));
    document.getElementById('history-board').appendChild(historyWrap);

    if (result.loseMode === 'STAGE_GAME_OVER') {
        wrap.classList.remove('active');
        document.getElementById('submit-btn').classList.add('hidden');
        document.getElementById('message').innerText = "Measurement collapsed! Game Over.";
        document.getElementById('message').style.color = "#ef4444";
        showRevealCircuit("The Target Circuit Was:", result.revealCircuit.color, result.revealCircuit.targetCircuit, result.revealCircuit.numQubits);
        document.getElementById('again-btn').innerText = result.againBtnLabel;
        document.getElementById('again-btn').classList.remove('hidden');
        if (result.showRestartBtn) document.getElementById('restart-btn').classList.remove('hidden');
    } else {
        // STAGE_WRONG: show strict message if present, rebuild the active row
        if (result.strictMsg) {
            const msg = document.getElementById('message');
            msg.innerText = result.strictMsg;
            msg.style.color = '#eab308';
            setTimeout(() => { if (!state.gameOver) msg.innerText = ''; }, 2500);
        }
        updateActiveRow(state, renderBoard);
        const activeAmpResult = wrap.querySelector('.amplitudes-result');
        if (activeAmpResult) activeAmpResult.remove();
    }
}
document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => showModePanel(card.dataset.mode));
});
// Play sub-panel back buttons → back to mode cards (within play page)
document.querySelectorAll('#mode-panels .panel-back-btn').forEach(btn => {
    btn.addEventListener('click', showModeCards);
});
// Page-level back buttons → home
document.getElementById('stages-back-btn').addEventListener('click', showMainMenu);
document.getElementById('play-page-back-btn').addEventListener('click', showMainMenu);
document.getElementById('section-back-btn').addEventListener('click', showStagesPage);

// 2. Play Menu Configurations
document.getElementById('btn-toggle-gates').addEventListener('click', toggleAllGates);
document.getElementById('btn-score-info').addEventListener('click', () => showInfoModal());
document.getElementById('close-info-btn').addEventListener('click', () => hideInfoModal());
document.getElementById('btn-rand-1').addEventListener('click', () => initGame('RANDOM', 1));
document.getElementById('btn-rand-2').addEventListener('click', () => initGame('RANDOM', 2));
document.getElementById('btn-rand-3').addEventListener('click', () => initGame('RANDOM', 3));

// 3. Timed Menu
document.getElementById('btn-timed-1').addEventListener('click', () => initGame('TIMED', 1));
document.getElementById('btn-timed-2').addEventListener('click', () => initGame('TIMED', 2));
document.getElementById('btn-timed-3').addEventListener('click', () => initGame('TIMED', 3));

// 4. Sandbox Menu
document.getElementById('btn-free-1').addEventListener('click', () => initGame('FREEPLAY', 1));
document.getElementById('btn-free-2').addEventListener('click', () => initGame('FREEPLAY', 2));
document.getElementById('btn-free-3').addEventListener('click', () => initGame('FREEPLAY', 3));

// 4. Game Controls
document.getElementById('submit-btn').addEventListener('click', () => {
    const result = submitGuess(state, renderBoard, gameStartTime);
    if (result) applySubmitResult(result, state, renderBoard);
});
document.getElementById('clear-btn').addEventListener('click', () => {
    if (state.gameOver || state.currentMode !== 'FREEPLAY') return;
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    state.placement = { active: false, col: null, controls: [] }; // Reset placement
    
    const wrap = document.getElementById('row-active');
    if (wrap) {
        const results = wrap.querySelectorAll('.amplitudes-result');
        results.forEach(el => el.remove());
    }
    updateActiveRow(state, renderBoard); // Pass the callback!
});
function doRestartCircuit() {
    if (state.currentMode !== 'RANDOM') return;
    state.attempts = 0;
    state.gameOver = false;
    state.currentGuess = Array(state.numCols).fill().map(() => []);
    state.placement = { active: false, col: null, controls: [] };
    state.selectedBaseGate = null;

    document.getElementById('message').innerText = '';
    document.getElementById('again-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('board').innerHTML = '';
    document.getElementById('history-board').innerHTML = '';
    document.querySelectorAll('#reveal-circuit-wrap').forEach(el => el.remove());

    renderPalette();
    renderBoard();
    updateBlochSpheres(state.currentGuess, state.numQubits);
}
document.getElementById('restart-btn').addEventListener('click', doRestartCircuit);
document.addEventListener('restart-circuit', () => { hideVictoryModal(); doRestartCircuit(); });

document.getElementById('stage-prev-btn').addEventListener('click', () => {
    if (state.currentP2 > 0) {
        initGame('STAGE', state.currentP1, state.currentP2 - 1);
    } else if (state.currentP1 > 0) {
        const prevStage = state.currentP1 - 1;
        initGame('STAGE', prevStage, STAGES[prevStage].levels.length - 1);
    }
});
document.getElementById('stage-next-btn').addEventListener('click', () => {
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0);
    }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0); 
    } else {
        showMainMenu(); 
    }
});

// 5. Palette Selectors
const rzSelect = document.getElementById('rz-angle');
if (rzSelect) {
    rzSelect.addEventListener('change', (e) => {
        state.currentRzAngle = e.target.value;
        renderPalette();
    });
}

// 6. Logo + Menu button
function goToMainMenu() {
    state.currentStreak = 0;
    if (state._timerIntervalId) { clearInterval(state._timerIntervalId); state._timerIntervalId = null; }
    document.getElementById('back-to-results-btn').classList.add('hidden');
    showMainMenu();
}
document.getElementById('game-menu-btn').addEventListener('click', goToMainMenu);

// 7. Modal Buttons
document.getElementById('modal-next-btn').addEventListener('click', () => {
    hideVictoryModal();
    if (state._sectionJustCompleted) {
        state._sectionJustCompleted = false;
        showSectionCompleteOverlay();
        return;
    }
    if (state.currentMode === 'QUIZ') {
        const nextSIdx = state._quizSIdx + 1;
        if (nextSIdx < STAGES.length) initGame('STAGE', nextSIdx, 0);
        else showMainMenu();
        return;
    }
    if (state.currentP2 + 1 < STAGES[state.currentP1].levels.length) {
        initGame('STAGE', state.currentP1, state.currentP2 + 1);
    } else if (state.currentP1 + 1 < STAGES.length) {
        initGame('STAGE', state.currentP1 + 1, 0);
    } else {
        showMainMenu();
    }
});

document.getElementById('again-btn').addEventListener('click', () => {
    if (state.currentMode === 'RANDOM') initGame('RANDOM', state.currentLvl);
    else if (state.currentMode === 'DAILY') initGame('DAILY', state.currentLvl); // <-- ADDED
    else if (state.currentMode === 'STAGE') initGame('STAGE', state.currentP1, state.currentP2);
});

document.getElementById('modal-again-btn').addEventListener('click', () => {
    hideVictoryModal();
    state._sectionJustCompleted = false;
    const againBtn = document.getElementById('modal-again-btn');
    if (againBtn) againBtn.classList.remove('hidden'); // restore in case quiz hid it
    if (state.currentMode === 'RANDOM') initGame('RANDOM', state.currentLvl);
    else if (state.currentMode === 'DAILY') initGame('DAILY', state.currentLvl);
    else if (state.currentMode === 'STAGE') initGame('STAGE', state.currentP1, state.currentP2);
    else if (state.currentMode === 'TIMED') initGame('TIMED', state.currentLvl);
});

document.getElementById('btn-daily-1')?.addEventListener('click', () => initGame('DAILY', 1));
document.getElementById('btn-daily-2')?.addEventListener('click', () => initGame('DAILY', 2));
document.getElementById('btn-daily-3')?.addEventListener('click', () => initGame('DAILY', 3));

document.getElementById('modal-menu-btn').addEventListener('click', () => {
    hideVictoryModal();
    if (state._timerIntervalId) { clearInterval(state._timerIntervalId); state._timerIntervalId = null; }
    const _againBtn = document.getElementById('modal-again-btn');
    if (_againBtn) _againBtn.classList.remove('hidden'); // restore if quiz hid it
    if (state._sectionJustCompleted) {
        state._sectionJustCompleted = false;
        showSectionCompleteOverlay();
    } else if (state.currentMode === 'STAGE' || state.currentMode === 'QUIZ') {
        showCurrentSection();
    } else {
        showMainMenu();
    }
});

document.getElementById('modal-view-solution-btn').addEventListener('click', () => {
    hideVictoryModal();
    document.getElementById('back-to-results-btn').classList.remove('hidden');
});

document.getElementById('back-to-results-btn').addEventListener('click', () => {
    document.getElementById('back-to-results-btn').classList.add('hidden');
    const overlay = document.getElementById('victory-modal');
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('show'), 10);
});

document.getElementById('tt-next').addEventListener('click', nextTourStep);
document.getElementById('tt-skip').addEventListener('click', () => {
    endTour();
    setTutorialComplete();
    trackTutorialSkipped();
    state.isTutorial = false;
    state.tutorialPhase = 'NONE';
});
document.getElementById('btn-replay-tutorial')?.addEventListener('click', () => {
    showTutorialPrompt(
        () => {
            initGame('RANDOM', 1);
            setTimeout(() => {
                state.isTutorial = true;
                state.tutorialPhase = 'SELECT_GATE';
                setGhostPointer('PALETTE_ANY');
            }, 400);
        },
        () => {}
    );
});

// --- Boot App ---
buildMenu();

// Handle duel challenge acceptance (fired by showDuelChallengeBanner in ui.js)
document.addEventListener('duel-accept', (e) => {
    initGame('TIMED', e.detail.difficulty);
});

document.addEventListener('play-challenge-accept', (e) => {
    const { difficulty, seed, gateMask } = e.detail;
    state.randomSeed = seed;
    state._usePresetSeed = true;
    if (gateMask !== undefined) {
        GATE_MASK_ORDER.forEach((gate, i) => {
            const cb = document.getElementById(GATE_CHECKBOX_IDS[gate]);
            if (cb) cb.checked = !!(gateMask & (1 << i));
        });
    }
    initGame('RANDOM', difficulty);
});

document.addEventListener('daily-challenge-accept', (e) => {
    initGame('DAILY', e.detail.difficulty);
});

// Check for incoming play challenge link
const _playParam = new URLSearchParams(window.location.search).get('play-challenge');
if (_playParam) {
    const _pParts = _playParam.split('-');
    if (_pParts.length >= 2) {
        const _pDiff = parseInt(_pParts[0]);
        const _pSeed = parseInt(_pParts[1]);
        const _pMask = _pParts.length >= 3 ? parseInt(_pParts[2]) : undefined;
        state.randomSeed = _pSeed;
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        showPlayChallengeBanner(_pDiff, _pSeed, _pMask);
    }
}

// Check for incoming daily challenge link
const _dailyChallengeParam = new URLSearchParams(window.location.search).get('daily-challenge');
if (_dailyChallengeParam) {
    const _dcDiff = parseInt(_dailyChallengeParam);
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    showDailyChallengeBanner(_dcDiff);
}

// Check for incoming duel challenge link
const _duelParam = new URLSearchParams(window.location.search).get('duel');
if (_duelParam) {
    const _parts = _duelParam.split('-');
    if (_parts.length >= 3) {
        const _diff = parseInt(_parts[0]);
        state.isDuelMode = true;
        state.duelSeed = parseInt(_parts[1]);
        state.duelOpponentScore = parseInt(_parts[2]);
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        showDuelChallengeBanner(_diff, state.duelOpponentScore);
    }
}

// Boot: sync remote progress then handle the initial route
setSyncHook(schedulePush);
(async () => {
    const session = await initSync(applyRemoteProgress);
    trackSessionStart();
    if (session?.email) _showApp(session.email);
    const _bootHash = window.location.hash;
    if (_bootHash && _bootHash !== '#/' && _bootHash.startsWith('#/')) {
        handleRoute(_bootHash);
    }
})();

