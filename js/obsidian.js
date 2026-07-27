/* ═══════════ Obsidian: Notizen aus GitHub-Vault lesen ═══════════
   Voraussetzung: Vault (oder ein Ordner) liegt in einem öffentlichen
   GitHub-Repo — z. B. via "Obsidian Git" Plugin synchronisiert.      */
const Obsidian = {
  configured() { return !!State.get('obsidian'); },

  parsePath() {
    // Format: user/repo/optionaler/ordner
    const parts = State.get('obsidian').replace(/^\/+|\/+$/g, '').split('/');
    return { user: parts[0], repo: parts[1], folder: parts.slice(2).join('/') };
  },

  headers() {
    const t = State.get('ghtoken');
    return t ? { Authorization: 'Bearer ' + t } : {};
  },

  async load() {
    if (!this.configured()) return;
    const { user, repo, folder } = this.parsePath();
    try {
      const url = `https://api.github.com/repos/${user}/${repo}/contents/${folder}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error('Repo nicht gefunden (' + res.status + ')' + (!State.get('ghtoken') ? ' — privates Repo? Token in den Einstellungen eintragen.' : ''));
      const files = (await res.json())
        .filter(f => f.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 8);
      const notes = await Promise.all(files.map(async f => {
        const raw = await fetch(f.url, { headers: this.headers() })
          .then(r => r.json())
          .then(d => decodeURIComponent(escape(atob(d.content.replace(/\n/g, '')))));
        return { name: f.name.replace(/\.md$/, ''), content: raw.slice(0, 800) };
      }));
      this.render(notes);
    } catch (e) {
      console.warn('Obsidian:', e.message);
    }
  },

  render(notes) {
    // Notizen werden im Briefing-View unter den Terminen angezeigt
    let card = document.getElementById('obsidian-card');
    if (!card) {
      card = document.createElement('div');
      card.className = 'card';
      card.id = 'obsidian-card';
      const grid = document.querySelector('#view-briefing .grid-2');
      grid.parentNode.insertBefore(card, grid.nextSibling);
    }
    card.innerHTML = `
      <div class="card-head"><h2>Obsidian-Notizen</h2></div>
      ${notes.length
        ? notes.map(n => `
          <div class="obs-note">
            <div class="obs-name">${News.esc(n.name)}</div>
            <pre>${News.esc(n.content)}</pre>
          </div>`).join('')
        : '<p class="muted">Keine Markdown-Notizen im angegebenen Ordner gefunden.</p>'}`;
  },

  init() { if (this.configured()) this.load(); }
};
