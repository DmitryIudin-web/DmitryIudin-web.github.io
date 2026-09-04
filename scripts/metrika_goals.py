#!/usr/bin/env python3
"""Создаёт JS-цели Этапа 1 в Яндекс.Метрике 106049767 через API.

Закрывает пункт 1 из docs/owner-manual-steps.md, который иначе делается
руками в интерфейсе Метрики.

    python3 scripts/metrika_goals.py --dry-run   # показать, что будет сделано
    python3 scripts/metrika_goals.py             # создать недостающие цели

Токен берётся из переменной окружения METRIKA_OAUTH_TOKEN. Получить:
oauth.yandex.ru -> создать приложение с правами «Яндекс.Метрика: получение
статистики» и «Яндекс.Метрика: управление счётчиками» -> выпустить токен.
Токен в репозиторий не коммитить и никому не пересылать.

Запускать с машины, у которой есть сеть до api-metrika.yandex.net. Облачные
окружения Claude Code этот домен не пропускают (403 на CONNECT), поэтому
скрипт рассчитан на запуск с компьютера владельца.

Скрипт идемпотентен: существующие цели не трогает и не дублирует, поэтому
повторный запуск безопасен.
"""
import json
import os
import sys
import urllib.error
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
                 '  Linux/macOS: METRIKA_OAUTH_TOKEN=... python3 scripts/metrika_goals.py\n'
                 '  Windows:     set METRIKA_OAUTH_TOKEN=... && python scripts/metrika_goals.py')
    return t


def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header('Authorization', 'OAuth ' + token())
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        if e.code in (401, 403):
            sys.exit('API вернул %d — токен недействителен или у него нет прав\n'
                     'на управление счётчиками.\n%s' % (e.code, body))
        sys.exit('API вернул %d на %s %s\n%s' % (e.code, method, path, body))
    except urllib.error.URLError as e:
        sys.exit('Не достучались до %s: %s\n'
                 'Если это отказ на CONNECT — сеть окружения закрывает домен.\n'
                 'Запускайте скрипт со своего компьютера.' % (API, e.reason))


def existing_event_ids(goals):
    ids = set()
    for g in goals:
        for cond in g.get('conditions') or []:
            if cond.get('url'):
                ids.add(cond['url'])
    return ids


def main():
    dry = '--dry-run' in sys.argv[1:]

    if dry:
        print('Режим проверки: запросов к API не будет.')
        print('Счётчик: %d\nБудут созданы недостающие цели из списка:' % COUNTER)
        for event_id, name in GOALS:
            print('  %-20s %s' % (event_id, name))
        print('\nПример тела запроса POST /management/v1/counter/%d/goals:' % COUNTER)
        print(json.dumps({'goal': {
            'name': GOALS[0][1], 'type': 'action', 'is_retargeting': 0,
            'conditions': [{'type': 'exact', 'url': GOALS[0][0]}]}},
            ensure_ascii=False, indent=2))
        return 0

    have = existing_event_ids(
        call('GET', '/management/v1/counter/%d/goals' % COUNTER).get('goals', []))

    created = skipped = 0
    for event_id, name in GOALS:
        if event_id in have:
            print('уже есть:  %-20s' % event_id)
            skipped += 1
            continue
        g = call('POST', '/management/v1/counter/%d/goals' % COUNTER, {'goal': {
            'name': name,
            'type': 'action',
            'is_retargeting': 0,
            'conditions': [{'type': 'exact', 'url': event_id}],
        }})['goal']
        print('создана:   %-20s id=%s «%s»' % (event_id, g['id'], g['name']))
        created += 1

    print('\nИтого: создано %d, уже было %d.' % (created, skipped))
    if created:
        print('Данные появятся в отчётах после первых визитов — при условии,\n'
              'что рантайм подключён в Tilda (пункт 2 в docs/owner-manual-steps.md).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
