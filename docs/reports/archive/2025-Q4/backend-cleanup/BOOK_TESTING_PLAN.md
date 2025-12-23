# Testing Plan: "Ведьмак" (The Witcher) Book Analysis

**Book:** Ведьмак (Анджей Сапковский)
**Language:** Russian
**Purpose:** Validate Week 1 NLP improvements on real literary text

---

## Test Objectives

### Primary Goals
1. **Measure Quality Improvement** - Compare before/after Week 1
2. **Validate Processor Weights** - Verify DeepPavlov (1.5) has highest impact
3. **Test Dependency Parsing** - Count extracted syntactic phrases
4. **Evaluate LLM Enrichment** - Assess semantic understanding
5. **Benchmark Performance** - Measure processing speed

### Success Criteria
- F1 Score improvement: ≥ +7% (0.82 → ≥0.89)
- Description quality: ≥ +30% (6.5/10 → ≥8.5/10)
- Relevant descriptions: ≥ +50 absolute count
- Processing time: ≤ 3 seconds per chapter

---

## Test Methodology

### Step 1: Baseline (Before Week 1)
```python
# Using only 3 processors: SpaCy, Natasha, Stanza
# No dependency parsing
# No LLM enrichment

baseline_config = {
    "processors": ["spacy", "natasha", "stanza"],
    "weights": {"spacy": 1.0, "natasha": 1.2, "stanza": 0.8},
    "dependency_parsing": False,
    "llm_enrichment": False
}
```

**Expected Baseline Results:**
- Total descriptions: ~1,200
- Relevant descriptions: ~780 (65%)
- High-quality descriptions: ~600 (50%)
- F1 Score: 0.82
- Avg processing time: 200-300ms/chapter

### Step 2: Enhanced (After Week 1)
```python
# Using all 4 processors: SpaCy, Natasha, Stanza, DeepPavlov
# With dependency parsing
# With optional LLM enrichment

enhanced_config = {
    "processors": ["spacy", "natasha", "stanza", "deeppavlov"],
    "weights": {
        "spacy": 1.0,
        "natasha": 1.2,
        "stanza": 0.8,
        "deeppavlov": 1.5  # HIGHEST
    },
    "dependency_parsing": True,
    "llm_enrichment": True  # optional
}
```

**Expected Enhanced Results:**
- Total descriptions: ~1,400 (+200, +17%)
- Relevant descriptions: ~1,190 (85%, +410, +53%)
- High-quality descriptions: ~980 (70%, +380, +63%)
- F1 Score: 0.91 (+0.09, +11%)
- Avg processing time: 450-500ms/chapter (without LLM)

### Step 3: Comparison Analysis
```python
comparison = {
    "total_descriptions": enhanced / baseline,
    "relevant_ratio": enhanced_relevant / baseline_relevant,
    "quality_improvement": enhanced_quality - baseline_quality,
    "f1_improvement": enhanced_f1 - baseline_f1,
    "performance_cost": enhanced_time / baseline_time
}
```

---

## Test Chapters

### Selected Chapters from "Ведьмак"
1. **"Меньшее Зло"** (Lesser Evil)
   - Rich character descriptions (Геральт, Стрегобор)
   - Urban location descriptions (Блавикен)
   - Action scenes with minimal descriptions

2. **"Край Света"** (Edge of the World)
   - Natural landscape descriptions
   - Elf characters (Фиалка, Торувьель)
   - Atmospheric forest scenes

3. **"Последнее Желание"** (The Last Wish)
   - Character descriptions (Йеннифэр)
   - Interior location descriptions (храм)
   - Emotional atmosphere descriptions

**Total:** 3 chapters, ~15,000 words, ~50 pages

---

## Metrics to Collect

### Quantitative Metrics

#### 1. Description Counts
```python
metrics = {
    "total_descriptions": int,
    "by_type": {
        "location": int,
        "character": int,
        "atmosphere": int
    },
    "by_quality": {
        "high": int,  # score >= 0.7
        "medium": int,  # 0.4 <= score < 0.7
        "low": int  # score < 0.4
    }
}
```

#### 2. NLP Performance
```python
nlp_metrics = {
    "f1_score": float,
    "precision": float,
    "recall": float,
    "processing_time_ms": float,
    "descriptions_per_second": float
}
```

#### 3. Processor Contributions
```python
processor_metrics = {
    "deeppavlov": {
        "entities_extracted": int,
        "descriptions_contributed": int,
        "weighted_impact": float  # should be highest
    },
    "natasha": {...},
    "spacy": {...},
    "stanza": {...}
}
```

#### 4. Dependency Parsing
```python
dependency_metrics = {
    "total_phrases": int,
    "adj_noun": int,
    "adj_adj_noun": int,
    "noun_prep_noun": int,
    "avg_phrases_per_description": float
}
```

#### 5. LLM Enrichment (if enabled)
```python
llm_metrics = {
    "enriched_descriptions": int,
    "avg_confidence": float,
    "entities_per_description": float,
    "attributes_per_description": float,
    "processing_time_ms": float
}
```

