export const LEVELS = {
    1: { q: 1, g: 4, minActive: 2 },
    2: { q: 2, g: 6, minActive: 3 },
    3: { q: 3, g: 10, minActive: 4 }
};

// Valid symmetrical CSWAP implementations
const CSWAP_VARIANTS = [
    [['CCX012'], ['CCX021'], ['CCX012']],
    [['CCX021'], ['CCX012'], ['CCX021']],
    [['CX21'], ['CCX012'], ['CX21']],
    [['CX12'], ['CCX021'], ['CX12']]
];

// Valid state preps for Stage 5
const PREP_5 = [
    [['H0', 'H1']],
    [['H0'], ['H1']],
    [['H1'], ['H0']]
];

// Stage 5.3 dynamically handles symmetries
function getStage5_3Circuits() {
    let circuits = [];
    let cxVariants = [
        [['CX21'], ['CCX012'], ['CX21']],
        [['CX12'], ['CCX021'], ['CX12']]
    ];
    cxVariants.forEach(seq => {
        PREP_5.forEach(p => {
            circuits.push([...p, ...seq]);
        });
        let mergedSeq = JSON.parse(JSON.stringify(seq));
        mergedSeq[0].push('H0');
        circuits.push([['H1'], ...mergedSeq]);
    });
    return circuits;
}

// Stage 6 dynamically handles all logical permutations for the Swap Test
function getStage6Circuits(prepGateOnq1, prepGateOnq2 = null) {
    let circuits = [];
    CSWAP_VARIANTS.forEach(seq => {
        let canMergeOuter = seq[0][0].startsWith('CX');

        let prepOptions = [];
        if (prepGateOnq1 && prepGateOnq2) {
            // Three independent gates (H0, q1-prep, q2-prep) — all column groupings
            const g = ['H0', prepGateOnq1, prepGateOnq2];
            // 1-column
            prepOptions.push([[...g]]);
            // 2-column partitions
            prepOptions.push([[g[0], g[1]], [g[2]]]);
            prepOptions.push([[g[0], g[2]], [g[1]]]);
            prepOptions.push([[g[1], g[2]], [g[0]]]);
            prepOptions.push([[g[0]], [g[1], g[2]]]);
            prepOptions.push([[g[1]], [g[0], g[2]]]);
            prepOptions.push([[g[2]], [g[0], g[1]]]);
            // 3-column orderings
            prepOptions.push([[g[0]], [g[1]], [g[2]]]);
            prepOptions.push([[g[0]], [g[2]], [g[1]]]);
            prepOptions.push([[g[1]], [g[0]], [g[2]]]);
            prepOptions.push([[g[1]], [g[2]], [g[0]]]);
            prepOptions.push([[g[2]], [g[0]], [g[1]]]);
            prepOptions.push([[g[2]], [g[1]], [g[0]]]);
        } else if (prepGateOnq1) {
            prepOptions.push([['H0'], [prepGateOnq1]]);
            prepOptions.push([[prepGateOnq1], ['H0']]);
            prepOptions.push([['H0', prepGateOnq1]]);
        } else {
            prepOptions.push([['H0']]);
        }

        prepOptions.forEach(prep => {
            circuits.push([...prep, ...seq, ['H0']]);
            if (canMergeOuter) {
                let seqEndMerged = JSON.parse(JSON.stringify(seq));
                seqEndMerged[seqEndMerged.length - 1].push('H0');
                circuits.push([...prep, ...seqEndMerged]);
            }
        });

        if (canMergeOuter) {
            let startMergedPrep = prepGateOnq1
                ? (prepGateOnq2 ? [[prepGateOnq1, prepGateOnq2]] : [[prepGateOnq1]])
                : [];
            let seqStartMerged = JSON.parse(JSON.stringify(seq));
            seqStartMerged[0].push('H0');
            circuits.push([...startMergedPrep, ...seqStartMerged, ['H0']]);

            let seqBothMerged = JSON.parse(JSON.stringify(seq));
            seqBothMerged[0].push('H0');
            seqBothMerged[seqBothMerged.length - 1].push('H0');
            circuits.push([...startMergedPrep, ...seqBothMerged]);
        }
    });
    return circuits;
}

// Stage 6.1 intro: Hadamard Test on single-qubit U=X
// Valid orderings of H0_first, X1, H1, CX01, H0_last
// Constraints: X1 < H1 < CX01; H0_first < CX01; CX01 < H0_last
// Merges allowed when gates act on different qubits
function getStage6_0Circuits() {
    return [
        [['H0', 'X1'], ['H1'], ['CX01'], ['H0'], []],
        [['X1'], ['H0', 'H1'], ['CX01'], ['H0'], []],
        [['H0'], ['X1'], ['H1'], ['CX01'], ['H0']],
        [['X1'], ['H0'], ['H1'], ['CX01'], ['H0']],
        [['X1'], ['H1'], ['H0'], ['CX01'], ['H0']],
    ];
}

// Stage 7.1 dynamically handles symmetries for X-Parity
function getStage7_1Circuits() {
    let circuits = [];
    let prefixes = [
        [['X1'], ['H1'], ['CX12'], ['H0']],
        [['X1'], ['H1'], ['H0', 'CX12']],
        [['X1'], ['H0', 'H1'], ['CX12']],
        [['H0', 'X1'], ['H1'], ['CX12']],
        [['H0'], ['X1'], ['H1'], ['CX12']]
    ];
    let cores = [
        [['CX01'], ['CX02']],
        [['CX02'], ['CX01']]
    ];
    prefixes.forEach(p => {
        cores.forEach(c => {
            if (p.length + c.length + 1 <= 8) {
                circuits.push([...p, ...c, ['H0']]);
            }
        });
    });
    return circuits;
}

// Stage 7.2 dynamically handles symmetries for Z-Parity
function getStage7_2Circuits() {
    let circuits = [];
    let preps = [
        [['X2', 'H1'], ['CX12']],
        [['H1'], ['X2'], ['CX12']],
        [['X2'], ['H1'], ['CX12']],
        [['X2', 'H1'], ['H0', 'CX12']],
        [['H1'], ['X2'], ['H0', 'CX12']],
        [['X2'], ['H1'], ['H0', 'CX12']],
        [['H0', 'X2', 'H1'], ['CX12']],
        [['H0', 'H1'], ['X2'], ['CX12']],
        [['H0', 'X2'], ['H1'], ['CX12']],
        [['H1'], ['H0', 'X2'], ['CX12']],
        [['X2'], ['H0', 'H1'], ['CX12']]
    ];
    let cores = [
        [['CX01'], ['CX02']],
        [['CX02'], ['CX01']]
    ];
    let suffixes = [
        [['H0', 'H1', 'H2']],
        [['H0', 'H1'], ['H2']],
        [['H0', 'H2'], ['H1']],
        [['H1', 'H2'], ['H0']],
        [['H0'], ['H1', 'H2']],
        [['H1'], ['H0', 'H2']],
        [['H2'], ['H0', 'H1']]
    ];
    
    circuits.push([['X2'], ['H1'], ['CX12'], ['H0'], ['H1'], ['H2'], ['CX01'], ['CX02'], ['H0'], ['H1'], ['H2']]);
    circuits.push([['X2'], ['H1'], ['CX12'], ['H0', 'H1', 'H2'], ['CX01'], ['CX02'], ['H0', 'H1', 'H2']]);
    
    preps.forEach(p => {
        cores.forEach(c => {
            suffixes.forEach(s => {
                if (p.length + c.length + s.length <= 8) {
                    circuits.push([...p, ...c, ...s]);
                }
            });
        });
    });
    return circuits;
}

// Stage 8.4 dynamically handles symmetries for the Controlled-Phase decomposition
function getStage8_4Circuits() {
    let circuits = [];
    let preps = [
        [['H0', 'H1']],
        [['H0'], ['H1']],
        [['H1'], ['H0']]
    ];
    let cores = [
        [['RZ_PI4_0', 'RZ_PI4_1'], ['CX01'], ['RZ_MINUS_PI4_1'], ['CX01']],
        [['RZ_PI4_0'], ['RZ_PI4_1'], ['CX01'], ['RZ_MINUS_PI4_1'], ['CX01']],
        [['RZ_PI4_1'], ['RZ_PI4_0'], ['CX01'], ['RZ_MINUS_PI4_1'], ['CX01']],
        [['RZ_PI4_0', 'RZ_PI4_1'], ['CX10'], ['RZ_MINUS_PI4_0'], ['CX10']],
        [['RZ_PI4_0'], ['RZ_PI4_1'], ['CX10'], ['RZ_MINUS_PI4_0'], ['CX10']],
        [['RZ_PI4_1'], ['RZ_PI4_0'], ['CX10'], ['RZ_MINUS_PI4_0'], ['CX10']]
    ];
    preps.forEach(p => {
        cores.forEach(c => {
            circuits.push([...p, ...c]);
        });
    });
    return circuits;
}

// Stage 9.2 dynamically handles symmetries for 2-qubit QFT using Native SWAP
function getStage9_2Circuits() {
    return [
        [['H0'], ['CP_PI2_10'], ['H1'], ['SWAP01']],
        [['H0'], ['CP_PI2_01'], ['H1'], ['SWAP01']]
    ];
}

// Stage 9.3 dynamically handles symmetries for 3-qubit QFT using Native SWAP
function getStage9_3Circuits() {
    let circuits = [];
    let cp10 = ['CP_PI2_10', 'CP_PI2_01'];
    let cp20 = ['CP_PI4_20', 'CP_PI4_02'];
    let cp21 = ['CP_PI2_21', 'CP_PI2_12'];
    let swap02 = [
        [['SWAP02']]
    ];
    cp10.forEach(c1 => {
        cp20.forEach(c2 => {
            cp21.forEach(c3 => {
                swap02.forEach(sw => {
                    circuits.push([['H0'], [c1], [c2], ['H1'], [c3], ['H2'], ...sw]);
                    circuits.push([['H0'], [c2], [c1], ['H1'], [c3], ['H2'], ...sw]);
                });
            });
        });
    });
    return circuits;
}

