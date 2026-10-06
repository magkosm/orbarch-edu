#!/usr/bin/env python3
"""Build the static educator hub at public/educators/ from scripts/educators/content.json.

- Syncs docs/workshop/** (plans, print materials, PDFs, QR images) into public/educators/materials/.
- Writes index.html, feedback.html, view.html (Markdown reader), guides/<id>.html, educators.css, educators.js.
- Screenshots are expected in public/educators/screenshots/<lang>/<name>.png
  (see scripts/educators/README.md for how to regenerate them).

All three languages are embedded in every page; a small script shows the chosen one
(?lng=xx, then the saved choice, then the browser language, then English).

Run from the repo root:  python3 scripts/build_educators.py
No dependencies beyond the Python 3 standard library.
"""
import html
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "scripts" / "educators" / "content.json"
OUT = ROOT / "public" / "educators"
DOCS = ROOT / "docs" / "workshop"
LANGS = ["en", "sv", "el"]
LANG_NAMES = {"en": "English", "sv": "Svenska", "el": "Ελληνικά"}

data = json.loads(CONTENT.read_text(encoding="utf-8"))
site = data["site"]
UI = site["ui"]


def esc(s):
    return html.escape(str(s), quote=True)


def tr(obj, lang):
    """Return the translation for lang, falling back to English."""
    if isinstance(obj, dict):
        v = obj.get(lang)
        if v in (None, "", []):
            v = obj.get("en", "")
        return v
    return obj


def multi(obj, tag="span", cls="", attrs=""):
    """Render a translatable value as three sibling elements, one per language."""
    out = []
    for lang in LANGS:
        c = (cls + " ").strip()
        out.append(f'<{tag} data-l="{lang}" class="{c}l-{lang}"{attrs}>{esc(tr(obj, lang))}</{tag}>')
    return "".join(out)


def multi_html(render_fn, tag="div", cls=""):
    """Like multi() but render_fn(lang) returns already-escaped HTML."""
    out = []
    for lang in LANGS:
        c = (cls + " ").strip()
        out.append(f'<{tag} data-l="{lang}" class="{c}l-{lang}">{render_fn(lang)}</{tag}>')
    return "".join(out)


# --------------------------------------------------------------------------- sync materials
def sync_materials():
    dest = OUT / "materials"
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    skip = {".DS_Store", "gen-qr.js"}
    for src in DOCS.rglob("*"):
        if src.is_dir() or src.name in skip:
            continue
        rel = src.relative_to(DOCS)
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
    shutil.copy2(ROOT / "CHANGELOG.md", dest / "CHANGELOG.md")
    n = sum(1 for _ in dest.rglob("*") if _.is_file())
    print(f"synced {n} files into {dest.relative_to(ROOT)}")