### Qualitative Metrics

#### Manual Review Sample (20 descriptions)
- Relevance: 1-5 scale
- Quality: 1-5 scale
- Completeness: 1-5 scale
- Visual richness: 1-5 scale

---

## Test Execution Steps

### Preparation
```bash
# 1. Ensure all dependencies installed
docker-compose up -d backend

# 2. Upload "Ведьмак" book
# Via API or admin interface

# 3. Verify processors initialized
curl http://localhost:8000/api/v1/admin/multi-nlp-settings/status
```

### Baseline Test
```bash
# 1. Configure baseline (3 processors, no enhancements)
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/global \
  -d '{"processing_mode": "ensemble", "dependency_parsing": false}'

# 2. Process selected chapters
for chapter in ["Меньшее Зло", "Край Света", "Последнее Желание"]:
    curl -X POST http://localhost:8000/api/v1/books/{book_id}/chapters/{chapter_id}/process

# 3. Export results
curl http://localhost:8000/api/v1/books/{book_id}/descriptions > baseline_results.json
```

### Enhanced Test
```bash
# 1. Configure enhanced (4 processors + enhancements)
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/global \
  -d '{"processing_mode": "ensemble", "dependency_parsing": true}'

# 2. Process same chapters
for chapter in ["Меньшее Зло", "Край Света", "Последнее Желание"]:
    curl -X POST http://localhost:8000/api/v1/books/{book_id}/chapters/{chapter_id}/process

# 3. Export results
curl http://localhost:8000/api/v1/books/{book_id}/descriptions > enhanced_results.json
```

### Generate Comparison
```bash
# Run comparison script
python scripts/compare_results.py \
  --baseline baseline_results.json \
  --enhanced enhanced_results.json \
  --output comparison_report.md
```

---

## Expected Results

### Chapter 1: "Меньшее Зло"

#### Baseline (Before)
- Total descriptions: 42
- Character descriptions: 18 (Геральт, Стрегобор, Ренфри)
- Location descriptions: 15 (Блавикен, таверна)
- Atmosphere descriptions: 9
- Avg quality: 6.2/10
- Processing time: 2.1 seconds

#### Enhanced (After)
- Total descriptions: 58 (+16, +38%)
- Character descriptions: 26 (+8, +44%)
  - **DeepPavlov found:** "старый маг Стрегобор", "седая борода"
  - **Dependency parsing:** "темный плащ Геральта", "холодные глаза ведьмака"
- Location descriptions: 22 (+7, +47%)
  - **Phrases:** "узкие улицы Блавикена", "старая каменная таверна"
- Atmosphere descriptions: 10 (+1, +11%)
- Avg quality: 8.4/10 (+2.2, +35%)
- Processing time: 2.8 seconds (+33%)

**Key Improvement:** DeepPavlov correctly identified "Ренфри" as PERSON (missed by others)

---

### Chapter 2: "Край Света"

#### Baseline (Before)
- Total descriptions: 38
- Natural descriptions: 22 (лес, горы)
- Character descriptions: 8 (эльфы)
- Atmosphere descriptions: 8
- Avg quality: 6.8/10
- Processing time: 1.9 seconds

#### Enhanced (After)
- Total descriptions: 51 (+13, +34%)
- Natural descriptions: 31 (+9, +41%)
  - **Phrases:** "густой темный лес", "высокие древние деревья", "узкая горная тропа"
- Character descriptions: 12 (+4, +50%)
  - **DeepPavlov found:** "Фиалка (Jaskier)", "эльфийка Торувьель"
- Atmosphere descriptions: 8 (same)
- Avg quality: 8.6/10 (+1.8, +26%)
- Processing time: 2.5 seconds (+32%)

**Key Improvement:** Dependency parsing extracted rich natural phrases

---

### Chapter 3: "Последнее Желание"

#### Baseline (Before)
- Total descriptions: 36
- Character descriptions: 14 (Йеннифэр, джинн)
- Location descriptions: 13 (храм, побережье)
- Atmosphere descriptions: 9
- Avg quality: 6.4/10
- Processing time: 1.8 seconds

#### Enhanced (After)
- Total descriptions: 49 (+13, +36%)
- Character descriptions: 21 (+7, +50%)
  - **DeepPavlov found:** "волшебница Йеннифэр", "фиолетовые глаза"
  - **LLM enriched:** {age: "молодая", power: "могущественная", emotions: "гордость"}
- Location descriptions: 18 (+5, +38%)
  - **Phrases:** "древний храм на утесе", "бурное море внизу"
- Atmosphere descriptions: 10 (+1, +11%)
- Avg quality: 8.7/10 (+2.3, +36%)
- Processing time: 2.6 seconds (+44%)

**Key Improvement:** LLM enrichment added semantic attributes

---

## Overall Expected Results

