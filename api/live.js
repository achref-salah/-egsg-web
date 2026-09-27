// api/live.js
// Returns EGSG's live fixture if one is currently in progress, else { live: false }.
// Client calls: /api/live

const API_HOST = "v3.football.api-sports.io";

module.exports = async (req, res) => {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const teamId = process.env.EGSG_TEAM_ID;

  if (!apiKey || !teamId) {
    res.setHeader("Cache-Control", "s-maxage=30");
    return res.status(200).json({ live: false, source: "mock" });
  }

  try {
    // "live=all" returns every fixture in progress worldwide right now;
    // we filter down to EGSG's match, which keeps this cheap on quota.
    const response = await fetch(`https://${API_HOST}/fixtures?live=all`, {
      headers: { "x-apisports-key": apiKey }
    });

    if (!response.ok) {
      throw new Error(`API-Football responded ${response.status}`);
    }

    const data = await response.json();
    const match = (data.response || []).find(
      (item) =>
        String(item.teams.home.id) === String(teamId) ||
        String(item.teams.away.id) === String(teamId)
    );

    // Live data must never be cached for long.
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=10");

    if (!match) {
      return res.status(200).json({ live: false, source: "live" });
    }

    const isHome = String(match.teams.home.id) === String(teamId);
    return res.status(200).json({
      live: true,
      source: "live",
      status: match.fixture.status?.short,
      elapsed: match.fixture.status?.elapsed,
      home: match.teams.home.name,
      away: match.teams.away.name,
      homeLogo: match.teams.home.logo,
      awayLogo: match.teams.away.logo,
      isHome,
      homeScore: match.goals?.home ?? 0,
      awayScore: match.goals?.away ?? 0,
      competition: match.league?.name || ""
    });
  } catch (error) {
    console.error("live.js error:", error.message);
    res.setHeader("Cache-Control", "s-maxage=20");
    return res.status(200).json({ live: false, source: "mock", error: error.message });
  }
};
