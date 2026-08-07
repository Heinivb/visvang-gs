/**
 * Fishing Inventory — Apps Script backend
 *
 * Sheet layout expected (header row 1, data from row 2):
 *   Dips, Sprays, Corn, Dough     : Brand | Name | Owner | (Status - auto-added)
 *   Floats                        : Brand | Name | Type | Owner | (Status - auto-added)
 *   Validations                   : Brands (col A) | People (col B) | Float Types (col C) | Fish Types (col D) | Venues (col E)

 *   Fish Caught:   Fish Type | Weight (kg) | Venue | Date | Caught By | Dips | Sprays | Corn | Floats | Dough | Photo (Drive file ID)
 *
 * Fish Caught's Photo column holds the Drive file ID of an optional
 * uploaded photo (blank if none). Photos are uploaded to the folder
 * configured on the Settings tab (see PHOTO_FOLDER_PROPERTY /
 * getPhotoFolderId_); each one inherits that folder's own sharing
 * settings, which is why the folder needs to be shared "Anyone with the
 * link: Viewer" itself — see resolveFishCatchPhoto_. This app never
 * deletes/trashes a photo from Drive on its own — also see
 * resolveFishCatchPhoto_.
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
const CATEGORIES = ['Dips', 'Sprays', 'Corn', 'Floats', 'Dough'];

// Maps the field names used by the client's Validations tab to the
// Validations sheet column they live in.
const VALIDATION_FIELDS = {
  brands: VALIDATION_COLUMNS.BRANDS,
  owners: VALIDATION_COLUMNS.OWNERS,
  floatTypes: VALIDATION_COLUMNS.FLOAT_TYPES,
  fishTypes: VALIDATION_COLUMNS.FISH_TYPES,
  venues: VALIDATION_COLUMNS.VENUES
};

const FISH_SHEET_NAME = 'Fishes Caught';

// Keywords used to locate each category's column in the Fishes Caught
// sheet by header text, so exact column order/spacing doesn't matter.
const FISH_COLUMN_KEYWORDS = {
  Dips: 'dip',
  Floats: 'float',
  Corn: 'corn',
  Sprays: 'spray',
  Dough: 'dough'
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
    .map(cellValue => String(cellValue).trim())
    .filter(cellValue => cellValue);

  return [...new Set(values)].sort();
}

/**
 * Adds a value to a Validations column if it isn't already present
 * (case-insensitive), writing it into that column's own first empty row.
 * @param {number} column - 1-based column index on the Validations sheet.
 * @param {string} value - Value to add.
 * @return {void}
 */
function addValidationValue_(column, value) {

  value = String(value || "").trim();

  if (!value) return;

  const sheet = getValidationSheet_();

  const existing = getValidationList_(column)
    .map(existingValue => existingValue.toLowerCase());

  if (existing.includes(value.toLowerCase())) return;

  // Each Validations column is an independent list, so "the next free
  // row" has to be found within this specific column — not via
  // sheet.appendRow(), which appends after the sheet's overall last row
  // (governed by whichever column happens to be the longest). Using
  // appendRow() here left a gap of blank rows in every shorter column
  // each time a value was added to a longer one.
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const columnValues = sheet
    .getRange(2, column, Math.max(lastRow - 1, 1))
    .getValues()
    .flat();

  let blankOffset = columnValues.findIndex(columnValue => !String(columnValue || "").trim());
  if (blankOffset === -1) blankOffset = columnValues.length;

  sheet.getRange(2 + blankOffset, column).setValue(value);
}

/**
 * Resolves a client-facing Validations field name ("brands", "owners",
 * "floatTypes", "fishTypes", "venues") to its sheet column, throwing if
 * the field name isn't recognized.
 * @param {string} field - One of the VALIDATION_FIELDS keys.
 * @return {number} 1-based column index on the Validations sheet.
 */
function getValidationColumn_(field) {
  const column = VALIDATION_FIELDS[field];
  if (!column) {
    throw new Error('Unknown validations field: ' + field);
  }
  return column;
}

/**
 * Adds a new value to a Validations list from the Validations tab's "Add"
 * form. Thin wrapper around addValidationValue_ that also validates the
 * field name and the value itself.
 * @param {string} field - One of the VALIDATION_FIELDS keys.
 * @param {string} value - Value to add.
 * @return {Object} {success: boolean}
 */
