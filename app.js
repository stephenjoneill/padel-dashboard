/*************************************************************
 * Momentum Padel – Data Model V2 App
 *************************************************************/

let data = null;
let currentPlayerKey = null;
let currentPlanKey = localStorage.getItem("padelPlanKey") || null;
let currentViewMode = localStorage.getItem("padelViewMode") || "player";
let currentHelpTopic = null;
let tourIndex = 0;

const chartRefs = {
  trend: null,
  shot: null,
  error: null,
  winner: null,
  reportTrend: null,
  reportShot: null,
  reportError: null
};

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

let featureFlags = JSON.parse(localStorage.getItem("padelFeatureFlags") || "null") || { ...FEATURE_FLAGS_DEFAULT };

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error(`Failed to load data.json (${response.status})`);
    data = await response.json();

    if (!data?.players || Object.keys(data.players).length === 0) {
      throw new Error("No players found in data.json");
    }

    currentPlanKey = data.app?.plans?.[currentPlanKey] ? currentPlanKey : data.app?.default_plan || "coach_pro";

    setupStaticBranding();
    setupPlanSelectors();
    setupSettingsPanel();
    setupHelp();
    setupTutorial();

    if (isReportPage()) {
      initReport();
    } else {
      initDashboard();
    }

    hideLoading();
  } catch (error) {
    console.error(error);
    showError(error.message || "Unable to load app data.");
  }
});

function isReportPage() {
  return Boolean(document.getElementById("reportPlayerName"));
}

function setupStaticBranding() {
  const appTitle = document.getElementById("appTitle");
  const brandKicker = document.getElementById("brandKicker");

  if (appTitle && data.app?.name) appTitle.textContent = `${data.app.name} Dashboard`;
  if (brandKicker && data.app?.tagline) brandKicker.textContent = data.app.tagline;
}

function hideLoading() {
  document.getElementById("loadingState")?.classList.add("hidden");
  document.getElementById("reportLoadingState")?.classList.add("hidden");
}

function showError(message) {
  const errorState = document.getElementById("errorState");
  const reportErrorState = document.getElementById("reportErrorState");

  if (errorState) {
    errorState.textContent = message;
    errorState.classList.remove("hidden");
  }

  if (reportErrorState) {
    reportErrorState.textContent = message;
    reportErrorState.classList.remove("hidden");
  }
}

function setupPlanSelectors() {
  const planOptions = Object.entries(data.app?.plans || {});
  const selectors = [document.getElementById("planSelect"), document.getElementById("reportPlanSelect")].filter(Boolean);

  selectors.forEach((select) => {
    select.innerHTML = planOptions.map(([key, plan]) => `<option value="${key}">${plan.label}</option>`).join("");
    select.value = currentPlanKey;
    select.addEventListener("change", (event) => {
      currentPlanKey = event.target.value;
      localStorage.setItem("padelPlanKey", currentPlanKey);
      syncPlanSelectors();
      renderCurrentPage();
    });
  });

  syncPlanSelectors();
}

function syncPlanSelectors() {
  const plan = data.app?.plans?.[currentPlanKey];
  document.getElementById("planSelect") && (document.getElementById("planSelect").value = currentPlanKey);
  document.getElementById("reportPlanSelect") && (document.getElementById("reportPlanSelect").value = currentPlanKey);
  document.getElementById("dashboardPlanBadge") && (document.getElementById("dashboardPlanBadge").textContent = plan?.label || "Plan");
  document.getElementById("reportPlanBadge") && (document.getElementById("reportPlanBadge").textContent = plan?.label || "Plan");
}

