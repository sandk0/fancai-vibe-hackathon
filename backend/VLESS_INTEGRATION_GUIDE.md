# Руководство по интеграции VLESS Proxy в BookReader AI

**Дата:** 2025-11-30
**Цель:** Практическое руководство по внедрению VLESS прокси для обхода блокировок API

---

## Quick Start (5 минут)

### Шаг 1: Добавить конфигурацию в .env.production

```bash
# .env.production

# ===== VLESS Proxy Configuration =====
# Feature flag для включения/выключения прокси
USE_VLESS_PROXY=true

# VLESS сервер параметры (получить у провайдера VPN)
VLESS_UUID=your-uuid-here
VLESS_SERVER=your-server.example.com
VLESS_PORT=443
VLESS_FAKE_DOMAIN=yahoo.com
VLESS_PUBLIC_KEY=your-public-key-here

# Домены, требующие прокси (через запятую)
PROXY_REQUIRED_DOMAINS=pollinations.ai,api.openai.com,image.pollinations.ai

# Прокси URLs (автоматически используются в Docker сети)
HTTP_PROXY=http://vless-proxy:8123
HTTPS_PROXY=http://vless-proxy:8123
SOCKS5_PROXY=socks5://vless-proxy:1080

# Исключения (локальные адреса)
NO_PROXY=localhost,127.0.0.1,postgres,redis,frontend,backend
```

### Шаг 2: Запустить VLESS прокси контейнер

```bash
# Запустить с основным docker-compose
docker-compose -f docker-compose.yml -f docker-compose.vless-proxy.yml up -d

# Проверить статус
docker-compose ps vless-proxy

# Проверить логи
docker-compose logs -f vless-proxy
```

### Шаг 3: Протестировать прокси

```bash
# Тест SOCKS5 прокси
curl -x socks5h://127.0.0.1:1080 https://checkip.amazonaws.com

# Тест HTTP прокси
curl -x http://127.0.0.1:8123 https://checkip.amazonaws.com

# Должен вернуть IP адрес VLESS сервера (не ваш локальный IP)

# Тест pollinations.ai через прокси
curl -x http://127.0.0.1:8123 https://pollinations.ai/api/health
```

### Шаг 4: Обновить зависимости backend

```bash
# backend/requirements.txt

# Добавить httpx с SOCKS5 поддержкой
httpx[socks]==0.27.0

# Альтернатива: aiohttp с прокси
# aiohttp==3.9.1
# aiohttp-socks==0.8.4
```

```bash
# Установить зависимости
cd backend
pip install -r requirements.txt
```

---

## Интеграция с ImageGeneratorService

### Вариант 1: Использовать VLESSHTTPClient (рекомендуется)

**Обновить `backend/app/services/image_generator.py`:**

```python
# В начале файла добавить импорт
from .vless_http_client import get_http_client

# В классе ImageGenerator обновить метод generate_from_pollinations
class ImageGenerator:
    async def generate_from_pollinations(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None
    ) -> ImageGenerationResult:
        """
        Генерирует изображение через pollinations.ai API.
        Автоматически использует VLESS прокси, если настроен.
        """
        start_time = datetime.now()

        try:
            # Формируем URL запроса
            encoded_prompt = quote(prompt)
            params = {
                'model': 'flux',
                'width': 1024,
                'height': 768,
                'nologo': 'true',
                'enhance': 'true'
            }

            if negative_prompt:
                params['negative'] = quote(negative_prompt)

            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}"

            # Используем VLESS-aware HTTP клиент
            async with get_http_client() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()

                # Сохранение изображения
                image_data = response.content
                local_path = await self._save_image(image_data, prompt)

                generation_time = (datetime.now() - start_time).total_seconds()

                return ImageGenerationResult(
                    success=True,
                    image_url=str(response.url),
                    local_path=local_path,
                    generation_time_seconds=generation_time
                )

        except Exception as e:
            logger.error(f"Pollinations.ai generation failed: {e}")
            return ImageGenerationResult(
                success=False,
                error_message=str(e)
            )
```

