// Helpers for computing day/week/month boundaries.
//
// IMPORTANT: These are pinned to Ethiopia's timezone (Africa/Addis_Ababa,
// UTC+3, no DST) REGARDLESS of what timezone the server itself runs in.
// This matters because most free/cheap hosting defaults to UTC - without
// this, "today" or "this week" could flip a few hours early/late from the
// Ethiopian user's point of view. We still use the Gregorian calendar
// (not the Ethiopian calendar), just anchored to Ethiopian local time.
//
// All returned Date objects are still normal JS Date objects (which are
// always UTC instants internally) - they just represent the correct
// instant for "midnight in Addis Ababa", "Monday in Addis Ababa", etc.

const ETHIOPIA_UTC_OFFSET_HOURS = 3;
const ETHIOPIA_UTC_OFFSET_MS = ETHIOPIA_UTC_OFFSET_HOURS * 60 * 60 * 1000;

// Converts any Date into "what the wall-clock reads in Addis Ababa",
// represented as a UTC-based Date so we can safely use getUTCFullYear(),
// getUTCDay(), etc. without the server's own local timezone interfering.
function toEthiopianWallClock(date) {
  return new Date(date.getTime() + ETHIOPIA_UTC_OFFSET_MS);
}

// Converts an Ethiopian wall-clock Date (as produced above) back into a
// real UTC instant, suitable for MongoDB queries.
function fromEthiopianWallClock(wallClockDate) {
  return new Date(wallClockDate.getTime() - ETHIOPIA_UTC_OFFSET_MS);
}

function startOfDay(date) {
  const eth = toEthiopianWallClock(date);
  eth.setUTCHours(0, 0, 0, 0);
  return fromEthiopianWallClock(eth);
}

function endOfDay(date) {
  const eth = toEthiopianWallClock(date);
  eth.setUTCHours(23, 59, 59, 999);
  return fromEthiopianWallClock(eth);
}

// Week = Monday to Sunday, in Ethiopian local time
function startOfWeek(date) {
  const eth = toEthiopianWallClock(date);
  eth.setUTCHours(0, 0, 0, 0);
  const day = eth.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // shift so Monday is start
  eth.setUTCDate(eth.getUTCDate() + diff);
  return fromEthiopianWallClock(eth);
}

function endOfWeek(date) {
  const ethStart = toEthiopianWallClock(startOfWeek(date));
  ethStart.setUTCDate(ethStart.getUTCDate() + 6);
  ethStart.setUTCHours(23, 59, 59, 999);
  return fromEthiopianWallClock(ethStart);
}

// Month = 1st to last calendar day (28-31, leap years handled automatically),
// in Ethiopian local time
function startOfMonth(date) {
  const eth = toEthiopianWallClock(date);
  const result = new Date(Date.UTC(eth.getUTCFullYear(), eth.getUTCMonth(), 1, 0, 0, 0, 0));
  return fromEthiopianWallClock(result);
}

function endOfMonth(date) {
  const eth = toEthiopianWallClock(date);
  // day 0 of next month = last day of current month (JS handles 28/29/30/31 automatically)
  const result = new Date(Date.UTC(eth.getUTCFullYear(), eth.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return fromEthiopianWallClock(result);
}

// Formats a Date as its YYYY-MM-DD string AS SEEN IN ETHIOPIAN LOCAL TIME.
// Use this instead of .toISOString().split('T')[0], which would show the
// UTC date and could be off by a day near midnight in Addis Ababa.
function toEthiopianDateString(date) {
  const eth = toEthiopianWallClock(date);
  const y = eth.getUTCFullYear();
  const m = String(eth.getUTCMonth() + 1).padStart(2, '0');
  const d = String(eth.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  toEthiopianDateString,
};
