import { computeStateVector, stateToString } from '../quantum/engine.js';
import { GATE_MATRICES } from '../quantum/gates.js';
import { updateBlochSpheres, updateTargetBlochSphere, parseMarkdownAndMath, fireQuantumConfetti } from './ui.js';
import { drawBlochSphereDual, initBlochTrackball } from '../quantum/bloch.js';

// X gates needed to encode |n⟩ for 3 qubits: qubit 0 = MSB (weight 4), qubit 2 = LSB (weight 1)
export const QFT_LAB_CONFIGS = {
    0: [],
    1: ['X2'],
    2: ['X1'],
    3: ['X1', 'X2'],
    4: ['X0'],
    5: ['X0', 'X2'],
    6: ['X0', 'X1'],
    7: ['X0', 'X1', 'X2'],
};

// Phase rotations for the QFT Adder Lab: phaseCols[0] and [1] are the two middle columns
// Phase for qubit j = 2π × n / 2^(j+1), where qubit 0 = top (MSB), qubit 2 = bottom (LSB)
export const LAB_CONFIGS = {
    1: [['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0'],             []],
    2: [['RZ_PI2_2', 'RZ_PI_1'],                          []],
    3: [['RZ_PI4_2', 'RZ_MINUS_PI2_1', 'RZ_PI_0'],        ['RZ_PI2_2']],
    4: [['RZ_PI_2'],                                       []],
    5: [['RZ_PI_2'],                                       ['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0']],
    6: [['RZ_MINUS_PI2_2', 'RZ_PI_1'],                    []],
    7: [['RZ_MINUS_PI4_2', 'RZ_MINUS_PI2_1', 'RZ_PI_0'],  []],
};

export const LAB_HINTS = {
    1: 'RZ(π) on top · RZ(π/2) on middle · RZ(π/4) on bottom — fits in one column',
    2: 'RZ(π) on middle · RZ(π/2) on bottom — fits in one column',
    3: 'Col 2: RZ(π/4) on bottom, RZ(−π/2) on middle, RZ(π) on top | Col 3: RZ(π/2) on bottom',
    4: 'RZ(π) on bottom — fits in one column',
    5: 'Col 2: RZ(π) on bottom | Col 3: RZ(π/4) on bottom, RZ(π/2) on middle, RZ(π) on top',
    6: 'RZ(−π/2) on bottom · RZ(π) on middle — fits in one column',
    7: 'RZ(−π/4) on bottom · RZ(−π/2) on middle · RZ(π) on top — fits in one column',
};

// ── Shared lab playback interval ─────────────────────────────────────────────

let _labPlayInterval = null;

export function stopLabPlay() {
    clearInterval(_labPlayInterval);
    _labPlayInterval = null;
    const btn = document.getElementById('lab-play-btn');
    if (btn) btn.textContent = '▶';
}

export function toggleQftLabPlay(state, renderBoard) {
    if (_labPlayInterval) { stopLabPlay(); return; }
    document.getElementById('lab-play-btn').textContent = '⏸';
    _labPlayInterval = setInterval(() => {
        selectQftInput(((state.labTargetN ?? 0) + 1) % 8, state, renderBoard);
    }, 1500);
}

export function toggleAdderLabPlay(state, renderBoard) {
    if (_labPlayInterval) { stopLabPlay(); return; }
    document.getElementById('lab-play-btn').textContent = '⏸';
    _labPlayInterval = setInterval(() => {
        selectLabNumber(state.labTargetN >= 7 ? 1 : state.labTargetN + 1, state, renderBoard);
    }, 1500);
}

export function toggleGroverLabPlay() {
    if (_labPlayInterval) { stopLabPlay(); return; }
    document.getElementById('lab-play-btn').textContent = '⏸';
    _labPlayInterval = setInterval(() => {
        window._groverSetK((window._groverCurrentK ?? 0) >= 8 ? 0 : (window._groverCurrentK ?? 0) + 1);
    }, 1500);
}

// ── Grover Lab ────────────────────────────────────────────────────────────────

