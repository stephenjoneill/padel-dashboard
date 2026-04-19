/*************************************************************
 * Momentum Padel – Audited Stage 5 App
 *************************************************************/

let data = null;
let currentPlayerKey = null;
let audienceMode = localStorage.getItem("audienceMode") || "coach";

/***********************
 * Feature Flags
 ***********************/
const FEATURE_FLAGS_DEFAULT = {
  player_mode: true,
  coach_mode: true,
  benchmarking: true,
  trend_history: true,
  milestones: true,
  playbooks: true,
  session_plans: true,
  tutorial_mode: true
};

let FEATURE_FLAGS = JSON.parse(localStorage.getItem("featureFlags")) || FEATURE_FLAGS_DEFAULT;

function isFeatureEnabled(flag) {
  return FEATURE_FLAGS[flag] === true;
}

/***********************
 * Init
 ***********************/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data.json");
    data = await res.json();

    setupAudienceMode();
    setupSettingsPanel();
    setupHelp();
    setupTutorial();

    if (document.getElementById("reportPlayerName")) {
      initReport();
    } else {
      initDashboard();
    }
  } catch (err) {
    console.error(err);
  }
});

/***********************
 * Audience Mode
 ***********************/
function setupAudienceMode() {
  const select = document.getElementById("reportAudienceModeSelect");
  if (!select) return;

  select.value = audienceMode;

  select.addEventListener("change", () => {
    audienceMode = select.value;
    localStorage.setItem("audienceMode", audienceMode);
    renderCurrent();
  });
}

/***********************
 * Settings Panel
 ***********************/
function setupSettingsPanel() {
  const toggleBtn = document.getElementById("settingsToggleBtn");
  const panel = document.getElementById("settingsPanel");
  const featureList = document.getElementById("featureToggleList");

  if (!panel || !featureList) return;

  featureList.innerHTML = "";

  Object.keys(FEATURE_FLAGS).forEach(flag => {
    const row = document.createElement("div");
    row.className = "setting-row";

    const label = document.createElement("label");
    label.textContent = flag;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = FEATURE_FLAGS[flag];

    checkbox.addEventListener("change", () => {
      FEATURE_FLAGS[flag] = checkbox.checked;
      localStorage.setItem("featureFlags", JSON.stringify(FEATURE_FLAGS));
      renderCurrent();
    });

    row.appendChild(label);
    row.appendChild(checkbox);
    featureList.appendChild(row);
  });

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      panel.classList.toggle("hidden");
    });
  }
}

/***********************
 * Dashboard Init
 ***********************/
function initDashboard() {
  const keys = Object.keys(data.players);
  currentPlayerKey = keys[0];
  renderDashboard();
}

/***********************
 * Report Init
 ***********************/
function initReport() {
  const params = new URLSearchParams(window.location.search);
  const playerKey = params.get("player") || Object.keys(data.players)[0];
  currentPlayerKey = playerKey;

  renderReport();
}

/***********************
 * Render Dispatcher
 ***********************/
function renderCurrent() {
  if (document.getElementById("reportPlayerName")) {
    renderReport();
  } else {
    renderDashboard();
  }
}

/***********************
 * Dashboard Render
 ***********************/
function renderDashboard() {
  const player = data.players[currentPlayerKey];

  document.getElementById("reportPlayerName")?.textContent = player.player_name;

  renderTrend(player);
  renderMilestones(player);
  renderDrills(player);
  renderSessionPlan(player);
}

/***********************
 * Report Render
 ***********************/
function renderReport() {
  const player = data.players[currentPlayerKey];

  document.getElementById("reportPlayerName").textContent = player.player_name;
  document.getElementById("reportHeadline").textContent = player.headline;
  document.getElementById("reportSummary").textContent = player.summary;

  renderTrend(player);
  renderMilestones(player);
  renderDrills(player);
  renderSessionPlan(player);
}

/***********************
 * Trend / History
 ***********************/
function getSyntheticHistory(player) {
  const base = player.shot_summary.reduce((acc, s) => acc + s.shot_count, 0);

  return Array.from({ length: 6 }).map((_, i) => ({
    session: i + 1,
    shots: base - (5 - i) * 5,
    errors: Math.max(10, base * 0.3 - i * 2),
    winners: Math.max(5, base * 0.1 + i * 2)
  }));
}

function renderTrend(player) {
  if (!isFeatureEnabled("trend_history")) return;

  const history = getSyntheticHistory(player);

  const ctx = document.getElementById("reportTrendChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map(h => `S${h.session}`),
      datasets: [{
        label: "Errors",
        data: history.map(h => h.errors)
      }]
    }
  });

  const table = document.getElementById("reportHistoryTableBody");
  if (table) {
    table.innerHTML = history.map(h => `
      <tr>
        <td>${h.session}</td>
        <td>-</td>
        <td>${h.shots}</td>
        <td>${h.errors}</td>
        <td>${h.winners}</td>
        <td>${h.winners - h.errors}</td>
      </tr>
    `).join("");
  }
}

/***********************
 * Milestones
 ***********************/
function renderMilestones(player) {
  if (!isFeatureEnabled("milestones")) return;

  const container = document.getElementById("reportMilestoneList");
  if (!container) return;

  container.innerHTML = `
    <div class="milestone">Improving consistency</div>
    <div class="milestone">Reducing errors</div>
  `;
}

/***********************
 * Drills
 ***********************/
function renderDrills(player) {
  if (!isFeatureEnabled("playbooks")) return;

  const container = document.getElementById("reportRecommendedDrillList");
  if (!container) return;

  container.innerHTML = `
    <div class="drill-card">
      <strong>Cross-court rally</strong>
      <p>Improve consistency</p>
    </div>
  `;
}

/***********************
 * Session Plan
 ***********************/
function renderSessionPlan(player) {
  if (!isFeatureEnabled("session_plans")) return;

  const container = document.getElementById("reportSessionPlanBlocks");
  if (!container) return;

  container.innerHTML = `
    <div class="plan-block">Block 1: Consistency</div>
    <div class="plan-block">Block 2: Decision making</div>
  `;
}

/***********************
 * Help
 ***********************/
function setupHelp() {
  const btn = document.getElementById("reportHelpBtn");
  const drawer = document.getElementById("reportHelpDrawer");

  if (!btn || !drawer) return;

  btn.addEventListener("click", () => {
    drawer.classList.toggle("hidden");
  });
}

/***********************
 * Tutorial
 ***********************/
function setupTutorial() {
  const btn = document.getElementById("reportTourBtn");
  const overlay = document.getElementById("reportTutorialOverlay");

  if (!btn || !overlay) return;

  btn.addEventListener("click", () => {
    overlay.classList.remove("hidden");
  });
}
