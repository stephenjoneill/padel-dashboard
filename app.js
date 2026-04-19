/*************************************************************
 * Momentum Padel – Concept Refresh App
 * Works with the v2 data model used in this project
 *************************************************************/

let data = null;
let currentPlayerKey = null;
let currentPlan = localStorage.getItem("momentum_plan") || "starter";

let trendChartInstance = null;
let shotChartInstance = null;
let errorChartInstance = null;
let winnerChartInstance = null;
let reportTrendChartInstance = null;
let reportShotChartInstance = null;
let reportErrorChartInstance = null;

const FEATURE_FLAGS_DEFAULT = {
  benchmarking: true,
  trend_history: true,
  milestones: true,
  playbooks: true,
  session_plans: true,
  tutorial_mode: true,
  coach_insights: true,
  squad_comparison: true
};

let FEATURE_FLAGS = loadFeatureFlags();

const HELP_CONTENT = {
  trends: {
    title: "Trend analysis",
    cards: [
      {
        title: "What trend shows",
        body: "Trend sections show how winners, errors, and efficiency have changed across tracked matches."
      },
      {
        title: "How to use it",
        body: "Use trend movement to spot whether current training priorities are improving or leaking."
      }
    ]
  },
  plans: {
    title: "Session plans",
    cards: [
      {
        title: "How plans work",
        body: "Session plans translate current weaknesses and strengths into a ready-to-run training block."
      },
      {
        title: "Best use",
        body: "Use the focus block first, then anchor the session with a strength-based finish."
      }
    ]
  },
  insights: {
    title: "Insights",
    cards: [
      {
        title: "Auto analysis",
        body: "Auto analysis converts available shot data and history into strengths, weaknesses, and recommendations."
      },
      {
        title: "Coach insight",
        body: "Coach sections are written to feel more tactical and practical for demo storytelling."
      }
    ]
  },
  benchmarks: {
    title: "Benchmarks",
    cards: [
      {
        title: "How benchmark gap works",
        body: "Gap compares current player output against target performance levels for the selected measures."
      },
      {
        title: "Priority meaning",
        body: "High priority means the metric is likely to have the biggest immediate impact on match performance."
      }
    ]
  }
};

const TOUR_STEPS_DASHBOARD = [
  {
    target: "[data-tour='hero']",
    title: "Player overview",
    body: "This headline block gives the current player story, strongest shot, priority fix, and match count."
  },
  {
    target: "[data-tour='trends']",
    title: "Trend layer",
    body: "This section shows how winners, errors, and efficiency are moving across recent tracked matches."
  },
  {
    target: "[data-tour='comparison']",
    title: "Squad comparison",
    body: "Use this view to compare players quickly and spot who is strongest in each area."
  }
];

const TOUR_STEPS_REPORT = [
  {
    target: "[data-tour='report-hero']",
    title: "Report summary",
    body: "This block turns the player data into an executive-style summary for coaches or players."
  },
  {
    target: "[data-tour='trends']",
    title: "Trend evidence",
    body: "This shows whether the player story is backed up by recent match movement."
  },
  {
    target: "[data-tour='report-benchmarks']",
    title: "Benchmarking",
    body: "This helps position current performance against target standards."
  }
];

let activeTourSteps = [];
let activeTourIndex = 0;

/***********************
 * Init
 ***********************/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data.json");
    if (!res.ok) {
      throw new Error(`Failed to load data.json (${res.status})`);
    }

    data = await res.json();

    if (!data || !data.players || Object.keys(data.players).length === 0) {
      throw new Error("No players found in data.json");
    }

    syncPlanControls();
    setupSettingsPanel();
    setupHelp();
    setupTutorial();

    if (isReportPage()) {
      initReport();
    } else {
      initDashboard();
    }

    hideLoading();
    animateIn();
  } catch (err) {
    console.error(err);
    showError(err.message || "Unable to load app data.");
  }
});

function isReportPage() {
  return !!document.getElementById("reportPlayerName");
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

function animateIn() {
  const sections = document.querySelectorAll(".hero, .report-hero, .kpi-card, .panel, .report-card");
  sections.forEach((el, index) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = "opacity 0.45s ease, transform 0.45s ease";
    setTimeout(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 40 + index * 18);
  });
}

/***********************
 * Local helpers
 ***********************/
function loadFeatureFlags() {
  try {
    return JSON.parse(localStorage.getItem("momentum_feature_flags")) || { ...FEATURE_FLAGS_DEFAULT };
  } catch {
    return { ...FEATURE_FLAGS_DEFAULT };
  }
}

function saveFeatureFlags() {
  localStorage.setItem("momentum_feature_flags", JSON.stringify(FEATURE_FLAGS));
}

function isFeatureEnabled(flag) {
  return FEATURE_FLAGS[flag] === true;
}

function updatePlanBadge(value) {
  document.getElementById("dashboardPlanBadge")?.replaceChildren(document.createTextNode(value.replace("_", " ")));
  document.getElementById("reportPlanBadge")?.replaceChildren(document.createTextNode(value.replace("_", " ")));
}