function addValidationEntry(field, value) {
  try {
    const column = getValidationColumn_(field);

    value = String(value || '').trim();
    if (!value) {
      throw new Error('Value is required.');
    }

    addValidationValue_(column, value);
    return { success: true };
  } catch (error) {
    console.error('[Code.gs/addValidationEntry]', error);
    throw error;
  }
}

/**
 * Renames an existing Validations value in place (same row, same column —
 * no shifting needed), then cascades the rename to every gear/catch row
 * that referenced the old value, so nothing gets silently orphaned by a
 * rename the way a delete deliberately orphans things (see
 * deleteValidationEntry — rename and delete behave differently on
 * purpose: a delete is meant to hide, a rename is meant to relabel
 * everything that used the old name).
 * @param {string} field - One of the VALIDATION_FIELDS keys.
 * @param {string} oldValue - Existing value to rename.
 * @param {string} newValue - New text for that value.
 * @return {Object} {success: boolean}
 */
function updateValidationEntry(field, oldValue, newValue) {
  try {
    const column = getValidationColumn_(field);

    newValue = String(newValue || '').trim();
    if (!newValue) {
      throw new Error('Value is required.');
    }

    const sheet = getValidationSheet_();
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(2, column, Math.max(lastRow - 1, 1));
    const values = range.getValues().map(row => String(row[0] || '').trim());

    const oldLower = String(oldValue || '').trim().toLowerCase();
    const rowOffset = values.findIndex(existingValue => existingValue.toLowerCase() === oldLower);
    if (rowOffset === -1) {
      throw new Error('"' + oldValue + '" was not found.');
    }

    const newLower = newValue.toLowerCase();
    const isDuplicate = values.some((existingValue, existingIndex) =>
      existingIndex !== rowOffset && existingValue.toLowerCase() === newLower);
    if (isDuplicate) {
      throw new Error('"' + newValue + '" already exists.');
    }

    sheet.getRange(2 + rowOffset, column).setValue(newValue);
    cascadeValidationRename_(field, oldValue, newValue);

    return { success: true };
  } catch (error) {
    console.error('[Code.gs/updateValidationEntry]', error);
    throw error;
  }
}

/**
 * Propagates a Validations rename to every gear/catch row that referenced
 * the old value, so e.g. renaming a brand relabels every item that had
 * the old brand name instead of leaving them pointing at text that no
 * longer exists in Validations.
 * @param {string} field - One of the VALIDATION_FIELDS keys.
 * @param {string} oldValue - Value being replaced.
 * @param {string} newValue - Replacement value.
 * @return {void}
 */
function cascadeValidationRename_(field, oldValue, newValue) {
  switch (field) {
    case 'owners':
      renameGearColumnValue_('owner', oldValue, newValue);
      renameFishColumnValue_('owner', oldValue, newValue);
      break;
    case 'brands':
      renameGearColumnValue_('brand', oldValue, newValue);
      break;
    case 'floatTypes':
      renameGearColumnValue_('type', oldValue, newValue, ['Floats']);
      break;
    case 'fishTypes':
      renameFishColumnValue_('fishType', oldValue, newValue);
      break;
    case 'venues':
      renameFishColumnValue_('where', oldValue, newValue);
      break;
  }
}

/**
 * Renames every occurrence of a value (case-insensitive, trimmed) in one
 * column of one or more gear category sheets, found by matching the
 * column's header text.
 * @param {string} field - "brand", "owner", or "type" (matched against each sheet's header row; "type" also matches "float type").
 * @param {string} oldValue - Value to replace.
 * @param {string} newValue - Replacement value.
 * @param {Array<string>} [categories] - Categories to update (defaults to all of CATEGORIES).
 * @return {void}
 */
function renameGearColumnValue_(field, oldValue, newValue, categories) {
  const oldLower = oldValue.toLowerCase();
  const headerNames = field === 'type' ? ['type', 'float type'] : [field];

  (categories || CATEGORIES).forEach(function (category) {
    const sheet = getSheetByCategory_(category);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(headerCell => String(headerCell || '').trim().toLowerCase());

    let column = -1;
    for (const name of headerNames) {
      const headerIndex = headers.indexOf(name);
      if (headerIndex !== -1) { column = headerIndex + 1; break; }
    }
    if (column === -1) return;

    const range = sheet.getRange(2, column, lastRow - 1);
    const values = range.getValues();
    let changed = false;

    values.forEach(function (row) {
      if (String(row[0] || '').trim().toLowerCase() === oldLower) {
        row[0] = newValue;
        changed = true;
      }
    });

    if (changed) range.setValues(values);
  });
}

