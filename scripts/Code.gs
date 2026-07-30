/**
 * Visvang Inventory — Apps Script backend
 *
 * Sheet layout expected (header row 1, data from row 2):
 *   Dips, Sprays, Mielies, Deegies : Brand | Name | Owner | (Status - auto-added)
 *   Floats                        : Brand | Name | Type | Owner | (Status - auto-added)
 *   Validations                   : Brands (col A) | Mense (col B) | Float Types (col C) | Fish Types (col D) | Venues (col E)

 *   Fish Caught:   Date | Fish Type | Weight (kg) | Caught By | Venue | Dips | Sprays | Mielies | Floats | Deegies | Notes (optional)
 *
 * "Quantity" = number of matching rows. There is no dedicated qty column —
 * each row represents one item a person has, so counting rows per
 * owner/category is the quantity.
 *
 * "Status" is auto-added as the next free column on each category sheet
 * the first time it's needed (see ensureStatusColumn_). Values are
 * "Available" (default/blank) or "Used Up".
 *
 * Fish Caught: the "X used" columns can hold multiple item names
 * separated by commas or semicolons (or be blank/"0"/"-"/"none" for
 * none). Matching against inventory items is by Name only (case-
 * insensitive, trimmed) — if the same Name exists under more than one
 * owner in a category, a fish catch entry referencing that name will
 * show up against all of them, since the sheet doesn't record which
 * owner's copy was used.
 */

// Category names used throughout the UI. Matched against actual sheet
// names with whitespace trimmed, since some tabs have trailing spaces
// (e.g. "Dips ").
const VALIDATION_SHEET = 'Validations';

const VALIDATION_COLUMNS = {
  BRANDS: 1,
  OWNERS: 2,
  FLOAT_TYPES: 3,
  FISH_TYPES: 4,
  VENUES: 5
};
const CATEGORIES = ['Dips', 'Sprays', 'Mielies', 'Floats', 'Deegies'];

const FISH_SHEET_NAME = 'Visse Gevang';

// Keywords used to locate each category's column in the Visse Gevang
// sheet by header text, so exact column order/spacing doesn't matter.
const FISH_COLUMN_KEYWORDS = {
  Dips: 'dip',
  Floats: 'float',
  Mielies: 'mielie',
  Sprays: 'spray',
  Deegies: 'deeg'
};

/**
 * Gets the Validations sheet.
 * @return {Sheet} The Validations sheet.
 */
function getValidationSheet_() {
  return SpreadsheetApp.getActive().getSheetByName(VALIDATION_SHEET);
}

/**
 * Reads a column of the Validations sheet into a sorted list of unique,
 * trimmed, non-empty values.
 * @param {number} column - 1-based column index on the Validations sheet.
 * @return {Array<string>} Sorted, deduplicated values.
 */
function getValidationList_(column) {
  const sheet = getValidationSheet_();

  const values = sheet
    .getRange(2, column, Math.max(sheet.getLastRow() - 1, 1))
    .getValues()
    .flat()
    .map(v => String(v).trim())
    .filter(v => v);

  return [...new Set(values)].sort();
}

/**
 * Appends a value to a Validations column if it isn't already present
 * (case-insensitive).
 * @param {number} column - 1-based column index on the Validations sheet.
 * @param {string} value - Value to add.
 * @return {void}
 */
function addValidationValue_(column, value) {

  value = String(value || "").trim();

  if (!value) return;

  const sheet = getValidationSheet_();

  const existing = getValidationList_(column)
    .map(v => v.toLowerCase());

  if (existing.includes(value.toLowerCase())) return;

  sheet.appendRow(
    Array(column - 1)
      .fill("")
      .concat(value)
  );
}
/**
 * Serves the web app HTML.
 * @param {Object} e - Apps Script event object (unused).
 * @return {HtmlOutput}
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Visvang Inventory')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes another HTML file's content inline (for CSS/JS partials).
 * @param {string} filename - Name of the HTML file to include.
 * @return {string} Raw file content.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Finds the actual sheet object for a category, tolerant of trailing
 * whitespace in the tab name.
 * @param {string} category - One of CATEGORIES.
 * @return {Sheet} The matching sheet.
 */
function getSheetByCategory_(category) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheets().find(function (s) {
    return s.getName().trim() === category.trim();
  });
  if (!sheet) {
    throw new Error('Could not find a sheet for category "' + category + '"');
  }
  return sheet;
}