function syncPlanControls() {
  const ids = ["planSelect", "planSelectMirror", "reportPlanSelect"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.value = currentPlan;
    el.addEventListener("change", (e) => {
      currentPlan = e.target.value;
      localStorage.setItem("momentum_plan", currentPlan);
      ids.forEach((otherId) => {
        const other = document.getElementById(otherId);
        if (other && other !== e.target) other.value = currentPlan;
      });
      updatePlanBadge(currentPlan);
      renderCurrent();
    });
  });

  updatePlanBadge(currentPlan);
}

function getPlayersObject() {
  return data.players || {};
}

function getPlayerKeys() {
  return Object.keys(getPlayersObject());
}

function getCurrentPlayer() {
  return getPlayersObject()[currentPlayerKey];
}

function number(value, fallback = 0) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function pct(numerator, denominator) {
  return denominator ? (numerator / denominator) * 100 : 0;
}

function formatPct(value, digits = 1) {
  return `${number(value).toFixed(digits)}%`;
}

function formatGap(value, isPercent = false) {
  const v = number(value);
  const sign = v > 0 ? "+" : "";
  return isPercent ? `${sign}${v.toFixed(2)}%` : `${sign}${v.toFixed(2)}`;
}

function sentenceCase(str) {
  if (!str) return "";
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function getPlayerName(player) {
  return (
    player?.profile?.name ||
    player?.player_name ||
    "Player"
  );
}

function getPlayerHeadline(player) {
  return (
    player?.profile?.headline ||
    player?.headline ||
    ""
  );
}

function getPlayerSummary(player) {
  return (
    player?.profile?.summary ||
    player?.summary ||
    ""
  );
}

function getShotSummary(player) {
  return player?.shot_summary || [];
}

function getTotals(player) {
  const shots = getShotSummary(player);

  const totals = shots.reduce(
    (acc, shot) => {
      acc.shots += number(shot.shot_count);
      acc.errors += number(shot.error_count);
      acc.winners += number(shot.winner_count);
      return acc;
    },
    { shots: 0, errors: 0, winners: 0 }
  );

  totals.winnerPct = pct(totals.winners, totals.shots);
  totals.errorPct = pct(totals.errors, totals.shots);
  totals.efficiency = totals.errors ? totals.winners / totals.errors : totals.winners;

  return totals;
}

function getBestShotObject(player) {
  const shots = [...getShotSummary(player)];
  if (!shots.length) return null;

  shots.sort((a, b) => {
    const aScore = number(a.winner_count) - number(a.error_count);
    const bScore = number(b.winner_count) - number(b.error_count);
    return bScore - aScore;
  });

  return shots[0];
}

function getPriorityFixObject(player) {
  const shots = [...getShotSummary(player)];
  if (!shots.length) return null;

  shots.sort((a, b) => {
    const aRate = pct(number(a.error_count), number(a.shot_count));
    const bRate = pct(number(b.error_count), number(b.shot_count));
    return bRate - aRate;
  });

  return shots[0];
}

function getBestShotLabel(player) {
  const best = getBestShotObject(player);
  return best ? best.shot_type : "—";
}

function getPriorityFixLabel(player) {
  const fix = getPriorityFixObject(player);
  return fix ? fix.shot_type : "—";
}

function getMatchesTracked(player) {
  if (Array.isArray(player?.history) && player.history.length) return player.history.length;
  if (player?.kpis?.matches_tracked) return player.kpis.matches_tracked;
  return 6;
}

function getHistory(player) {
  if (Array.isArray(player?.history) && player.history.length) {
    return player.history.map((row, index) => {
      const shots = number(row.shots);
      const winners = number(row.winners);
      const errors = number(row.errors);
      return {
        match: row.match || `M${index + 1}`,
        date: row.date || "-",
        shots,
        winners,
        errors,
        winnerPct: row.winner_pct ?? pct(winners, shots),
        errorPct: row.error_pct ?? pct(errors, shots),
        efficiency: row.efficiency ?? (errors ? winners / errors : winners)
      };
    });
  }

  const totals = getTotals(player);
  const baseShots = totals.shots;
  const baseErrors = totals.errors;
  const baseWinners = totals.winners;

  return Array.from({ length: 6 }).map((_, i) => {
    const shots = Math.max(20, Math.round(baseShots - (5 - i) * 3));
    const errors = Math.max(3, Math.round(baseErrors + (2 - i)));
    const winners = Math.max(2, Math.round(baseWinners - 2 + i));
    return {
      match: `M${i + 1}`,
      date: "-",
      shots,
      winners,
      errors,
      winnerPct: pct(winners, shots),
      errorPct: pct(errors, shots),
      efficiency: errors ? winners / errors : winners
    };
  });
}

function getMilestones(player) {
  if (Array.isArray(player?.milestones) && player.milestones.length) return player.milestones;

  const fix = getPriorityFixLabel(player);
  const best = getBestShotLabel(player);

  return [
    {
      status: "In progress",
      title: `${fix} error rate below 40%`,
      body: `Current priority is to reduce ${fix.toLowerCase()} leakage across recent matches.`
    },
    {
      status: "Achieved",
      title: `${best} remains primary point-builder`,
      body: `${best} still leads winner contribution and rally control.`
    }
  ];
}

function getRecommendedDrills(player) {
  if (Array.isArray(player?.recommended_drills) && player.recommended_drills.length) {
    return player.recommended_drills;
  }

  const fix = getPriorityFixLabel(player);
  const best = getBestShotLabel(player);

  return [
    {
      title: `${fix} wall rhythm`,
      description: `Stabilise ${fix.toLowerCase()} contact and height tolerance.`,
      duration: "12 min"
    },
    {
      title: `Serve + first ball ${best.toLowerCase()} pattern`,
      description: `Use strength to own the second shot.`,
      duration: "15 min"
    },
    {
      title: `Cross-court return decisions`,
      description: `Reduce rushed attacking choices.`,
      duration: "10 min"
    }
  ];
}

function getSessionPlan(player) {
  if (player?.session_plan) return player.session_plan;

  const fix = getPriorityFixLabel(player);

  return {
    focus: fix,
    duration: "50 min",
    intensity: "Moderate",
    blocks: [
      {
        title: "Technical warm-up",
        description: `${fix} rhythm, spacing, and controlled tempo.`,
        duration: "10 min"
      },
      {
        title: "Pressure repeaters",
        description: `${fix} under movement with target-zone scoring.`,
        duration: "15 min"
      },
      {
        title: "Pattern play",
        description: `Build points into forehand finish after safe ${fix.toLowerCase()} neutralisation.`,
        duration: "15 min"
      },
      {
        title: "Competitive games",
        description: `Score-based points starting from return situations.`,
        duration: "10 min"
      }
    ]
  };
}

function getAnalysis(player) {
  if (player?.analysis) return player.analysis;

  const best = getBestShotLabel(player);
  const fix = getPriorityFixLabel(player);

  return {
    strengths: [
      `${best} remains the cleanest attacking platform.`,
      `Winner production is trending up match to match.`
    ],
    weaknesses: [
      `${fix} error burden is still the main leak.`,
      `Returns can become too aggressive too early in the rally.`
    ],
    coach_strengths: [
      `Calm on ${best.toLowerCase()} setup balls.`,
      `Better patience before accelerating.`
    ],
    coach_weaknesses: [
      `${fix} shape breaks down under pace.`,
      `Needs more disciplined first-return targets.`
    ],
    coach_recommendations: [
      `Train ${fix.toLowerCase()} height tolerance.`,
      `Use ${best.toLowerCase()} patterns after safe neutral balls.`
    ],
    tactical: [
      `Keep points cross-court longer before redirecting.`,
      `Do not force line changes from unstable ${fix.toLowerCase()} positions.`
    ],
    auto_recommendations: [
      {
        title: "Primary focus",
        body: `Prioritise ${fix} because it currently creates the biggest drag on performance.`
      },
      {
        title: "Strength to build from",
        body: `Anchor sessions around ${best} to protect confidence while improving weaker areas.`
      },
      {
        title: "Benchmark gap",
        body: `Use the largest benchmark gap to decide the most valuable training emphasis.`
      }
    ]
  };
}

function getBenchmarks(player) {
  if (Array.isArray(player?.benchmarks) && player.benchmarks.length) return player.benchmarks;

  const totals = getTotals(player);
  const shots = getShotSummary(player);
  const volley = shots.find((s) => String(s.shot_type).toLowerCase() === "volley");
  const overhead = shots.find((s) => String(s.shot_type).toLowerCase() === "overhead");

  const currentVolleyWinner = volley ? pct(number(volley.winner_count), number(volley.shot_count)) : 0;
  const currentOverheadError = overhead ? pct(number(overhead.error_count), number(overhead.shot_count)) : 0;

  return [
    {
      metric: "Winner %",
      current: totals.winnerPct,
      benchmark: 18.0,
      gap: totals.winnerPct - 18.0,
      priority: "Medium",
      percent: true
    },
    {
      metric: "Error %",
      current: totals.errorPct,
      benchmark: 20.0,
      gap: totals.errorPct - 20.0,
      priority: "High",
      percent: true
    },
    {
      metric: "Efficiency",
      current: totals.efficiency,
      benchmark: 0.95,
      gap: totals.efficiency - 0.95,
      priority: "Medium",
      percent: false
    },
    {
      metric: "Volley winner %",
      current: currentVolleyWinner,
      benchmark: 22.0,
      gap: currentVolleyWinner - 22.0,
      priority: "Medium",
      percent: true
    },
    {
      metric: "Overhead error %",
      current: currentOverheadError,
      benchmark: 18.0,
      gap: currentOverheadError - 18.0,
      priority: "High",
      percent: true
    }
  ];
}

/***********************
 * Dashboard Init
 ***********************/
function initDashboard() {
  const keys = getPlayerKeys();
  currentPlayerKey = keys[0];

  const playerSelect = document.getElementById("playerSelect");
  if (playerSelect) {
    playerSelect.innerHTML = keys
      .map((key) => {
        const player = getPlayersObject()[key];
        return `<option value="${key}">${getPlayerName(player)}</option>`;
      })
      .join("");

    playerSelect.value = currentPlayerKey;
    playerSelect.addEventListener("change", (e) => {
      currentPlayerKey = e.target.value;
      updateReportLinks();
      renderDashboard();
    });
  }

  const viewModeSelect = document.getElementById("viewModeSelect");
  if (viewModeSelect) {
    viewModeSelect.addEventListener("change", () => {
      const teamMode = viewModeSelect.value === "team";
      const playerWrap = document.getElementById("playerControlWrap");
      if (playerWrap) {
        playerWrap.style.display = teamMode ? "none" : "";
      }
      renderDashboard();
    });
  }

  updateReportLinks();
  renderDashboard();
}

/***********************
 * Report Init
 ***********************/
function initReport() {
  const keys = getPlayerKeys();
  const params = new URLSearchParams(window.location.search);
  const queryPlayer = params.get("player");

  currentPlayerKey = getPlayersObject()[queryPlayer] ? queryPlayer : keys[0];
  renderReport();
}

/***********************
 * Shared render
 ***********************/
function renderCurrent() {
  if (isReportPage()) {
    renderReport();
  } else {
    renderDashboard();
  }
}

function updateReportLinks() {
  const href = `report.html?player=${encodeURIComponent(currentPlayerKey)}`;
  const reportLink = document.getElementById("reportLink");
  const heroReportLink = document.getElementById("heroReportLink");

  if (reportLink) reportLink.href = href;
  if (heroReportLink) heroReportLink.href = href;
}

/***********************
 * Dashboard Render
 ***********************/
function renderDashboard() {
  const player = getCurrentPlayer();
  if (!player) return;

  const totals = getTotals(player);
  const history = getHistory(player);
  const analysis = getAnalysis(player);

  document.getElementById("heroPlayerName")?.replaceChildren(document.createTextNode(getPlayerName(player)));
  document.getElementById("heroSubheading")?.replaceChildren(document.createTextNode(getPlayerHeadline(player)));
  document.getElementById("heroSummary")?.replaceChildren(document.createTextNode(getPlayerSummary(player)));
  document.getElementById("heroBestShot")?.replaceChildren(document.createTextNode(getBestShotLabel(player)));
  document.getElementById("heroPriorityFix")?.replaceChildren(document.createTextNode(getPriorityFixLabel(player)));
  document.getElementById("heroMatchesTracked")?.replaceChildren(document.createTextNode(String(getMatchesTracked(player))));
  document.getElementById("detailTitle")?.replaceChildren(document.createTextNode(`${getPlayerName(player)} Shot Detail`));

  renderKpis("kpiGrid", totals);
  renderTrend(player, false, history);
  renderShotCharts(player, false);
  renderDetailTable(player, false);
  renderMilestones(player, false);
  renderDrills(player, false);
  renderSessionPlan(player, false);
  renderAnalysis(player, false, analysis);
  renderBenchmarks(player, false);
  renderPlayerComparison();
  applyPlanVisibility(false);
}

/***********************
 * Report Render
 ***********************/
function renderReport() {
  const player = getCurrentPlayer();
  if (!player) return;

  const totals = getTotals(player);
  const history = getHistory(player);
  const analysis = getAnalysis(player);

  document.getElementById("reportPlayerName")?.replaceChildren(document.createTextNode(getPlayerName(player)));
  document.getElementById("reportHeadline")?.replaceChildren(document.createTextNode(getPlayerHeadline(player)));
  document.getElementById("reportSummary")?.replaceChildren(document.createTextNode(getPlayerSummary(player)));
  document.getElementById("reportBestShot")?.replaceChildren(document.createTextNode(getBestShotLabel(player)));
  document.getElementById("reportPriorityFix")?.replaceChildren(document.createTextNode(getPriorityFixLabel(player)));
  document.getElementById("reportTotalShots")?.replaceChildren(document.createTextNode(String(totals.shots)));
  document.getElementById("reportEfficiency")?.replaceChildren(document.createTextNode(totals.efficiency.toFixed(2)));
  document.getElementById("reportMatchesTracked")?.replaceChildren(document.createTextNode(String(getMatchesTracked(player))));

  renderKpis("reportKpis", totals);
  renderTrend(player, true, history);
  renderShotCharts(player, true);
  renderDetailTable(player, true);
  renderMilestones(player, true);
  renderDrills(player, true);
  renderSessionPlan(player, true);
  renderAnalysis(player, true, analysis);
  renderBenchmarks(player, true);
  applyPlanVisibility(true);
}

/***********************
 * KPI Render
 ***********************/
function getKpiStory(totals) {
  return [
    {
      label: "Total shots",
      value: totals.shots,
      sub: "Tracked attempts"
    },
    {
      label: "Winners",
      value: totals.winners,
      sub: formatPct(totals.winnerPct)
    },
    {
      label: "Errors",
      value: totals.errors,
      sub: formatPct(totals.errorPct)
    },
    {
      label: "Efficiency",
      value: totals.efficiency.toFixed(2),
      sub: "Winners / errors"
    }
  ];
}

function renderKpis(containerId, totals) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = getKpiStory(totals)
    .map(
      (kpi) => `
      <div class="kpi-card">
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value">${kpi.value}</div>
        <div class="kpi-sub">${kpi.sub}</div>
      </div>
    `
    )
    .join("");
}