# --------------------------------------------------------------------------- page chrome
CSS = """
:root{--bg:#0b1220;--panel:#151f33;--panel2:#1c2941;--line:rgba(255,255,255,.1);--text:#e6edf3;--muted:#9fb0c6;--accent:#8ec5ff;--accent2:#6ee7b7;--warn:#fbbf24}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
[data-l]{display:none}html[data-lang="en"] [data-l="en"],html[data-lang="sv"] [data-l="sv"],html[data-lang="el"] [data-l="el"]{display:revert}
li[data-l],p[data-l],div[data-l],h1[data-l],h2[data-l],h3[data-l],section[data-l]{display:none}
html[data-lang="en"] li[data-l="en"],html[data-lang="sv"] li[data-l="sv"],html[data-lang="el"] li[data-l="el"]{display:list-item}
html[data-lang="en"] :is(p,div,h1,h2,h3,section,figure)[data-l="en"],html[data-lang="sv"] :is(p,div,h1,h2,h3,section,figure)[data-l="sv"],html[data-lang="el"] :is(p,div,h1,h2,h3,section,figure)[data-l="el"]{display:block}
html[data-lang="en"] img[data-l="en"],html[data-lang="sv"] img[data-l="sv"],html[data-lang="el"] img[data-l="el"]{display:block}
header.top{position:sticky;top:0;z-index:5;background:rgba(11,18,32,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
.topbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;min-height:56px;padding:8px 0}
.brand{font-weight:700;letter-spacing:.2px}.brand small{color:var(--muted);font-weight:400;margin-left:8px}
nav.main{display:flex;gap:4px 14px;flex-wrap:wrap;font-size:14px;margin-left:auto}
.langs{display:flex;gap:4px}.langs button{background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:999px;padding:4px 10px;font-size:13px;cursor:pointer}
.langs button[aria-pressed="true"]{background:var(--accent);color:#06101f;border-color:var(--accent);font-weight:600}
.hero{padding:40px 0 24px}.hero h1{font-size:clamp(26px,4vw,40px);margin:0 0 10px;line-height:1.15}.hero p{color:var(--muted);max-width:760px;margin:0 0 18px}
.btn{display:inline-block;background:var(--accent);color:#06101f;font-weight:600;padding:10px 16px;border-radius:8px;border:0;cursor:pointer;font-size:15px}
.btn.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}.btn+.btn{margin-left:8px}
section.block{padding:28px 0;border-top:1px solid var(--line)}section.block h2{margin:0 0 6px;font-size:24px}section.block>.wrap>p.lead,section.block p.lead{color:var(--muted);margin:0 0 18px;max-width:800px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px}
.card h3{margin:0;font-size:17px}.card .meta{color:var(--muted);font-size:14px}
.card img.thumb{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:8px;border:1px solid var(--line);background:#000}
.links{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:14px}.links a{background:var(--panel2);padding:4px 10px;border-radius:999px;border:1px solid var(--line)}
ol.steps{padding-left:20px;margin:0}ol.steps li{margin:6px 0}
table{width:100%;border-collapse:collapse;font-size:15px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.4px}
td code{font-size:13px;background:var(--panel2);padding:2px 6px;border-radius:4px}
img.qr{width:72px;height:72px;background:#fff;border-radius:6px;padding:4px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.tabs button{background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:14px}.tabs button[aria-selected="true"]{background:var(--panel2);border-color:var(--accent);color:var(--accent)}
/* guides */
.guide-step{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:22px;padding:26px 0;border-top:1px solid var(--line);align-items:start}
.guide-step:first-of-type{border-top:0}
.guide-step .num{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#06101f;font-weight:700;margin-right:10px}
.guide-step h3{margin:0 0 10px;font-size:20px;display:flex;align-items:center}
.shot{display:block;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#000}.shot img{width:100%;display:block}
.shot.phone{max-width:300px;margin:0 auto}.shot.phone-landscape{max-width:520px;margin:0 auto}
.box{border-left:3px solid var(--line);padding:6px 12px;margin:8px 0;background:var(--panel);border-radius:0 8px 8px 0}
.box.teacher{border-color:var(--accent)}.box.student{border-color:var(--accent2)}.box.handout{border-color:#c084fc}.box.tip{border-color:var(--warn)}
.box b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:2px}
.guide-nav{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;margin:0 0 10px}
/* feedback */
form.fb{display:grid;gap:14px;max-width:760px}form.fb label{display:block;font-weight:600;font-size:14px;margin-bottom:4px}
form.fb input[type=text],form.fb input[type=email],form.fb select,form.fb textarea{width:100%;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit}
form.fb textarea{min-height:90px}form.fb .row{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.checks{display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.checks label{font-weight:400;display:flex;gap:8px;align-items:flex-start}
.ratings{display:grid;gap:8px}.rating{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;font-size:15px}.rating .r{display:flex;gap:2px}.rating .r label{font-weight:400;display:flex;align-items:center;gap:3px;padding:0 4px}
.actions{display:flex;flex-wrap:wrap;gap:8px}.status{color:var(--accent2);min-height:1.4em}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--muted);font-size:13px;margin-top:20px}
.md{max-width:860px}.md img{max-width:100%}.md table{font-size:14px}.md pre{background:var(--panel);padding:12px;border-radius:8px;overflow:auto}.md code{background:var(--panel2);padding:1px 5px;border-radius:4px}.md blockquote{border-left:3px solid var(--accent);margin:0;padding:4px 14px;color:var(--muted)}
.md h1{font-size:30px}.md h2{margin-top:34px;border-top:1px solid var(--line);padding-top:14px}
@media (max-width:760px){.guide-step{grid-template-columns:1fr}.hero{padding:26px 0 16px}nav.main{margin-left:0}}
@media print{header.top,.langs,.actions,footer{display:none}body{background:#fff;color:#000}.card,.box{background:#fff;border-color:#ccc}}
"""

