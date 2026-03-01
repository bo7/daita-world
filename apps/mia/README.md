# Mia — Booking-Bot

KI-Terminassistentin für daita-crafter.com.

## Stack
- Node.js Express
- MLX Qwen2.5-14B-Instruct-4bit (mac2:8082) für Interview-Dialog
- JSON-mode: kein Regex, LLM füllt visitor-Objekt direkt
- Secretary API (10.200.0.22:8302) für Kalender-Buchungen
- Resend für Bestätigungs-E-Mails

## Endpoints
- `POST /mia/chat` — Interview-Schritt
- `POST /mia/book` — Termin buchen
- `GET  /mia/slots` — Verfügbare Slots
- `GET  /api/backoffice/bookings` — Buchungsliste
- `POST /api/backoffice/research` — LLM Unternehmens-Recherche
- `POST /api/backoffice/crm` — Lead in Twenty CRM

## Deploy
```bash
ssh fcstp1910 "cd /opt/docker/daita-web && sudo docker compose up -d --build ollama-bridge"
```

## Env vars
Siehe `.env.example`