/**
 * Finds the "Status" column on a category sheet, creating it (in the next
 * free column, with header "Status") the first time it's needed. Once
 * created it's found on subsequent calls, not re-created.
 * @param {Sheet} sheet - A category sheet.
 * @return {number} 1-based column index of the Status column.
 */
function ensureStatusColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return (h || '').toString().trim().toLowerCase(); });

  const existingIdx = headers.indexOf('status');
  if (existingIdx !== -1) return existingIdx + 1;

  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue('Status');
  return newCol;
}

/**
 * Reads and normalizes all rows for a single category sheet.
 * @param {string} category - One of CATEGORIES.
 * @return {Array<Object>} Array of {rowIndex, category, brand, name, type, owner, status, usedUp}.
 */
function readCategorySheet_(category) {
  const sheet = getSheetByCategory_(category);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const isFloats = category === 'Floats';
  const baseCols = isFloats ? 4 : 3;
  const statusCol = ensureStatusColumn_(sheet);
  const numCols = Math.max(baseCols, statusCol);
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  const result = [];
  values.forEach(function (row, i) {
    const brand = (row[0] || '').toString().trim();
    const name = (row[1] || '').toString().trim();
    const type = isFloats ? (row[2] || '').toString().trim() : '';
    const owner = (isFloats ? row[3] : row[2] || '').toString().trim();
    const statusRaw = (row[statusCol - 1] || '').toString().trim();
    const status = statusRaw || 'Available';

    // Skip fully blank rows (the sheets are pre-formatted far past the
    // last real entry).
    if (!brand && !name && !owner) return;

    result.push({
      rowIndex: i + 2,
      category: category,
      brand: brand,
      name: name,
      type: type,
      owner: owner,
      status: status,
      usedUp: status.toLowerCase() === 'used up'
    });
  });
  return result;
}

/**
 * Reads every category sheet.
 * @return {Object} Map of category name -> array of item rows.
 */
function getAllData() {
  const data = {};
  CATEGORIES.forEach(function (cat) {
    data[cat] = readCategorySheet_(cat);
  });
  return data;
}

/**
 * Builds the dropdown option lists for the Add Entry form: known brands,
 * owners, and float types — combining the Validations sheet with anything
 * already present in the data (in case Validations is incomplete).
 * @return {Object} {brands: string[], owners: string[], floatTypes: string[]}
 */
function getValidations() {

  return {
    brands: getValidationList_(VALIDATION_COLUMNS.BRANDS),
    owners: getValidationList_(VALIDATION_COLUMNS.OWNERS),
    floatTypes: getValidationList_(VALIDATION_COLUMNS.FLOAT_TYPES),
    fishTypes: getValidationList_(VALIDATION_COLUMNS.FISH_TYPES),
    venues: getValidationList_(VALIDATION_COLUMNS.VENUES)
  };

}

/**
 * Adds a venue to the Validations sheet if it's not already known.
 * @param {string} venue - Venue name.
 * @return {void}
 */
function saveVenueIfNew_(venue) {

  addValidationValue_(
    VALIDATION_COLUMNS.VENUES,
    venue
  );

}

/**
 * Appends a new fish catch entry to the Visse Gevang sheet, recording any
 * new venue/fish type into the Validations sheet along the way.
 * @param {Object} catchData - {fishType, weight, where, date, owner, dips, floats, mielies, sprays, deegies}.
 * @return {boolean} true on success.
 */
function saveFishCatch(catchData) {

  const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);

  saveVenueIfNew_(catchData.where);
  addValidationValue_(
    VALIDATION_COLUMNS.FISH_TYPES,
    catchData.fishType
  );
  sheet.appendRow([
    catchData.fishType,
    catchData.weight,
    catchData.where,
    catchData.date,
    catchData.owner,
    JSON.stringify(catchData.dips || []),
    JSON.stringify(catchData.floats || []),
    JSON.stringify(catchData.mielies || []),
    JSON.stringify(catchData.sprays || []),
    JSON.stringify(catchData.deegies || [])
  ]);

  return true;

}

/**
 * Checks whether an item with the same Brand + Name already exists for
 * the same Owner in a category (case-insensitive, trimmed). Used to
 * block accidental duplicate entries.
 * @param {string} category - One of CATEGORIES.
 * @param {string} brand - Brand to check.
 * @param {string} name - Name to check.
 * @param {string} owner - Owner to check.
 * @return {boolean} true if a matching item already exists.
 */
