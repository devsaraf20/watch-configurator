# Watch Configurator

A web-based 3D watch configurator built with **React**, **Vite**, **Three.js** and **React Three Fiber**.

- Choose the **case** finish (polished steel, yellow gold, rose gold, matte black), **dial colour**, **strap material** (leather, rubber, metal) and **strap colour**
- Virtual photo-studio lighting with real-time reflections, so metal looks like metal
- Drag to rotate, scroll or pinch to zoom
- **Download image** saves a high-resolution PNG of the current view
- Minimal, premium UI: side panel on desktop, bottom sheet on mobile
- Every build gets a shareable URL (e.g. `/?case=gold&dial=onyx&strap=metal`)
- Comes with a placeholder watch made from basic shapes. You can swap it for your own Blender model by changing one line.

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

---

## Folder structure

```
watch-configurator/
├── index.html                  Page shell (title, fonts, favicon)
├── vite.config.js              Vite build settings
├── vercel.json                 Vercel deployment settings
├── public/
│   ├── favicon.svg
│   └── models/                 ← put your watch.glb here
└── src/
    ├── main.jsx                Starts React
    ├── App.jsx                 Page layout, share-able URL, download button wiring
    ├── styles.css              All styling (design tokens at the top)
    ├── config/
    │   ├── options.js          ★ Colours & materials shown in the panel: edit to add your own
    │   └── model.js            ★ Your GLB path + Blender naming rules
    ├── components/
    │   ├── Scene.jsx           3D canvas, camera, orbit controls, floor shadow
    │   ├── Studio.jsx          Studio lighting / reflections (virtual softboxes)
    │   ├── Watch.jsx           Picks placeholder or your GLB
    │   ├── PlaceholderWatch.jsx  The built-in watch made of basic shapes
    │   ├── GLBWatch.jsx        Loads your GLB and connects its parts by name
    │   └── ConfigPanel.jsx     The side panel UI
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

- model each hand **pointing at 12 o'clock**
- set each hand's **origin at the centre of the dial** (Object → Set Origin → Origin to 3D Cursor, with the cursor at the dial centre)

### 3. Orientation, scale and transforms

- Model the watch **lying flat with the dial facing up (+Z)** and **12 o'clock pointing to +Y**, which is how most watches are modelled in Blender. The configurator stands it upright facing the camera.
  If your model is already upright facing the front view (-Y), set `MODEL_ROTATION = [0, 0, 0]` in `src/config/model.js`.
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
6. Optional: under **Data → Compression**, Draco compression makes the file much smaller. It's supported automatically (the decoder is loaded from Google's CDN).
7. Save it as **`public/models/watch.glb`**

### 6. Switch the configurator to your model

Open `src/config/model.js` and change:

```js
export const MODEL_URL = import.meta.env.VITE_MODEL_URL || null
```

to:

```js
export const MODEL_URL = import.meta.env.VITE_MODEL_URL || '/models/watch.glb'
```

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

Remember to commit `public/models/watch.glb` so it's deployed too. Keep the file reasonably small (ideally under ~10 MB) by using Draco compression and modest texture sizes, so it loads quickly on phones.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| A part doesn't change colour | Check the console's matching report. Rename the object (or its parent) so it starts with a keyword from the table above. |
| The model appears sideways or upside down | Adjust `MODEL_ROTATION` in `src/config/model.js` (try `[0, 0, 0]` or `[-Math.PI / 2, 0, 0]`). |
| The model is tiny or huge | Make sure the case objects are named `case…`, so auto-scale can measure them, or set `MODEL_SCALE` to a number. |
| Hands spin the wrong way or around the wrong axis | Change `HAND_AXIS` in `src/config/model.js` (`'y'`, `'-y'`, `'z'`, `'-z'`…) and check each hand's origin is at the dial centre. |
| The dial print disappears under the glass | Make sure the print isn't a *transparent (alpha blend)* material. Use **Alpha Clip** in Blender instead: glass only shows opaque objects behind it. |
| A blank screen on a very old device | The configurator needs WebGL 2, which every current browser supports. |