/**
 * Renames every occurrence of a value (case-insensitive, trimmed) in one
 * column of the Fishes Caught sheet.
 * @param {string} field - "owner", "fishType", or "where".
 * @param {string} oldValue - Value to replace.
 * @param {string} newValue - Replacement value.
 * @return {void}
 */
function renameFishColumnValue_(field, oldValue, newValue) {
  // 1-based sheet columns on the Fishes Caught sheet: 1 = Fish Type,
  // 3 = Venue, 5 = Caught By (2 = Weight and 4 = Date are skipped since
  // neither is ever renamed via Validations).
  const columnByField = { fishType: 1, where: 3, owner: 5 };
  const column = columnByField[field];
  if (!column) return;

  const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const oldLower = oldValue.toLowerCase();
  const range = sheet.getRange(2, column, lastRow - 1);
  const values = range.getValues();
  let changed = false;

  values.forEach(function (row) {
    if (String(row[0] || '').trim().toLowerCase() === oldLower) {
      row[0] = newValue;
      changed = true;
    }
  });

  if (changed) range.setValues(values);
}

/**
 * Removes a value from a Validations list only — it does not touch the
 * gear/catch sheets that may reference it. This is a deliberate soft
 * delete: e.g. deleting an owner just removes them from the Owners list,
 * so their existing gear/catches (which the frontend hides once the owner
 * is no longer a recognized value) come back automatically if the same
 * owner name is added again later, with nothing to manually restore.
 * @param {string} field - One of the VALIDATION_FIELDS keys.
 * @param {string} value - Value to remove.
 * @return {Object} {success: boolean}
 */
function deleteValidationEntry(field, value) {
  try {
    const column = getValidationColumn_(field);

    const sheet = getValidationSheet_();
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(2, column, Math.max(lastRow - 1, 1));
    const values = range.getValues().map(row => String(row[0] || '').trim());

    const targetLower = String(value || '').trim().toLowerCase();
    const remaining = values.filter(existingValue => existingValue.toLowerCase() !== targetLower);
    if (remaining.length === values.length) {
      throw new Error('"' + value + '" was not found.');
    }

    // Rewrite the column: remaining values shifted up, padded with blanks
    // so the row the removed value used to occupy is cleared. The other
    // Validations columns are untouched — each column is an independent
    // list, not a per-row record, so this can't disturb them.
    const padding = Array(values.length - remaining.length).fill('');
    const newColumn = remaining.concat(padding).map(remainingValue => [remainingValue]);
    range.setValues(newColumn);

    return { success: true };
  } catch (error) {
    console.error('[Code.gs/deleteValidationEntry]', error);
    throw error;
  }
}

/**
 * Serves the web app HTML.
 * @param {Object} requestEvent - Apps Script event object (unused).
 * @return {HtmlOutput}
 */