function itemExists_(category, brand, name, owner) {
  const items = readCategorySheet_(category);
  const nameLower = (name || '').toString().trim().toLowerCase();
  const brandLower = (brand || '').toString().trim().toLowerCase();
  const ownerLower = (owner || '').toString().trim().toLowerCase();

  return items.some(function (it) {
    return (it.owner || '').trim().toLowerCase() === ownerLower &&
      (it.name || '').trim().toLowerCase() === nameLower &&
      (it.brand || '').trim().toLowerCase() === brandLower;
  });
}

/**
 * Appends a new inventory entry to the correct category sheet.
 * @param {Object} entry - {category, brand, name, type, owner}.
 * @return {Object} {success: boolean}
 */
function addEntry(entry) {
  if (CATEGORIES.indexOf(entry.category) === -1) {
    throw new Error('Onbekende kategorie: ' + entry.category);
  }
  const name = (entry.name || '').toString().trim();
  const owner = (entry.owner || '').toString().trim();
  const brand = (entry.brand || '').toString().trim();
  const type = (entry.type || '').toString().trim();

  if (!name) throw new Error('Naam is verpligtend.');
  if (!owner) throw new Error('Eienaar is verpligtend.');

  if (itemExists_(entry.category, brand, name, owner)) {
    throw new Error(
      (brand || "") + " - " + (name || '') + ' bestaan reeds vir ' + owner + ' onder ' + entry.category + '.'
    );
  }

  const sheet = getSheetByCategory_(entry.category);
  if (entry.category === 'Floats') {
    sheet.appendRow([brand, name, type, owner]);
  } else {
    sheet.appendRow([brand, name, owner]);
  }

  return { success: true };
}

/**
 * Marks an item as used up (out of stock) or available again.
 * @param {string} category - One of CATEGORIES.
 * @param {number} rowIndex - The sheet row number (as returned by getAllData).
 * @param {boolean} usedUp - true to mark used up, false to mark available.
 * @return {Object} {success: boolean, status: string}
 */
function setItemStatus(category, rowIndex, usedUp) {
  if (CATEGORIES.indexOf(category) === -1) {
    throw new Error('Unknown category: ' + category);
  }
  const sheet = getSheetByCategory_(category);
  const statusCol = ensureStatusColumn_(sheet);
  const value = usedUp ? 'Used Up' : 'Available';
  sheet.getRange(rowIndex, statusCol).setValue(value);
  return { success: true, status: value };
}

/**
 * Builds an owner x category count matrix (the "quantity" comparison).
 * @return {Object} {
 *   owners: string[],
 *   categories: string[],
 *   counts: Object (owner -> category -> count),
 *   totals: Object (owner -> total count)
 * }
 */
function getSummary() {
  const data = getAllData();
  const counts = {};
  const totals = {};
  const ownersSeen = new Set();

  CATEGORIES.forEach(function (cat) {
    data[cat].forEach(function (item) {
      const owner = item.owner || 'Unknown';
      ownersSeen.add(owner);
      if (!counts[owner]) counts[owner] = {};
      counts[owner][cat] = (counts[owner][cat] || 0) + 1;
      totals[owner] = (totals[owner] || 0) + 1;
    });
  });

  return {
    owners: Array.from(ownersSeen).sort(),
    categories: CATEGORIES,
    counts: counts,
    totals: totals
  };
}

/**
 * Splits a Fish Caught "X used" cell into individual item names.
 * Handles comma/semicolon separated lists; treats blank, "0", "-",
 * "none", "n/a" as "nothing used".
 * @param {*} raw - Raw cell value.
 * @return {Array<string>} Trimmed item names, no empties.
 */
function splitMultiValue_(raw) {
  const str = (raw || '').toString();
  if (!str.trim()) return [];
  return str.split(/[,;]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) {
      return s && !/^(0|-|none|n\/a|na)$/i.test(s);
    });
}

/**
 * Finds a column index (0-based) in a header row whose text contains the
 * given keyword, case-insensitively.
 * @param {Array<string>} lowerHeaders - Header row, already lowercased/trimmed.
 * @param {string} keyword - Keyword to search for.
 * @return {number} 0-based column index, or -1 if not found.
 */
function findHeaderCol_(lowerHeaders, keyword) {
  for (let i = 0; i < lowerHeaders?.length; i++) {
    if (lowerHeaders[i].indexOf(keyword) !== -1) return i;
  }
  return -1;
}
/**
 * Manual test helper: logs the fish catch index to the Apps Script logger.
 * @return {void}
 */
