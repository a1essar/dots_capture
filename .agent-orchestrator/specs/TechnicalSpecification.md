## Техническая спецификация — Contours (Web)

Основано на `projects/ContoursV2/specs/GameDesignSpecification.md`. Документ описывает техническую реализацию UI/роутинга, PixiJS-рендера и модульной архитектуры приложения.

---

## 1) Экраны, роутинг, структура и детали каждого экрана

### 1.1 Роутинг (React Router)

- **`/`** — стартовый экран (главное меню)
- **`/match`** — экран выбора параметров матча
- **`/game`** — игровой экран
- **`/result`** — экран результата (после окончания партии)
- **`/settings`** — настройки

#### 1.1.1 Навигационные правила

- **Единый источник истины состояния** — `GameState` + `UISettings`.
- Вход на `/game` возможен только при наличии валидных параметров матча (из `/match`) или при `Rematch`.
  - Если `GameState` отсутствует/битый (например, прямой переход по URL) — редирект на `/match`.
- Вход на `/result` возможен только если `GameState.status === "finished"`. Иначе редирект на `/game`.
- `/settings` доступен всегда, изменения применяются:
  - к текущей партии (визуальные параметры, анимации, подсветки),
  - и сохраняются в localStorage для следующего запуска.

#### 1.1.2 Состояния и переходы

- `Start Game` на `/match`:
  - создаёт новый `GameState` (пустая доска, `currentPlayer = 1`, `score = {1:0,2:0}`),
  - навигация на `/game`.
- `Back to Menu`:
  - из `/match`, `/game`, `/result` ведёт на `/` и очищает текущее состояние партии (но не настройки UI).
- `Restart` на `/game`:
  - сбрасывает текущую партию к начальному состоянию с теми же параметрами `GameSettings`.
- `Surrender`:
  - завершает игру: `status = "finished"`, `winner = opponent`,
  - навигация на `/result`.
- `Rematch` на `/result`:
  - создаёт новую партию с теми же `GameSettings`,
  - навигация на `/game`.

---

### 1.2 Экран `/` — Стартовый экран

#### Цель
Быстро выбрать режим и перейти к настройке матча или в настройки приложения.

#### Структура
- **Header**: название игры, краткий подзаголовок.
- **Primary actions**:
  - `Player vs Player` → `/match?mode=PVP`
  - `Player vs Computer` → `/match?mode=PVC`
- **Secondary action**:
  - `Settings` → `/settings`

#### Состояния
- Доступен всегда.
- Если есть незавершённая партия в памяти (не обязательно) — можно показывать “Continue” (опционально; по умолчанию не реализуем, чтобы не усложнять).

---

### 1.3 Экран `/match` — Выбор параметров матча

#### Входные параметры
- Query param `mode`: `PVP | PVC`. Если отсутствует — дефолт `PVP`.

#### Структура
- **Top bar**: `Back` (на `/`), заголовок (“New Match”).
- **Form**:
  - Размер поля (preset):
    - `20×20`
    - `30×20`
    - `40×30`
  - Цвет игрока 1 (выбор из палитры + превью)
  - Цвет игрока 2 / бота (выбор из палитры + превью)
  - Если `mode=PVC`:
    - Сложность бота: `easy | medium | hard`
- **CTA**:
  - `Start Game` (disabled, если цвета одинаковые или невалидная комбинация)

#### Валидации
- Цвета игроков должны отличаться.
- Размер поля — только из пресетов (в рамках текущей спеки).
- Для PVC — `botDifficulty` обязателен.

#### Выход
- Создание `GameSettings` и навигация на `/game`.

---

### 1.4 Экран `/game` — Игровой экран

#### Основная идея UI
Игровой canvas — главный фокус. Остальные элементы не должны мешать полю на мобильных.

#### Структура
- **App top bar** (фиксированная):
  - `Back to Menu`
  - Название матча: `PVP`/`PVC`, размер `WxH`
- **Status panel**:
  - Счёт: `P1 : P2`
  - Индикатор текущего хода (цвет игрока + текст “Player 1 turn / Player 2 turn / Bot thinking…”)
  - (Опционально) last move: `(x, y)`
- **Game canvas area**:
  - PixiJS рендер сетки, точек, захваченных точек, территории, подсветок
- **Action bar** (доступна с клавиатуры/тача):
  - `Surrender`
  - `Restart`

#### UX детали
- **Ход**: тап/клик по пересечению ставит точку, если ход валиден.
- **Подсветка возможного хода**:
  - при наведении мышью или при “tap-hold” на мобильном показывать ближайшее пересечение, которое будет выбрано при отпускании.
