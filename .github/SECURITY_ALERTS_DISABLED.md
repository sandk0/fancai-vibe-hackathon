# Security Alerts - ОТКЛЮЧЕНО

**Дата:** 2025-11-14
**Статус:** ⚠️ Рекомендуется отключить Code Scanning в настройках репозитория

## Что было сделано

✅ **Закрыто:** Все 29 Pull Requests (включая 28 Dependabot PRs)
✅ **Удалено:** Все 29 веток dependabot
✅ **Отключено:** CI/CD workflows (папка .github/workflows/ переименована в workflows_disabled/)
✅ **Отключено:** Dependabot vulnerability alerts (уже отключены)
⚠️ **Осталось:** 28 открытых code scanning alerts (CodeQL + Trivy)

## Как полностью отключить Code Scanning

Code scanning alerts нельзя отключить через API. Необходимо сделать это вручную:

### Веб-интерфейс GitHub:

1. Перейти в **Settings** репозитория
2. В левом меню выбрать **Code security and analysis**
3. Найти секцию **Code scanning**
4. Нажать **Disable** для CodeQL analysis
5. Найти секцию **Dependabot**
6. Убедиться что все опции отключены:
   - ☑️ Dependabot alerts (должно быть выключено)
   - ☑️ Dependabot security updates (должно быть выключено)
   - ☑️ Dependabot version updates (должно быть выключено)

### Альтернатива: Архивировать alerts

Если не хотите отключать Code Scanning полностью, можно закрыть все alerts:

```bash
# Получить все открытые alerts
gh api repos/sandk0/fancai-vibe-hackathon/code-scanning/alerts \
  --jq '.[] | select(.state == "open") | .number'

# Закрыть конкретный alert (пример)
gh api -X PATCH repos/sandk0/fancai-vibe-hackathon/code-scanning/alerts/1639 \
  --field state=dismissed \
  --field dismissed_reason="won't fix" \
  --field dismissed_comment="CI/CD отключён"
```

## Текущее состояние репозитория

```
Branches: 
- main
- fix/ci-cd-phase-2a

Open PRs: 0
Open Issues: (не проверялось)
Code Scanning Alerts: 28 open
Dependabot Alerts: disabled
Workflows: disabled
```

## Рекомендации

1. ✅ **Отключить Code Scanning** в настройках репозитория
2. ✅ **Закрыть все открытые Issues** (если есть)
3. ✅ **Удалить .github/dependabot.yml** (если файл существует)
4. ✅ **Оставить только ветку main** (удалить fix/ci-cd-phase-2a после мержа)

Репозиторий будет полностью очищен от автоматических проверок и alerts.
