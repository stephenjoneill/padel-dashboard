exports.handler = async function () {

  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TOKEN = process.env.AIRTABLE_TOKEN;

  const url = `https://api.airtable.com/v0/${BASE_ID}/Shots`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    });

    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data.records)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: err.toString()
    };
  }
};