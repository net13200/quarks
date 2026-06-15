export const c = 1 / Math.sqrt(2);

export function mult(a, b) { 
    return {r: a.r*b.r - a.i*b.i, i: a.r*b.i + a.i*b.r}; 
}
export function add(a, b) { 
    return {r: a.r + b.r, i: a.i + b.i}; 
}

export function addMat(A, B) {
    let rowA = A.length, colA = A[0].length;
    let M = Array(rowA).fill().map(() => Array(colA));
    for(let r=0; r<rowA; r++) for(let c=0; c<colA; c++) M[r][c] = add(A[r][c], B[r][c]);
    return M;
}

export function matMult(A, B) {
    let size = A.length;
    let M = Array(size).fill().map(() => Array(size));
    for(let r=0; r<size; r++) {
        for(let c=0; c<size; c++) {
            let sum = {r:0, i:0};
            for(let k=0; k<size; k++) sum = add(sum, mult(A[r][k], B[k][c]));
            M[r][c] = sum;
        }
    }
    return M;
}

export function kron(A, B) {
    let rowA = A.length, colA = A[0].length, rowB = B.length, colB = B[0].length;
    let M = Array(rowA * rowB).fill().map(() => Array(colA * colB));
    for(let r1=0; r1<rowA; r1++) {
        for(let r2=0; r2<rowB; r2++) {
            for(let c1=0; c1<colA; c1++) {
                for(let c2=0; c2<colB; c2++) M[r1*rowB+r2][c1*colB+c2] = mult(A[r1][c1], B[r2][c2]);
            }
        }
    }
    return M;
}

export function kronN(mats) {
    let res = mats[0];
    for(let i=1; i<mats.length; i++) res = kron(res, mats[i]);
    return res;
}

export function removeGlobalPhase(v) {
    let ref = null;
    for (let i = 0; i < v.length; i++) {
        if (Math.abs(v[i].r) > 1e-4 || Math.abs(v[i].i) > 1e-4) { ref = v[i]; break; }
    }
    if (!ref) return v; 
    let mag = Math.sqrt(ref.r * ref.r + ref.i * ref.i);
    let mR = ref.r / mag, mI = -ref.i / mag; 
    let out = [];
    for (let i = 0; i < v.length; i++) out.push({r: v[i].r * mR - v[i].i * mI, i: v[i].r * mI + v[i].i * mR});
    return out;
}

export function formatTerm(val, isImaginary) {
    if (Math.abs(val) < 1e-4) return "0";
    let sign = val < 0 ? "-" : ""; let v = Math.abs(val); let num = "";
    const eps = 1e-4;
    
    let cp8 = Math.cos(Math.PI/8);
    let sp8 = Math.sin(Math.PI/8);
    let cp16 = Math.cos(Math.PI/16);
    let sp16 = Math.sin(Math.PI/16);

    if (Math.abs(v - 1) < eps) num = "1";
    else if (Math.abs(v - 0.5) < eps) num = "1/2";
    else if (Math.abs(v - 1/Math.sqrt(2)) < eps) num = "1/√2";
    else if (Math.abs(v - 1/(2*Math.sqrt(2))) < eps) num = "1/2√2";
    else if (Math.abs(v - 0.25) < eps) num = "1/4";
    else if (Math.abs(v - cp8) < eps) num = "cos(π/8)";
    else if (Math.abs(v - sp8) < eps) num = "sin(π/8)";
    else if (Math.abs(v - cp8/Math.sqrt(2)) < eps) num = "cos(π/8)/√2";
    else if (Math.abs(v - sp8/Math.sqrt(2)) < eps) num = "sin(π/8)/√2";
    else if (Math.abs(v - cp8/2) < eps) num = "cos(π/8)/2";
    else if (Math.abs(v - sp8/2) < eps) num = "sin(π/8)/2";
    else if (Math.abs(v - cp16) < eps) num = "cos(π/16)";
    else if (Math.abs(v - sp16) < eps) num = "sin(π/16)";
    else if (Math.abs(v - cp16/Math.sqrt(2)) < eps) num = "cos(π/16)/√2";
    else if (Math.abs(v - sp16/Math.sqrt(2)) < eps) num = "sin(π/16)/√2";
    else if (Math.abs(v - cp16/2) < eps) num = "cos(π/16)/2";
    else if (Math.abs(v - sp16/2) < eps) num = "sin(π/16)/2";
    else num = v.toFixed(3);
    
    if (isImaginary) {
        if (num === "1") return sign + "i";
        if (num.startsWith("1/")) return sign + num.replace("1/", "i/");
        if (num.startsWith("sin(") || num.startsWith("cos(")) return sign + "i·" + num;
        if (num.includes("/")) return sign + num.replace("/", "i/");
        return sign + num + "i";
    }
    return sign + num;
}

