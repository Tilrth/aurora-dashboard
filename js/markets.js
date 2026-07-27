/* ═══════════ Märkte: TradingView Widgets ═══════════ */
const Markets = {
  // Deine Watchlist aus dem Foto (Xetra-Ticker)
  symbols: [
    { s: 'XETR:XDEM', d: 'MSCI World Momentum' },
    { s: 'XETR:H4Z6', d: 'MSCI China' },
    { s: 'XETR:CEMR', d: 'MSCI Europe Momentum' },
    { s: 'XETR:FLXT', d: 'FTSE Taiwan' },
    { s: 'XETR:FLXK', d: 'FTSE Korea' },
  ],

  theme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  },

  // TradingView-Widgets werden als Script-Tag mit JSON-Config eingebettet
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

  buildWatchlist() {
    this.embed('tv-watchlist',
      'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js', {
        colorTheme: this.theme(),
        dateRange: '1D',
        showChart: true,
        locale: 'de',
        width: '100%',
        height: '420',
        largeChartUrl: '',
        isTransparent: true,
        showSymbolLogo: true,
        showFloatingTooltip: true,
        plotLineColorGrowing: 'rgba(46, 204, 113, 1)',
        plotLineColorFalling: 'rgba(255, 92, 108, 1)',
        gridLineColor: 'rgba(120, 134, 156, 0.15)',
        scaleFontColor: 'rgba(154, 163, 181, 1)',
        belowLineFillColorGrowing: 'rgba(46, 204, 113, 0.12)',
        belowLineFillColorFalling: 'rgba(255, 92, 108, 0.12)',
        symbolActiveColor: 'rgba(79, 124, 255, 0.12)',
        tabs: [{
          title: 'Deine ETFs',
          symbols: this.symbols,
          originalTitle: 'Deine ETFs'
        }]
      });
  },

  buildHotlists() {
    this.embed('tv-hotlists',
      'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js', {
        colorTheme: this.theme(),
        dateRange: '1D',
        exchange: 'US',
        showChart: true,
        locale: 'de',
        width: '100%',
        height: '480',
        largeChartUrl: '',
        isTransparent: true,
        showSymbolLogo: true,
        showFloatingTooltip: false,
        plotLineColorGrowing: 'rgba(46, 204, 113, 1)',
        plotLineColorFalling: 'rgba(255, 92, 108, 1)'
      });
  },

  buildEcon() {
    this.embed('tv-econ',
      'https://s3.tradingview.com/external-embedding/embed-widget-events.js', {
        colorTheme: this.theme(),
        isTransparent: true,
        width: '100%',
        height: '480',
        locale: 'de',
        importanceFilter: '-1,0,1',   // nur mittlere & hohe Wichtigkeit
        countryFilter: 'us,eu,de,cn,jp,gb'
      });
  },

  buildEarnings() {
    // News-Timeline: Earnings, IPOs & große Marktbewegungen
    this.embed('tv-earnings',
      'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js', {
        colorTheme: this.theme(),
        isTransparent: true,
        displayMode: 'regular',
        width: '100%',
        height: '480',
        locale: 'de',
        feedMode: 'market',
        market: 'stock'
      });
  },

  buildAll() {
    this.buildWatchlist();
    this.buildHotlists();
    this.buildEcon();
    this.buildEarnings();
  },

  rebuild() {
    if (document.getElementById('view-markets').classList.contains('active')) this.buildAll();
    else this._pending = true;
  },

  onViewShown() {
    if (this._pending || !this._built) {
      this.buildAll();
      this._built = true;
      this._pending = false;
    }
  }
};