/***********************
 * Chart helpers
 ***********************/
function buildGradient(canvas, colorTop, colorBottom) {
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  return gradient;
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: "easeOutQuart"
    },
    interaction: {
      intersect: false,
      mode: "index"
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
          color: "#5d7090",
          font: {
            family: "Inter",
            size: 11,
            weight: "600"
          }
        }
      },
      tooltip: {
        backgroundColor: "rgba(19, 30, 49, 0.94)",
        padding: 12,
        titleFont: {
          family: "Inter",
          weight: "700"
        },
        bodyFont: {
          family: "Inter"
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: "#7386a4",
          font: {
            family: "Inter",
            size: 11
          }
        },
        border: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#7386a4",
          font: {
            family: "Inter",
            size: 11
          }
        },
        grid: {
          color: "rgba(115, 134, 164, 0.14)"
        },
        border: {
          display: false
        }
      }
    }
  };
}

/***********************
 * Trend / History
 ***********************/
function renderTrend(player, isReport, history) {
  if (!isFeatureEnabled("trend_history")) return;

  const chartId = isReport ? "reportTrendChart" : "trendChart";
  const tableId = isReport ? "reportHistoryTableBody" : "historyTableBody";
  const signalId = isReport ? "reportTrendSignalList" : "trendSignalList";

  const chartCanvas = document.getElementById(chartId);

  if (chartCanvas) {
    const winnerGradient = buildGradient(chartCanvas, "rgba(91,109,255,0.35)", "rgba(91,109,255,0.04)");
    const errorGradient = buildGradient(chartCanvas, "rgba(242,85,138,0.25)", "rgba(242,85,138,0.03)");
    const effGradient = buildGradient(chartCanvas, "rgba(34,181,115,0.18)", "rgba(34,181,115,0.02)");

    const chartOptions = baseChartOptions();
    chartOptions.plugins.legend.display = true;
    chartOptions.elements = {
      line: {
        tension: 0.38,
        borderWidth: 2.4
      },
      point: {
        radius: 3,
        hoverRadius: 4,
        borderWidth: 0
      }
    };

    const chartConfig = {
      type: "line",
      data: {
        labels: history.map((h) => h.match),
        datasets: [
          {
            label: "Winners",
            data: history.map((h) => h.winners),
            borderColor: "#5b6dff",
            backgroundColor: winnerGradient,
            fill: false
          },
          {
            label: "Errors",
            data: history.map((h) => h.errors),
            borderColor: "#f2558a",
            backgroundColor: errorGradient,
            fill: false
          },
          {
            label: "Efficiency",
            data: history.map((h) => Number(h.efficiency.toFixed(2))),
            borderColor: "#22b573",
            backgroundColor: effGradient,
            fill: false,
            yAxisID: "y"
          }
        ]
      },
      options: chartOptions
    };

    if (isReport) {
      destroyChart(reportTrendChartInstance);
      reportTrendChartInstance = new Chart(chartCanvas, chartConfig);
    } else {
      destroyChart(trendChartInstance);
      trendChartInstance = new Chart(chartCanvas, chartConfig);
    }
  }

  const table = document.getElementById(tableId);
  if (table) {
    table.innerHTML = history
      .map(
        (h) => `
        <tr>
          <td>${h.match}</td>
          <td>${h.date}</td>
          <td>${h.shots}</td>
          <td>${h.winners}</td>
          <td>${h.errors}</td>
          <td>${formatPct(h.winnerPct)}</td>
          <td>${formatPct(h.errorPct)}</td>
          <td>${Number(h.efficiency).toFixed(2)}</td>
        </tr>
      `
      )
      .join("");
  }

  const signalList = document.getElementById(signalId);
  if (signalList) {
    const best = getBestShotLabel(player);
    const fix = getPriorityFixLabel(player);

    signalList.innerHTML = `
      <div class="stack-item">
        <div class="stack-item-title">Signal</div>
        <div class="stack-item-body">Best shot remains ${best.toLowerCase()}.</div>
      </div>
      <div class="stack-item">
        <div class="stack-item-title">Signal</div>
        <div class="stack-item-body">Priority fix remains ${fix.toLowerCase()}.</div>
      </div>
      <div class="stack-item">
        <div class="stack-item-title">Signal</div>
        <div class="stack-item-body">Recent trend shows improving winner output and improving error burden.</div>
      </div>
    `;
  }
}

