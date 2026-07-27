/* ═══════════ KI-Briefing (Google Gemini, kostenlos) ═══════════ */
const Briefing = {
  MODEL: 'gemini-2.5-flash',
  FALLBACK_MODEL: 'gemini-2.5-flash-lite', // großzügigeres Free-Tier-Limit

  hasKey() { return !!State.get('gemini'); },

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
      out.innerHTML = '<p class="muted">Kein Gemini-API-Key hinterlegt. Hole dir kostenlos einen auf <b>aistudio.google.com/apikey</b> und trage ihn in den Einstellungen (⚙) ein.</p>';
      document.getElementById('settings-overlay').classList.remove('hidden');
      return;
    }
    out.innerHTML = '<div class="ai-loading"><div class="spinner"></div> Dein Briefing wird erstellt …</div>';
    try {
      let text;
      try {
        text = await this.callApi(this.MODEL);
      } catch (e) {
        // Quota erreicht (429) → automatisch auf Flash-Lite ausweichen
        if (e.status === 429) text = await this.callApi(this.FALLBACK_MODEL);
        else throw e;
      }
      out.innerHTML = this.mdToHtml(text);
    } catch (e) {
      out.innerHTML = `<p class="muted">Fehler beim Briefing: ${News.esc(e.message)}<br>Prüfe deinen API-Key in den Einstellungen oder dein kostenloses Tageskontingent (setzt sich nachts zurück).</p>`;
    }
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
    document.getElementById('gen-briefing').addEventListener('click', () => this.generate());
    document.getElementById('ai-nokey-hint').classList.toggle('hidden', this.hasKey());
  }
};
