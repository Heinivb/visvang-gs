# Visvang Inventory 🎣

A Google Apps Script web app for tracking a fishing crew's shared gear inventory — dips, sprays, mielies, floats, and deegies — plus a log of fish caught and which bait combo caught them.

The app runs entirely on top of a Google Sheet (see [`sheet/Visvang Example Sheet.xlsx`](sheet/Visvang%20Example%20Sheet.xlsx) for the expected layout) with a custom web UI served via `doGet`.

## Features

- **Browse** — filter all inventory items by owner, category, brand, or whether they've caught fish, with a text search.
- **Stats** — an owner × category quantity matrix, crowning who owns the most of each category.
- **Visse Gevang (Fish Caught)** — a log of every catch (date, fish type, weight, venue, angler) with the bait/gear combo used, and a "Record Fish" form to add new catches.
- **Restock** — a quick view of everything marked "Used Up" so it can be replaced.
- **Add Entry** — add new inventory items per category, with autocomplete for known brands/owners/types pulled from the sheet's `Validations` tab.
- Items can be toggled between **Available** and **Used Up**, and brand/type fields can be edited inline.

## Project structure

```
scripts/
  Code.gs          Apps Script backend — reads/writes the spreadsheet, exposes
                    functions to the client via google.script.run
  Index.html        Page shell/layout, tabs, forms, and modals
  Stylesheet.html    All CSS, inlined into Index via include('Stylesheet')
  JavaScript.html    Client-side logic, inlined into Index via include('JavaScript')
sheet/
  Visvang Example Sheet.xlsx   Example spreadsheet with the expected sheet/column layout
```

## Expected spreadsheet layout

- **Dips / Sprays / Mielies / Deegies**: `Brand | Name | Owner | Status (auto-added)`
- **Floats**: `Brand | Name | Type | Owner | Status (auto-added)`
- **Validations**: `Brands (A) | Mense/Owners (B) | Float Types (C) | Fish Types (D) | Venues (E)` — dropdown option sources for the Add Entry and Record Fish forms
- **Visse Gevang** (Fish Caught): `Date | Fish Type | Weight (kg) | Caught By | Venue | Dips | Sprays | Mielies | Floats | Deegies | Notes (optional)`

"Quantity" is simply the number of matching rows per owner/category — there's no dedicated quantity column. The `Status` column is created automatically (as the next free column) the first time an item is marked used up.

## Setup

1. Create a Google Sheet using the layout above (or copy [`sheet/Visvang Example Sheet.xlsx`](sheet/Visvang%20Example%20Sheet.xlsx) into Google Sheets).
2. Populate the **Validations** sheet, especially the **Mense** (owners) column (B) — this drives the owner dropdowns/autocomplete in the Add Entry and Record Fish forms, so it should be filled in with everyone in the crew before first use.
3. Open **Extensions → Apps Script** from that sheet.
4. Create `Code.gs`, `Index.html`, `Stylesheet.html`, and `JavaScript.html`, and paste in the contents of the matching files from [`scripts/`](scripts/).
5. Deploy as a **Web app** (Execute as: yourself, Access: anyone with the link, or restrict as needed).
6. Open the deployed URL to use the app.

## Notes

- Fish catch "used" columns can hold multiple bait/gear names separated by commas or semicolons; blank, `0`, `-`, `none`, or `n/a` all mean "nothing used."
- Matching a fish catch back to inventory items is by **Name only** (case-insensitive, trimmed) — if the same name exists under multiple owners in a category, a catch referencing that name will show against all of them, since the sheet doesn't record whose specific item was used.
- Some UI text (form labels, messages) is in Afrikaans, matching the original crew's usage.