function setupSettingsPanel() {
  const toggleBtn = document.getElementById("settingsToggleBtn");
  const panel = document.getElementById("settingsPanel");
  const featureList = document.getElementById("featureToggleList");
  const summary = document.getElementById("settingsSummary");
  const resetBtn = document.getElementById("settingsResetBtn");

  if (!panel || !featureList || !summary) return;

  const labels = {
    player_mode: ["Player mode", "Enable player-specific dashboard presentation."],
    coach_mode: ["Coach mode", "Show coaching insight panels and recommendations."],
    benchmarking: ["Benchmarking", "Compare metrics against target performance profile."],
    trend_history: ["Trend history", "Show match trends and history table."],
    milestones: ["Milestones", "Show progress markers and development checkpoints."],
    playbooks: ["Playbooks", "Show recommended drills."],
    session_plans: ["Session plans", "Show next-session structure and blocks."],
    tutorial_mode: ["Tutorial mode", "Enable guided tour overlay and help shortcuts."]
  };

  featureList.innerHTML = "";
  Object.keys(featureFlags).forEach((flag) => {
    const [title, copy] = labels[flag] || [flag, "Toggle feature visibility."];
    const wrap = document.createElement("label");
    wrap.className = "feature-toggle";
    wrap.innerHTML = `
      <input type="checkbox" ${featureFlags[flag] ? "checked" : ""} data-flag="${flag}">
      <span>
        <span class="feature-toggle-title">${title}</span>
        <span class="feature-toggle-copy">${copy}</span>
      </span>
    `;
    featureList.appendChild(wrap);
  });

  featureList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const flag = target.dataset.flag;
    featureFlags[flag] = target.checked;
    localStorage.setItem("padelFeatureFlags", JSON.stringify(featureFlags));
    updateSettingsSummary();
    renderCurrentPage();
  });

  toggleBtn?.addEventListener("click", () => panel.classList.toggle("hidden"));
  resetBtn?.addEventListener("click", () => {
    featureFlags = { ...FEATURE_FLAGS_DEFAULT };
    localStorage.setItem("padelFeatureFlags", JSON.stringify(featureFlags));
    setupSettingsPanel();
    renderCurrentPage();
  });

  updateSettingsSummary();

  function updateSettingsSummary() {
    const activeCount = Object.values(featureFlags).filter(Boolean).length;
    const plan = data.app?.plans?.[currentPlanKey];
    summary.innerHTML = `
      <div><strong>${plan?.label || "Plan"}</strong></div>
      <div>${plan?.summary || ""}</div>
      <div class="settings-help">${activeCount} of ${Object.keys(featureFlags).length} feature modules active.</div>
    `;
  }
}

function setupHelp() {
  const openBtn = document.getElementById("openHelpBtn");
  const closeBtn = document.getElementById("closeHelpBtn");
  const drawer = document.getElementById("helpDrawer");
  const chips = document.getElementById("helpTopicChips");
  const body = document.getElementById("helpBody");
  const title = document.getElementById("helpTitle");
  const searchInput = document.getElementById("helpSearchInput");

  if (!drawer || !chips || !body || !title) return;

  chips.innerHTML = data.help_topics.map((topic) => `
    <button class="help-topic-chip" type="button" data-topic="${topic.key}">${topic.label}</button>
  `).join("");

  const renderHelpTopic = (topicKey, searchTerm = "") => {
    currentHelpTopic = topicKey || data.help_topics[0]?.key || null;
    const topic = data.help_topics.find((item) => item.key === currentHelpTopic) || data.help_topics[0];
    if (!topic) return;

    title.textContent = topic.title;
    const term = searchTerm.trim().toLowerCase();
    const cards = topic.cards.filter((card) => {
      if (!term) return true;
      return `${card.title} ${card.body} ${(card.bullets || []).join(" ")}`.toLowerCase().includes(term);
    });

    body.innerHTML = cards.map((card) => `
      <div class="help-card">
        <h4>${card.title}</h4>
        <p>${card.body}</p>
        <ul class="help-bullets">${(card.bullets || []).map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
      </div>
    `).join("") || `<div class="help-note">No matching help content found.</div>`;

    chips.querySelectorAll(".help-topic-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.topic === topic.key);
    });
  };

  chips.addEventListener("click", (event) => {
    const target = event.target.closest(".help-topic-chip");
    if (!target) return;
    renderHelpTopic(target.dataset.topic, searchInput?.value || "");
  });

  document.querySelectorAll("[data-help-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      drawer.classList.remove("hidden");
      renderHelpTopic(button.dataset.helpTopic);
    });
  });

  searchInput?.addEventListener("input", () => renderHelpTopic(currentHelpTopic, searchInput.value));
  openBtn?.addEventListener("click", () => {
    drawer.classList.remove("hidden");
    renderHelpTopic(currentHelpTopic);
  });
  closeBtn?.addEventListener("click", () => drawer.classList.add("hidden"));

  renderHelpTopic(data.help_topics[0]?.key || null);
}

function setupTutorial() {
  const overlay = document.getElementById("tourOverlay");
  const startBtn = document.getElementById("startTourBtn");
  const backBtn = document.getElementById("tourBackBtn");
  const nextBtn = document.getElementById("tourNextBtn");
  const skipBtn = document.getElementById("tourSkipBtn");
  const title = document.getElementById("tourTitle");
  const body = document.getElementById("tourBody");
  const meta = document.getElementById("tourMeta");

  if (!overlay || !title || !body || !meta) return;

  const steps = data.tour_steps || [];

  const clearTourHighlight = () => {
    document.querySelectorAll(".tour-target-active").forEach((element) => element.classList.remove("tour-target-active"));
  };

  const renderStep = () => {
    if (!steps.length) return;
    const step = steps[tourIndex];
    title.textContent = step.title;
    body.textContent = step.body;
    meta.textContent = `${tourIndex + 1} of ${steps.length}`;
    clearTourHighlight();
    const target = document.querySelector(`[data-tour="${step.key}"]`);
    target?.classList.add("tour-target-active");
    backBtn.disabled = tourIndex === 0;
    nextBtn.textContent = tourIndex === steps.length - 1 ? "Finish" : "Next";
  };

  const closeTour = () => {
    overlay.classList.add("hidden");
    clearTourHighlight();
  };

  startBtn?.addEventListener("click", () => {
    if (!featureFlags.tutorial_mode) return;
    tourIndex = 0;
    overlay.classList.remove("hidden");
    renderStep();
  });

  backBtn?.addEventListener("click", () => {
    if (tourIndex > 0) {
      tourIndex -= 1;
      renderStep();
    }
  });

  nextBtn?.addEventListener("click", () => {
    if (tourIndex >= steps.length - 1) {
      closeTour();
      return;
    }
    tourIndex += 1;
    renderStep();
  });

  skipBtn?.addEventListener("click", closeTour);
}