export function formatComplexExact(val) {
    let r = val.r, i = val.i;
    if (Math.abs(r) < 1e-4 && Math.abs(i) < 1e-4) return null;
    if (Math.abs(r) < 1e-4) return formatTerm(i, true);
    if (Math.abs(i) < 1e-4) return formatTerm(r, false);
    
    let rStr = formatTerm(r, false), iStr = formatTerm(i, true);
    let op = iStr.startsWith("-") ? "-" : "+";
    let iPart = iStr.startsWith("-") ? iStr.substring(1) : iStr;
    return `${rStr} ${op} ${iPart}`;
}

export function stateToString(v, N) {
    let terms = [];
    let numStates = Math.pow(2, N);
    for (let i = 0; i < numStates; i++) {
        let fmt = formatComplexExact(v[i]);
        if (fmt) {
            let bin = i.toString(2).padStart(N, '0');
            terms.push(`${(fmt.includes(' + ') || fmt.includes(' - ')) ? `(${fmt})` : fmt}|${bin}⟩`);
        }
    }
    return terms.length === 0 ? "0" : terms.join(' + ').replace(/\+ -/g, '- ');
}

export function statesMatch(v1, v2, N) {
    let numStates = Math.pow(2, N);
    for (let i = 0; i < numStates; i++) {
        if (Math.abs(v1[i].r - v2[i].r) > 1e-4 || Math.abs(v1[i].i - v2[i].i) > 1e-4) return false;
    }
    return true;
}

export function computeStateVector(sequence, N, gateMatrices, initialState = null) {
    let numStates = Math.pow(2, N);
    let v = initialState
        ? initialState.map(x => ({...x}))
        : Array(numStates).fill().map(() => ({r:0, i:0}));
    if (!initialState) v[0] = {r:1, i:0};
    
    for (let column of sequence) {
        if (column.length === 0) continue;
        let colMatrix = gateMatrices['I'];
        for (let gate of column) colMatrix = matMult(colMatrix, gateMatrices[gate]);
        
        let nextV = [];
        for (let i = 0; i < numStates; i++) {
            let sum = {r:0, i:0};
            for (let j = 0; j < numStates; j++) sum = add(sum, mult(colMatrix[i][j], v[j]));
            nextV.push(sum);
        }
        v = nextV;
    }
    return removeGlobalPhase(v);
}

// --- Variational / VQE support ---

const _I2 = [[{r:1,i:0},{r:0,i:0}],[{r:0,i:0},{r:1,i:0}]];

function _buildSingleQubitNGate(mat2, qubit, numQubits) {
    const mats = Array(numQubits).fill(_I2);
    mats[qubit] = mat2;
    return kronN(mats);
}

