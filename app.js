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
    setVisible("loadingState", true);
    setVisible("errorState", false);
    setVisible("reportLoadingState", true);
    setVisible("reportErrorState", false);

    const res = await fetch("/.netlify/functions/airtable");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();

    appData = transformData(payload.shots, payload.playerMap);

    if (document.getElementById("playerSelect")) {
      initDashboard();
    }

    if (document.getElementById("reportPlayerName")) {
      initReport();
    }

  } catch (err) {
    console.error(err);
    setVisible("loadingState", false);
    setVisible("reportLoadingState", false);
    setVisible("errorState", true);
    setVisible("reportErrorState", true);
  }
}

function transformData(records, playerMap) {
  const players = {};

  for (const r of records) {
    const f = r.fields || {};
    const playerId = f.Player?.[0];
    const playerName = playerMap[playerId];
    const shotType = f["Shot Type"];
    const result = f.Result;

    if (!playerName || !shotType) continue;

    const key = playerName.toLowerCase();

    if (!players[key]) {
      players[key] = {
        player_key: key,
        player_name: playerName,
        shot_summary: []
      };
    }

    let existing = players[key].shot_summary.find(x => x.shot_type === shotType);

    if (!existing) {
      existing = {
        shot_type: shotType,
        shot_count: 0,
        error_count: 0,
        winner_count: 0
      };
      players[key].shot_summary.push(existing);
    }

    existing.shot_count += 1;

    if (result === "Winner") existing.winner_count += 1;
    if (result === "Forced Error" || result === "Unforced Error") existing.error_count += 1;
  }

  for (const key of Object.keys(players)) {
    const player = players[key];
    player.shot_summary = player.shot_summary
      .map(row => ({
        ...row,
        error_rate: pctNum(row.error_count, row.shot_count),
        winner_rate: pctNum(row.winner_count, row.shot_count),
        efficiency: row.winner_count - row.error_count
      }))
      .sort((a, b) => b.shot_count - a.shot_count);

    const totals = getTotals(player.shot_summary);
    player.kpis = totals;

    const rankedStrengths = [...player.shot_summary]
      .filter(x => x.shot_count >= 2)
      .sort((a, b) => {
        const aScore = (a.winner_rate * 1.2) - (a.error_rate * 0.8) + (a.efficiency * 8);
        const bScore = (b.winner_rate * 1.2) - (b.error_rate * 0.8) + (b.efficiency * 8);
        return bScore - aScore;
      });

    const rankedWeaknesses = [...player.shot_summary]
      .filter(x => x.shot_count >= 2)
      .sort((a, b) => {
        const aScore = (a.error_rate * 1.3) - (a.winner_rate * 0.5) - (a.efficiency * 6);
        const bScore = (b.error_rate * 1.3) - (b.winner_rate * 0.5) - (b.efficiency * 6);
        return bScore - aScore;
      });

    player.best_shot = rankedStrengths[0]?.shot_type || "No clear leader";
    player.priority_fix = rankedWeaknesses[0]?.shot_type || "No clear priority";
    player.headline = buildHeadline(player, rankedStrengths, rankedWeaknesses);
    player.summary = buildSummary(player, rankedStrengths, rankedWeaknesses);
    player.strengths = buildStrengths(rankedStrengths);
    player.weaknesses = buildWeaknesses(rankedWeaknesses);
    player.recommendations = buildRecommendations(player, rankedStrengths, rankedWeaknesses);
  }

  return { players };
}

function getTotals(rows) {
  const total_shots = rows.reduce((a, b) => a + b.shot_count, 0);
  const total_errors = rows.reduce((a, b) => a + b.error_count, 0);
  const total_winners = rows.reduce((a, b) => a + b.winner_count, 0);
  const efficiency = total_winners - total_errors;

  return {
    total_shots,
    total_errors,
    total_winners,
    efficiency,
    error_rate: pctNum(total_errors, total_shots),
    winner_rate: pctNum(total_winners, total_shots)
  };
}

function buildHeadline(player, strengths, weaknesses) {
  const best = strengths[0]?.shot_type || "strongest shot";
  const weak = weaknesses[0]?.shot_type || "main focus area";
  return `${best} is currently the clearest positive pattern, while ${weak} is the main opportunity for improvement.`;
}

