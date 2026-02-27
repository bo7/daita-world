# Claude Code Prompt – CV Portal mit LaTeX-Übersetzung

## Modell
claude-sonnet-4-6

## Kontext
Projekt: daita-world/apps/daita-web
Stack: Node.js (Express) Bridge, statische HTML-Seiten, Docker Compose
Nutze context7 tool für aktuelle Dokumentation wenn nötig.

## Aufgabe

Implementiere ein CV-Download-Portal mit automatischer Übersetzung und LaTeX-Rendering.

### 1. LaTeX-Vorlage (`apps/daita-web/cv/template.tex`)

Erstelle eine LaTeX-Vorlage die exakt dem Layout der originalen CVs entspricht:
- Zweispaltig im Kopf (Name links, Kontaktdaten rechts)
- Serifenlose Schrift (Arial/Helvetica-ähnlich)
- Abschnitte: Kurzprofil, Kernkompetenzen (2-spaltig), Projekte, Berufserfahrung, Zertifikate, Tech-Stack, Sprachen
- Variablen als Platzhalter: `{{LANG}}`, `{{NAME}}`, `{{TITLE}}`, `{{SUMMARY}}` etc.
- Kompilierbar mit `pdflatex` oder `xelatex`

### 2. Bridge-Endpoint (`ollama-bridge/server.js`)

Ergänze den bestehenden server.js um:

```
GET /api/cv/list
→ Gibt alle vorhandenen Sprachversionen zurück
  { languages: ["de", "en", "fr", ...] }

POST /api/cv/translate
Body: { targetLang: "fr", targetLangName: "Französisch" }
→ 1. Prüfe ob /site/cv/sven-bohnstedt-cv-{targetLang}.pdf existiert
→ 2. Wenn ja: { cached: true, url: "/cv/sven-bohnstedt-cv-fr.pdf" }
→ 3. Wenn nicht:
   a. Lade Quell-CV (DE oder EN je nach Zielsprache)
   b. Extrahiere Text-Sektionen strukturiert
   c. Übersetze jede Sektion via Ollama (10.200.0.11:11434, Modell aus ENV)
   d. Befülle LaTeX-Template mit übersetzten Inhalten
   e. Kompiliere PDF via pdflatex im Container
   f. Speichere unter /site/cv/sven-bohnstedt-cv-{targetLang}.pdf
   g. Return: { cached: false, url: "/cv/sven-bohnstedt-cv-{targetLang}.pdf" }
```

Übersetzungs-Prompt für Ollama:
```
Du übersetzt einen CV-Abschnitt präzise ins {targetLangName}.
Behalte Fachbegriffe, Firmennamen und Eigennamen bei.
Antworte NUR mit dem übersetzten Text, keine Erklärungen.
Abschnitt: {section}
Text: {text}
```

### 3. Portal-Seite (`src/portal.html`)

Ergänze die bestehende portal.html:
- Dropdown mit Sprachen (aus /api/languages)
- Button "CV übersetzen & herunterladen"
- Fortschrittsanzeige mit Schritt-Labels:
  "Prüfe Cache..." → "Übersetze Abschnitte..." → "Erstelle PDF..." → "Fertig"
- Download-Link nach Fertigstellung
- Bereits gecachte Sprachen visuell markieren (grün)

### 4. Docker-Anpassungen

Im `ollama-bridge/Dockerfile`:
- `texlive-latex-base texlive-fonts-recommended texlive-latex-extra` installieren
- `poppler-utils` bereits vorhanden (für pdftotext)

## Constraints

- Secrets NUR aus ENV-Variablen, nie hardcoded
- CV-PDFs landen in `/site/cv/` (gemounted als Volume)
- Fehler beim LaTeX-Compile: Fallback auf Plain-Text-PDF via reportlab oder ähnlich
- Logging: jeder Übersetzungsschritt mit Timestamp nach stdout
- Max Übersetzungszeit: 300s pro CV

## Dateien die du kennen musst

- `ollama-bridge/server.js` (bestehender Code, erweitern nicht ersetzen)
- `ollama-bridge/Dockerfile`
- `src/portal.html`
- `docker-compose.yml`
