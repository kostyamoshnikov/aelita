#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор страницы спектакля/события для сайта — Site/<slug>/index.html.

НЕ пытается сочинить содержание (описание, состав, отзывы) — это
всегда пишется человеком. Собирает тот каркас, в котором легко
ошибиться или что-то забыть, если писать страницу с нуля вручную:
полный <head> (SEO, Open Graph, Twitter Card, JSON-LD, favicon-пакет,
manifest, версия ассетов), nav, cookie-баннер, Telegram-виджет, футер
и подключение скриптов — байт-в-байт как на остальных страницах-
спектаклях сайта (сверено с Site/listen, /porfiriy на момент
написания).

Использование — заполнить SHOW ниже и запустить:
    python3 build_show_page.py
Результат: Site/<slug>/index.html — открыть и дописать контент в
секциях, помеченных TODO. Актуальную версию ассетов (SITE_VERSION)
скрипт берёт из Site/sw.js сам — вручную вписывать не нужно.

После создания страницы вручную (!):
  0. английская версия — отдельный цикл, см.
     _tools/DesignSystem/i18n/README.md:
         python3 check_i18n.py --stub > /tmp/new.json
         # заполнить переводы
         python3 merge_stub.py /tmp/new.json && python3 build_en.py
     build_en.py сам допишет EN-URL в sitemap;
  1. добавить RU-URL в Site/sitemap.xml;
  2. если спектакль ограничен по возрасту иначе, чем 12+ — поправить
     `age` в конфиге ниже;
  3. если у спектакля ещё нет статьи-присутствия на сайте (главная,
     /projects) — это отдельная правка, генератор её не делает.