- **Состояние “бот думает”** (PVC):
  - блокируем ввод пользователя
  - показываем индикатор (в статус-панели) и/или полупрозрачный overlay над canvas.
- **Предотвращение мискликов**:
  - увеличенная hit-area для пересечений (см. раздел 3).

#### Ошибки/кейсы
- Попытка поставить точку на занятое/территорию: без изменения состояния, лёгкий “shake” индикатора или короткая подсветка красным (анимации можно отключить в настройках).

---

### 1.5 Экран `/result` — Результат

#### Условия входа
Только `GameState.status === "finished"`.

#### Структура
- Заголовок: `Winner: Player 1` / `Winner: Player 2` / `Draw`
- Итоговый счёт
- Кнопки:
  - `Rematch` → `/game` (с новым `GameState` по тем же `GameSettings`)
  - `Back to Menu` → `/`

---

### 1.6 Экран `/settings` — Настройки

#### Настройки из GDS
- `Animations` (on/off)
- `Highlight potential capture` (on/off)
- `Point size` (число, UI-слайдер)
- `Line thickness` (число, UI-слайдер)

#### Дополнительные (технически необходимые) настройки UI (без расширения геймплея)
- `Reduced motion` (уважать системный `prefers-reduced-motion`, но оставить переключатель)
- `Canvas quality` (Auto / Low / High) — влияет на `resolution` Pixi (опционально; можно скрыть без требований)

#### Сохранение
- В `localStorage` (ключ, например, `contours.uiSettings.v1`).
- Применение “live” к текущему рендеру (без перезапуска игры).

---

## 2) UI дизайн и Tailwind-верстка

### 2.1 Дизайн-система (минимальная)

#### Цвета
- **Background**: нейтральный тёмный или светлый (выбирается темой проекта; по умолчанию — тёмный для контраста с цветами игроков).
- **Surface**: панели и карточки (меню, настройки).
- **Accent**: цвет активного игрока в индикаторах.
- **Semantic**:
  - success/warn/error для подсказок/валидаций.

> Примечание: конкретные значения цветов игроков берутся из настроек матча. Для UI поверхностей используем стабильную палитру (Tailwind).

#### Типографика
- Заголовки: `text-2xl/3xl` для главных экранов.
- Основной текст: `text-sm`/`text-base`.
- Моно для координат (опционально): `font-mono`.

#### Компоненты
- `Button` (primary/secondary/danger)
- `Card` (для блоков меню/настроек)
- `SegmentedControl` (режим, сложность, размеры)
- `ColorPicker` (палитра + выбранный цвет)
- `Slider` (point size, line thickness)
- `Toggle` (animations, highlight)

---

### 2.2 Layout и адаптивность

#### Общие принципы
- Максимальная ширина контента: `max-w-3xl` (меню/настройки), с `mx-auto`.
- На `/game` canvas занимает максимум доступного пространства, панели компактны.
- Учитывать safe-area на iOS: использовать `env(safe-area-inset-*)` через Tailwind utility (или inline style на контейнере) для padding.

#### Desktop
- `/game`: top bar + status row сверху, canvas в центре, action bar снизу или справа (в зависимости от ширины).

#### Mobile
- `/game`: top bar компактный, статус в одну строку, action bar закреплён снизу, canvas — между ними.
- Избегать вертикального скролла во время игры: контейнер `h-dvh` (с fallback на `min-h-screen`).

---

### 2.3 Tailwind-скелеты экранов (структурно)

> Ниже не “код для вставки”, а точная структура классов и блоков для верстки.

#### `/` Start
- Root: `min-h-dvh bg-slate-950 text-slate-50 flex items-center`
- Card: `w-full max-w-md mx-auto p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow`
- Buttons stack: `mt-6 grid gap-3`

#### `/match`
- Root: `min-h-dvh bg-slate-950 text-slate-50`
- Content: `max-w-3xl mx-auto p-4 sm:p-6`
- Form sections: `grid gap-6`
- Presets: `grid grid-cols-3 gap-2` (на mobile `grid-cols-1`)
- CTA: `mt-8 flex gap-3`

#### `/game`
- Root: `h-dvh bg-slate-950 text-slate-50 flex flex-col`
- Top bar: `shrink-0 h-12 px-3 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur`
- Status: `shrink-0 px-3 py-2 flex items-center justify-between gap-3`
- Canvas wrapper: `flex-1 min-h-0 px-2 pb-2`
- Canvas container: `w-full h-full rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden`
- Action bar: `shrink-0 p-3 grid grid-cols-3 gap-2 border-t border-slate-800 bg-slate-950/80 backdrop-blur`

