/* ═══════════ News: Tagesschau + Heise via RSS ═══════════ */
const News = {
  feeds: [
    { url: 'https://www.tagesschau.de/inland/index~rss2.xml',   src: 'Tagesschau', cat: 'politik' },
    { url: 'https://www.tagesschau.de/ausland/index~rss2.xml',  src: 'Tagesschau', cat: 'politik' },
    { url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml', src: 'Tagesschau', cat: 'wirtschaft' },
    { url: 'https://www.heise.de/rss/heise-atom.xml',           src: 'Heise',      cat: 'tech' },
  ],
  // CORS-Proxies (Fallback-Kette)
  proxies: [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  ],

  // Nur „die größten Themen“: Keyword-Filter für kleinere Meldungen
  ignoreWords: ['wetter', 'lotto', 'horoskop', 'rezept', 'quiz', 'spieltag', 'tv-tipp', 'promi'],
  articles: [],
  activeCat: 'all',

  async fetchFeed(feed) {
    for (const wrap of this.proxies) {
      try {
        const res = await fetch(wrap(feed.url), { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror')) continue;
        return this.parse(doc, feed);
      } catch (e) { /* nächster Proxy */ }
    }
    return [];
  },

  parse(doc, feed) {
    const items = [];
    // RSS
    doc.querySelectorAll('item').forEach(it => {
      items.push({
        title: it.querySelector('title')?.textContent?.trim() || '',
        link: it.querySelector('link')?.textContent?.trim() || '',
        teaser: (it.querySelector('description')?.textContent || '').replace(/<[^>]*>/g, '').trim().slice(0, 220),
        date: new Date(it.querySelector('pubDate')?.textContent || Date.now()),
        src: feed.src, cat: feed.cat,
      });
    });
    // Atom (Heise)
    doc.querySelectorAll('entry').forEach(en => {
      items.push({
        title: en.querySelector('title')?.textContent?.trim() || '',
        link: en.querySelector('link')?.getAttribute('href') || '',
        teaser: (en.querySelector('summary')?.textContent || '').replace(/<[^>]*>/g, '').trim().slice(0, 220),
        date: new Date(en.querySelector('updated, published')?.textContent || Date.now()),
        src: feed.src, cat: feed.cat,
      });
    });
    return items;
  },

  async load(force = false) {
    if (this.articles.length && !force) { this.render(); return; }
    const lists = await Promise.all(this.feeds.map(f => this.fetchFeed(f)));
    this.articles = lists.flat()
      .filter(a => a.title && a.link)
      .filter(a => !this.ignoreWords.some(w => a.title.toLowerCase().includes(w)))
      .sort((a, b) => b.date - a.date);
    // Duplikate entfernen
    const seen = new Set();
    this.articles = this.articles.filter(a => !seen.has(a.link) && seen.add(a.link));
    this.render();
    this.renderBriefNews();
  },

  catLabel(cat) {
    return { politik: 'Politik', wirtschaft: 'Wirtschaft', tech: 'Tech / IT' }[cat] || cat;
  },

  fmtDate(d) {
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  },

  esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

  articleHtml(a, inLater = false) {
    return `
      <div class="news-item">
        <div class="meta">
          <span class="src-tag ${a.src === 'Heise' ? 'heise' : ''}">${a.src}</span>
          <span class="cat-tag">${this.catLabel(a.cat)}</span>
          <span>${this.fmtDate(new Date(a.date))}</span>
        </div>
        <h3><a href="${a.link}" target="_blank" rel="noopener">${this.esc(a.title)}</a></h3>
        ${a.teaser ? `<p class="teaser">${this.esc(a.teaser)}</p>` : ''}
        <div class="news-actions">
          ${inLater
            ? `<button class="btn" onclick="News.unsave('${encodeURIComponent(a.link)}')">✕ Entfernen</button>`
            : `<button class="btn" onclick="News.save('${encodeURIComponent(a.link)}')">＋ Später lesen</button>`}
        </div>
      </div>`;
  },

  save(link) {
    const a = this.articles.find(x => encodeURIComponent(x.link) === link);
    if (a && State.addLater(a)) {
      State.updateLaterBadge();
      this.renderLater();
      const btn = event.target;
      btn.textContent = '✓ Gespeichert';
      setTimeout(() => this.render(), 900);
    }
  },

  unsave(link) {
    State.removeLater(decodeURIComponent(link));
    State.updateLaterBadge();
    this.renderLater();
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
      ? this.articles
      : this.articles.filter(a => a.cat === this.activeCat);
    if (!list.length) {
      el.innerHTML = '<p class="muted">Keine Artikel gefunden. Prüfe deine Internetverbindung oder lade neu (↻).</p>';
      return;
    }
    const later = new Set(State.getLater().map(x => x.link));
    el.innerHTML = list.slice(0, 60).map(a =>
      later.has(a.link)
        ? this.articleHtml(a).replace('＋ Später lesen', '✓ Gespeichert').replace(`News.save`, `void`)
        : this.articleHtml(a)
    ).join('');
  },

  renderLater() {
    const el = document.getElementById('later-list');
    const list = State.getLater();
    el.innerHTML = list.length
      ? list.map(a => this.articleHtml(a, true)).join('')
      : '<p class="muted">Noch nichts gespeichert. Tippe bei einem Artikel auf „Später lesen“.</p>';
  },

  renderBriefNews() {
    const el = document.getElementById('brief-news');
    const top = this.articles.slice(0, 12);
    el.innerHTML = top.length
      ? '<div class="news-compact">' + top.map(a => `
          <div class="nc-item">
            <a href="${a.link}" target="_blank" rel="noopener">${this.esc(a.title)}</a>
            <span class="nc-src">${a.src} · ${this.fmtDate(new Date(a.date))}</span>
          </div>`).join('') + '</div>'
      : '<p class="muted">Keine News verfügbar.</p>';
  },

  init() {
    document.querySelectorAll('#news-filters .chip[data-cat]').forEach(c =>
      c.addEventListener('click', () => this.setCat(c.dataset.cat)));
    document.getElementById('news-refresh').addEventListener('click', () => this.load(true));
    this.renderLater();
    this.load();
  }
};