JS = r"""
(function(){
  var LANGS=['en','sv','el'];
  function pick(){
    var q=new URLSearchParams(location.search).get('lng');
    if(LANGS.indexOf(q)>=0) return q;
    try{var s=localStorage.getItem('eduLang'); if(LANGS.indexOf(s)>=0) return s;}catch(e){}
    var n=(navigator.language||'en').slice(0,2); return LANGS.indexOf(n)>=0?n:'en';
  }
  function apply(l){
    document.documentElement.setAttribute('data-lang',l); document.documentElement.lang=l;
    try{localStorage.setItem('eduLang',l);}catch(e){}
    document.querySelectorAll('.langs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.lang===l?'true':'false');});
    document.querySelectorAll('a[data-lng-link]').forEach(function(a){
      var u=a.getAttribute('data-lng-link'); a.href=u+(u.indexOf('?')>=0?'&':'?')+'lng='+l;
    });
    document.querySelectorAll('[data-lng-src]').forEach(function(img){img.src=img.getAttribute('data-lng-src').replace('{lang}',l);});
    var t=document.querySelector('title[data-tpl]'); if(t){var m=document.querySelector('meta[name="titles"]'); if(m){try{var o=JSON.parse(m.content); if(o[l]) document.title=o[l];}catch(e){}}}
  }
  window.eduSetLang=apply;
  document.addEventListener('DOMContentLoaded',function(){
    apply(pick());
    document.querySelectorAll('.langs button').forEach(function(b){b.addEventListener('click',function(){apply(b.dataset.lang);});});
  });
})();
"""


def page(title_obj, body, depth=0, extra_head="", extra_js=""):
    base = "../" * depth
    titles = {l: tr(title_obj, l) for l in LANGS}
    nav = (
        f'<a href="{base}index.html">{multi(UI["nav_home"])}</a>'
        f'<a href="{base}index.html#materials">{multi(UI["nav_materials"])}</a>'
        f'<a href="{base}index.html#guides">{multi(UI["nav_guides"])}</a>'
        f'<a href="{base}index.html#links">{multi(UI["nav_links"])}</a>'
        f'<a href="{base}feedback.html">{multi(UI["nav_feedback"])}</a>'
        f'<a href="{site["app_url"]}" data-lng-link="{site["app_url"]}/" target="_blank" rel="noopener">{multi(UI["open_app"])} ↗</a>'
    )
    langs = "".join(f'<button type="button" data-lang="{l}" aria-pressed="false">{LANG_NAMES[l]}</button>' for l in LANGS)
    return f"""<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title data-tpl>{esc(titles['en'])}</title>
<meta name="titles" content='{esc(json.dumps(titles, ensure_ascii=False))}'>
<meta name="robots" content="noindex">
<link rel="icon" href="{base}../favicon.ico">
<link rel="stylesheet" href="{base}educators.css">
{extra_head}
</head>
<body>
<header class="top"><div class="wrap topbar">
  <a class="brand" href="{base}index.html">Orbital Architecture <small>{multi(UI['nav_home'])}</small></a>
  <nav class="main">{nav}</nav>
  <div class="langs" aria-label="{esc(tr(UI['language'],'en'))}">{langs}</div>
</div></header>
{body}
<footer><div class="wrap">{multi(UI['footer'])}</div></footer>
<script src="{base}educators.js"></script>
{extra_js}
</body>
</html>"""


# --------------------------------------------------------------------------- index
MATERIAL_FILES = [
    ("plan", lambda l: (f"view.html?f=workshop-{l}.md", f"materials/workshop-{l}.md", None)),
    ("overview", lambda l: (f"materials/materials/workshop-overview-{l}.html", None, f"materials/materials/pdf/workshop-overview-{l}.pdf")),
    ("teacher_notes", lambda l: (f"materials/materials/teacher-notes-{l}.html", None, f"materials/materials/pdf/teacher-notes-{l}.pdf")),
    ("handout", lambda l: (f"materials/materials/handout-{l}.html", None, f"materials/materials/pdf/handout-{l}.pdf")),
    ("slides", lambda l: (f"view.html?f=materials/slides-{l}.md", f"materials/materials/slides-{l}.md", None)),
    ("qr_sheet", lambda l: (f"materials/materials/qr-codes.html?lng={l}", None, f"materials/materials/pdf/qr-{l}.pdf")),
]


