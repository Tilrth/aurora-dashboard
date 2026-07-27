<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aurora — Dein Morning Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
<link rel="icon" href="icon-512.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Aurora">
<meta name="theme-color" content="#0b0d12">
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>

<!-- ══════════ HEADER ══════════ -->
<header class="topbar">
  <div class="brand">
    <div class="brand-dot"></div>
    <span class="brand-name">AURORA</span>
  </div>
  <div class="topbar-actions">
    <div class="clock" id="clock">--:--</div>
    <button class="icon-btn" id="refresh-btn" title="Alles neu laden">↻</button>
    <button class="icon-btn" id="focus-btn" title="Fokus-Modus">◉</button>
    <button class="icon-btn" id="theme-btn" title="Theme wechseln">☾</button>
    <button class="icon-btn" id="settings-btn" title="Einstellungen">⚙</button>
  </div>
</header>

<main>

  <div class="greeting-block">
    <h1 id="greeting">Guten Morgen</h1>
    <p class="date-line" id="date-line"></p>
  </div>

  <!-- ═══ KI-BRIEFING (volle Breite, ganz oben) ═══ -->
  <div class="card ai-card">
    <div class="card-head"><h2>KI-Briefing</h2></div>
    <div id="ai-output" class="ai-output">
      <div class="ai-loading"><div class="spinner"></div> Dein Briefing wird erstellt …</div>
    </div>
  </div>

  <!-- ═══ LAYOUT: Hauptspalte links / News-Rail rechts ═══ -->
  <div class="layout">

    <div class="col-main">

      <!-- Termine -->
      <div class="card" id="cal-connect-card">
        <div class="card-head"><h2>Google Calendar</h2></div>
        <p class="muted">Verbinde dein Google-Konto, um Termine, Geburtstage und Feiertage zu sehen.</p>
        <button class="btn btn-accent" id="cal-connect">Mit Google verbinden</button>
        <p class="muted small">Falls der Button nicht reagiert: Google Client ID in den Einstellungen prüfen.</p>
      </div>

      <div class="card hidden" id="cal-data-card">
        <div class="card-head">
          <h2>Termine</h2>
          <div class="cal-views" id="cal-views">
            <button class="chip active" data-calview="day">Tag</button>
            <button class="chip" data-calview="week">Woche</button>
            <button class="chip" data-calview="month">Monat</button>
          </div>
        </div>
        <div id="cal-events" class="event-list"></div>
        <div class="card-footer">
          <button class="btn btn-ghost" id="cal-disconnect">Verbindung trennen</button>
        </div>
      </div>

      <!-- Märkte -->
      <div class="section-head"><h2>Märkte</h2></div>
      <div class="card">
        <div class="card-head">
          <h2>Deine Watchlist</h2>
        </div>
        <div id="tv-watchlist" class="tv-box small"></div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Wirtschaftskalender</h2>
          <span class="muted small">ForexFactory · EUR & USD</span>
        </div>
        <div id="ff-calendar" class="ff-list">
          <p class="muted">Wird geladen …</p>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Earnings & IPOs</h2></div>
        <div id="tv-earnings" class="tv-box tall"></div>
      </div>

    </div>

    <!-- News-Rail rechts -->
    <aside class="col-news">
      <div class="section-head">
        <h2>News</h2>
        <div class="filter-bar" id="news-filters">
          <button class="chip active" data-cat="all">Alle</button>
          <button class="chip" data-cat="politik">Politik</button>
          <button class="chip" data-cat="wirtschaft">Wirtschaft</button>
          <button class="chip" data-cat="tech">Tech / IT</button>
          <button class="chip" data-cat="ki">KI</button>
        </div>
      </div>
      <div id="news-list" class="news-list scrollable">
        <p class="muted">News werden geladen …</p>
      </div>
    </aside>

  </div>

</main>

<!-- ══════════ FOKUS-MODUS ══════════ -->
<div id="focus-overlay" class="hidden">
  <button class="icon-btn focus-exit" id="focus-exit">✕</button>
  <div class="focus-clock" id="focus-clock">--:--</div>
  <div class="focus-next" id="focus-next"></div>
</div>

<!-- ══════════ EINSTELLUNGEN ══════════ -->
<div id="settings-overlay" class="hidden">
  <div class="settings-panel">
    <div class="card-head">
      <h2>Einstellungen</h2>
      <button class="icon-btn" id="settings-close">✕</button>
    </div>

    <div class="settings-section">
      <h3>Google Calendar</h3>
      <label>Google Client ID <span class="muted small">(aus Google Cloud Console)</span></label>
      <input type="text" id="set-gclient" placeholder="xxxx.apps.googleusercontent.com">
      <p class="muted small">Cloud Console → Calendar API aktivieren → OAuth-Client (Web) → deine GitHub-Pages-URL als Authorized JavaScript Origin.</p>
    </div>

    <div class="settings-section">
      <h3>KI-Briefing (Gemini)</h3>
      <label>Gemini API-Key <span class="muted small">(kostenlos: aistudio.google.com/apikey)</span></label>
      <input type="password" id="set-gemini" placeholder="AIza...">
      <p class="muted small">Das passende Modell wird automatisch gewählt.</p>
    </div>

    <div class="settings-section">
      <h3>Darstellung</h3>
      <label class="row"><input type="checkbox" id="set-autotheme" checked> Automatisch nach System (hell/dunkel)</label>
    </div>

    <button class="btn btn-accent full" id="settings-save">Speichern</button>
    <p class="muted small center">Alle Daten bleiben lokal in deinem Browser.</p>
  </div>
</div>

<script src="js/state.js"></script>
<script src="js/news.js"></script>
<script src="js/markets.js"></script>
<script src="js/calendar.js"></script>
<script src="js/briefing.js"></script>
<script src="js/app.js"></script>
</body>
</html>