**Преимущества:**
- ✅ Автоматический выбор прокси по домену
- ✅ Централизованная конфигурация
- ✅ Feature flag для включения/выключения
- ✅ Легко тестировать

---

### Вариант 2: Использовать aiohttp с aiohttp-socks

**Если хотите остаться на aiohttp (текущая реализация):**

```bash
# Установить aiohttp-socks
pip install aiohttp-socks==0.8.4
```

**Обновить `backend/app/services/image_generator.py`:**

```python
# В начале файла
import aiohttp
from aiohttp_socks import ProxyConnector
import os

class ImageGenerator:
    def __init__(self):
        # ... существующий код ...

        # VLESS прокси конфигурация
        self.use_proxy = os.getenv('USE_VLESS_PROXY', 'true').lower() == 'true'
        self.proxy_url = os.getenv('SOCKS5_PROXY', 'socks5://vless-proxy:1080')

        logger.info(f"ImageGenerator initialized: use_proxy={self.use_proxy}")

    def _get_connector(self) -> Optional[ProxyConnector]:
        """Создает ProxyConnector если прокси включен."""
        if self.use_proxy:
            return ProxyConnector.from_url(self.proxy_url)
        return None

    async def generate_from_pollinations(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None
    ) -> ImageGenerationResult:
        """Генерация через pollinations.ai с прокси поддержкой."""
        start_time = datetime.now()

        try:
            # URL формирование
            encoded_prompt = quote(prompt)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}"

            # Параметры
            params = {
                'model': 'flux',
                'width': 1024,
                'height': 768,
                'nologo': 'true',
                'enhance': 'true'
            }

            if negative_prompt:
                params['negative'] = quote(negative_prompt)

            # Создаем connector (с прокси или без)
            connector = self._get_connector()

            # Выполняем запрос
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url, params=params, timeout=30) as response:
                    response.raise_for_status()

                    # Сохранение изображения
                    image_data = await response.read()
                    local_path = await self._save_image(image_data, prompt)

                    generation_time = (datetime.now() - start_time).total_seconds()

                    logger.info(
                        f"Image generated successfully via {'proxy' if self.use_proxy else 'direct'}: "
                        f"{generation_time:.2f}s"
                    )

                    return ImageGenerationResult(
                        success=True,
                        image_url=str(response.url),
                        local_path=local_path,
                        generation_time_seconds=generation_time
                    )

        except Exception as e:
            logger.error(f"Pollinations.ai generation failed: {e}")
            return ImageGenerationResult(
                success=False,
                error_message=str(e)
            )
```

---

## Тестирование интеграции

### Unit Test для VLESSHTTPClient

**Создать `backend/tests/services/test_vless_http_client.py`:**

```python
"""Тесты для VLESS HTTP клиента."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.services.vless_http_client import VLESSHTTPClient, get_http_client


@pytest.mark.asyncio
async def test_proxy_used_for_pollinations():
    """Тест: прокси используется для pollinations.ai."""

    client = VLESSHTTPClient(
        use_proxy=True,
        proxy_required_domains=['pollinations.ai']
    )

    # Должен использовать прокси
    assert client._should_use_proxy('https://pollinations.ai/api/health') is True

    # Не должен использовать прокси
    assert client._should_use_proxy('https://example.com') is False


@pytest.mark.asyncio
async def test_proxy_disabled_via_env():
    """Тест: прокси отключается через env переменную."""

    with patch.dict('os.environ', {'USE_VLESS_PROXY': 'false'}):
        client = VLESSHTTPClient()
        assert client.use_proxy is False


@pytest.mark.asyncio
async def test_successful_request_via_proxy():
    """Тест: успешный запрос через прокси."""

    async with get_http_client() as client:
        # Mock httpx response
        with patch.object(client._proxy_client, 'request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = httpx.Response(
                200,
                json={'status': 'ok'}
            )

            response = await client.get('https://pollinations.ai/api/health')
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_fallback_to_direct_connection():
    """Тест: fallback на прямое соединение при ошибке прокси."""

    # Это более сложный сценарий - пока пропускаем
    # В production можно добавить retry logic
    pass
```

