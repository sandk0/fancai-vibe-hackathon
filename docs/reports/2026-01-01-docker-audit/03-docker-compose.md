# Анализ docker-compose файлов

**Дата:** 1 января 2026

## Обзор

Найдено **12 docker-compose файлов**. Это избыточно и создаёт путаницу.

---

## Основные файлы

### 1. docker-compose.yml

**Назначение:** Основной файл разработки (устаревший)
**Сервисы:** 7 (postgres, redis, xray-proxy, backend, celery-worker, celery-beat, frontend)

**КРИТИЧЕСКИЕ ПРОБЛЕМЫ:**
1. Содержит устаревшую NLP конфигурацию
2. Volumes для NLP моделей: `nlp_nltk_data`, `nlp_stanza_models`, `nlp_huggingface_cache`
3. xray-proxy больше не требуется (Gemini работает напрямую)
4. Высокое потребление памяти: ~7.5 GB

**Статус:** УДАЛИТЬ

---

### 2. docker-compose.lite.yml (ЭТАЛОН)

**Назначение:** Разработка с LangExtract (Gemini API)
**Сервисы:** 6 (postgres, redis, backend, celery-worker, celery-beat, frontend)

**Характеристики:**
- Использует `Dockerfile.lite`
- Оптимизирован по памяти: ~5.5 GB
- Правильные переменные: `USE_LANGEXTRACT_PRIMARY=true`
- Нет NLP volumes

**Ресурсы:**
| Сервис | Memory Limit | CPU |
|--------|--------------|-----|
| Backend | 1536M | 2.0 |
| Celery Worker | 1G | 1.0 |
| Celery Beat | 256M | 0.3 |
| Frontend | 1G | 1.0 |
| PostgreSQL | 1G | 1.0 |
| Redis | 512M | 0.5 |

**Статус:** ОСТАВИТЬ (ЭТАЛОН)

---

### 3. docker-compose.dev.yml

**Назначение:** Расширение для dev инструментов (pgAdmin, redis-cli)
**Сервисы:** Extends от docker-compose.yml + pgAdmin, redis-cli

**КРИТИЧЕСКИЕ ПРОБЛЕМЫ:**
1. Наследует от устаревшего docker-compose.yml
2. Frontend port 3000 (должен быть 5173 для Vite)

**Статус:** УДАЛИТЬ

---

### 4. docker-compose.override.yml

**Назначение:** Локальные переопределения для macOS
**Характеристики:**
- `delegated` mode для volumes (производительность macOS)
- DEBUG logging
- Expose портов postgres/redis для локальных инструментов

**Статус:** ОСТАВИТЬ

---

## Production/Staging файлы

### 5. docker-compose.production.yml

**Назначение:** Production с NLP (устаревший)
**Сервисы:** 9 (+ nginx, logrotate, watchtower)

**КРИТИЧЕСКИЕ ПРОБЛЕМЫ:**
1. Содержит NLP volumes и конфигурацию
2. Backend требует 4 GB RAM
3. Нет GOOGLE_API_KEY конфигурации

**Статус:** УДАЛИТЬ

---

### 6. docker-compose.lite.prod.yml (ЭТАЛОН)

**Назначение:** Production с LangExtract
**Сервисы:** 6 (postgres, redis, nginx, backend, celery-worker, celery-beat, frontend)

**Характеристики:**
- Использует `Dockerfile.lite.prod`
- Оптимизирован: ~3 GB RAM
- Nginx reverse proxy
- Правильная LangExtract конфигурация

**Статус:** ОСТАВИТЬ (ЭТАЛОН для production)

---

### 7. docker-compose.staging.yml

**Назначение:** Staging для 4GB/2CPU сервера
**Характеристики:** Оптимизирован для слабого железа

**ПРОБЛЕМЫ:**
1. Всё ещё использует NLP volumes
2. Не соответствует LangExtract архитектуре

**Статус:** ПЕРЕДЕЛАТЬ (использовать lite.prod как основу)

---

## SSL файлы

### 8. docker-compose.ssl.yml

