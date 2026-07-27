/* ═══════════ KI-Briefing (Google Gemini, kostenlos) ═══════════
   Modell-Auswahl: fragt die verfügbaren Modelle bei Google ab und
   nimmt automatisch das neueste sinnvolle Flash-Modell.          */
const Briefing = {
  // Harte Fallback-Kette, falls die Modell-Liste nicht abrufbar ist
  STATIC_MODELS: [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
  ],

  hasKey() { return !!State.get('gemini'); },

  // Verfügbare Modelle abfragen und beste Kandidaten sortiert zurückgeben
  async resolveModels() {
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
      // Sortierung: höchste Versionsnummer zuerst; stabil vor Preview; voll vor lite
      const score = n => {
        const v = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
        let s = v * 1000;
        if (/lite/.test(n)) s -= 100;
        if (/preview|exp/.test(n)) s -= 10;
        return s;
      };
      usable.sort((a, b) => score(b) - score(a));
      // gecachtes Erfolgsmodell nach vorne ziehen
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
3. **Das Wichtigste aus den Nachrichten** — die 4–6 relevantesten Themen, jeweils ein Satz. Priorisiere: große Politik, Wirtschaft, Tech. Keine Belanglosigkeiten.
4. **Ein Satz zum Mitnehmen** — Motivation oder Einordnung des Tages.

Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

TERMINE (nächste Tage):
${events || '(keine — Kalender nicht verbunden)'}

NEWS (heute):
${news || '(keine News geladen)'}

Antworte im Fließtext mit klaren Absätzen, nutze **fett** für Überschriften der 4 Abschnitte, keine weiteren Markdown-Listen außer den Termin-Stichpunkten.`;
  },

  async callApi(model) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${State.get('gemini')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: this.buildPrompt() }] }],
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

  async generate() {
    const out = document.getElementById('ai-output');
    if (!this.hasKey()) {
      out.innerHTML = '<p class="muted">Für dein automatisches KI-Briefing: kostenlosen Key auf <b>aistudio.google.com/apikey</b> holen und in den Einstellungen (⚙) eintragen.</p>';
      return;
    }
    out.innerHTML = '<div class="ai-loading"><div class="spinner"></div> Dein Briefing wird erstellt …</div>';
    const models = await this.resolveModels();
    let lastErr = null;
    for (const model of models) {
      try {
        const text = await this.callApi(model);
        State.set('geminiModel', model); // Erfolgsmodell merken
        out.innerHTML = this.mdToHtml(text);
        return;
      } catch (e) {
        lastErr = e;
        // 400/404 = Modell nicht verfügbar → Cache leeren, nächstes probieren
        if (e.status === 400 || e.status === 404) State.set('geminiModel', '');
        if (e.status !== 429 && e.status !== 400 && e.status !== 404) break; // echte Fehler sofort zeigen
      }
    }
    out.innerHTML = `<p class="muted">Fehler beim Briefing: ${News.esc(lastErr?.message || 'unbekannt')}<br>Prüfe deinen API-Key in den Einstellungen oder dein kostenloses Tageskontingent (setzt sich nachts zurück).</p>`;
  },

  mdToHtml(text) {
    return News.esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '• $1')
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  },

  // Automatisch beim Laden der Seite generieren (einmal pro Besuch)
  auto() {
    if (this._ran) return;
    this._ran = true;
    this.generate();
  },

  init() { /* Briefing startet automatisch nach dem News-Laden */ }
};