export const STAGES = [
    {
        section: "Foundations",
        title: "Stage 0: Quantum Foundations",
        desc: "Master the language of quantum: states, amplitudes, interference, and the six poles of the Bloch Sphere.",
        qubits: 1,
        cols: 4,
        set: ['X0', 'Y0', 'Z0', 'H0', 'SX0'],
        levels: [
            {
                name: "1. Circuit Notation",
                quizDesc: "The target state is already satisfied — no gates needed.",
                hint: "The board starts completely empty. Since it already matches the target state, just hit Evaluate!",
                lesson: "### Welcome to the Quantum Realm!\n\nA quantum circuit is read **left to right**, like a musical score. Each horizontal line represents a **qubit** — a quantum bit.\n\n### Bra-Ket Notation\nIn quantum computing we label states using **Dirac notation**: $|·⟩$ (called a 'ket').\n\n* $|0⟩$ — this qubit will land on 0 when measured.\n* $|1⟩$ — this qubit will land on 1 when measured.\n\n### Amplitudes\nThe number in front of the ket is the **amplitude**. Squaring it gives the measurement probability.\n\nYour target reads:\n$$|ψ⟩ = 1 · |0⟩$$\n\nAmplitude = 1, so probability = 1² = 100%. It will definitely be a 0!\n\nEvery wire starts at $|0⟩$ by default, so an empty board already matches. **Just hit Evaluate!**",
                circuits: [[[]]]
            },
            {
                name: "2. Superposition",
                quizDesc: "Prepare the superposition state |+⟩ = (|0⟩ + |1⟩)/√2.",
                hint: "Place a single Hadamard (H) gate on the wire to split the qubit into a 50/50 superposition.",
                lesson: "### Breaking Free From Binary\n\nClassical bits are locked to 0 or 1. Qubits can exist in a **superposition** of both at the same time!\n\nA Hadamard (**H**) gate creates a perfect 50/50 blend:\n$$|ψ⟩ = 1/√2 · |0⟩ + 1/√2 · |1⟩$$\n\n### Where Does 1/√2 Come From?\n**Probabilities = amplitude squared.** For a 50% outcome we need:\n$$amplitude² = 1/2$$\n$$amplitude = √(1/2) = 1/√2 ≈ 0.707$$\n\nSo $1/√2$ is simply *the square root of 50%*.\n\n### The Action Plan\nPlace an **H** gate on the wire. Watch the **Live Bloch Sphere** on the right — the state vector drops from the North Pole to the equator. That's superposition!",
                circuits: [[['H0']]]
            },
            {
                name: "3. Bloch Sphere & Phase",
                quizDesc: "Prepare the state |−⟩ = (|0⟩ − |1⟩)/√2.",
                hint: "Combine an H gate with a Z gate to flip the phase of the superposition to negative.",
                lesson: "### Reading the Bloch Sphere\n\nThe **Live Bloch Sphere** on the right is a 3D map of your qubit's state:\n* **North Pole** → $|0⟩$, the qubit is definitely 0.\n* **South Pole** → $|1⟩$, the qubit is definitely 1.\n* **Equator** → 50/50 superposition!\n\n### The Power of Phase\nAmplitudes can be **negative**. Your target has a minus sign:\n$$|ψ⟩ = 1/√2 · |0⟩ − 1/√2 · |1⟩$$\n\nSquaring a negative still gives a positive probability: $(-1/√2)² = 1/2 = 50%$. Measuring it still gives a random 0 or 1. But the **phase shift** flips the qubit to the *opposite side* of the equator.\n\n### Why Phase Matters\nAmplitudes behave like **waves**: positive = crest, negative = trough. By controlling phase, quantum algorithms make wrong answers **cancel out** (destructive interference) and the correct answer **amplify** to 100% (constructive interference)!\n\n### The Goal\nApply **H** to reach the equator, then **Z** to flip the phase.",
                circuits: [[['H0'], ['Z0']]]
            },
            {
                name: "4. X Gate",
                quizDesc: "Prepare the state |1⟩.",
                hint: "Flip the qubit entirely to the South Pole.",
                lesson: "<b>The Mechanism:</b> The Pauli-X gate acts as a quantum NOT gate. It rotates the qubit 180 degrees around the X-axis, flipping it from the North Pole (|0⟩) to the South Pole (|1⟩).<br><br><b>Why it matters:</b> Bit-flips are the most basic form of logic. In quantum error correction, identifying and fixing accidental X-flips caused by environmental noise is a major area of research.",
                circuits: [[['X0']]]
            },
            {
                name: "5. SX Gate",
                quizDesc: "Prepare the state (|0⟩ − i|1⟩)/√2.",
                hint: "A single half-X rotation from the ground state.",
                lesson: "<b>The Mechanism:</b> A single SX gate on |0⟩ pushes the qubit to the negative Y-axis. Notice how different combinations of rotations can reach different points on the equator.<br><br><b>Why it matters:</b> The X, Y, and Z axes represent non-commuting observables. Navigating precisely between them is exactly how quantum states are calibrated, tested, and manipulated inside physical hardware like superconducting transmon qubits.",
                circuits: [[['SX0']]]
            },
            {
                name: "6. Complex Amplitudes",
                quizDesc: "Prepare the state (|0⟩ + i|1⟩)/√2.",
                hint: "Combine a full X flip and a half-X (SX) rotation.",
                lesson: "<b>The Mechanism:</b> In the previous level, SX on |0⟩ landed at the -Y pole: (|0⟩ − i|1⟩)/√2. Now flip to |1⟩ first with X, then apply the same SX rotation — and you land on the <em>opposite</em> Y pole: (|0⟩ + i|1⟩)/√2. That 'i' in front of |1⟩ is a purely imaginary amplitude.<br><br><b>Why it matters:</b> Complex amplitudes are fundamental to quantum mechanics. Controlling imaginary phases is a key building block for advanced algorithms like the Quantum Fourier Transform, a core component of Shor's algorithm for breaking RSA encryption.",
                circuits: [[['X0'], ['SX0']]]
            }
        ]
    },
    {
        section: "Foundations",
        title: "Stage 1: Bell Pairs",
        desc: "Create the four maximally entangled 2-qubit states.",
        qubits: 2, cols: 4, set: ['X0', 'X1', 'Z0', 'Z1', 'H0', 'H1', 'CX01', 'CX10'],
        levels: [
            {
                name: "1.1: 2-Qubit States",
                quizDesc: "Prepare the state |01⟩.",
                hint: "The board now has 2 qubits (q0 top, q1 bottom). Place an X gate on the bottom wire to flip it to |1⟩.",
                lesson: "### Combining Wires\n\nWhen we chain multiple qubits together they form a **register**. We read wires **top to bottom** as a single binary string.\n\nOn this 2-qubit board:\n* Top wire = **q₀** (Qubit 0)\n* Bottom wire = **q₁** (Qubit 1)\n\n### Reading Multi-Qubit States\nThe target $1|01⟩$ means two assignments:\n* **q₀ → 0** (no gate needed)\n* **q₁ → 1** (needs to be flipped!)\n\n### How the X Gate Works\nEvery wire starts at 0. The **X gate** (quantum NOT) flips a qubit from $|0⟩$ to $|1⟩$.\n\nPlace an **X** gate on the bottom wire — watch its Bloch Sphere drop to the South Pole!\n\n### What's Next?\nWith two qubits, an entirely new phenomenon becomes possible: **entanglement**, where qubits become quantum-mechanically inseparable. That's what this stage explores.",
                circuits: [[['X1']]]
            },
            {
                name: "1.2: Bell State Φ+", quizDesc: "Prepare the Bell state Φ⁺ = (|00⟩ + |11⟩)/√2.", circuits: [[['H0'], ['CX01']]], hint: "Entangle |+⟩ on q2 with |0⟩ on q1.",
                lesson: "<b>The Mechanism:</b> The CNOT gate is represented on the board by a solid control dot connected vertically to a ⊕ target cross. It flips the target qubit *only* if the control qubit is |1⟩. Because our control qubit is in a superposition of |0⟩ and |1⟩, the target becomes a superposition of flipped and not-flipped. They are now mathematically locked together.<br><br><b>Why it matters:</b> This is maximum entanglement. Measuring one qubit instantly dictates the state of the other, regardless of distance. This is the exact state used in Quantum Teleportation and Superdense Coding."
            },
            {
                name: "1.3: Bell State Φ-", quizDesc: "Prepare the Bell state Φ⁻ = (|00⟩ − |11⟩)/√2.", circuits: [[['X0'], ['H0'], ['CX01']]], hint: "Entangle |-⟩ on q2 with |0⟩ on q1.",
                lesson: "<b>The Mechanism:</b> By starting the control qubit in the |-⟩ state before entangling, we embed a relative negative phase into the entangled pair.<br><br><b>Why it matters:</b> Entanglement isn't just about perfectly correlated classical data. By manipulating the phase within an entangled pair, quantum networks can encode extra classical bits of information, transferring 2 bits of data using only 1 physical qubit (Superdense coding)."
            },
            {
                name: "1.4: Bell State Ψ+", quizDesc: "Prepare the Bell state Ψ⁺ = (|01⟩ + |10⟩)/√2.", circuits: [[['X1'], ['H0'], ['CX01']]], hint: "Flip the target before entangling.",
                lesson: "<b>The Mechanism:</b> Here, the qubits are perfectly *anti-correlated*. If you measure a 0 on q2, you are guaranteed to find a 1 on q1, and vice versa.<br><br><b>Why it matters:</b> Anti-correlated Bell states are frequently used in Quantum Key Distribution (like the E91 protocol) to generate perfectly secure, unhackable encryption keys between two distant parties."
            },
            {
                name: "1.5: Bell State Ψ-", quizDesc: "Prepare the Bell state Ψ⁻ = (|01⟩ − |10⟩)/√2.", circuits: [[['X0', 'X1'], ['H0'], ['CX01']]], hint: "Start with |11⟩ before entangling.",
                lesson: "<b>The Mechanism:</b> Known as the 'Singlet State', this is the most unique of the four. It is rotationally invariant—meaning no matter what axis (X, Y, or Z) you measure these qubits on, they will always yield opposite results.<br><br><b>Why it matters:</b> Because of its perfect symmetry, the Singlet State is highly resistant to certain types of environmental noise, making it a foundational concept for creating Decoherence-Free Subspaces in quantum memory."
            }
        ]
    },
    {
        section: "Multi-Qubit Gates",
        title: "Stage 2: Controlled-Z (CZ)",
        desc: "Implement a CZ gate using CNOTs and Hadamards.",
        qubits: 2, cols: 5, set: ['X0', 'X1', 'H0', 'H1', 'CX01', 'CX10'],
        levels: [
            { 
                name: "2.1: CZ from CNOT", quizDesc: "Prepare |++⟩ and apply a CZ gate — build the CZ using only CX and H gates.", circuits: [[['H0', 'H1'], ['H1'], ['CX01'], ['H1']]], hint: "H X H = Z. (The first column places both qubits in |+⟩ so the CZ effect is visible!)",
                lesson: "<b>The Mechanism:</b> A Controlled-Z (CZ) applies a negative phase only when both qubits are |1⟩. Since H turns X into Z (and vice versa), sandwiching the target of a CNOT between two Hadamards transforms the controlled-bit-flip into a controlled-phase-flip.<br><br><b>Why it matters:</b> Real quantum hardware often only supports one type of native 2-qubit gate (like the CX gate on IBM hardware). 'Quantum Compilers' must rewrite advanced algorithms using these basic gate identities to physically run the code on the chip."
            }
        ]
    },
    {
        section: "Multi-Qubit Gates",
        title: "Stage 3: GHZ State",
        desc: "Entangle three qubits symmetrically.",
        qubits: 3, cols: 5, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20'],
        levels: [
            { 
                name: "3.1: GHZ State", quizDesc: "Prepare the GHZ state (|000⟩ + |111⟩)/√2.", circuits: [[['H0'], ['CX01'], ['CX12']]], hint: "Create a superposition, then chain the CNOTs down the line.",
                lesson: "<b>The Mechanism:</b> The Greenberger–Horne–Zeilinger (GHZ) state entangles three qubits so they are either all |000⟩ or all |111⟩. We build it by creating a standard Bell pair, and then using a second CNOT to 'infect' a third qubit with the entanglement.<br><br><b>Why it matters:</b> GHZ states demonstrate quantum non-locality far more powerfully than 2-qubit Bell pairs. They are incredibly useful in Quantum Metrology (creating hyper-sensitive measurement devices) and Quantum Secret Sharing protocols."
            }
        ]
    },
    {
        section: "Multi-Qubit Gates",
        title: "Stage 4: Build a SWAP Gate",
        desc: "Construct SWAP and Controlled-SWAP (Fredkin) gates using CNOTs. (Strict Mode)",
        qubits: 3, cols: 5, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20'],
        levels: [
            {
                name: "4.1: SWAP Gate",
                quizDesc: "q1 = |+⟩, q2 = |1⟩. Swap the states of q1 and q2 using only CX gates.",
                circuits: [
                    [['H1', 'X2'], ['CX12'], ['CX21'], ['CX12']],
                    [['H1', 'X2'], ['CX21'], ['CX12'], ['CX21']],
                    [['H1'], ['X2'], ['CX12'], ['CX21'], ['CX12']],
                    [['H1'], ['X2'], ['CX21'], ['CX12'], ['CX21']],
                    [['X2'], ['H1'], ['CX12'], ['CX21'], ['CX12']],
                    [['X2'], ['H1'], ['CX21'], ['CX12'], ['CX21']]
                ],
                hint: "Prepare q1 = |+⟩ (H) and q2 = |1⟩ (X). Swap them with three alternating CNOT gates — watch the Bloch spheres exchange positions.",
                lesson: "<b>The Mechanism:</b> The SWAP gate exchanges the full quantum states of two qubits — including superpositions and phases. Here q1 starts in |+⟩ = (|0⟩+|1⟩)/√2 and q2 in |1⟩. After the three-CNOT sequence, q1 holds |1⟩ and q2 holds |+⟩. The XOR logic of back-and-forth CNOTs performs the swap without needing a third 'scratch' qubit.<br><br><b>Why it matters:</b> Physical qubits on a microchip are usually only wired to their immediate neighbors. If an algorithm requires entangling two distant qubits on opposite sides of the chip, the compiler <em>must</em> route their information through the grid using SWAP networks."
            },
            {
                name: "4.2: CSWAP (3 CCX)",
                quizDesc: "q0 = |+⟩, q1 = |+⟩. Implement a CSWAP gate (control: q0, targets: q1 ↔ q2) using only Toffoli (CCX) gates.",
                set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20', 'CCX012', 'CCX021'],
                circuits: PREP_5.flatMap(p => [
                    [...p, ['CCX012'], ['CCX021'], ['CCX012']],
                    [...p, ['CCX021'], ['CCX012'], ['CCX021']]
                ]),
                hint: "Superpose q2 (H) and q1 (H). Then conditionally swap q1 and q2 using three Toffoli gates.",
                lesson: "<b>The Mechanism:</b> The Controlled-SWAP (Fredkin) gate swaps the target qubits <em>only</em> if the control qubit is |1⟩. Here q1 starts in |+⟩ and q2 in |0⟩. When q2 = |+⟩ (superposition), the gate conditionally swaps: the |1⟩ branch of q2 exchanges q1 and q2, while the |0⟩ branch leaves them unchanged. We build it by upgrading all three CNOTs from the previous circuit into Toffoli (CCX) gates controlled by q2.<br><br><b>Why it matters:</b> The Fredkin gate is a universal reversible logic gate. With a superposition control, CSWAP creates entanglement between the control and the swapped registers — the foundation of the Swap Test algorithm."
            },
            {
                name: "4.3: CSWAP (Mixed)",
                quizDesc: "q0 = |+⟩, q1 = |+⟩. Implement the same CSWAP gate (control: q0, targets: q1 ↔ q2) using a mix of Toffoli and CX gates.",
                set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20', 'CCX012', 'CCX021'],
                circuits: getStage5_3Circuits(),
                hint: "Same setup as 4.2 — q2 and q1 in |+⟩. This time, wrap a single Toffoli in two CNOTs to achieve the identical conditional swap.",
                lesson: "<b>The Mechanism:</b> The same CSWAP — same input states, same output — but compiled down to 1 Toffoli and 2 CNOTs instead of 3 Toffolis. The key insight is that only one of the three back-and-forth flips needs to be conditional; the flanking CNOTs handle the cascade, reducing the heavy-gate count by two-thirds.<br><br><b>Why it matters:</b> Every gate introduces noise, and Toffoli gates are notoriously expensive on real hardware. Compiling circuits to use fewer heavy gates while achieving the exact same mathematical result — quantum compilation — is a major area of quantum software engineering."
            }
        ]
    },
    {
        section: "Quantum Protocols",
        title: "Stage 5: The Swap Test",
        desc: "Measure how similar two states are without directly measuring them. (Strict Mode)",
        qubits: 3, cols: 8, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20', 'CCX012', 'CCX021', 'CCX120'],
        levels: [
            {
                name: "5.1: Swap Test: Same",
                quizDesc: "Run the Swap Test comparing q1 = |+⟩ against q2 = |+⟩.",
                circuits: getStage6Circuits('H1', 'H2'),
                hint: "Prepare q1 = |+⟩ and q2 = |+⟩ with two Hadamards. Superpose the ancilla (q0) with H, apply the CSWAP, then close with another H on q0.",
                lesson: "<b>The Mechanism:</b> The Swap Test measures how similar two quantum states are. Superpose an ancilla (q0), use it to CSWAP the two target states (q1, q2), then interfere q0 with a final Hadamard. The probability of measuring q0 as |0⟩ is P(0) = 0.5 + 0.5|⟨ψ|φ⟩|². Here q1 = q2 = |+⟩, so |⟨ψ|φ⟩|² = 1 and q0 deterministically returns to |0⟩.<br><br><b>Why it matters:</b> Comparing massive vectors is the core of classical machine learning (like checking if an image is a cat or a dog). The Swap Test computes the inner product of two quantum states with a single ancilla measurement, offering a potential exponential speedup for Quantum AI."
            },
            {
                name: "5.2: Swap Test: Orthogonal",
                quizDesc: "Run the Swap Test comparing q1 = |1⟩ against q2 = |0⟩.",
                circuits: getStage6Circuits('X1'),
                hint: "Flip q1 to |1⟩. Then run the exact same Swap Test logic as before!",
                lesson: "<b>The Mechanism:</b> Now we test two completely orthogonal (opposite) states: |1⟩ (on q1) and |0⟩ (on q2). Their inner product is 0. Following our Swap Test formula: P(0) = 0.5 + 0.5(0) = 0.5. This means the ancilla qubit has exactly a 50% chance of being measured as |0⟩. Look at the Bloch sphere—Q0 is perfectly balanced on the equator!<br><br><b>Why it matters:</b> This demonstrates the lower bounds of the algorithm. When measuring the ancilla, P(0) = 0.5 is the absolute minimum you can get, proving that the datasets encoded in the qubits have absolutely zero overlap."
            },
            {
                name: "5.3: Swap Test: Overlap",
                quizDesc: "Run the Swap Test comparing q1 = |+⟩ against q2 = |0⟩.",
                circuits: getStage6Circuits('H1'),
                hint: "Prep q1 with a Hadamard to |+⟩. Run the Swap Test again to see what partial overlap looks like.",
                lesson: "<b>The Mechanism:</b> What if the states are only partially similar? Here we compare |+⟩ and |0⟩. Their squared inner product is 0.5. The formula gives P(0) = 0.5 + 0.5(0.5) = 0.75 (or 75%). Look at the statevector amplitudes—by checking q2, we measured the exact mathematical overlap of our two target states!<br><br><b>Why it matters:</b> This is the real magic of the Swap test. It doesn't just say 'yes' or 'no'; it computes the exact continuous inner product (the quantum equivalent of the classical dot product). This serves as the computational backbone for advanced algorithms like Quantum Support Vector Machines (QSVM)."
            }
        ]
    },
    {
        section: "Quantum Protocols",
        title: "Stage 6: The Hadamard Test",
        desc: "Read hidden properties of entangled states using a single ancilla qubit. (Strict Mode)",
        qubits: 3, cols: 8, set: ['X0','X1','X2', 'H0','H1','H2', 'CX01','CX10','CX12','CX21', 'CX02', 'CX20'],
        levels: [
            {
                name: "6.1: The Hadamard Test",
                qubits: 2,
                cols: 5,
                set: ['X1', 'H0', 'H1', 'CX01'],
                quizDesc: "q1 = |−⟩. Build the Hadamard Test to detect that X flips q1's sign — q0 should land on |1⟩.",
                hint: "Prepare q1 as |−⟩ using X then H. Put q0 in superposition with H. Apply CX01. Close with H on q0.",
                lesson: "<b>The Question:</b> Can you find out whether a gate 'flips the sign' of a quantum state — without disturbing that state at all? Yes. The <b>Hadamard Test</b> does exactly this.<br><br><b>Two qubits:</b> q0 is the <i>ancilla</i> — a scratch qubit that holds the answer. q1 is the state you want to probe.<br><br><b>The Circuit — three steps:</b><br>1. <b>H on q0</b> — puts the ancilla in superposition: |0⟩ → |+⟩ = (|0⟩+|1⟩)/√2<br>2. <b>Controlled-X (CX01)</b> — X is applied to q1 <i>only</i> when q0 = |1⟩<br>3. <b>H on q0</b> — converts any hidden phase into a visible bit<br><br><b>Reading the result:</b> <b>q0 = |0⟩</b> means the gate left q1's sign unchanged (+1). <b>q0 = |1⟩</b> means the gate negated q1's sign (−1).<br><br><b>What happens here:</b> Prepare q1 in |−⟩ = (|0⟩−|1⟩)/√2 using X then H. The key fact: X|−⟩ = −|−⟩ — X returns |−⟩ with a −1 sign. During the CX, this −1 silently moves onto the |1⟩ branch of q0's superposition, turning |+⟩ into |−⟩. The final H converts |−⟩ → |1⟩.<br>q0 ends at |1⟩. q1 stays in |−⟩, completely undisturbed.<br><br><b>Why it matters:</b> You probed q1 without measuring it. This 'phase kickback into the ancilla' is the engine behind every quantum error correction syndrome measurement — reading the parities of data qubits without collapsing the quantum information stored in them. The next two levels scale this up to 3 qubits.",
                circuits: getStage6_0Circuits()
            },
            {
                name: "6.2: Hadamard Test: X Parity",
                quizDesc: "Prepare (|00⟩ − |11⟩)/√2 on q1 and q2, then run the Hadamard Test to measure the XX expectation value.",
                circuits: getStage7_1Circuits(),
                hint: "Prepare (|00⟩ − |11⟩)/√2 on q1 & q2 using X1, H1, CX12. Then H on q0, CX from q0→q1 and q0→q2, then H on q0.",
                lesson: "<b>What the Hadamard Test does:</b> Given a state |ψ⟩ and a unitary U, this circuit measures <b>⟨ψ|U|ψ⟩</b> — the expectation value (average measured value) of U on |ψ⟩. The result lives in the ancilla q2: the closer ⟨ψ|U|ψ⟩ is to −1, the more likely q0 lands on |1⟩. When |ψ⟩ is an eigenstate of U (U|ψ⟩ = ±|ψ⟩), the expectation value is exactly ±1, and q0 is certain.<br><br><b>The Circuit Shape:</b> H on ancilla q2 → controlled-U on the target qubits → H on q2. Read q0: <b>|0⟩ means ⟨U⟩ = +1, |1⟩ means ⟨U⟩ = −1</b>.<br><br><b>Step by step:</b> q1 and q2 are prepared in (|00⟩−|11⟩)/√2. After the first H, q0 = |+⟩. The two CX gates implement controlled-XX: when q0=|1⟩, both q1 and q2 are flipped. Flipping both qubits of (|00⟩−|11⟩)/√2 swaps the two terms and flips the sign → −(|00⟩−|11⟩)/√2. That −1 factor attaches to the |1⟩ branch of q0, silently shifting it from |+⟩ to |−⟩. The final H converts this phase into a real bit flip: H|−⟩ = |1⟩.<br><br><b>Why this target state?</b> (|00⟩−|11⟩)/√2 is an eigenstate of XX with eigenvalue −1, so ⟨XX⟩ = −1 and q0 is certain to be |1⟩. A state with ⟨XX⟩ = +1, like (|00⟩+|11⟩)/√2, would leave q0 at |0⟩ — try removing the first X1 gate to see this.<br><br><b>Why it matters:</b> q0 revealed the XX parity of q1 and q2 without ever directly measuring them — their entangled state is completely untouched. In quantum error correction, this is exactly how syndrome measurements work: read the parities of data qubits without collapsing the encoded information. Z-parity checks do the same — see 6.3."
            },
            {
                name: "6.3: Hadamard Test: Z Parity",
                quizDesc: "Prepare (|01⟩ + |10⟩)/√2 on q1 and q2, then run the Hadamard Test to measure the ZZ expectation value.",
                circuits: getStage7_2Circuits(),
                hint: "Prepare (|01⟩+|10⟩)/√2 on q1 & q2 using X2, H1, CX12. Sandwich each CX with H on q1 and q2 to build Controlled-Z gates.",
                lesson: "<b>Same structure, new operator:</b> This time we measure Z-parity (Z⊗Z). The target state is (|01⟩+|10⟩)/√2 — q1 and q2 are always opposite (one is 0, the other is 1). Z⊗Z has eigenvalue −1 here because Z|0⟩ = +|0⟩ and Z|1⟩ = −|1⟩: the two Z outcomes always disagree, giving a net −1.<br><br><b>Building a Controlled-Z:</b> There is no native CZ gate on this board, but H·CX·H = CZ is a standard identity. Sandwiching CX01 with H gates on q1 turns it into a controlled-Z from q2 to q1. The same trick on CX02 gives a controlled-Z to q2. Together they implement a controlled-(Z⊗Z).<br><br><b>The outcome:</b> The −1 eigenvalue kicks back into q2's phase, drifting it from |+⟩ to |−⟩. The final H converts this to |1⟩ — identical logic to 6.1, just a different operator and target state.<br><br><b>Why it matters:</b> X-parity and Z-parity are complementary checks: X-parity detects phase-flip errors, Z-parity detects bit-flip errors. By continuously measuring both — without disturbing the data qubits — a quantum computer can pinpoint and correct errors in real time. This is the foundation of the surface code, today's most promising path to fault-tolerant quantum computing."
            }
        ]
    },
    {
        section: "Phase & QFT",
        title: "Stage 7: Phase Rotations",
        desc: "Rotate states around the Z-axis using parameterized RZ gates. (Strict Mode)",
        qubits: 2, cols: 6, set: ['X0', 'X1', 'H0', 'H1', 'CX01', 'CX10', 'RZ0', 'RZ1'],
        levels: [
            {
                name: "7.1: S Gate (π/2)",
                quizDesc: "Prepare the state (|0⟩ + i|1⟩)/√2.",
                circuits: [[['H0'], ['RZ_PI2_0']]],
                hint: "Select π/2 from the RZ dropdown in the palette, then apply it after a Hadamard on q0.",
                lesson: "<b>The Mechanism:</b> The RZ gate applies a specific phase rotation around the Z-axis of the Bloch sphere. When θ = π/2, this is commonly called the <b>S gate</b>. Applying it to |+⟩ rotates the state 90 degrees along the equator.<br><br><b>Why it matters:</b> The S gate introduces complex/imaginary amplitudes into the system, taking us to the |+i⟩ state on the Y-axis. This forms the building blocks for creating robust combinations of non-real quantum states."
            },
            {
                name: "7.2: T Gate (π/4)",
                quizDesc: "Prepare the state (|0⟩ + e^(iπ/4)|1⟩)/√2.",
                circuits: [[['H0'], ['RZ_PI4_0']]],
                hint: "Select π/4 from the dropdown, apply after a Hadamard on q0.",
                lesson: "<b>The Mechanism:</b> When θ = π/4, the RZ gate is known as the <b>T gate</b>. It rotates the state 45 degrees along the equator. <br><br><b>Why it matters:</b> The T gate is arguably the most important gate in quantum computing. The basic Clifford gates (H, X, CNOT, S) can be efficiently simulated on a classical computer. To achieve true 'Quantum Advantage', you *must* use non-Clifford gates like the T gate. It provides the universal continuous rotation capability needed for complex algorithms."
            },
            {
                name: "7.3: Combining Phases",
                quizDesc: "Flip q0 to |1⟩ using only Hadamard and 3 RZ gates aggregating to a pi phase.",
                circuits: [[['H0'], ['RZ_PI4_0'], ['RZ_PI4_0'], ['RZ_PI2_0'], ['H0']]],
                hint: "Apply two T gates (π/4) and one S gate (π/2) sequentially between Hadamards on q0.",
                lesson: "<b>The Mechanism:</b> Z-rotations commute, meaning their angles simply add together! π/4 + π/4 + π/2 exactly equals π. An RZ(π) gate is equivalent to a Pauli-Z gate. So H -> (T + T + S) -> H is exactly mathematically identical to H -> Z -> H, which equals X!<br><br><b>Why it matters:</b> Because T gates are highly susceptible to noise, advanced quantum error correction schemes spend massive resources on 'Magic State Distillation' just to execute a single reliable T gate. Knowing how to combine and compile these phase rotations optimally determines how fast a quantum program can run before decoherence destroys it."
            },
            {
                name: "7.4: Controlled Phase",
                quizDesc: "q0 = |+⟩, q1 = |+⟩. Implement a CP(π/2) phase gate.",
                circuits: getStage8_4Circuits(),
                hint: "Prep q0 and q1 with H. Add RZ(π/4) to both, CX(0,1), RZ(-π/4) on q1, and CX(0,1).",
                lesson: "<b>The Goal:</b> CP(θ) must add a phase of e^(iθ) to |11⟩ and leave |00⟩, |01⟩, |10⟩ unchanged. The RZ gate only adds phase when a qubit is |1⟩ — the challenge is combining single-qubit RZ gates and CNOTs to target only the joint |11⟩ condition.<br><br><b>Circuit structure:</b> RZ(θ/2) on q2, RZ(θ/2) on q1, then the CNOT sandwich: CX · RZ(−θ/2) on q1 · CX.<br><br><b>The CNOT sandwich:</b> The two CNOTs flip q1 around the middle RZ. When q2=|0⟩ the CNOTs do nothing — the RZ fires on q1 normally. When q2=|1⟩ the CNOTs flip q1 before and after, so the RZ fires on the <i>flipped</i> q1. This means the sandwich subtracts phase from |01⟩ (q1=|1⟩, no flip) and from |10⟩ (q1 flipped to |1⟩), but not from |11⟩ (q1 flipped to |0⟩, RZ sees |0⟩ and does nothing).<br><br><b>State by state (θ = π/2, each RZ angle = π/4):</b><br>· |00⟩: q2=|0⟩ → no RZ on q2; q1=|0⟩ → no RZ on q1; sandwich sees |0⟩ → nothing. <b>Total: 0</b><br>· |01⟩: no RZ on q2; +π/4 from q1; sandwich subtracts π/4 (q1=|1⟩). <b>Total: 0</b><br>· |10⟩: +π/4 from q2; no RZ on q1; sandwich subtracts π/4 (flipped q1=|1⟩). <b>Total: 0</b><br>· |11⟩: +π/4 from q2; +π/4 from q1; sandwich sees flipped q1=|0⟩, does nothing. <b>Total: +π/2 = e^(iπ/2) ✓</b><br><br><b>Why the RZ on q2?</b> Without it, |10⟩ would have net −π/4 from the sandwich alone — incorrectly phase-shifted. The RZ(θ/2) on q2 adds exactly +π/4 when q2=|1⟩, cancelling the sandwich's contribution on |10⟩ while leaving |11⟩ unaffected (both contributions stack).<br><br><b>Why it matters:</b> This is how quantum computers physically execute CP gates in hardware. Every CP gate in the Quantum Fourier Transform (Stage 8) is compiled down to exactly this CNOT-sandwich technique inside the chip."
            }
        ]
    },
    {
        section: "Phase & QFT",
        title: "Stage 8: Quantum Fourier Transform",
        desc: "Shift into the phase basis (XY plane) to encode data as angles. (Strict Mode)",
        qubits: 3, cols: 9, set: ['X0','X1','X2', 'H0','H1','H2', 'CP01', 'CP10', 'CP12', 'CP21', 'CP02', 'CP20', 'SWAP01', 'SWAP12', 'SWAP02'],
        levels: [
            {
                name: "8.1: QFT (1 Qubit)",
                quizDesc: "Apply the 1-qubit Quantum Fourier Transform.",
                circuits: [[['H0']]],
                hint: "A 1-qubit QFT is just a Hadamard gate. Apply it to transform |0⟩ into the phase basis.",
                lesson: "<b>The Mechanism:</b> The Quantum Fourier Transform converts data from the computational (Z) basis into the phase (XY) basis. For a single qubit, this is exactly what the Hadamard gate does — it maps |0⟩ to |+⟩, placing the qubit on the equator at phase angle 0.<br><br><b>Intuition:</b> In the Z-basis, information is stored as 0 or 1. In the XY (Fourier) basis, information is encoded as <i>rotation angles</i> around the equator. |0⟩ becomes angle 0, |1⟩ would become angle π, and superpositions land at intermediate angles. This phase encoding is what lets the multi-qubit QFT do powerful arithmetic!"
            },
            {
                name: "8.2: QFT (2 Qubits)",
                quizDesc: "Apply the 2-qubit Quantum Fourier Transform.",
                circuits: getStage9_2Circuits(),
                hint: "Apply H to q0, then a Controlled-Phase (π/2) from q1 to q0. Apply H to q1, then use the SWAP gate!",
                lesson: "<b>The Circuit:</b> H on q0 places it on the equator (phase 0). CP(π/2) from q1 would add a 90° kick to q0's phase — but only if q1 = |1⟩. Then H on q1, and a SWAP to fix the output bit order.<br><br><b>Phase Rule:</b> After the 2-qubit QFT on an input |x⟩, each qubit holds a phase angle that encodes x:<ul><li><b>q2</b> — the slow clock: phase = x × 90°. Completes one full rotation as x steps 0→4.</li><li><b>q1</b> — the fast clock: phase = x × 180°. Completes two full rotations as x steps 0→4.</li></ul>For our input x=0: both phases are 0°, so both qubits land at |+⟩. For x=1 they'd read 90° and 180°; for x=2, 180° and 0°; for x=3, 270° and 180°. Every value of x produces a unique pair of angles — its frequency fingerprint.<br><br><b>Why the CP gate?</b> Without it, q2 would always land at phase 0° regardless of q1's value. The CP(π/2) is what lets q1's bit value <em>bleed into</em> q2's phase, coupling the two qubits into a joint frequency encoding.<br><br><b>Why the SWAP?</b> The raw QFT circuit naturally outputs the most-significant frequency on the bottom wire. The SWAP corrects the bit order so q0 (top) carries the coarser, slower phase."
            },
            {
                name: "8.3: QFT (3 Qubits)",
                quizDesc: "Apply the 3-qubit Quantum Fourier Transform.",
                circuits: getStage9_3Circuits(),
                hint: "H on q0, CP(π/2) q1->q0, CP(π/4) q2->q0. Then H on q1, CP(π/2) q2->q1. Finally H on q2, and SWAP q2 and q2.",
                lesson: "<b>The Mechanism:</b> The full QFT cascades H and increasingly smaller CP gates. Each subsequent qubit adds a finer and finer angle (π/2, π/4, π/8...) to the target. It perfectly maps a binary number |x⟩ into a phase state where each qubit's angle represents a fraction of a full circle.<br><br><b>Why it matters:</b> This is the heart of Quantum Phase Estimation and Shor's Algorithm. By working in this Fourier regime (the XY plane), a quantum computer can evaluate the global properties of a function exponentially faster than any classical supercomputer ever could!"
            }
        ]
    },
    {
        section: "Phase & QFT",
        title: "Stage 9: The QFT Adder",
        desc: "Master Draper's addition algorithm in the Fourier domain.",
        qubits: 3,
        cols: 6,
        set: ['X', 'QFT', 'IQFT', 'RZ'],
        levels: [
            {
                name: "QFT Adder (+1)",
                quizDesc: "q2 = |1⟩. Use the Draper QFT adder to compute |1⟩ + 1.",
                hint: "Use an X gate on q2 to prepare |1>. Apply QFT. Add phase for +1 (RZ(π/4) on q2, RZ(π/2) on q1, RZ(π) on q0). Apply IQFT.",
                lesson: "Classical computers need extra 'scratchpad' bits to handle carry-overs when adding numbers. In 2000, Thomas Draper showed we can add numbers using **zero** extra space by computing in the Fourier domain!\n\n**1. Transform:** The QFT shifts our state into the frequency domain. Numbers are now encoded as phase shifts.\n\n**2. Rotate:** To add $+1$, we rotate the least significant qubit (q2) by $\\pi/4$, the middle (q1) by $\\pi/2$, and the most significant (q0) by $\\pi$.\n\n**3. Return:** The Inverse QFT (IQFT) brings us back to standard binary.\n\nPrepare the state $|1\\rangle$ using an X gate on q2, add $1$ to it in the Fourier domain, and bring it back!",
                circuits: [
                    [
                        ['X2'], 
                        ['QFT'],
                        ['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0'], 
                        ['IQFT'],
                        []
                    ]
                ]
            },
            {
                name: "QFT Adder (+2)",
                quizDesc: "q2 = |1⟩. Use the Draper QFT adder to compute |1⟩ + 2.",
                hint: "Prepare |1> on q2. Apply QFT. To add +2, double the phase shifts from the previous level! Apply IQFT.",
                lesson: "Now let's add $+2$ to our initial state of $|1\\rangle$.\n\nIn the Fourier domain, adding a larger number simply multiplies the phase shift. If adding $+1$ applied a $\\pi/4$ rotation to the lowest qubit, adding $+2$ will require $2 \\times \\pi/4 = \\pi/2$.\n\nCalculate the doubled phase shifts for q1 and q2 (a $2\\pi$ shift on q0 acts like a full rotation and can be skipped). Apply the math, and hit evaluate to see $1 + 2 = 3$!",
                circuits: [
                    [
                        ['X2'],
                        ['QFT'],
                        ['RZ_PI2_2', 'RZ_PI_1'],
                        ['IQFT'],
                        []
                    ]
                ]
            },
            {
                name: "QFT Adder (+3)",
                quizDesc: "q2 = |1⟩. Use the Draper QFT adder to compute |1⟩ + 3.",
                hint: "Prepare |1⟩ on q2. Apply QFT. For +3: q0 needs π, q1 needs −π/2, q2 needs π/4 then π/2 in two columns. Or: apply the full +1 phase column then the full +2 phase column. Apply IQFT.",
                lesson: "Adding $+3$ reveals two new wrinkles in the Draper adder.\n\nThe phase shift for qubit j (0 = MSB, 2 = LSB) is π·k / 2^j. For k = 3:\n\n- **q0 (j=0):** $3\\pi$ wraps back to $\\pi$ — same as a Z gate!\n\n- **q1 (j=1):** $3\\pi/2 = 2\\pi - \\pi/2$, which equals $-\\pi/2$. A **negative** angle appears for the first time!\n\n- **q2 (j=2):** $3\\pi/4$ has no single RZ gate. Decompose it as $\\pi/4 + \\pi/2$ in two consecutive columns — rotations on the same qubit add up.\n\n**Alternative approach:** Since $1 + 2 = 3$, you can also apply the complete **+1 phase set** in one column and the complete **+2 phase set** in the next. The total rotation on each qubit is identical! Phase rotations are additive, so both strategies produce exactly |4⟩.",
                circuits: [
                    [
                        ['X2'],
                        ['QFT'],
                        ['RZ_PI4_2', 'RZ_MINUS_PI2_1', 'RZ_PI_0'],
                        ['RZ_PI2_2'],
                        ['IQFT'],
                        []
                    ],
                    [
                        ['X2'],
                        ['QFT'],
                        ['RZ_PI4_2', 'RZ_PI2_1', 'RZ_PI_0'],
                        ['RZ_PI2_2', 'RZ_PI_1'],
                        ['IQFT'],
                        []
                    ]
                ]
            },
            {
                name: "Quantum Parallelism",
                quizDesc: "q2 = (|0⟩+|1⟩)/√2. Add +2 to the superposition — both values should increment simultaneously.",
                set: ['H', 'X', 'QFT', 'IQFT', 'RZ'],
                hint: "Apply H to q2 to create (|0⟩+|1⟩)/√2. Then QFT, add the +2 phase kicks (π/2 on q2, π on q1), and IQFT.",
                lesson: "Until now we have added to a single, definite number. Now comes the quantum magic.\n\nA Hadamard on q2 creates the superposition $(|0⟩ + |1⟩)/\\sqrt{2}$ — the register is **simultaneously 0 and 1**.\n\nThe QFT adder does not care which value it is. It applies the $+2$ phase pattern to the entire superposition at once. After the Inverse QFT, both values have been incremented: the output is $(|2⟩ + |3⟩)/\\sqrt{2}$ — both numbers incremented in **one circuit run**.\n\nThis is **quantum parallelism**. With n qubits in superposition, a single pass of the adder processes 2ⁿ inputs simultaneously. Shor's Algorithm exploits exactly this principle: it evaluates a modular function on an exponentially large set of inputs at once, then uses the interference pattern to extract the hidden period that breaks RSA encryption.",
                circuits: [
                    [
                        ['H2'],
                        ['QFT'],
                        ['RZ_PI2_2', 'RZ_PI_1'],
                        ['IQFT'],
                        [],
                        []
                    ]
                ]
            }
        ]
    },
    {
        section: "Phase & QFT",
        title: "Stage 10: Quantum Phase Estimation",
        desc: "Prepare an eigenstate, apply controlled-U gates to kick the phase into the counting register, then decode with IQFT₂.",
        qubits: 3,
        cols: 5,
        set: ['X2', 'H0', 'H1', 'CP02', 'CP20', 'CP12', 'CP21', 'IQFT2'],
        levels: [
            {
                name: "10.1: QPE — S gate (φ = ¼)",
                quizDesc: "q2 = |1⟩ (eigenstate of S). Run QPE to read out the phase of the S gate — output should encode φ = 1/4.",
                hint: "Prepare |ψ⟩=|1⟩ on q2 with X. Add H to q0 and q1. Apply CP(π) from q0→q2 (C-U² = C-Z) and CP(π/2) from q1→q2 (C-U = C-S). Finish with IQFT₂. Output: |01 1⟩.",
                lesson: "**Quantum Phase Estimation (QPE)** finds the eigenphase φ of a unitary U. Given an eigenstate |ψ⟩ where U|ψ⟩ = e^(2πiφ)|ψ⟩, the circuit reads out φ as a binary number.\n\n**Why |1⟩ is an eigenstate of S:** The S gate applies a phase to |1⟩ while leaving |0⟩ unchanged. Writing that phase in two equivalent forms:\n$$S|1⟩ = e^{iπ/2}|1⟩ = e^{2πi·(1/4)}|1⟩$$\nSo the eigenphase is **φ = 1/4**.\n\n**Circuit layout:** q₀ and q₁ are the **phase register** (counting qubits); q₂ holds the eigenstate.\n\n**Step 1 — Prepare:** X on q₂ creates |ψ⟩ = |1⟩. H on q₀ and q₁ puts the phase register into $|+⟩|+⟩$.\n\n**Step 2 — Phase kickback:** Each counting qubit controls a different power of U applied to |ψ⟩:\n* q₀ controls $U^2 = S^2 = Z$ → place $CP(π)$ from q₀ to q₂\n* q₁ controls $U = S$ → place $CP(π/2)$ from q₁ to q₂\n\nThe eigenvalue e^(2πiφ) kicks back as a relative phase on each counting qubit, Fourier-encoding φ across the register.\n\n**Step 3 — Decode:** IQFT₂ on q₀, q₁ converts the phase-encoded register to a binary count.\n\n**Reading the result:** The output |01⟩ is a 2-bit binary fraction **0.b₁b₀** — q₁ is the MSB (b₁) and q₀ is the LSB (b₀). Substituting the measured bits:\n$$φ = 0.01 (binary) = 0·(1/2) + 1·(1/4) = 1/4$$\nMeasuring **0.01** in binary confirms **φ = 1/4** — the eigenphase of the S gate.",
                circuits: [
                    [['X2'], ['H0', 'H1'], ['CP_PI_02'], ['CP_PI2_12'], ['IQFT2']],
                    [['X2'], ['H0', 'H1'], ['CP_PI2_12'], ['CP_PI_02'], ['IQFT2']],
                    [['X2', 'H0', 'H1'], ['CP_PI_02'], ['CP_PI2_12'], ['IQFT2'], []],
                    [['X2', 'H0', 'H1'], ['CP_PI2_12'], ['CP_PI_02'], ['IQFT2'], []]
                ]
            },
            {
                name: "10.2: QPE — S† gate (φ = ¾)",
                quizDesc: "q2 = |1⟩ (eigenstate of S†). Run QPE to read out the phase of the S† gate — output should encode φ = 3/4.",
                hint: "Same structure as 10.1 — only q1's rotation changes. (S†)²=Z, so q0 still uses CP(π). q1 now controls U=S†: use CP(−π/2) from q1→q2. Output: |11 1⟩.",
                lesson: "Now estimate the eigenphase of the S† gate.\n\nS†|1⟩ = e^(−iπ/2)|1⟩ = e^(2πi·3/4)|1⟩, so φ = 3/4.\n\nThe circuit is nearly identical to 10.1 — only the controlled rotation on q₁ changes:\n* q₀ still controls $(S†)^2 = Z$ → same $CP(\\pi)$ as before\n* q₁ now controls $U = S†$ → place $CP(-\\pi/2)$ from q₁ to q₂\n\nAfter IQFT₂ the output is $|11⟩|1⟩$ — decimal 3 out of 4, confirming φ = 3/4.\n\n**Key insight:** S and S† share the same C-Z block. Their circuits differ only in the sign of the C-U rotation, yet QPE cleanly distinguishes φ = 1/4 from φ = 3/4.",
                circuits: [
                    [['X2'], ['H0', 'H1'], ['CP_PI_02'], ['CP_MINUS_PI2_12'], ['IQFT2']],
                    [['X2'], ['H0', 'H1'], ['CP_MINUS_PI2_12'], ['CP_PI_02'], ['IQFT2']],
                    [['X2', 'H0', 'H1'], ['CP_PI_02'], ['CP_MINUS_PI2_12'], ['IQFT2'], []],
                    [['X2', 'H0', 'H1'], ['CP_MINUS_PI2_12'], ['CP_PI_02'], ['IQFT2'], []]
                ]
            }
        ]
    },
    {
        section: "Quantum Algorithms",
        title: "Stage 11: Grover's Algorithm",
        desc: "Harness phase kickback, the CCZ oracle, and amplitude amplification to search a quantum database.",
        qubits: 3, cols: 11,
        set: ['H0', 'H1', 'H2', 'X0', 'X1', 'X2', 'CX02', 'CCX012'],
        levels: [
            {
                name: "11.1: Phase Kickback",
                quizDesc: "Use phase kickback to flip q0 to |1⟩ — prepare q2 as the ancilla |−⟩ and exploit the CX eigenvalue.",
                set: ['H0', 'H2', 'X2', 'CX02'],
                hint: "Put q0 in |+⟩ with H. Create |−⟩ on q2 with X then H. Apply CX (control q0 → target q2). The −1 eigenvalue of |−⟩ kicks back onto q0, flipping it to |−⟩. Finish with H on q0 to convert the phase to a visible |1⟩.",
                lesson: "**Phase kickback** is the engine behind every quantum oracle. When a controlled gate has its target in the |−⟩ = (|0⟩−|1⟩)/√2 state, applying it leaves the target unchanged and instead kicks the eigenvalue −1 back as a phase onto the control qubit.\n\n**Step by step:**\n* H on q0: q0 = |+⟩ = (|0⟩+|1⟩)/√2\n* X then H on q2: q2 = |−⟩ = (|0⟩−|1⟩)/√2\n* CX (q0→q2): |0⟩|−⟩ → |0⟩|−⟩ (control is 0, nothing happens), and |1⟩|−⟩ → |1⟩X|−⟩ = |1⟩(−|−⟩) = −|1⟩|−⟩ (−1 phase kicked to control)\n  * Combined: (|0⟩+|1⟩)/√2 ⊗ |−⟩ → (|0⟩−|1⟩)/√2 ⊗ |−⟩ = |−⟩ ⊗ |−⟩\n* H on q0: H|−⟩ = |1⟩\n\nResult: q0 flipped to |1⟩, q2 undisturbed in |−⟩. A phase difference became a measurable bit — this is how Grover's oracle marks states without leaving any trace in the ancilla.",
                cols: 5,
                circuits: [
                    [['H0', 'X2'], ['H2'], ['CX02'], ['H0']],
                    [['X2'], ['H0', 'H2'], ['CX02'], ['H0']],
                    [['H0'], ['X2'], ['H2'], ['CX02'], ['H0']],
                    [['X2'], ['H0'], ['H2'], ['CX02'], ['H0']],
                    [['X2'], ['H2'], ['H0'], ['CX02'], ['H0']]
                ]
            },
            {
                name: "11.2: CCZ Oracle",
                quizDesc: "Start from uniform superposition and mark |111⟩ with a −1 phase without disturbing any other state.",
                set: ['H0', 'H1', 'H2', 'CCX012'],
                hint: "Apply H to all three qubits. Then build CCZ on q2: H on q2, CCX, H on q2. The identity HXH = Z turns the Toffoli's bit-flip into a phase-flip, marking |111⟩ with −1.",
                lesson: "The Grover **oracle** marks the target state |111⟩ with a phase of −1 while leaving every other state unchanged. It is built from a **CCZ gate** — a doubly-controlled Z — assembled from gates you already know.\n\n**Key identity:** H · X · H = Z. Sandwiching the target qubit of CCX between two H gates converts the bit-flip (X) into a phase-flip (Z), now doubly-controlled:\n\nCCZ = H₂ · CCX₀₁₂ · H₂\n\n**Circuit:**\n1. H on all: uniform superposition, all 8 states with equal amplitude\n2. CCZ = H₂ · CCX · H₂: marks |111⟩ with −1\n\n**After the oracle:**\n(|000⟩+|001⟩+|010⟩+|011⟩+|100⟩+|101⟩+|110⟩−|111⟩) / 2√2\n\nAll probabilities are still equal — the phase tag is invisible to measurement. The diffusion step in the next stage converts this tiny phase difference into a large amplitude difference.",
                cols: 5,
                circuits: [
                    [['H0', 'H1', 'H2'], ['H2'], ['CCX012'], ['H2']],
                    [['H0', 'H1'], ['H2'], ['H2'], ['CCX012'], ['H2']],
                    [['H2'], ['H0', 'H1', 'H2'], ['CCX012'], ['H2']],
                    [['H2'], ['H0', 'H1'], ['H2'], ['CCX012'], ['H2']]
                ]
            },
            {
                name: "11.3: Grover's Algorithm",
                quizDesc: "Run one full Grover iteration (oracle + diffusion) to boost the probability of measuring |111⟩ from 12.5% to ~78%.",
                set: ['H0', 'H1', 'H2', 'X0', 'X1', 'X2', 'CCX012'],
                hint: "Init: H on all. Oracle: H₂ · CCX · H₂. Diffusion: H×3, X×3, H₂·CCX·H₂, X×3, H×3. The oracle marks |111⟩; the diffusion amplifies it. After one full iteration P(|111⟩) ≈ 78%.",
                lesson: "**Grover's Algorithm** finds a marked item among N unsorted items in only √N oracle queries — a quadratic speedup over any classical search.\n\nOur 3-qubit circuit searches all 8 basis states for the marked state |111⟩.\n\n**Two building blocks:**\n\n1. **Oracle (CCZ):** flips the phase of |111⟩ from +1 to −1. Amplitudes and probabilities are unchanged — only the phase tag is set.\n\n2. **Diffusion operator** (2|ψ₀⟩⟨ψ₀| − I): reflects all amplitudes about their mean. Because the oracle pushed |111⟩ below the mean (negative amplitude), the diffusion boosts it far above the mean and suppresses everything else.\n\n**Full circuit:**\n* **Init:** H₀ H₁ H₂ — uniform superposition\n* **Oracle:** H₂ · CCX₀₁₂ · H₂ — phase-mark |111⟩\n* **Diffusion:**\n  * H on all\n  * X on all\n  * CCZ = H₂ · CCX₀₁₂ · H₂\n  * X on all\n  * H on all\n\nAfter one iteration P(|111⟩) = 25/32 ≈ 78%. The optimal number of iterations for n=3 qubits is ⌊(π/4)√8⌋ = 2, which pushes P(|111⟩) to ~97%.",
                circuits: [
                    // Canonical uncompressed form
                    [['H0','H1','H2'], ['H2'], ['CCX012'], ['H2'], ['H0','H1','H2'], ['X0','X1','X2'], ['H2'], ['CCX012'], ['H2'], ['X0','X1','X2'], ['H0','H1','H2']],
                    // Compressed: independent gates merged into shared columns
                    [['H0','H1','H2'], ['H2'], ['CCX012'], ['H0','H1','H2'], ['H2','X0','X1'], ['X2'], ['H2'], ['CCX012'], ['H2','X0','X1'], ['X2','H0','H1'], ['H2']]
                ]
            }
        ]
    },

    // ── Stage 12: Parametrized Circuits ──────────────────────────────────────
    {
        title: "Parametrized Circuits",
        section: "Variational Algorithms",
        qubits: 1,
        cols: 1,
        set: [],
        levels: [
            {
                name: "12.1: Your First Parameter",
                quizDesc: "Tune θ in RY(θ) to rotate the qubit to |+⟩.",
                variational: {
                    numQubits: 1,
                    params: [{ id: 'theta', label: 'θ', min: 0, max: 6.283, init: 0 }],
                    template: [[ {gate:'RY', qubit:0, param:'theta'} ]],
                    winMode: 'fidelity',
                    targetVec: [{r:0.7071067811865476,i:0},{r:0.7071067811865476,i:0}],
                    fidelityThreshold: 0.99,
                    showLandscape: false,
                    showOptimizer: false,
                    costLabel: 'Fidelity',
                    task: "The RY gate rotates the qubit by angle θ around the Y-axis of the Bloch sphere. Starting at |0⟩ (north pole), find θ that brings the qubit to |+⟩ — the equator — where it is 50% |0⟩ and 50% |1⟩.",
                },
                lesson: "**Parametrized circuits** are circuits where some gates take a continuous angle as input, instead of a fixed value.\n\nThe **RY gate** is a rotation about the Y-axis:\n\nRY(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩\n\nAt θ=0: stays at |0⟩ (north pole).\nAt θ=π/2: reaches |+⟩ = (|0⟩+|1⟩)/√2 (equator).\nAt θ=π: reaches |1⟩ (south pole).\n\nThis is the core idea of variational algorithms: **the circuit output is a function of the parameters.** By tuning the parameters, we can reach any desired state — or find the one that minimizes an objective function.\n\n**Goal:** find θ = π/2 ≈ 1.57.",
                hint: "RY(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩. For equal amplitudes, cos(θ/2) = sin(θ/2) → θ/2 = π/4 → θ = π/2 ≈ 1.57.",
            },
            {
                name: "12.2: Any Single-Qubit State",
                quizDesc: "Use RZ(φ)·RY(θ) to reach the target state shown on the Bloch sphere.",
                variational: {
                    numQubits: 1,
                    params: [
                        { id: 'theta', label: 'θ (RY)', min: 0, max: 6.283, init: 0 },
                        { id: 'phi',   label: 'φ (RZ)', min: 0, max: 6.283, init: 0 }
                    ],
                    template: [
                        [ {gate:'RY', qubit:0, param:'theta'} ],
                        [ {gate:'RZ', qubit:0, param:'phi'}   ]
                    ],
                    winMode: 'fidelity',
                    targetVec: [{r:0.7071067811865476,i:0},{r:0,i:0.7071067811865476}],
                    fidelityThreshold: 0.99,
                    showLandscape: false,
                    showOptimizer: false,
                    costLabel: 'Fidelity',
                    task: "The circuit applies RY(θ) then RZ(φ) to q₀. The target state is |+i⟩ = (|0⟩ + i|1⟩)/√2 — half-way between |0⟩ and |1⟩ on the XY-plane. Two parameters give you access to both the 'tilt' and 'spin' of the Bloch sphere.",
                },
                lesson: "**Any single-qubit state** can be written as:\n\n|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩\n\nwhere θ is the polar angle (latitude) and φ is the azimuthal angle (longitude) on the Bloch sphere.\n\nThe two-gate sequence **RZ(φ) · RY(θ)** generates exactly this form:\n* RY(θ) controls the latitude — how much |1⟩ amplitude there is.\n* RZ(φ) controls the longitude — the relative phase between |0⟩ and |1⟩.\n\nThis means **any qubit state is reachable** with just two continuous parameters. This is the motivation behind single-qubit ansätze in variational algorithms.\n\n**Goal:** θ = π/2 sets the equator; φ = π/2 adds the i phase → |+i⟩.",
                hint: "Set θ = π/2 ≈ 1.57 first (this puts you on the equator). Then set φ = π/2 ≈ 1.57 to add the i phase.",
            },
            {
                name: "12.3: Entangling Layer",
                quizDesc: "Use RY(θ₀)⊗RY(θ₁) followed by CX to prepare the Bell state |Φ+⟩.",
                variational: {
                    numQubits: 2,
                    params: [
                        { id: 'theta0', label: 'θ₀ (q₀)', min: 0, max: 6.283, init: 0 },
                        { id: 'theta1', label: 'θ₁ (q₁)', min: 0, max: 6.283, init: 0 }
                    ],
                    template: [
                        [ {gate:'RY',qubit:0,param:'theta0'}, {gate:'RY',qubit:1,param:'theta1'} ],
                        [ 'CX01' ]
                    ],
                    winMode: 'fidelity',
                    targetVec: [
                        {r:0.7071067811865476,i:0}, {r:0,i:0},
                        {r:0,i:0}, {r:0.7071067811865476,i:0}
                    ],
                    fidelityThreshold: 0.99,
                    showLandscape: false,
                    showOptimizer: false,
                    costLabel: 'Fidelity',
                    task: "First rotate each qubit with RY, then apply a CX gate. The CX entangles the qubits: if q₀ is in superposition and q₁ is |0⟩, the CX creates a Bell state. Find θ₀ and θ₁ to prepare |Φ+⟩ = (|00⟩+|11⟩)/√2.",
                },
                lesson: "**Entangling layers** are the key ingredient that makes multi-qubit ansätze powerful. A single layer of parametrized single-qubit rotations followed by entangling gates (CX, CZ) can prepare states that no single-qubit rotation could — including entangled states like Bell pairs.\n\n**The ansatz: [RY(θ₀)⊗RY(θ₁)] → CX₀₁**\n\nStarting from |00⟩:\n1. RY(θ₀) on q₀: cos(θ₀/2)|0⟩ + sin(θ₀/2)|1⟩\n2. RY(θ₁) on q₁: keeps q₁ at |0⟩ if θ₁=0\n3. CX₀₁: if q₀ has amplitude at |1⟩, the CX flips q₁ → entanglement!\n\n**For the Bell state |Φ+⟩:**\n* Set θ₀ = π/2 → q₀ = |+⟩\n* Set θ₁ = 0 → q₁ = |0⟩\n* CX: (|0⟩+|1⟩)/√2 ⊗ |0⟩ → (|00⟩+|11⟩)/√2 ✓\n\nThis circuit template is called a **hardware-efficient ansatz** — it uses only native two-qubit gates and is designed to run efficiently on real quantum hardware.",
                hint: "Set θ₀ = π/2 ≈ 1.57 and θ₁ = 0. The CX will then entangle the qubits into the Bell state.",
            },
            {
                name: "12.4: Deeper Ansatz",
                quizDesc: "Use a two-layer ansatz [RY⊗RY → CX → RY⊗RY] to prepare (|01⟩+|10⟩)/√2.",
                variational: {
                    numQubits: 2,
                    params: [
                        { id: 'th0', label: 'θ₀', min: 0, max: 6.283, init: 0 },
                        { id: 'th1', label: 'θ₁', min: 0, max: 6.283, init: 0 },
                        { id: 'th2', label: 'θ₂', min: 0, max: 6.283, init: 0 },
                        { id: 'th3', label: 'θ₃', min: 0, max: 6.283, init: 0 }
                    ],
                    template: [
                        [ {gate:'RY',qubit:0,param:'th0'}, {gate:'RY',qubit:1,param:'th1'} ],
                        [ 'CX01' ],
                        [ {gate:'RY',qubit:0,param:'th2'}, {gate:'RY',qubit:1,param:'th3'} ]
                    ],
                    winMode: 'fidelity',
                    targetVec: [
                        {r:0,i:0}, {r:0.7071067811865476,i:0},
                        {r:0.7071067811865476,i:0}, {r:0,i:0}
                    ],
                    fidelityThreshold: 0.99,
                    showLandscape: false,
                    showOptimizer: false,
                    costLabel: 'Fidelity',
                    task: "Add a second rotation layer after the CX gate. The deeper ansatz [RY⊗RY → CX → RY⊗RY] can reach states that a single layer cannot. Target: |Ψ+⟩ = (|01⟩+|10⟩)/√2.",
                },
                lesson: "**Ansatz depth** determines how expressive the circuit is — which states it can prepare. A single rotation layer can only reach a small region of state space. Adding more layers after the entangling gate unlocks more of the Hilbert space.\n\n**Two-layer ansatz:** [RY⊗RY] → CX → [RY⊗RY]\n\nTo reach |Ψ+⟩ = (|01⟩+|10⟩)/√2 from |Φ+⟩:\n* Start from |Φ+⟩ = (|00⟩+|11⟩)/√2 using the first layer (θ₀=π/2, θ₁=0)\n* Apply X on q₁ (implemented as RY(π) on q₁): |Φ+⟩ → (|01⟩+|10⟩)/√2\n* So: θ₀=π/2, θ₁=0, then θ₂=0, θ₃=π rotates q₁ → |Ψ+⟩\n\n**Key insight:** More parameters = more expressive. But more parameters also means a harder optimization problem — this trade-off is central to all variational algorithms.",
                hint: "Set θ₀=π/2, θ₁=0 to create |Φ+⟩ with the first layer. Then θ₂=0, θ₃=π (or 3.14) to flip q₁ → |Ψ+⟩.",
            },
        ]
    },

    // ── Stage 13: VQE ────────────────────────────────────────────────────────
    {
        title: "VQE",
        section: "Variational Algorithms",
        qubits: 1,
        cols: 1,
        set: [],
        levels: [
            {
                name: "13.1: Energy of a State",
                quizDesc: "Tune θ in RY(θ) to minimize the energy ⟨Z⟩ and reach the ground state.",
                variational: {
                    numQubits: 1,
                    params: [{ id: 'theta', label: 'θ', min: 0, max: 6.283, init: 0 }],
                    template: [[ {gate:'RY', qubit:0, param:'theta'} ]],
                    winMode: 'cost',
                    hamiltonian: [{ pauli:'Z', qubits:[0], coeff:1 }],
                    constTerm: 0,
                    costThreshold: -0.95,
                    higherIsBetter: false,
                    showLandscape: false,
                    showOptimizer: false,
                    costLabel: '⟨Z⟩',
                    task: "The Hamiltonian H = Z has eigenstates |0⟩ (energy +1) and |1⟩ (energy −1). Tune θ to lower the energy ⟨Z⟩ as far as possible. The lowest energy state is called the **ground state**.",
                },
                lesson: "**The Hamiltonian** is a matrix that represents the energy of a quantum system. Its lowest eigenvalue is the ground state energy, and the corresponding state is the ground state.\n\nFor H = Z:\n* |0⟩ has energy ⟨0|Z|0⟩ = +1 (high energy, 'excited')\n* |1⟩ has energy ⟨1|Z|1⟩ = −1 (low energy, 'ground state')\n\nFor a general state RY(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩:\n⟨Z⟩ = cos²(θ/2) − sin²(θ/2) = cos(θ)\n\nSo the energy decreases as θ increases from 0 to π, reaching the minimum of −1 at θ = π.\n\n**This is VQE in miniature:** tune the circuit parameters to minimize the Hamiltonian's expectation value. The minimum-energy state is the answer.",
                hint: "⟨Z⟩ = cos(θ). This is minimized at θ = π ≈ 3.14, where ⟨Z⟩ = −1 (the |1⟩ state).",
            },
            {
                name: "13.2: The Energy Landscape",
                quizDesc: "Use the landscape and optimizer to find the ground state of H = Z.",
                variational: {
                    numQubits: 1,
                    params: [{ id: 'theta', label: 'θ', min: 0, max: 6.283, init: 0.5 }],
                    template: [[ {gate:'RY', qubit:0, param:'theta'} ]],
                    winMode: 'cost',
                    hamiltonian: [{ pauli:'Z', qubits:[0], coeff:1 }],
                    constTerm: 0,
                    costThreshold: -0.95,
                    higherIsBetter: false,
                    showLandscape: true,
                    landscapeParam: 'theta',
                    showOptimizer: true,
                    costLabel: '⟨Z⟩',
                    task: "The **energy landscape** shows how the cost ⟨Z⟩ varies with θ. The valley is where the ground state lives. You can tune θ by hand, or click **Run Optimizer** to watch gradient descent automatically navigate toward the minimum.",
                },
                lesson: "**The energy landscape** is the key visual concept in variational algorithms. For a 1D parameter, it is just a curve — easy to picture. For many parameters, it becomes a high-dimensional surface that gradient descent must navigate.\n\n**Gradient descent** takes a small step in the direction that decreases the energy most steeply:\nθ ← θ − η · ∂⟨H⟩/∂θ\n\nFor our landscape ⟨Z⟩ = cos(θ), the gradient is −sin(θ), so gradient descent moves toward the minimum at θ=π.\n\n**The classical-quantum loop:**\n1. **Quantum computer** evaluates ⟨H⟩ for current parameters\n2. **Classical computer** computes gradients and updates parameters\n3. Repeat until converged\n\nThis loop — classical optimizer + quantum evaluator — is the heart of every variational quantum algorithm.",
                hint: "Click 'Run Optimizer' to watch the gradient descent animation. Or manually drag θ toward π ≈ 3.14.",
            },
            {
                name: "13.3: Two-Qubit Hamiltonian",
                quizDesc: "Minimize ⟨H⟩ = −⟨ZZ⟩ − 0.5·⟨XX⟩ using the Bell-state ansatz.",
                variational: {
                    numQubits: 2,
                    params: [
                        { id: 'theta0', label: 'θ₀ (q₀)', min: 0, max: 6.283, init: 0.3 },
                        { id: 'theta1', label: 'θ₁ (q₁)', min: 0, max: 6.283, init: 0.3 }
                    ],
                    template: [
                        [ {gate:'RY',qubit:0,param:'theta0'}, {gate:'RY',qubit:1,param:'theta1'} ],
                        [ 'CX01' ]
                    ],
                    winMode: 'cost',
                    hamiltonian: [
                        { pauli:'ZZ', qubits:[0,1], coeff:-1   },
                        { pauli:'XX', qubits:[0,1], coeff:-0.5 }
                    ],
                    constTerm: 0,
                    costThreshold: -1.4,
                    higherIsBetter: false,
                    showLandscape: false,
                    showOptimizer: true,
                    costLabel: '⟨H⟩',
                    task: "Find the ground state of H = −ZZ − 0.5·XX. The Bell-state ansatz [RY⊗RY → CX] can prepare the ground state. Use the optimizer or tune θ₀ and θ₁ manually. The minimum energy is −1.5.",
                },
                lesson: "**Multi-qubit Hamiltonians** describe interacting quantum systems. Real molecules and materials have Hamiltonians with many Pauli terms like ZZ, XX, XY, etc.\n\nFor H = −ZZ − 0.5·XX:\n* −ZZ prefers states where both qubits are the same (|00⟩ or |11⟩): ⟨00|ZZ|00⟩ = +1, so −ZZ gives −1 energy → favors equal-spin configurations\n* −0.5·XX adds quantum fluctuations — it mixes states via bit-flip\n\nThe ground state is |Φ+⟩ = (|00⟩+|11⟩)/√2:\n⟨ZZ⟩ = 1, ⟨XX⟩ = 1 → ⟨H⟩ = −1 − 0.5 = **−1.5** ✓\n\n**VQE strategy:** choose an ansatz that can prepare the ground state — then optimize. The Bell-state ansatz works here because the ground state is a Bell pair.",
                hint: "Set θ₀ = π/2 ≈ 1.57 and θ₁ = 0. The CX creates |Φ+⟩ with energy ⟨H⟩ = −1.5.",
            },
            {
                name: "13.4: VQE in Full",
                quizDesc: "Use the 4-parameter ansatz and optimizer to find the ground state of a more complex Hamiltonian.",
                variational: {
                    numQubits: 2,
                    params: [
                        { id: 'th0', label: 'θ₀', min: 0, max: 6.283, init: 0.5 },
                        { id: 'th1', label: 'θ₁', min: 0, max: 6.283, init: 0.5 },
                        { id: 'th2', label: 'θ₂', min: 0, max: 6.283, init: 0.5 },
                        { id: 'th3', label: 'θ₃', min: 0, max: 6.283, init: 0.5 }
                    ],
                    template: [
                        [ {gate:'RY',qubit:0,param:'th0'}, {gate:'RY',qubit:1,param:'th1'} ],
                        [ 'CX01' ],
                        [ {gate:'RY',qubit:0,param:'th2'}, {gate:'RY',qubit:1,param:'th3'} ]
                    ],
                    winMode: 'cost',
                    hamiltonian: [
                        { pauli:'ZZ', qubits:[0,1], coeff:-1   },
                        { pauli:'XX', qubits:[0,1], coeff:-0.5 },
                        { pauli:'Z',  qubits:[0],   coeff:0.3  },
                        { pauli:'Z',  qubits:[1],   coeff:-0.3 }
                    ],
                    constTerm: 0,
                    costThreshold: -1.3,
                    higherIsBetter: false,
                    showLandscape: false,
                    showOptimizer: true,
                    optimizerInterval: 350,
                    costLabel: '⟨H⟩',
                    task: "This Hamiltonian has a broken symmetry: H = −ZZ − 0.5·XX + 0.3·Z₀ − 0.3·Z₁. The single-layer ansatz can't always find the ground state — but the deeper two-layer ansatz can. Click **Run Optimizer** and watch VQE converge.",
                },
                lesson: "**Full VQE** is the complete algorithm:\n\n1. **Choose an ansatz** — a parametrized circuit that can (hopefully) express the ground state\n2. **Initialize parameters** — often randomly or at zero\n3. **Evaluate ⟨H⟩** — run the quantum circuit and measure the cost\n4. **Update parameters** — classical optimizer computes gradient and takes a step\n5. **Repeat** until ⟨H⟩ converges\n\n**Why VQE matters for near-term hardware:**\n* Circuit depth is shallow — short circuits mean less noise\n* The quantum computer only evaluates ⟨H⟩; the classical computer does the optimization\n* It can handle molecular Hamiltonians with 50–100 qubits where classical simulation is infeasible\n\n**The challenge:** the optimization landscape can have many local minima ('barren plateaus'). Choosing good initial parameters and ansatz design are active research areas.\n\nVQE was first proposed in 2014 and experimentally demonstrated for H₂ using a photonic quantum computer. Today it is one of the most studied near-term quantum algorithms.",
                hint: "Click 'Run Optimizer' to let gradient descent find the minimum. The deeper ansatz has extra parameters to handle the asymmetric Z terms.",
            },
        ]
    },

    // ── Stage 14: QAOA ───────────────────────────────────────────────────────
    {
        title: "QAOA",
        section: "Variational Algorithms",
        qubits: 2,
        cols: 4,
        set: ['H0', 'H1'],
        levels: [
            {
                name: "14.1: All Solutions at Once",
                quizDesc: "Apply H to all qubits to create equal superposition — the starting point of every QAOA circuit.",
                set: ['H0', 'H1'],
                hint: "Apply H to both qubits. The result is (|00⟩+|01⟩+|10⟩+|11⟩)/2 — all 4 bit-strings with equal probability.",
                lesson: "**QAOA (Quantum Approximate Optimization Algorithm)** is a variational algorithm designed to solve combinatorial optimization problems — problems where we want to find the best assignment from a set of discrete choices.\n\n**Example: Max-Cut.** Given a graph, split the nodes into two groups (0 and 1) to maximize the number of edges between groups. For our 2-node graph with one edge, the max cut is 1 (put one node in each group: 01 or 10).\n\n**QAOA starts with H⊗n — equal superposition of all bit-strings.** This encodes the intuition: 'consider all solutions simultaneously.' For n=2 qubits, all 4 bit-strings |00⟩, |01⟩, |10⟩, |11⟩ each have probability 1/4.\n\nThen QAOA applies two alternating layers:\n1. **Phase separator U_C(γ):** boosts the phase of high-value solutions\n2. **Mixer U_B(β):** mixes amplitudes to escape local minima\n\nBy optimizing γ and β, we concentrate probability on the best solutions.",
                circuits: [
                    [['H0','H1']],
                    [['H0'],['H1']],
                    [['H1'],['H0']]
                ]
            },
            {
                name: "14.2: Phase Separator",
                quizDesc: "Tune γ in the phase separator to concentrate probability on Max-Cut solutions for a 2-node graph.",
                variational: {
                    numQubits: 2,
                    params: [{ id: 'gamma', label: 'γ', min: 0, max: 3.14159, init: 0 }],
                    template: [
                        ['H0', 'H1'],
                        ['CX01'],
                        [ {gate:'RZ', qubit:1, param:'gamma'} ],
                        ['CX01']
                    ],
                    winMode: 'fidelity',
                    targetVec: [
                        {r:  0.35355339, i: -0.35355339},
                        {r:  0.35355339, i:  0.35355339},
                        {r:  0.35355339, i:  0.35355339},
                        {r:  0.35355339, i: -0.35355339}
                    ],
                    fidelityThreshold: 0.95,
                    showLandscape: true,
                    landscapeParam: 'gamma',
                    showOptimizer: true,
                    costLabel: 'Fidelity',
                    task: "The phase separator CX·RZ(γ)·CX encodes the Max-Cut cost into the phases of the quantum state — cut states |01⟩ and |10⟩ gain a phase e^{iγ} relative to non-cut states. Tune γ to π/2 ≈ 1.57 to reach the optimal phase-encoded state, primed for the mixer in the next level.",
                },
                lesson: "**Why U_C(γ) = e^{iγ(I − Z₁Z₂)/2}?**\n\nThe Pauli Z operator has eigenvalue +1 on |0⟩ and −1 on |1⟩. So the product Z₁Z₂ measures whether the two qubits *agree*:\n\n| state | Z₁Z₂ | I − Z₁Z₂ | cut? |\n|-------|-------|-----------|------|\n| \\|00⟩  |  +1   |     0     |  no  |\n| \\|01⟩  |  −1   |     2     |  yes |\n| \\|10⟩  |  −1   |     2     |  yes |\n| \\|11⟩  |  +1   |     0     |  no  |\n\n**(I − Z₁Z₂)/2** is the edge-cut indicator: 0 when not cut, 1 when cut. The exponential e^{iγ(I−Z₁Z₂)/2} then applies:\n* **Not cut** → e^{i·γ·0} = 1 (no phase change)\n* **Cut** → e^{i·γ·1} = e^{iγ} (relative phase boost)\n\nThis is the cost oracle: it tags cut states with a phase without touching any amplitudes. That's why the measurement probabilities stay flat at 25% each — phases are invisible until the mixer converts them into amplitude differences.\n\n**Why does CX · RZ(γ) · CX implement this?**\n\nThe CX gate has a key property: it conjugates Z on the target qubit into Z⊗Z:\n\n**CX · Z₂ · CX = Z₁Z₂**\n\nTo see why: CX maps |x,y⟩ → |x, x⊕y⟩. Acting with Z₂ in the middle gives phase (−1)^{x⊕y} = (−1)^{x+y}, which is exactly Z₁Z₂.\n\nSince CX conjugates Z₂ into Z₁Z₂, it does the same for any function of Z₂. In particular, RZ(γ) = e^{−iγZ/2}, so:\n\n**CX · RZ(γ)₂ · CX = e^{−iγ Z₁Z₂/2}**\n\nAnd e^{−iγZ₁Z₂/2} equals e^{iγ(I−Z₁Z₂)/2} up to an unobservable global phase.\n\n**The intuition:** the first CX \"tells\" qubit 2 about qubit 1's state before the rotation. The RZ now effectively sees the *joint parity* of both qubits. The second CX undoes the entanglement, leaving only the phase. The CNOT sandwich is the universal trick for turning a single-qubit Z rotation into a two-qubit ZZ interaction.",
                hint: "The optimal γ is π/2 ≈ 1.57. At this angle the cut states |01⟩ and |10⟩ have gained phase e^{iπ/2} = i relative to non-cut states — the perfect starting point for the mixer.",
            },
            {
                name: "14.3: The Mixer",
                quizDesc: "Add the mixer RX(β) to the phase separator and tune both γ and β to solve 2-node Max-Cut.",
                variational: {
                    numQubits: 2,
                    params: [
                        { id: 'gamma', label: 'γ (phase)', min: 0, max: 3.14159, init: 0 },
                        { id: 'beta',  label: 'β (mixer)', min: 0, max: 1.5708,  init: 0 }
                    ],
                    template: [
                        ['H0', 'H1'],
                        ['CX01'],
                        [ {gate:'RZ', qubit:1, param:'gamma'} ],
                        ['CX01'],
                        [ {gate:'RY', qubit:0, param:'beta'}, {gate:'RY', qubit:1, param:'beta'} ]
                    ],
                    winMode: 'prob',
                    targetBits: [1, 2],
                    probThreshold: 0.9,
                    showLandscape: false,
                    showOptimizer: true,
                    costLabel: 'P(cut)',
                    task: "The full QAOA p=1 circuit: H⊗H → Phase_Sep(γ) → Mixer(β). The mixer H·RZ(β)·H = RX(β) converts phases into measurable amplitude differences. Tune γ and β (or run the optimizer) to push P(|01⟩)+P(|10⟩) above 90%.",
                },
                lesson: "**The mixer** drives transitions between bit-strings, converting phase differences into amplitude differences.\n\nThe standard QAOA mixer is:\nU_B(β) = exp(−iβ Σ_i X_i) = ⊗_i RX(2β)\n\nFor our approximation, we apply RY(β) independently on each qubit (same interference effect for this simple graph).\n\n**The two-step magic:**\n1. Phase separator sets different phases on cut vs. non-cut states\n2. Mixer interferes the phases: cut states constructively interfere, non-cut states destructively interfere\n\n**Optimal parameters for 2-node Max-Cut:**\n* γ ≈ π/4 (not π/2 — that was without the mixer)\n* β ≈ π/8\n\nFor this graph, P(max cut) can reach ~100% with the right γ,β pair.\n\n**Why not just try all possibilities?** For n qubits there are 2^n bit-strings. Classical brute force takes O(2^n) — for n=50 that's 10^15 trials. QAOA runs one circuit per evaluation, and the number of evaluations grows much more slowly with problem size.",
                hint: "Try γ ≈ 0.79 (π/4) and β ≈ 0.39 (π/8). Or click 'Run Optimizer' to let gradient ascent find the maximum.",
            },
            {
                name: "14.4: QAOA on a Triangle",
                quizDesc: "Solve Max-Cut on a 3-node triangle graph by tuning γ and β in the full QAOA p=1 circuit.",
                variational: {
                    numQubits: 3,
                    params: [
                        { id: 'gamma', label: 'γ (phase)', min: 0, max: 3.14159, init: 0.3 },
                        { id: 'beta',  label: 'β (mixer)', min: 0, max: 1.5708,  init: 0.3 }
                    ],
                    template: [
                        ['H0','H1','H2'],
                        ['CX01'],
                        [ {gate:'RZ',qubit:1,param:'gamma'} ],
                        ['CX01'],
                        ['CX12'],
                        [ {gate:'RZ',qubit:2,param:'gamma'} ],
                        ['CX12'],
                        ['CX02'],
                        [ {gate:'RZ',qubit:2,param:'gamma'} ],
                        ['CX02'],
                        [ {gate:'RY',qubit:0,param:'beta'}, {gate:'RY',qubit:1,param:'beta'}, {gate:'RY',qubit:2,param:'beta'} ]
                    ],
                    winMode: 'prob',
                    targetBits: [1, 2, 3, 4, 5, 6],
                    probThreshold: 0.75,
                    showLandscape: false,
                    showOptimizer: true,
                    costLabel: 'P(cut≥2)',
                    task: "A triangle graph has 3 nodes and 3 edges (0-1, 1-2, 0-2). The max cut = 2 (any partition with one node alone cuts 2 edges). The valid configurations are all 6 states except |000⟩ and |111⟩. Tune γ and β to get P(valid cut) > 75%.",
                },
                lesson: "**QAOA on the triangle** shows why quantum optimization is interesting: the problem is hard to solve optimally, but QAOA finds a near-optimal solution efficiently.\n\nFor a triangle graph, every assignment except |000⟩ and |111⟩ cuts exactly 2 edges. Classical random guessing gives P(max cut) = 6/8 = 75%. QAOA p=1 can do slightly better.\n\n**The full p=1 QAOA circuit:**\n* **Init:** H on all 3 qubits\n* **Phase separator:** Apply CX·RZ(γ)·CX for each edge (01, 12, 02)\n* **Mixer:** RY(β) on all 3 qubits\n\nAll three edges use the same γ parameter — this is the p=1 approximation. Higher p (more layers) allows different angles per layer and achieves better approximations.\n\n**VQE vs. QAOA:**\n* VQE finds a quantum ground state (energy minimization)\n* QAOA finds the optimal bit-string (combinatorial optimization)\n* Both use the same hybrid loop: quantum circuit + classical optimizer\n\n**The QAOA guarantee:** for p → ∞, QAOA finds the exact optimal solution. For finite p, it provides an approximation ratio that improves with depth.",
                hint: "Click 'Run Optimizer' for the best results. Manually, try γ ≈ 0.39 and β ≈ 0.19 (the theoretical optimum for p=1 triangle Max-Cut).",
            },
        ]
    },
];