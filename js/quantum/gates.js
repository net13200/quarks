import { c, addMat, kron, kronN } from './engine.js';

export const I2 = [[{r:1,i:0},{r:0,i:0}], [{r:0,i:0},{r:1,i:0}]];
export const X2 = [[{r:0,i:0},{r:1,i:0}], [{r:1,i:0},{r:0,i:0}]];
export const Y2 = [[{r:0,i:0},{r:0,i:-1}], [{r:0,i:1},{r:0,i:0}]];
export const Z2 = [[{r:1,i:0},{r:0,i:0}], [{r:0,i:0},{r:-1,i:0}]];
export const H2 = [[{r:c,i:0},{r:c,i:0}], [{r:c,i:0},{r:-c,i:0}]];
export const SX2 = [[{r:0.5,i:0.5},{r:0.5,i:-0.5}], [{r:0.5,i:-0.5},{r:0.5,i:0.5}]];

export const P0 = [[{r:1,i:0},{r:0,i:0}], [{r:0,i:0},{r:0,i:0}]]; 
export const P1 = [[{r:0,i:0},{r:0,i:0}], [{r:0,i:0},{r:1,i:0}]]; 

export const CX2 = [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}]
];
export const CX2_REV = [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}]
];

export const SWAP2 = [
    [{r:1,i:0}, {r:0,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:1,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:1,i:0}, {r:0,i:0}, {r:0,i:0}],
    [{r:0,i:0}, {r:0,i:0}, {r:0,i:0}, {r:1,i:0}]
];

function buildQFTMatrix(numQubits, inverse = false) {
    let N = 1 << numQubits;
    let mat = [];
    let sign = inverse ? -1 : 1;
    
    for (let r = 0; r < N; r++) {
        let row = [];
        for (let c = 0; c < N; c++) {
            let theta = sign * (2 * Math.PI * r * c) / N;
            row.push({ 
                r: Math.cos(theta) / Math.sqrt(N), 
                i: Math.sin(theta) / Math.sqrt(N) 
            });
        }
        mat.push(row);
    }
    return mat;
}

export let GATE_MATRICES = {};

