# DAITA-CRAFTER — Repository & Service Map

> Stand: 2026-03-01 | Gepflegt von: Keld

---

## Mono-Repo (dieses Repo: daita-world)

Alles was zu daita-crafter.com gehört. Deployment, Infra, Services.

---

## Apps in diesem Repo

| App | Pfad | Status | Beschreibung |
|-----|------|--------|--------------|
| **daita-web** | `apps/daita-web/` | 🟢 aktiv | Haupt-Website, Nginx, statische Pages |
| **mia** | `apps/mia/` | 🟢 aktiv | Booking-Chatbot (ollama-bridge/server.js) |
| **backoffice** | `apps/backoffice/` | 🟡 neu | Mia Backoffice-Dashboard + CRM-Integration |
| **secretary** | `apps/secretary/` | 🟢 aktiv | Kalender-Anonymisierung (Google Cal Bridge) |
| **hp2.0** | `apps/hp2.0/` | 🔵 in dev | Next.js 15 + Payload CMS (daita-crafter.com Relaunch) |

---

## Externe Repos (GitHub: bo7)

| Repo | Status | Beitrag zu Mia | Beschreibung |
|------|--------|----------------|--------------|
| **daita-world** | 🟢 aktiv | Deployment-Host | Dieses Repo. Web, Infra, Mia, Secretary |
| **hp2.0** | 🔵 in dev | — | Next.js Relaunch daita-crafter.com |
| **lakehouse-studio** | 🟢 aktiv | — | AI-IDE für DWH-Aufbau (Sprint 1 läuft) |
| **keld** | 🟢 aktiv | — | Keld Workspace / Memory / Config |
| **sbo-knowledge-base** | 🟡 gelegentlich | — | Tech-Doku, Artikel, AI-Notes |
| **oraclebc** | 🟡 pausiert | — | Prediction Market (Foundry, Solidity) |
| **sc_koblenz** | 🔴 blocked | — | OEM PDF-Processing (Backend-Container unhealthy) |
| **crypto-bot** | 🔴 gestoppt | — | Trading-Bots v1-v3, Paper-Trading |
| **bounty-hunter** | 🟡 dev | — | Automatisierter Bug-Bounty-Hunter |
| **coachrag** | 🟢 aktiv | — | Coach Jürgen RAG-Chat (Boxen-Projekt) |
| **trembling-hand-project-board** | 🟡 passiv | — | Visuelles Projekt-Board |
| **lh_piplines_llm** | 🔴 alt | — | Alter Lakehouse ETL (Basis für lakehouse-studio) |
| **iptv-portal** | 🟢 aktiv | — | IPTV-Proxy + Serien-Browser |
| **llm-proxy** | 🟡 passiv | — | LLM-Proxy-Wrapper |
| **agentensbo** | 🔴 archiviert | — | Alter LangChain Multi-Agent (veraltet) |
| **writtencontent** | 🟡 passiv | — | Content-Ablage |

---

## Was jeder Repo zu Mia beisteuert / beigesteuert hat

| Repo/Service | Beitrag |
|---|---|
| **daita-world / apps/mia** | Mia's Kern: server.js (Interview-Flow, JSON-LLM, Booking-API) |
| **daita-world / apps/secretary** | Kalender-Anonymisierung, `/book` Endpoint, Google Calendar Write-Back |
| **daita-world / apps/backoffice** | Backoffice-Dashboard: Buchungen, Recherche, CRM-Push |
| **daita-world / apps/daita-web** | Frontend: portal.html (Split-Screen Chat-UI, Slot-Buttons) |
| **keld** | Memory + Config — Keld kennt Mia's Kontext über Sessions hinweg |

---

## Services (laufend auf fcstp1910)

| Service | Port | Host | Status |
|---------|------|------|--------|
| Mia (ollama-bridge) | :3100 (intern) | fcstp1910 | 🟢 |
| Nginx (daita-web) | :80/:443 | fcstp1910 | 🟢 |
| Secretary API | :8302 | 10.200.0.22 | 🟢 |
| Secretary Bridge | :8303 | 10.200.0.22 | 🟢 |
| Plausible Analytics | :8000 (intern) | fcstp1910 | 🟢 |
| Vaultwarden | :8241 (intern) | fcstp1910 | 🟢 |
| annebeer Strapi | :8220 (intern) | fcstp1910 | 🟢 |
| IPTV Portal | :8200 | fcstp1910 | 🟢 |
| MinIO | :9000-9001 | fcstp1910 | 🟢 |
| Lakehouse (MinIO/PG/Airflow) | :9000/:5432/:8080 | 10.200.0.25 | 🟢 |
| MLX Interview-Server (Mia) | :8082 | mac2 (10.200.0.12) | 🟢 |
| llama.cpp Qwen3-235B | :8080 | mac2 (10.200.0.12) | 🟢 |
| Ollama | :11434 | mac1+mac2 | 🟢 |
| Twenty CRM | TBD | TBD | 🔴 nicht deployed |

---

## Legend

| Icon | Bedeutung |
|------|-----------|
| 🟢 | Aktiv, produktiv |
| 🔵 | In Entwicklung |
| 🟡 | Gelegentlich / pausiert |
| 🔴 | Gestoppt / blocked / archiviert |