function initDashboard() {
  const keys = Object.keys(data.players);
  currentPlayerKey = keys[0];

  const viewSelect = document.getElementById("viewModeSelect");
  const playerSelect = document.getElementById("playerSelect");

  if (viewSelect) {
    viewSelect.value = currentViewMode;
    viewSelect.addEventListener("change", (event) => {
      currentViewMode = event.target.value;
      localStorage.setItem("padelViewMode", currentViewMode);
      updateDashboardModeVisibility();
      renderDashboard();
    });
  }

  if (playerSelect) {
    playerSelect.innerHTML = Object.entries(data.players).map(([key, player]) => `<option value="${key}">${player.player_name}</option>`).join("");
    playerSelect.value = currentPlayerKey;
    playerSelect.addEventListener("change", (event) => {
      currentPlayerKey = event.target.value;
      updateReportLink();
      renderDashboard();
    });
  }

  updateReportLink();
  updateDashboardModeVisibility();
  renderDashboard();
}

function initReport() {
  const keys = Object.keys(data.players);
  const params = new URLSearchParams(window.location.search);
  const playerKey = params.get("player");
  currentPlayerKey = data.players[playerKey] ? playerKey : keys[0];

  const backLink = document.getElementById("backToDashboardLink");
  if (backLink) backLink.href = `index.html?player=${encodeURIComponent(currentPlayerKey)}`;

  renderReport();
}

function updateDashboardModeVisibility() {
  const playerControlWrap = document.getElementById("playerControlWrap");
  const reportLink = document.getElementById("reportLink");
  const comparisonPanel = document.getElementById("playerComparisonPanel");

  if (playerControlWrap) playerControlWrap.classList.toggle("hidden", currentViewMode !== "player");
  if (reportLink) reportLink.classList.toggle("hidden", currentViewMode !== "player");
  if (comparisonPanel) comparisonPanel.classList.toggle("hidden", currentViewMode !== "team");
}

function renderCurrentPage() {
  if (isReportPage()) {
    renderReport();
  } else {
    renderDashboard();
  }
}

function updateReportLink() {
  const reportLink = document.getElementById("reportLink");
  if (reportLink) {
    reportLink.href = `report.html?player=${encodeURIComponent(currentPlayerKey)}`;
  }
}

function getCurrentPlayer() {
  return data.players[currentPlayerKey];
}

function getTotals(player) {
  const totals = (player.shot_summary || []).reduce((acc, shot) => {
    acc.shots += shot.shot_count || 0;
    acc.errors += shot.error_count || 0;
    acc.winners += shot.winner_count || 0;
    return acc;
  }, { shots: 0, errors: 0, winners: 0 });

  totals.winnerPct = totals.shots ? (totals.winners / totals.shots) * 100 : 0;
  totals.errorPct = totals.shots ? (totals.errors / totals.shots) * 100 : 0;
  totals.efficiency = totals.errors ? totals.winners / totals.errors : totals.winners;
  return totals;
}

function getShotMetrics(shot) {
  const shotCount = shot?.shot_count || 0;
  const winners = shot?.winner_count || 0;
  const errors = shot?.error_count || 0;
  return {
    winnerPct: shotCount ? (winners / shotCount) * 100 : 0,
    errorPct: shotCount ? (errors / shotCount) * 100 : 0,
    efficiency: errors ? winners / errors : winners
  };
}

function getBestShot(player) {
  const preferred = player.profile?.best_shot_label;
  if (preferred) return preferred;
  const ranked = [...(player.shot_summary || [])].sort((a, b) => {
    const scoreA = (a.winner_count || 0) - (a.error_count || 0);
    const scoreB = (b.winner_count || 0) - (b.error_count || 0);
    return scoreB - scoreA;
  });
  return ranked[0]?.shot_type || "—";
}