def materials_cards():
    cards = []
    for l in LANGS:
        rows = []
        for key, fn in MATERIAL_FILES:
            view, md, pdf = fn(l)
            links = [f'<a href="{view}">{multi(UI["view"])}</a>']
            if md:
                links.append(f'<a href="{md}" download>{multi(UI["markdown"])}</a>')
            if pdf:
                links.append(f'<a href="{pdf}">{multi(UI["pdf"])}</a>')
            rows.append(f'<div><div>{multi(UI[key])}</div><div class="links">{"".join(links)}</div></div>')
        cards.append(f'<div class="card"><h3>{LANG_NAMES[l]}</h3>{"".join(rows)}</div>')
    extra = (
        f'<div class="card"><h3>{multi(UI["all_languages"])}</h3>'
        f'<div><a href="view.html?f=materials/slides-outline.md">{multi(UI["slides_outline"])}</a></div>'
        f'<div><a href="view.html?f=README.md">README (workshop)</a> · <a href="view.html?f=materials/README.md">README (materials)</a></div>'
        f'<div><a href="view.html?f=workshop-feedback.md">{multi(UI["pilot_feedback"])}</a></div>'
        f'<div><a href="view.html?f=CHANGELOG.md">{multi(UI["changelog"])}</a> · <a href="{site["repo_url"]}" target="_blank" rel="noopener">{multi(UI["source"])}</a></div>'
        f'<div><a href="materials/materials/pdf/">{multi(UI["pdf"])} ↗</a></div></div>'
    )
    return "".join(cards) + extra


def guide_cards():
    out = []
    for g in data["guides"]:
        img = f'<img class="thumb" loading="lazy" alt="" data-lng-src="screenshots/{{lang}}/{g["shot"]}.png">'
        out.append(
            f'<a class="card" href="guides/{g["id"]}.html">{img}<h3>{multi(g["title"])}</h3>'
            f'<div class="meta">{multi(g["intro"])}</div></a>'
        )
    return "".join(out)


def links_table():
    rows = []
    for t in data["tools"]:
        url = site["app_url"] + t["path"]
        qr = f'<img class="qr" loading="lazy" alt="QR" data-lng-src="materials/materials/qr/{t["key"]}-{{lang}}.png">'
        rows.append(f'<tr><td>{multi(t["name"])}</td><td>{multi(t["when"])}</td><td><a data-lng-link="{url}" href="{url}" target="_blank" rel="noopener"><code>{esc(t["path"])}</code></a></td><td>{qr}</td></tr>')
    for p in data["presets"]:
        url = site["app_url"] + p["path"]
        rows.append(f'<tr><td>{multi(p["name"])}</td><td>{multi({"en":"Block B2 — projector demo","sv":"Block B2 — demo på projektorn","el":"Μπλοκ B2 — επίδειξη στον προβολέα"})}</td><td><a data-lng-link="{url}" href="{url}" target="_blank" rel="noopener"><code>{esc(p["path"])}</code></a></td><td>—</td></tr>')
    head = f'<tr><th>{multi(UI["tool"])}</th><th>{multi(UI["when"])}</th><th>{multi(UI["link"])}</th><th>{multi(UI["qr"])}</th></tr>'
    return f'<table>{head}{"".join(rows)}</table>'


def start_steps():
    def render(lang):
        items = tr(UI["start_steps"], lang)
        return "".join(f"<li>{esc(i)}</li>" for i in items)
    return multi_html(render, tag="ol", cls="steps")