**Назначение:** Certbot для получения SSL
**Сервисы:** certbot, certbot-renew

**ПРОБЛЕМЫ:**
1. Нет `--keep-until-expiring` флага (риск rate limit)
2. Нет restart policy для certbot

**Статус:** ИСПРАВИТЬ

---

### 9. docker-compose.dev-ssl.yml

**Назначение:** Dev с HTTPS
**Сервисы:** nginx + extends от dev.yml

**ПРОБЛЕМЫ:**
1. CORS: `Access-Control-Allow-Origin: *` (слишком открыто)
2. Слабые SSL ciphers
3. Нет HSTS заголовка

**Статус:** ИСПРАВИТЬ

---

### 10. docker-compose.temp-ssl.yml

**Назначение:** Временный nginx для ACME challenge
**Сервисы:** nginx-temp

**ПРОБЛЕМЫ:**
1. Сетевой конфликт (`bookreader-network` vs `bookreader_network`)
2. Можно забыть остановить, конфликт порта 80

**Статус:** УДАЛИТЬ (заменить скриптом)

---

## Вспомогательные файлы

### 11. docker-compose.monitoring.yml

**Назначение:** Grafana + Prometheus + Loki стек
**Сервисы:** 6 (grafana, prometheus, node-exporter, cadvisor, loki, promtail)

**ПРОБЛЕМЫ:**
1. `prom/prometheus:latest` - плавающая версия
2. Нет healthchecks
3. Нет resource limits
4. `apparmor=unconfined` в cadvisor

**Статус:** ИСПРАВИТЬ

---

### 12. docker-compose.vless-proxy.yml

**Назначение:** VLESS прокси для обхода региональных ограничений
**Сервисы:** vless-proxy, backend (override)

**КРИТИЧЕСКИЕ ПРОБЛЕМЫ:**
1. Сетевой конфликт: создаёт `backend-network` вместо `bookreader_network`
2. Дублирует функционал `xray-proxy` из основного compose
3. Неофициальный образ `samuelhbne/proxy-xray`
4. Теряет depends_on при override backend

**Статус:** УДАЛИТЬ

---

## Сравнительная таблица

| Файл | NLP | Актуален | RAM | Статус |
|------|-----|----------|-----|--------|
| `docker-compose.yml` | Да | Нет | 7.5G | УДАЛИТЬ |
| `docker-compose.lite.yml` | Нет | Да | 5.5G | ЭТАЛОН |
| `docker-compose.dev.yml` | Да | Нет | - | УДАЛИТЬ |
| `docker-compose.override.yml` | - | Да | - | ОСТАВИТЬ |
| `docker-compose.production.yml` | Да | Нет | 8G+ | УДАЛИТЬ |
| `docker-compose.lite.prod.yml` | Нет | Да | 3G | ЭТАЛОН |
| `docker-compose.staging.yml` | Да | Нет | 3.5G | ПЕРЕДЕЛАТЬ |
| `docker-compose.ssl.yml` | - | Да | - | ИСПРАВИТЬ |
| `docker-compose.dev-ssl.yml` | - | Да | - | ИСПРАВИТЬ |
| `docker-compose.temp-ssl.yml` | - | Нет | - | УДАЛИТЬ |
| `docker-compose.monitoring.yml` | - | Да | - | ИСПРАВИТЬ |
| `docker-compose.vless-proxy.yml` | - | Нет | - | УДАЛИТЬ |

---

## Рекомендуемая структура после унификации

```
docker-compose.lite.yml          # ОСНОВНОЙ для разработки
docker-compose.lite.prod.yml     # ОСНОВНОЙ для production
docker-compose.override.yml      # Локальные переопределения
docker-compose.ssl.yml           # Certbot (исправленный)
docker-compose.monitoring.yml    # Мониторинг (исправленный)

scripts/
└── init-ssl.sh                  # Заменяет temp-ssl.yml
```

**Удалить (5 файлов):**
- docker-compose.yml
- docker-compose.dev.yml
- docker-compose.production.yml
- docker-compose.temp-ssl.yml
- docker-compose.vless-proxy.yml
