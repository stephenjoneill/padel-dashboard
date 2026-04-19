exports.handler = async function () {

  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TOKEN = process.env.AIRTABLE_TOKEN;

  const headers = {
    Authorization: `Bearer ${TOKEN}`
  };

  try {

    // Fetch Shots
    const shotsRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/Shots`, { headers });
    const shotsData = await shotsRes.json();

    // Fetch Players
    const playersRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/Players`, { headers });
    const playersData = await playersRes.json();

    // Build Player ID → Name map
    const playerMap = {};
    playersData.records.forEach(p => {
      playerMap[p.id] = p.fields.Name;
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        shots: shotsData.records,
        playerMap
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: err.toString()
    };
  }
};
