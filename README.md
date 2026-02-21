![License](https://img.shields.io/badge/license-Proprietary-red)
# ✈️ Travelbot — AI Travel Planner Agent

An AI-powered travel planning chatbot built on **Cloudflare Workers**, using **Agents SDK**, **Workers AI (GLM 4.7 Flash)**, and **Durable Objects** for stateful, real-time conversations.


## Architecture

```
Browser (React)  ←WebSocket→  Cloudflare Worker  →  Durable Object (ChatAgent)
                                                            ↓
                                                     Workers AI (GLM 4.7 Flash)
                                                            ↓
                                                   Tool Execution + Streaming
```

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | React 19 + Vite | Chat UI with Markdown rendering, sidebar, mobile responsive |
| **Backend** | Cloudflare Workers | Entry point, routes requests to Durable Object |
| **Agent** | `@cloudflare/ai-chat` (AIChatAgent) | Manages chat state, tool execution, streaming |
| **LLM** | Workers AI — `@cf/zai-org/glm-4.7-flash` | Text generation with native function calling |
| **State** | Durable Object memory + SQLite | Preferences in memory, trip history in SQL |
| **Transport** | WebSocket via Agents SDK | Real-time bidirectional streaming |

### AI Tools

| Tool | Type | Description |
|------|------|-------------|
| `getWeather` | Server-side (auto) | Fetches weather forecast for any destination |
| `createItinerary` | Server-side (auto) | Generates detailed day-by-day trip plans |
| `getUserPreferences` | Client-side | Collects user's timezone, language, and interests from the browser |
| `bookActivity` | Approval-required | Books activities — requires explicit user approval |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)

### Install

```bash
git clone https://github.com/<your-username>/cf_ai_travelbot.git
cd cf_ai_travelbot
npm install
```

### Run Locally

```bash
# 1. Authenticate with Cloudflare (needed for Workers AI)
npx wrangler login

# 2. Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

> **Note:** The AI binding requires Cloudflare authentication because GLM 4.7 Flash runs remotely on Cloudflare's infrastructure. `wrangler login` opens a browser for OAuth.

### Deploy to Production

```bash
npm run deploy
```

This builds the Vite frontend and deploys the Worker + Durable Object to Cloudflare's edge network.

## 📁 Project Structure

```
├── src/
│   ├── server.ts         # ChatAgent Durable Object + tools + Worker entry
│   ├── client.tsx        # React chat UI with sidebar, Markdown, tool cards
│   └── styles.css        # 1000+ lines — design tokens, responsive, dark theme
├── public/images
│   └── logo.png          # Logo for the chatbot
├── index.html            # HTML entry point
├── wrangler.jsonc        # Cloudflare config (AI binding, DO, migrations)
├── vite.config.ts        # Vite + Cloudflare plugin
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

## ✨ Features

- **Real-time streaming** — responses stream token-by-token via WebSocket
- **Tool calling** — AI invokes tools (weather, itinerary, booking) with structured function calling
- **Stateful conversations** — Durable Object persists preferences and trip history in SQLite
- **Markdown rendering** — AI responses display with proper headings, bold, lists, code blocks, and tables
- **Responsive design** — mobile-first with slide-in sidebar overlay and backdrop
- **Approval flow** — booking tool requires explicit user approve/reject before executing

## 🛠️ Tech Stack

- **Runtime:** Cloudflare Workers + Durable Objects
- **AI:** Workers AI (`@cf/zai-org/glm-4.7-flash`) via Vercel AI SDK v5
- **Agent Framework:** `@cloudflare/ai-chat` + `agents` SDK
- **Frontend:** React 19, Vite 7, `react-markdown`
- **Language:** TypeScript
- **Validation:** Zod schemas for tool inputs

