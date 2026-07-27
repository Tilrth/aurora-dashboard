/* ═══════════ Google Calendar Integration ═══════════ */
const Cal = {
  tokenClient: null,
  token: null,
  events: [],
  SCOPES: 'https://www.googleapis.com/auth/calendar.readonly',

  hasClientId() { return !!State.get('gclient'); },

  initTokenClient() {
    if (this.tokenClient || !this.hasClientId() || typeof google === 'undefined') return;
    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: State.get('gclient'),
        scope: this.SCOPES,
        callback: (resp) => {
          if (resp.error) { console.error(resp); return; }
          this.token = resp.access_token;
          State.set('googleToken', { token: this.token, exp: Date.now() + 3500 * 1000 });
          this.onConnected();
        },
      });
    } catch (e) { console.error('TokenClient Fehler:', e); }
  },

  connect() {
    if (!this.hasClientId()) {
      alert('Bitte zuerst in den Einstellungen deine Google Client ID hinterlegen (⚙ oben rechts).');
      return;
    }
    this.initTokenClient();
    if (this.tokenClient) this.tokenClient.requestAccessToken({ prompt: 'consent' });
  },

  disconnect() {
    if (this.token && typeof google !== 'undefined') {
      try { google.accounts.oauth2.revoke(this.token, () => {}); } catch (e) {}
    }
    this.token = null;
    State.set('googleToken', null);
    this.events = [];
    this.renderConnectState();
  },

  isConnected() { return !!this.token; },

  async api(path) {
    const res = await fetch('https://www.googleapis.com/calendar/v3' + path, {
      headers: { Authorization: 'Bearer ' + this.token }
    });
    if (res.status === 401) { this.disconnect(); throw new Error('Token abgelaufen'); }
    if (!res.ok) throw new Error('API-Fehler ' + res.status);
    return res.json();
  },

  async loadEvents() {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 864e5);
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: in90.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });
    // Primärkalender + Geburtstage + deutsche Feiertage
    const calIds = [
      { id: 'primary', type: 'event' },
      { id: 'addressbook#contacts@group.v.calendar.google.com', type: 'birthday' },
      { id: 'de.german#holiday@group.v.calendar.google.com', type: 'holiday' },
    ];
    const all = [];
    for (const cal of calIds) {
      try {
        const data = await this.api(`/calendars/${encodeURIComponent(cal.id)}/events?${params}`);
        (data.items || []).forEach(ev => all.push({
          title: ev.summary || '(ohne Titel)',
          start: ev.start?.dateTime || ev.start?.date,
          allDay: !ev.start?.dateTime,
          type: cal.type,
          location: ev.location || '',
        }));
      } catch (e) { console.warn('Kalender nicht ladbar:', cal.id, e); }
    }
    this.events = all
      .filter(e => e.start)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    this.render();
    this.renderBrief();
  },

  groupByDay(events, limitDays = 14) {
    const groups = {};
    events.forEach(ev => {
      const d = new Date(ev.start);
      const key = d.toDateString();
      (groups[key] = groups[key] || []).push(ev);
    });
    return Object.entries(groups).slice(0, limitDays);
  },

  dayLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 864e5);
    if (d.toDateString() === today.toDateString()) return 'Heute';
    if (d.toDateString() === tomorrow.toDateString()) return 'Morgen';
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  eventHtml(ev) {
    const d = new Date(ev.start);
    const time = ev.allDay
      ? '<span class="event-time allday">ganztägig</span>'
      : `<span class="event-time">${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>`;
    return `<div class="event-item">${time}<span class="event-title ${ev.type}">${News.esc(ev.title)}</span></div>`;
  },

  render() {
    const el = document.getElementById('cal-events');
    if (!this.events.length) {
      el.innerHTML = '<p class="muted">Keine anstehenden Termine in den nächsten 90 Tagen.</p>';
      return;
    }
    el.innerHTML = this.groupByDay(this.events, 30).map(([day, evs]) =>
      `<div class="event-day-label">${this.dayLabel(day)}</div>` + evs.map(e => this.eventHtml(e)).join('')
    ).join('');
  },

  renderBrief() {
    const el = document.getElementById('brief-events');
    const status = document.getElementById('brief-cal-status');
    if (!this.isConnected()) {
      status.textContent = 'nicht verbunden';
      el.innerHTML = '<p class="muted">Verbinde Google Calendar im Kalender-Tab, um deine Termine zu sehen.</p>';
      return;
    }
    status.textContent = 'verbunden ✓';
    const upcoming = this.events.slice(0, 50);
    el.innerHTML = upcoming.length
      ? this.groupByDay(upcoming, 7).map(([day, evs]) =>
          `<div class="event-day-label">${this.dayLabel(day)}</div>` + evs.map(e => this.eventHtml(e)).join('')
        ).join('')
      : '<p class="muted">Keine anstehenden Termine — freier Tag! 🎉</p>';
  },

  nextEvent() {
    const now = new Date();
    return this.events.find(e => !e.allDay && new Date(e.start) > now)
        || this.events.find(e => e.allDay && new Date(e.start).toDateString() === now.toDateString());
  },

  renderConnectState() {
    const connected = this.isConnected();
    document.getElementById('cal-connect-card').classList.toggle('hidden', connected);
    document.getElementById('cal-data-card').classList.toggle('hidden', !connected);
    this.renderBrief();
  },

  async onConnected() {
    this.renderConnectState();
    await this.loadEvents();
  },

  init() {
    document.getElementById('cal-connect').addEventListener('click', () => this.connect());
    document.getElementById('cal-disconnect').addEventListener('click', () => this.disconnect());
    document.getElementById('cal-refresh').addEventListener('click', () => this.loadEvents());
    // Gespeichertes Token wiederherstellen (falls noch gültig)
    const saved = State.get('googleToken');
    if (saved && saved.exp > Date.now()) {
      this.token = saved.token;
      this.renderConnectState();
      this.loadEvents();
    } else if (this.hasClientId()) {
      // Token abgelaufen → stille Neu-Verbindung im Hintergrund versuchen
      this.trySilentRefresh();
    }
  },

  // Stille Neu-Anmeldung: funktioniert, wenn der Nutzer früher schon mal
  // zugestimmt hat — kein Klick, kein Popup nötig.
  trySilentRefresh() {
    const attempt = () => {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        setTimeout(attempt, 500); // GIS-Script lädt noch
        return;
      }
      this.initTokenClient();
      if (!this.tokenClient) return;
      try {
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        console.log('Stille Anmeldung nicht möglich — bitte einmal manuell verbinden.');
      }
    };
    setTimeout(attempt, 1200);
  }
};
