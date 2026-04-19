let appData = null;
let dashboardCharts = {};
let reportCharts = {};

const palette = [
  "#49ACD9",
  "#C0D942",
  "#B4FF00",
  "#6FC2E8",
  "#89A7C2",
  "#8ED081",
  "#FFD166",
  "#A78BFA",
  "#FF8C69",
  "#5ED6A1"
];

loadData();

async function loadData() {
  try {
    toggle("loadingState", true);
    toggle("errorState", false);
    toggle("reportLoadingState", true);
    toggle("reportErrorState", false);

    const res = await fetch("./data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json();
    appData = hydrateData(raw);

    if (document.getElementById("playerSelect")) initDashboard();
    if (document.getElementById("reportPlayerName")) initReport();
  } catch (err) {
    console.error(err);
    toggle("loadingState", false);
    toggle("reportLoadingState", false);
    toggle("errorState", true);
    toggle("reportErrorState", true);
  }
}

function hydrateData(raw) {
  const players = {};

  for (const [key, player] of Object.entries(raw.players || {})) {
    const shotSummary = (player.shot_summary || [])
      .map(row => ({
        ...row,
        error_rate: pct(row.error_count, row.shot_count),
        winner_rate: pct(row.winner_count, row.shot_count),
        efficiency: row.winner_count - row.error_count
      }))
      .sort((a, b) => b.shot_count - a.shot_count);

    const kpis = getTotals(shotSummary);
    const rankedStrengths = rankStrengths(shotSummary);
    const rankedWeaknesses = rankWeaknesses(shotSummary);

    players[key] = {
      ...player,
      player_key: key,
      shot_summary: shotSummary,
      kpis,
      best_shot: rankedStrengths[0]?.shot_type || "No clear leader",
      priority_fix: rankedWeaknesses[0]?.shot_type || "No clear priority",
      strengths: buildStrengths(rankedStrengths),
      weaknesses: buildWeaknesses(rankedWeaknesses),
      recommendations: buildRecommendations(rankedStrengths, rankedWeaknesses),
      benchmarkRows: buildBenchmarkRows(player, shotSummary, kpis, raw.benchmarks?.[player.level.toLowerCase()])
    };
  }

  return {
    ...raw,
    players,
    teamView: buildTeamView(raw, players)
  };
}

function buildTeamView(raw, players) {
  const shotMap = {};
  const coach = {
    strengths: [],
    weaknesses: [],
    recommendations: [],
    tactical: []
  };

  Object.values(players).forEach(player => {
    player.shot_summary.forEach(row => {
      if (!shotMap[row.shot_type]) {
        shotMap[row.shot_type] = {
          shot_type: row.shot_type,
          shot_count: 0,
          error_count: 0,
          winner_count: 0
        };
      }

      shotMap[row.shot_type].shot_count += row.shot_count;
      shotMap[row.shot_type].error_count += row.error_count;
      shotMap[row.shot_type].winner_count += row.winner_count;
    });

    coach.strengths.push(...(player.coach?.strengths || []));
    coach.weaknesses.push(...(player.coach?.weaknesses || []));
    coach.recommendations.push(...(player.coach?.recommendations || []));
    coach.tactical.push(...(player.coach?.tactical || []));
  });

  const shotSummary = Object.values(shotMap)
    .map(row => ({
      ...row,
      error_rate: pct(row.error_count, row.shot_count),
      winner_rate: pct(row.winner_count, row.shot_count),
      efficiency: row.winner_count - row.error_count
    }))
    .sort((a, b) => b.shot_count - a.shot_count);

  const kpis = getTotals(shotSummary);
  const rankedStrengths = rankStrengths(shotSummary);
  const rankedWeaknesses = rankWeaknesses(shotSummary);

  return {
    team_name: raw.team?.team_name || "Team",
    summary: `Across the squad, ${rankedStrengths[0]?.shot_type || "the strongest shot"} is the clearest positive platform, while ${rankedWeaknesses[0]?.shot_type || "the main weakness"} is creating the biggest drag on team performance.`,
    best_shot: rankedStrengths[0]?.shot_type || "No clear leader",
    priority_fix: rankedWeaknesses[0]?.shot_type || "No clear priority",
    shot_summary: shotSummary,
    kpis,
    strengths: buildStrengths(rankedStrengths),
    weaknesses: buildWeaknesses(rankedWeaknesses),
    recommendations: buildRecommendations(rankedStrengths, rankedWeaknesses),
    coach,
    players: Object.values(players)
  };
}

function initDashboard() {
  const playerSelect = document.getElementById("playerSelect");
  const viewModeSelect = document.getElementById("viewModeSelect");
  const playerKeys = Object.keys(appData.players);

  playerSelect.innerHTML = playerKeys
    .map(key => `<option value="${key}">${appData.players[key].player_name}</option>`)
    .join("");

  viewModeSelect.addEventListener("change", renderDashboard);
  playerSelect.addEventListener("change", renderDashboard);

  renderDashboard();
}

function renderDashboard() {
  toggle("loadingState", false);

  const isTeamView = document.getElementById("viewModeSelect").value === "team";
  const playerKey = document.getElementById("playerSelect").value;
  const player = appData.players[playerKey];
  const subject = isTeamView ? appData.teamView : player;

  document.getElementById("playerControlWrap").style.display = isTeamView ? "none" : "flex";
  document.getElementById("reportLink").style.display = isTeamView ? "none" : "inline-flex";
  document.getElementById("heroEyebrow").textContent = isTeamView ? "Team static analysis" : "Player static analysis";
  document.getElementById("heroPlayerName").textContent = isTeamView ? subject.team_name : subject.player_name;
  document.getElementById("heroSummary").textContent = subject.summary;
  document.getElementById("heroBestLabel").textContent = isTeamView ? "Best team shot" : "Best shot";
  document.getElementById("heroPriorityLabel").textContent = isTeamView ? "Team priority fix" : "Priority fix";
  document.getElementById("heroBestShot").textContent = subject.best_shot;
  document.getElementById("heroPriorityFix").textContent = subject.priority_fix;

  if (!isTeamView) {
    document.getElementById("reportLink").href = `report.html?player=${player.player_key}`;
  }

  renderKpis(subject.kpis, "kpiGrid");
  renderChartSet(subject, false);

  document.getElementById("strengthsList").innerHTML = subject.strengths.map(x => stackItem(x, "good")).join("");
  document.getElementById("weaknessesList").innerHTML = subject.weaknesses.map(x => stackItem(x, "bad")).join("");
  document.getElementById("coachStrengthsList").innerHTML = renderCoachList(subject.coach?.strengths || [], "Strength", "good");
  document.getElementById("coachWeaknessesList").innerHTML = renderCoachList(subject.coach?.weaknesses || [], "Priority", "bad");
  document.getElementById("coachRecommendationsList").innerHTML = renderCoachList(subject.coach?.recommendations || [], "Recommendation", "warn");
  document.getElementById("tacticalList").innerHTML = renderCoachList(subject.coach?.tactical || [], "Tactical", "warn");
  document.getElementById("detailTitle").textContent = isTeamView ? "Team shot detail" : "Shot detail";
  document.getElementById("detailTableBody").innerHTML = renderDetailRows(subject.shot_summary);

  const comparisonPanel = document.getElementById("playerComparisonPanel");
  if (comparisonPanel) {
    comparisonPanel.style.display = isTeamView ? "block" : "none";
    document.getElementById("playerComparisonBody").innerHTML = isTeamView ? renderPlayerComparisonRows(appData.teamView.players) : "";
  }

  const benchmarkBody = document.getElementById("benchmarkBody");
  if (benchmarkBody) {
    benchmarkBody.innerHTML = isTeamView
      ? `<tr><td colspan="5">Benchmarking is shown on individual player views.</td></tr>`
      : renderBenchmarkRows(player.benchmarkRows);
  }
}

function initReport() {
  toggle("reportLoadingState", false);

  const params = new URLSearchParams(window.location.search);
  const playerKey = params.get("player");
  const player = appData.players[playerKey];

  if (!player) {
    toggle("reportErrorState", true);
    return;
  }

  document.getElementById("reportPlayerName").textContent = player.player_name;
  document.getElementById("reportHeadline").textContent = player.headline;
  document.getElementById("reportSummary").textContent = player.summary;
  document.getElementById("reportBestShot").textContent = player.best_shot;
  document.getElementById("reportPriorityFix").textContent = player.priority_fix;
  document.getElementById("reportTotalShots").textContent = player.kpis.total_shots;
  document.getElementById("reportEfficiency").textContent = player.kpis.efficiency;

  renderKpis(player.kpis, "reportKpis");
  renderChartSet(player, true);

  document.getElementById("reportStrengths").innerHTML = player.strengths.map(x => stackItem(x, "good")).join("");
  document.getElementById("reportWeaknesses").innerHTML = player.weaknesses.map(x => stackItem(x, "bad")).join("");
  document.getElementById("reportCoachStrengths").innerHTML = renderCoachList(player.coach?.strengths || [], "Strength", "good");
  document.getElementById("reportCoachWeaknesses").innerHTML = renderCoachList(player.coach?.weaknesses || [], "Priority", "bad");
  document.getElementById("reportCoachTactical").innerHTML = renderCoachList(player.coach?.tactical || [], "Tactical", "warn");
  document.getElementById("reportCoachRecommendations").innerHTML = renderCoachList(player.coach?.recommendations || [], "Recommendation", "warn");

  document.getElementById("reportRecommendations").innerHTML = player.recommendations
    .map(item => `
      <div class="stack-item">
        <span class="stack-item-tag tag-warn">Recommendation</span>
        <div class="stack-item-title">${item.title}</div>
        <div class="stack-item-body">${item.body}</div>
      </div>
    `)
    .join("");

  document.getElementById("reportBenchmarkBody").innerHTML = renderBenchmarkRows(player.benchmarkRows);
  document.getElementById("reportDetailBody").innerHTML = renderDetailRows(player.shot_summary);
}

function renderKpis(kpis, targetId) {
  document.getElementById(targetId).innerHTML = `
    ${kpiCard("Total Shots", kpis.total_shots, "All recorded shots")}
    ${kpiCard("Winners", kpis.total_winners, `${kpis.winner_rate.toFixed(1)}% winner rate`)}
    ${kpiCard("Errors", kpis.total_errors, `${kpis.error_rate.toFixed(1)}% error rate`)}
    ${kpiCard("Efficiency", kpis.efficiency, "Winners minus errors")}
  `;
}

function renderChartSet(subject, isReport) {
  const labels = subject.shot_summary.map(x => x.shot_type);
  const shotCounts = subject.shot_summary.map(x => x.shot_count);
  const errors = subject.shot_summary.map(x => x.error_count);
  const winners = subject.shot_summary.map(x => x.winner_count);

  const registry = isReport ? reportCharts : dashboardCharts;

  destroyChart(registry.shot);
  destroyChart(registry.error);
  if (!isReport) destroyChart(registry.winner);

  registry.shot = new Chart(document.getElementById(isReport ? "reportShotChart" : "shotChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: shotCounts,
        backgroundColor: palette.slice(0, labels.length),
        borderColor: isReport ? "#ffffff" : "#0b1d2d",
        borderWidth: 2
      }]
    },
    options: doughnutOptions(isReport)
  });

  registry.error = new Chart(document.getElementById(isReport ? "reportErrorChart" : "errorChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Errors",
        data: errors,
        backgroundColor: "#ff6b6b",
        borderRadius: 8
      }]
    },
    options: barOptions(isReport)
  });

  if (!isReport) {
    registry.winner = new Chart(document.getElementById("winnerChart"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Winners",
          data: winners,
          backgroundColor: "#49acd9",
          borderRadius: 8
        }]
      },
      options: barOptions(false)
    });
  }
}

