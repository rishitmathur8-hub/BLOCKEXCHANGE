// All times from the backend are minutes since start of day.
const DAY = 1440;
const REFRESH_MS = 30000;
const STATUS = {
  requested: "Requested",
  proposed: "Proposed",
  approved: "Approved",
  started: "Started",
  completed: "Completed",
  overrun: "Overrun",
  cancelled: "Cancelled",
};
const $ = (id) => document.getElementById(id);

// ---------- helpers ----------
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") {
      node.className = value;
    } else if (key === "style") {
      Object.assign(node.style, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function fmt(min) {
  const m = Math.round(min);
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const statusClass = (s) => "s-" + slug(s);
const statusLabel = (s) => STATUS[slug(s)] || s;
const kmRange = (r) => "km " + r.km_from + "\u2013" + r.km_to;
const pct = (min) => (min / DAY) * 100 + "%";

function chip(text, cls) {
  return el("span", { class: "chip " + cls }, text);
}

function table(headers, rows) {
  return el(
    "div",
    { class: "table-wrap" },
    el("table", {}, el("thead", {}, el("tr", {}, headers.map((h) => el("th", { scope: "col" }, h)))), el("tbody", {}, rows))
  );
}

function setSection(name, count, content, emptyMessage) {
  $(name + "-count").textContent = "(" + count + ")";
  const body = $(name + "-body");
  body.replaceChildren();
  body.append(count ? content : el("p", { class: "empty" }, emptyMessage));
}

// ---------- statistics cards ----------
function renderStats(blocks, requests) {
  const completed = blocks.filter((b) => slug(b.status) === "completed").length;
  const overruns = blocks.filter((b) => slug(b.status) === "overrun").length;

  $("stat-blocks").textContent = blocks.length;
  $("stat-requests").textContent = requests.length;
  $("stat-completed").textContent = completed;
  $("stat-overruns").textContent = overruns;
}

// ---------- legend ----------
function renderLegend() {
  const legend = $("legend");
  legend.replaceChildren();
  for (const key of Object.keys(STATUS)) {
    legend.append(el("li", {}, el("span", { class: "swatch " + statusClass(key) }), STATUS[key]));
  }
  legend.append(el("li", {}, el("span", { class: "swatch win" }), "Open request window"));
  legend.append(el("li", {}, el("span", { class: "swatch now-swatch" }), "Current time"));
}

// ---------- timeline ----------
function renderTimeline(blocks, requests) {
  const root = $("timeline");
  root.replaceChildren();

  const sectionIds = [...new Set([...blocks.map((b) => b.section_id), ...requests.map((r) => r.section_id)])].sort((a, b) => a - b);

  if (sectionIds.length === 0) {
    root.append(el("p", { class: "empty" }, "Nothing to plot yet. Load data with seed.py, then run the merge."));
    return;
  }

  const axis = el("div", { class: "axis" });
  for (let h = 0; h <= 24; h += 2) {
    axis.append(el("span", { style: { left: pct(h * 60) } }, String(h).padStart(2, "0")));
  }
  root.append(el("div", { class: "lane head" }, el("div", { class: "lane-name" }), axis));

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const id of sectionIds) {
    const track = el("div", { class: "track" });

    for (const r of requests.filter((r) => r.section_id === id)) {
      track.append(
        el("div", {
          class: "win",
          style: { left: pct(r.window_start), width: pct(r.window_end - r.window_start) },
          title: r.dept + " " + r.work_type + ": needs " + r.duration_min + " min between " + fmt(r.window_start) + " and " + fmt(r.window_end),
        })
      );
    }

    for (const b of blocks.filter((b) => b.section_id === id)) {
      const detail = (b.requests || []).map((r) => r.dept + ": " + r.work_type + " (" + kmRange(r) + ")");
      track.append(
        el(
          "div",
          {
            class: "bar " + statusClass(b.status),
            style: { left: pct(b.start), width: pct(b.end - b.start) },
            title: "Block #" + b.id + ", " + fmt(b.start) + "\u2013" + fmt(b.end) + ", " + statusLabel(b.status) + (detail.length ? "\n" + detail.join("\n") : ""),
            tabindex: "0",
          },
          fmt(b.start) + "\u2013" + fmt(b.end)
        )
      );
    }

    track.append(el("div", { class: "now", style: { left: pct(nowMin) } }));
    root.append(el("div", { class: "lane" }, el("div", { class: "lane-name" }, "Section " + id), track));
  }
}

// ---------- blocks table ----------
function renderBlocks(blocks) {
  const rows = blocks.map((b) =>
    el(
      "tr",
      {},
      el("td", {}, "#" + b.id),
      el("td", {}, "Section " + b.section_id),
      el("td", {}, fmt(b.start) + "\u2013" + fmt(b.end)),
      el("td", {}, b.end - b.start + " min"),
      el("td", {}, chip(statusLabel(b.status), statusClass(b.status))),
      el("td", {}, el("ul", { class: "req-list" }, (b.requests || []).map((r) => el("li", {}, r.dept + ": " + r.work_type + ", " + kmRange(r)))))
    )
  );
  setSection("blocks", blocks.length, table(["Block", "Section", "Time", "Length", "Status", "Requests merged"], rows), "No blocks yet.");
}

// ---------- open requests table ----------
function renderRequests(requests) {
  const rows = requests.map((r) =>
    el(
      "tr",
      {},
      el("td", {}, r.dept),
      el("td", {}, "Section " + r.section_id),
      el("td", {}, r.work_type),
      el("td", {}, kmRange(r)),
      el("td", {}, r.duration_min + " min"),
      el("td", {}, fmt(r.window_start) + "\u2013" + fmt(r.window_end)),
      el("td", {}, r.needs_power_block ? "Yes" : "No")
    )
  );
  setSection("requests", requests.length, table(["Department", "Section", "Work", "Location", "Needs", "Window", "Power block"], rows), "No open requests.");
}

// ---------- trains table ----------
function renderTrains(trains) {
  const rows = trains.map((t) =>
    el(
      "tr",
      {},
      el("td", {}, t.number),
      el("td", {}, chip(t.category, "cat-" + slug(t.category))),
      el("td", {}, fmt(t.entry_time)),
      el("td", {}, fmt(t.exit_time)),
      el("td", {}, t.weight)
    )
  );
  setSection("trains", trains.length, table(["Train", "Category", "Enters section", "Leaves section", "Priority"], rows), "No trains found.");
}

// ---------- loading ----------
async function load() {
  const button = $("refresh");
  button.disabled = true;

  try {
    const { trains, requests, blocks } = await fetchAll();
    renderStats(blocks, requests);
    renderTimeline(blocks, requests);
    renderBlocks(blocks);
    renderRequests(requests);
    renderTrains(trains);

    $("error").hidden = true;
    $("updated").textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (err) {
    $("error").hidden = false;
    $("error").textContent = "Could not load data from " + API_BASE + ". Start the backend with \"uvicorn app.main:app --reload\" from the backend folder and check that CORS is enabled in main.py. (" + err.message + ")";
  } finally {
    button.disabled = false;
  }
}

// ---------- form handling ----------
const modal = $("req-modal");
const form = $("req-form");

$("btn-new-req").addEventListener("click", () => modal.showModal());
$("btn-cancel").addEventListener("click", () => {
  modal.close();
  form.reset();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  data.section_id = Number(data.section_id);
  data.km_from = Number(data.km_from);
  data.km_to = Number(data.km_to);
  data.duration_min = Number(data.duration_min);
  data.window_start = Number(data.window_start);
  data.window_end = Number(data.window_end);
  data.needs_power_block = formData.has("needs_power_block");

  try {
    const res = await fetch(API_BASE + "/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Failed to save. Check backend terminal.");

    modal.close();
    form.reset();
    load(); 
  } catch (err) {
    alert(err.message);
  }
});

// ---------- start dashboard ----------
renderLegend();
$("refresh").addEventListener("click", load);
setInterval(load, REFRESH_MS);
load();