function doGet(requestEvent) {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Fishing Inventory')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    console.error('[Code.gs/doGet]', error);
    // doGet must always return an HtmlOutput (throwing here would just
    // show Apps Script's generic error page with no explanation), so the
    // error is logged for debugging and a plain message is shown instead.
    return HtmlService.createHtmlOutput('Something went wrong loading the app. Please try again shortly.');
  }
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
  const sheet = ss.getSheets().find(function (candidateSheet) {
    return candidateSheet.getName().trim() === category.trim();
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
    .map(function (headerCell) { return (headerCell || '').toString().trim().toLowerCase(); });

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
  values.forEach(function (row, rowOffset) {
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
      // +2: rowOffset is 0-based and counts from the first data row, but
      // the sheet is 1-based and row 1 is the header — so data row 0 is
      // actually sheet row 2.
      rowIndex: rowOffset + 2,
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
  try {
    const data = {};
    CATEGORIES.forEach(function (category) {
      data[category] = readCategorySheet_(category);
    });
    return data;
  } catch (error) {
    console.error('[Code.gs/getAllData]', error);
    throw error;
  }
}

/**
 * Builds the dropdown option lists for the Add Gear form: known brands,
 * owners, and float types — combining the Validations sheet with anything
 * already present in the data (in case Validations is incomplete).
 * @return {Object} {brands: string[], owners: string[], floatTypes: string[]}
 */
function getValidations() {
  try {
    return {
      brands: getValidationList_(VALIDATION_COLUMNS.BRANDS),
      owners: getValidationList_(VALIDATION_COLUMNS.OWNERS),
      floatTypes: getValidationList_(VALIDATION_COLUMNS.FLOAT_TYPES),
      fishTypes: getValidationList_(VALIDATION_COLUMNS.FISH_TYPES),
      venues: getValidationList_(VALIDATION_COLUMNS.VENUES)
    };
  } catch (error) {
    console.error('[Code.gs/getValidations]', error);
    throw error;
  }
}


// Document property key the selected photo-storage folder's Drive ID is
// saved under. A document property is bound to this spreadsheet, so
// every user of the app shares the same folder setting.
const PHOTO_FOLDER_PROPERTY = 'photoFolderId';

/**
 * Reads the currently configured photo-storage folder's Drive ID.
 * @return {string} Folder ID, or '' if none has been set.
 */
function getPhotoFolderId_() {
  return PropertiesService.getDocumentProperties().getProperty(PHOTO_FOLDER_PROPERTY) || '';
}

/**
 * Manual test helper: unconditionally touches DriveApp, so running this
 * one function directly in the Apps Script editor (function dropdown
 * next to Run) reliably triggers Drive's authorization prompt if it
 * hasn't been granted yet — unlike getPhotoFolderInfo()/setPhotoFolder(),
 * which can return early without ever calling DriveApp (e.g. no folder
 * saved yet), leaving the prompt untriggered. Logs the account's Drive
 * root folder name on success. Safe to run any time; makes no changes.
 * @return {void}
 */
function testDriveAccess_() {
  Logger.log(DriveApp.getRootFolder().getName());
}

/**
 * Reads the currently configured photo-storage folder, for display on the
 * Settings tab.
 * @return {Object} {folderId, folderName, folderUrl} — all '' if unset, or {folderId, error} if the saved folder can no longer be reached.
 */
function getPhotoFolderInfo() {
  const folderId = getPhotoFolderId_();
  if (!folderId) {
    return { folderId: '', folderName: '', folderUrl: '' };
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    return { folderId: folderId, folderName: folder.getName(), folderUrl: folder.getUrl() };
  } catch (error) {
    console.error('[Code.gs/getPhotoFolderInfo]', error);
    return {
      folderId: folderId,
      folderName: '',
      folderUrl: '',
      error: 'Could not open the configured folder (ID "' + folderId + '"): ' + error.message
    };
  }
}

/**
 * Sets (or clears) the Drive folder that fish-catch photos get uploaded
 * to, from a pasted folder URL or a raw folder ID.
 * @param {string} folderUrlOrId - A Drive folder URL/ID, or '' to clear the setting.
 * @return {Object} {success: boolean, folderId, folderName, folderUrl} on set, {success: boolean, cleared: true} on clear.
 */
function setPhotoFolder(folderUrlOrId) {
  const input = String(folderUrlOrId || '').trim();

  if (!input) {
    PropertiesService.getDocumentProperties().deleteProperty(PHOTO_FOLDER_PROPERTY);
    return { success: true, cleared: true };
  }

  // Pull the Drive ID out of a pasted folder URL: Drive IDs are long runs
  // of letters/digits/hyphens/underscores, so the first such run of a
  // reasonable length is taken as the ID — this also means a bare ID
  // (no URL) passes through unchanged.
  const idMatch = input.match(/[-\w]{15,}/);
  const folderId = idMatch ? idMatch[0] : input;

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (error) {
    console.error('[Code.gs/setPhotoFolder]', error);
    // Surface Drive's actual error instead of a generic guess — it's
    // usually either a genuinely bad ID, or (the more common case the
    // first time this feature is used) the deployment hasn't been
    // re-authorized for Drive access yet: redeploy a new version and
    // accept the Drive permission prompt, then try again.
    throw new Error('Could not open that folder (ID "' + folderId + '"): ' + error.message);
  }

  PropertiesService.getDocumentProperties().setProperty(PHOTO_FOLDER_PROPERTY, folderId);

  return { success: true, folderId: folderId, folderName: folder.getName(), folderUrl: folder.getUrl() };
}

/**
 * Works out the photo Drive file ID a catch should end up with: uploads a
 * newly attached photo, or leaves an existing photo's ID as-is or clears
 * it (on removal). This app never deletes or trashes a Drive file it
 * didn't just create — replacing or removing a catch's photo, or
 * deleting the catch entirely, only ever changes what the sheet
 * references, never anything in Drive itself. Any old file is left
 * exactly where it was, for the user to clean up manually if they want.
 * Shared by saveFishCatch and updateFishCatch.
 * @param {Object} catchData - {photoBase64, photoMimeType, photoName, existingPhotoFileId, removePhoto}.
 * @return {string} The photo Drive file ID to store on the row ('' for no photo).
 */
function resolveFishCatchPhoto_(catchData) {
  const hasNewPhoto = !!catchData.photoBase64;

  if (!hasNewPhoto && !catchData.removePhoto) {
    return catchData.existingPhotoFileId || '';
  }

  if (!hasNewPhoto) {
    return '';
  }

  const photoFolderId = getPhotoFolderId_();
  if (!photoFolderId) {
    throw new Error('Set a photo folder on the Settings tab before attaching photos.');
  }

  // No explicit setSharing() call here on purpose: a file created inside
  // a folder inherits that folder's sharing settings in Drive. As long as
  // the configured folder itself is shared "Anyone with the link", every
  // photo uploaded into it already is too — setting it per-file was both
  // redundant and, for some folders/accounts, outright rejected by Drive
  // even for the folder's owner.
  const photoFile = DriveApp.getFolderById(photoFolderId).createFile(
    Utilities.newBlob(
      Utilities.base64Decode(catchData.photoBase64),
      catchData.photoMimeType || 'image/jpeg',
      catchData.photoName || 'catch.jpg'
    )
  );

  return photoFile.getId();
}

/**
 * Registers a fish catch's venue/fish type/owner into the Validations
 * sheet if they're new. Shared by saveFishCatch and updateFishCatch.
 * @param {Object} catchData - {fishType, where, owner, ...}.
 * @return {void}
 */
function registerFishCatchValidations_(catchData) {
  addValidationValue_(VALIDATION_COLUMNS.VENUES, catchData.where);
  addValidationValue_(VALIDATION_COLUMNS.FISH_TYPES, catchData.fishType);
  addValidationValue_(VALIDATION_COLUMNS.OWNERS, catchData.owner);
}

/**
 * Builds the Fishes Caught row (column order: Fish Type, Weight, Venue,
 * Date, Owner, then one JSON-array column per gear category) for a catch.
 * Shared by saveFishCatch and updateFishCatch.
 * @param {Object} catchData - {fishType, weight, where, date, owner, dips, floats, corn, sprays, dough}.
 * @return {Array} The row's 10 column values, in sheet order.
 */
function buildFishCatchRow_(catchData) {
  return [
    catchData.fishType,
    catchData.weight,
    catchData.where,
    catchData.date,
    catchData.owner,
    JSON.stringify(catchData.dips || []),
    JSON.stringify(catchData.floats || []),
    JSON.stringify(catchData.corn || []),
    JSON.stringify(catchData.sprays || []),
    JSON.stringify(catchData.dough || [])
  ];
}

/**
 * Confirms a Fishes Caught row index still points at a real data row (not
 * the header, and not past the sheet's current last row — e.g. because
 * the catch was already deleted by someone else).
 * @param {Sheet} sheet - The Fishes Caught sheet.
 * @param {number} rowIndex - 1-based sheet row number to check.
 * @return {void}
 */
function assertFishCatchRowExists_(sheet, rowIndex) {
  if (!Number.isInteger(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
    throw new Error('That catch no longer exists — try refreshing and trying again.');
  }
}

/**
 * Appends a new fish catch entry to the fishes caught sheet, recording any
 * new venue/fish type/owner into the Validations sheet along the way.
 * @param {Object} catchData - {fishType, weight, where, date, owner, dips, floats, corn, sprays, dough}.
 * @return {boolean} true on success.
 */
function saveFishCatch(catchData) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);

    registerFishCatchValidations_(catchData);

    const row = buildFishCatchRow_(catchData);
    row.push(resolveFishCatchPhoto_(catchData));
    sheet.appendRow(row);

    return true;
  } catch (error) {
    console.error('[Code.gs/saveFishCatch]', error);
    throw error;
  }
}

/**
 * Overwrites an existing fish catch entry in place (e.g. to fix the wrong
 * bait/gear having been selected), recording any new venue/fish
 * type/owner into the Validations sheet along the way.
 * @param {number} rowIndex - The sheet row number (as returned by getFishCatches).
 * @param {Object} catchData - {fishType, weight, where, date, owner, dips, floats, corn, sprays, dough}.
 * @return {Object} {success: boolean}
 */
function updateFishCatch(rowIndex, catchData) {
  try {
    rowIndex = Number(rowIndex);
    const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);
    assertFishCatchRowExists_(sheet, rowIndex);

    registerFishCatchValidations_(catchData);

    const row = buildFishCatchRow_(catchData);
    row.push(resolveFishCatchPhoto_(catchData));
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    return { success: true };
  } catch (error) {
    console.error('[Code.gs/updateFishCatch]', error);
    throw error;
  }
}

