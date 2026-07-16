import { readFile, writeFile } from "node:fs/promises";

const csvUrl = process.env.LEADERBOARD_CSV_URL;
const dataPath = new URL("../data/leaderboard.json", import.meta.url);
const pagePath = new URL("../leaderboard.html", import.meta.url);

if (!csvUrl) {
  fail("LEADERBOARD_CSV_URL is required.");
}

const existingData = await readExistingData();
const goal = readGoal(existingData.goal);
const csvText = await fetchCsv(csvUrl);
const records = parseCsv(csvText);
const players = validateRecords(records);
const updated = new Date().toISOString();

const nextData = {
  updated,
  goal,
  players
};

const page = await readFile(pagePath, "utf8");
let nextPage = replaceRequired(
  page,
  /<!-- LEADERBOARD:START -->[\s\S]*?<!-- LEADERBOARD:END -->/,
  `<!-- LEADERBOARD:START -->\n${renderRows(players, goal)}\n              <!-- LEADERBOARD:END -->`,
  "LEADERBOARD"
);
nextPage = replaceRequired(
  nextPage,
  /<!-- LAST_UPDATED:START -->[\s\S]*?<!-- LAST_UPDATED:END -->/,
  `<!-- LAST_UPDATED:START -->\n        <p class="last-updated">Last updated: <time datetime="${escapeAttribute(updated)}">${formatDate(updated)}</time></p>\n        <!-- LAST_UPDATED:END -->`,
  "LAST_UPDATED"
);

await writeFile(dataPath, `${JSON.stringify(nextData, null, 2)}\n`);
await writeFile(pagePath, nextPage);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function readExistingData() {
  try {
    return JSON.parse(await readFile(dataPath, "utf8"));
  } catch (error) {
    fail(`Could not read data/leaderboard.json: ${error.message}`);
  }
}

function readGoal(existingGoal) {
  const rawGoal = process.env.LEADERBOARD_GOAL || String(existingGoal);
  if (!/^\d+$/.test(rawGoal)) {
    fail("LEADERBOARD_GOAL must be a positive integer when provided.");
  }

  const parsedGoal = Number.parseInt(rawGoal, 10);
  if (!Number.isSafeInteger(parsedGoal) || parsedGoal <= 0) {
    fail("Leaderboard goal must be a positive integer.");
  }

  return parsedGoal;
}

async function fetchCsv(url) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    fail(`Could not fetch leaderboard CSV: ${error.message}`);
  }

  if (!response.ok) {
    fail(`Could not fetch leaderboard CSV: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseCsv(input) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let recordStartLine = 1;
  let line = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === "\n") {
          line += 1;
        }
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length === 0) {
        inQuotes = true;
      } else {
        throwCsv(recordStartLine, "unexpected quote in unquoted field");
      }
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      records.push({ line: recordStartLine, fields: row });
      row = [];
      field = "";
      line += 1;
      recordStartLine = line;
    } else if (char === "\r") {
      if (nextChar === "\n") {
        row.push(field);
        records.push({ line: recordStartLine, fields: row });
        row = [];
        field = "";
        index += 1;
        line += 1;
        recordStartLine = line;
      } else {
        row.push(field);
        records.push({ line: recordStartLine, fields: row });
        row = [];
        field = "";
        line += 1;
        recordStartLine = line;
      }
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throwCsv(recordStartLine, "unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push({ line: recordStartLine, fields: row });
  }

  return records;
}

function validateRecords(records) {
  const nonBlank = records.filter((record) => !isBlankRecord(record.fields));

  if (nonBlank.length === 0) {
    fail("CSV is empty.");
  }

  const header = nonBlank[0].fields.map((field) => field.trim().toLowerCase());
  if (header.length !== 2 || header[0] !== "username" || !["envelopes", "gold"].includes(header[1])) {
    fail(`Row ${nonBlank[0].line}: expected header "username,envelopes".`);
  }

  const seen = new Set();
  const players = [];

  for (const record of nonBlank.slice(1)) {
    if (record.fields.length !== 2) {
      fail(`Row ${record.line}: expected 2 columns, got ${record.fields.length}.`);
    }

    const username = record.fields[0].trim();
    const envelopeText = record.fields[1].trim();

    if (!username) {
      fail(`Row ${record.line}: username is required.`);
    }

    if (!/^\d+$/.test(envelopeText)) {
      fail(`Row ${record.line}: envelopes must be a non-negative integer.`);
    }

    const gold = Number.parseInt(envelopeText, 10);
    if (!Number.isSafeInteger(gold)) {
      fail(`Row ${record.line}: envelopes count is too large.`);
    }

    const duplicateKey = username.toLowerCase();
    if (seen.has(duplicateKey)) {
      fail(`Row ${record.line}: duplicate username "${username}".`);
    }

    seen.add(duplicateKey);
    players.push({ username, gold });
  }

  return players.sort((left, right) => {
    if (right.gold !== left.gold) {
      return right.gold - left.gold;
    }

    return left.username.localeCompare(right.username, "en", { sensitivity: "base" });
  });
}

function isBlankRecord(fields) {
  return fields.every((field) => field.trim() === "");
}

function throwCsv(lineNumber, problem) {
  fail(`Row ${lineNumber}: ${problem}.`);
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    fail(`Could not find ${label} sentinel in leaderboard.html.`);
  }

  return source.replace(pattern, replacement);
}

function renderRows(players, goal) {
  return players
    .map((player, index) => {
      const rank = index + 1;
      const progress = Math.min((player.gold / goal) * 100, 100);
      const progressWidth = Number.isInteger(progress)
        ? String(progress)
        : progress.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      const topClass = rank <= 3 ? " leaderboard-row--top" : "";
      const ready = player.gold >= goal
        ? `\n                  <span class="ready-marker">Free pack earned</span>`
        : "";

      return `              <tr class="leaderboard-row${topClass}" data-collector="${escapeAttribute(player.username.toLowerCase())}">
                <td class="rank-cell" data-label="Rank">${rank}</td>
                <td data-label="Collector">${escapeHtml(player.username)}</td>
                <td class="envelope-cell" data-label="Envelopes">${player.gold}</td>
                <td data-label="Progress">
                  <span class="progress-text">${player.gold} / ${goal}</span>${ready}
                  <span class="progress-track" aria-hidden="true">
                    <span class="progress-fill" style="width: ${progressWidth}%;"></span>
                  </span>
                </td>
              </tr>`;
    })
    .join("\n");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