def build_index():
    body = f"""
<section class="hero"><div class="wrap">
  <h1>{multi(site['title'])}</h1>
  <p>{multi(site['tagline'])}</p>
  <a class="btn" href="#guides">{multi(UI['nav_guides'])}</a>
  <a class="btn ghost" href="#materials">{multi(UI['nav_materials'])}</a>
  <a class="btn ghost" href="feedback.html">{multi(UI['nav_feedback'])}</a>
</div></section>
<section class="block" id="start"><div class="wrap">
  <h2>{multi(UI['start_here'])}</h2>
  {start_steps()}
</div></section>
<section class="block" id="materials"><div class="wrap">
  <h2>{multi(UI['materials_title'])}</h2>
  <p class="lead">{multi(UI['materials_intro'])}</p>
  <div class="grid">{materials_cards()}</div>
</div></section>
<section class="block" id="guides"><div class="wrap">
  <h2>{multi(UI['guides_title'])}</h2>
  <p class="lead">{multi(UI['guides_intro'])}</p>
  <div class="grid">{guide_cards()}</div>
</div></section>
<section class="block" id="links"><div class="wrap">
  <h2>{multi(UI['links_title'])}</h2>
  <p class="lead">{multi(UI['links_intro'])}</p>
  {links_table()}
</div></section>
<section class="block" id="feedback"><div class="wrap">
  <h2>{multi(UI['feedback_title'])}</h2>
  <p class="lead">{multi(UI['feedback_intro'])}</p>
  <a class="btn" href="feedback.html">{multi(UI['nav_feedback'])} →</a>
</div></section>
"""
    (OUT / "index.html").write_text(page(site["title"], body), encoding="utf-8")


# --------------------------------------------------------------------------- guides
def shot_figure(name, depth=1):
    if not name:
        return ""
    cls = "shot"
    if name.endswith("-phone"):
        cls += " phone-landscape" if name.startswith("matb-run") else " phone"
    base = "../" * depth
    return (
        f'<a class="{cls}" href="{base}screenshots/en/{name}.png" data-lng-link-raw="1" target="_blank" rel="noopener">'
        f'<img loading="lazy" alt="{esc(tr(UI["screenshot_alt"], "en"))}: {esc(name)}" data-lng-src="{base}screenshots/{{lang}}/{name}.png"></a>'
    )


def box(kind, label_obj, text_obj):
    if not any(tr(text_obj, l) for l in LANGS):
        return ""
    return f'<div class="box {kind}"><b>{multi(label_obj)}</b>{multi(text_obj, tag="span")}</div>'


def build_guides():
    gdir = OUT / "guides"
    gdir.mkdir(parents=True, exist_ok=True)
    guides = data["guides"]
    nav_all = "".join(f'<a href="{g["id"]}.html">{multi(g["title"])}</a>' for g in guides)
    for i, g in enumerate(guides):
        steps = []
        for n, s in enumerate(g["steps"], 1):
            steps.append(
                f'<div class="guide-step"><div>'
                f'<h3><span class="num">{n}</span>{multi(s["heading"])}</h3>'
                f'{box("teacher", UI["teacher_does"], s.get("teacher", {}))}'
                f'{box("student", UI["student_sees"], s.get("student", {}))}'
                f'{box("handout", UI["handout_box"], s.get("handout", {}))}'
                f'{box("tip", UI["tip"], s.get("tip", {}))}'
                f'</div><div>{shot_figure(s.get("shot", ""))}</div></div>'
            )
        prev_ = guides[i - 1] if i > 0 else None
        next_ = guides[i + 1] if i < len(guides) - 1 else None
        pn = '<div class="guide-nav">'
        if prev_:
            pn += f'<a href="{prev_["id"]}.html">← {multi(prev_["title"])}</a>'
        if next_:
            pn += f'<a href="{next_["id"]}.html" style="margin-left:auto">{multi(next_["title"])} →</a>'
        pn += "</div>"
        body = f"""
<section class="hero"><div class="wrap">
  <div class="guide-nav"><a href="../index.html#guides">{multi(UI['guide_back'])}</a></div>
  <h1>{multi(g['title'])}</h1>
  <p>{multi(g['intro'])}</p>
</div></section>
<section class="block"><div class="wrap">
  {''.join(steps)}
  {pn}
</div></section>
<section class="block"><div class="wrap"><h2>{multi(UI['guides_title'])}</h2><div class="guide-nav">{nav_all}</div></div></section>
"""
        (gdir / f"{g['id']}.html").write_text(page(g["title"], body, depth=1), encoding="utf-8")


