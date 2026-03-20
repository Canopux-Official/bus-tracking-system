# 🚌 Bus Tracking System

Real-time bus tracking application with modern JavaScript + Python backend architecture.

> **Current status**: Local development setup (no Docker yet)

---

## 🛠 Tech Stack

| Layer            | Technology                     | Notes                                  |
|------------------|--------------------------------|----------------------------------------|
| Frontend         | Vite + TypeScript + React      | (or your preferred framework)          |
| Main Backend     | Node.js + Express + TypeScript | Core API & business logic              |
| Optional Backend | Python + FastAPI               | For ML, heavy computation, etc.        |
| Future           | PostgreSQL + Redis             | Planned for persistent storage + cache |

---

## 📁 Project Structure

```
bus-tracking-system/
├── frontend/                 # Vite + TypeScript frontend
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
├── node-server/              # Main backend — Node.js + Express + TypeScript
│   ├── src/
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── python-server/            # Optional / auxiliary backend — FastAPI
│   ├── src/
│   │   └── main.py
│   ├── venv/                 # Python virtual environment
│   ├── requirements.txt
│   └── .env
└── README.md
```

---

## 🚀 Quick Start (Local Development — No Docker)

### 1. Node.js Backend (Express + TypeScript)

```bash
# 1. Go to node backend
cd node-server

# 2. Install dependencies
npm install

# If starting completely fresh:
npm install express dotenv
npm install -D typescript ts-node-dev @types/node @types/express

# 3. Create .env file
echo "PORT=4000" > .env

# 4. Run in development mode (auto-reload)
npm run dev
```

➡ Open → `http://localhost:4000`

✅ Expected: `Node.js TypeScript server is running!`

---

### 2. Python Backend (FastAPI)

```bash
# 1. Go to python backend
cd python-server

# 2. Create & activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# or manually:
pip install fastapi uvicorn python-dotenv

# 4. Create .env file
echo "PORT=5000" > .env

# 5. Start the server
python src/main.py
```

➡ Open → `http://localhost:5000`  
➡ Interactive docs → `http://localhost:5000/docs`

✅ Expected response:

```json
{ "message": "Python server running" }
```

---

### 3. Frontend (Vite + TypeScript)

```bash
cd frontend

npm install
npm run dev
```

➡ Usually opens at `http://localhost:5173`

---

## 📜 Available Scripts Summary

### Node Server (`node-server/`)

```bash
npm run dev     # development with hot-reload
npm run build   # compile to dist/
npm start       # run compiled version
```

### Python Server (`python-server/`)

```bash
python src/main.py            # start with uvicorn (reload enabled)

# or directly with uvicorn:
uvicorn src.main:app --reload --port 5000
```

### Frontend (`frontend/`)

```bash
npm run dev      # vite dev server
npm run build    # production build
npm run preview  # preview production build
```