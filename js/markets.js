/* ═══════════ Märkte: eigene Daten (data/*.json via GitHub Action) ═══════════ */
const Markets = {

  async fetchJson(file) {
    const res = await fetch(file + '?t=' + Date.now());
    if (!res.ok) throw new Error(file + ' nicht gefunden');
    return res.json();
  },

  /* ─── Watchlist: Kurs + Tages-% ─── */
  async buildWatchlist() {
    const el = document.getElementById('watchlist');
    try {
      const data = await this.fetchJson('data/quotes.json');
      el.innerHTML = data.quotes.map(q => {
        const up = q.change_pct >= 0;
        const price = q.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pct = (up ? '+' : '') + q.change_pct.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' %';
        return `
          <div class="quote">
            <div class="quote-info">
              <span class="quote-name">${News.esc(q.name)}</span>
              <span class="quote-symbol">${q.symbol}</span>
            </div>
            <div class="quote-nums">
              <span class="quote-price">${price} €</span>
              <span class="quote-pct ${up ? 'up' : 'down'}">${pct}</span>
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<p class="muted">Kursdaten fehlen noch — einmal die GitHub Action „Update Marktdaten“ im Actions-Tab starten, dann erscheinen sie hier.</p>`;
    }
  },

  /* ─── Wirtschaftskalender (ForexFactory via Pipeline) ─── */
  async loadFF() {
    const el = document.getElementById('ff-calendar');
    try {
      const data = await this.fetchJson('data/ff.json');
      this.renderFF(data.events || []);
    } catch (e) {
      el.innerHTML = '<p class="muted">Kalenderdaten fehlen noch — siehe Hinweis bei der Watchlist.</p>';
    }
  },

  renderFF(events) {
    const el = document.getElementById('ff-calendar');
    if (!events.length) {
      el.innerHTML = '<p class="muted">Diese Woche keine wichtigen EUR/USD-Termine.</p>';
      return;
    }
    const groups = {};
    events.forEach(ev => {
      const d = ev.utc ? new Date(ev.utc) : new Date(ev.date);
      (groups[d.toDateString()] = groups[d.toDateString()] || []).push({ ...ev, d });
    });
    const esc = s => News.esc(s);
    el.innerHTML = Object.entries(groups).map(([day, evs]) => {
      const d = new Date(day);
      const isToday = d.toDateString() === new Date().toDateString();
      const label = isToday ? 'Heute'
        : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
      return `<div class="ff-day ${isToday ? 'today' : ''}">
        <div class="ff-day-label">${label}</div>
        ${evs.map(ev => `
          <div class="ff-item">
            <span class="ff-impact ${ev.impact === 'Holiday' ? 'holiday' : 'high'}"></span>
            <span class="ff-cur">${ev.currency}</span>
            <div class="ff-main">
              <span class="ff-title">${esc(ev.title)}</span>
              ${ev.forecast || ev.previous ? `
                <span class="ff-nums">
                  ${ev.forecast ? 'Prognose ' + esc(ev.forecast) : ''}
                  ${ev.forecast && ev.previous ? ' · ' : ''}
                  ${ev.previous ? 'Vorher ' + esc(ev.previous) : ''}
                </span>` : ''}
            </div>
            <span class="ff-time">${ev.utc
              ? ev.d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              : '—'}</span>
          </div>`).join('')}
      </div>`;
    }).join('');
  },

  /* ─── Earnings & IPOs (Markt-News via Pipeline) ─── */
  async loadMarketNews() {
    const el = document.getElementById('market-news');
    try {
      const data = await this.fetchJson('data/marketnews.json');
      const items = data.items || [];
      el.innerHTML = items.length
        ? items.map(it => `
          <a class="market-news-item" href="${it.link}" target="_blank" rel="noopener">
            <span class="mn-title">${News.esc(it.title)}</span>
            <span class="mn-src">${News.esc(it.source)}</span>
          </a>`).join('')
        : '<p class="muted">Keine aktuellen Meldungen.</p>';
    } catch (e) {
      el.innerHTML = '<p class="muted">Markt-News fehlen noch — siehe Hinweis bei der Watchlist.</p>';
    }
  },

  buildAll() {
    this.buildWatchlist();
    this.loadFF();
    this.loadMarketNews();
  },

  rebuild() { this.buildAll(); }
};