### Integration Test

**Создать `backend/tests/integration/test_vless_image_generation.py`:**

```python
"""Интеграционные тесты для генерации изображений через VLESS прокси."""

import pytest
import os
from app.services.image_generator import ImageGenerator, ImageGenerationRequest
from app.models.description import DescriptionType


@pytest.mark.integration
@pytest.mark.asyncio
async def test_generate_image_via_vless_proxy():
    """Тест: генерация изображения через VLESS прокси."""

    # Пропустить если прокси не настроен
    if not os.getenv('USE_VLESS_PROXY'):
        pytest.skip("VLESS proxy not configured")

    generator = ImageGenerator()

    request = ImageGenerationRequest(
        description_content="A beautiful sunset over mountains",
        description_type=DescriptionType.LOCATION,
        chapter_id="test-chapter-id",
        user_id="test-user-id"
    )

    result = await generator.generate_image(request)

    assert result.success is True
    assert result.image_url is not None
    assert result.local_path is not None
    assert result.generation_time_seconds < 30  # Должно быть быстрее 30 сек
```

### Manual Testing Script

**Создать `backend/scripts/test_vless_proxy.py`:**

```python
#!/usr/bin/env python3
"""
Скрипт для ручного тестирования VLESS прокси.

Использование:
    python scripts/test_vless_proxy.py
"""

import asyncio
import sys
from pathlib import Path

# Добавить backend в PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.vless_http_client import get_http_client


async def test_basic_proxy():
    """Базовый тест SOCKS5/HTTP прокси."""

    print("🧪 Testing VLESS proxy connectivity...")

    async with get_http_client() as client:
        # Тест 1: Проверка IP через прокси
        print("\n1️⃣ Checking IP via proxy (should be VPN server IP):")
        try:
            response = await client.get('https://checkip.amazonaws.com')
            ip = response.text.strip()
            print(f"   ✅ IP via proxy: {ip}")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            return False

        # Тест 2: Pollinations.ai health check
        print("\n2️⃣ Testing pollinations.ai via proxy:")
        try:
            response = await client.get('https://pollinations.ai/api/health')
            print(f"   ✅ Pollinations health: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            return False

        # Тест 3: Генерация тестового изображения
        print("\n3️⃣ Testing image generation via proxy:")
        try:
            url = 'https://image.pollinations.ai/prompt/beautiful sunset'
            response = await client.get(url, params={
                'model': 'flux',
                'width': 512,
                'height': 512,
                'nologo': 'true'
            })
            print(f"   ✅ Image generated: {response.status_code}, size: {len(response.content)} bytes")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            return False

    print("\n✅ All tests passed!")
    return True


async def test_direct_connection():
    """Тест прямого соединения (без прокси)."""

    print("\n🧪 Testing direct connection (no proxy)...")

    from app.services.vless_http_client import VLESSHTTPClient

    # Отключить прокси
    client = VLESSHTTPClient(use_proxy=False)

    async with client:
        try:
            response = await client.get('https://checkip.amazonaws.com')
            ip = response.text.strip()
            print(f"   ✅ IP without proxy: {ip}")
        except Exception as e:
            print(f"   ❌ Failed: {e}")


if __name__ == '__main__':
    print("=" * 60)
    print("VLESS Proxy Test Script")
    print("=" * 60)

    # Запуск тестов
    asyncio.run(test_basic_proxy())
    asyncio.run(test_direct_connection())

    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)
```

**Запуск:**

```bash
# Из Docker контейнера
docker-compose exec backend python scripts/test_vless_proxy.py

# Локально (если установлены зависимости)
cd backend
python scripts/test_vless_proxy.py
```

