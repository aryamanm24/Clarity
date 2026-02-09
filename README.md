# 🧠 CLARITY — Reasoning Analysis, Formally Verified

**Map your arguments. Find the gaps. Get a proof.**

CLARITY turns natural language reasoning into a formal argument map, detects logical contradictions with **mathematical proofs** (SAT solver), and surfaces hidden assumptions, fallacies, and tensions — so you can think clearly and argue soundly.

![CLARITY](https://img.shields.io/badge/CLARITY-Reasoning%20Analysis-6366f1?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-Python%20Backend-009688?style=flat-square&logo=fastapi)
![Gemini](https://img.shields.io/badge/Gemini-AI%20%2B%20Live-4285F4?style=flat-square&logo=google)

---

## ✨ What It Does

- **Parses your argument** — Type or speak. CLARITY extracts propositions (premises, conclusions, assumptions, evidence) and relationships (supports, contradicts, assumes) using Gemini.
- **Proves contradictions** — Not just “this looks wrong.” Propositions are translated to logic, then checked by a **SAT solver** (Glucose3). If the formula is unsatisfiable, you get a **minimal unsatisfiable core** and a step-by-step formal proof.
- **Detects fallacies** — Circular reasoning, hasty generalization, false dilemma via **graph algorithms** (NetworkX): cycle detection, centrality, structural patterns.
- **Surfaces tensions & ambiguities** — Practical tensions (goals that pull apart) and ambiguous terms (equivocation) so you can clarify before concluding.
- **Voice mode** — Speak your argument; get a brief acknowledgment from Gemini Live, then full analysis. Click **Ask CLARITY** to hear a spoken summary of the results.

---

## 🏗️ Architecture at a Glance

```
You (text or voice) → Parser (Gemini) → Propositions + relationships
       → Parallel engines: Validity | Contradictions (SAT) | Fallacies (graph) | Ambiguity | Tension | Temporal
       → Argument reconstruction + insights
       → Interactive graph + sidebar (proofs, fallacies, insights)
```

- **Frontend:** Next.js 16, React Flow (Dagre + radial layout), Tailwind, Framer Motion  
- **Backend:** FastAPI, Python 3.12  
- **AI:** Gemini 2.0 Flash (parsing, validity, explanation); Gemini Live (voice ack + read-aloud)  
- **Logic:** python-sat (Glucose3), NetworkX, optional Sympy  

See **[TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)** for full architecture, endpoints, and pipeline.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **Python** 3.12+
- **Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/clarity.git
cd clarity
pnpm install
```

### 2. Backend (Python)

```bash
cd clarity-engine-py
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` in `clarity-engine-py/`:

```
GEMINI_API_KEY=your_gemini_api_key
```

Run the API:

```bash
python main.py
```

Server runs at **http://localhost:8000**.

### 3. Frontend (Next.js)

From the repo root (`clarity/`):

Create `.env.local`:

```
GEMINI_API_KEY=your_gemini_api_key
PYTHON_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/voice
```

Start the app:

```bash
pnpm dev
```

Open **http://localhost:3000**.

### 4. Use it

- **Text:** Type an argument or paste a dilemma → press Enter.  
- **Voice:** Switch to voice mode → speak → stop → analysis runs; click **Ask CLARITY** to hear the summary.

---

## 📁 Project Structure

```
clarity/
├── src/                    # Next.js app
│   ├── app/               # Pages: home, analyze, benchmarks, how-it-works
│   ├── components/        # Graph, InputBar, proof viewers, panels
│   ├── hooks/             # useAnalysisStream, useGeminiLive, useSpeechRecognition
│   └── lib/               # types, graph layout, design tokens
├── public/
│   └── pcm-playback-processor.js   # AudioWorklet for voice playback
├── clarity-engine-py/     # Python backend
│   ├── main.py            # FastAPI + /analyze/stream, /ws/voice, /ws/explain
│   ├── gemini_live.py     # Gemini Live wrapper
│   └── engine/            # Parser, SAT verifier, fallacy detector, etc.
├── TECHNICAL_DOCUMENTATION.md
└── README.md
```

---

## 🔬 Why “Formally Verified”?

Most tools only *suggest* that something might be wrong. CLARITY:

1. **Translates** your claims into symbolic logic (e.g. `P → Q`, `¬P ∨ Q`).  
2. **Encodes** relationships (supports, contradicts) as logical constraints.  
3. **Runs a SAT solver** — if there’s no satisfying assignment, the set is inconsistent.  
4. **Returns a minimal core** and a **formal proof** you can inspect.

So when CLARITY says “contradiction,” it’s not a heuristic — it’s a proof.

---

## 📜 License

MIT (or your chosen license).

---

## 🙏 Built With

- [Next.js](https://nextjs.org) · [React Flow](https://reactflow.dev) · [Tailwind CSS](https://tailwindcss.com) · [Framer Motion](https://www.framer.com/motion/)
- [FastAPI](https://fastapi.tiangolo.com) · [Google Gemini](https://ai.google.dev) · [python-sat](https://pysathq.github.io) · [NetworkX](https://networkx.org)

**CLARITY** — Think clearly. Argue soundly.
