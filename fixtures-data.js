// js/fixtures-data.js
// Fetches from our own /api/* serverless functions (never calls API-Football
// directly from the browser) and renders into the existing card markup/CSS.
// Include this AFTER js/main.js on index.html and fixtures.html.

(function () {
  const LANG_STORAGE_KEY = "egsg-language";

  function currentLang() {
    return localStorage.getItem(LANG_STORAGE_KEY) === "ar" ? "ar" : "en";
  }

  function formatDateTime(isoString) {
    const date = new Date(isoString);
    const lang = currentLang();
    const datePart = date.toLocaleDateString(lang === "ar" ? "ar-TN" : "en-GB", {
      day: "2-digit",
      month: "short"
    });
    const timePart = date.toLocaleTimeString(lang === "ar" ? "ar-TN" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return { datePart, timePart, full: `${datePart} ${date.getFullYear()} • ${timePart}` };
  }

  function initials(name) {
    if (!name) return "?";
    return name
      .replace(/[^\p{L}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  function teamBadge(name, logo, variant) {
    if (logo) {
      return `<span class="team-badge team-badge-${variant}" style="padding:6px;"><img src="${logo}" alt="${name} crest" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" loading="lazy" /></span>`;
    }
    return `<span class="team-badge team-badge-${variant}">${initials(name)}</span>`;
  }

  function fixtureCardHTML(fixture, labels) {
    const { datePart, timePart, full } = formatDateTime(fixture.date);
    const homeLabel = fixture.isHome ? labels.home : labels.away;
    const awayLabel = fixture.isHome ? labels.away : labels.home;
    const finished = fixture.status === "FT" || fixture.status === "AET" || fixture.status === "PEN";
    const centerContent = finished
      ? `<span class="match-vs">${fixture.homeScore ?? "-"} : ${fixture.awayScore ?? "-"}</span>`
      : `<span class="match-vs">VS</span>`;

    return `
      <article class="match-card-panel">
        <div class="match-top">
          <div class="team-side">
            ${teamBadge(fixture.home, fixture.homeLogo, fixture.isHome ? "green" : "light")}
            <span class="team-name">${fixture.home}</span>
            <span class="team-position">${homeLabel}</span>
          </div>
          <div class="match-center">
            ${centerContent}
            <span class="match-kickoff">${datePart} • ${timePart}</span>
          </div>
          <div class="team-side">
            ${teamBadge(fixture.away, fixture.awayLogo, fixture.isHome ? "light" : "green")}
            <span class="team-name">${fixture.away}</span>
            <span class="team-position">${awayLabel}</span>
          </div>
        </div>
        <div class="match-bottom">
          <div class="match-competition-row">
            <span class="match-competition">${fixture.competition || ""}</span>
          </div>
          <div class="match-details">
            <span class="match-date-time">${full}</span>
            <span class="stadium-label">${fixture.venue || ""}</span>
          </div>
        </div>
      </article>`;
  }

  async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
    return response.json();
  }

  function labelsForLang() {
    const lang = currentLang();
    return lang === "ar"
      ? { home: "مضيف", away: "ضيف" }
      : { home: "Home", away: "Away" };
  }

  // ---- Fixtures grids (home preview + full fixtures page) ----
  async function renderFixtureGrid(container, type, limit) {
    if (!container) return;
    try {
      const { fixtures } = await fetchJSON(`/api/fixtures?type=${type}`);
      const labels = labelsForLang();
      const list = limit ? fixtures.slice(0, limit) : fixtures;
      if (!list.length) return; // leave static placeholder cards untouched
      container.innerHTML = list.map((f) => fixtureCardHTML(f, labels)).join("");
    } catch (error) {
      console.warn("Could not load fixtures, keeping static content:", error.message);
    }
  }

  // ---- Standings table ----
  async function renderStandings(tbody) {
    if (!tbody) return;
    try {
      const { standings } = await fetchJSON("/api/standings");
      tbody.innerHTML = standings
        .map(
          (row) => `
        <tr class="${row.team === "EGSG" || row.team.includes("Gawafel") ? "standings-row-highlight" : ""}">
          <td>${row.rank}</td>
          <td>${row.team}</td>
          <td>${row.played}</td>
          <td>${row.win}</td>
          <td>${row.draw}</td>
          <td>${row.lose}</td>
          <td>${row.goalsDiff}</td>
          <td><strong>${row.points}</strong></td>
        </tr>`
        )
        .join("");
    } catch (error) {
      console.warn("Could not load standings:", error.message);
    }
  }

  // ---- Hero "Next Match" card + live override on index.html ----
  async function renderHero() {
    const heroCard = document.querySelector(".hero-panel .match-card");
    if (!heroCard) return;

    try {
      const live = await fetchJSON("/api/live");
      if (live.live) {
        const labels = labelsForLang();
        heroCard.innerHTML = `
          <div class="match-header">
            <span class="badge" style="background:#e34848;color:#fff;">LIVE • ${live.elapsed ?? ""}'</span>
            <span class="match-date">${live.competition || ""}</span>
          </div>
          <div class="club-lineup">
            <div class="team">
              ${teamBadge(live.home, live.homeLogo, live.isHome ? "green" : "light").replace("team-badge", "team-mark")}
              <small>${live.isHome ? labels.home : labels.away}</small>
            </div>
            <div class="vs">${live.homeScore} - ${live.awayScore}</div>
            <div class="team">
              ${teamBadge(live.away, live.awayLogo, live.isHome ? "light" : "green").replace("team-badge", "team-mark alt")}
              <small>${live.isHome ? labels.away : labels.home}</small>
            </div>
          </div>`;
        return;
      }
    } catch (error) {
      console.warn("Live check failed:", error.message);
    }

    // No live match → show the next upcoming fixture instead of the hardcoded one.
    try {
      const { fixtures } = await fetchJSON("/api/fixtures?type=upcoming");
      const next = fixtures[0];
      if (!next) return;
      const { datePart } = formatDateTime(next.date);
      const labels = labelsForLang();

      const dateEl = heroCard.querySelector(".match-date");
      if (dateEl) dateEl.textContent = datePart;

      const teams = heroCard.querySelectorAll(".team");
      if (teams[0]) {
        teams[0].querySelector(".team-mark").textContent = initials(next.home);
        teams[0].querySelector("small").textContent = next.isHome ? labels.home : labels.away;
      }
      if (teams[1]) {
        teams[1].querySelector(".team-mark").textContent = initials(next.away);
        teams[1].querySelector("small").textContent = next.isHome ? labels.away : labels.home;
      }
      const stadiumStrong = heroCard.querySelector(".stadium strong");
      if (stadiumStrong && next.venue) stadiumStrong.textContent = next.venue;
    } catch (error) {
      console.warn("Could not load next fixture for hero:", error.message);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderHero();
    renderFixtureGrid(document.querySelector("#fixtures .fixture-card-grid"), "upcoming", 3);
    renderFixtureGrid(document.querySelector(".fixtures-list-page"), "upcoming");
    renderStandings(document.querySelector("#standings-table-body"));

    // Refresh the live score every 60s while the tab is open.
    setInterval(() => {
      if (document.querySelector(".hero-panel .match-card")) renderHero();
    }, 60000);
  });
})();