# --------------------------------------------------------------------------- feedback
def build_feedback():
    f = UI["feedback_form"]

    def options(obj, name):
        def render(lang):
            return "".join(f'<option value="{esc(o)}">{esc(o)}</option>' for o in tr(obj, lang))
        # three selects, one per language, same name — JS keeps them in sync
        return multi_html(render, tag="select", cls="") .replace("<select ", f'<select name="{name}" ')

    def checks(obj, name):
        def render(lang):
            return "".join(
                f'<label><input type="checkbox" name="{name}" value="{esc(o)}"> <span>{esc(o)}</span></label>'
                for o in tr(obj, lang)
            )
        return multi_html(render, tag="div", cls="checks")

    def ratings():
        def render(lang):
            rows = []
            for k, label in enumerate(tr(f["ratings"], lang)):
                r = "".join(f'<label><input type="radio" name="rating{k}" value="{v}">{v}</label>' for v in range(1, 6))
                rows.append(f'<div class="rating"><span>{esc(label)}</span><span class="r">{r}</span></div>')
            return "".join(rows)
        return multi_html(render, tag="div", cls="ratings")

    endpoint = site.get("feedback_endpoint", "")
    send_online = f'<button type="button" class="btn" id="fbSend">{multi(f["send_online"])}</button>' if endpoint else ""
    body = f"""
<section class="hero"><div class="wrap">
  <h1>{multi(UI['feedback_title'])}</h1>
  <p>{multi(UI['feedback_intro'])}</p>
</div></section>
<section class="block"><div class="wrap">
<form class="fb" id="fb" onsubmit="return false">
  <div class="row">
    <div><label>{multi(f['name'])}</label><input type="text" name="name"></div>
    <div><label>{multi(f['email'])}</label><input type="email" name="email"></div>
  </div>
  <div class="row">
    <div><label>{multi(f['school'])}</label><input type="text" name="school"></div>
    <div><label>{multi(f['role'])}</label>{options(f['roles'], 'role')}</div>
  </div>
  <div class="row">
    <div><label>{multi(f['class'])}</label><input type="text" name="class"></div>
    <div><label>{multi(f['language_used'])}</label><select name="lang_used"><option>English</option><option>Svenska</option><option>Ελληνικά</option></select></div>
  </div>
  <div><label>{multi(f['blocks'])}</label>{checks(f['blocks_list'], 'blocks')}</div>
  <div><label>{multi(UI['feedback_title'])} — {multi(f['rating_hint'])}</label>{ratings()}</div>
  <div><label>{multi(f['problems'])}</label><textarea name="problems"></textarea></div>
  <div><label>{multi(f['best'])}</label><textarea name="best"></textarea></div>
  <div><label>{multi(f['wishes'])}</label><textarea name="wishes"></textarea></div>
  <div><label class="checks" style="font-weight:400"><input type="checkbox" name="consent" value="yes"> <span>{multi(f['consent'])}</span></label></div>
  <div class="actions">
    {send_online}
    <a class="btn" id="fbMail" href="#">{multi(f['send_email'])}</a>
    <button type="button" class="btn ghost" id="fbCopy">{multi(f['copy'])}</button>
    <a class="btn ghost" id="fbIssue" href="#" target="_blank" rel="noopener">{multi(f['github'])}</a>
    <button type="button" class="btn ghost" id="fbDl">{multi(f['download'])}</button>
    <button type="button" class="btn ghost" id="fbClear">{multi(f['clear'])}</button>
  </div>
  <div class="status" id="fbStatus"></div>
  <p class="meta" style="color:var(--muted);font-size:13px">{multi(f['draft_note'])}</p>
</form>
</div></section>
"""
    cfg = {
        "email": site["contact_email"],
        "repo": site["repo_url"],
        "endpoint": endpoint,
        "subject": {l: tr(f["subject"], l) for l in LANGS},
        "copied": {l: tr(f["copied"], l) for l in LANGS},
        "sent": {l: tr(f["sent"], l) for l in LANGS},
        "failed": {l: tr(f["send_failed"], l) for l in LANGS},
        "labels": {
            l: {
                "name": tr(f["name"], l), "email": tr(f["email"], l), "school": tr(f["school"], l), "role": tr(f["role"], l),
                "class": tr(f["class"], l), "lang_used": tr(f["language_used"], l), "blocks": tr(f["blocks"], l),
                "ratings": tr(f["ratings"], l), "problems": tr(f["problems"], l), "best": tr(f["best"], l),
                "wishes": tr(f["wishes"], l), "consent": tr(f["consent"], l),
            } for l in LANGS
        },
    }
    js = """
<script>
(function(){
  var CFG=%s; var form=document.getElementById('fb'); var KEY='eduFeedbackDraft';
  function lang(){return document.documentElement.getAttribute('data-lang')||'en';}
  function visible(sel){return Array.prototype.filter.call(form.querySelectorAll(sel),function(el){return el.offsetParent!==null;});}
  function val(name){var el=visible('[name="'+name+'"]')[0]||form.querySelector('[name="'+name+'"]');return el?el.value.trim():'';}
  function checked(name){return visible('input[name="'+name+'"]:checked').map(function(c){return c.value;});}
  function rating(k){var r=form.querySelector('input[name="rating'+k+'"]:checked');return r?r.value:'';}
  function text(){
    var L=CFG.labels[lang()], lines=[CFG.subject[lang()], '='.repeat(40)];
    [['name','name'],['email','email'],['school','school'],['role','role'],['class','class'],['lang_used','lang_used']].forEach(function(p){lines.push(L[p[0]]+': '+val(p[1]));});
    lines.push(L.blocks+': '+checked('blocks').join('; '));
    L.ratings.forEach(function(lab,k){lines.push(lab+': '+(rating(k)||'-')+'/5');});
    lines.push('', L.problems, val('problems'), '', L.best, val('best'), '', L.wishes, val('wishes'), '', L.consent+' '+(checked('consent').length?'yes':'no'), '', 'Page language: '+lang()+' · '+new Date().toISOString()+' · materials v2.1.2');
    return lines.join('\\n');
  }
  function status(msg){document.getElementById('fbStatus').textContent=msg;}
  function refresh(){
    var t=text();
    document.getElementById('fbMail').href='mailto:'+CFG.email+'?subject='+encodeURIComponent(CFG.subject[lang()])+'&body='+encodeURIComponent(t);
    document.getElementById('fbIssue').href=CFG.repo+'/issues/new?title='+encodeURIComponent(CFG.subject[lang()]+' ('+(val('school')||lang())+')')+'&body='+encodeURIComponent(t);
  }
  function save(){var o={};form.querySelectorAll('input,select,textarea').forEach(function(el,i){if(el.type==='checkbox'||el.type==='radio'){o[i]=el.checked;}else{o[i]=el.value;}});try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
  function load(){try{var o=JSON.parse(localStorage.getItem(KEY)||'null');if(!o)return;form.querySelectorAll('input,select,textarea').forEach(function(el,i){if(!(i in o))return;if(el.type==='checkbox'||el.type==='radio'){el.checked=!!o[i];}else{el.value=o[i];}});}catch(e){}}
  form.addEventListener('input',function(){save();refresh();});
  form.addEventListener('change',function(e){
    // keep the three per-language selects/checkbox groups in sync
    var el=e.target; if(el.tagName==='SELECT'&&el.name){var idx=el.selectedIndex;form.querySelectorAll('select[name="'+el.name+'"]').forEach(function(s){s.selectedIndex=idx;});}
    if(el.type==='checkbox'&&el.name==='blocks'){var groups=form.querySelectorAll('.checks[data-l]');var pos=Array.prototype.indexOf.call(el.closest('.checks').querySelectorAll('input'),el);groups.forEach(function(g){var c=g.querySelectorAll('input')[pos];if(c)c.checked=el.checked;});}
    save();refresh();
  });
  document.getElementById('fbCopy').addEventListener('click',function(){var t=text();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){status(CFG.copied[lang()]);},function(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();status(CFG.copied[lang()]);});});
  document.getElementById('fbDl').addEventListener('click',function(){var b=new Blob([text()],{type:'text/plain;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='workshop-feedback-'+lang()+'.txt';document.body.appendChild(a);a.click();a.remove();});
  document.getElementById('fbClear').addEventListener('click',function(){form.reset();try{localStorage.removeItem(KEY);}catch(e){}status('');refresh();});
  var send=document.getElementById('fbSend'); if(send){send.addEventListener('click',function(){fetch(CFG.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({subject:CFG.subject[lang()],text:text(),lang:lang()})}).then(function(r){if(!r.ok)throw 0;status(CFG.sent[lang()]);}).catch(function(){status(CFG.failed[lang()]);});});}
  load(); refresh();
  var mo=new MutationObserver(refresh); mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});
})();
</script>""" % json.dumps(cfg, ensure_ascii=False)
    (OUT / "feedback.html").write_text(page(UI["feedback_title"], body, extra_js=js), encoding="utf-8")