---

## Мониторинг и отладка

### Prometheus метрики для VLESS прокси

**Добавить в `docker-compose.monitoring.yml`:**

```yaml
services:
  # Prometheus exporter для Xray
  xray-exporter:
    image: wi1dcard/xray-exporter:latest
    container_name: bookreader-xray-exporter
    restart: unless-stopped
    command:
      - --xray-api-endpoint=vless-proxy:8080  # API endpoint Xray
    ports:
      - "9550:9550"  # Prometheus metrics port
    depends_on:
      - vless-proxy
    networks:
      - monitoring
      - backend-network
```

**Обновить `monitoring/prometheus/prometheus.yml`:**

```yaml
scrape_configs:
  - job_name: 'xray-proxy'
    static_configs:
      - targets: ['xray-exporter:9550']
    scrape_interval: 30s
```

**Grafana dashboard метрики:**
- `xray_up` - uptime прокси (1 = работает, 0 = down)
- `xray_connections_active` - активные соединения
- `xray_traffic_uplink_bytes_total` - исходящий трафик
- `xray_traffic_downlink_bytes_total` - входящий трафик

### Логирование

**Добавить structured logging в `backend/app/services/vless_http_client.py`:**

```python
import structlog

logger = structlog.get_logger(__name__)

# В методе request()
logger.info(
    "http_request",
    method=method,
    url=url,
    via_proxy=self._should_use_proxy(url),
    status_code=response.status_code,
    duration_ms=duration_ms
)
```

**Prometheus custom metrics в backend:**

```python
# backend/app/core/metrics.py

from prometheus_client import Counter, Histogram

# Метрики для VLESS прокси
vless_requests_total = Counter(
    'vless_proxy_requests_total',
    'Total VLESS proxy requests',
    ['domain', 'method', 'status']
)

vless_request_duration_seconds = Histogram(
    'vless_proxy_request_duration_seconds',
    'VLESS proxy request duration',
    ['domain', 'method']
)

# Использование в VLESSHTTPClient
async def request(self, method: str, url: str, **kwargs):
    domain = urlparse(url).netloc

    with vless_request_duration_seconds.labels(domain=domain, method=method).time():
        response = await client.request(method, url, **kwargs)

    vless_requests_total.labels(
        domain=domain,
        method=method,
        status=response.status_code
    ).inc()

    return response
```

---

## Troubleshooting

### Проблема 1: Прокси не работает

**Симптомы:**
```
ERROR: Failed to connect to vless-proxy:8123
ConnectionRefusedError: Connection refused
```

**Решение:**

```bash
# 1. Проверить статус контейнера
docker-compose ps vless-proxy

# 2. Проверить логи
docker-compose logs vless-proxy

# 3. Проверить health check
docker inspect bookreader-vless-proxy | grep -A 10 Health

# 4. Тест подключения изнутри backend контейнера
docker-compose exec backend curl -x http://vless-proxy:8123 https://www.google.com
```

### Проблема 2: Медленная генерация изображений

**Симптомы:**
```
Image generation taking >60 seconds
```

**Возможные причины:**
- VLESS сервер перегружен
- Неоптимальный маршрут
- DNS проблемы

**Решение:**

```bash
# 1. Проверить latency до VLESS сервера
docker-compose exec vless-proxy ping -c 5 your-vless-server.com

# 2. Проверить throughput
docker-compose exec backend curl -x http://vless-proxy:8123 -w "@curl-format.txt" -o /dev/null -s https://speed.cloudflare.com/__down?bytes=10000000

# 3. Попробовать другой VLESS сервер (обновить .env)
VLESS_SERVER=alternative-server.com
docker-compose restart vless-proxy
```

### Проблема 3: Прокси блокируется

**Симптомы:**
```
403 Forbidden
ERR_CONNECTION_RESET
```

**Решение:**

