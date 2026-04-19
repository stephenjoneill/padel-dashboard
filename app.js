let data;

// Try Airtable first, fallback to local JSON
fetch('/.netlify/functions/airtable')
  .then(res => res.json())
  .then(records => {
    data = transformData(records);
    init();
  })
  .catch(() => {
    fetch('data.json')
      .then(res => res.json())
      .then(json => {
        data = json;
        init();
      });
  });

function init() {
  if (!data || !data.players) return;

  const playerSelect = document.getElementById("playerSelect");

  Object.keys(data.players).forEach(p => {
    playerSelect.innerHTML += `<option value="${p}">${data.players[p].player_name}</option>`;
  });

  playerSelect.onchange = updateDashboard;

  updateDashboard();
}

function updateDashboard() {
  const playerKey = document.getElementById("playerSelect").value;
  const player = data.players[playerKey];

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
    <div class="column"><div class="kpi"><h2>${winners-errors}</h2>Efficiency</div></div>
  `;
}

function renderCharts(player) {
  const labels = player.shot_summary.map(s=>s.shot_type);

  new Chart(document.getElementById("shotChart"), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: player.shot_summary.map(s=>s.shot_count),
        backgroundColor: ["#49ACD9","#C0D942","#B4FF00","#888"]
      }]
    }
  });

  new Chart(document.getElementById("errorChart"), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Errors",
        data: player.shot_summary.map(s=>s.error_count),
        backgroundColor: "#FF6B6B"
      }]
    }
  });
}

function sum(player, field) {
  return player.shot_summary.reduce((a,b)=>a+(b[field]||0),0);
}

function transformData(records) {
  const players = {};

  records.forEach(r => {
    const f = r.fields;

    const player = Array.isArray(f.Player) ? f.Player[0] : f.Player;
    const shotType = f["Shot Type"];
    const result = f.Result;

    if (!player || !shotType) return;

    if (!players[player.toLowerCase()]) {
      players[player.toLowerCase()] = {
        player_name: player,
        shot_summary: [],
        strengths: [],
        weaknesses: [],
        recommendations: []
      };
    }

    let shot = players[player.toLowerCase()].shot_summary.find(s => s.shot_type === shotType);

    if (!shot) {
      shot = {
        shot_type: shotType,
        shot_count: 0,
        error_count: 0,
        winner_count: 0
      };
      players[player.toLowerCase()].shot_summary.push(shot);
    }

    shot.shot_count++;

    if (result === "Winner") shot.winner_count++;
    if (result && result.includes("Error")) shot.error_count++;
  });

  return { players };
}