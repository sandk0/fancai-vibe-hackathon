Запусти comprehensive benchmark Multi-NLP системы и создай отчет.

ЗАДАЧА:
1. Загрузи тестовую книгу (если есть в базе, иначе используй sample)
2. Запусти все processing modes:
   - SINGLE (SpaCy)
   - PARALLEL (все процессоры)
   - ENSEMBLE (voting)
   - ADAPTIVE (автоматический выбор)
3. Для каждого режима измерь:
   - Processing time (seconds)
   - Memory usage (MB)
   - Descriptions count
   - Quality score (>70% target)
   - F1 score (if available)
4. Сравни с baseline (4 seconds, >70% quality)
5. Создай comprehensive report в `docs/reports/nlp-benchmark-{date}.md`
6. Обнови `docs/development/performance/nlp-benchmarks.md` с новыми результатами

ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
```markdown
# Multi-NLP Benchmark Report - {date}

## Test Configuration
- Book: {title} ({chapters} chapters)
- Environment: {production/staging/local}
- Processors: SpaCy, Natasha, Stanza

## Results Summary

| Mode | Time (s) | Memory (MB) | Descriptions | Quality (%) | F1 Score |
|------|----------|-------------|--------------|-------------|----------|
| SINGLE | X.XX | XXX | XXXX | XX.X% | 0.XX |
| PARALLEL | X.XX | XXX | XXXX | XX.X% | 0.XX |
| ENSEMBLE | X.XX | XXX | XXXX | XX.X% | 0.XX |
| ADAPTIVE | X.XX | XXX | XXXX | XX.X% | 0.XX |

## Baseline Comparison
- Target: 4s, >70% quality
- Status: PASS/FAIL
- Improvement: +X% speed, +X% quality

## Recommendations
- {recommendations}
```

АГЕНТЫ:
- Multi-NLP System Expert (для запуска benchmark)
- Analytics Specialist (для анализа метрик)
- Documentation Master (для создания отчета)