/***********************
 * Shot charts
 ***********************/
function renderShotCharts(player, isReport) {
  const labels = getShotSummary(player).map((s) => s.shot_type);
  const shotCounts = getShotSummary(player).map((s) => number(s.shot_count));
  const errorCounts = getShotSummary(player).map((s) => number(s.error_count));
  const winnerCounts = getShotSummary(player).map((s) => number(s.winner_count));

  const shotCanvas = document.getElementById(isReport ? "reportShotChart" : "shotChart");
  const errorCanvas = document.getElementById(isReport ? "reportErrorChart" : "errorChart");
  const winnerCanvas = document.getElementById(isReport ? null : "winnerChart");

  if (shotCanvas) {
    const doughnutColors = ["#5b9cf0", "#f2558a", "#f7a03b", "#f1c24f", "#66c5b3", "#8b7dff"];
    const config = {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: shotCounts,
            backgroundColor: doughnutColors.slice(0, labels.length),
            borderWidth: 0,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "52%",
        plugins: {
          legend: {
            position: "top",
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              color: "#5d7090",
              font: {
                family: "Inter",
                size: 11,
                weight: "600"
              }
            }
          }
        },
        animation: {
          duration: 700
        }
      }
    };

    if (isReport) {
      destroyChart(reportShotChartInstance);
      reportShotChartInstance = new Chart(shotCanvas, config);
    } else {
      destroyChart(shotChartInstance);
      shotChartInstance = new Chart(shotCanvas, config);
    }
  }

  if (errorCanvas) {
    const gradient = buildGradient(errorCanvas, "rgba(111,167,255,0.70)", "rgba(111,167,255,0.28)");
    const config = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Errors",
            data: errorCounts,
            backgroundColor: gradient,
            borderRadius: 10,
            borderSkipped: false
          }
        ]
      },
      options: baseChartOptions()
    };

    if (isReport) {
      destroyChart(reportErrorChartInstance);
      reportErrorChartInstance = new Chart(errorCanvas, config);
    } else {
      destroyChart(errorChartInstance);
      errorChartInstance = new Chart(errorCanvas, config);
    }
  }

  if (winnerCanvas) {
    const gradient = buildGradient(winnerCanvas, "rgba(91,109,255,0.65)", "rgba(91,109,255,0.25)");
    const config = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Winners",
            data: winnerCounts,
            backgroundColor: gradient,
            borderRadius: 10,
            borderSkipped: false
          }
        ]
      },
      options: baseChartOptions()
    };

    destroyChart(winnerChartInstance);
    winnerChartInstance = new Chart(winnerCanvas, config);
  }
}

