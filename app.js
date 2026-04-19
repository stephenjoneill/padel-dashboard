let data;

// Fetch from Netlify function
fetch('/.netlify/functions/airtable')
  .then(res => res.json())
  .then(({ shots, playerMap }) => {
    data = transformData(shots, playerMap);
    init();
  })
  .catch(err => {
    console.error("Error loading Airtable data:", err);
  });

function init() {
  if (!data || !data.players) return;

  const playerSelect = document.getElementById("playerSelect");

  playerSelect.innerHTML = "";

  Object.keys(data.players).forEach(p => {
    playerSelect.innerHTML += `<option value="${p}">${data.players[p].player_name}</option>`;
  });

  playerSelect.onchange = updateDashboard;

  updateDashboard();
}

function updateDashboard() {
  const playerKey = document.getElementById("playerSelect").value;
  const player = data.players[playerKey];

  if (!player) return;

  renderKPIs(player);
  renderCharts(player);

  const link = document.getElementById("reportLink");
  if (link) {
    link.href = `report.html?player=${playerKey}`;
  }
}

function renderKPIs(player) {
  const grid = document.getElementById("kpiGrid");

  const totalShots = sum(player, 'shot_count');
  const errors = sum(player, 'error_count');
  const winners = sum(player, 'winner_count');

  grid.innerHTML = `
    <div class="column"><div class="kpi"><h2>${totalShots}</h2>Shots</div></div>
    <div class="column"><div class="kpi"><h2>${winners}</h2>Winners</div></div>
    <div class="column"><div class="kpi"><h2>${errors}</h2>Errors</div></div>
    <div class="column"><div class="kpi"><h2>${winners - errors}</h2>Efficiency</div></div>
  `;
}

function renderCharts(player) {

  const labels = player.shot_summary.map(s => s.shot_type);

  new Chart(document.getElementById("shotChart"), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: player.shot_summary.map(s => s.shot_count),
        backgroundColor: ["#49ACD9", "#C0D942", "#B4FF00", "#888"]
      }]
    }
  });

  new Chart(document.getElementById("errorChart"), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Errors",
        data: player.shot_summary.map(s => s.error_count),
        backgroundColor: "#FF6B6B"
      }]
    }
  });
}

function sum(player, field) {
  return player.shot_summary.reduce((a, b) => a + (b[field] || 0), 0);
}

// 🔥 KEY TRANSFORM FUNCTION
function transformData(records, playerMap) {

  const players = {};

  records.forEach(r => {

    const f = r.fields;

    const playerId = f.Player?.[0];
    const player = playerMap[playerId];

    const shotType = f["Shot Type"];
    const result = f.Result;

    if (!player || !shotType) return;

    const key = player.toLowerCase();

    if (!players[key]) {
      players[key] = {
        player_name: player,
        shot_summary: [],
        strengths: [],
        weaknesses: [],
        recommendations: []
      };
    }

    let shot = players[key].shot_summary.find(s => s.shot_type === shotType);

    if (!shot) {
      shot = {
        shot_type: shotType,
        shot_count: 0,
        error_count: 0,
        winner_count: 0
      };
      players[key].shot_summary.push(shot);
    }

    shot.shot_count++;

    if (result === "Winner") shot.winner_count++;
    if (result && result.includes("Error")) shot.error_count++;
  });

  return { players };
}

/* REPORT PAGE SUPPORT */

const params = new URLSearchParams(window.location.search);
const playerKey = params.get("player");

if (playerKey && data && data.players) {

  const p = data.players[playerKey];

  if (p) {
    document.getElementById("playerName").innerText = p.player_name;
    document.getElementById("headline").innerText = "Performance Summary";
    document.getElementById("summary").innerText = "Auto-generated report based on match data.";

    document.getElementById("strengths").innerHTML =
      p.strengths.map(s => `<p>${s.title}</p>`).join("");

    document.getElementById("weaknesses").innerHTML =
      p.weaknesses.map(w => `<p>${w.title}</p>`).join("");

    document.getElementById("recommendations").innerHTML =
      p.recommendations.map(r => `<p>${r.title}</p>`).join("");
  }
}
