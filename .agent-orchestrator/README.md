# Agent Orchestrator (v2)

Оркестратор по очереди запускает Dev- и QA-агентов (Cursor CLI): 
1) Dev агент получает задачу из `tasks.json` в статусе todo, реализует её, проверяет lint и build и в `tasks.json` задачи заполняет notes и при успехе меняет статус на ready to test и заканчивает сессию
2) QA агент получает задачу из `tasks.json` в статусе ready to test, делает ревью кода, пишет e2e тесты, но не меняет код; При наличии деффектов заполняет notes и меняет статус задачи на todo, при успехе меняет статус задачи на done

Все агенты так же заполняют в `context.json` полезную информацию для следущих агентов, чтобы не повторять одни и те же ошибки.

Цикл повторяется до завершения всех задач или достижения лимитов.

## Шаги
1) Сгенерировать спеки проекта или дизайн документ. Делать в несколько итераций включая ревью уточняя все спорные вопросы.
2) Сгенерировать пустой проект с Hello World на выбранном стеке, чтобы компиляция и тесты проходили без ошибок. Обязательно использовать e2e тесты.
3) Обновить ./prompts/*.md
4) Запустить скрипт оркестратора

## Требования

- **jq** — разбор и обновление JSON (`brew install jq`)
- **Cursor CLI** — [установка и аутентификация](https://cursor.com/docs/cli/installation)

## Структура

```
template/v1/
  orchestrator.js   # основной скрипт
  tasks.json        # список задач и статусы
  context.json      # общий контекст для агентов
  AgentsConfig.md   # роли Dev/QA, лимиты, команды
  prompts/
    dev.md          # шаблон промпта для Dev
    qa.md           # шаблон промпта для QA
  specs/            # спецификации к задачам
```

## Запуск

Оркестратор нужно запускать **из корня проекта приложения** (там, где лежат `package.json`, `src/` и т.д.).

### Пример: приложение в корне репозитория

```bash
cd /path/to/apps_factory
# здесь же package.json и код приложения
./template/v2/orchestrator.js
```

### Пример: приложение в подпапке

```bash
cd /path/to/apps_factory/apps/myapp
PROJECT_ROOT="$(pwd)" /path/to/apps_factory/template/v2/orchestrator.js
```

Или из корня монорепо, указав корень проекта:

```bash
cd /path/to/apps_factory
PROJECT_ROOT="$(pwd)/apps/myapp" ./template/v2/orchestrator.js
```

### Переменные окружения

| Переменная       | По умолчанию           | Описание |
|------------------|------------------------|----------|
| `PROJECT_ROOT`   | текущая директория     | Корень проекта (package.json, src/) |
| `MAX_ITERATIONS` | 50                     | Максимум итераций цикла Dev→QA |
| `MAX_RETRIES`    | 3                      | Макс. попыток на задачу (далее — blocked) |
| `AGENT_TIMEOUT`  | 300                    | Таймаут одного запуска агента (сек) |
| `MODEL`          | claude-4.5-sonnet      | Модель для Cursor CLI |

Пример с другими лимитами и моделью:

```bash
MAX_ITERATIONS=20 AGENT_TIMEOUT=600 MODEL=claude-4.6-opus ./template/v2/orchestrator.js
```

## Задачи и контекст

- **tasks.json** — массив `tasks`: у каждой задачи есть `id`, `title`, `description`, `spec`, `status` (`todo` → `in_progress` → `ready_to_test` → `in_test` → `done` или `blocked`), `dependencies`, `notes`, `retries`, `max_retries`. Оркестратор сам переключает статусы и считает ретраи.
- **context.json** — общий контекст: `project`, `tech_stack`, `completed_tasks`, `notes`, `known_issues`. Агенты читают и дополняют его.
- **AgentsConfig.md** — описание ролей Dev/QA, команд (lint, build, playwright) и ограничений для промптов.

Добавление новой задачи: в `tasks.json` в массив `tasks` добавить объект с полями `id`, `title`, `description`, `spec` (путь к файлу в `specs/`), `status: "todo"`, `priority`, `dependencies`, `notes`, `retries: 0`, `max_retries: 3`. Спеки класть в `specs/` (например, `specs/001-setup.md`).
