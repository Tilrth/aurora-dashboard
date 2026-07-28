/* ═══════════ News: Heise + Telepolis via RSS ═══════════ */
const News = {
  feeds: [
    // Heise online News als Basis: IT + Wirtschaft + KI (per Keywords erkannt)
    { url: 'https://www.heise.de/rss/heise-atom.xml',             src: 'Heise',       cat: 'tech' },
    // Telepolis für Politik
    { url: 'https://www.heise.de/tp/rss/news-atom.xml',           src: 'Telepolis',   cat: 'politik' },
    // Tagesschau: kuratierte Top-Meldungen (Politik) + Wirtschafts-Ressort
    { url: 'https://www.tagesschau.de/xml/rss2/',                 src: 'Tagesschau',  cat: 'politik', top: true },
    { url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml', src: 'Tagesschau',  cat: 'wirtschaft' },
    // Handelsblatt Schlagzeilen (Wirtschaft)
    { url: 'https://www.handelsblatt.com/contentexport/feed/schlagzeilen', src: 'Handelsblatt', cat: 'wirtschaft' },
  ],
  // CORS-Proxies (Fallback-Kette) — xml = XML-Rohdaten, json = rss2json-API
  proxies: [
    { type: 'xml',  wrap: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) },
    { type: 'xml',  wrap: u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u) },
    { type: 'json', wrap: u => 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(u) },
  ],

  ignoreWords: ['wetter', 'lotto', 'horoskop', 'rezept', 'quiz', 'spieltag', 'tv-tipp', 'promi'],

  // Aus Telepolis: reine Wissenschaft/Weltraum-Themen rausfiltern
  skipTpWords: ['weltraum', 'raumfahrt', 'astronom', 'mars-mission', 'exoplanet'],

  // Tagesschau-Top-Feed: Sport/Kultur etc. rausfiltern
  skipTopWords: [
    'fussball', 'fußball', 'sport', 'olympia', 'bundesliga', 'champions league',
    'formel', 'tennis', 'handball', 'biathlon', 'ski', 'tour de france',
    'film', 'serie', 'musik', 'konzert', 'theater', 'literatur', 'festival',
    'wetter', 'rezept', 'promi', 'lotto', 'horoskop', 'tatort', 'charts',
  ],

  // KI-Artikel erkennen (höchste Priorität bei der Einordnung)
  kiKeywords: [
    'künstliche intelligenz', ' ki ', 'ki-', ' ki:', 'chatgpt', 'openai',
    'anthropic', 'claude', 'gemini', 'deepmind', 'sprachmodell', 'llm',
    'mistral', 'copilot', ' ai ', ' ai-', ' ai:', 'generative', 'midjourney',
    'maschinelles lernen', 'machine learning', 'ai-act', 'ai act',
  ],

  // Heise-Artikel mit Wirtschaftsbezug → Kategorie Wirtschaft
  wirtschaftKeywords: [
    'börse', 'aktie', 'quartal', 'umsatz', 'gewinn', 'milliard', 'inflation',
    'zins', 'ezb', 'fed', 'wirtschaft', 'übernahme', 'ipo', 'bilanz', 'dax',
    'nasdaq', 'wall street', 'kursverlust', 'kursgewinn', 'stellenabbau', 'entlassung',
  ],

  // Pro Kategorie nur die wichtigsten (neuesten) Meldungen
  // Alle Artikel der Feeds anzeigen
  caps: { politik: 25, wirtschaft: 25, tech: 30, ki: 20, all: 120 },

  articles: [],
  activeCat: 'all',

  // Gibt die Kategorie zurück — oder null, wenn der Artikel weg soll
  categorize(feed, title, teaser) {
    const hay = (' ' + title + ' ' + teaser + ' ').toLowerCase();
    // KI hat Vorrang
    if (this.kiKeywords.some(w => hay.includes(w))) return 'ki';
    if (feed.top) {
      // Tagesschau-Top: Sport/Kultur raus, Wirtschaft umkategorisieren, Rest = Politik
      if (this.skipTopWords.some(w => hay.includes(w))) return null;
      if (this.wirtschaftKeywords.some(w => hay.includes(w))) return 'wirtschaft';
      return 'politik';
    }
    if (feed.cat === 'politik' && this.skipTpWords.some(w => hay.includes(w))) return null;
    // Heise: Wirtschaftsartikel erkennen und umkategorisieren
    if (feed.src === 'Heise' && this.wirtschaftKeywords.some(w => hay.includes(w))) return 'wirtschaft';
    return feed.cat;
  },

  async fetchFeed(feed) {
    for (const p of this.proxies) {
      try {
        const res = await fetch(p.wrap(feed.url), { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        if (p.type === 'json') {
          const data = await res.json();
          if (data.status !== 'ok' || !Array.isArray(data.items)) continue;
          return data.items.map(it => ({
            title: this.clean(it.title),
            link: it.link || '',
            teaser: this.clean((it.description || '').replace(/<[^>]*>/g, '')).slice(0, 220),
            date: new Date(it.pubDate || Date.now()),
            src: feed.src,
            cat: this.categorize(feed, it.title || '', it.description || ''),
          }));
        }
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror')) continue;
        const items = this.parse(doc, feed);
        if (items.length) return items;
      } catch (e) { /* nächster Proxy */ }
    }
    return [];
  },

  parse(doc, feed) {
    const items = [];
    const add = (title, link, teaser, date) => {
      items.push({ title: this.clean(title), link, teaser: this.clean(teaser),
                   date, src: feed.src,
                   cat: this.categorize(feed, title, teaser) });
    };
    // RSS
    doc.querySelectorAll('item').forEach(it => {
      add(
        it.querySelector('title')?.textContent?.trim() || '',
        it.querySelector('link')?.textContent?.trim() || '',
        (it.querySelector('description')?.textContent || '').replace(/<[^>]*>/g, '').trim().slice(0, 220),
        new Date(it.querySelector('pubDate')?.textContent || Date.now())
      );
    });
    // Atom (Heise)
    doc.querySelectorAll('entry').forEach(en => {
      add(
        en.querySelector('title')?.textContent?.trim() || '',
        en.querySelector('link')?.getAttribute('href') || '',
        (en.querySelector('summary')?.textContent || '').replace(/<[^>]*>/g, '').trim().slice(0, 220),
        new Date(en.querySelector('updated, published')?.textContent || Date.now())
      );
    });
    return items;
  },

  async load(force = false) {
    if (this.articles.length && !force) { this.render(); return; }
    const el = document.getElementById('news-list');
    el.innerHTML = '<p class="muted">News werden geladen …</p>';
    const lists = await Promise.all(this.feeds.map(f => this.fetchFeed(f)));
    this.articles = lists.flat()
      .filter(a => a.title && a.link && a.cat)
      .filter(a => !this.ignoreWords.some(w => a.title.toLowerCase().includes(w)))
      .sort((a, b) => b.date - a.date);
    const seen = new Set();
    this.articles = this.articles.filter(a => !seen.has(a.link) && seen.add(a.link));
    this.render();
    if (window.Briefing) Briefing.auto(); // Auto-Briefing, sobald News da sind
  },

  catLabel(cat) {
    return { politik: 'Politik', wirtschaft: 'Wirtschaft', tech: 'Tech / IT', ki: 'KI' }[cat] || cat;
  },

  // Handelsblatt markiert Paywall-Artikel mit „+++“ — raus damit
  clean(s) { return (s || '').replace(/\+\+\+/g, '').trim(); },

  fmtDate(d) {
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  },

  esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

  articleHtml(a) {
    return `
      <a class="news-item" href="${a.link}" target="_blank" rel="noopener">
        <div class="meta">
          <span class="src-tag ${{ Heise: 'heise', Telepolis: 'tp', Handelsblatt: 'hb' }[a.src] || ''}">${a.src}</span>
          <span class="cat-tag">${this.catLabel(a.cat)}</span>
          <span>${this.fmtDate(new Date(a.date))}</span>
        </div>
        <h3>${this.esc(a.title)}</h3>
        ${a.teaser ? `<p class="teaser">${this.esc(a.teaser)}</p>` : ''}
      </a>`;
  },

  setCat(cat) {
    this.activeCat = cat;
    document.querySelectorAll('#news-filters .chip[data-cat]').forEach(c =>
      c.classList.toggle('active', c.dataset.cat === cat));
    this.render();
  },

  render() {
    const el = document.getElementById('news-list');
    const list = this.activeCat === 'all'
      ? this.articles.slice(0, this.caps.all)
      : this.articles.filter(a => a.cat === this.activeCat).slice(0, this.caps[this.activeCat]);
    if (!list.length) {
      el.innerHTML = '<p class="muted">Keine Artikel gefunden. Prüfe deine Internetverbindung oder lade neu (↻ oben rechts).</p>';
      return;
    }
    el.innerHTML = list.map(a => this.articleHtml(a)).join('');
  },

  init() {
    document.querySelectorAll('#news-filters .chip[data-cat]').forEach(c =>
      c.addEventListener('click', () => this.setCat(c.dataset.cat)));
    this.load();
  }
};
