# MathVerse Ultra Pro Magazine

A complete web prototype for a high-end **weekly interactive math magazine** with:

- Realistic flipbook reading experience (flip animation + page-turn sound).
- Selectable text, clickable QR links, clickable photos with full-screen expansion.
- Dynamic lighting/reflection feel with mobile tilt (`deviceorientation`) and ambient-light hints when available.
- Non-linear smooth zoom by mouse wheel and pinch on touch devices.
- One-page mode with peeking next page and smooth jump to it.
- Built-in reading voice using Web Speech API.
- Creator Lab: notion-like block workflow to compose headings, paragraphs, equations, image/video blocks, then publish into a magazine page.
- LaTeX support via MathJax.

## Run locally

Because this project uses browser APIs and remote assets, run with any local static server:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

## Notes

- On Android/iOS, pinch zoom and device tilt are supported when the browser grants permissions.
- Ambient light sensor support is browser/device dependent.
