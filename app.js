const $ = selector => document.querySelector(selector);
const storageKey = "dropzone-leaderboard-v1";
const colors = [
  ["#343e23", "#d2fa54"], ["#352b48", "#d5b8ff"], ["#233945", "#95d9ff"],
  ["#443421", "#ffd194"], ["#412933", "#ffb3ce"], ["#243d36", "#a1ead6"]
];

const defaults = { elimination: 1, placements: [15, 12, 10, 8, 6, 5, 4, 3, 2, 1] };
const samples = [
  ["Phantom Squad", [1, 2, 1], [11, 8, 10]],
  ["Neon Wolves", [2, 1, 3], [9, 7, 8]],
  ["Iron Syndicate", [3, 4, 2], [7, 7, 6]],
  ["Night Ops", [5, 3, 4], [6, 6, 5]],
  ["Zero Gravity", [4, 6, 5], [5, 5, 4]],
  ["Apex Unit", [6, 5, 6], [3, 4, 4]]
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.teams) && saved.rules) return saved;
  } catch {
    // Start with sample standings if the browser has no readable save.
  }
  return {
    rules: defaults,
    teams: samples.map(([name, placements, eliminations], index) => ({
      id: `sample-${index}`, name, color: index, sample: true,
      results: placements.map((placement, match) => ({ placement, eliminations: eliminations[match] }))
    }))
  };
}

let state = load();
const dialog = $("#dialog");
const dialogContent = $("#dialog-content");
const number = new Intl.NumberFormat();
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function score(result) {
  return {
    placement: state.rules.placements[result.placement - 1] ?? 0,
    eliminations: result.eliminations * state.rules.elimination
  };
}

function standings() {
  return state.teams.map(team => {
    let placementPoints = 0;
    let eliminationPoints = 0;
    let eliminations = 0;
    for (const result of team.results) {
      const points = score(result);
      placementPoints += points.placement;
      eliminationPoints += points.eliminations;
      eliminations += result.eliminations;
    }
    return { team, placementPoints, eliminationPoints, eliminations, total: placementPoints + eliminationPoints };
  }).sort((a, b) => b.total - a.total || b.eliminations - a.eliminations || a.team.name.localeCompare(b.team.name));
}

function element(tag, label, className) {
  const node = document.createElement(tag);
  if (label !== undefined) node.textContent = label;
  if (className) node.className = className;
  return node;
}

function render() {
  const ranked = standings();
  $("#team-count").textContent = number.format(ranked.length);
  $("#result-count").textContent = number.format(ranked.reduce((sum, row) => sum + row.team.results.length, 0));
  $("#elim-count").textContent = number.format(ranked.reduce((sum, row) => sum + row.eliminations, 0));
  $("#add-result").disabled = ranked.length === 0;
  $("#clear-demo").hidden = !state.teams.some(team => team.sample);
  $("#table-info").textContent = `${ranked.length} ${ranked.length === 1 ? "team" : "teams"}`;

  const body = $("#rows");
  body.replaceChildren();
  if (!ranked.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 8;
    cell.className = "empty";
    cell.textContent = "Add a team to start scoring.";
    return;
  }
  ranked.forEach(({ team, placementPoints, eliminationPoints, eliminations, total }, index) => {
    const row = body.insertRow();
    row.insertCell().append(element("span", index + 1, index === 0 ? "rank leader" : "rank"));
    const teamCell = element("div", undefined, "team-cell");
    const initials = team.name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase();
    const avatar = element("span", initials, "avatar");
    avatar.setAttribute("aria-hidden", "true");
    const [background, foreground] = colors[team.color % colors.length];
    avatar.style.setProperty("--avatar-bg", background);
    avatar.style.setProperty("--avatar-fg", foreground);
    teamCell.append(avatar, element("span", team.name));
    row.insertCell().append(teamCell);
    for (const value of [team.results.length, placementPoints, eliminations, eliminationPoints, total]) {
      row.insertCell().textContent = number.format(value);
    }
    row.lastElementChild.className = "total";
    const manage = element("button", "⋯", "text-button team-actions");
    manage.type = "button";
    manage.setAttribute("aria-label", `Manage ${team.name}`);
    manage.addEventListener("click", () => openTeam(team));
    row.insertCell().append(manage);
  });
}

function save(message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    document.querySelector("footer span:last-child").textContent = "Browser storage unavailable";
  }
  render();
  $("#status").textContent = message;
}

function showDialog(title, markup, submit) {
  dialogContent.innerHTML = `
    <div class="dialog-head"><h2 id="dialog-title"></h2><button class="text-button" type="button" aria-label="Close">✕</button></div>
    ${markup}`;
  dialog.setAttribute("aria-labelledby", "dialog-title");
  $("#dialog-title").textContent = title;
  dialogContent.querySelector(".dialog-head button").onclick = () => dialog.close();
  const form = dialogContent.querySelector("form");
  form.addEventListener("submit", event => {
    event.preventDefault();
    submit(form);
  });
  dialogContent.querySelector("[data-cancel]")?.addEventListener("click", () => dialog.close());
  if (!dialog.open) dialog.showModal();
  dialogContent.querySelector("form input, form select, [data-cancel]")?.focus();
}

function buttons(label, style = "primary") {
  return `<div class="dialog-actions"><button class="button subtle" type="button" data-cancel>Cancel</button><button class="button ${style}" type="submit">${label}</button></div>`;
}

function finish(message) {
  dialog.close();
  save(message);
}

