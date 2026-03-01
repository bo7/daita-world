# 🌍 daita-world

> Mono-Repo für alle DAITA-CRAFTER Services, Apps und Infrastruktur.

---

## Struktur

```
daita-world/
├── apps/
│   ├── daita-web/      # Haupt-Website + statische Pages
│   ├── mia/            # Mia Booking-Bot (Interview-Agent)
│   ├── backoffice/     # Mia Backoffice-Dashboard
│   ├── secretary/      # Kalender-Anonymisierung
│   └── hp2.0/          # Next.js Relaunch (in dev)
├── services/
│   └── crm/            # Twenty CRM deployment config
├── infrastructure/
│   ├── fcstp1910/      # fcstp1910 Server-Configs
│   ├── hetzner/        # Hetzner WG-Gateway
│   └── wireguard/      # WG-Configs (ohne private keys)
├── docs/
│   ├── adr/            # Architecture Decision Records
│   └── architecture/   # Diagramme
├── .github/workflows/  # CI/CD
├── REPOS.md            # Alle Repos + Services im Überblick
└── README.md
```

## Kernservices

| Service | URL | Stack |
|---------|-----|-------|
| **daita-crafter.com** | https://daita-crafter.com | Nginx + Static |
| **Mia (Booking-Bot)** | /portal | Node.js + MLX Qwen2.5-14B |
| **Backoffice** | /backoffice | Vanilla JS + FastAPI |
| **Secretary** | intern :8302 | Python FastAPI |
| **CRM** | crm.inranet.daita-crafter.com | Twenty (self-hosted) |

## Quick Links

→ [Alle Repos & Status](REPOS.md)  
→ [Deployment fcstp1910](infrastructure/fcstp1910/)  
→ [ADRs](docs/adr/)

## Deployments

```bash
# fcstp1910 — daita-web + Mia
ssh fcstp1910 "cd /opt/docker/daita-web && sudo docker compose up -d --build ollama-bridge"

# secretary (10.200.0.22)
systemctl --user restart secretary-api secretary-bridge secretary-sync
```
