# Pink Glass ♡

**Пять настраиваемых тем для Codex на Windows:** Sakura, Lavender, Moonlight, Peach и Mint.

Неофициальное оформление с эффектом стекла, фонами и редактором цветов. Плагин помогает устанавливать, включать, отключать и настраивать тему прямо из задачи Codex. Windows x64; Node.js включён в комплект.

**[Скачать плагин для Windows](https://github.com/omenamor/codex-pink-glass/releases/download/v0.10.33/PinkGlass-Plugin-0.10.33.zip)** · [Все выпуски](https://github.com/omenamor/codex-pink-glass/releases) · [Сообщить об ошибке](https://github.com/omenamor/codex-pink-glass/issues)

## Установка из каталога плагинов

В терминале с установленным Codex CLI выполните:

```powershell
codex plugin marketplace add omenamor/codex-pink-glass
codex plugin add pink-glass@pink-glass-community
```

Затем откройте **новую задачу** в Codex и напишите:

> Используй Pink Glass: установи и включи оформление.

Установщик проверит файлы и создаст на рабочем столе ярлык **Codex Pink Glass**. Если Codex открыт без подключения темы, завершите активные задачи, полностью закройте приложение и запустите этот ярлык. Плагин не закрывает Codex принудительно.

## Установка из архива

1. Скачайте архив по ссылке выше и полностью распакуйте его в постоянную папку.
2. Откройте эту папку как проект в Codex.
3. Напишите: **«Установи локальный плагин Pink Glass из этой папки, затем включи оформление»**.

В архиве находятся каталог `.agents/plugins/marketplace.json` и сам плагин `plugins/pink-glass`. Если устанавливаете вручную через терминал из распакованной папки:

```powershell
codex plugin marketplace add .
codex plugin add pink-glass@pink-glass-community
```

После установки откройте новую задачу и попросите включить Pink Glass. Не запускайте `.vbs` прямо внутри ZIP.

## Темы и управление

| Тема | Характер |
| --- | --- |
| Sakura | Розовое оформление |
| Lavender | Лавандовое оформление |
| Moonlight | Ночная тема |
| Peach | Персиковое оформление |
| Mint | Мятное оформление |

Примеры запросов:

- «Включи тему Moonlight в Pink Glass».
- «Открой настройки Pink Glass» — цвета, прозрачность, фон и размеры.
- «Проверь, включён ли Pink Glass».
- «Отключи Pink Glass».

Настройки профилей сохраняются. Обновление плагина не сбрасывает цвета и не перезаписывает файлы работающего оформления. Если прежняя версия ещё включена, завершите задачи и при следующем обычном запуске используйте обновлённый ярлык.

## Что нового в 0.10.33

Финальный выпуск текущей серии исправлений оформления.

- Единый тонкий контур поля ввода на главной странице и внутри задачи, без усиленной розовой рамки при фокусе.
- Исправлен стык поля ввода с плашкой выбора проекта: обводка продолжается по скруглённым углам.
- Кнопки обновления и скачивания, переключатели, флажки и ползунки согласованы с каждой из пяти палитр.
- Подписи меню и задач используют тёмный цвет текста в светлых темах и белый в Moonlight. Цвет кнопок больше не перекрашивает навигацию.
- Сохранены цвета статусов, предупреждений и счётчиков изменений, фоновые рисунки и настройки каждого профиля.

Также включены предыдущие исправления читаемости диалогов и сообщений, верхней панели, углов, служебных подписей и полного диапазона приглушения фона слева.

Проверки: 14 автоматических тестов пройдены, включая все пять тем и пользовательские цвета; установщик и 9 контрольных сумм пакета проверены.

## Все пять тем — 0.10.33

Реальные снимки стартового экрана Codex с Pink Glass 0.10.33. Для приватности названия проектов и задач, профиль и персональные подсказки заменены нейтральными подписями; аватар скрыт. Переписки на снимках нет.

### Sakura

Мягкая розовая палитра и цветущая сакура.

![Sakura — Pink Glass 0.10.33, личные данные скрыты](docs/screenshots/0.10.33/sakura.png)

### Lavender

Лавандовые оттенки и спокойный светлый фон.

![Lavender — Pink Glass 0.10.33, личные данные скрыты](docs/screenshots/0.10.33/lavender.png)

### Moonlight

Ночной фон, луна и белый текст меню.

![Moonlight — Pink Glass 0.10.33, личные данные скрыты](docs/screenshots/0.10.33/moonlight.png)

### Peach

Тёплая персиковая палитра.

![Peach — Pink Glass 0.10.33, личные данные скрыты](docs/screenshots/0.10.33/peach.png)

### Mint

Свежая мятная палитра с зелёными акцентами.

![Mint — Pink Glass 0.10.33, личные данные скрыты](docs/screenshots/0.10.33/mint.png)

## Как это работает

Pink Glass добавляет стили и редактор через локальное отладочное подключение `127.0.0.1:9337`. Файлы установленного Codex не изменяются. Это не официальный API тем и не продукт OpenAI. Веб-версия ChatGPT, macOS и Linux этой сборкой не поддерживаются.

Ключи API и внешние сервисы не нужны. Отладочное подключение доступно локальным программам, пока Codex полностью не закрыт. Будущие обновления Codex могут потребовать адаптации оформления.

## Отключение и удаление

Попросите Codex отключить Pink Glass. Также можно полностью закрыть Codex и открыть его обычным ярлыком. Удаление плагина из списка само по себе не останавливает уже запущенный коннектор. После отключения можно удалить плагин и ярлык. Настройки темы сохраняются в профиле Codex.

## English

Pink Glass is an unofficial Windows x64 appearance plugin for Codex, with five customizable themes: Sakura, Lavender, Moonlight, Peach and Mint. Install the marketplace and plugin with the commands above, start a new Codex task, and ask it to install and enable Pink Glass. If a restart is required, finish your tasks, fully quit Codex, then use the **Codex Pink Glass** desktop shortcut. Node.js is bundled. Version 0.10.33 completes the current visual polish pass: consistent composer outlines and rail corners, theme-aware controls, dark sidebar labels in light themes and white labels in Moonlight. The gallery shows all five themes in Codex with personal labels replaced and the avatar hidden. Saved theme settings are preserved. It does not support the ChatGPT website, macOS or Linux.

## License

Original Pink Glass code is available under the [MIT License](LICENSE). Bundled Node.js and its dependencies retain their own notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). OpenAI, Codex and ChatGPT names and marks belong to their respective owners; this project is not affiliated with or endorsed by OpenAI.