function testFishIndex() {
  var idx = getFishCatchIndex();
  Logger.log(JSON.stringify(idx));
}
/**
 * Reads the Fish Caught sheet and builds an index of which inventory
 * items were used in which catches, so the UI can show "caught with
 * this" indicators without scanning the whole sheet client-side.
 *
 * @return {Object} categories -> { itemNameLower: [catchEntry, ...] }
 *   where catchEntry = {
 *     rowIndex, fishType, weight,
 *     combo: { category -> [itemNames used in that same catch] }
 *   }
 */
function getFishCatchIndex() {

  const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);

  const values = sheet.getDataRange().getValues();

  values.shift();
Logger.log(values[0]);
  const index = {
    Dips:{},
    Sprays:{},
    Mielies:{},
    Floats:{},
    Deegies:{}
  };

  values.forEach(function(row){

    const catchEntry = {

      fishType: row[0],
      weight: row[1],
      where: row[2],
      date: Utilities.formatDate(
        row[3],
        Session.getScriptTimeZone(),
        "yyyy-MM-dd"
      ),
      owner: row[4],

      combo:{
        Dips: parseList_(row[5]),
        Floats: parseList_(row[6]),
        Mielies: parseList_(row[7]),
        Sprays: parseList_(row[8]),
        Deegies: parseList_(row[9])
      }

    };

    Object.keys(catchEntry.combo).forEach(function(category){

      catchEntry.combo[category].forEach(function (item) {

        if (!item) return;

        item = String(item).trim();

        const key = String(item).trim().toLowerCase();

        if (!index[category][key]) {
          index[category][key] = [];
        }

        index[category][key].push(catchEntry);

      });

    });

  });

  return index;

}

/**
 * Parses a Fish Caught "X used" cell value into an array of item names.
 * Accepts a JSON array string, a comma-separated string, or an already-
 * parsed array.
 * @param {*} value - Raw cell value.
 * @return {Array<string>} Parsed item names.
 */
function parseList_(value){

  if(!value) return [];

  if(Array.isArray(value)) return value;

  try{

    return JSON.parse(value);

  }catch(e){

    return String(value)
      .split(",")
      .map(s=>s.trim())
      .filter(Boolean);

  }

}

/**
 * Reads and normalizes every row of the Visse Gevang (Fish Caught) sheet.
 * @return {Array<Object>} Array of {fishType, weight, where, date, owner, dips, floats, mielies, sprays, deegies}.
 */
function getFishCatches() {

  const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);

  const values = sheet.getDataRange().getValues();

  values.shift();

  return values.map(function (r) {

    return {
      fishType: String(r[0] || ""),
      weight: Number(r[1] || 0),
      where: String(r[2] || ""),
      date: r[3]
        ? Utilities.formatDate(r[3], Session.getScriptTimeZone(), "yyyy-MM-dd")
        : "",
      owner: String(r[4] || ""),

      dips: parseList_(r[5]),
      floats: parseList_(r[6]),
      mielies: parseList_(r[7]),
      sprays: parseList_(r[8]),
      deegies: parseList_(r[9])
    };

  });

}

/**
 * Updates a single editable field ("brand" or "type") on an inventory
 * item's row, recording any new brand/type into the Validations sheet.
 * @param {string} category - One of CATEGORIES.
 * @param {number} rowIndex - The sheet row number.
 * @param {string} field - "brand" or "type".
 * @param {string} value - New value.
 * @return {boolean} true on success.
 */
function updateItemField(category, rowIndex, field, value) {

  const sheet = getSheetByCategory_(category);

  value = String(value || "").trim();

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const headerLookup = {};

  headers.forEach(function(h, i) {
    headerLookup[String(h).trim().toLowerCase()] = i + 1;
  });

  let column = null;

  switch (field) {

    case "brand":
      column = headerLookup["brand"];
      break;

    case "type":
      column =
        headerLookup["type"] ||
        headerLookup["float type"];
      break;

    default:
      throw new Error("Invalid field");

  }

  if (!column) {
    throw new Error(field + " column not found.");
  }

  sheet.getRange(rowIndex, column).setValue(value);

  if (field === "brand") {
    addValidationValue_(VALIDATION_COLUMNS.BRANDS, value);
  }

  if (field === "type") {
    addValidationValue_(VALIDATION_COLUMNS.FLOAT_TYPES, value);
  }

  return true;

}