function _resolveParamGate(spec, paramValues, numQubits) {
    const theta = paramValues[spec.param] ?? 0;
    if (spec.gate === 'RY') {
        const cv = Math.cos(theta / 2), sv = Math.sin(theta / 2);
        return _buildSingleQubitNGate([[{r:cv,i:0},{r:-sv,i:0}],[{r:sv,i:0},{r:cv,i:0}]], spec.qubit, numQubits);
    }
    if (spec.gate === 'RX') {
        const cv = Math.cos(theta / 2), sv = Math.sin(theta / 2);
        return _buildSingleQubitNGate([[{r:cv,i:0},{r:0,i:-sv}],[{r:0,i:-sv},{r:cv,i:0}]], spec.qubit, numQubits);
    }
    if (spec.gate === 'RZ') {
        return _buildSingleQubitNGate([[{r:1,i:0},{r:0,i:0}],[{r:0,i:0},{r:Math.cos(theta),i:Math.sin(theta)}]], spec.qubit, numQubits);
    }
    return null;
}

// Computes the state vector for a variational circuit template.
// template: array of columns; each column is array of gate specs.
//   String spec → looked up in fixedGateMatrices.
//   Object spec {gate, qubit, param} → computed from paramValues.
// Does NOT remove global phase.
export function computeVariationalState(template, paramValues, numQubits, fixedGateMatrices) {
    const numStates = 1 << numQubits;
    let v = Array(numStates).fill().map(() => ({r:0, i:0}));
    v[0] = {r:1, i:0};

    const I_N = fixedGateMatrices['I'];

    for (const column of template) {
        if (!column || column.length === 0) continue;
        let colMatrix = I_N;
        for (const spec of column) {
            const gmat = typeof spec === 'string'
                ? fixedGateMatrices[spec]
                : _resolveParamGate(spec, paramValues, numQubits);
            if (gmat) colMatrix = matMult(colMatrix, gmat);
        }
        const nextV = [];
        for (let i = 0; i < numStates; i++) {
            let sum = {r:0, i:0};
            for (let j = 0; j < numStates; j++) sum = add(sum, mult(colMatrix[i][j], v[j]));
            nextV.push(sum);
        }
        v = nextV;
    }
    return v;
}

// Computes ⟨ψ|H|ψ⟩ for a Pauli Hamiltonian.
// hamiltonian: [{pauli: 'ZZ', qubits: [0,1], coeff: -0.5}, ...]
export function computeExpectation(stateVec, hamiltonian, numQubits) {
    if (!hamiltonian || hamiltonian.length === 0) return 0;
    let total = 0;
    for (const term of hamiltonian) {
        total += term.coeff * _pauliExpectation(stateVec, term.pauli, term.qubits, numQubits);
    }
    return total;
}

function _pauliExpectation(stateVec, pauli, qubits, numQubits) {
    const N = 1 << numQubits;
    let real = 0;
    for (let j = 0; j < N; j++) {
        let phase = {r:1, i:0};
        let k = j;
        for (let idx = 0; idx < pauli.length; idx++) {
            const p = pauli[idx];
            const q = qubits[idx];
            const bitPos = numQubits - 1 - q;
            const bit = (k >> bitPos) & 1;
            if (p === 'Z') {
                if (bit === 1) phase = {r: -phase.r, i: -phase.i};
            } else if (p === 'X') {
                k ^= (1 << bitPos);
            } else if (p === 'Y') {
                if (bit === 0) { k ^= (1 << bitPos); const t = phase.r; phase.r = -phase.i; phase.i = t; }
                else           { k ^= (1 << bitPos); const t = phase.r; phase.r =  phase.i; phase.i = -t; }
            }
        }
        const cj = stateVec[j], ck = stateVec[k];
        real += cj.r * (phase.r*ck.r - phase.i*ck.i) + cj.i * (phase.r*ck.i + phase.i*ck.r);
    }
    return real;
}

// |⟨target|state⟩|²
export function computeFidelity(stateVec, targetVec) {
    let re = 0, im = 0;
    for (let j = 0; j < stateVec.length; j++) {
        re += targetVec[j].r * stateVec[j].r + targetVec[j].i * stateVec[j].i;
        im += targetVec[j].r * stateVec[j].i - targetVec[j].i * stateVec[j].r;
    }
    return re * re + im * im;
}