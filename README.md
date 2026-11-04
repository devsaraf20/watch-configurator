# Watch Configurator

A web-based 3D watch configurator built with **React**, **Vite**, **Three.js** and **React Three Fiber**.

- Choose the **case** finish (polished steel, yellow gold, rose gold, matte black), **dial colour**, **strap material** (leather, rubber, metal) and **strap colour**
- Virtual photo-studio lighting with real-time reflections, so metal looks like metal
- Drag to rotate, scroll or pinch to zoom
- **Download image** saves a high-resolution PNG of the current view
- Minimal, premium UI: side panel on desktop, bottom sheet on mobile
- Every build gets a shareable URL (e.g. `/?case=gold&dial=onyx&strap=metal`)
- **Record 360° video:** a smooth 6-second turntable of the current configuration (1080p where supported), saved as MP4 or WebM
- **Export all variants:** every case × dial × strap combination as named PNGs in one ZIP, with progress and Cancel
- **Banner generator:** enter a name, tagline and price, add a logo, and get 1:1, 4:5, 9:16 and 16:9 banners as a ZIP
- **Bring your own model:** visitors can drop any watch `.glb` into the page. Parts are detected automatically and can be checked and corrected, with no code changes. See [below](#bring-your-own-model-in-the-browser).
- Shows your watch model (`public/models/watch.glb`). A built-in placeholder made from basic shapes is used when no model is set.

---

## Run it

You need [Node.js](https://nodejs.org) 20.19 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Development server with instant reload          |
| `npm run build`   | Production build into `dist/`                   |
| `npm run preview` | Serve the production build locally to check it  |
| `npm run optimize-model -- <file.glb>` | Compress a new Blender export into `public/models/watch.glb` |
| `npm run test:detection` | Check the automatic part detection against the demo watch in 4 orientations |

---

## Folder structure

```
watch-configurator/
├── index.html                  Page shell (title, fonts, favicon)
├── vite.config.js              Vite build settings
├── vercel.json                 Vercel deployment settings
├── public/
│   ├── favicon.svg
│   └── models/watch.glb        Your watch (optimised, ~0.4 MB)
├── scripts/
│   └── optimize-model.mjs      Compresses a Blender export for the web
└── src/
    ├── main.jsx                Starts React
    ├── App.jsx                 Page layout, share-able URL, download button wiring
    ├── styles.css              All styling (design tokens at the top)
    ├── config/
    │   ├── options.js          ★ Colours & materials shown in the panel: edit to add your own
    │   └── model.js            ★ Your GLB path, object → part mapping, hands
    ├── components/
    │   ├── Scene.jsx           3D canvas, camera, orbit controls, floor shadow
    │   ├── Studio.jsx          Studio lighting / reflections (virtual softboxes)
    │   ├── Watch.jsx           Picks the uploaded model, your demo GLB or the placeholder
    │   ├── PlaceholderWatch.jsx  The built-in watch made of basic shapes
    │   ├── GLBWatch.jsx        Loads your GLB and connects its parts by name
    │   ├── ConfigPanel.jsx     The side panel UI (Configure tab)
    │   ├── ExportSection.jsx   "Record 360° video" and "Export all variants" controls
    │   ├── BannerPanel.jsx     The Banners tab (form, previews, ZIP)
    │   ├── PanelTabs.jsx       Configure | Banners switch
    │   └── JobOverlay.jsx      Progress + Cancel for long exports
    ├── export/                 Everything that produces files
    │   ├── capture.js          Shared: export sizing/framing, backdrop, crop, download
    │   ├── turntable.js        360° video (WebCodecs, MediaRecorder fallback)
    │   ├── batch.js            All-variants PNG export into a streamed ZIP
    │   └── banners.js          Banner layouts and typography for each ratio
    ├── byom/                   "Bring your own model" (in-browser uploads)
    │   ├── analyze.js          Orientation + part detection (names + geometry), merge warnings
    │   ├── loadModel.js        Reads and parses the file in the browser (loaded on demand)
    │   ├── useCustomModel.js   Upload state: roles, orientation fix, saving
    │   ├── storage.js          Remembers mappings in localStorage (per file name)
    │   ├── UploadedWatch.jsx   Renders the upload with live materials + highlight/picking
    │   ├── ModelSection.jsx    Drop area / file card in the panel
    │   ├── PartsPanel.jsx      The "Check your parts" step
    │   └── roles.js            The roles a mesh can have
    ├── materials/
    │   ├── useWatchMaterials.js  One material per part; animates changes
    │   └── textures.js         Generated leather grain, bracelet links, sunburst dial
    └── utils/
        ├── geometry.js         Shapes for the placeholder (case, strap, hands…)
        ├── downloadImage.js    High-res PNG export
        └── time.js             Hand positions (10:10 pose, live second hand)
```

The two files marked ★ are the ones you'll most likely edit.

---

## Bring your own model (in the browser)

Anyone can try their own watch without touching the code:

1. **Upload:** click **Upload model** in the panel, or drag a `.glb` file anywhere onto the page. A self-contained `.gltf` also works. The file is opened **in the browser only** and never sent to a server. Files over 15 MB show a warning, because they may be slow on phones, and files over 300 MB are refused.
2. **Automatic detection:** every mesh gets a role: case, crown, dial, hands, hour markers, glass, strap/bracelet, buckle, or *Ignore* (keeps its own material). Detection uses:
   - **names:** object, material and parent names (`dial`, `strap`, `bezel`, `crystal`, …)
   - **geometry:** size, position, thickness and shape. For example, the largest round part is the case. A solid flat disc under the hands is the dial. A see-through or front-most disc is the glass. Twelve similar parts around the dial are markers. Flat parts reaching out from the centre are hands. A small part on the side is the crown. Long parts outside the head are the strap.
   - Each guess shows a **High / Medium / Low** confidence and the reason behind it.
3. **Check your parts:** this step opens after each upload and lists every mesh.
   - Click a row, or click the mesh in the 3D view, to highlight it in blue. Click again in 3D to reach what's behind it, such as the dial under the glass.
   - Choose a role from the dropdown. The watch updates live with the current case finish, dial colour and strap.
4. **Orientation:** the model is automatically turned so the dial faces you with 12 o'clock at the top, then centred and scaled to the demo size. The dial direction comes from the head's flat discs. 12 o'clock comes from the strap direction and the crown at 3 o'clock. If it's still wrong, use **Rotate 90°**, **Tilt 90°**, **Flip** or **Auto**.
5. **Merged meshes:** if one mesh contains pieces that look like different parts (for example the dial and the hands), you get a warning explaining how to split it in Blender (<kbd>Tab</kbd> → hover → <kbd>L</kbd> → <kbd>P</kbd> → *Selection*).
6. **Remembered:** roles and the orientation fix are saved in the browser's `localStorage`, keyed by file name. Uploading the same file again restores them. **Start over** forgets them.
7. **Reset to demo** returns to the built-in watch.

Uploaded models don't animate their hands: hands are found by shape, but not which is which. Generated textures (leather grain, links, sunburst) are also only used on the placeholder, because they depend on its UVs. Draco- and meshopt-compressed files are supported, and the Draco decoder is bundled. KTX2 textures aren't supported.

**The demo watch** is whatever `MODEL_URL` in `src/config/model.js` points to; currently your `watch.glb`. Set it to `null` to make the procedural placeholder the demo instead.

## Video, variants and banners

### Record 360° video
**Configure → Export → Record 360° video** makes a 6-second, constant-speed turn of the watch, starting from the angle you're looking from, so the clip loops seamlessly.

- **Smooth on any device:** each of the 180 frames (30 fps) is rendered at an exact angle and encoded with the browser's WebCodecs encoder, so the result doesn't depend on how fast the device is. The progress bar shows real rendering progress.
- **Format and size:** **MP4 (H.264)** where the browser can encode it, otherwise **WebM (VP9/VP8)**. 1920×1080 where the GPU and memory allow, otherwise 1280×720.
- **Older browsers:** without WebCodecs, the clip is recorded in real time with MediaRecorder instead.
- **Code:** `src/export/turntable.js`. The encoder library ([Mediabunny](https://mediabunny.dev)) is only downloaded when you make a video.

### Export all variants
**Configure → Export → Export all variants** renders every combination of case, dial and strap as a square PNG: 4 × 7 × (7 leather + 7 rubber + 1 bracelet) = **420 images**.

- **Sizes:** 800, 1200 or 2000 px, defaulting to 800 on phones.
- **Contents of the ZIP:**
  - one PNG per combination, with descriptive file names, e.g. `001_polished-steel_midnight-blue-dial_black-leather-strap.png`
  - a `variants.csv` listing the case, dial and strap of each file
- **Memory:** the ZIP is streamed, so the images aren't all held in memory at once.
- **Progress and Cancel:** a progress bar with time remaining and a **Cancel** button. Cancelling discards the partial export and restores your configuration.
- **Background tabs:** the export keeps working if the tab is in the background, though keeping it visible is faster.
- **Code:** `src/export/batch.js`. Adding options in `src/config/options.js` adds them to the export automatically.

### Banner generator
The **Banners** tab, next to Configure, makes marketing images from the current watch.

- **Inputs:** product name, tagline, price, an optional logo (a transparent PNG or SVG works best) and a light or dark style.
- **The watch:** a transparent, high-resolution render from the 3D view's current angle. Rotate the watch, then press **Update from 3D view**.
- **Formats:** each has its own composition, and long text shrinks or wraps to fit.

  | Format | Size | Layout |
  | --- | --- | --- |
  | 1:1 Square | 1080×1080 | Logo, large watch, then centred name, tagline and price |
  | 4:5 Portrait | 1080×1350 | Logo, name and tagline on top, watch in the middle, price at the bottom |
  | 9:16 Story | 1080×1920 | Same order, kept inside the area Stories/Reels don't cover with their own UI |
  | 16:9 Landscape | 1920×1080 | Text column on the left, watch large on the right |

- **Type hierarchy:** a serif display name, then the price in an outlined pill, then a lighter tagline.
- **Downloads:** each preview has its own PNG link, and **Download banners (ZIP)** saves all four.
- **Remembered:** your text and logo are kept in this browser.
- **Code:** `src/export/banners.js`. The sizes, colours and spacing are at the top of the file.

## The current model

`public/models/watch.glb` is an optimised copy of your Blender export. It is a ball-bearing watch: two balls travel around tracks on the dial instead of hands. Its objects still have default modelling names (`pCube8`, `polySurface11`, …), so they're mapped to parts explicitly in `PART_OVERRIDES` in `src/config/model.js`:

| Part | Objects |
| --- | --- |
| **Case** | `pCylinder1.001` (front case / bezel), `pCylinder4.001` (case back), `pCylinder5.001` (crown), `polySurface11–14.001` (lugs), `polySurface5.001` / `polySurface6.001` (spring bars) |
| **Dial** | `pCylinder2.001` (outer ring), `pCylinder3.001` (centre disc) |
| **Hands** | `pSphere1` (inner ball → hours), `pSphere2` (outer ball → minutes) |
| **Strap** | `pCube8.001` (lower strap), `pPlane2.001` (upper strap) |
| **Glass** | *none: the model has no crystal* |
| *Markers* (follow the hands) | `polySurface15–26.001` (12 indices; 15 is the triangle at 12) |
| *Buckle* (follows the case) | `pCube12.001` (frame), `pCube13.001` (prong) |

The export also contained four empty objects with no geometry (`Watch`, `pCube15`, `pCube29`, `polySurface7`). They were removed during optimisation.

The model is exported upright (dial facing +Z, 12 o'clock at +Y), so `MODEL_ROTATION` is `[0, 0, 0]`. It is scaled automatically to the same size as the placeholder.

### Updating the model

1. Export from Blender as **glTF Binary (.glb)**.
2. Run the optimiser. It keeps object names and makes the file about 6× smaller (2.4 MB → 0.4 MB for the current watch):

```bash
npm run optimize-model -- ~/Downloads/my-watch.glb
```

3. If you added, renamed or removed objects, update `PART_OVERRIDES` in `src/config/model.js`. Alternatively, rename them in Blender using the keywords below and they'll be picked up automatically.

## Using your own Blender model

### 1. Name your objects

The configurator finds each part of your watch **by object name**. A name only has to **start with** the keyword. Upper and lower case don't matter, and Blender's `.001` suffixes are fine.

| Part        | Name objects starting with…                 | Examples                                       | What controls it         |
| ----------- | ------------------------------------------- | ---------------------------------------------- | ------------------------ |
| **Case**    | `case`, `bezel`, `crown`, `lug`             | `case_body`, `bezel`, `crown`, `lug.001`       | Case material            |
| **Dial**    | `dial`                                      | `dial`, `dial_base`                            | Dial colour              |
| **Strap**   | `strap`, `bracelet`, `band`                 | `strap_top`, `strap_bottom`, `bracelet_links`  | Strap material & colour  |
| **Hands**   | `hand`                                      | `hands`, `hand_hour`, `hand_minute`            | Follows the case metal\* |
| **Glass**   | `glass`, `crystal`                          | `glass`, `crystal`                             | Clear sapphire glass     |
| *Buckle*    | `buckle`, `clasp`                           | `buckle`, `clasp`                              | Follows the case metal   |
| *Markers*   | `marker`, `index`, `indices`                | `markers`, `index_12`                          | Follows the hands        |

\* With a matte black case, the hands switch to steel so they stay readable. You can change this in `config/options.js` (`handsMaterial`).

**Anything else keeps the material you gave it in Blender.** That's how you keep a logo, printed dial text, lume, a date wheel or a rotor exactly as you designed them. Just name them something else, for example `logo`, `print_dial_text` or `lume_hour`.

**Using a parent instead.** You don't have to rename every piece. If several objects are children of a parent whose name matches, they all belong to that part. For example, an Empty called `strap` with the children `top`, `bottom` and `keeper` makes all three strap pieces. (Blender collections are not exported to GLB, so use a parent object or Empty, not a collection.)

**Using a material name instead.** If an object's own name and its parents' names don't match, the configurator checks its **material name** too. A material called `dial` therefore also works.

A typical outliner:

```
watch                (Empty, optional)
├── case_body
├── bezel
├── crown
├── lug.001 … lug.004
├── dial
├── print_dial_text  ← keeps its own Blender material (not configurable)
├── markers
├── hand_hour
├── hand_minute
├── hand_second
├── glass
├── strap_top
├── strap_bottom
└── buckle
```

### 2. Optional: ticking hands

If the hands are separate objects named exactly **`hand_hour`**, **`hand_minute`** and **`hand_second`**, they'll be posed at 10:10 and the second hand will sweep in real time, just like the placeholder. For this to work:

- hands turn around the **centre of the dial** (measured from the `dial` objects), so their origin doesn't matter
- they can be exported **pointing anywhere**: their resting angle is measured automatically
- other names work too: list them in `HAND_NAMES` in `src/config/model.js` (as done for this model's ball bearings)

### 3. Orientation, scale and transforms

- The current settings expect the watch **upright, with the dial facing the Blender front view (-Y)** and 12 o'clock up (+Z), like the current model.
- If you model it **lying flat with the dial facing up (+Z)**, set these in `src/config/model.js`:
  - `MODEL_ROTATION = [Math.PI / 2, 0, 0]`
  - `HAND_AXIS = 'y'`
  - `TWELVE_DIRECTION = '-z'`
- **Any units are fine.** The model is automatically scaled and centred on the case (`MODEL_SCALE = 'auto'`).
- Apply transforms before exporting (**Ctrl+A → All Transforms**) so scale and rotation are clean. Exception: for the hands, keep the origin at the dial centre as described above.

### 4. Materials and UVs

The configurator replaces the **colour, metalness and roughness** of the configurable parts. Your **normal map** and **ambient occlusion map** are kept, so stitching, brushing or link detail you baked in Blender still shows. Everything else on those parts is controlled by the configurator. Parts that don't match any keyword keep their full Blender material.

### 5. Export from Blender

1. **File → Export → glTF 2.0 (.glb/.gltf)**
2. Set **Format** to **glTF Binary (.glb)**
3. Under **Include**, tick *Visible Objects* (or *Selected Objects*)
4. Under **Transform**, keep **+Y Up** ticked (the default)
5. Under **Data → Mesh**, tick *Apply Modifiers*
6. Run `npm run optimize-model -- <your-file.glb>`. It writes a compressed copy to **`public/models/watch.glb`**. (Draco-compressed exports also load, but the optimiser's meshopt compression is smaller and needs no extra download.)

### 6. Switch the configurator to your model

`MODEL_URL` in `src/config/model.js` already points at `/models/watch.glb`. To go back to the placeholder, set it to `null` and remove the `<link rel="preload">` line from `index.html`.

Restart `npm run dev`. To check the result, open the browser's developer console. In development the configurator logs a collapsible group, **"How your model's objects were matched to parts"**, listing which object went to which part and which were left unmatched.

> You can also leave the file unchanged and set the environment variable `VITE_MODEL_URL=/models/watch.glb` (locally in a `.env.local` file, or in Vercel → Project → Settings → Environment Variables).

If a name doesn't match the way you want, either rename the object in Blender or edit `PART_RULES` in `src/config/model.js` to add your own keywords.

---

## Customising the options

All panel choices live in `src/config/options.js`. To add a dial colour, add a line:

```js
{ id: 'teal', label: 'Teal', color: '#1f5c5a' },
```

It appears in the panel and on the watch automatically. Case finishes take `color` (the metal's reflection tint), `metalness` (0–1) and `roughness` (0 = mirror, 1 = fully matte). The product name and subtitle in the panel are at the top of `src/components/ConfigPanel.jsx`. Colours and spacing for the UI are the CSS variables at the top of `src/styles.css`.

**Lighting.** `src/components/Studio.jsx` builds a virtual studio from glowing panels: an overhead softbox, two tall strip lights, a key light, a fill light, a rim ring and a floor bounce. Polished metal only looks like metal when it has something bright to reflect. Moving or resizing these panels changes where the highlights fall on the case. No HDRI image is downloaded, so it loads instantly and works offline.

---

## Deploy to Vercel

The project is ready to deploy as-is (`vercel.json` is included).

**Option A: from GitHub (recommended)**

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel detects **Vite** automatically (build command `npm run build`, output `dist`). Click **Deploy**.

Every push to your main branch then deploys automatically, and pull requests get preview URLs.

**Option B: from your terminal**

```bash
npm i -g vercel
```

```bash
vercel --prod
```

Remember to commit `public/models/watch.glb` so it's deployed too. Keep the file reasonably small (ideally under ~10 MB) by running `npm run optimize-model` and keeping textures modest, so it loads quickly on phones.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| A part doesn't change colour | Check the console's matching report. Rename the object (or its parent) so it starts with a keyword from the table above. |
| The model appears sideways or upside down | Adjust `MODEL_ROTATION` in `src/config/model.js` (try `[0, 0, 0]` or `[-Math.PI / 2, 0, 0]`). |
| The model is tiny or huge | Make sure the case objects are named `case…`, so auto-scale can measure them, or set `MODEL_SCALE` to a number. |
| Hands spin the wrong way, around the wrong axis, or show the wrong time | Check `HAND_AXIS` (the direction the dial faces) and `TWELVE_DIRECTION` in `src/config/model.js`, and that the `dial` objects are mapped, because hands turn around the dial's centre. |
| The dial print disappears under the glass | Make sure the print isn't a *transparent (alpha blend)* material. Use **Alpha Clip** in Blender instead: glass only shows opaque objects behind it. |
| The video is WebM, not MP4 | Your browser can't encode H.264 (e.g. Firefox, or Chromium builds without proprietary codecs). WebM plays in all modern browsers and VLC, or convert it with any video tool. |
| "Export all variants" is slow | Choose a smaller size, keep the tab visible, and close other heavy tabs. Rendering is limited by the GPU. |
| A blank screen on a very old device | The configurator needs WebGL 2, which every current browser supports. |