function getPriorityFix(player) {
  const preferred = player.profile?.priority_fix_label;
  if (preferred) return preferred;
  const ranked = [...(player.shot_summary || [])].sort((a, b) => getShotMetrics(b).errorPct - getShotMetrics(a).errorPct);
  return ranked[0]?.shot_type || "—";
}

function getBenchmarkRows(player) {
  const totals = getTotals(player);
  const benchmarkKey = player.benchmark_profile;
  const benchmark = data.benchmarks?.[benchmarkKey];
  if (!benchmark) return [];

  const volley = (player.shot_summary || []).find((shot) => shot.shot_type.toLowerCase() === "volley");
  const overhead = (player.shot_summary || []).find((shot) => shot.shot_type.toLowerCase() === "overhead");

  const rows = [
    {
      metric: "Winner %",
      current: totals.winnerPct,
      benchmark: benchmark.metrics.winner_pct,
      inverse: false,
      priority: "Medium"
    },
    {
      metric: "Error %",
      current: totals.errorPct,
      benchmark: benchmark.metrics.error_pct,
      inverse: true,
      priority: "High"
    },
    {
      metric: "Efficiency",
      current: totals.efficiency,
      benchmark: benchmark.metrics.efficiency,
      inverse: false,
      priority: "Medium"
    },
    {
      metric: "Volley winner %",
      current: getShotMetrics(volley).winnerPct,
      benchmark: benchmark.metrics.volley_winner_pct,
      inverse: false,
      priority: "Medium"
    },
    {
      metric: "Overhead error %",
      current: getShotMetrics(overhead).errorPct,
      benchmark: benchmark.metrics.overhead_error_pct,
      inverse: true,
      priority: "High"
    }
  ];

  return rows.map((row) => ({
    ...row,
    gap: row.inverse ? row.benchmark - row.current : row.current - row.benchmark
  }));
}

function renderDashboard() {
  if (currentViewMode === "team") {
    renderTeamDashboard();
    return;
  }

  const player = getCurrentPlayer();
  if (!player) return;

  const totals = getTotals(player);
  setText("heroEyebrow", `${player.profile?.level || "Player"} · ${player.profile?.focus_theme || "Performance review"}`);
  setText("heroPlayerName", player.player_name);
  setText("heroSummary", player.summary);
  setText("heroBestShot", getBestShot(player));
  setText("heroPriorityFix", getPriorityFix(player));
  setText("heroMatchesTracked", String(player.match_history?.length || 0));
  setText("detailTitle", `${player.player_name} shot detail`);

  renderKpis("kpiGrid", totals);
  renderTrend(player, false);
  renderShotCharts(player, false);
  renderHistoryTable(player, false);
  renderMilestones(player, false);
  renderRecommendedDrills(player, false);
  renderSessionPlan(player, false);
  renderInsightLists(player, false);
  renderCoachNotes(player, false);
  renderBenchmarks(player, false);
  renderPlayerComparison();
  renderDetailTable(player, false);
  updateSectionVisibility();
}

function renderTeamDashboard() {
  const players = Object.values(data.players);
  const totals = players.reduce((acc, player) => {
    const t = getTotals(player);
    acc.shots += t.shots;
    acc.winners += t.winners;
    acc.errors += t.errors;
    return acc;
  }, { shots: 0, winners: 0, errors: 0 });
  totals.winnerPct = totals.shots ? (totals.winners / totals.shots) * 100 : 0;
  totals.errorPct = totals.shots ? (totals.errors / totals.shots) * 100 : 0;
  totals.efficiency = totals.errors ? totals.winners / totals.errors : totals.winners;

  setText("heroEyebrow", "Team view · squad summary");
  setText("heroPlayerName", "Team Dashboard");
  setText("heroSummary", "Use this view to compare the squad, identify the biggest leaks, and decide who needs what support next.");
  setText("heroBestShot", "Squad comparison");
  setText("heroPriorityFix", "Error reduction");
  setText("heroMatchesTracked", String(players.reduce((sum, player) => sum + (player.match_history?.length || 0), 0)));
  setText("detailTitle", "Team shot detail by selected player is disabled in team view");

  renderKpis("kpiGrid", totals);
  renderTrendForTeam(players);
  renderTeamShotCharts(players);
  renderTeamHistoryTable(players);
  renderTeamLists(players);
  renderPlayerComparison();
  clearElement("detailTableBody");
  clearElement("benchmarkBody");
  updateSectionVisibility();
}