/***********************
 * Tables
 ***********************/
function renderDetailTable(player, isReport) {
  const tbody = document.getElementById(isReport ? "reportDetailBody" : "detailTableBody");
  if (!tbody) return;

  tbody.innerHTML = getShotSummary(player)
    .map((shot) => {
      const shots = number(shot.shot_count);
      const errors = number(shot.error_count);
      const winners = number(shot.winner_count);
      const errorPct = pct(errors, shots);
      const winnerPct = pct(winners, shots);
      const efficiency = errors ? winners / errors : winners;

      return `
        <tr>
          <td>${shot.shot_type}</td>
          <td>${shots}</td>
          <td>${errors}</td>
          <td>${winners}</td>
          <td>${formatPct(errorPct)}</td>
          <td>${formatPct(winnerPct)}</td>
          <td>${efficiency.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPlayerComparison() {
  if (!isFeatureEnabled("squad_comparison")) return;

  const tbody = document.getElementById("playerComparisonBody");
  if (!tbody) return;

  tbody.innerHTML = getPlayerKeys()
    .map((key) => {
      const player = getPlayersObject()[key];
      const totals = getTotals(player);

      return `
        <tr>
          <td>${getPlayerName(player)}</td>
          <td>${totals.shots}</td>
          <td>${totals.winners}</td>
          <td>${totals.errors}</td>
          <td>${formatPct(totals.winnerPct)}</td>
          <td>${formatPct(totals.errorPct)}</td>
          <td>${totals.efficiency.toFixed(2)}</td>
          <td>${getBestShotLabel(player)}</td>
          <td>${getPriorityFixLabel(player)}</td>
        </tr>
      `;
    })
    .join("");
}

/***********************
 * Milestones / drills / session plans
 ***********************/
function renderMilestones(player, isReport) {
  if (!isFeatureEnabled("milestones")) return;

  const container = document.getElementById(isReport ? "reportMilestoneList" : "milestoneList");
  if (!container) return;

  container.innerHTML = getMilestones(player)
    .map((item) => {
      const badgeClass = String(item.status || "").toLowerCase().includes("ach") ? "achieved" : "progress";
      return `
        <div class="stack-item">
          <div class="milestone-badge ${badgeClass}">${item.status || "In progress"}</div>
          <div class="stack-item-title">${item.title}</div>
          <div class="stack-item-body">${item.body || ""}</div>
        </div>
      `;
    })
    .join("");
}

function renderDrills(player, isReport) {
  if (!isFeatureEnabled("playbooks")) return;

  const container = document.getElementById(isReport ? "reportRecommendedDrillList" : "recommendedDrillList");
  if (!container) return;

  container.innerHTML = getRecommendedDrills(player)
    .map(
      (drill) => `
        <div class="stack-item">
          <div class="stack-item-title">${drill.title}</div>
          <div class="stack-item-body">${drill.description || ""}</div>
          <div class="drill-meta">${drill.duration || ""}</div>
        </div>
      `
    )
    .join("");
}

function renderSessionPlan(player, isReport) {
  if (!isFeatureEnabled("session_plans")) return;

  const plan = getSessionPlan(player);
  const summary = document.getElementById(isReport ? "reportSessionPlanSummary" : "sessionPlanSummary");
  const blocks = document.getElementById(isReport ? "reportSessionPlanBlocks" : "sessionPlanBlocks");

  if (summary) {
    summary.innerHTML = `
      <div class="session-plan-stat">
        <div class="session-plan-stat-label">Focus</div>
        <span class="session-plan-stat-value">${plan.focus || "Focus area"}</span>
      </div>
      <div class="session-plan-stat">
        <div class="session-plan-stat-label">Duration</div>
        <span class="session-plan-stat-value">${plan.duration || "45 min"}</span>
      </div>
      <div class="session-plan-stat">
        <div class="session-plan-stat-label">Intensity</div>
        <span class="session-plan-stat-value">${plan.intensity || "Moderate"}</span>
      </div>
    `;
  }

  if (blocks) {
    blocks.innerHTML = (plan.blocks || [])
      .map(
        (block) => `
          <div class="stack-item">
            <div class="stack-item-title">${block.title}</div>
            <div class="stack-item-body">${block.description || ""}</div>
            <div class="plan-meta">${block.duration || ""}</div>
          </div>
        `
      )
      .join("");
  }
}

/***********************
 * Analysis / benchmarks
 ***********************/
function renderSimpleList(containerId, values) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = (values || [])
    .map((item) => {
      if (typeof item === "string") {
        return `
          <div class="stack-item">
            <div class="stack-item-body">${item}</div>
          </div>
        `;
      }

      return `
        <div class="stack-item">
          <div class="stack-item-title">${item.title || ""}</div>
          <div class="stack-item-body">${item.body || item.description || ""}</div>
        </div>
      `;
    })
    .join("");
}

function renderAnalysis(player, isReport, analysis) {
  renderSimpleList(isReport ? "reportStrengths" : "strengthsList", analysis.strengths);
  renderSimpleList(isReport ? "reportWeaknesses" : "weaknessesList", analysis.weaknesses);
  renderSimpleList(isReport ? "reportCoachStrengths" : "coachStrengthsList", analysis.coach_strengths);
  renderSimpleList(isReport ? "reportCoachWeaknesses" : "coachWeaknessesList", analysis.coach_weaknesses);
  renderSimpleList(isReport ? "reportCoachRecommendations" : "coachRecommendationsList", analysis.coach_recommendations);
  renderSimpleList(isReport ? "reportCoachTactical" : "tacticalList", analysis.tactical);

  if (isReport) {
    renderSimpleList("reportRecommendations", analysis.auto_recommendations);
  }
}

function renderBenchmarks(player, isReport) {
  if (!isFeatureEnabled("benchmarking")) return;

  const tbody = document.getElementById(isReport ? "reportBenchmarkBody" : "benchmarkBody");
  if (!tbody) return;

  tbody.innerHTML = getBenchmarks(player)
    .map((row) => {
      const positive = number(row.gap) > 0;
      const gapClass = positive ? "positive" : "negative";

      return `
        <tr>
          <td>${row.metric}</td>
          <td>${row.percent ? formatPct(row.current, 2) : number(row.current).toFixed(2)}</td>
          <td>${row.percent ? formatPct(row.benchmark, 2) : number(row.benchmark).toFixed(2)}</td>
          <td class="${gapClass}">${formatGap(row.gap, row.percent)}</td>
          <td>${row.priority}</td>
        </tr>
      `;
    })
    .join("");
}

/***********************
 * Plan visibility
 ***********************/
function applyPlanVisibility(isReport) {
  const plan = String(currentPlan).toLowerCase();

  const sections = {
    benchmarking: document.getElementById(isReport ? "reportBenchmarkSection" : "benchmarkSection"),
    milestones: document.getElementById(isReport ? "reportMilestonesSection" : "milestonesSection"),
    playbooks: document.getElementById(isReport ? "reportRecommendedDrillsSection" : "recommendedDrillsSection"),
    sessionPlans: document.getElementById(isReport ? "reportSessionPlanSection" : "sessionPlanSection"),
    coachInsights: document.getElementById(isReport ? "reportCoachInsightsSection" : "coachInsightsSection"),
    tactical: document.getElementById(isReport ? "reportTacticalSection" : "tacticalSection"),
    recommendations: document.getElementById(isReport ? "reportRecommendationsSection" : null),
    comparison: document.getElementById(isReport ? null : "playerComparisonPanel")
  };

  // all visible by default
  Object.values(sections).forEach((el) => {
    if (el) el.style.display = "";
  });

  if (plan === "starter") {
    if (sections.coachInsights) sections.coachInsights.style.display = "none";
    if (sections.tactical) sections.tactical.style.display = "none";
    if (sections.recommendations) sections.recommendations.style.display = "none";
    if (sections.comparison) sections.comparison.style.display = "none";
  }

  if (plan === "coach_pro") {
    if (sections.comparison) sections.comparison.style.display = "none";
  }
}

/***********************
 * Settings panel
 ***********************/
function setupSettingsPanel() {
  const panel = document.getElementById("settingsPanel");
  const toggleBtn = document.getElementById("settingsToggleBtn");
  const featureList = document.getElementById("featureToggleList");
  const resetBtn = document.getElementById("settingsResetBtn");

  if (!panel || !featureList) return;

  renderFeatureToggles();

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      panel.classList.toggle("hidden");
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      FEATURE_FLAGS = { ...FEATURE_FLAGS_DEFAULT };
      saveFeatureFlags();
      renderFeatureToggles();
      renderCurrent();
    });
  }

  function renderFeatureToggles() {
    featureList.innerHTML = Object.keys(FEATURE_FLAGS)
      .map((flag) => {
        const checked = FEATURE_FLAGS[flag] ? "checked" : "";
        return `
          <label class="feature-toggle">
            <input type="checkbox" data-flag="${flag}" ${checked} />
            <span class="feature-toggle-copy">${sentenceCase(flag.replace(/_/g, " "))}</span>
          </label>
        `;
      })
      .join("");

    featureList.querySelectorAll("input[data-flag]").forEach((input) => {
      input.addEventListener("change", (e) => {
        const flag = e.target.getAttribute("data-flag");
        FEATURE_FLAGS[flag] = e.target.checked;
        saveFeatureFlags();
        renderCurrent();
      });
    });
  }
}

/***********************
 * Help
 ***********************/
function setupHelp() {
  const openBtn = document.getElementById("openHelpBtn");
  const closeBtn = document.getElementById("closeHelpBtn");
  const drawer = document.getElementById("helpDrawer");
  const title = document.getElementById("helpTitle");
  const chips = document.getElementById("helpTopicChips");
  const body = document.getElementById("helpBody");
  const search = document.getElementById("helpSearchInput");

  if (!drawer || !chips || !body) return;

  let activeTopic = "trends";

  const renderHelp = () => {
    const topic = HELP_CONTENT[activeTopic] || HELP_CONTENT.trends;
    if (title) title.textContent = topic.title;

    chips.innerHTML = Object.keys(HELP_CONTENT)
      .map((key) => {
        const activeClass = key === activeTopic ? "active" : "";
        return `<button class="help-topic-chip ${activeClass}" type="button" data-topic="${key}">${sentenceCase(key)}</button>`;
      })
      .join("");

    const query = (search?.value || "").trim().toLowerCase();

    body.innerHTML = topic.cards
      .filter((card) => {
        if (!query) return true;
        return `${card.title} ${card.body}`.toLowerCase().includes(query);
      })
      .map(
        (card) => `
          <div class="help-card">
            <h4>${card.title}</h4>
            <p>${card.body}</p>
          </div>
        `
      )
      .join("");

    chips.querySelectorAll("[data-topic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTopic = btn.getAttribute("data-topic");
        renderHelp();
      });
    });
  };

  openBtn?.addEventListener("click", () => {
    drawer.classList.remove("hidden");
    renderHelp();
  });

  closeBtn?.addEventListener("click", () => {
    drawer.classList.add("hidden");
  });

  document.querySelectorAll("[data-help-topic]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTopic = btn.getAttribute("data-help-topic") || "trends";
      drawer.classList.remove("hidden");
      renderHelp();
    });
  });

  search?.addEventListener("input", renderHelp);
}

/***********************
 * Tutorial
 ***********************/
function setupTutorial() {
  const startBtn = document.getElementById("startTourBtn");
  const overlay = document.getElementById("tourOverlay");
  const title = document.getElementById("tourTitle");
  const body = document.getElementById("tourBody");
  const meta = document.getElementById("tourMeta");
  const nextBtn = document.getElementById("tourNextBtn");
  const backBtn = document.getElementById("tourBackBtn");
  const skipBtn = document.getElementById("tourSkipBtn");

  if (!startBtn || !overlay || !title || !body || !meta || !nextBtn || !backBtn || !skipBtn) return;

  const clearTargets = () => {
    document.querySelectorAll(".tour-target-active").forEach((el) => {
      el.classList.remove("tour-target-active");
    });
  };

  const renderStep = () => {
    clearTargets();

    const step = activeTourSteps[activeTourIndex];
    if (!step) return;

    title.textContent = step.title;
    body.textContent = step.body;
    meta.textContent = `${activeTourIndex + 1} of ${activeTourSteps.length}`;

    const target = document.querySelector(step.target);
    if (target) {
      target.classList.add("tour-target-active");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    backBtn.disabled = activeTourIndex === 0;
    nextBtn.textContent = activeTourIndex === activeTourSteps.length - 1 ? "Finish" : "Next";
  };

  startBtn.addEventListener("click", () => {
    activeTourSteps = isReportPage() ? TOUR_STEPS_REPORT : TOUR_STEPS_DASHBOARD;
    activeTourIndex = 0;
    overlay.classList.remove("hidden");
    renderStep();
  });

  backBtn.addEventListener("click", () => {
    if (activeTourIndex > 0) {
      activeTourIndex -= 1;
      renderStep();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (activeTourIndex < activeTourSteps.length - 1) {
      activeTourIndex += 1;
      renderStep();
    } else {
      overlay.classList.add("hidden");
      clearTargets();
    }
  });

  skipBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    clearTargets();
  });
}
