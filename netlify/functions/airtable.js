exports.handler = async function () {
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TOKEN = process.env.AIRTABLE_TOKEN;

  const headers = {
    Authorization: `Bearer ${TOKEN}`
  };

  try {
    const [shotsRes, playersRes, coachRes] = await Promise.all([
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Shots`, { headers }),
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Players`, { headers }),
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Coach%20Insights`, { headers })
    ]);

    if (!shotsRes.ok) {
      const text = await shotsRes.text();
      return { statusCode: shotsRes.status, body: text };
    }

    if (!playersRes.ok) {
      const text = await playersRes.text();
      return { statusCode: playersRes.status, body: text };
    }

    if (!coachRes.ok) {
      const text = await coachRes.text();
      return { statusCode: coachRes.status, body: text };
    }

    const shotsData = await shotsRes.json();
    const playersData = await playersRes.json();
    const coachData = await coachRes.json();

    const playerMap = {};
    playersData.records.forEach(p => {
      playerMap[p.id] = p.fields.Name;
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        shots: shotsData.records,
        playerMap,
        coachInsights: coachData.records
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: String(err)
      })
    };
  }
};