function buildBenchmarkRows(player, shotSummary, kpis, benchmarkSet) {
  if (!benchmarkSet) return [];

  const shotMetric = shotType => shotSummary.find(x => x.shot_type === shotType)?.error_rate ?? null;

  const metrics = [
    ["overall_error_rate", kpis.error_rate],
    ["overall_winner_rate", kpis.winner_rate],
    ["efficiency", kpis.efficiency],
    ["forehand_error_rate", shotMetric("Forehand")],
    ["backhand_error_rate", shotMetric("Backhand")],
    ["forehand_volley_error_rate", shotMetric("Forehand Volley")],
    ["backhand_volley_error_rate", shotMetric("Backhand Volley")],
    ["overhead_error_rate", shotMetric("Overhead")],
    ["return_forehand_error_rate", shotMetric("Return of Serve Forehand")],
    ["return_backhand_error_rate", shotMetric("Return of Serve Backhand")]
  ];

  return metrics
    .filter(([key, current]) => current !== null && benchmarkSet[key])
    .map(([key, current]) => {
      const benchmark = benchmarkSet[key];
      const gap = benchmark.direction === "lower"
        ? current - benchmark.target
        : benchmark.target - current;

      return {
        label: benchmark.label,
        current,
        target: benchmark.target,
        gap,
        priority: Math.abs(gap) >= 12 ? "Very High" :
                  Math.abs(gap) >= 6 ? "High" :
                  Math.abs(gap) >= 3 ? "Medium" : "Low"
      };
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

function getTotals(rows) {
  const total_shots = rows.reduce((a, b) => a + b.shot_count, 0);
  const total_errors = rows.reduce((a, b) => a + b.error_count, 0);
  const total_winners = rows.reduce((a, b) => a + b.winner_count, 0);

  return {
    total_shots,
    total_errors,
    total_winners,
    efficiency: total_winners - total_errors,
    error_rate: pct(total_errors, total_shots),
    winner_rate: pct(total_winners, total_shots)
  };
}

function rankStrengths(rows) {
  return [...rows]
    .filter(x => x.shot_count >= 2)
    .sort((a, b) =>
      ((b.winner_rate * 1.2) - (b.error_rate * 0.8) + (b.efficiency * 8)) -
      ((a.winner_rate * 1.2) - (a.error_rate * 0.8) + (a.efficiency * 8))
    );
}

function rankWeaknesses(rows) {
  return [...rows]
    .filter(x => x.shot_count >= 2)
    .sort((a, b) =>
      ((b.error_rate * 1.3) - (b.winner_rate * 0.5) - (b.efficiency * 6)) -
      ((a.error_rate * 1.3) - (a.winner_rate * 0.5) - (a.efficiency * 6))
    );
}

function buildStrengths(rows) {
  return rows.slice(0, 3).map(row => ({
    title: row.shot_type,
    body: `${row.shot_count} shots, ${row.winner_count} winners, ${row.error_count} errors, ${row.winner_rate.toFixed(1)}% winners, efficiency ${row.efficiency}.`
  }));
}

function buildWeaknesses(rows) {
  return rows.slice(0, 3).map(row => ({
    title: row.shot_type,
    body: `${row.shot_count} shots, ${row.error_count} errors, ${row.error_rate.toFixed(1)}% error rate, efficiency ${row.efficiency}.`
  }));
}

function buildRecommendations(strengths, weaknesses) {
  const best = strengths[0];
  const weak = weaknesses[0];
  const secondWeak = weaknesses[1];
  const out = [];

  if (weak) {
    out.push({
      title: `Reduce errors in ${weak.title.toLowerCase()}`,
      body: `Prioritise repetition, margin, and simpler decision-making in ${weak.title.toLowerCase()} patterns.`
    });
  }

  if (best) {
    out.push({
      title: `Build around ${best.title.toLowerCase()}`,
      body: `Create more points and training drills that deliberately channel play into ${best.title.toLowerCase()} situations.`
    });
  }

  if (secondWeak) {
    out.push({
      title: `Stabilise ${secondWeak.title.toLowerCase()}`,
      body: `Use controlled practice blocks to improve reliability and reduce point leakage in ${secondWeak.title.toLowerCase()}.`
    });
  }

  return out;
}

function renderDetailRows(rows) {
  return rows.map(row => `
    <tr>
      <td>${row.shot_type}</td>
      <td>${row.shot_count}</td>
      <td>${row.error_count}</td>
      <td>${row.winner_count}</td>
      <td>${row.error_rate.toFixed(1)}%</td>
      <td>${row.winner_rate.toFixed(1)}%</td>
      <td class="${row.efficiency >= 0 ? "positive" : "negative"}">${row.efficiency}</td>
    </tr>
  `).join("");
}

function renderPlayerComparisonRows(players) {
  return players.map(player => `
    <tr>
      <td>${player.player_name}</td>
      <td>${player.kpis.total_shots}</td>
      <td>${player.kpis.total_winners}</td>
      <td>${player.kpis.total_errors}</td>
      <td>${player.kpis.winner_rate.toFixed(1)}%</td>
      <td>${player.kpis.error_rate.toFixed(1)}%</td>
      <td class="${player.kpis.efficiency >= 0 ? "positive" : "negative"}">${player.kpis.efficiency}</td>
      <td>${player.best_shot}</td>
      <td>${player.priority_fix}</td>
    </tr>
  `).join("");
}

function renderBenchmarkRows(rows) {
  if (!rows?.length) {
    return `<tr><td colspan="5">No benchmark rows available.</td></tr>`;
  }

  return rows.map(row => `
    <tr>
      <td>${row.label}</td>
      <td>${formatMetric(row.current)}</td>
      <td>${formatMetric(row.target)}</td>
      <td class="${Math.abs(row.gap) >= 6 ? "negative" : ""}">${signed(row.gap)}</td>
      <td>${row.priority}</td>
    </tr>
  `).join("");
}

function renderCoachList(items, label, mode) {
  if (!items?.length) {
    return `
      <div class="stack-item">
        <span class="stack-item-tag ${modeClass(mode)}">${label}</span>
        <div class="stack-item-body">No coach insight recorded yet.</div>
      </div>
    `;
  }

  return items.map(item => `
    <div class="stack-item">
      <span class="stack-item-tag ${modeClass(mode)}">${label}${item.priority ? ` P${item.priority}` : ""}</span>
      <div class="stack-item-title">${item.theme || label}</div>
      <div class="stack-item-body">${item.observation || ""}</div>
      ${item.action ? `<div class="stack-item-body" style="margin-top:8px;"><strong>Action:</strong> ${item.action}</div>` : ""}
    </div>
  `).join("");
}

function modeClass(mode) {
  if (mode === "good") return "tag-good";
  if (mode === "bad") return "tag-bad";
  return "tag-warn";
}

function kpiCard(label, value, sub) {
  return `
    <article class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </article>
  `;
}

function stackItem(item, mode) {
  const tagClass = mode === "good" ? "tag-good" : "tag-bad";
  const tagText = mode === "good" ? "Strength" : "Priority";

  return `
    <div class="stack-item">
      <span class="stack-item-tag ${tagClass}">${tagText}</span>
      <div class="stack-item-title">${item.title}</div>
      <div class="stack-item-body">${item.body}</div>
    </div>
  `;
}

function doughnutOptions(isLight) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: isLight ? "#12253f" : "#edf4ff",
          boxWidth: 18,
          padding: 16,
          font: { family: "Inter", size: 12, weight: "600" }
        }
      }
    }
  };
}

function barOptions(isLight) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isLight ? "#12253f" : "#edf4ff",
          font: { family: "Inter", size: 12, weight: "600" }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: isLight ? "#6f8299" : "#a8bfd8" },
        grid: { color: isLight ? "#eef3f8" : "rgba(255,255,255,0.04)" }
      },
      y: {
        beginAtZero: true,
        ticks: { color: isLight ? "#6f8299" : "#a8bfd8" },
        grid: { color: isLight ? "#eef3f8" : "rgba(255,255,255,0.05)" }
      }
    }
  };
}

function pct(n, d) {
  return d ? (n / d) * 100 : 0;
}

function formatMetric(v) {
  return Number.isInteger(v) ? v : `${v.toFixed(1)}%`;
}

function signed(v) {
  return (v > 0 ? "+" : "") + (Number.isInteger(v) ? v : v.toFixed(1));
}

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function toggle(id, show) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden", !show);
}