/**
 * Deletes a fish catch entry.
 * @param {number} rowIndex - The sheet row number (as returned by getFishCatches).
 * @return {Object} {success: boolean}
 */
function deleteFishCatch(rowIndex) {
  try {
    rowIndex = Number(rowIndex);
    const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);
    assertFishCatchRowExists_(sheet, rowIndex);

    sheet.deleteRow(rowIndex);

    return { success: true };
  } catch (error) {
    console.error('[Code.gs/deleteFishCatch]', error);
    throw error;
  }
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
  try {
    if (CATEGORIES.indexOf(entry.category) === -1) {
      throw new Error('Unknown category: ' + entry.category);
    }
    const name = (entry.name || '').toString().trim();
    const owner = (entry.owner || '').toString().trim();
    const brand = (entry.brand || '').toString().trim();
    const type = (entry.type || '').toString().trim();

    if (!name) throw new Error('Name is required.');
    if (!owner) throw new Error('Owner is required.');
    if (!brand) throw new Error('Brand is required.');
    if (entry.category === 'Floats' && !type) throw new Error('Type is required.');

    if (itemExists_(entry.category, brand, name, owner)) {
      throw new Error(
        (brand || "") + " - " + (name || '') + ' already exists for ' + owner + ' under ' + entry.category + '.'
      );
    }

    const sheet = getSheetByCategory_(entry.category);
    if (entry.category === 'Floats') {
      sheet.appendRow([brand, name, type, owner]);
    } else {
      sheet.appendRow([brand, name, owner]);
    }

    registerGearValidations_(entry.category, brand, type, owner);

    return { success: true };
  } catch (error) {
    console.error('[Code.gs/addEntry]', error);
    throw error;
  }
}