"""
import os, re, html, json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))   # Site/_generators
SITE_ROOT = os.path.dirname(SCRIPT_DIR)                    # Site


def site_version():
    sw = open(os.path.join(SITE_ROOT, 'sw.js'), encoding='utf-8').read()
    m = re.search(r'const SITE_VERSION = (\d+);', sw)
    if not m:
        raise RuntimeError('SITE_VERSION не найден в sw.js')
    return m.group(1)


# ============================================================
# ЗАПОЛНИТЬ ПЕРЕД ЗАПУСКОМ
#
# Схема согласована с DesignSystem/build-show-deck.js (та же дека
# спектакля, но в pptx) — поля и вложенность одинаковые, разница
# только в регистре (snake_case здесь, camelCase там). Если делаешь
# и страницу, и деку для одного спектакля — можно переносить значения
# впрямую, без переосмысления, что где как называется.
# ============================================================
SHOW = dict(
    slug='mozgi',                       # -> /mozgi/
    title='Есть ли у вас мозги?',
    genre='Интерактивный моноспектакль',             # строка над заголовком (eyebrow)
    age='16+',                                    # возрастная маркировка (436-ФЗ)
    tagline='Верить нам не надо. Проверим на месте.',
    description='Интерактивный моноспектакль о невероятных возможностях человеческого мозга и цене научных открытий — про реальные исследования, пациентов и учёных-бунтарей.',
    director=dict(
        role='Автор идеи и режиссёр',
        name='Дмитрий Турков',
        slug=None,
    ),
    city_date='Дата уточняется · Старый Оскол, ЦСИ «Быль»',
    hero_image='/images/mozgi/47995.jpg',
    team=[
        dict(role='Автор идеи и режиссёр', name='Дмитрий Турков'),
        dict(role='Актёр', name='Сергей Васин'),
    ],
    gallery=[
        '/images/mozgi/47993.jpg',
        '/images/mozgi/47994.jpg',
        '/images/mozgi/47996.jpg',
        '/images/mozgi/47997.jpg',
        '/images/mozgi/47998.jpg',
    ],
)
# ============================================================


def esc(s):
    return html.escape(s, quote=True)


def team_html(team):
    if not team:
        return '      <!-- TODO: состав команды -->\n'
    items = '\n'.join(
        f'      <div class="member"><p class="role">{esc(m["role"])}</p><h3>{esc(m["name"])}</h3></div>'
        for m in team
    )
    return items + '\n'


def gallery_html(urls):
    if not urls:
        return '      <!-- TODO: фотографии -->\n'
    items = []
    for i, base_url in enumerate(urls, 1):
        # ожидается прямая cloudinary-ссылка без трансформаций — подставляем свои
        w600 = re.sub(r'/upload/', '/upload/w_600,q_auto,f_auto/', base_url)
        w1200 = re.sub(r'/upload/', '/upload/w_1200,q_auto,f_auto/', base_url)
        items.append(
            f'      <div class="ph ph-{i}"><img src="{esc(w600)}" data-src="{esc(w1200)}" '
            f'alt="Сцена из спектакля «{esc(SHOW["title"])}» AELITA PRODUCTION" loading="lazy"></div>'
        )
    return '\n'.join(items) + '\n'


def director_line(s):
    d = s['director']
    if d.get('slug'):
        return f'<p class="dir">{esc(d["role"])} — <strong><a href="/{d["slug"]}">{esc(d["name"])}</a></strong></p>'
    return f'<p class="dir">{esc(d["role"])} — <strong>{esc(d["name"])}</strong></p>'


def build(s):
    v = site_version()
    url = f'https://aelita-production.ru/{s["slug"]}/'
    page_title = f'{s["title"]} — AELITA PRODUCTION'
    json_ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "TheaterEvent",
        "name": s['title'],
        "description": s['description'],
        "url": url,
        "image": s['hero_image'],
        "organizer": {
            "@type": "Organization",
            "name": "AELITA PRODUCTION",
            "url": "https://aelita-production.ru",
        },
    }, ensure_ascii=False, indent=2)

    html_out = f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<link rel="manifest" href="/manifest.json">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">
<link rel="shortcut icon" href="/favicon.ico">
<meta name="theme-color" content="#0B0B0D">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="АЭЛИТА">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(page_title)}</title>
<meta name="description" content="{esc(s['description'])}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(page_title)}">
<meta property="og:description" content="{esc(s['description'])}">
<meta property="og:image" content="https://aelita-production.ru/images/og-default.jpg">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(page_title)}">
<meta name="twitter:description" content="{esc(s['description'])}">
<meta name="twitter:image" content="https://aelita-production.ru/images/og-default.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v={v}">
<style>body{{max-width:100vw}}
.page-hero{{position:relative;min-height:100svh;display:flex;align-items:flex-end;padding:0;border-bottom:none;animation:none}}
.page-hero h1{{font-size:clamp(30px,6vw,70px);letter-spacing:.1em;line-height:1.1;margin-bottom:16px}}
.page-hero .sub{{color:var(--sand);font-size:16px;max-width:52ch;margin-bottom:10px}}
.btn-outline{{font-family:'Montserrat',sans-serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;border:1px solid rgba(214,181,122,.5);color:var(--bone);padding:15px 30px;text-decoration:none;display:inline-block;transition:all .3s}}
</style>
<script type="application/ld+json">
{json_ld}
</script>
</head>
<body>
<a class="skip-link" href="#main">Перейти к содержанию</a>
<div class="curtain" aria-hidden="true"><div class="curtain-l"></div><div class="curtain-r"></div></div>
<nav>
  <div class="nav-in">
    <a class="logo" href="/">АЭЛИТА<small>ПРОДАКШЕН</small></a>
    <div class="nav-links">
      <a href="/tickets">Афиша</a>
      <a href="/projects" class="active">Проекты</a>
      <a href="/collaboration">Сотрудничество</a>
      <a href="/contacts">Контакты</a>
    </div>
    <button class="burger" aria-label="Меню" onclick="toggleMenu()">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<main id="main">

<div class="page-hero" style="background:url('{esc(s['hero_image'])}') center/cover">
  <div class="hero-overlay"></div>
  <div class="wrap">
    <p class="eyebrow">{esc(s['genre'])}<span class="age">{esc(s['age'])}</span></p>
    <h1>{esc(s['title'])}</h1>
    {director_line(s)}
    <p class="sub">{esc(s['tagline'])}</p>
    <div class="hero-btns" style="display:flex;gap:14px;flex-wrap:wrap">
      <a class="btn-outline" href="/#subscribe">Узнать о новых датах</a>
    </div>
  </div>
</div>

<section id="about">
  <div class="wrap">
    <div class="sec-head reveal"><h2>О проекте</h2></div>
    <p class="desc reveal">{esc(s['description'])}</p>
    <!-- TODO: развёрнутое описание, если нужно больше одного абзаца -->
  </div>
</section>

<section style="background:var(--coal);padding:70px 0" id="afisha">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Ближайшие показы</h2></div>
    <p style="color:var(--sand)">Новые даты уточняются.</p>
    <a class="btn-outline" href="/#subscribe" style="display:inline-block;margin-top:20px">Узнать о датах первым</a>
    <!-- Когда дата назначена — заменить этот блок карточкой показа,
         по образцу секции #afisha на Site/porfiriy (после первого проката). -->
  </div>
</section>

<!-- ФОТО -->
<section id="photos" style="padding:80px 0">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Фотографии</h2></div>
    <div class="photos-grid reveal">
{gallery_html(s['gallery'])}    </div>
  </div>
</section>

<section id="team">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Команда</h2></div>
    <div class="team-grid reveal">
{team_html(s['team'])}    </div>
  </div>
</section>

</main>

<!-- Cookie Banner -->
<div id="cookie-banner">
  <p>Мы используем cookies для аналитики и улучшения сайта. Продолжая использовать сайт, вы соглашаетесь с нашей <a href="/cookies">политикой cookies</a> и <a href="/privacy">политикой конфиденциальности</a>.</p>
  <div class="cookie-actions">
    <button class="cookie-btn cookie-btn-more" onclick="window.location.href='/cookies'">Подробнее</button>
    <button class="cookie-btn cookie-btn-accept" onclick="acceptCookies()">Принять</button>
  </div>
</div>
<!-- /Cookie Banner -->

<button id="back-to-top" aria-label="Наверх" onclick="window.scrollTo({{top:0,behavior:'smooth'}})">↑</button>

<!-- Telegram виджет -->
<div class="tg-widget" id="tg-widget">
  <div class="tg-bubble" id="tg-bubble">Напишите нам — бот ответит мгновенно</div>
  <a class="tg-btn" href="https://t.me/aelita_production_bot" target="_blank" rel="noopener" aria-label="Написать в Telegram">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.093 13.68l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.836.88h.219z"/></svg>
    Написать нам
  </a>
</div>

<button class="m-menu-close" id="close-btn" onclick="toggleMenu()" aria-label="Закрыть меню">✕</button>
<script src="/assets/analytics-events.js"></script>
<script src="/assets/main.js?v={v}"></script>

<script>
  if ('serviceWorker' in navigator) {{
    window.addEventListener('load', () => {{
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW зарегистрирован:', reg.scope))
        .catch(err => console.error('SW ошибка:', err));
    }});
  }}
</script>
</body>
</html>'''
    return html_out


if __name__ == '__main__':
    out_dir = os.path.join(SITE_ROOT, SHOW['slug'])
    out_path = os.path.join(out_dir, 'index.html')
    if os.path.exists(out_path):
        raise SystemExit(f'{out_path} уже существует — генератор не перезаписывает готовые страницы. '
                          f'Удали файл вручную, если точно хочешь пересоздать.')
    os.makedirs(out_dir, exist_ok=True)
    content = build(SHOW)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Создано: {out_path}')
    print('Дальше вручную: дописать TODO-секции, добавить URL в Site/sitemap.xml.')