#### `/result`
- Root: `min-h-dvh bg-slate-950 text-slate-50 flex items-center`
- Card: `w-full max-w-lg mx-auto p-6 rounded-2xl bg-slate-900/60 border border-slate-800`
- Buttons: `mt-6 flex flex-col sm:flex-row gap-3`

#### `/settings`
- Root: `min-h-dvh bg-slate-950 text-slate-50`
- Content: `max-w-3xl mx-auto p-4 sm:p-6 grid gap-6`
- Setting row: `flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800`

---

## 3) Canvas (PixiJS): рендер, размеры, mobile и touch

### 3.1 PixiJS сцена и слои

#### Stage composition (контейнеры)
- `root`
  - `camera` (контейнер, на который применяется масштаб/смещение; по умолчанию без зума/пана)
    - `gridLayer` — линии сетки (опционально: рисовать лёгкие линии или точки сетки)
    - `territoryLayer` — полу-прозрачная заливка “территории” (на пересечениях)
    - `pointsLayer` — активные и захваченные точки
    - `hoverLayer` — подсветка выбора (курсор/тач)
    - `effectsLayer` — короткие анимации (если включены)

#### Рендер-оптимизация
- Для множества однотипных объектов (точки, territory-markers) предпочтительно:
  - предгенерировать текстуры (круг/круг с крестом/круг “captured”/ромб территории),
  - использовать `ParticleContainer` или обычный `Container` со `Sprite` (KISS; если будет тормозить на больших полях — перейти на `ParticleContainer`).
- `gridLayer`:
  - не рисовать каждую линию как отдельный `Graphics` объект.
  - вариант KISS: рисовать “точки сетки” маленькими спрайтами или один `Graphics` с батчем линий.

---

### 3.2 Геометрия: mapping сетки в пиксели

#### Термины
- `W`, `H` — размеры сетки в пересечениях.
- `viewportWidthPx`, `viewportHeightPx` — размеры DOM контейнера canvas (CSS px).
- `dpr = devicePixelRatio` (ограничить сверху, например, 2 для производительности на мобилках).

#### Layout поля внутри контейнера
Поле вписывается с сохранением пропорций, с внутренним padding:
- `paddingPx = clamp(12, min(viewport)/30, 24)` (пример; точные числа фиксируются в реализации)
- Доступная область:
  - `availW = viewportWidthPx - 2*paddingPx`
  - `availH = viewportHeightPx - 2*paddingPx`

#### Шаг между пересечениями (grid step)
Чтобы все пересечения поместились:
- Кол-во интервалов по X: `(W - 1)`
- Кол-во интервалов по Y: `(H - 1)`
- `step = floor(min(availW / (W - 1), availH / (H - 1)))`
  - `step` не должен быть меньше минимума для тача, например `minStep = 12` (если меньше — включить “режим компактного рендера”: уменьшить толщины/точки, но step оставить; зум не вводим без требования).

#### Размеры поля в пикселях
- `boardPxW = step * (W - 1)`
- `boardPxH = step * (H - 1)`
- `originX = floor((viewportWidthPx - boardPxW) / 2)`
- `originY = floor((viewportHeightPx - boardPxH) / 2)`

#### Преобразование координат
Из координаты пересечения `(x, y)` в пиксели:
- `px = originX + x * step`
- `py = originY + y * step`

Из пикселей в ближайшее пересечение:
- `x = round((px - originX) / step)`
- `y = round((py - originY) / step)`
- Затем clamp в диапазоны:
  - `x = clamp(x, 0, W-1)`
  - `y = clamp(y, 0, H-1)`

---

### 3.3 Размеры точек и линий (зависят от step и UI-настроек)

#### Базовые значения
- `pointRadius = clamp(step * pointSizeFactor, 3, step * 0.45)`
  - `pointSizeFactor` берётся из UI-настроек (`Point size`), в диапазоне, например, 0.18…0.35
- `lineThickness = clamp(step * lineThicknessFactor, 1, 6)`
  - фактор берётся из `Line thickness`

#### Captured-стили
- `capturedAlpha = 0.45`
- `capturedDecoration`: перечёркивание или “X” поверх точки (в виде отдельного спрайта/второй текстуры).