export function generateMatrices(N) {
    GATE_MATRICES = {};
    GATE_MATRICES['I'] = kronN(Array(N).fill(I2));

    // Add this right before the end of generateMatrices
    if (N > 0) {
        GATE_MATRICES['QFT'] = buildQFTMatrix(N, false);
        GATE_MATRICES['IQFT'] = buildQFTMatrix(N, true);
    }
    if (N === 3) {
        GATE_MATRICES['IQFT2'] = kron(buildQFTMatrix(2, true), I2);
    }
    
    let singleGates = { 'X': X2, 'Y': Y2, 'H': H2, 'Z': Z2, 'SX': SX2 };
    for (let q = 0; q < N; q++) {
        for (let [name, mat] of Object.entries(singleGates)) {
            let mats = Array(N).fill(I2);
            mats[q] = mat;
            GATE_MATRICES[`${name}${q}`] = kronN(mats);
        }
    }
    
    let rzVals = {
        'PI': {r: -1, i: 0},
        'PI2': {r: 0, i: 1},
        'PI4': {r: c, i: c},
        'PI8': {r: Math.cos(Math.PI/8), i: Math.sin(Math.PI/8)},
        'MINUS_PI2': {r: 0, i: -1},
        'MINUS_PI4': {r: c, i: -c},
        'MINUS_PI8': {r: Math.cos(-Math.PI/8), i: Math.sin(-Math.PI/8)}
    };
    for (let q = 0; q < N; q++) {
        for (let [suffix, val] of Object.entries(rzVals)) {
            let mat = [
                [{r:1, i:0}, {r:0, i:0}],
                [{r:0, i:0}, val]
            ];
            let mats = Array(N).fill(I2);
            mats[q] = mat;
            GATE_MATRICES[`RZ_${suffix}_${q}`] = kronN(mats);
        }
    }

    // RY(θ) = [[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]]
    const ryAngles = {
        'PI':        [0,                    1],
        'PI2':       [c,                    c],
        'PI4':       [Math.cos(Math.PI/8),  Math.sin(Math.PI/8)],
        'MINUS_PI2': [c,                   -c],
        'MINUS_PI4': [Math.cos(Math.PI/8), -Math.sin(Math.PI/8)],
    };
    for (let q = 0; q < N; q++) {
        for (let [suffix, [cv, sv]] of Object.entries(ryAngles)) {
            const mat = [[{r:cv,i:0},{r:-sv,i:0}],[{r:sv,i:0},{r:cv,i:0}]];
            let mats = Array(N).fill(I2);
            mats[q] = mat;
            GATE_MATRICES[`RY_${suffix}_${q}`] = kronN(mats);
        }
    }

    if (N >= 2) {
        if (N === 2) {
            GATE_MATRICES['CX01'] = CX2; GATE_MATRICES['CX10'] = CX2_REV;
            GATE_MATRICES['SWAP01'] = SWAP2; GATE_MATRICES['SWAP10'] = SWAP2;
        } else if (N === 3) {
            GATE_MATRICES['CX01'] = kron(CX2, I2); GATE_MATRICES['CX10'] = kron(CX2_REV, I2);
            GATE_MATRICES['CX12'] = kron(I2, CX2); GATE_MATRICES['CX21'] = kron(I2, CX2_REV);
            GATE_MATRICES['CX02'] = addMat(kronN([P0, I2, I2]), kronN([P1, I2, X2]));
            GATE_MATRICES['CX20'] = addMat(kronN([I2, I2, P0]), kronN([X2, I2, P1]));
            
            GATE_MATRICES['SWAP01'] = kron(SWAP2, I2); GATE_MATRICES['SWAP10'] = kron(SWAP2, I2);
            GATE_MATRICES['SWAP12'] = kron(I2, SWAP2); GATE_MATRICES['SWAP21'] = kron(I2, SWAP2);
            
            let SWAP02_mat = Array(8).fill().map(()=>Array(8).fill({r:0,i:0}));
            for(let i=0; i<8; i++) {
                let b0 = (i >> 2) & 1;
                let b1 = (i >> 1) & 1;
                let b2 = i & 1;
                let swapped = (b2 << 2) | (b1 << 1) | b0;
                SWAP02_mat[i][swapped] = {r:1,i:0};
            }
            GATE_MATRICES['SWAP02'] = SWAP02_mat;
            GATE_MATRICES['SWAP20'] = SWAP02_mat;
            
            let CCX012 = Array(8).fill().map((_, i) => {
                let row = Array(8).fill().map(() => ({r:0, i:0}));
                let j = (i === 6) ? 7 : (i === 7) ? 6 : i;
                row[j] = {r:1, i:0}; return row;
            }); GATE_MATRICES['CCX012'] = CCX012;

            let CCX021 = Array(8).fill().map((_, i) => {
                let row = Array(8).fill().map(() => ({r:0, i:0}));
                let j = (i === 5) ? 7 : (i === 7) ? 5 : i;
                row[j] = {r:1, i:0}; return row;
            }); GATE_MATRICES['CCX021'] = CCX021;

            let CCX120 = Array(8).fill().map((_, i) => {
                let row = Array(8).fill().map(() => ({r:0, i:0}));
                let j = (i === 3) ? 7 : (i === 7) ? 3 : i;
                row[j] = {r:1, i:0}; return row;
            }); GATE_MATRICES['CCX120'] = CCX120;

            // Aliases for swapped control order (CCX is symmetric in its two controls)
            GATE_MATRICES['CCX102'] = CCX012;
            GATE_MATRICES['CCX201'] = CCX021;
            GATE_MATRICES['CCX210'] = CCX120;
        } else if (N === 4) {
            // Generate all CX(ctrl→targ) gates for 4 qubits
            for (let ctrl = 0; ctrl < 4; ctrl++) {
                for (let targ = 0; targ < 4; targ++) {
                    if (ctrl === targ) continue;
                    const mat = Array(16).fill(null).map(() => Array(16).fill({r:0,i:0}));
                    for (let i = 0; i < 16; i++) {
                        const ctrlBit = (i >> (3 - ctrl)) & 1;
                        if (ctrlBit === 0) {
                            mat[i][i] = {r:1,i:0};
                        } else {
                            const j = i ^ (1 << (3 - targ));
                            mat[i][j] = {r:1,i:0};
                        }
                    }
                    GATE_MATRICES[`CX${ctrl}${targ}`] = mat;
                }
            }
        }

        for (let ctrl = 0; ctrl < N; ctrl++) {
            for (let targ = 0; targ < N; targ++) {
                if (ctrl === targ) continue;
                for (let [suffix, val] of Object.entries(rzVals)) {
                    let mat = Array(Math.pow(2,N)).fill().map(() => Array(Math.pow(2,N)).fill({r:0, i:0}));
                    for (let i = 0; i < Math.pow(2,N); i++) {
                        let bitC = (i >> (N - 1 - ctrl)) & 1;
                        let bitT = (i >> (N - 1 - targ)) & 1;
                        if (bitC === 1 && bitT === 1) mat[i][i] = val;
                        else mat[i][i] = {r:1, i:0};
                    }
                    GATE_MATRICES[`CP_${suffix}_${ctrl}${targ}`] = mat;
                }
            }
        }
    }
}

