# Infrastruktur-Übersicht

## Netzwerk-Topologie

```
Internet
    │
    ▼
Cloudflare (DNS/Proxy)
    │
    ▼
b07 Contabo (144.91.108.111:80/443) ── PROD
    │  nginx (host)
    │  ├── daita-web (8231)
    │  ├── ollama-bridge (3100)
    │  ├── plausible (8230)
    │  └── weitere Docker-Stacks
    │
    │  WireGuard 10.200.0.50
    │
WireGuard Mesh (10.200.0.0/24)
    │  Hub: Hetzner 65.21.198.220
    │
    ├── Hetzner (10.200.0.1 / 65.21.198.220) ── DEV/HUB
    │   └── KVM/Debian Host
    │       ├── Docker-VM (dev deployments)
    │       ├── ccvm (Experimente)
    │       └── weitere VMs
    │
    ├── mac1 (10.200.0.11) ── Ollama
    │   ├── Qwen3-Coder-Next
    │   └── llama3.1:8b
    │
    └── mac2 (10.200.0.12) ── Media/NLP
        ├── qwen2.5:14b
        ├── nomic-embed-text
        └── ComfyUI / SDXL
```

## Zugang

```bash
# b07 PROD (via WireGuard)
ssh -p 2608 b07@10.200.0.50

# Hetzner (direkt)
ssh hetzner  # via ~/.ssh/config

# Mac Studios (via WireGuard)
ssh mac1     # 10.200.0.11
ssh mac2     # 10.200.0.12
```

## Wichtig

- b07 SSH nur über WireGuard erreichbar (nicht public)
- Hetzner von außen zugenagelt, nur WG-Zugang
- Docker-Container binden nur auf 127.0.0.1, nie 0.0.0.0
- Samba nur über WireGuard (10.200.0.0/24)