function openTeam(team) {
  showDialog(team ? "Manage team" : "Add team", `
    <form>
      <label>Team name<input name="name" maxlength="60" required></label>
      <div class="dialog-actions">
        ${team ? '<button class="button subtle danger" type="button" data-remove>Delete team</button>' : ""}
        <button class="button primary" type="submit">${team ? "Save name" : "Add team"}</button>
      </div>
    </form>`, form => {
    const name = form.elements.name.value.trim();
    const duplicate = state.teams.some(other => other !== team && other.name.toLowerCase() === name.toLowerCase());
    if (!name || duplicate) {
      form.elements.name.setCustomValidity(duplicate ? "A team with this name already exists." : "Enter a team name.");
      form.elements.name.reportValidity();
      return;
    }
    if (team) {
      team.name = name;
      team.sample = false;
    } else {
      state.teams.push({ id: newId(), name, results: [], color: state.teams.length });
    }
    finish(`${name} ${team ? "updated" : "added"}.`);
  });
  const input = dialogContent.querySelector("input");
  input.addEventListener("input", () => input.setCustomValidity(""));
  if (!team) return;
  input.value = team.name;
  dialogContent.querySelector("[data-remove]").onclick = () => confirmAction(
    "Delete team", `Delete ${team.name} and all of its results?`, "Delete team", () => {
      state.teams = state.teams.filter(other => other !== team);
      finish(`${team.name} deleted.`);
    }
  );
  const history = element("section", undefined, "history");
  history.append(element("h3", "Match results"));
  if (!team.results.length) history.append(element("p", "No results recorded."));
  const list = element("ul");
  team.results.forEach((result, index) => {
    const item = element("li", `#${result.placement} placement · ${result.eliminations} eliminations`);
    const edit = element("button", "Edit", "text-button");
    edit.type = "button";
    edit.onclick = () => openResult(team, index);
    const remove = element("button", "Remove", "text-button danger");
    remove.type = "button";
    remove.onclick = () => {
      team.results.splice(index, 1);
      save("Result removed.");
      openTeam(team);
    };
    item.append(edit, remove);
    list.append(item);
  });
  history.append(list);
  dialogContent.append(history);
}

function openResult(team, index) {
  const existing = team?.results[index];
  showDialog(existing ? "Edit result" : "Add result", `
    <form>
      <label>Team<select name="team" required></select></label>
      <div class="fields">
        <label>Placement<input name="placement" type="number" min="1" max="9999" value="1" required></label>
        <label>Eliminations<input name="eliminations" type="number" min="0" max="9999" value="0" required></label>
      </div>
      <p class="form-note" data-preview aria-live="polite"></p>
      ${buttons(existing ? "Save result" : "Add result")}
    </form>`, form => {
    const target = state.teams.find(candidate => candidate.id === form.elements.team.value);
    const result = readResult(form);
    if (existing) target.results[index] = result;
    else target.results.push(result);
    target.sample = false;
    finish(`Result saved for ${target.name}.`);
  });

  const form = dialogContent.querySelector("form");
  const select = form.elements.team;
  for (const { team: optionTeam } of standings()) {
    if (existing && optionTeam !== team) continue;
    const option = element("option", optionTeam.name);
    option.value = optionTeam.id;
    select.append(option);
  }
  if (team) select.value = team.id;
  if (existing) {
    form.elements.placement.value = existing.placement;
    form.elements.eliminations.value = existing.eliminations;
  }
  function updatePreview() {
    const preview = form.querySelector("[data-preview]");
    if (!form.checkValidity()) {
      preview.textContent = "Enter a placement and elimination count to see the points.";
      return;
    }
    const points = score(readResult(form));
    preview.textContent = `${number.format(points.placement)} placement pts + ${number.format(points.eliminations)} elimination pts = ${number.format(points.placement + points.eliminations)} total pts`;
  }
  form.addEventListener("input", updatePreview);
  updatePreview();
}

function readResult(form) {
  return {
    placement: form.elements.placement.valueAsNumber,
    eliminations: form.elements.eliminations.valueAsNumber
  };
}

function openRules() {
  showDialog("Scoring rules", `
    <form>
      <label>Points per elimination<input name="elimination" type="number" min="0" max="9999" required></label>
      <label>Placement points<input name="placements" aria-describedby="placement-help" maxlength="500" required></label>
      <p class="form-note" id="placement-help">Enter points in order from first place, separated by commas. All later placements earn zero. Changes recalculate existing results.</p>
      ${buttons("Save rules")}
    </form>`, form => {
    const input = form.elements.placements;
    const entries = input.value.split(",").map(entry => entry.trim());
    if (entries.some(entry => !/^\d{1,4}$/.test(entry))) {
      input.setCustomValidity("Use comma-separated whole numbers from 0 to 9999.");
      input.reportValidity();
      return;
    }
    state.rules = { elimination: form.elements.elimination.valueAsNumber, placements: entries.map(Number) };
    finish("Scoring rules updated.");
  });
  const form = dialogContent.querySelector("form");
  form.elements.elimination.value = state.rules.elimination;
  form.elements.placements.value = state.rules.placements.join(", ");
  form.elements.placements.addEventListener("input", event => event.target.setCustomValidity(""));
}

function confirmAction(title, message, label, submit) {
  showDialog(title, `<form><p class="form-note" data-message></p>${buttons(label, "subtle danger")}</form>`, submit);
  dialogContent.querySelector("[data-message]").textContent = message;
}

$("#add-team").onclick = () => openTeam();
$("#add-result").onclick = () => openResult();
$("#rules").onclick = openRules;
$("#clear-demo").onclick = () => confirmAction(
  "Clear sample teams", "Remove the sample teams and their results? Teams you added or updated will stay.",
  "Clear sample teams", () => {
    state.teams = state.teams.filter(team => !team.sample);
    finish("Sample teams cleared.");
  }
);
render();
