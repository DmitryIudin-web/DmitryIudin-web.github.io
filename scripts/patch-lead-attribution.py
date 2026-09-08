#!/usr/bin/env python3
"""Чинит атрибуцию заявок на страницах снапшота.

Дефекты, найденные `scripts/verify-lead-intake.mjs`:

1. **Дубли заявок.** Формы либо не отправляли `request_id` вовсе (модельная
   страница Cullinan), либо генерировали новый идентификатор на каждую отправку
   (intent-лендинги, Tavendor). В обоих случаях приёмник не может отличить
   повторное нажатие «отправить» от новой заявки, и менеджер получает дубль.
   Патч делает `request_id` устойчивым: он привязан к подписи введённых данных и
   хранится на самой форме. Пока данные не изменились, повтор уходит с тем же
   идентификатором; после правки любого поля выдаётся новый.
2. **Потеря меток кампании.** Intent-лендинги не передавали `utm_content` и
   `utm_term` — внутри кампании нельзя было отличить одно объявление от другого.

Патчатся только страницы, где код отправки действительно выполняется. На 20
модельных страницах обработчик ищет форму внутри контейнера
`[data-ast-model-page=...]`, а форма лежит вне контейнера — код не выполняется
никогда, и вставка туда была бы мёртвой. Такие страницы помечаются
`inert-handler`: их заявка уходит не в приёмник, а в скрытую форму Tilda
(в снапшоте её нет, поэтому форма показывает «Форма не найдена»). Это отдельная
проблема; добавлением поля в неисполняемый код она не решается.

Скрипт идемпотентен и работает с байтами, сохраняя переводы строк файла
(в репозитории `* -text`, часть страниц — CRLF и минифицирована), поэтому диф
одной страницы — одна-три строки.

Запуск из корня репозитория:
    python3 scripts/patch-lead-attribution.py [--check]

`--check` ничего не пишет и возвращает 1, если остались непропатченные страницы.
Неоднозначный якорь (встретился не один раз) — не повод угадывать: файл
помечается SKIPPED, код возврата ненулевой.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEAD_ENDPOINT = b'max-page/order'
# Обработчик Cullinan ищет форму по всему документу — он реально выполняется.
DOCUMENT_BINDING = b'document.querySelector(\'[data-ast-model-lead-form="1"]\')'
# Здесь форма ищется внутри контейнера страницы, но лежит вне его: код мёртв.
ROOT_BINDING = b'root.querySelector("[data-ast-model-lead-form]")'

# Правило: (имя, маркер применённого патча, якорь, чем заменить якорь).
# Во всех случаях в области видимости есть `form` и `data` — проверено по коду.
RULES = [
    (
        'model_request_id',
        b'astReqId="model_"',
        b'var payload = Object.assign({}, analyticsPayload, {',
        b'var payload = Object.assign({}, analyticsPayload, {\n'
        b'        request_id: (function(){'
        b'var s=JSON.stringify(Array.from(data.entries()).filter(function(e){return e[0]!=="consent_timestamp";}));'
        b'if(form.dataset.astReqSig!==s){form.dataset.astReqSig=s;'
        b'form.dataset.astReqId="model_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);}'
        b'return form.dataset.astReqId;})(),',
    ),
    (
        'intent_request_id',
        b'astReqId = `intent-',
        b'      request_id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,',
        b'      request_id: (() => { const s = JSON.stringify(data);'
        b' if (form.dataset.astReqSig !== s) { form.dataset.astReqSig = s;'
        b' form.dataset.astReqId = `intent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }'
        b' return form.dataset.astReqId; })(),',
    ),
    (
        'intent_utm',
        b'utm_content',
        b'      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") || "",',
        b'      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") || "",\n'
        b'      utm_content: new URLSearchParams(window.location.search).get("utm_content") || "",\n'
        b'      utm_term: new URLSearchParams(window.location.search).get("utm_term") || "",',
    ),
    (
        'tavendor_request_id',
        b"astReqId='tavendor-",
        b"          request_id:'tavendor-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),",
        b'          request_id:(function(){var s=JSON.stringify(data);'
        b'if(form.dataset.astReqSig!==s){form.dataset.astReqSig=s;'
        b"form.dataset.astReqId='tavendor-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}"
        b'return form.dataset.astReqId;})(),',
    ),
]


def line_ending(data: bytes) -> bytes:
    return b'\r\n' if b'\r\n' in data else b'\n'


def patch_file(path: pathlib.Path, check_only: bool) -> str:
    """Возвращает статус: ok / patched / skipped / no-endpoint / inert-handler."""
    data = path.read_bytes()
    if LEAD_ENDPOINT not in data:
        # Форма на странице есть, но заявка никуда не отправляется — чинить нечего.
        return 'no-endpoint'
    if b'data-ast-model-lead-form' in data and DOCUMENT_BINDING not in data:
        return 'inert-handler' if ROOT_BINDING in data else 'skipped'

    nl = line_ending(data)
    changed = False
    for _name, mark, anchor, replacement in RULES:
        if anchor not in data:
            continue
        if data.count(anchor) != 1:
            return 'skipped'
        if mark in data:
            continue  # правило уже применено к этому файлу
        data = data.replace(anchor, replacement.replace(b'\n', nl), 1)
        changed = True

    if changed and not check_only:
        path.write_bytes(data)
    return 'patched' if changed else 'ok'


def main() -> int:
    check_only = '--check' in sys.argv[1:]
    counts = {k: [] for k in ('ok', 'patched', 'skipped', 'no-endpoint', 'inert-handler')}

    for path in sorted(ROOT.glob('*/index.html')):
        raw = path.read_bytes()
        if not any(m in raw for m in (b'data-ast-model-lead-form', b'data-intent-form', b'tavendor-form')):
            continue
        counts[patch_file(path, check_only)].append(str(path.relative_to(ROOT)))

    verb = 'требуют правки' if check_only else 'исправлено'
    print(f'уже в порядке: {len(counts["ok"])}, {verb}: {len(counts["patched"])}, '
          f'обработчик не выполняется: {len(counts["inert-handler"])}, '
          f'без эндпоинта: {len(counts["no-endpoint"])}, пропущено: {len(counts["skipped"])}')
    for status, label in (('patched', '  ' + verb + ': '),
                          ('inert-handler', '  обработчик не привязан к форме, заявка идёт в форму Tilda: '),
                          ('no-endpoint', '  без эндпоинта (форма никуда не отправляется): '),
                          ('skipped', '  SKIPPED (якорь не найден или неоднозначен): ')):
        for name in counts[status]:
            print(label + name)

    if counts['skipped']:
        return 1
    return 1 if (check_only and counts['patched']) else 0


if __name__ == '__main__':
    raise SystemExit(main())
