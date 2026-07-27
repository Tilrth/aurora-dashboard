/* ═══════════ Märkte: TradingView + ForexFactory ═══════════ */
const Markets = {
  // Deine Watchlist (Xetra-Ticker)
  symbols: [
    { s: 'XETR:XDEM', short: 'World Momentum', d: 'MSCI World Momentum' },
    { s: 'XETR:H4Z6', short: 'China',          d: 'MSCI China' },
    { s: 'XETR:CEMR', short: 'Europe Momentum', d: 'MSCI Europe Momentum' },
    { s: 'XETR:FLXT', short: 'Taiwan',         d: 'FTSE Taiwan' },
    { s: 'XETR:FLXK', short: 'Korea',          d: 'FTSE Korea' },
  ],
  activeSymbol: 'XETR:XDEM',

  theme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  },

  embed(containerId, widgetSrc, config) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.style.height = '100%';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    wrap.appendChild(inner);
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = widgetSrc;
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    wrap.appendChild(script);
    box.appendChild(wrap);
  },

  /* ─── Watchlist: Candlestick-Chart mit Symbol- & Zeitraum-Wahl ─── */
  renderSymbolChips() {
    const el = document.getElementById('wl-symbols');
    el.innerHTML = this.symbols.map(x =>
      `<button class="chip ${x.s === this.activeSymbol ? 'active' : ''}"
               data-symbol="${x.s}" title="${x.d}">${x.short}</button>`
    ).join('');
    el.querySelectorAll('.chip').forEach(c =>
      c.addEventListener('click', () => {
        this.activeSymbol = c.dataset.symbol;
        this.renderSymbolChips();
        this.buildChart();
      }));
  },

  buildChart() {
    this.embed('tv-chart',
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js', {
        symbol: this.activeSymbol,
        interval: 'D',              // immer Tages-Chart
        timezone: 'Europe/Berlin',
        theme: this.theme(),
        style: '1',                 // 1 = Candlesticks
        locale: 'de',
        width: '100%',
        height: '100%',
        hide_volume: true,          // Volumen-Indikator aus
        hide_side_toolbar: true,
        allow_symbol_change: false,
        details: false,
        calendar: false,
        withdateranges: false,
        support_host: 'https://www.tradingview.com'
      });
  },

  initChartControls() {
    this.renderSymbolChips();
    // Link zum vollen Chart auf tradingview.com aktualisieren
    const link = document.getElementById('tv-open');
    if (link) {
      const update = () => {
        link.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(this.activeSymbol);
      };
      update();
      document.getElementById('wl-symbols').addEventListener('click', update);
    }
  },

  buildEarnings() {
    this.embed('tv-earnings',
      'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js', {
        colorTheme: this.theme(),
        isTransparent: true,
        displayMode: 'regular',
        width: '100%',
        height: '340',
        locale: 'de',
        feedMode: 'market',
        market: 'stock'
      });
  },

  /* ─── ForexFactory Wirtschaftskalender ───
     Filter: nur High-Impact + Feiertage, nur EUR & USD */
  ffEvents: [],
  FF_URL: 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml',
  FF_IMPACTS: ['High', 'Holiday'],
  FF_CURRENCIES: ['EUR', 'USD'],

  // Zeiten im Feed sind US Eastern Time → in lokale Zeit umrechnen
  etToLocal(dateStr, timeStr) {
    if (!dateStr || !timeStr || /all day|tentative/i.test(timeStr)) return null;
    const m = dateStr.match(/(\d{2})-(\d{2})-(\d{4})/);
    const t = timeStr.match(/(\d{1,2}):(\d{2})(am|pm)/i);
    if (!m || !t) return null;
    let hh = parseInt(t[1]) % 12;
    if (t[3].toLowerCase() === 'pm') hh += 12;
    const mm = t[2];
    const guess = Date.parse(`${m[3]}-${m[1]}-${m[2]}T${String(hh).padStart(2, '0')}:${mm}:00Z`);
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
    const etWall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}Z`);
    return new Date(guess - (etWall - guess));
  },

  async loadFF() {
    const el = document.getElementById('ff-calendar');
    try {
      const res = await fetch(
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(this.FF_URL),
        { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error('Feed nicht erreichbar');
      const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
      this.ffEvents = [];
      doc.querySelectorAll('event').forEach(ev => {
        const get = tag => ev.querySelector(tag)?.textContent?.trim() || '';
        const impact = get('impact');
        const cur = get('country');
        if (!this.FF_IMPACTS.includes(impact) || !this.FF_CURRENCIES.includes(cur)) return;
        this.ffEvents.push({
          title: get('title'),
          currency: cur,
          impact,
          date: get('date'),
          time: get('time'),
          forecast: get('forecast'),
          previous: get('previous'),
          local: this.etToLocal(get('date'), get('time')),
        });
      });
      this.renderFF();
    } catch (e) {
      el.innerHTML = '<p class="muted">Kalender konnte nicht geladen werden. Später nochmal versuchen (↻ oben rechts).</p>';
    }
  },

  renderFF() {
    const el = document.getElementById('ff-calendar');
    if (!this.ffEvents.length) {
      el.innerHTML = '<p class="muted">Diese Woche keine wichtigen EUR/USD-Termine.</p>';
      return;
    }
    const groups = {};
    this.ffEvents.forEach(ev => {
      const d = ev.local || new Date(ev.date);
      const key = d.toDateString();
      (groups[key] = groups[key] || []).push(ev);
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
            <span class="ff-impact ${ev.impact === 'Holiday' ? 'holiday' : 'high'}"
                  title="${ev.impact === 'Holiday' ? 'Feiertag' : 'Hohe Wichtigkeit'}"></span>
            <span class="ff-cur">${ev.currency}</span>
            <div class="ff-main">
              <span class="ff-title">${esc(ev.title)}</span>
              ${ev.forecast || ev.previous ? `
                <span class="ff-nums">
                  ${ev.forecast ? 'Prognose: ' + esc(ev.forecast) : ''}
                  ${ev.forecast && ev.previous ? ' · ' : ''}
                  ${ev.previous ? 'Vorher: ' + esc(ev.previous) : ''}
                </span>` : ''}
            </div>
            <span class="ff-time">${ev.local
              ? ev.local.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              : '—'}</span>
          </div>`).join('')}
      </div>`;
    }).join('');
  },

  buildAll() {
    this.initChartControls();
    this.buildChart();
    this.buildEarnings();
    this.loadFF();
  },

  rebuild() { this.buildAll(); }
};
