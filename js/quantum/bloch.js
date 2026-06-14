// ── Trackball state ───────────────────────────────────────────────────────────

const _blochState = new Map(); // canvasId → { rot, lastVec, lastLabel, customRedraw, resetBtn }

const SPHERE_R  = 55;
const SPHERE_CY = 10; // cy = canvas.height/2 - SPHERE_CY

// ── 3D math helpers ───────────────────────────────────────────────────────────

function matMul3(A, B) {
    const C = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            for (let k = 0; k < 3; k++)
                C[i][j] += A[i][k] * B[k][j];
    return C;
}

function applyRot(M, [x, y, z]) {
    return [
        M[0][0]*x + M[0][1]*y + M[0][2]*z,
        M[1][0]*x + M[1][1]*y + M[1][2]*z,
        M[2][0]*x + M[2][1]*y + M[2][2]*z,
    ];
}

function dot3(a, b)  { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross3(a, b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function norm3(a)    { const s = Math.sqrt(dot3(a,a)); return s > 1e-10 ? [a[0]/s,a[1]/s,a[2]/s] : [1,0,0]; }

function axisAngleMatrix(axis, angle) {
    const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    return [
        [t*x*x+c,     t*x*y-s*z,  t*x*z+s*y],
        [t*x*y+s*z,   t*y*y+c,    t*y*z-s*x],
        [t*x*z-s*y,   t*y*z+s*x,  t*z*z+c  ],
    ];
}

function projectOnUnitSphere(px, py, cx, cy, R) {
    const x = (px - cx) / R, y = (py - cy) / R;
    const r2 = x*x + y*y;
    if (r2 <= 1) return [x, y, Math.sqrt(1 - r2)];
    const s = 1 / Math.sqrt(r2);
    return [x*s, y*s, 0];
}

function identityRot() { return [[1,0,0],[0,1,0],[0,0,1]]; }

// ── Trackball initializer (idempotent — safe to call on every drawBlochSphere) ─

function _initTrackball(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas._blochTrackball) return;
    canvas._blochTrackball = true;
    canvas.classList.add('bloch-trackball');
    canvas.style.touchAction = 'none';

    const state = _blochState.get(canvasId);

    let dragging = false, lastPt = null, hasDragged = false;

    const canvasPt = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
        const cx = canvas.width / 2, cy = canvas.height / 2 - SPHERE_CY;
        return projectOnUnitSphere((clientX - rect.left) * sx, (clientY - rect.top) * sy, cx, cy, SPHERE_R);
    };

    canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        dragging = true;
        hasDragged = false;
        lastPt = canvasPt(e.clientX, e.clientY);
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add('dragging');
    });

    canvas.addEventListener('pointermove', e => {
        if (!dragging) return;
        const cur = canvasPt(e.clientX, e.clientY);
        const axis = norm3(cross3(lastPt, cur));
        const angle = Math.acos(Math.min(1, Math.max(-1, dot3(lastPt, cur))));
        if (angle > 0.001) {
            hasDragged = true;
            state.rot = matMul3(axisAngleMatrix(axis, angle), state.rot);
            lastPt = cur;
            _redraw(canvasId);
        }
    });

    const onEnd = () => { dragging = false; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);

    // Double-click / double-tap resets to default view
    canvas.addEventListener('dblclick', () => {
        state.rot = identityRot();
        _redraw(canvasId);
    });

    // Double-tap for touch (two taps within 300ms)
    let lastTap = 0;
    canvas.addEventListener('touchend', () => {
        const now = Date.now();
        if (!hasDragged && now - lastTap < 300) {
            state.rot = identityRot();
            _redraw(canvasId);
        }
        lastTap = now;
    });
}