# --------------------------------------------------------------------------- markdown viewer
def build_viewer():
    body = """
<section class="block"><div class="wrap md" id="md"><p id="mdStatus">…</p></div></section>
"""
    js = """
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script>
(function(){
  var f=new URLSearchParams(location.search).get('f')||'README.md';
  if(/^\\/|\\.\\.|:\\/\\//.test(f)) f='README.md';
  var base='materials/'; var dir=f.indexOf('/')>=0?f.slice(0,f.lastIndexOf('/')+1):'';
  var box=document.getElementById('md');
  function resolve(href){
    if(/^(https?:|mailto:|#)/.test(href)) return href;
    var path=dir+href; var parts=[]; path.split('/').forEach(function(p){if(p==='..')parts.pop();else if(p!=='.'&&p!=='')parts.push(p);});
    path=parts.join('/');
    if(/\\.md(#.*)?$/.test(path)){var h=path.indexOf('#');var frag=h>=0?path.slice(h):'';if(h>=0)path=path.slice(0,h);return 'view.html?f='+encodeURIComponent(path)+frag;}
    return base+path;
  }
  fetch(base+f).then(function(r){if(!r.ok)throw new Error(r.status);return r.text();}).then(function(txt){
    if(!window.marked){box.innerHTML='<p>Could not load the Markdown renderer. <a href="'+base+f+'">Open the file directly</a>.</p>';return;}
    var renderer=new marked.Renderer();
    var oldLink=renderer.link.bind(renderer), oldImg=renderer.image.bind(renderer);
    renderer.link=function(h,t,x){ if(typeof h==='object'){h.href=resolve(h.href);return oldLink(h);} return oldLink(resolve(h),t,x);};
    renderer.image=function(h,t,x){ if(typeof h==='object'){h.href=resolve(h.href);return oldImg(h);} return oldImg(resolve(h),t,x);};
    box.innerHTML=marked.parse(txt,{renderer:renderer,gfm:true});
    var h1=box.querySelector('h1'); if(h1) document.title=h1.textContent+' — Orbital Architecture';
    var top=document.createElement('p'); top.innerHTML='<a href="'+base+f+'" download>⬇ '+f+'</a>'; box.insertBefore(top, box.firstChild);
    if(location.hash){var el=document.getElementById(location.hash.slice(1)); if(el) el.scrollIntoView();}
  }).catch(function(e){box.innerHTML='<p>Not found: '+f+'</p>';});
})();
</script>"""
    (OUT / "view.html").write_text(page({"en": "Orbital Architecture — reader", "sv": "Orbital Architecture — läsare", "el": "Orbital Architecture — ανάγνωση"}, body, extra_js=js), encoding="utf-8")


# --------------------------------------------------------------------------- main
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "screenshots").mkdir(exist_ok=True)
    sync_materials()
    (OUT / "educators.css").write_text(CSS.strip() + "\n", encoding="utf-8")
    (OUT / "educators.js").write_text(JS.strip() + "\n", encoding="utf-8")
    build_index()
    build_guides()
    build_feedback()
    build_viewer()
    shots = {s["shot"] for g in data["guides"] for s in g["steps"] if s.get("shot")} | {g["shot"] for g in data["guides"]}
    missing = [f"{l}/{s}" for l in LANGS for s in sorted(shots) if not (OUT / "screenshots" / l / f"{s}.png").exists()]
    print(f"wrote index, feedback, view, {len(data['guides'])} guides; {len(shots)} screenshots referenced"
          + (f"; MISSING: {', '.join(missing)}" if missing else "; all screenshots present"))


if __name__ == "__main__":
    main()