#### Territory-стили
Так как `territory` — это пересечения, а не “клетки”, визуализация делается как полупрозрачные маркеры на пересечениях:
- форма: ромб/квадрат 0.9*step или круг радиуса 0.45*step
- `territoryAlpha = 0.18…0.28`
- цвет — цвет владельца территории

Это соответствует правилу “нельзя ставить на захваченную территорию” и даёт видимую “заливку” без введения сущности клеток.

---

### 3.4 Hit-testing и touch/mouse input

#### Единая модель ввода
Использовать Pointer Events:
- `pointermove` — hover (desktop) / подсказка (если включено) / подготовка координаты
- `pointerdown` — начало взаимодействия
- `pointerup` — постановка точки (если не было “cancel”)

На мобильных:
- основной жест — **tap**:
  - на `pointerup` вычислить ближайшее пересечение и попытаться поставить точку
- дополнительный жест — **tap-hold** (опционально):
  - при удержании > 150–250ms показывать “прицел” (highlight) на ближайшем пересечении до отпускания

#### Увеличение зоны попадания
Даже если визуально точка маленькая, зона клика должна быть минимум:
- `hitRadiusPx = max(pointRadius, 16)` (на mobile можно `20`)
Алгоритм:
- вычислить ближайшее пересечение по `round`
- проверить расстояние от pointer до центра пересечения
  - если `dist <= hitRadiusPx` → принимаем
  - иначе — игнор (чтобы клик в пустоте не приводил к неожиданным ходам)

#### Блокировка взаимодействия
- Если ход не игрока (бот думает) или `status !== "playing"` — input handler не ставит точки.

---

### 3.5 Resize, DPR, ориентация, mobile viewport

#### Поддержка `ResizeObserver`
DOM контейнер canvas подписан на `ResizeObserver`:
- при изменении размеров:
  - пересчитать `viewportWidthPx/viewportHeightPx`
  - пересчитать `step`, `origin`, размеры текстур (если завязаны на step) и перерисовать/перелэйаутить спрайты

#### DPR и качество
Pixi renderer:
- `resolution = min(devicePixelRatio, maxDpr)` где `maxDpr` по умолчанию 2
- `autoDensity = true`

#### Mobile edge cases
- Использовать `h-dvh` на контейнере страницы `/game` (чтобы не ломаться при адресной строке браузера).
- На iOS учитывать safe-area:
  - добавлять padding контейнеру top bar / action bar.

---

### 3.6 Что именно рендерим по `GameState.board`

Источник данных: `board: Map<"x,y", CellState>`, где отсутствие ключа = `{ type: "empty" }`.

Рендер правила:
- `empty`:
  - ничего (только grid)
- `point`:
  - спрайт точки в цвет `owner`
  - если `captured: true`:
    - уменьшенная насыщенность/альфа
    - поверх декорация “captured” (X/strike)
- `territory`:
  - полу-прозрачный маркер в цвет `owner`

Подсветки:
- hover:
  - если пересечение свободно и не territory противника — показать ghost-точку полупрозрачно цветом текущего игрока
  - если ход невалиден — показать ghost красным/серым (в зависимости от настройки анимаций)
- potential capture highlight:
  - подсветка потенциально замыкаемых областей вычисляется через симуляцию в `core/` (переиспользуя `rules/` + `capture/`) и рисуется отдельным слоем (опционально, т.к. есть настройка on/off).

---

## 4) Модульная архитектура приложения и связи между модулями

Требование: core-логика не привязана к UI. UI и рендер — адаптеры.

### 4.1 Модули (папки/границы ответственности)

#### `core/` (чистая TypeScript-логика)
- **`model/`**
  - типы: `PlayerId`, `CellState`, `GameSettings`, `GameState`
  - утилиты ключа: `toKey(x,y) -> "x,y"`, `fromKey`
- **`rules/`**
  - `isMoveLegal(state, x, y) -> boolean` (занятость, territory противника)
  - `applyMove(state, x, y) -> GameState` (иммутабельно или через копии структуры; важно — детерминированно)
  - `endConditions(state) -> { finished: boolean, winner }`
- **`capture/`**
  - `computeCapturesAfterMove(state, lastMove) -> CaptureResult`
  - реализация flood-fill строго по GDS:
    - рассматриваем активные точки противника
    - flood-fill по 4-связным соседям
    - “стены” — только активные точки текущего игрока
    - проход через пустые, active opponent points, captured points, territory
    - достижение края => не захват
    - замкнуто => пометить точки captured и заполнить territory