export function showGroverLab() {
    const θ = Math.asin(1 / Math.sqrt(8));
    let k = 1;

    function renderGroverLab() {
        const pTarget = Math.sin((2 * k + 1) * θ) ** 2;
        const pOther = (1 - pTarget) / 7;
        const probs = Array.from({length: 8}, (_, i) => i === 7 ? pTarget : pOther);
        const maxP = Math.max(...probs);
        const chartH = 100;
        const labels = ['000','001','010','011','100','101','110','111'];

        const barsHTML = probs.map((p, i) => {
            const isTarget = i === 7;
            const barH = Math.max(3, Math.round((p / maxP) * chartH));
            const pct = (p * 100).toFixed(1);
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:0;">
                <span style="font-size:0.6rem;color:${isTarget ? '#22c55e' : '#94a3b8'};white-space:nowrap;">${pct}%</span>
                <div style="width:70%;height:${barH}px;background:${isTarget ? '#22c55e' : '#6366f1'};border-radius:3px 3px 0 0;transition:height 0.3s ease;"></div>
                <span style="font-size:0.55rem;color:${isTarget ? '#22c55e' : '#64748b'};display:inline-block;transform:rotate(-45deg);transform-origin:top center;margin-top:4px;white-space:nowrap;">${labels[i]}</span>
            </div>`;
        }).join('');

        const isPlaying = !!_labPlayInterval;
        const panel = document.getElementById('grover-lab-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div style="font-size:0.9rem;font-weight:700;color:#22c55e;margin-bottom:10px;">Grover Iterations Lab</div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <button onclick="window.stopLabPlay(); window._groverSetK(${Math.max(0, k - 1)})" class="hint-btn" style="padding:2px 10px;font-size:1.1rem;line-height:1.3;" ${k === 0 ? 'disabled' : ''}>−</button>
                <span style="font-size:1rem;font-weight:700;min-width:130px;text-align:center;">k = ${k} iteration${k !== 1 ? 's' : ''}</span>
                <button onclick="window.stopLabPlay(); window._groverSetK(${Math.min(8, k + 1)})" class="hint-btn" style="padding:2px 10px;font-size:1.1rem;line-height:1.3;" ${k === 8 ? 'disabled' : ''}>+</button>
                <button id="lab-play-btn" class="hint-btn" style="padding:2px 10px;font-size:1.1rem;line-height:1.3;background:#22c55e;color:#0f172a;font-weight:700;" onclick="window.toggleGroverLabPlay()">${isPlaying ? '⏸' : '▶'}</button>
            </div>
            <div style="display:flex;align-items:flex-end;gap:2px;height:${chartH + 6}px;padding:0 2px;border-bottom:1px solid #334155;">
                ${barsHTML}
            </div>
            <div style="height:28px;"></div>
            <div style="margin-top:4px;font-size:0.8rem;color:#94a3b8;">
                P(|111⟩) = sin²((2·${k}+1)·θ) ≈ <span style="color:#22c55e;font-weight:700;">${(pTarget * 100).toFixed(1)}%</span>
                &nbsp;·&nbsp; θ = arcsin(1/√8) ≈ ${(θ * 180 / Math.PI).toFixed(1)}°
            </div>
            <div style="margin-top:3px;font-size:0.75rem;color:#64748b;">Search target: |111⟩ &nbsp;·&nbsp; Optimal k = 2 → P(|111⟩) ≈ ${(Math.sin(5 * θ) ** 2 * 100).toFixed(1)}%</div>
        `;
    }

    window._groverSetK = newK => { k = newK; window._groverCurrentK = newK; renderGroverLab(); };
    window._groverCurrentK = k;

    let panel = document.getElementById('grover-lab-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'grover-lab-panel';
        panel.style.cssText = 'margin-top:10px;padding:12px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;';
        const hintText = document.getElementById('hint-text');
        if (hintText) hintText.parentNode.insertBefore(panel, hintText.nextSibling);
        else document.getElementById('instructions').appendChild(panel);
    }
    panel.style.display = 'block';
    renderGroverLab();
}

// ── Bloch Explorer Lab ────────────────────────────────────────────────────────

export function showBlochExplorerLab() {
    let panel = document.getElementById('bloch-explorer-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'bloch-explorer-panel';
        panel.style.cssText = 'margin-top:10px;padding:14px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.3);border-radius:8px;';
        const hintText = document.getElementById('hint-text');
        if (hintText) hintText.parentNode.insertBefore(panel, hintText.nextSibling);
        else document.getElementById('instructions').appendChild(panel);
    }
    panel.style.display = 'block';

    // Uniform random point on sphere
    function randomTarget() {
        const u = Math.random(), v = Math.random();
        const theta = Math.acos(1 - 2 * u);
        const phi   = 2 * Math.PI * v;
        return {
            theta, phi,
            bloch: { x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta) }
        };
    }

    // Compute Bloch vector from RZ(phi)·RY(theta)|0⟩
    function currentBloch(theta, phi) {
        const a = { r: Math.cos(phi / 2) * Math.cos(theta / 2), i: -Math.sin(phi / 2) * Math.cos(theta / 2) };
        const b = { r: Math.cos(phi / 2) * Math.sin(theta / 2), i:  Math.sin(phi / 2) * Math.sin(theta / 2) };
        return {
            x: 2 * (a.r * b.r + a.i * b.i),
            y: 2 * (a.r * b.i - a.i * b.r),
            z: (a.r * a.r + a.i * a.i) - (b.r * b.r + b.i * b.i)
        };
    }

    // Fidelity between RZ·RY|0⟩ and target Bloch vector (both pure states)
    // For pure states: F = (1 + target·current) / 2
    function fidelity(cur, tgt) {
        return Math.max(0, (1 + cur.x * tgt.x + cur.y * tgt.y + cur.z * tgt.z) / 2);
    }

    let target = randomTarget();
    let thetaVal = 0, phiVal = 0;
    let celebrating = false;

    function render(checkWin = false) {
        const cur = currentBloch(thetaVal, phiVal);
        const fid = fidelity(cur, target.bloch);
        const pct = Math.round(fid * 100);

        drawBlochSphereDual('bloch-explorer-canvas', cur, target.bloch);

        const bar = document.getElementById('bloch-exp-bar');
        const val = document.getElementById('bloch-exp-fid');
        const status = document.getElementById('bloch-exp-status');
        if (bar) bar.style.width = pct + '%';
        if (val) val.textContent = pct + '%';

        if (checkWin && fid >= 0.99 && !celebrating) {
            celebrating = true;
            if (status) { status.textContent = 'Target reached!'; status.style.color = '#2dd4bf'; }
            const canvas = document.getElementById('bloch-explorer-canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                fireQuantumConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
            setTimeout(() => {
                target = randomTarget();
                thetaVal = 0; phiVal = 0;
                const st = document.getElementById('var-exp-theta');
                const sp = document.getElementById('var-exp-phi');
                const stv = document.getElementById('var-exp-theta-val');
                const spv = document.getElementById('var-exp-phi-val');
                if (st) { st.value = 0; stv.textContent = '0.00'; }
                if (sp) { sp.value = 0; spv.textContent = '0.00'; }
                celebrating = false;
                if (status) { status.textContent = ''; status.style.color = ''; }
                render(false);
            }, 1800);
        }
    }

    panel.innerHTML = `
        <div style="font-size:0.9rem;font-weight:700;color:#818cf8;margin-bottom:8px;">Bloch Sphere Explorer</div>
        <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:10px;">
            Match the <span style="color:#2dd4bf;font-weight:600;">teal target</span> using the two rotation gates.
            <span style="color:#ec4899;font-weight:600;">Pink</span> = your state.
        </div>
        <div style="display:flex;justify-content:center;margin-bottom:10px;">
            <canvas id="bloch-explorer-canvas" width="180" height="180"></canvas>
        </div>
        <div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#cbd5e1;margin-bottom:2px;">
                <span>θ (RY) = <span id="var-exp-theta-val">0.00</span></span>
            </div>
            <input type="range" id="var-exp-theta" min="0" max="6.283" step="0.02" value="0"
                   style="width:100%;accent-color:#ec4899;">
        </div>
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#cbd5e1;margin-bottom:2px;">
                <span>φ (RZ) = <span id="var-exp-phi-val">0.00</span></span>
            </div>
            <input type="range" id="var-exp-phi" min="0" max="6.283" step="0.02" value="0"
                   style="width:100%;accent-color:#a78bfa;">
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:0.8rem;color:#94a3b8;">Fidelity:</span>
            <div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;">
                <div id="bloch-exp-bar" style="height:100%;width:0%;background:#2dd4bf;border-radius:4px;transition:width 0.1s;"></div>
            </div>
            <span id="bloch-exp-fid" style="font-size:0.8rem;color:#2dd4bf;min-width:32px;text-align:right;">0%</span>
        </div>
        <div id="bloch-exp-status" style="font-size:0.85rem;font-weight:600;text-align:center;min-height:1.2em;"></div>
    `;

    initBlochTrackball('bloch-explorer-canvas', () => render(false));

    document.getElementById('var-exp-theta').addEventListener('input', e => {
        thetaVal = parseFloat(e.target.value);
        document.getElementById('var-exp-theta-val').textContent = thetaVal.toFixed(2);
        render(false);
    });
    document.getElementById('var-exp-theta').addEventListener('change', () => render(true));

    document.getElementById('var-exp-phi').addEventListener('input', e => {
        phiVal = parseFloat(e.target.value);
        document.getElementById('var-exp-phi-val').textContent = phiVal.toFixed(2);
        render(false);
    });
    document.getElementById('var-exp-phi').addEventListener('change', () => render(true));

    render(false);
}

// ── QFT Lab explanation toggle ────────────────────────────────────────────────

export function showQftExplanation() {
    const el = document.getElementById('qft-lab-explanation');
    el.innerHTML = parseMarkdownAndMath(el.innerHTML);
    el.classList.remove('hidden');
    document.getElementById('qft-explain-btn').classList.add('hidden');
}

// ── Lab mode initializers (called from initGame) ─────────────────────────────

export function initLabMode(state, p1) {
    const clearBtn    = document.getElementById('clear-btn');
    const stageNav    = document.getElementById('stage-nav');
    const instructions = document.getElementById('instructions-text');
    const targetBox   = document.getElementById('target-container');
    const liveBox     = document.getElementById('live-state-container');

    clearBtn.classList.add('hidden');
    stageNav.classList.add('hidden');
    const phaseCols = LAB_CONFIGS[p1];
    state.labTargetN = p1;
    state.currentP1 = 9;
    state.currentP2 = 0;
    state.numQubits = 3;
    state.numCols = 5;
    state.activeSet = ['RZ', 'QFT', 'IQFT'];
    state.secretCircuits = [[[], ['QFT'], phaseCols[0], phaseCols[1], ['IQFT']]];

    const numBtns = [1,2,3,4,5,6,7].map(i => {
        const sel = i === p1;
        return `<button class="hint-btn lab-num-btn" data-n="${i}" onclick="window.stopLabPlay(); window.selectLabNumber(${i})" style="background:${sel?'#d97706':'#f59e0b'};color:#0f172a;font-weight:700;${sel?'outline:2px solid #fbbf24;outline-offset:1px;':''}">${i}</button>`;
    }).join('');
    instructions.innerHTML = `
        <div class="stage-breadcrumb">QFT Adder Lab</div>
        <div class="stage-level-title">Add n to |0⟩</div>
        <div class="stage-subtitle">Click a number — the circuit fills with the Fourier encoding:</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 6px;align-items:center;">
            ${numBtns}
            <button id="lab-play-btn" class="hint-btn" style="background:#d97706;color:#0f172a;font-weight:700;" onclick="window.toggleAdderLabPlay()">▶</button>
        </div>
        <div>
            <button class="hint-btn" onclick="document.getElementById('lab-formula-text').classList.toggle('hidden')">Phase Formula</button>
            <button class="hint-btn" style="background:#3b82f6;margin-left:5px;" onclick="document.getElementById('lab-gates-text').classList.toggle('hidden')">Reveal Gates</button>
            <button class="hint-btn" style="background:#475569;margin-left:5px;" onclick="window.labGoBack()">← Back</button>
        </div>
        <div id="lab-formula-text" class="hint-text hidden">Phase for qubit j = 2π × n / 2^(j+1), where j=0 is top qubit (mod 2π).</div>
        <div id="lab-gates-text" class="hint-text hidden">${LAB_HINTS[p1]}</div>`;
    targetBox.style.display = 'block';
    liveBox.style.display = 'none';
}

export function initQftLabMode(state, p1) {
    const clearBtn    = document.getElementById('clear-btn');
    const stageNav    = document.getElementById('stage-nav');
    const instructions = document.getElementById('instructions-text');
    const targetBox   = document.getElementById('target-container');
    const liveBox     = document.getElementById('live-state-container');

    clearBtn.classList.add('hidden');
    stageNav.classList.add('hidden');
    state.labTargetN = p1;
    state.currentP1 = 8;
    state.currentP2 = 0;
    state.numQubits = 3;
    state.numCols = 4;
    state.activeSet = ['X', 'QFT'];
    state.secretCircuits = [[QFT_LAB_CONFIGS[p1], ['QFT'], [], []]];

    const numBtns = [0,1,2,3,4,5,6,7].map(i => {
        const sel = i === p1;
        return `<button class="hint-btn lab-num-btn" data-n="${i}" onclick="window.stopLabPlay(); window.selectQftInput(${i})" style="background:${sel?'#d97706':'#f59e0b'};color:#0f172a;font-weight:700;${sel?'outline:2px solid #fbbf24;outline-offset:1px;':''}">${i}</button>`;
    }).join('');
    const qftExplanation = "**The Clock Analogy**\n\nAfter QFT, each qubit sits on the equator of the Bloch sphere in the state (|0⟩ + e^(iφ)|1⟩)/√2. Every qubit is a clock hand pointing at a specific phase angle φ. As n increases by 1, each qubit's hand rotates by a different amount:\n\n* **q₀ (top)** — rotates 45° per step. The slowest clock: 8 different angles across n = 0 → 7.\n* **q₁ (middle)** — rotates 90° per step, for a total of 4 angles per round.\n* **q₂ (bottom)** — rotates 180° per step. The fastest clock, with only 2 cycles.\n\nStep through n = 0 → 7 and watch the Bloch spheres. Each n produces a unique combination of three phase angles — a frequency fingerprint. No two inputs share the same set of clock positions.\n\nThis is why QFT is powerful: it encodes a number into the phase dimension. The IQFT reads the fingerprint back as a binary count — which is exactly what QPE does to measure an eigenphase.";
    instructions.innerHTML = `
        <div class="stage-breadcrumb">QFT Lab</div>
        <div class="stage-level-title">QFT Visualization</div>
        <div class="stage-subtitle">Pick a basis state — see how QFT maps it to the Fourier space:</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 6px;align-items:center;">
            ${numBtns}
            <button id="lab-play-btn" class="hint-btn" style="background:#d97706;color:#0f172a;font-weight:700;" onclick="window.toggleQftLabPlay()">▶</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
            <button id="qft-explain-btn" class="hint-btn" style="background:#059669;" onclick="showQftExplanation()">Read Explanation</button>
            <button class="hint-btn" style="background:#475569;" onclick="window.qftLabGoBack()">← Back</button>
        </div>
        <div id="qft-lab-explanation" class="lesson-text hidden">${qftExplanation}</div>`;
    targetBox.style.display = 'none';
    liveBox.style.display = 'none';
}

// ── Lab input handlers ────────────────────────────────────────────────────────

export function selectLabNumber(n, state, renderBoard) {
    if (state.currentMode !== 'LAB') return;
    const phaseCols = LAB_CONFIGS[n];
    state.labTargetN = n;
    state.currentGuess[2] = [...phaseCols[0]];
    state.currentGuess[3] = [...phaseCols[1]];

    const correctCircuit = [[], ['QFT'], phaseCols[0], phaseCols[1], ['IQFT']];
    state.targetState = computeStateVector(correctCircuit, 3, GATE_MATRICES);
    document.getElementById('target-amplitudes').innerText = '|ψ⟩ = ' + stateToString(state.targetState, 3);
    updateTargetBlochSphere(state.targetState, 3);

    state.gameOver = false;
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('message').innerText = '';
    document.getElementById('row-active')?.querySelectorAll('.amplitudes-result').forEach(el => el.remove());

    renderBoard();
    updateBlochSpheres(state.currentGuess, 3);

    const gatesHint = document.getElementById('lab-gates-text');
    if (gatesHint) gatesHint.innerText = LAB_HINTS[n];

    document.querySelectorAll('.lab-num-btn').forEach(btn => {
        const active = parseInt(btn.dataset.n) === n;
        btn.style.background = active ? '#d97706' : '#f59e0b';
        btn.style.outline = active ? '2px solid #fbbf24' : 'none';
    });
}

export function selectQftInput(n, state, renderBoard) {
    if (state.currentMode !== 'QFT_LAB') return;
    state.labTargetN = n;
    state.currentGuess[0] = [...QFT_LAB_CONFIGS[n]];
    state.currentGuess[1] = ['QFT'];

    state.gameOver = false;
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('message').innerText = '';
    document.getElementById('row-active')?.querySelectorAll('.amplitudes-result').forEach(el => el.remove());

    renderBoard();
    updateBlochSpheres(state.currentGuess, 3);

    document.querySelectorAll('.lab-num-btn').forEach(btn => {
        const active = parseInt(btn.dataset.n) === n;
        btn.style.background = active ? '#d97706' : '#f59e0b';
        btn.style.outline = active ? '2px solid #fbbf24' : 'none';
    });
}
