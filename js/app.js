/* ═══════════ App-Steuerung (Single-Page) ═══════════ */
const App = {
  /* ─── Uhr & Begrüßung ─── */
  tickClock() {
    const now = new Date();
    const t = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('clock').textContent = t;
    const fc = document.getElementById('focus-clock');
    if (fc) fc.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  greeting() {
    const h = new Date().getHours();
    let g = 'Guten Abend';
    if (h < 11) g = 'Guten Morgen';
    else if (h < 18) g = 'Guten Tag';
    document.getElementById('greeting').textContent = g;
    document.getElementById('date-line').textContent =
      new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },

  /* ─── Globaler Refresh ─── */
  refreshAll() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 1200);
    News.load(true);
    if (Cal.isConnected()) Cal.loadEvents();
    Markets.buildAll();
  },

  /* ─── Fokus-Modus (nur Uhr + nächster Termin, sonst nichts) ─── */
  openFocus() {
    document.getElementById('focus-overlay').classList.remove('hidden');
    this.renderFocusNext();
  },
  closeFocus() {
    document.getElementById('focus-overlay').classList.add('hidden');
  },
  renderFocusNext() {
    const el = document.getElementById('focus-next');
    const ev = Cal.nextEvent();
    if (!ev) { el.innerHTML = ''; return; }
    const d = new Date(ev.start);
    const when = ev.allDay
      ? 'heute, ganztägig'
      : d.toLocaleDateString('de-DE', { weekday: 'long' }) + ', ' +
        d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
    el.innerHTML = `
      <p class="muted small" style="letter-spacing:2px;text-transform:uppercase">Nächster Termin</p>
      <p style="font-size:26px;font-weight:600;margin:10px 0">${News.esc(ev.title)}</p>
      <p class="muted">${when}</p>`;
  },

  /* ─── Einstellungen ─── */
  openSettings() {
    document.getElementById('set-gclient').value = State.get('gclient');
    document.getElementById('set-gemini').value = State.get('gemini');
    document.getElementById('set-autotheme').checked = State.get('autotheme');
    document.getElementById('settings-overlay').classList.remove('hidden');
  },
  closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
  },
  saveSettings() {
    State.set('gclient', document.getElementById('set-gclient').value.trim());
    State.set('gemini', document.getElementById('set-gemini').value.trim());
    State.set('autotheme', document.getElementById('set-autotheme').checked);
    State.applyTheme();
    if (window.Briefing) Briefing.auto(); // falls Key gerade erst eingetragen wurde
    this.closeSettings();
  },

  /* ─── Märkte erst laden, wenn sichtbar (Scroll) ─── */
  lazyMarkets() {
    const target = document.getElementById('tv-chart');
    if (!('IntersectionObserver' in window)) { Markets.buildAll(); return; }
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        Markets.buildAll();
        io.disconnect();
      }
    }, { rootMargin: '300px' });
    io.observe(target);
  },

  init() {
    State.applyTheme();
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => State.applyTheme());

    // Header-Buttons
    document.getElementById('refresh-btn').addEventListener('click', () => this.refreshAll());
    document.getElementById('theme-btn').addEventListener('click', () => State.toggleTheme());
    document.getElementById('focus-btn').addEventListener('click', () => this.openFocus());
    document.getElementById('focus-exit').addEventListener('click', () => this.closeFocus());
    document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
    document.getElementById('settings-close').addEventListener('click', () => this.closeSettings());
    document.getElementById('settings-save').addEventListener('click', () => this.saveSettings());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.closeFocus(); this.closeSettings(); }
    });

    // Uhr
    this.greeting();
    this.tickClock();
    setInterval(() => this.tickClock(), 1000);

    // Module
    News.init();
    Cal.init();
    Briefing.init();
    this.lazyMarkets();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
