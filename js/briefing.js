/* ═══════════ KI-Briefing als Chat (Google Gemini, kostenlos) ═══════════
   - Startet automatisch beim Laden der Seite
   - Rückfragen möglich: kompletter Verlauf wird mitgeschickt
   - Modell wird automatisch gewählt (neuestes verfügbares Flash)      */
const Briefing = {
  STATIC_MODELS: [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
  ],
  history: [],   // [{role:'user'|'model', text}]
  busy: false,

  hasKey() { return !!State.get('gemini'); },

  async resolveModels() {
    // Cache: Modell-Liste 24h behalten → spart einen API-Call pro Briefing
    const cachedList = State.get('geminiModels');
    const cachedTs = State.get('geminiModelsTs') || 0;
    if (cachedList && Date.now() - cachedTs < 24 * 3600 * 1000) {
      const cached = State.get('geminiModel');
      const list = [...cachedList];
      if (cached && list.includes(cached)) {
        list.splice(list.indexOf(cached), 1);
        list.unshift(cached);
      }
      return list;
    }
    const key = State.get('gemini');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`);
      if (!res.ok) throw new Error('Liste nicht abrufbar');
      const data = await res.json();
      const usable = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(n => /^gemini-/.test(n) && /flash/.test(n) && !/image|tts|robotics|computer-use/.test(n));
      if (!usable.length) throw new Error('keine Flash-Modelle');
      const score = n => {
        const v = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
        let s = v * 1000;
        if (/lite/.test(n)) s -= 100;
        if (/preview|exp/.test(n)) s -= 10;
        return s;
      };
      usable.sort((a, b) => score(b) - score(a));
      State.set('geminiModels', usable);
      State.set('geminiModelsTs', Date.now());
      const cached = State.get('geminiModel');
      if (cached && usable.includes(cached)) {
        usable.splice(usable.indexOf(cached), 1);
        usable.unshift(cached);
      }
      return usable;
    } catch (e) {
      const cached = State.get('geminiModel');
      const list = [...this.STATIC_MODELS];
      if (cached) list.unshift(cached);
      return [...new Set(list)];
    }
  },

  buildPrompt() {
    const news = News.articles.slice(0, 20)
      .map(a => `- [${a.src}/${News.catLabel(a.cat)}] ${a.title}`)
      .join('\n');
    const events = Cal.events.slice(0, 20)
      .map(e => {
        const d = new Date(e.start);
        const when = e.allDay
          ? d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }) + ' (ganztägig)'
          : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }) + ' ' +
            d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        return `- ${when}: ${e.title}`;
      }).join('\n');

    return `Du bist mein persönlicher Morgen-Assistent. Erstelle ein kurzes, prägnantes Morgen-Briefing auf Deutsch (max. 180 Wörter), in diesem Aufbau:

1. **Start in den Tag** — ein kurzer Satz mit Datum und was heute ansteht.
2. **Deine Termine** — die wichtigsten kommenden Termine als Stichpunkte (oder "freier Tag" falls keine).
3. **Das Wichtigste aus den Nachrichten** — die 4–6 relevantesten Themen, jeweils ein Satz. Priorisiere: große Politik, Wirtschaft, Tech, KI. Keine Belanglosigkeiten.
4. **Ein Satz zum Mitnehmen** — Motivation oder Einordnung des Tages.

Danach beantwortest du meine Rückfragen zu diesen Inhalten — kurz und auf Deutsch.

Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

TERMINE (nächste Tage):
${events || '(keine — Kalender nicht verbunden)'}

NEWS (heute):
${news || '(keine News geladen)'}

Antworte im Fließtext mit klaren Absätzen, nutze **fett** für Überschriften der 4 Abschnitte.`;
  },

  async callApi(model) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${State.get('gemini')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: this.history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error?.message || 'API-Fehler ' + res.status);
      err.status = res.status;
      throw err;
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  async send() {
    if (this.busy) return;
    this.busy = true;
    const thinking = this.addMsg('model', '<div class="ai-loading"><div class="spinner"></div></div>', true);
    const models = await this.resolveModels();
    let lastErr = null;
    let ok = false;
    for (const model of models) {
      try {
        const text = await this.callApi(model);
        State.set('geminiModel', model);
        this.history.push({ role: 'model', text });
        thinking.remove();
        this.addMsg('model', this.mdToHtml(text), true);
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
        if (e.status === 400 || e.status === 404) {
          State.set('geminiModel', '');
          State.set('geminiModels', null); // Liste beim nächsten Mal neu auflösen
        }
        if (e.status !== 429 && e.status !== 400 && e.status !== 404) break;
      }
    }
    if (!ok) {
      thinking.remove();
      this.history.pop(); // fehlgeschlagene User-Nachricht zurücknehmen
      this.addMsg('model', `<p class="muted">Fehler: ${News.esc(lastErr?.message || 'unbekannt')}</p>`, true);
    }
    this.busy = false;
  },

  addMsg(role, html, raw = false) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'model');
    div.innerHTML = raw ? html : News.esc(html);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  },

  // Start: Briefing automatisch generieren
  auto() {
    if (this._ran) return;
    this._ran = true;
    const box = document.getElementById('chat-messages');
    if (!this.hasKey()) {
      box.innerHTML = '<div class="chat-msg model"><p class="muted">Für dein KI-Briefing: kostenlosen Key auf <b>aistudio.google.com/apikey</b> holen und in den Einstellungen (⚙) eintragen.</p></div>';
      return;
    }
    this.history.push({ role: 'user', text: this.buildPrompt() });
    this.send();
  },

  submitFollowup() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || this.busy) return;
    if (!this.hasKey()) { input.value = ''; return; }
    input.value = '';
    this.addMsg('user', text);
    this.history.push({ role: 'user', text });
    this.send();
  },

  mdToHtml(text) {
    return News.esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '• $1')
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  },

  init() {
    const input = document.getElementById('chat-input');
    document.getElementById('chat-send').addEventListener('click', () => this.submitFollowup());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.submitFollowup();
    });
  }
};
