#!/usr/bin/env python3
"""Работа со счётчиком Яндекс.Метрики 106049767 через API.

Закрывает два пункта из docs/direct-tracking-2026-09-03.md, которые иначе
делаются руками в интерфейсе:

    python3 scripts/metrika.py create-goal   # цель ast_form_start
    python3 scripts/metrika.py bounce        # отказы по меткам Директа

Токен берётся из переменной окружения METRIKA_OAUTH_TOKEN. Получить:
oauth.yandex.ru → создать приложение с правами «Яндекс.Метрика: получение
статистики» и «…управление счётчиками» → выпустить токен для своего аккаунта.
Токен в репозиторий не коммитить.

Запускать там, где есть сеть до api-metrika.yandex.net. В облачном окружении
Claude Code с политикой «trusted network access» домен закрыт (403 на CONNECT),
поэтому скрипт рассчитан на запуск с машины владельца.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

COUNTER = 106049767
API = 'https://api-metrika.yandex.net'
GOAL_NAME = 'Старт заполнения формы'
GOAL_ID = 'ast_form_start'


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
        sys.exit(f'API вернул {e.code} на {method} {path}\n{body}')
    except urllib.error.URLError as e:
        sys.exit(f'Не достучались до {API}: {e.reason}\n'
                 'Если это 403 на CONNECT — сеть окружения закрывает домен, '
                 'запускайте скрипт со своей машины.')


def token():
    t = os.environ.get('METRIKA_OAUTH_TOKEN', '').strip()
    if not t:
        sys.exit('Нет METRIKA_OAUTH_TOKEN. Пример:\n'
                 '  METRIKA_OAUTH_TOKEN=... python3 scripts/metrika.py create-goal')
    return t


def create_goal():
    """Создаёт JS-цель ast_form_start. Повторный запуск ничего не портит."""
    existing = call('GET', f'/management/v1/counter/{COUNTER}/goals').get('goals', [])
    for g in existing:
        for cond in g.get('conditions') or []:
            if cond.get('url') == GOAL_ID:
                print(f'Цель уже есть: id={g["id"]} «{g["name"]}» → {GOAL_ID}')
                return
    created = call('POST', f'/management/v1/counter/{COUNTER}/goals', {
        'goal': {
            'name': GOAL_NAME,
            'type': 'action',
            'is_retargeting': 0,
            'conditions': [{'type': 'exact', 'url': GOAL_ID}],
        }
    })
    g = created['goal']
    print(f'Цель создана: id={g["id"]} «{g["name"]}» → {GOAL_ID}')


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


COMMANDS = {'create-goal': create_goal, 'bounce': bounce}

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd not in COMMANDS:
        sys.exit(f'Использование: python3 {sys.argv[0]} ({"|".join(COMMANDS)})')
    COMMANDS[cmd]()