export function formatAngleGate(gNext) {
    if (gNext.startsWith('RZ') || gNext.startsWith('CP')) {
        let angles = ['PI', 'PI2', 'PI4', 'PI8', 'MINUS_PI2', 'MINUS_PI4', 'MINUS_PI8'];
        let randAngle = angles[Math.floor(Math.random() * angles.length)];
        let prefix = gNext.startsWith('RZ') ? 'RZ' : 'CP';
        let qSuffix = gNext.startsWith('RZ') ? gNext.slice(-1) : gNext.slice(-2);
        return `${prefix}_${randAngle}_${qSuffix}`;
    }
    if (gNext.startsWith('RY')) {
        let angles = ['PI', 'PI2', 'PI4', 'MINUS_PI2', 'MINUS_PI4'];
        let randAngle = angles[Math.floor(Math.random() * angles.length)];
        return `RY_${randAngle}_${gNext.slice(-1)}`;
    }
    return gNext;
}

export function getOccupiedQubits(gate) {
    if (!gate || gate === 'I') return [];
    if (gate === 'QFT' || gate === 'IQFT') {
        return [0, 1, 2, 3, 4, 5, 6, 7];
    }
    if (gate === 'IQFT2') return [0, 1];
    if (gate.startsWith('CCX')) {
        let c1 = parseInt(gate[3]), c2 = parseInt(gate[4]), t = parseInt(gate[5]);
        let occ = [];
        for(let i=Math.min(c1, c2, t); i<=Math.max(c1, c2, t); i++) occ.push(i); 
        return occ;
    }
    if (gate.startsWith('CX')) {
        let c = parseInt(gate[2]), t = parseInt(gate[3]);
        let occ = [];
        for(let i=Math.min(c,t); i<=Math.max(c,t); i++) occ.push(i);
        return occ;
    }
    if (gate.startsWith('SWAP')) {
        let parts = gate.replace('SWAP', '');
        let c = parseInt(parts[0]), t = parseInt(parts[1]);
        let occ = [];
        for(let i=Math.min(c,t); i<=Math.max(c,t); i++) occ.push(i);
        return occ;
    }
    if (gate.startsWith('RZ_') || gate.startsWith('RY_')) {
        let parts = gate.split('_');
        return [parseInt(parts[parts.length - 1])];
    }
    if (gate.startsWith('CP_')) {
        let parts = gate.split('_');
        let ct = parts[parts.length - 1];
        let c = parseInt(ct[0]), t = parseInt(ct[1]);
        let occ = [];
        for(let i=Math.min(c,t); i<=Math.max(c,t); i++) occ.push(i);
        return occ;
    }
    return [parseInt(gate.slice(-1))];
}

export function canFit(columnGates, newGate) {
    let newOcc = getOccupiedQubits(newGate);
    for(let g of columnGates) {
        let occ = getOccupiedQubits(g);
        for(let q of newOcc) { if(occ.includes(q)) return false; }
    }
    return true;
}

export function addGateToColumn(colArray, newGate) {
    if (!newGate || newGate === 'I') return colArray;
    let newOcc = getOccupiedQubits(newGate);
    let filtered = colArray.filter(g => {
        let occ = getOccupiedQubits(g);
        return !newOcc.some(q => occ.includes(q));
    });
    filtered.push(newGate);
    return filtered;
}

// Normalize symmetric gates (SWAP, CP, CCX) to a canonical form
// so SWAP10 === SWAP01, CP_PI_10 === CP_PI_01, and CCX102 === CCX012 in all comparisons.
export function normalizeGate(gate) {
    if (gate.startsWith('SWAP')) {
        const q0 = parseInt(gate[4]), q1 = parseInt(gate[5]);
        return q0 <= q1 ? gate : `SWAP${q1}${q0}`;
    }
    if (gate.startsWith('CP')) {
        const parts = gate.split('_');           // ['CP', 'ANGLE', 'qq']
        const qq = parts[parts.length - 1];      // e.g. '10', '01', '21'
        if (qq && qq.length === 2) {
            const q0 = parseInt(qq[0]), q1 = parseInt(qq[1]);
            if (q0 > q1) { parts[parts.length - 1] = `${q1}${q0}`; return parts.join('_'); }
        }
        return gate;
    }
    // CCX control qubits are symmetric: CCX(c1,c2,t) === CCX(c2,c1,t)
    // Gate string format: CCX + c1 + c2 + t (e.g. "CCX012", "CCX102")
    if (gate.startsWith('CCX') && gate.length === 6) {
        const c1 = parseInt(gate[3]), c2 = parseInt(gate[4]), t = parseInt(gate[5]);
        const [lo, hi] = c1 <= c2 ? [c1, c2] : [c2, c1];
        return `CCX${lo}${hi}${t}`;
    }
    return gate;
}

export function getGateMultiset(circuit) {
    let gates = [];
    for(let col of circuit) {
        for(let gate of col) {
            if(gate && gate !== 'I') gates.push(normalizeGate(gate));
        }
    }
    return gates.sort().join(',');
}