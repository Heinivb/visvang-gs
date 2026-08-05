# Fishing Inventory 🎣

A simple website (built with Google Sheets + Google Apps Script) for a fishing crew to keep track of shared gear — dips, sprays, corn, floats, and dough — plus a log of every fish caught and which bait/gear combo caught it.

You do **not** need to know how to code to set this up. Just follow the steps below in order, and don't skip any. It should take about 15–20 minutes the first time.

## What you'll end up with

- A Google Sheet that stores all the data (who owns what gear, what's been used up, every fish caught).
- A private website (only people you allow can open it) where your crew can browse gear, add new items, mark things as used up, and log fish catches — all without ever opening the spreadsheet directly.

## Before you start

You only need:
- A Google account (the free kind everyone already has for Gmail).
- A web browser (Chrome, Edge, Firefox — any of them).
- About 15–20 minutes, uninterrupted, for the first-time setup.

You do not need to install anything on your computer. Everything happens inside your browser, on Google's website.

---

## Step 1 — Get the spreadsheet into your Google Drive

1. Go to [drive.google.com](https://drive.google.com) and log in with your Google account.
2. In this project's `sheet/` folder there is a file called **`Visvang Example Sheet.xlsx`**. Find it on your computer (wherever you downloaded/cloned this project to).
3. In Google Drive, click **New → File upload**, and select that `Visvang Example Sheet.xlsx` file. Wait for it to finish uploading.
4. Once it's uploaded, **double-click it** to open it. Google Drive will open it using its built-in Excel viewer.
5. At the top, click **Open with → Google Sheets**. This converts it into a real Google Sheet that the app can talk to.
6. You'll now have a Google Sheet with these tabs at the bottom: `Dips`, `Sprays`, `Corn`, `Floats`, `Dough`, `Fishes Caught`, and `Validations`. Leave this tab open — you'll come back to it.

> 💡 If you'd rather start from a completely blank sheet instead of the example file, see the "Spreadsheet layout" section near the bottom of this README for exactly which columns each tab needs.

## Step 2 — Owners, brands, and everything else (optional)

Nothing to do here — this step is just letting you know how it works, since it's different from older versions of this app.

You do **not** need to manually type anyone's name into the spreadsheet. Owners, brands, float types, fish types, and venues all register themselves automatically the first time they're used: add a piece of gear under a new person's name via **Add Gear**, or log a catch for a new fish type/venue via **Record Fish**, and that value is added for you.

If you'd rather set some of these up ahead of time (or manage them later — rename or delete a value, for example), open the app and use the **Validations** tab. If you're starting from a spreadsheet that already has gear/catches in it from before this feature existed, click **🔄 Populate from existing data** on that tab once — it scans what's already there and adds anything missing.

## Step 3 — Open the Apps Script editor

This is where you'll paste in the app's code. It sounds technical, but it's just copy-and-paste — you won't be writing any code yourself.

1. While your Google Sheet is open, click **Extensions** in the top menu, then **Apps Script**.
2. A new tab opens — this is the Apps Script editor. It's a separate, blank code editor tied to your specific spreadsheet.
3. You'll see a file called `Code.gs` already open with some placeholder text (probably `function myFunction() {}`). Select all of that placeholder text and delete it.

## Step 4 — Copy in the four project files

You're going to create four files in the Apps Script editor, matching the four files in this project's `scripts/` folder. For each one, you'll open the file on your computer, copy everything inside it, and paste it into the matching file in Apps Script.

### 4a. Code.gs

1. You should still be looking at the empty `Code.gs` file from Step 3.
2. On your computer, open [`scripts/Code.gs`](scripts/Code.gs) in any text editor (Notepad works fine).
3. Select all the text in that file (Ctrl+A), copy it (Ctrl+C).
4. Click back into the Apps Script editor's `Code.gs` file, click inside the empty editor area, and paste (Ctrl+V).

### 4b. Index.html

1. In the Apps Script editor, look at the left-hand sidebar under **Files**. Click the **+** button next to "Files", then choose **HTML**.
2. Name it exactly `Index` (no `.html` at the end — Apps Script adds that automatically). Press Enter.
3. This creates a new file with some default HTML in it. Delete all of that default text.
4. On your computer, open [`scripts/Index.html`](scripts/Index.html), select all (Ctrl+A), copy (Ctrl+C).
5. Paste it into the new `Index` file in Apps Script.

### 4c. Stylesheet.html

1. Same as above: click **+ → HTML**, name it exactly `Stylesheet`, press Enter.
2. Delete the default text inside it.
3. Open [`scripts/Stylesheet.html`](scripts/Stylesheet.html) on your computer, copy everything, and paste it in.

### 4d. JavaScript.html

1. Same again: click **+ → HTML**, name it exactly `JavaScript`, press Enter.
2. Delete the default text inside it.
3. Open [`scripts/JavaScript.html`](scripts/JavaScript.html) on your computer, copy everything, and paste it in.

### 4e. Save everything

Press **Ctrl+S** (or the 💾 save icon at the top) while in the Apps Script editor. This saves all four files at once.

At this point, in the left sidebar you should see exactly these four files: `Code.gs`, `Index`, `Stylesheet`, `JavaScript`. If you have extra leftover files (like an unused default one), you can delete them by clicking the three dots next to the file name and choosing **Delete**.

## Step 5 — Deploy it as a website

"Deploying" just means turning your script into a live web page with its own link.

1. In the Apps Script editor, click the blue **Deploy** button in the top-right, then **New deployment**.
2. Click the little gear/cog icon ⚙️ next to "Select type", and choose **Web app**.
3. Fill in the fields:
   - **Description**: anything you like, e.g. "Fishing Inventory v1".
   - **Execute as**: leave this as **Me (your email address)**.
   - **Who has access**: choose **Anyone with the link** (this lets your crew use it without needing their own Google account permissions set up individually), or **Anyone within [your organization]** if that option appears and fits your situation better.
4. Click **Deploy**.
5. Google will now ask you to authorize the script. This is a normal safety check for any Apps Script project — click **Authorize access**, choose your Google account, and if you see a screen saying "Google hasn't verified this app", click **Advanced**, then **Go to (your project name) (unsafe)**. This warning appears because this is a personal/small project rather than a published Google product — it's expected and safe to proceed since you're the one who wrote/pasted the code.
6. Click **Allow** on the permissions screen.
7. You'll now see a **Web app URL** — a link starting with `https://script.google.com/...`. Copy this link and save it somewhere (bookmark it, send it to your crew, etc.). This is the link everyone will use to open the app.

## Step 6 — Try it out

1. Open the Web app URL from Step 5 in a new browser tab.
2. You should see the Fishing Inventory app load, with tabs across the top: **Browse**, **Stats**, **Fishes Caught**, **Lookup**, **Requires Restock**, **Add Gear**, **Validations**.
3. Click **Add Gear**, fill in a test item, and click **Add Gear** to save it.
4. Click the **Browse** tab and confirm your test item shows up.

If that works, you're fully set up! Share the Web app URL with the rest of your crew.

---

## Making changes later (updating the code)

If you ever edit any of the files in `scripts/` on your computer (or in this repo) and want those changes to show up on the live website:

1. Copy the updated file's contents into the matching file in the Apps Script editor (same as Step 4), replacing what's there.
2. Save (Ctrl+S).
3. Click **Deploy → Manage deployments**.
4. Click the pencil/edit icon ✏️ next to your existing deployment.
5. Next to "Version", choose **New version**, then click **Deploy**.

Your existing Web app URL stays the same — you don't need to send your crew a new link.

## Troubleshooting

- **"Script function not found" or a blank page when opening the link** — Double-check the four file names in Apps Script are exactly `Code`, `Index`, `Stylesheet`, `JavaScript` (Apps Script shows `Code.gs` for the script file, and just the name without `.html` for the HTML files).
- **Owner/brand dropdowns are empty, or gear you expect to see is missing** — Owners, brands, types, fish types, and venues all fill in automatically over time as people use the Add Gear and Record Fish forms. If you're migrating a spreadsheet that already had data in it before the app's **Validations** tab existed, open that tab and click **🔄 Populate from existing data** once — it back-fills anything already in use but not yet recognized (gear/catches referencing an unrecognized value are hidden until it's added, same as a deleted value would be).
- **"Authorization required" errors when using the app** — Redeploy (see "Making changes later" above) and make sure "Execute as" is set to **Me**.
- **Changes you made don't show up on the website** — You likely edited the files but forgot to create a **New version** of the deployment (see "Making changes later" above); simply saving the files in the Apps Script editor is not enough on its own.

---

## Features

- **Browse** — filter all inventory items by owner, category, brand, or whether they've caught fish, with a text search.
- **Stats** — an owner × category quantity matrix, crowning who owns the most of each category, plus fun derived stats: "MVP bait", per-venue statistics (including each venue's top bait), and a per-angler breakdown (catches logged, average weight, personal best) for every angler individually. An **Owner** filter at the top narrows the entire tab down to one person's stats.
- **Fishes Caught** — a log of every catch (date, fish type, weight, venue, angler) with the bait/gear combo used, filterable by fish type and venue (plus free-text search), and a "Record Fish" form to add new catches.
- **Lookup** — two quick lookups: pick a venue to see its most-used bait/gear and most-caught fish, or pick a fish type to see its most-used bait/gear and top venues.
- **Requires Restock** — a quick view of everything marked "Used Up" so it can be replaced.
- **Add Gear** — add new inventory items per category, with autocomplete for known brands/owners/types; any new value you type is registered automatically, no manual setup required.
- **Validations** — manage the Brands, Owners, Float Types, Fish Types, and Venues lists directly: add new values, rename existing ones, or delete them (with a confirmation prompt). Deleting a value is a **soft delete** — it only removes it from the list; any gear or catches that reference it are hidden from every other tab rather than deleted, and reappear automatically if you add the same value back.
- Items can be toggled between **Available** and **Used Up**, and brand/type fields can be edited inline.

## Project structure

```
scripts/
  Code.gs           Apps Script backend — reads/writes the spreadsheet, exposes
                     functions to the client via google.script.run
  Index.html         Page shell/layout, tabs, forms, and modals
  Stylesheet.html    All CSS, inlined into Index via include('Stylesheet')
  JavaScript.html    Client-side logic, inlined into Index via include('JavaScript')
sheet/
  Fishing Example Sheet.xlsx   Example spreadsheet with the expected sheet/column layout
```

## Spreadsheet layout (for reference, or if starting from a blank sheet)

- **Dips / Sprays / Corn / Dough** tabs: columns `Brand | Name | Owner | Status (auto-added)`
- **Floats** tab: columns `Brand | Name | Type | Owner | Status (auto-added)`
- **Validations** tab: `Brands (A) | Owners (B) | Float Types (C) | Fish Types (D) | Venues (E)` — these columns feed the dropdown/autocomplete options in the Add Gear and Record Fish forms, and are managed from the app's **Validations** tab (values also register themselves automatically as they're used, and gear/catches referencing a value not in these lists are hidden until it's added — see Notes)
- **Fishes Caught** tab: `Fish Type | Fish Weight | Where | Date | Owner | dips | floats | corn | sprays | dough`

"Quantity" is simply the number of matching rows per owner/category — there's no dedicated quantity column. The `Status` column on each gear tab is created automatically (as the next free column) the first time an item is marked used up, so you don't need to add it yourself.

## Notes

- The "used" columns on the Fishes Caught tab can hold multiple bait/gear names separated by commas or semicolons; blank, `0`, `-`, `none`, or `n/a` all mean "nothing used."
- Matching a fish catch back to inventory items is by **Name only** (case-insensitive, trimmed) — if the same name exists under multiple owners in a category, a catch referencing that name will show against all of them, since the sheet doesn't record whose specific item was used.
- Deleting a value on the **Validations** tab is a **soft delete**: it only removes that value from its list, never any gear/catch rows. Anything referencing the deleted value (e.g. an owner's gear, once that owner is deleted) is hidden from the app rather than removed, and reappears automatically the moment the same value is added back.

## License

MIT, with the [Commons Clause](https://commonsclause.com/) — see [LICENSE](LICENSE). In short: anyone can freely use, copy, modify, and share this project, but selling it, sublicensing it, or offering it as a paid product/service is reserved to the copyright holder. Commercial licensing (including royalty arrangements) is available on request — see [AUTHORS.md](AUTHORS.md) for contact info.

*(This isn't legal advice — if you need this enforced, have a lawyer review it for your situation.)*
