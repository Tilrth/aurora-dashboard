#!/usr/bin/env python3
"""Holt Kurse (Yahoo/Stooq), ForexFactory-Kalender und Markt-News
   serverseitig ab und schreibt sie als JSON ins Repo (data/).
   Fail-safe: Einzelfehler killen den Job nie — alte Daten bleiben stehen."""
import csv, io, json, os, re, time, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}
OUT = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(OUT, exist_ok=True)

SYMBOLS = [  # (anzeigename, yahoo, stooq)
    ('World Momentum',  'XDEM.DE', 'xdem.de'),
    ('China',           'H4Z6.DE', 'h4z6.de'),
    ('Europe Momentum', 'CEMR.DE', 'cemr.de'),
    ('Taiwan',          'FLXT.DE', 'flxt.de'),
    ('Korea',           'FLXK.DE', 'flxk.de'),
]

def fetch(url, timeout=20, retries=2):
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            if i == retries:
                raise
            time.sleep(3)

def write(name, payload):
    payload['updated'] = datetime.now(timezone.utc).isoformat()
    path = os.path.join(OUT, name)
    json.dump(payload, open(path, 'w'), ensure_ascii=False, indent=1)

# ─── 1) Kurse ───
def quotes_yahoo():
    out = {}
    for name, ysym, _ in SYMBOLS:
        url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{ysym}'
               '?interval=1d&range=5d')
        d = json.loads(fetch(url))
        meta = d['chart']['result'][0]['meta']
        price = meta.get('regularMarketPrice')
        prev = meta.get('chartPreviousClose') or meta.get('previousClose')
        if price and prev:
            out[ysym] = {
                'name': name, 'symbol': ysym.replace('.DE', ''),
                'price': round(price, 2), 'currency': meta.get('currency', 'EUR'),
                'change_pct': round((price - prev) / prev * 100, 2),
            }
    if len(out) < len(SYMBOLS):
        raise RuntimeError('Yahoo unvollständig')
    return out

def quotes_stooq():
    syms = ','.join(s for _, _, s in SYMBOLS)
    url = f'https://stooq.com/q/l/?s={syms}&f=sd2t2ohlcv&e=csv'
    rows = csv.DictReader(io.StringIO(fetch(url)))
    out = {}
    name_by_stooq = {s: (n, y) for n, y, s in SYMBOLS}
    for r in rows:
        n, y = name_by_stooq.get(r['Symbol'].lower(), (None, None))
        if not n or r['Open'] in ('N/D', '') or r['Close'] in ('N/D', ''):
            continue
        o, c = float(r['Open']), float(r['Close'])
        out[y] = {'name': n, 'symbol': y.replace('.DE', ''), 'price': round(c, 2),
                  'currency': 'EUR', 'change_pct': round((c - o) / o * 100, 2)}
    if not out:
        raise RuntimeError('Stooq leer')
    return out

try:
    quotes = quotes_yahoo()
    src = 'yahoo'
except Exception as e:
    print('Yahoo fehlgeschlagen:', e)
    try:
        quotes = quotes_stooq()
        src = 'stooq'
    except Exception as e2:
        print('Stooq fehlgeschlagen:', e2)
        quotes, src = None, None
if quotes:
    write('quotes.json', {'source': src, 'quotes': list(quotes.values())})
    print('Kurse OK via', src)
else:
    print('WARNUNG: Keine Kurse — alte Daten bleiben.')

# ─── 2) ForexFactory Wirtschaftskalender (High + Holiday, EUR & USD) ───
try:
    NY = ZoneInfo('America/New_York')
    xml = fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.xml')
    root = ET.fromstring(xml)
    events = []
    for ev in root.iter('event'):
        get = lambda t: (ev.findtext(t) or '').strip()
        if get('impact') not in ('High', 'Holiday'):
            continue
        if get('country') not in ('EUR', 'USD'):
            continue
        dt_iso = None
        m = re.match(r'(\d{2})-(\d{2})-(\d{4})', get('date'))
        t = re.match(r'(\d{1,2}):(\d{2})(am|pm)', get('time'), re.I)
        if m and t:
            hh = int(t.group(1)) % 12 + (12 if t.group(3).lower() == 'pm' else 0)
            dt = datetime(int(m.group(3)), int(m.group(1)), int(m.group(2)),
                          hh, int(t.group(2)), tzinfo=NY)
            dt_iso = dt.astimezone(timezone.utc).isoformat()
        events.append({'title': get('title'), 'currency': get('country'),
                       'impact': get('impact'), 'date': get('date'),
                       'forecast': get('forecast'), 'previous': get('previous'),
                       'utc': dt_iso})
    write('ff.json', {'events': events})
    print('Kalender OK:', len(events), 'Events')
except Exception as e:
    print('WARNUNG: Kalender fehlgeschlagen — alte Daten bleiben.', e)

# ─── 3) Markt-News: Earnings, IPOs (Google News RSS) ───
try:
    q = urllib.parse.quote('earnings OR IPO OR "quarterly results" when:2d')
    url = f'https://news.google.com/rss/search?q={q}&hl=de&gl=DE&ceid=DE:de'
    root = ET.fromstring(fetch(url))
    items = []
    for it in root.iter('item'):
        title = re.sub(r'\s*-\s*[^-]+$', '', it.findtext('title') or '').strip()
        items.append({'title': title,
                      'link': it.findtext('link') or '',
                      'source': (it.findtext('source') or '').strip(),
                      'date': it.findtext('pubDate') or ''})
        if len(items) >= 14:
            break
    write('marketnews.json', {'items': items})
    print('Markt-News OK:', len(items))
except Exception as e:
    print('WARNUNG: Markt-News fehlgeschlagen — alte Daten bleiben.', e)

print('Fertig. Job erfolgreich (Einzelfehler werden ignoriert).')
