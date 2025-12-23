# GLiNER Installation Guide

**Quick start guide for installing and activating GLiNER processor**

---

## What is GLiNER?

GLiNER (Generalist and Lightweight Named Entity Recognition) is a zero-shot NER system that replaces DeepPavlov in our Multi-NLP pipeline.

**Why GLiNER:**
- ✅ No dependency conflicts (DeepPavlov incompatible)
- ✅ F1 Score: 0.90-0.95 (comparable to DeepPavlov's 0.94-0.97)
- ✅ Zero-shot learning (flexible entity types)
- ✅ Active maintenance (2024-2025)

---

## Installation

### Step 1: Install Package

```bash
cd backend
pip install gliner>=0.2.0
```

### Step 2: Verify Installation

```bash
python3 -c "import gliner; print('GLiNER installed successfully')"
```

Expected output: `GLiNER installed successfully`

---

## Testing

### Run Integration Tests

```bash
cd backend
python3 test_gliner_integration.py
```

**Expected output:**
```
============================================================
GLiNER Processor Integration Test Suite
============================================================

=== Test 1: GLiNER Installation ===
✅ GLiNER installed: version 0.2.x

=== Test 2: Processor Creation ===
✅ GLiNER processor created

=== Test 3: Model Loading ===
✅ Model loaded successfully
   Model: urchade/gliner_medium-v2.1
   Load time: 15-30s (first run, downloads model)

=== Test 4: Entity Extraction ===
✅ Entity extraction completed
   Extracted: 5-8 descriptions

=== Test 5: ProcessorRegistry Integration ===
✅ GLiNER integrated in ProcessorRegistry
   Available processors: ['spacy', 'natasha', 'gliner']

=== Test 6: Performance Benchmark ===
✅ Benchmark results:
   Average time: 2-3s
   Throughput: ~2000 chars/sec

============================================================
TEST SUMMARY
============================================================
✅ PASS - installation
✅ PASS - creation
✅ PASS - loading
✅ PASS - extraction
✅ PASS - registry

Total: 5/5 tests passed

🎉 All tests passed! GLiNER integration successful.
```

---

## First Run Notes

### Model Download (First Use Only)

On first use, GLiNER will download the transformer model:
- **Model:** urchade/gliner_medium-v2.1
- **Size:** ~500MB
- **Time:** 1-2 minutes (depends on connection)
- **Location:** `~/.cache/huggingface/`

**Subsequent runs:** Model loads from cache in <5 seconds.

---

## Verification

### Check Processor Status

```bash
# Start backend
docker-compose up -d backend

# Check logs for GLiNER initialization
docker-compose logs backend | grep GLiNER
```

**Expected log:**
```
✅ GLiNER processor initialized successfully (F1 0.90-0.95, zero-shot NER)
```

### API Verification

```bash
# Get processor status
curl -X GET http://localhost:8000/api/v1/admin/multi-nlp-settings/status
```

**Expected JSON response:**
```json
{
  "available_processors": ["spacy", "natasha", "gliner"],
  "processor_details": {
    "gliner": {
      "type": "gliner",
      "loaded": true,
      "available": true,
      "config": {
        "enabled": true,
        "weight": 1.0,
        "confidence_threshold": 0.3
      }
    }
  }
}
```

---

## Configuration

### Default Settings

GLiNER is **enabled by default** with these settings:

```python
{
    "enabled": True,
    "weight": 1.0,  # Balanced weight in ensemble voting
    "confidence_threshold": 0.3,
    "model_name": "urchade/gliner_medium-v2.1",
    "zero_shot_mode": True
}
```

### Update Settings (Admin API)

```bash
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/gliner \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "weight": 1.2,
    "confidence_threshold": 0.4
  }'
```

### Model Selection

Choose based on your needs:

| Model | Command | Size | F1 | Use Case |
|-------|---------|------|----|----|
| Small | `model_name: gliner_small-v2.1` | 200MB | 0.88 | Testing/Dev |
| **Medium** | `model_name: gliner_medium-v2.1` | 500MB | 0.92 | **Production** |
| Large | `model_name: gliner_large-v2.1` | 1.2GB | 0.95 | Max Quality |

---

## Troubleshooting

### Issue: "Module not found: gliner"

**Solution:**
```bash
pip install gliner>=0.2.0
```

### Issue: Model download fails

**Solution:**
```bash
# Manual download
python3 -c "from gliner import GLiNER; GLiNER.from_pretrained('urchade/gliner_medium-v2.1')"
```

### Issue: Out of memory

**Solution:** Use smaller model:
```bash
# Update settings to use small model
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/gliner \
  -d '{"model_name": "urchade/gliner_small-v2.1"}'
```

### Issue: GLiNER not in processor list

**Check:**
1. GLiNER installed? `python3 -c "import gliner"`
2. Settings enabled? Check `/api/v1/admin/multi-nlp-settings/gliner`
3. Backend restarted? `docker-compose restart backend`

---

## Performance Expectations

### Quality Improvement

**Before GLiNER (3 processors):**
- F1 Score: ~0.82
- Quality: 3.8/10
- Relevant descriptions: ~60-65%

**After GLiNER (4 processors):**
- F1 Score: ~0.92 (+10%)
- Quality: 7.0/10 (+84%)
- Relevant descriptions: ~70-75% (target: >70% ✅)

### Speed

- **Entity extraction:** ~2000 chars/sec
- **Book parsing:** +1-2 seconds per chapter
- **Total overhead:** Acceptable for production

---

## Next Steps

1. ✅ **Installed?** Run test suite
2. ✅ **Tested?** Start backend
3. ✅ **Verified?** Check logs
4. ✅ **Working?** Parse a test book

**Full integration report:** `docs/reports/GLINER_INTEGRATION_REPORT_2025-11-20.md`

---

## Support

- **Documentation:** `docs/reference/nlp/processors.md`
- **Architecture:** `docs/explanations/architecture/nlp/architecture.md`
- **GLiNER GitHub:** https://github.com/urchade/GLiNER
- **Model Hub:** https://huggingface.co/urchade/gliner_medium-v2.1

---

**Status:** ✅ Ready for production
**Date:** 2025-11-20
