/* ═══════════ Google Calendar Integration ═══════════ */
const Cal = {
  tokenClient: null,
  token: null,
  events: [],
  viewMode: 'day',           // 'day' | 'week' | 'month'
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
      maxResults: '150',
    });
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
          end: ev.end?.dateTime || ev.end?.date,
          allDay: !ev.start?.dateTime,
          type: cal.type,
        }));
      } catch (e) { console.warn('Kalender nicht ladbar:', cal.id, e); }
    }
    this.events = all
      .filter(e => e.start)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    this.render();
  },

  /* ─── Ansichten: Tag / Woche / Monat ─── */
  setView(mode) {
    this.viewMode = mode;
    document.querySelectorAll('#cal-views .chip').forEach(c =>
      c.classList.toggle('active', c.dataset.calview === mode));
    this.render();
  },

  eventsForView() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (this.viewMode === 'day') {
      return this.events.filter(e => {
        const d = new Date(e.start);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        // ganztägige/mehr tägige Termine, die heute laufen, mit einbeziehen
        const end = e.end ? new Date(e.end) : d;
        return day.getTime() === today.getTime() ||
               (e.allDay && d <= today && end > today);
      });
    }
    if (this.viewMode === 'week') {
      const end = new Date(today.getTime() + 7 * 864e5);
      return this.events.filter(e => new Date(e.start) < end);
    }
    const end = new Date(today.getTime() + 31 * 864e5);
    return this.events.filter(e => new Date(e.start) < end);
  },

  groupByDay(events, limitDays = 40) {
    const groups = {};
    events.forEach(ev => {
      const key = new Date(ev.start).toDateString();
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
    const evts = this.eventsForView();
    if (!evts.length) {
      const msg = { day: 'Heute steht nichts an — freier Tag! 🎉',
                    week: 'Diese Woche keine Termine.',
                    month: 'Diesen Monat keine Termine.' }[this.viewMode];
      el.innerHTML = `<p class="muted">${msg}</p>`;
      return;
    }
    if (this.viewMode === 'day') {
      el.innerHTML = evts.map(e => this.eventHtml(e)).join('');
      return;
    }
    el.innerHTML = this.groupByDay(evts).map(([day, evs]) =>
      `<div class="event-day-label">${this.dayLabel(day)}</div>` + evs.map(e => this.eventHtml(e)).join('')
    ).join('');
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
  },

  async onConnected() {
    this.renderConnectState();
    await this.loadEvents();
  },

  // Stille Neu-Anmeldung: funktioniert, wenn früher schon zugestimmt wurde
  trySilentRefresh() {
    const attempt = () => {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        setTimeout(attempt, 500);
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
  },

  init() {
    document.getElementById('cal-connect').addEventListener('click', () => this.connect());
    document.getElementById('cal-disconnect').addEventListener('click', () => this.disconnect());
    document.querySelectorAll('#cal-views .chip').forEach(c =>
      c.addEventListener('click', () => this.setView(c.dataset.calview)));
    const saved = State.get('googleToken');
    if (saved && saved.exp > Date.now()) {
      this.token = saved.token;
      this.renderConnectState();
      this.loadEvents();
    } else if (this.hasClientId()) {
      this.trySilentRefresh();
    }
  }
};
