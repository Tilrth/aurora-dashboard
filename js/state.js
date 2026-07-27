/* ═══════════ State & Settings ═══════════ */
const State = {
  defaults: {
    gclient: '',        // Google OAuth Client ID
    gemini: '',         // Gemini API Key

    theme: 'dark',
    autotheme: true,
    googleToken: null,
  },

  load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('aurora_settings') || '{}'); } catch (e) {}
    this.data = Object.assign({}, this.defaults, s);
    return this.data;
  },

  get(key) { return this.data[key]; },

  set(key, val) {
    this.data[key] = val;
    localStorage.setItem('aurora_settings', JSON.stringify(this.data));
  },

  /* ─── Lesen später ─── */
  getLater() {
    try { return JSON.parse(localStorage.getItem('aurora_later') || '[]'); } catch (e) { return []; }
  },
  addLater(article) {
    const list = this.getLater();
    if (list.some(a => a.link === article.link)) return false;
    list.unshift({ ...article, savedAt: Date.now() });
    localStorage.setItem('aurora_later', JSON.stringify(list));
    return true;
  },
  removeLater(link) {
    const list = this.getLater().filter(a => a.link !== link);
    localStorage.setItem('aurora_later', JSON.stringify(list));
  },
  updateLaterBadge() {
    const n = this.getLater().length;
    const badge = document.getElementById('later-count');
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  },

  /* ─── Theme ─── */
  applyTheme() {
    let theme = this.get('theme');
    if (this.get('autotheme')) {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-btn').textContent = theme === 'dark' ? '☾' : '☀';
    return theme;
  },
  toggleTheme() {
    this.set('autotheme', false);
    const cur = document.documentElement.getAttribute('data-theme');
    this.set('theme', cur === 'dark' ? 'light' : 'dark');
    this.applyTheme();
    if (window.Markets) Markets.rebuild(); // TradingView-Widgets ans Theme anpassen
  }
};

State.load();
State.updateLaterBadge();
