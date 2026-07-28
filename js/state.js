/* ═══════════ State & Settings ═══════════ */
const State = {
  defaults: {
    gclient: '',        // Google OAuth Client ID
    gemini: '',         // Gemini API Key
    theme: 'dark',
    autotheme: true,
    googleToken: null,
    geminiModel: '',    // zuletzt erfolgreich genutztes Modell (Cache)
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
    if (window.Markets) Markets.rebuild(); // Module ans Theme anpassen
  }
};

State.load();