function buildSummary(player, strengths, weaknesses) {
  const best = strengths[0];
  const weak = weaknesses[0];

  if (!best || !weak) {
    return `This player profile is still building, but the current dataset already shows meaningful patterns that can be used to guide training focus.`;
  }

  return `${player.player_name}'s current profile suggests that ${best.shot_type.toLowerCase()} is offering the strongest platform for positive outcomes, while ${weak.shot_type.toLowerCase()} is creating the most drag on performance. The quickest gains will come from reducing avoidable errors in the weakest areas while continuing to build around the strongest shot patterns.`;
}

function buildStrengths(rows) {
  return rows.slice(0, 3).map(row => ({
    title: row.shot_type,
    body: `${row.shot_count} shots, ${row.winner_count} winners, ${row.error_count} errors, ${row.winner_rate.toFixed(1)}% winners, efficiency ${row.efficiency}.`,
    tag: "Strength"
  }));
}

function buildWeaknesses(rows) {
  return rows.slice(0, 3).map(row => ({
    title: row.shot_type,
    body: `${row.shot_count} shots, ${row.error_count} errors, ${row.error_rate.toFixed(1)}% error rate, efficiency ${row.efficiency}.`,
    tag: "Priority"
  }));
}

function buildRecommendations(player, strengths, weaknesses) {
  const best = strengths[0];
  const weak = weaknesses[0];
  const secondWeak = weaknesses[1];

  const recs = [];

  if (weak) {
    recs.push({
      title: `Reduce errors in ${weak.shot_type.toLowerCase()}`,
      body: `Prioritise repetition, margin, and simpler decision-making in ${weak.shot_type.toLowerCase()} patterns.`
    });
  }

  if (best) {
    recs.push({
      title: `Build around ${best.shot_type.toLowerCase()}`,
      body: `Create more points and training drills that deliberately channel play into ${best.shot_type.toLowerCase()} situations.`
    });
  }

  if (secondWeak) {
    recs.push({
      title: `Stabilise ${secondWeak.shot_type.toLowerCase()}`,
      body: `Use controlled practice blocks to improve reliability and reduce point leakage in ${secondWeak.shot_type.toLowerCase()}.`
    });
  }

  return recs;
}

function initDashboard() {
  const playerSelect = document.getElementById("playerSelect");
  const keys = Object.keys(appData.players);

  playerSelect.innerHTML = keys
    .map(key => `<option value="${key}">${appData.players[key].player_name}</option>`)
    .join("");

  playerSelect.addEventListener("change", renderDashboard);
  renderDashboard();
}

function renderDashboard() {
  const playerKey = document.getElementById("playerSelect").value;
  const player = appData.players[playerKey];
  if (!player) return;

  setVisible("loadingState", false);

  document.getElementById("heroPlayerName").textContent = player.player_name;
  document.getElementById("heroSummary").textContent = player.summary;
  document.getElementById("heroBestShot").textContent = player.best_shot;
  document.getElementById("heroPriorityFix").textContent = player.priority_fix;
  document.getElementById("reportLink").href = `report.html?player=${player.player_key}`;

  renderDashboardKpis(player);
  renderStrengthsWeaknesses(player);
  renderDetailTable(player);
  renderDashboardCharts(player);
}

function renderDashboardKpis(player) {
  const k = player.kpis;
  document.getElementById("kpiGrid").innerHTML = `
    ${kpiCard("Total Shots", k.total_shots, "All recorded shots")}
    ${kpiCard("Winners", k.total_winners, `${k.winner_rate.toFixed(1)}% winner rate`)}
    ${kpiCard("Errors", k.total_errors, `${k.error_rate.toFixed(1)}% error rate`)}
    ${kpiCard("Efficiency", k.efficiency, "Winners minus errors")}
  `;
}

function renderStrengthsWeaknesses(player) {
  document.getElementById("strengthsList").innerHTML = player.strengths.map(item => stackItem(item, "good")).join("");
  document.getElementById("weaknessesList").innerHTML = player.weaknesses.map(item => stackItem(item, "bad")).join("");
}

