# Arun Pandi · XR Developer portfolio

Live site: **https://gowtham-luna.github.io/arun-portfolio/**

A single-page portfolio in plain HTML, CSS and JavaScript. No build step, no frameworks.

## Run it locally
The 3D models load with `fetch`, so open the site through a local server, not by double-clicking `index.html`:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173 in your browser. Press `Ctrl + C` in the terminal to stop.

## Update the live site
GitHub Pages serves the `main` branch. Commit and push, and the live site updates within a minute or two:

```bash
git add -A
git commit -m "Update portfolio"
git push
```

## Edit your links
Open `assets/js/main.js` and fill in the block at the top:
- `LINKEDIN`: your LinkedIn URL (the LinkedIn row appears once set)
- `RESUME`: e.g. `assets/Arun-Pandi-CV.pdf` (a "Download CV" button appears once set)
- `DEMOS`: a YouTube or Google Drive link per project ("Watch demo video" appears once set)

## Use real screenshots (recommended)
Project thumbnails are concept illustrations. Real screenshots build more trust:
1. Put your images in `assets/img/` (JPG or WebP, around 1600px wide, under 300 KB each).
2. In `index.html`, change the matching `src="assets/img/…"` and `data-full="assets/img/…"`.
3. Once every project uses real images, remove the "Project images are concept illustrations" note under the projects.

## Files
- `index.html`: the whole page
- `assets/css/style.css`: design tokens and styles
- `assets/js/main.js`: links config, intro sequence, smooth scroll and interactions
- `assets/js/cloud.js`: the 3D point-cloud scene (raw WebGL, no libraries) and the hand-built 3D scenes
- `assets/models/`: point files for the headset and pallet truck
- `assets/img/`: project illustrations (SVG)
- External: Lenis smooth scroll (from unpkg) and Google Fonts
