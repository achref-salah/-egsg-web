// api/standings.js
// Client calls: /api/standings
// Required env vars: API_FOOTBALL_KEY, EGSG_LEAGUE_ID, EGSG_SEASON (optional)

const API_HOST = "v3.football.api-sports.io";

const MOCK_STANDINGS = [
  { rank: 1, team: "CS Sfaxien", played: 7, win: 5, draw: 1, lose: 1, points: 16, goalsDiff: 8 },
  { rank: 2, team: "EGSG", played: 7, win: 4, draw: 2, lose: 1, points: 14, goalsDiff: 6 },
  { rank: 3, team: "JS Kairouan", played: 7, win: 4, draw: 1, lose: 2, points: 13, goalsDiff: 4 },
  { rank: 4, team: "US Monastir", played: 7, win: 3, draw: 3, lose: 1, points: 12, goalsDiff: 3 }
];

module.exports = async (req, res) => {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const leagueId = process.env.EGSG_LEAGUE_ID;
  const season = process.env.EGSG_SEASON || String(new Date().getFullYear());

  if (!apiKey || !leagueId) {
    res.setHeader("Cache-Control", "s-maxage=600");
    return res.status(200).json({ source: "mock", standings: MOCK_STANDINGS });
  }

  const params = new URLSearchParams({ league: leagueId, season });

  try {
    const response = await fetch(`https://${API_HOST}/standings?${params.toString()}`, {
      headers: { "x-apisports-key": apiKey }
    });

    if (!response.ok) {
      throw new Error(`API-Football responded ${response.status}`);
    }

    const data = await response.json();
    const table = data.response?.[0]?.league?.standings?.[0] || [];

    const standings = table.map((row) => ({
      rank: row.rank,
      team: row.team.name,
      logo: row.team.logo,
      played: row.all.played,
      win: row.all.win,
      draw: row.all.draw,
      lose: row.all.lose,
      points: row.points,
      goalsDiff: row.goalsDiff
    }));

    // The free plan can return a 200 with an empty table (e.g. current
    // season is outside its allowed range). Fall back to mock data.
    if (!standings.length) {
      res.setHeader("Cache-Control", "s-maxage=600");
      return res.status(200).json({
        source: "mock",
        standings: MOCK_STANDINGS,
        note: data.errors && Object.keys(data.errors).length ? data.errors : "no results returned"
      });
    }

    // Standings change slowly — cache for an hour at the edge.
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=900");
    return res.status(200).json({ source: "live", standings });
  } catch (error) {
    console.error("standings.js error:", error.message);
    res.setHeader("Cache-Control", "s-maxage=120");
    return res.status(200).json({
      source: "mock",
      standings: MOCK_STANDINGS,
      error: error.message
    });
  }
};