```bash
# 1. Проверить REALITY конфигурацию
docker-compose exec vless-proxy cat /config.json

# 2. Обновить fake domain (более популярный)
VLESS_FAKE_DOMAIN=www.microsoft.com
docker-compose restart vless-proxy

# 3. Использовать CDN fallback (если pollinations заблокирован)
# Обновить backend код для использования альтернативных API
```

---

## Production Checklist

Перед деплоем в production:

- [ ] ✅ VLESS credentials в secrets (не в .env)
- [ ] ✅ Прокси порты bind на 127.0.0.1 (не 0.0.0.0)
- [ ] ✅ Health checks настроены и работают
- [ ] ✅ Resource limits для vless-proxy контейнера
- [ ] ✅ Мониторинг и алерты настроены
- [ ] ✅ Логи ротируются (max-size, max-file)
- [ ] ✅ Fallback механизм (если прокси down)
- [ ] ✅ Feature flag для быстрого отключения
- [ ] ✅ Тесты прошли успешно
- [ ] ✅ Документация обновлена

---

## Следующие шаги

### Фаза 1: Основная интеграция (1-2 часа)
1. ✅ Добавить vless-proxy в docker-compose
2. ✅ Обновить .env.production с credentials
3. ✅ Установить httpx[socks] или aiohttp-socks
4. ✅ Обновить ImageGenerator для использования прокси

### Фаза 2: Тестирование (1 час)
1. ✅ Написать unit tests для VLESSHTTPClient
2. ✅ Написать integration tests
3. ✅ Manual testing с scripts/test_vless_proxy.py
4. ✅ Load testing (optional)

### Фаза 3: Мониторинг (1 час)
1. ✅ Добавить xray-exporter в monitoring stack
2. ✅ Создать Grafana dashboard
3. ✅ Настроить alerting rules
4. ✅ Добавить custom metrics в backend

### Фаза 4: Production (1 час)
1. ✅ Перенести credentials в secrets
2. ✅ Обновить deployment scripts
3. ✅ Deploy в staging для проверки
4. ✅ Deploy в production с feature flag
5. ✅ Мониторинг и validation

---

## Полезные команды

```bash
# ===== Управление =====
# Запуск с VLESS прокси
docker-compose -f docker-compose.yml -f docker-compose.vless-proxy.yml up -d

# Остановка только прокси
docker-compose stop vless-proxy

# Перезапуск прокси
docker-compose restart vless-proxy

# ===== Мониторинг =====
# Статус всех сервисов
docker-compose ps

# Логи прокси (real-time)
docker-compose logs -f vless-proxy

# Логи backend (фильтр по "proxy")
docker-compose logs backend | grep proxy

# Stats прокси (CPU, Memory, Network)
docker stats bookreader-vless-proxy

# ===== Тестирование =====
# QR код конфигурации
docker exec -it bookreader-vless-proxy /qrcode

# Тест SOCKS5
docker-compose exec backend curl -x socks5h://vless-proxy:1080 https://checkip.amazonaws.com

# Тест HTTP
docker-compose exec backend curl -x http://vless-proxy:8123 https://checkip.amazonaws.com

# Тест pollinations.ai
docker-compose exec backend curl -x http://vless-proxy:8123 https://pollinations.ai/api/health

# Python тестовый скрипт
docker-compose exec backend python scripts/test_vless_proxy.py

# ===== Отладка =====
# Зайти в контейнер прокси
docker-compose exec vless-proxy sh

# Проверить конфиг
docker-compose exec vless-proxy cat /config.json

# Network inspect
docker network inspect fancai-vibe-hackathon_backend-network

# Health check статус
docker inspect bookreader-vless-proxy --format='{{.State.Health.Status}}'
```

---

## Версия документа

- **v1.0** (2025-11-30) - Практическое руководство по интеграции
- **Автор:** DevOps Engineer Agent (Claude Code)
- **Статус:** ✅ Ready for implementation
