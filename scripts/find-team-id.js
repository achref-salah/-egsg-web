// scripts/find-team-id.js
// One-time helper: run locally with Node 18+ to find your team & league IDs.
//
// Usage:
//   API_FOOTBALL_KEY=your_key_here node scripts/find-team-id.js
//
// This does NOT need to be deployed — it's just for you to run once.

const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  console.error("Set API_FOOTBALL_KEY first, e.g.:\n  API_FOOTBALL_KEY=xxxx node scripts/find-team-id.js");
  process.exit(1);
}

async function main() {
  const headers = { "x-apisports-key": apiKey };

  console.log("Searching teams for 'Gafsa'...\n");
  const teamsRes = await fetch("https://v3.football.api-sports.io/teams?search=Gafsa", { headers });
  const teamsData = await teamsRes.json();

  if (!teamsData.response?.length) {
    console.log("No team found for 'Gafsa'. Try 'Gawafel' or 'El Gawafel' instead:");
    const altRes = await fetch("https://v3.football.api-sports.io/teams?search=Gawafel", { headers });
    const altData = await altRes.json();
    printTeams(altData.response);
  } else {
    printTeams(teamsData.response);
  }

  console.log("\nSearching Tunisian leagues...\n");
  const leaguesRes = await fetch("https://v3.football.api-sports.io/leagues?country=Tunisia", { headers });
  const leaguesData = await leaguesRes.json();
  (leaguesData.response || []).forEach((item) => {
    console.log(`League: ${item.league.name}  |  id=${item.league.id}  |  type=${item.league.type}`);
  });

  console.log(
    "\nOnce you have your team id and league id, add them as Vercel environment variables:\n" +
      "  EGSG_TEAM_ID, EGSG_LEAGUE_ID, EGSG_SEASON (e.g. 2026), API_FOOTBALL_KEY"
  );
}

function printTeams(teams) {
  (teams || []).forEach((item) => {
    console.log(`Team: ${item.team.name}  |  id=${item.team.id}  |  country=${item.team.country}`);
  });
}

main().catch((error) => {
  console.error("Lookup failed:", error.message);
  process.exit(1);
});