function updateSectionVisibility() {
  const playerOnlySectionIds = [
    "milestonesSection",
    "recommendedDrillsSection",
    "sessionPlanSection",
    "analysisSection",
    "coachInsightsSection",
    "tacticalSection",
    "benchmarkSection"
  ];

  playerOnlySectionIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    const shouldHide = currentViewMode === "team";
    element.classList.toggle("hidden", shouldHide && !isReportPage());
  });

  const historySection = document.getElementById("historySection");
  if (historySection) historySection.classList.toggle("hidden", !featureFlags.trend_history && !isReportPage());
  const milestonesSection = document.getElementById("milestonesSection") || document.getElementById("reportMilestonesSection");
  if (milestonesSection) milestonesSection.classList.toggle("hidden", !featureFlags.milestones);
  const drillsSection = document.getElementById("recommendedDrillsSection") || document.getElementById("reportRecommendedDrillsSection");
  if (drillsSection) drillsSection.classList.toggle("hidden", !featureFlags.playbooks);
  const sessionSection = document.getElementById("sessionPlanSection") || document.getElementById("reportSessionPlanSection");
  if (sessionSection) sessionSection.classList.toggle("hidden", !featureFlags.session_plans);
  const benchmarkSection = document.getElementById("benchmarkSection") || document.getElementById("reportBenchmarkSection");
  if (benchmarkSection) benchmarkSection.classList.toggle("hidden", !featureFlags.benchmarking);
  document.getElementById("startTourBtn")?.classList.toggle("hidden", !featureFlags.tutorial_mode);
}

function renderReport() {
  const player = getCurrentPlayer();
  if (!player) return;

  const totals = getTotals(player);
  setText("reportPlayerName", player.player_name);
  setText("reportHeadline", player.headline);
  setText("reportSummary", player.summary);
  setText("reportBestShot", getBestShot(player));
  setText("reportPriorityFix", getPriorityFix(player));
  setText("reportTotalShots", String(totals.shots));
  setText("reportEfficiency", totals.efficiency.toFixed(2));
  setText("reportMatchesTracked", String(player.match_history?.length || 0));

  renderKpis("reportKpis", totals);
  renderTrend(player, true);
  renderShotCharts(player, true);
  renderHistoryTable(player, true);
  renderMilestones(player, true);
  renderRecommendedDrills(player, true);
  renderSessionPlan(player, true);
  renderInsightLists(player, true);
  renderCoachNotes(player, true);
  renderBenchmarks(player, true);
  renderRecommendations(player);
  renderDetailTable(player, true);
  updateSectionVisibility();
}