/**
 * Auto-registers a gear entry's Owner/Brand/Type (Floats only) into the
 * Validations sheet if they're new, the same way saveFishCatch already
 * registers new venues/fish types. This means values typed into the Add
 * Gear form never need to be added to Validations by hand first.
 * @param {string} category - One of CATEGORIES.
 * @param {string} brand - Brand value (may be blank).
 * @param {string} type - Type value (Floats only; may be blank).
 * @param {string} owner - Owner value.
 * @return {void}
 */
function registerGearValidations_(category, brand, type, owner) {
  addValidationValue_(VALIDATION_COLUMNS.OWNERS, owner);
  addValidationValue_(VALIDATION_COLUMNS.BRANDS, brand);
  if (category === 'Floats') {
    addValidationValue_(VALIDATION_COLUMNS.FLOAT_TYPES, type);
  }
}

/**
 * Marks an item as used up (out of stock) or available again.
 * @param {string} category - One of CATEGORIES.
 * @param {number} rowIndex - The sheet row number (as returned by getAllData).
 * @param {boolean} usedUp - true to mark used up, false to mark available.
 * @return {Object} {success: boolean, status: string}
 */
function setItemStatus(category, rowIndex, usedUp) {
  try {
    if (CATEGORIES.indexOf(category) === -1) {
      throw new Error('Unknown category: ' + category);
    }
    const sheet = getSheetByCategory_(category);
    const statusCol = ensureStatusColumn_(sheet);
    const value = usedUp ? 'Used Up' : 'Available';
    sheet.getRange(rowIndex, statusCol).setValue(value);
    return { success: true, status: value };
  } catch (error) {
    console.error('[Code.gs/setItemStatus]', error);
    throw error;
  }
}

/**
 * Permanently deletes a gear item's row from its category sheet — e.g.
 * for something the owner no longer has and doesn't want to restock. This
 * is a real delete (unlike Validations entries, which are soft-deleted):
 * there's no sheet row left to "add back" and recover.
 * @param {string} category - One of CATEGORIES.
 * @param {number} rowIndex - The sheet row number (as returned by getAllData).
 * @return {Object} {success: boolean}
 */