function _redraw(canvasId) {
    const state = _blochState.get(canvasId);
    if (!state) return;
    if (state.customRedraw) {
        state.customRedraw();
    } else if (state.lastVec) {
        drawBlochSphere(canvasId, state.lastVec, state.lastLabel);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function calcBlochVector(v, q, N) {
    let z = 0, x = 0, y = 0;
    let numStates = Math.pow(2, N);
    for (let i = 0; i < numStates; i++) {
        let bit = (i >> (N - 1 - q)) & 1;
        if (bit === 0) {
            let j = i ^ (1 << (N - 1 - q));
            z += (v[i].r**2 + v[i].i**2) - (v[j].r**2 + v[j].i**2);
            x += 2 * (v[i].r * v[j].r + v[i].i * v[j].i);
            y += 2 * (v[i].r * v[j].i - v[i].i * v[j].r);
        }
    }
    return {x, y, z};
}

export function drawBlochSphere(canvasId, vec, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!_blochState.has(canvasId)) _blochState.set(canvasId, { rot: identityRot() });
    const state = _blochState.get(canvasId);
    state.lastVec = vec;
    state.lastLabel = label;
    _initTrackball(canvasId);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2, cy = canvas.height / 2 - SPHERE_CY, R = SPHERE_R;
    const rot = state.rot;

    const proj = (x, y, z) => {
        const [rx, ry, rz] = applyRot(rot, [x, y, z]);
        return { x: cx + R * (ry - 0.5 * rx), y: cy + R * (-rz + 0.35 * rx) };
    };

    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2*Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath(); ctx.ellipse(cx, cy, R, R*0.35, 0, 0, 2*Math.PI); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    const drawAxis = (p1, p2, txt, pTxt) => {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px sans-serif'; ctx.fillText(txt, pTxt.x, pTxt.y);
    };

    let pZ1 = proj(0,0,-1), pZ2 = proj(0,0,1);
    drawAxis(pZ1, pZ2, '|0⟩', {x: pZ2.x - 8, y: pZ2.y - 5}); ctx.fillText('|1⟩', pZ1.x - 8, pZ1.y + 12);

    let pY1 = proj(0,-1,0), pY2 = proj(0,1,0);
    drawAxis(pY1, pY2, 'y', {x: pY2.x + 4, y: pY2.y + 4});

    let pX1 = proj(-1,0,0), pX2 = proj(1,0,0);
    drawAxis(pX1, pX2, 'x', {x: pX2.x - 12, y: pX2.y + 12});

    let pv = proj(vec.x, vec.y, vec.z);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pv.x, pv.y);

    let len = Math.sqrt(vec.x**2 + vec.y**2 + vec.z**2);
    ctx.strokeStyle = len < 0.95 ? '#eab308' : '#ec4899';
    ctx.lineWidth = 3; ctx.stroke();

    ctx.beginPath(); ctx.arc(pv.x, pv.y, 4, 0, 2*Math.PI); ctx.fillStyle = ctx.strokeStyle; ctx.fill();

    ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, cx, canvas.height - 10);
}

// Draws two Bloch vectors on the same canvas (used by the Explorer lab).
// currentBloch and targetBloch are plain {x, y, z} objects.
export function drawBlochSphereDual(canvasId, currentBloch, targetBloch) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!_blochState.has(canvasId)) _blochState.set(canvasId, { rot: identityRot() });
    const state = _blochState.get(canvasId);
    _initTrackball(canvasId);

    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2 - SPHERE_CY, R = SPHERE_R;
    const rot = state.rot;

    const proj = (x, y, z) => {
        const [rx, ry, rz] = applyRot(rot, [x, y, z]);
        return { x: cx + R * (ry - 0.5 * rx), y: cy + R * (-rz + 0.35 * rx) };
    };

    // Sphere outline
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.35, 0, 0, 2 * Math.PI); ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    const axis = (p1, p2) => { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); };
    axis(proj(0,0,-1), proj(0,0,1)); axis(proj(0,-1,0), proj(0,1,0)); axis(proj(-1,0,0), proj(1,0,0));

    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
    const p0 = proj(0,0,1);  ctx.fillText('|0⟩', p0.x - 6, p0.y - 4);
    const p1 = proj(0,0,-1); ctx.fillText('|1⟩', p1.x - 6, p1.y + 12);

    // Target vector (teal)
    const pt = proj(targetBloch.x, targetBloch.y, targetBloch.z);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pt.x, pt.y);
    ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#2dd4bf'; ctx.fill();

    // Current vector (pink)
    const pc = proj(currentBloch.x, currentBloch.y, currentBloch.z);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pc.x, pc.y);
    ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(pc.x, pc.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ec4899'; ctx.fill();
}

// Call this to register a custom redraw function and set up trackball for a
// canvas that isn't drawn through drawBlochSphere (e.g., the Explorer lab).
export function initBlochTrackball(canvasId, customRedraw) {
    if (!_blochState.has(canvasId)) _blochState.set(canvasId, { rot: identityRot() });
    _blochState.get(canvasId).customRedraw = customRedraw;
    _initTrackball(canvasId);
}

// Resets the rotation for a canvas back to the default view.
export function resetBlochView(canvasId) {
    const state = _blochState.get(canvasId);
    if (!state) return;
    state.rot = identityRot();
    _redraw(canvasId);
}

// Called when canvases are recreated (level change) so old rotation state is gone.
export function clearBlochRotations() {
    _blochState.clear();
}
