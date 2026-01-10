# PWA E2E Tests

## Описание

Этот файл содержит E2E тесты для PWA (Progressive Web App) функционала приложения BookReader AI.

## Структура тестов

### 1. Manifest and Service Worker
- Проверка валидности web app manifest
- Регистрация Service Worker
- Активация Service Worker

### 2. Offline Mode
- Отображение app shell в offline режиме
- Offline indicator при потере сети
- Восстановление работы при возврате сети

### 3. Caching
- Кеширование статических ассетов
- Использование кешированных ассетов при повторной загрузке

### 4. iOS Support
- Определение iOS устройств
- Наличие apple-touch-icon
- Viewport meta для iOS

### 5. Update Prompt
- Проверка обновлений при загрузке
- Наличие компонента PWAUpdatePrompt

### 6. PWA Installation
- Поддержка beforeinstallprompt event
- Определение standalone режима

### 7. PWA Metadata
- Корректность meta тегов
- Наличие title

### 8. Cache Storage Management
- Механизм очистки кеша

### 9. Offline Functionality
- Работа без сети после первой загрузки

### 10. Performance
- Скорость загрузки из кеша

## Запуск тестов

### Все PWA тесты
```bash
npx playwright test tests/pwa.spec.ts
```

### Конкретная группа тестов
```bash
# Только тесты манифеста и Service Worker
npx playwright test tests/pwa.spec.ts -g "Manifest and Service Worker"

# Только тесты offline режима
npx playwright test tests/pwa.spec.ts -g "Offline Mode"

# Только тесты iOS
npx playwright test tests/pwa.spec.ts -g "iOS Support"
```

### Конкретный браузер
```bash
# Только Chrome
npx playwright test tests/pwa.spec.ts --project=chromium

# Только Firefox
npx playwright test tests/pwa.spec.ts --project=firefox

# Только Safari
npx playwright test tests/pwa.spec.ts --project=webkit

# Только Mobile Safari (iOS)
npx playwright test tests/pwa.spec.ts --project="Mobile Safari"
```

### Debug режим
```bash
# С UI режимом
npx playwright test tests/pwa.spec.ts --ui

# С headed режимом (видимый браузер)
npx playwright test tests/pwa.spec.ts --headed

# Debug конкретного теста
npx playwright test tests/pwa.spec.ts -g "должен иметь валидный web app manifest" --debug
```

### Генерация отчета
```bash
# Запуск тестов с генерацией отчета
npx playwright test tests/pwa.spec.ts

# Открыть отчет после запуска
npx playwright show-report
```

## Требования

1. Приложение должно быть запущено на `http://localhost:5173` (dev) или `http://localhost:4173` (preview)
2. Service Worker должен быть зарегистрирован
3. Manifest.json должен быть доступен по адресу `/manifest.json`

## Важные замечания

### Service Worker
- Service Worker может не работать в некоторых браузерах без HTTPS
- В dev режиме Vite PWA Plugin поддерживает SW через localhost

### Offline тесты
- Требуют предварительной загрузки страницы для кеширования
- Используют `context.setOffline(true/false)` для эмуляции offline

### iOS тесты
- Эмулируют iOS User-Agent для проверки iOS-специфичного поведения
- Реальная установка PWA на iOS возможна только через Safari на физическом устройстве

### Cache тесты
- Проверяют наличие Cache Storage API
- Могут создавать временные кеши для тестирования

## Покрытие

Тесты покрывают:
- ✅ Базовые PWA требования (manifest, service worker)
- ✅ Offline функциональность
- ✅ Кеширование
- ✅ iOS поддержка
- ✅ Механизм обновлений
- ✅ Установка PWA
- ✅ Метаданные
- ✅ Performance

## Статистика

- **Общее количество тестов:** 20
- **Количество групп:** 10
- **Браузеры:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Общее количество запусков:** 100 (20 тестов × 5 браузеров)

## CI/CD

Тесты можно интегрировать в CI/CD pipeline:

```yaml
# Пример для GitHub Actions
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run PWA Tests
  run: npx playwright test tests/pwa.spec.ts

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Service Worker не регистрируется
- Проверьте что приложение запущено через localhost или HTTPS
- Убедитесь что VitePWA plugin настроен корректно в vite.config.ts

### Offline тесты падают
- Убедитесь что Service Worker успел активироваться (добавьте `waitForTimeout`)
- Проверьте стратегию кеширования в Service Worker

### iOS тесты не проходят
- Проверьте наличие apple-touch-icon в public/
- Убедитесь что viewport meta установлен в index.html
