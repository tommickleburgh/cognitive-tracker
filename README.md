# Cognitive Tracker PWA

A mobile-first, local-first educational cognitive self-tracking prototype.

## Run locally
A service worker requires HTTP/HTTPS rather than opening `index.html` directly.

From this folder on a computer:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish to GitHub Pages
Upload all files in this folder to the root of a GitHub repository, then enable GitHub Pages for the repository.

## Current features
- Monthly assessments
- Randomized word-learning task
- Working-memory digit task
- Five-trial reaction-time task
- Executive sequencing task
- Delayed recall
- Everyday-function questionnaire
- Local browser history
- Initial 3-session personal baseline
- Trend charts
- JSON export/import backup
- PWA manifest and offline service worker

## Important
This is an educational prototype, not a validated cognitive screening instrument or diagnostic medical device.