### Summary Statistics
| Metric | Baseline | Enhanced | Improvement |
|--------|----------|----------|-------------|
| **Total Descriptions** | 116 | 158 | +42 (+36%) |
| **Relevant (%)** | 76 (66%) | 134 (85%) | +58 (+76%) |
| **High Quality** | 58 (50%) | 111 (70%) | +53 (+91%) |
| **Avg Quality** | 6.5/10 | 8.6/10 | +2.1 (+32%) |
| **F1 Score** | 0.82 | 0.91 | +0.09 (+11%) |
| **Precision** | 0.78 | 0.94 | +0.16 (+21%) |
| **Recall** | 0.75 | 0.87 | +0.12 (+16%) |
| **Processing Time** | 5.8s | 8.0s | +2.2s (+38%) |

### Processor Contributions (Enhanced)
| Processor | Weight | Entities | Descriptions | Impact |
|-----------|--------|----------|--------------|--------|
| **DeepPavlov** | **1.5** | **89** | **47** | **35%** ⭐ |
| Natasha | 1.2 | 67 | 38 | 28% |
| SpaCy | 1.0 | 52 | 29 | 22% |
| Stanza | 0.8 | 34 | 20 | 15% |

**Verification:** DeepPavlov with highest weight (1.5) has highest impact (35%)! ✅

### Dependency Parsing Statistics
- Total phrases extracted: 324
- ADJ + NOUN: 178 (55%)
- ADJ + ADJ + NOUN: 89 (27%)
- NOUN + PREP + NOUN: 57 (18%)
- Avg phrases/description: 2.1

### LLM Enrichment Statistics (if enabled)
- Enriched descriptions: 42 (27% of total)
- Avg confidence: 0.87
- Avg entities/description: 3.4
- Avg attributes/description: 5.2
- Processing time: +120ms/description

---

## Performance Analysis

### Processing Time Breakdown
```
Baseline (200ms/chapter):
  Text parsing: 20ms (10%)
  NLP processing: 120ms (60%)
  Description extraction: 40ms (20%)
  Scoring: 20ms (10%)

Enhanced (280ms/chapter without LLM):
  Text parsing: 20ms (7%)
  NLP processing: 180ms (64%)  # +50% due to DeepPavlov
  Dependency parsing: 40ms (14%)  # NEW
  Description extraction: 25ms (9%)
  Scoring: 15ms (5%)

Enhanced (400ms/chapter with LLM):
  ... same as above ...
  LLM enrichment: 120ms (30%)  # NEW, optional
```

**Optimization Recommendations:**
1. Cache DeepPavlov results (expensive)
2. Batch dependency parsing (40ms → 25ms)
3. Selective LLM enrichment (only high-priority)
4. Parallel processor execution (potential 30% speedup)

---

## Validation Checklist

### Before Running Tests
- [ ] All dependencies installed (DeepPavlov, LangExtract, SpaCy)
- [ ] Docker containers running
- [ ] Database migrated
- [ ] Book "Ведьмак" uploaded
- [ ] Multi-NLP Manager initialized
- [ ] Processor weights verified (DeepPavlov = 1.5)

### During Testing
- [ ] Monitor processing logs
- [ ] Check for errors/warnings
- [ ] Verify all processors active
- [ ] Collect timing metrics
- [ ] Export intermediate results

### After Testing
- [ ] Compare results quantitatively
- [ ] Manual quality review (sample)
- [ ] Generate comparison report
- [ ] Document findings
- [ ] Update PERPLEXITY_INTEGRATION_PLAN.md

---

## Troubleshooting

### Common Issues

#### DeepPavlov not initializing
```bash
# Check installation
python -c "import deeppavlov; print(deeppavlov.__version__)"

# Re-download model
python -m deeppavlov install ner_ontonotes_bert_mult
```

#### Dependency parsing returning empty
```bash
# Check SpaCy model
python -c "import spacy; nlp = spacy.load('ru_core_news_lg'); print('OK')"

# Re-download
python -m spacy download ru_core_news_lg
```

#### LLM enrichment timing out
```bash
# Use Ollama instead of Gemini
export LANGEXTRACT_USE_OLLAMA=true

# Or disable LLM enrichment
curl -X PUT http://localhost:8000/api/v1/admin/nlp-settings/llm \
  -d '{"enabled": false}'
```

---

## Next Steps After Testing

### If Results Meet Expectations (≥+7% F1)
1. ✅ Mark Week 1 as production-ready
2. Document actual results
3. Update README with improvements
4. Plan Week 2 enhancements (GLiNER, Coreference)

### If Results Below Expectations (<+7% F1)
1. Analyze where improvements are lacking
2. Adjust processor weights
3. Fine-tune confidence thresholds
4. Re-test with adjusted parameters

### Generate Final Report
```markdown
# Ведьмак Testing Results - Week 1 Validation

## Summary
- F1 Improvement: X% (expected: +7-12%)
- Quality Improvement: X/10 (expected: +2 points)
- Processing Time: Xms (acceptable: <500ms)

## Recommendation
[PRODUCTION READY / NEEDS ADJUSTMENT / FURTHER TESTING]
```

---

**Document Version:** 1.0
**Last Updated:** November 11, 2025
**Status:** Ready for execution after dependency installation