function renderDetailTable(player) {
  document.getElementById("detailTableBody").innerHTML = player.shot_summary.map(row => `
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

function renderDashboardCharts(player) {
  const labels = player.shot_summary.map(x => x.shot_type);
  const counts = player.shot_summary.map(x => x.shot_count);
  const errors = player.shot_summary.map(x => x.error_count);
  const winners = player.shot_summary.map(x => x.winner_count);

  destroyChart(dashboardCharts.shot);
  destroyChart(dashboardCharts.error);
  destroyChart(dashboardCharts.winner);

  dashboardCharts.shot = new Chart(document.getElementById("shotChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: palette.slice(0, labels.length),
        borderColor: "#0b1d2d",
        borderWidth: 2
      }]
    },
    options: doughnutOptions()
  });

  dashboardCharts.error = new Chart(document.getElementById("errorChart"), {
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
    options: barOptions()
  });

  dashboardCharts.winner = new Chart(document.getElementById("winnerChart"), {
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
    options: barOptions()
  });
}

function initReport() {
  const params = new URLSearchParams(window.location.search);
  const playerKey = params.get("player");
  const player = appData.players[playerKey];
  if (!player) {
    setVisible("reportLoadingState", false);
    setVisible("reportErrorState", true);
    return;
  }

  setVisible("reportLoadingState", false);

  document.getElementById("reportPlayerName").textContent = player.player_name;
  document.getElementById("reportHeadline").textContent = player.headline;
  document.getElementById("reportSummary").textContent = player.summary;
  document.getElementById("reportBestShot").textContent = player.best_shot;
  document.getElementById("reportPriorityFix").textContent = player.priority_fix;
  document.getElementById("reportTotalShots").textContent = player.kpis.total_shots;
  document.getElementById("reportEfficiency").textContent = player.kpis.efficiency;

  document.getElementById("reportKpis").innerHTML = `
    ${kpiCard("Total Shots", player.kpis.total_shots, "All recorded shots")}
    ${kpiCard("Winners", player.kpis.total_winners, `${player.kpis.winner_rate.toFixed(1)}% winner rate`)}
    ${kpiCard("Errors", player.kpis.total_errors, `${player.kpis.error_rate.toFixed(1)}% error rate`)}
    ${kpiCard("Efficiency", player.kpis.efficiency, "Winners minus errors")}
  `;

  document.getElementById("reportStrengths").innerHTML = player.strengths.map(item => stackItem(item, "good")).join("");
  document.getElementById("reportWeaknesses").innerHTML = player.weaknesses.map(item => stackItem(item, "bad")).join("");
  document.getElementById("reportRecommendations").innerHTML = player.recommendations.map(item => `
    <div class="stack-item">
      <span class="stack-item-tag tag-warn">Recommendation</span>
      <div class="stack-item-title">${item.title}</div>
      <div class="stack-item-body">${item.body}</div>
    </div>
  `).join("");

  document.getElementById("reportDetailBody").innerHTML = player.shot_summary.map(row => `
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

  const labels = player.shot_summary.map(x => x.shot_type);

  destroyChart(reportCharts.shot);
  destroyChart(reportCharts.error);

  reportCharts.shot = new Chart(document.getElementById("reportShotChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: player.shot_summary.map(x => x.shot_count),
        backgroundColor: palette.slice(0, labels.length),
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: doughnutOptions(true)
  });

  reportCharts.error = new Chart(document.getElementById("reportErrorChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Errors",
        data: player.shot_summary.map(x => x.error_count),
        backgroundColor: "#ff6b6b",
        borderRadius: 8
      }]
    },
    options: barOptions(true)
  });
}

function doughnutOptions(light = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: light ? "#12253f" : "#edf4ff",
          boxWidth: 18,
          padding: 16,
          font: { family: "Inter", size: 12, weight: "600" }
        }
      }
    }
  };
}

function barOptions(light = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: light ? "#12253f" : "#edf4ff",
          font: { family: "Inter", size: 12, weight: "600" }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: light ? "#6f8299" : "#a8bfd8",
          font: { family: "Inter", size: 11 }
        },
        grid: { color: light ? "#eef3f8" : "rgba(255,255,255,0.04)" }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: light ? "#6f8299" : "#a8bfd8",
          font: { family: "Inter", size: 11 }
        },
        grid: { color: light ? "#eef3f8" : "rgba(255,255,255,0.05)" }
      }
    }
  };
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

function pctNum(n, d) {
  return d ? (n / d) * 100 : 0;
}

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function setVisible(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}
