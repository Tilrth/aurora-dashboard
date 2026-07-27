/* ═══════════ App-Steuerung ═══════════ */
const App = {
  /* ─── Navigation ─── */
  showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    if (name === 'markets') Markets.onViewShown();
  },

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

  /* ─── Fokus-Modus ─── */
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
    if (!ev) {
      el.innerHTML = '<p class="muted">Kein anstehender Termin — freie Fahrt. 🧘</p>';
      return;
    }
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
    document.getElementById('set-obsidian').value = State.get('obsidian');
    document.getElementById('set-autotheme').checked = State.get('autotheme');
    document.getElementById('settings-overlay').classList.remove('hidden');
  },
  closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
  },
  saveSettings() {
    State.set('gclient', document.getElementById('set-gclient').value.trim());
    State.set('gemini', document.getElementById('set-gemini').value.trim());
    State.set('obsidian', document.getElementById('set-obsidian').value.trim());
    State.set('autotheme', document.getElementById('set-autotheme').checked);
    State.applyTheme();
    Briefing.init();
    Obsidian.init();
    this.closeSettings();
  },

  init() {
    // Theme
    State.applyTheme();
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => State.applyTheme());

    // Tabs
    document.querySelectorAll('.tab').forEach(t =>
      t.addEventListener('click', () => this.showView(t.dataset.view)));
    document.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => this.showView(b.dataset.goto)));

    // Header-Buttons
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
    Obsidian.init();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
