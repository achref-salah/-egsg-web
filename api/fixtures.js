// api/fixtures.js
// Vercel Serverless Function — proxies API-Football so the API key never
// reaches the browser. Client calls: /api/fixtures?type=upcoming | results
//
// Required env vars (set in Vercel → Project → Settings → Environment Variables):
//   API_FOOTBALL_KEY   your api-sports.io key
//   EGSG_TEAM_ID       numeric team id (see scripts/find-team-id.js)
//   EGSG_SEASON        optional, defaults to current year

const API_HOST = "v3.football.api-sports.io";

const MOCK_FIXTURES = {
  upcoming: [
    {
      id: "mock-1",
      date: "2026-09-14T18:00:00+01:00",
      competition: "Ligue 2",
      home: "EGSG",
      away: "RCA",
      homeLogo: null,
      awayLogo: null,
      isHome: true,
      venue: "Stade de Gafsa",
      status: "NS",
      elapsed: null,
      homeScore: null,
      awayScore: null
    },
    {
      id: "mock-2",
      date: "2026-09-21T20:00:00+01:00",
      competition: "Ligue 2",
      home: "JSK",
      away: "EGSG",
      homeLogo: null,
      awayLogo: null,
      isHome: false,
      venue: "Stade du 7 Novembre",
      status: "NS",
      elapsed: null,
      homeScore: null,
      awayScore: null
    }
  ],
  results: [
    {
      id: "mock-r1",
      date: "2026-09-07T17:00:00+01:00",
      competition: "Ligue 2",
      home: "EGSG",
      away: "USM",
      homeLogo: null,
      awayLogo: null,
      isHome: true,
      venue: "Stade de Gafsa",
      status: "FT",
      elapsed: null,
      homeScore: 2,
      awayScore: 1
    }
  ]
};

module.exports = async (req, res) => {
  const type = req.query.type === "results" ? "results" : "upcoming";
  const apiKey = process.env.API_FOOTBALL_KEY;
  const teamId = process.env.EGSG_TEAM_ID;
  const season = process.env.EGSG_SEASON || String(new Date().getFullYear());

  // No key/team configured yet → serve mock data so the site still works.
  if (!apiKey || !teamId) {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json({ source: "mock", fixtures: MOCK_FIXTURES[type] });
  }

  const params = new URLSearchParams({ team: teamId, season });
  if (type === "upcoming") {
    params.set("next", "6");
  } else {
    params.set("last", "6");
  }

  try {
    const response = await fetch(`https://${API_HOST}/fixtures?${params.toString()}`, {
      headers: { "x-apisports-key": apiKey }
    });

    if (!response.ok) {
      throw new Error(`API-Football responded ${response.status}`);
    }

    const data = await response.json();
    const fixtures = (data.response || []).map((item) => mapFixture(item, teamId));

    // The free plan can return a 200 with zero results (e.g. it silently
    // rejects "next"/"last" or the requested season isn't in its allowed
    // range). Treat that the same as an error: fall back to mock data
    // instead of showing an empty grid.
    if (!fixtures.length) {
      res.setHeader("Cache-Control", "s-maxage=300");
      return res.status(200).json({
        source: "mock",
        fixtures: MOCK_FIXTURES[type],
        note: data.errors && Object.keys(data.errors).length ? data.errors : "no results returned"
      });
    }

    // Cache at the edge: fixtures don't need to be fetched on every visit.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=600");
    return res.status(200).json({ source: "live", fixtures });
  } catch (error) {
    console.error("fixtures.js error:", error.message);
    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json({
      source: "mock",
      fixtures: MOCK_FIXTURES[type],
      error: error.message
    });
  }
};

function mapFixture(item, teamId) {
  const isHome = String(item.teams.home.id) === String(teamId);
  return {
    id: item.fixture.id,
    date: item.fixture.date,
    competition: item.league?.name || "",
    home: item.teams.home.name,
    away: item.teams.away.name,
    homeLogo: item.teams.home.logo || null,
    awayLogo: item.teams.away.logo || null,
    isHome,
    venue: item.fixture.venue?.name || "",
    status: item.fixture.status?.short || "NS",
    elapsed: item.fixture.status?.elapsed ?? null,
    homeScore: item.goals?.home ?? null,
    awayScore: item.goals?.away ?? null
  };
}
