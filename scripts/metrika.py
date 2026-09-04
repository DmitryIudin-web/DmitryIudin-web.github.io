#!/usr/bin/env python3
"""Работа со счётчиком Яндекс.Метрики 106049767 через API.

Закрывает вручную делаемые в интерфейсе Метрики пункты из
docs/owner-manual-steps.md и docs/direct-tracking-2026-09-03.md:

    python3 scripts/metrika.py create-goals             # все 7 JS-целей Этапа 1
    python3 scripts/metrika.py create-goals --dry-run   # показать, что будет сделано
    python3 scripts/metrika.py bounce                   # отказы по меткам Директа

Токен берётся из переменной окружения METRIKA_OAUTH_TOKEN. Получить:
oauth.yandex.ru -> создать приложение с правами «Яндекс.Метрика: получение
статистики» и «Яндекс.Метрика: управление счётчиками» -> выпустить токен для
своего аккаунта. Токен в репозиторий не коммитить и никому не пересылать.

Запускать там, где есть сеть до api-metrika.yandex.net. Облачные окружения
Claude Code с политикой «trusted network access» этот домен не пропускают
(403 на CONNECT), поэтому скрипт рассчитан на запуск с компьютера владельца.

create-goals идемпотентен: сверяется с существующими целями по идентификатору
события и создаёт только недостающие, поэтому повторный запуск безопасен.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

COUNTER = 106049767
API = 'https://api-metrika.yandex.net'

# Идентификаторы событий совпадают с теми, что шлёт assets/ast-conversion.js.
# Список сверен с docs/tracking-check-2026-09.md.
GOALS = [
    ('ast_cta_click',      'AST: клик CTA'),
    ('ast_messenger_open', 'AST: мессенджер'),
    ('ast_phone_click',    'AST: клик телефон'),
    ('ast_form_start',     'AST: старт формы'),
    ('ast_quiz_submit',    'AST: квиз'),
    ('ast_form_submit',    'AST: форма'),
    ('ast_contact',        'AST: обращение'),
]
# ast_call сознательно не создаётся: цель имеет смысл только после
# подключения коллтрекинга (пункт 7 в docs/owner-manual-steps.md).


def token():
    t = os.environ.get('METRIKA_OAUTH_TOKEN', '').strip()
    if not t:
        sys.exit('Нет METRIKA_OAUTH_TOKEN.\n'
                 '  Linux/macOS: METRIKA_OAUTH_TOKEN=... python3 scripts/metrika.py create-goals\n'
                 '  Windows:     set METRIKA_OAUTH_TOKEN=... && python scripts\\metrika.py create-goals')
    return t


def call(method, path, payload=None, params=None):
    url = f'{API}{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'OAuth {token()}')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        if e.code in (401, 403):
            sys.exit(f'API вернул {e.code} — токен недействителен или у него нет прав\n'
                     f'на управление счётчиками.\n{body}')
        sys.exit(f'API вернул {e.code} на {method} {path}\n{body}')
    except urllib.error.URLError as e:
        sys.exit(f'Не достучались до {API}: {e.reason}\n'
                 'Если это отказ на CONNECT — сеть окружения закрывает домен.\n'
                 'Запускайте скрипт со своего компьютера.')


def existing_event_ids(goals):
    ids = set()
    for g in goals:
        for cond in g.get('conditions') or []:
            if cond.get('url'):
                ids.add(cond['url'])
    return ids


def create_goals(dry_run=False):
    """Создаёт недостающие JS-цели Этапа 1. Повторный запуск ничего не портит."""
    if dry_run:
        print('Режим проверки: запросов к API не будет.')
        print(f'Счётчик: {COUNTER}\nБудут созданы недостающие цели из списка:')
        for event_id, name in GOALS:
            print(f'  {event_id:<20} {name}')
        print('\nПример тела запроса POST /management/v1/counter/%d/goals:' % COUNTER)
        print(json.dumps({'goal': {
            'name': GOALS[0][1], 'type': 'action', 'is_retargeting': 0,
            'conditions': [{'type': 'exact', 'url': GOALS[0][0]}]}},
            ensure_ascii=False, indent=2))
        return

    have = existing_event_ids(
        call('GET', f'/management/v1/counter/{COUNTER}/goals').get('goals', []))

    created = skipped = 0
    for event_id, name in GOALS:
        if event_id in have:
            print(f'уже есть:  {event_id:<20}')
            skipped += 1
            continue
        g = call('POST', f'/management/v1/counter/{COUNTER}/goals', {'goal': {
            'name': name,
            'type': 'action',
            'is_retargeting': 0,
            'conditions': [{'type': 'exact', 'url': event_id}],
        }})['goal']
        print(f'создана:   {event_id:<20} id={g["id"]} «{g["name"]}»')
        created += 1

    print(f'\nИтого: создано {created}, уже было {skipped}.')
    if created:
        print('Данные появятся в отчётах после первых визитов — при условии,\n'
              'что рантайм подключён в Tilda (пункт 2 в docs/owner-manual-steps.md).')


def bounce():
    """Отказы в разрезе меток Директа — шаг 5 аудита от 14.05.2026."""
    for dim in ('utm_source_type', 'utm_content'):
        data = call('GET', '/stat/v1/data', params={
            'ids': COUNTER,
            'metrics': 'ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
            'dimensions': 'ym:s:paramsLevel3',
            'filters': f"ym:s:paramsLevel1=='ast_source' AND ym:s:paramsLevel2=='{dim}'",
            'date1': '30daysAgo',
            'date2': 'today',
            'limit': 100,
            'accuracy': 'full',
        })
        rows = data.get('data', [])
        print(f'\n=== Отказы по {dim} (30 дней) ===')
        if not rows:
            print('  данных нет — метки ещё не накопились либо рантайм '
                  'не подключён на боевом сайте')
            continue
        print(f'  {"значение":<32} {"визиты":>8} {"отказы":>9} {"ср. время":>11}')
        for r in rows:
            name = (r['dimensions'][0].get('name') or '(не задано)')[:32]
            visits, br, dur = r['metrics']
            print(f'  {name:<32} {int(visits):>8} {br:>8.1f}% {dur:>10.0f}с')


COMMANDS = {'create-goals': create_goals, 'bounce': bounce}

if __name__ == '__main__':
    args = sys.argv[1:]
    cmd = args[0] if args else ''
    if cmd not in COMMANDS:
        sys.exit(f'Использование: python3 {sys.argv[0]} ({"|".join(COMMANDS)}) [--dry-run]')
    if cmd == 'create-goals':
        create_goals(dry_run='--dry-run' in args[1:])
    else:
        COMMANDS[cmd]()