- **`bot/`**
  - интерфейс `Bot { pickMove(state): {x,y} }`
  - реализации `easy`, `medium`, `hard` по GDS (симуляции используют `core/` правила)

Гарантии `core/`:
- Нет импорта из React/Pixi/DOM.
- Все функции детерминированы и покрываемы unit-тестами (вне рамок текущего запроса, но архитектурно подготовлено).

---

#### `app/` (композиция приложения)
- `router/` — конфиг роутов и guards (валидность переходов)
- `state/` — хранение `GameState` и `UISettings` (без внешних зависимостей по умолчанию):
  - `useReducer` + контексты `GameContext`, `UISettingsContext`
  - экшены: `NEW_MATCH`, `PLACE_POINT`, `RESTART`, `SURRENDER`, `FINISH`, `APPLY_SETTINGS`
- `controllers/`
  - `GameController`:
    - принимает input (x,y) от UI/renderer
    - проверяет `isMoveLegal`
    - применяет `applyMove` + `computeCapturesAfterMove`
    - переключает игрока, триггерит `endConditions`
    - если PVC и ход бота — запускает асинхронный `bot.pickMove` (с ограничением по времени для hard согласно GDS)

---

#### `ui/` (React компоненты, Tailwind)
- `screens/`: `StartScreen`, `MatchScreen`, `GameScreen`, `ResultScreen`, `SettingsScreen`
- `components/`: `Button`, `Card`, `Toggle`, `Slider`, `ColorPicker`, `ScoreBadge`, `TurnIndicator`
- `layout/`: `TopBar`, `ActionBar`, `PageContainer`

Правило: UI не содержит игровой логики захвата; максимум — отображение состояния и отправка намерений (intent) в контроллер.

---

#### `renderer/` (PixiJS адаптер)
- `PixiBoardView`:
  - инициализация Pixi Application в заданном DOM контейнере
  - создание слоёв
  - подписка на state updates (через props/контекст)
  - трансляция pointer событий в `GameController.placePoint(x,y)`
- `layout/`:
  - вычисление `step`, `origin`, размеров точек/линий по разделу 3
- `draw/`:
  - генерация текстур (точка, captured, territory-marker, hover)
  - отрисовка/обновление спрайтов по diff-у `board`

Важное: renderer не модифицирует `GameState`, только читает и рендерит.

---

#### `persistence/` (простая инфраструктура)
- `loadUISettings()` / `saveUISettings()`
- (Опционально в будущем) сохранение незавершённой партии; не требуется текущей спекой.

---

### 4.2 Связи между модулями (направление зависимостей)

- `ui/` → `app/state` (читает состояние), → `app/controllers` (посылает intent)
- `renderer/` → `app/controllers` (посылает intent) и → `app/state` (читает состояние)
- `app/controllers` → `core/` (вся логика)
- `core/bot` → `core/rules` + `core/capture` (симуляции)
- `persistence/` → `app/state` (инициализация настроек)

Запрещённые зависимости:
- `core/` не зависит от `ui/`, `renderer/`, `app/`.
- `renderer/` не зависит от `core/` напрямую (чтобы не дублировать правила и не размывать ответственность); все действия идут через controller.

---

### 4.3 Поток данных (event flow)

1. Пользователь кликает/тапает canvas
2. `renderer/` переводит пиксели → `(x,y)` (раздел 3.2) и вызывает `GameController.placePoint(x,y)`
3. `GameController`:
   - проверяет `isMoveLegal`
   - применяет `applyMove`
   - запускает `computeCapturesAfterMove`
   - обновляет счёт/territory/captured
   - проверяет `endConditions`
4. `app/state` публикует новый `GameState`
5. `ui/` обновляет статус/кнопки, `renderer/` обновляет визуализацию по новому `board`
6. Если PVC и следующий игрок — бот:
   - `GameController` переводит UI в состояние “bot thinking”
   - асинхронно получает ход бота и повторяет шаги 3–5

---

### 4.4 Примечания по соответствию правилам захвата (важно)

Вся механика захвата должна строго соответствовать GDS:
- flood-fill запускается от активных точек противника
- распространение **только по 4 направлениям**
- “стены” — **только активные** точки текущего игрока
- достигли края — область не захвачена
- замкнули область:
  - активные точки противника внутри → `captured: true` и дают очки только при переходе в captured в этот ход
  - пустые пересечения внутри → `territory` текущего игрока
- `territory` и `captured` точки не являются “стенами”
- захват засчитывается только если внутри есть хотя бы одна активная точка противника (иначе не начисляем territory “впустую”)

