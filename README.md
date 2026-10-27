# ClassMix

Sorts students into a top stream plus balanced classes using last year's marks, with keep-apart/together rules, locks and support-need balancing.

There is **no backend**. The whole app runs in the teacher's browser, and student files are never uploaded anywhere. "The code" is just the files in this folder.

## What's in the folder

| File | What it does | Edit it to… |
|---|---|---|
| `index.html` | The page layout: headings, buttons, panels | Change wording, add a button or field |
| `styles.css` | Colours, fonts, spacing | Change the look (colours are at the top, in `:root`) |
| `app.js` | All the logic: reading Excel, assigning, rules, export | Change how students are placed |
| `manifest.webmanifest` | App name and icon for "Install" | Rename the app |
| `sw.js` | Lets the app open without internet | Usually leave alone |
| `icons/` | App icons | Swap in your own (same file names and sizes) |
| `vendor/xlsx.full.min.js` | Excel library (SheetJS, Apache-2.0) | Don't edit |

### Useful places in `app.js`
- `exampleData()` builds the made-up students shown on first open.
- `assign()` picks the top stream and does the first placement.
- `makeCost()` sets what "balanced" means. The numbers are weights: raise `25*` to care more about spreading support needs, or `6*` for gender. A broken rule costs `5000`.
- `optimise()` swaps students around to lower that cost.
- The `export` click handler decides what goes in the Excel file.

## Editing the code

1. Install **VS Code** (free) and open this folder (File → Open Folder).
2. Install the **Live Server** extension. Right-click `index.html` → **Open with Live Server**. The app opens in your browser and reloads every time you save.
3. Make a change, save, and check it in the browser. Press F12 to see any errors in the Console tab.

You can also just double-click `index.html` to open it, but install and offline mode only work when it's served from a web address.

**Tip:** keep a copy of the folder before big changes, or use GitHub (below) so every version is saved.

## Putting it online (GitHub Pages, free)

1. Create a free account at github.com.
2. Click **New repository** and name it `classmix`. Public is fine because only the code is published; no student data is ever stored there.
3. Click **uploading an existing file** and drag in everything in this folder (keep the `icons` and `vendor` folders). Click **Commit changes**.
4. Go to **Settings → Pages**. Under "Branch" choose `main`, folder `/ (root)`, then **Save**.
5. After a minute your app is live at `https://YOUR-USERNAME.github.io/classmix/`.

To update it later, upload the changed files the same way. Teachers get the new version the next time they open the app.

> **School site instead?** It works on any web server that serves files over https (school intranet, Netlify, Cloudflare Pages). SharePoint document libraries usually download `.html` files instead of opening them, so they aren't a good host.

## Installing it (for teachers)

Open the app's web address in **Chrome** or **Edge**, then:
- **Chrome:** click the install icon at the right of the address bar (a screen with a down arrow), then **Install**.
- **Edge:** click **…** → **Apps** → **Install ClassMix**.

ClassMix then gets its own window, a desktop and Start-menu icon, and opens without internet. On a Mac with Safari: **File → Add to Dock**.

## Renaming the app

Change `ClassMix` in three places: `manifest.webmanifest` (`name` and `short_name`), the `<title>` in `index.html`, and the `<h1>` in `index.html`.
