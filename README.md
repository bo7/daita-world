# daita-world

Mono-Repo für alle daita-crafter Services, Infrastruktur und Webprojekte.

## Struktur

```
daita-world/
├── apps/
│   └── daita-web/          # hands.trembling-hands.com / daita-crafter.com
│       ├── src/             # HTML, Blog, Assets (statische Seiten)
│       ├── nginx/           # nginx config
│       ├── ollama-bridge/   # Node.js Bridge (Übersetzung, Auth, CV)
│       ├── cv/              # CV-Ablage (PDFs werden nicht versioniert)
│       └── prompts/         # Claude Code Prompts für dieses Projekt
├── infrastructure/
│   ├── b07/                 # Contabo VPS (144.91.108.111) - PROD
│   ├── hetzner/             # Hetzner Bare Metal (65.21.198.220) - DEV/WG-Hub
│   └── wireguard/           # WireGuard Configs (ohne private keys)
├── docs/                    # Architektur, Entscheidungen, Onboarding
├── scripts/                 # Deploy- und Hilfsskripte
└── .github/workflows/       # CI/CD
```

## Branching

| Branch | Zweck | Ziel |
|--------|-------|------|
| `main` | Production-ready | Deploy → b07 (144) |
| `dev` | Integration | Hetzner Docker-VM |
| `feature/*` | Feature-Entwicklung | → dev |

## Deployment

```bash
# Feature → Dev
git checkout -b feature/mein-feature
git push origin feature/mein-feature
# PR → dev

# Dev → Main (Production)
git checkout main
git merge dev
git push origin main
# GitHub Action deployed nach b07
```

## Services auf b07 (PROD)

| Service | Port intern | URL |
|---------|-------------|-----|
| nginx/web | 8231 | https://hands.trembling-hands.com |
| ollama-bridge | 3100 | /api/* |
| plausible | 8230 | intern |

## Infrastruktur

- **b07** (Contabo, 144.91.108.111): PROD, öffentlich erreichbar, Cloudflare
- **Hetzner** (65.21.198.220, Helsinki): WireGuard Hub, DEV, zugenagelt
- **mac1** (10.200.0.11): Ollama – Qwen3-Coder-Next, llama3.1
- **mac2** (10.200.0.12): Sprachmodelle, ComfyUI/SDXL
- **WireGuard**: 10.200.0.0/24, Hub auf Hetzner