function renderKpis(containerId, totals) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total shots</div><div class="kpi-value">${totals.shots}</div><div class="kpi-sub">Tracked attempts</div></div>
    <div class="kpi-card"><div class="kpi-label">Winners</div><div class="kpi-value">${totals.winners}</div><div class="kpi-sub">${totals.winnerPct.toFixed(1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">Errors</div><div class="kpi-value">${totals.errors}</div><div class="kpi-sub">${totals.errorPct.toFixed(1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">Efficiency</div><div class="kpi-value">${totals.efficiency.toFixed(2)}</div><div class="kpi-sub">Winners / errors</div></div>
  `;
}

function renderTrend(player, reportMode) {
  const history = player.match_history || [];
  const chartId = reportMode ? "reportTrendChart" : "trendChart";
  const signalListId = reportMode ? "reportTrendSignalList" : "trendSignalList";
  const chartKey = reportMode ? "reportTrend" : "trend";
  const canvas = document.getElementById(chartId);

  if (canvas) {
    destroyChart(chartRefs[chartKey]);
    chartRefs[chartKey] = new Chart(canvas, {
      type: "line",
      data: {
        labels: history.map((match) => match.match_id),
        datasets: [
          { label: "Winners", data: history.map((match) => match.winners) },
          { label: "Errors", data: history.map((match) => match.errors) },
          { label: "Efficiency", data: history.map((match) => match.errors ? match.winners / match.errors : match.winners) }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const signals = [
    `Best shot remains ${getBestShot(player)}.`,
    `Priority fix remains ${getPriorityFix(player)}.`,
    `Recent trend shows ${trendDirection(history.map((match) => match.winners))} winner output and ${trendDirection(history.map((match) => match.errors), true)} error burden.`
  ];

  const signalList = document.getElementById(signalListId);
  if (signalList) {
    signalList.innerHTML = signals.map((signal) => `
      <div class="stack-item"><div class="stack-item-title">Signal</div><div class="stack-item-body">${signal}</div></div>
    `).join("");
  }
}

function renderTrendForTeam(players) {
  const combinedHistory = players[0]?.match_history?.map((_, index) => {
    const totals = players.reduce((acc, player) => {
      const match = player.match_history[index];
      if (match) {
        acc.winners += match.winners;
        acc.errors += match.errors;
      }
      return acc;
    }, { winners: 0, errors: 0 });
    return { label: `Round ${index + 1}`, ...totals };
  }) || [];

  const canvas = document.getElementById("trendChart");
  if (canvas) {
    destroyChart(chartRefs.trend);
    chartRefs.trend = new Chart(canvas, {
      type: "line",
      data: {
        labels: combinedHistory.map((item) => item.label),
        datasets: [
          { label: "Squad winners", data: combinedHistory.map((item) => item.winners) },
          { label: "Squad errors", data: combinedHistory.map((item) => item.errors) }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const signalList = document.getElementById("trendSignalList");
  if (signalList) {
    signalList.innerHTML = `
      <div class="stack-item"><div class="stack-item-title">Squad signal</div><div class="stack-item-body">Winner production is rising steadily across the squad.</div></div>
      <div class="stack-item"><div class="stack-item-title">Squad signal</div><div class="stack-item-body">Errors are trending down, but overhead and backhand pressure remain the biggest team leaks.</div></div>
    `;
  }
}

function renderHistoryTable(player, reportMode) {
  const bodyId = reportMode ? "reportHistoryTableBody" : "historyTableBody";
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.innerHTML = (player.match_history || []).map((match) => {
    const winnerPct = match.shots ? (match.winners / match.shots) * 100 : 0;
    const errorPct = match.shots ? (match.errors / match.shots) * 100 : 0;
    const efficiency = match.errors ? match.winners / match.errors : match.winners;
    return `
      <tr>
        <td>${match.match_id}</td>
        <td>${match.date}</td>
        <td>${match.shots}</td>
        <td>${match.winners}</td>
        <td>${match.errors}</td>
        <td>${winnerPct.toFixed(1)}%</td>
        <td>${errorPct.toFixed(1)}%</td>
        <td>${efficiency.toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}

function renderTeamHistoryTable(players) {
  const body = document.getElementById("historyTableBody");
  if (!body) return;
  const rows = Object.values(data.players).map((player) => {
    const totals = getTotals(player);
    return `
      <tr>
        <td>${player.player_name}</td>
        <td>Latest 6</td>
        <td>${totals.shots}</td>
        <td>${totals.winners}</td>
        <td>${totals.errors}</td>
        <td>${totals.winnerPct.toFixed(1)}%</td>
        <td>${totals.errorPct.toFixed(1)}%</td>
        <td>${totals.efficiency.toFixed(2)}</td>
      </tr>
    `;
  });
  body.innerHTML = rows.join("");
}

function renderShotCharts(player, reportMode) {
  const labels = (player.shot_summary || []).map((item) => item.shot_type);
  const shotCounts = (player.shot_summary || []).map((item) => item.shot_count);
  const errorCounts = (player.shot_summary || []).map((item) => item.error_count);
  const winnerCounts = (player.shot_summary || []).map((item) => item.winner_count);

  const shotCanvas = document.getElementById(reportMode ? "reportShotChart" : "shotChart");
  const errorCanvas = document.getElementById(reportMode ? "reportErrorChart" : "errorChart");
  const winnerCanvas = document.getElementById(reportMode ? null : "winnerChart");

  if (shotCanvas) {
    destroyChart(chartRefs[reportMode ? "reportShot" : "shot"]);
    chartRefs[reportMode ? "reportShot" : "shot"] = new Chart(shotCanvas, {
      type: "doughnut",
      data: { labels, datasets: [{ data: shotCounts }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (errorCanvas) {
    destroyChart(chartRefs[reportMode ? "reportError" : "error"]);
    chartRefs[reportMode ? "reportError" : "error"] = new Chart(errorCanvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Errors", data: errorCounts }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (winnerCanvas) {
    destroyChart(chartRefs.winner);
    chartRefs.winner = new Chart(winnerCanvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Winners", data: winnerCounts }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function renderTeamShotCharts(players) {
  const shotTypes = ["Forehand", "Backhand", "Volley", "Overhead"];
  const aggregated = shotTypes.map((type) => {
    return players.reduce((acc, player) => {
      const found = (player.shot_summary || []).find((shot) => shot.shot_type === type);
      acc.shots += found?.shot_count || 0;
      acc.errors += found?.error_count || 0;
      acc.winners += found?.winner_count || 0;
      return acc;
    }, { type, shots: 0, errors: 0, winners: 0 });
  });

  const shotCanvas = document.getElementById("shotChart");
  const errorCanvas = document.getElementById("errorChart");
  const winnerCanvas = document.getElementById("winnerChart");

  if (shotCanvas) {
    destroyChart(chartRefs.shot);
    chartRefs.shot = new Chart(shotCanvas, {
      type: "doughnut",
      data: { labels: shotTypes, datasets: [{ data: aggregated.map((row) => row.shots) }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
  if (errorCanvas) {
    destroyChart(chartRefs.error);
    chartRefs.error = new Chart(errorCanvas, {
      type: "bar",
      data: { labels: shotTypes, datasets: [{ label: "Errors", data: aggregated.map((row) => row.errors) }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
  if (winnerCanvas) {
    destroyChart(chartRefs.winner);
    chartRefs.winner = new Chart(winnerCanvas, {
      type: "bar",
      data: { labels: shotTypes, datasets: [{ label: "Winners", data: aggregated.map((row) => row.winners) }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function renderMilestones(player, reportMode) {
  const container = document.getElementById(reportMode ? "reportMilestoneList" : "milestoneList");
  if (!container) return;
  container.innerHTML = (player.milestones || []).map((item) => `
    <div class="stack-item">
      <div class="milestone-badge ${item.status}">${item.status === "achieved" ? "Achieved" : "In progress"}</div>
      <div class="stack-item-title">${item.title}</div>
      <div class="stack-item-body">${item.detail}</div>
    </div>
  `).join("");
}

function renderRecommendedDrills(player, reportMode) {
  const container = document.getElementById(reportMode ? "reportRecommendedDrillList" : "recommendedDrillList");
  if (!container) return;
  container.innerHTML = (player.recommended_drills || []).map((drill) => `
    <div class="stack-item">
      <div class="stack-item-title">${drill.title}</div>
      <div class="stack-item-body">${drill.goal}</div>
      <div class="drill-meta">${drill.duration_min} min</div>
    </div>
  `).join("");
}

function renderSessionPlan(player, reportMode) {
  const summaryId = reportMode ? "reportSessionPlanSummary" : "sessionPlanSummary";
  const blocksId = reportMode ? "reportSessionPlanBlocks" : "sessionPlanBlocks";
  const summary = document.getElementById(summaryId);
  const blocks = document.getElementById(blocksId);
  const plan = player.session_plan;
  if (!summary || !blocks || !plan) return;

  summary.innerHTML = `
    <div class="session-plan-stat"><div class="session-plan-stat-label">Focus</div><span class="session-plan-stat-value">${plan.focus}</span></div>
    <div class="session-plan-stat"><div class="session-plan-stat-label">Duration</div><span class="session-plan-stat-value">${plan.duration_min} min</span></div>
    <div class="session-plan-stat"><div class="session-plan-stat-label">Intensity</div><span class="session-plan-stat-value">${plan.intensity}</span></div>
  `;

  blocks.innerHTML = plan.blocks.map((block) => `
    <div class="stack-item">
      <div class="stack-item-title">${block.title}</div>
      <div class="stack-item-body">${block.detail}</div>
      <div class="plan-meta">${block.minutes} min</div>
    </div>
  `).join("");
}

function renderInsightLists(player, reportMode) {
  const strengths = document.getElementById(reportMode ? "reportStrengths" : "strengthsList");
  const weaknesses = document.getElementById(reportMode ? "reportWeaknesses" : "weaknessesList");
  if (strengths) {
    strengths.innerHTML = (player.insights?.strengths || []).map((item) => `<div class="stack-item"><div class="stack-item-body">${item}</div></div>`).join("");
  }
  if (weaknesses) {
    weaknesses.innerHTML = (player.insights?.weaknesses || []).map((item) => `<div class="stack-item"><div class="stack-item-body">${item}</div></div>`).join("");
  }
}

function renderCoachNotes(player, reportMode) {
  const notes = player.coach_notes || {};
  if (reportMode) {
    setStackList("reportCoachStrengths", notes.strengths);
    setStackList("reportCoachWeaknesses", notes.weaknesses);
    setStackList("reportCoachRecommendations", notes.recommendations);
    setStackList("reportCoachTactical", notes.tactical_observations);
    return;
  }
  setStackList("coachStrengthsList", notes.strengths);
  setStackList("coachWeaknessesList", notes.weaknesses);
  setStackList("coachRecommendationsList", notes.recommendations);
  setStackList("tacticalList", notes.tactical_observations);
}

function renderBenchmarks(player, reportMode) {
  const body = document.getElementById(reportMode ? "reportBenchmarkBody" : "benchmarkBody");
  if (!body) return;
  const rows = getBenchmarkRows(player);
  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.metric}</td>
      <td>${row.current.toFixed(2)}${row.metric.includes("%") ? "%" : ""}</td>
      <td>${row.benchmark.toFixed(2)}${row.metric.includes("%") ? "%" : ""}</td>
      <td class="${row.gap >= 0 ? "positive" : "negative"}">${row.gap >= 0 ? "+" : ""}${row.gap.toFixed(2)}${row.metric.includes("%") ? "%" : ""}</td>
      <td>${row.priority}</td>
    </tr>
  `).join("");
}

function renderRecommendations(player) {
  const container = document.getElementById("reportRecommendations");
  if (!container) return;
  const rows = getBenchmarkRows(player);
  const mainGap = [...rows].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
  container.innerHTML = `
    <div class="stack-item"><div class="stack-item-title">Primary focus</div><div class="stack-item-body">Prioritise ${getPriorityFix(player)} because it currently creates the biggest drag on performance.</div></div>
    <div class="stack-item"><div class="stack-item-title">Strength to build from</div><div class="stack-item-body">Anchor sessions around ${getBestShot(player)} to protect confidence while improving weaker areas.</div></div>
    <div class="stack-item"><div class="stack-item-title">Benchmark gap</div><div class="stack-item-body">Largest benchmark gap currently sits in ${mainGap?.metric || "core metrics"}, so training should link directly to that measure.</div></div>
  `;
}

function renderPlayerComparison() {
  const body = document.getElementById("playerComparisonBody");
  if (!body) return;
  body.innerHTML = Object.values(data.players).map((player) => {
    const totals = getTotals(player);
    return `
      <tr>
        <td>${player.player_name}</td>
        <td>${totals.shots}</td>
        <td>${totals.winners}</td>
        <td>${totals.errors}</td>
        <td>${totals.winnerPct.toFixed(1)}%</td>
        <td>${totals.errorPct.toFixed(1)}%</td>
        <td>${totals.efficiency.toFixed(2)}</td>
        <td>${getBestShot(player)}</td>
        <td>${getPriorityFix(player)}</td>
      </tr>
    `;
  }).join("");
}

function renderDetailTable(player, reportMode) {
  const body = document.getElementById(reportMode ? "reportDetailBody" : "detailTableBody");
  if (!body) return;
  body.innerHTML = (player.shot_summary || []).map((shot) => {
    const metrics = getShotMetrics(shot);
    return `
      <tr>
        <td>${shot.shot_type}</td>
        <td>${shot.shot_count}</td>
        <td>${shot.error_count}</td>
        <td>${shot.winner_count}</td>
        <td>${metrics.errorPct.toFixed(1)}%</td>
        <td>${metrics.winnerPct.toFixed(1)}%</td>
        <td>${metrics.efficiency.toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}

function renderTeamLists(players) {
  setStackHtml("milestoneList", `
    <div class="stack-item"><div class="stack-item-title">Squad progress</div><div class="stack-item-body">Winner output is improving across all three tracked players.</div></div>
    <div class="stack-item"><div class="stack-item-title">Squad priority</div><div class="stack-item-body">Backhand stability and overhead confidence remain the biggest shared leaks.</div></div>
  `);
  setStackHtml("recommendedDrillList", `
    <div class="stack-item"><div class="stack-item-title">Shared drill block</div><div class="stack-item-body">Run cross-court consistency, first-volley restraint, and bandeja margin drills as a group block.</div></div>
  `);
  setStackHtml("sessionPlanBlocks", `
    <div class="stack-item"><div class="stack-item-title">Team format</div><div class="stack-item-body">10 min technical prep, 15 min rally control, 15 min finishing patterns, 10 min constrained games.</div></div>
  `);
  setStackHtml("sessionPlanSummary", `
    <div class="session-plan-stat"><div class="session-plan-stat-label">Theme</div><span class="session-plan-stat-value">Squad error reduction</span></div>
    <div class="session-plan-stat"><div class="session-plan-stat-label">Duration</div><span class="session-plan-stat-value">50 min</span></div>
    <div class="session-plan-stat"><div class="session-plan-stat-label">Format</div><span class="session-plan-stat-value">Group</span></div>
  `);
  setStackHtml("strengthsList", `<div class="stack-item"><div class="stack-item-body">Squad confidence is growing, and winners are trending upward across recent matches.</div></div>`);
  setStackHtml("weaknessesList", `<div class="stack-item"><div class="stack-item-body">Errors are still concentrated in backhand and overhead situations.</div></div>`);
  setStackHtml("coachStrengthsList", `<div class="stack-item"><div class="stack-item-body">Players now show clearer individual identities and strengths.</div></div>`);
  setStackHtml("coachWeaknessesList", `<div class="stack-item"><div class="stack-item-body">Shared decision-making discipline is still inconsistent under pressure.</div></div>`);
  setStackHtml("coachRecommendationsList", `<div class="stack-item"><div class="stack-item-body">Keep one shared consistency block and one player-specific correction block in every session.</div></div>`);
  setStackHtml("tacticalList", `<div class="stack-item"><div class="stack-item-body">Build patterns from safe margins before trying to finish early in the point.</div></div>`);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setStackList(id, items = []) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = (items || []).map((item) => `<div class="stack-item"><div class="stack-item-body">${item}</div></div>`).join("");
}

function setStackHtml(id, html) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = html;
}

function clearElement(id) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = "";
}

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function trendDirection(values, lowerIsBetter = false) {
  if (!values || values.length < 2) return "stable";
  const delta = values[values.length - 1] - values[0];
  if (Math.abs(delta) < 1) return "stable";
  if (lowerIsBetter) return delta < 0 ? "improving" : "worsening";
  return delta > 0 ? "improving" : "worsening";
}