function deleteGearItem(category, rowIndex) {
  try {
    if (CATEGORIES.indexOf(category) === -1) {
      throw new Error('Unknown category: ' + category);
    }
    rowIndex = Number(rowIndex);

    const sheet = getSheetByCategory_(category);
    if (!Number.isInteger(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
      throw new Error('That item no longer exists — try refreshing and trying again.');
    }

    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (error) {
    console.error('[Code.gs/deleteGearItem]', error);
    throw error;
  }
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
  try {
    const data = getAllData();
    const counts = {};
    const totals = {};
    const ownersSeen = new Set();

    CATEGORIES.forEach(function (category) {
      data[category].forEach(function (item) {
        const owner = item.owner || 'Unknown';
        ownersSeen.add(owner);
        if (!counts[owner]) counts[owner] = {};
        counts[owner][category] = (counts[owner][category] || 0) + 1;
        totals[owner] = (totals[owner] || 0) + 1;
      });
    });

    return {
      owners: Array.from(ownersSeen).sort(),
      categories: CATEGORIES,
      counts: counts,
      totals: totals
    };
  } catch (error) {
    console.error('[Code.gs/getSummary]', error);
    throw error;
  }
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
    .map(function (rawItem) { return rawItem.trim(); })
    .filter(function (trimmedItem) {
      return trimmedItem && !/^(0|-|none|n\/a|na)$/i.test(trimmedItem);
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
  for (let headerIndex = 0; headerIndex < lowerHeaders?.length; headerIndex++) {
    if (lowerHeaders[headerIndex].indexOf(keyword) !== -1) return headerIndex;
  }
  return -1;
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

  }catch(error){

    // Expected, routine fallback — not every "X used" cell is JSON (older
    // rows, or ones edited by hand, are plain comma-separated text), so
    // this isn't logged as an error, just handled.
    return String(value)
      .split(",")
      .map(rawItem=>rawItem.trim())
      .filter(Boolean);

  }

}

/**
 * Reads and normalizes every row of the fishes caught (Fish Caught) sheet.
 * @return {Array<Object>} Array of {rowIndex, fishType, weight, where, date, owner, dips, floats, corn, sprays, dough, photoFileId, photoUrl}.
 */
function getFishCatches() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(FISH_SHEET_NAME);

    const values = sheet.getDataRange().getValues();

    values.shift();

    return values.map(function (row, index) {

      // Column indices below match the Fishes Caught sheet layout
      // documented at the top of this file: 0 = Fish Type, 1 = Weight,
      // 2 = Venue, 3 = Date, 4 = Caught By, 5-9 = one JSON-array column
      // per gear category (Dips/Floats/Corn/Sprays/Dough, in that
      // order), 10 = Photo (Drive file ID).
      const photoFileId = String(row[10] || "");

      return {
        // +2: index is 0-based and counts from the first data row, but the
        // sheet is 1-based and row 1 is the header — so data row 0 is
        // actually sheet row 2.
        rowIndex: index + 2,
        fishType: String(row[0] || ""),
        weight: Number(row[1] || 0),
        where: String(row[2] || ""),
        date: row[3]
          ? Utilities.formatDate(row[3], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : "",
        owner: String(row[4] || ""),

        dips: parseList_(row[5]),
        floats: parseList_(row[6]),
        corn: parseList_(row[7]),
        sprays: parseList_(row[8]),
        dough: parseList_(row[9]),

        photoFileId: photoFileId,
        // Drive's "thumbnail" endpoint, not the older "uc?export=view" one:
        // the latter frequently redirects to an interstitial/confirmation
        // response instead of the raw image when used as an <img> src (it
        // still works fine when a browser navigates straight to it, which
        // is why "open in a new tab" can succeed even when the same URL
        // fails to embed) — "thumbnail" reliably returns actual image
        // bytes instead. Requires the file to be shared "Anyone with the
        // link: Viewer", inherited from the photo-storage folder's own
        // sharing — see resolveFishCatchPhoto_.
        photoUrl: photoFileId ? ('https://drive.google.com/thumbnail?id=' + photoFileId + '&sz=w2000') : ""
      };

    });
  } catch (error) {
    console.error('[Code.gs/getFishCatches]', error);
    throw error;
  }
}

/**
 * Collects distinct, trimmed, non-empty values of one field across one or
 * more gear category sheets.
 * @param {string} field - "brand", "type", or "owner" (matches readCategorySheet_'s row shape).
 * @param {Array<string>} [categories] - Categories to scan (defaults to all of CATEGORIES).
 * @return {Array<string>} Distinct values found.
 */
function collectGearValues_(field, categories) {
  const values = new Set();
  (categories || CATEGORIES).forEach(function (cat) {
    readCategorySheet_(cat).forEach(function (item) {
      const value = (item[field] || '').toString().trim();
      if (value) values.add(value);
    });
  });
  return Array.from(values);
}

/**
 * Collects distinct, trimmed, non-empty values of one field across every
 * row of the Fishes Caught sheet.
 * @param {string} field - "owner", "fishType", or "where" (matches getFishCatches()'s row shape).
 * @return {Array<string>} Distinct values found.
 */
function collectFishValues_(field) {
  const values = new Set();
  getFishCatches().forEach(function (fishCatch) {
    const value = (fishCatch[field] || '').toString().trim();
    if (value) values.add(value);
  });
  return Array.from(values);
}

/**
 * Finds which of candidateValues aren't already present (case-insensitive)
 * in a Validations column, without writing anything.
 * @param {number} column - 1-based column index on the Validations sheet.
 * @param {Array<string>} candidateValues - Values to check.
 * @return {Array<string>} The candidate values that are missing, deduplicated, in their original casing.
 */
function findMissingValidationValues_(column, candidateValues) {
  const existingLower = getValidationList_(column).map(existingValue => existingValue.toLowerCase());
  const seenLower = new Set();
  const missing = [];

  candidateValues.forEach(function (value) {
    const lower = value.toLowerCase();
    if (existingLower.includes(lower) || seenLower.has(lower)) return;
    seenLower.add(lower);
    missing.push(value);
  });

  return missing;
}

/**
 * Scans every gear sheet and the Fishes Caught sheet for Owner/Brand/Float
 * Type/Fish Type/Venue values already in use, and returns whichever ones
 * aren't yet in the Validations sheet, without writing anything. Shared by
 * previewValidationSeed() (read-only) and seedValidationsFromExistingData()
 * (which writes these same values).
 * @return {Object} {owners, brands, floatTypes, fishTypes, venues} — each an array of missing values.
 */
function computeMissingValidationValues_() {
  const ownerValues = collectGearValues_('owner').concat(collectFishValues_('owner'));

  return {
    owners: findMissingValidationValues_(VALIDATION_COLUMNS.OWNERS, ownerValues),
    brands: findMissingValidationValues_(VALIDATION_COLUMNS.BRANDS, collectGearValues_('brand')),
    floatTypes: findMissingValidationValues_(VALIDATION_COLUMNS.FLOAT_TYPES, collectGearValues_('type', ['Floats'])),
    fishTypes: findMissingValidationValues_(VALIDATION_COLUMNS.FISH_TYPES, collectFishValues_('fishType')),
    venues: findMissingValidationValues_(VALIDATION_COLUMNS.VENUES, collectFishValues_('where'))
  };
}

/**
 * Read-only preview of what seedValidationsFromExistingData() would add,
 * without writing anything. Used by the Validations tab to decide whether
 * to show the "Populate from existing data" button, and to list what it
 * would add.
 * @return {Object} {owners, brands, floatTypes, fishTypes, venues} — each an array of missing values.
 */
function previewValidationSeed() {
  try {
    return computeMissingValidationValues_();
  } catch (error) {
    console.error('[Code.gs/previewValidationSeed]', error);
    throw error;
  }
}

/**
 * One-time backfill for existing spreadsheets: adds whichever
 * Owner/Brand/Float Type/Fish Type/Venue values are already in use in the
 * gear/Fishes Caught sheets but not yet in the Validations sheet. Since
 * the app hides any gear/catch whose owner (or brand/type/fish type/venue)
 * isn't a recognized Validations value, spreadsheets with data typed in
 * before Validations existed — or edited directly rather than through the
 * app — could have values that are in use but not "known", making that
 * gear/those catches invisible. Run from the Validations tab's "Populate
 * from existing data" button.
 * @return {Object} {success: boolean, added: {owners, brands, floatTypes, fishTypes, venues}} counts of newly added values per list.
 */
function seedValidationsFromExistingData() {
  try {
    const missing = computeMissingValidationValues_();

    Object.keys(missing).forEach(function (field) {
      const column = getValidationColumn_(field);
      missing[field].forEach(function (value) {
        addValidationValue_(column, value);
      });
    });

    return {
      success: true,
      added: {
        owners: missing.owners.length,
        brands: missing.brands.length,
        floatTypes: missing.floatTypes.length,
        fishTypes: missing.fishTypes.length,
        venues: missing.venues.length
      }
    };
  } catch (error) {
    console.error('[Code.gs/seedValidationsFromExistingData]', error);
    throw error;
  }
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
  try {
    const sheet = getSheetByCategory_(category);

    value = String(value || "").trim();

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    const headerLookup = {};

    headers.forEach(function(headerCell, headerOffset) {
      headerLookup[String(headerCell).trim().toLowerCase()] = headerOffset + 1;
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
  } catch (error) {
    console.error('[Code.gs/updateItemField]', error);
    throw error;
  }
}