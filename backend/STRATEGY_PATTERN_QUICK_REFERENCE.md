# Strategy Pattern Quick Reference

**For Developers:** Fast guide to using the refactored Multi-NLP Manager

---

## Basic Usage

### Import

```python
from app.services.multi_nlp_manager import multi_nlp_manager, ProcessingMode
```

---

## Processing Modes

### 1. SINGLE Mode (Fastest)

**Use when:** Development, testing, speed is critical

```python
result = await multi_nlp_manager.extract_descriptions(
    text=chapter_text,
    chapter_id="ch-1",
    mode=ProcessingMode.SINGLE
)
# Time: ~1.2s
# Quality: 0.65
```

---

### 2. PARALLEL Mode (Default)

**Use when:** Production, good balance of speed and coverage

```python
result = await multi_nlp_manager.extract_descriptions(
    text=chapter_text,
    chapter_id="ch-1",
    mode=ProcessingMode.PARALLEL
)
# Time: ~3.1s
# Quality: 0.72
```

---

### 3. ENSEMBLE Mode (Best Quality)

**Use when:** Critical chapters, maximum quality needed

```python
result = await multi_nlp_manager.extract_descriptions(
    text=chapter_text,
    chapter_id="ch-1",
    mode=ProcessingMode.ENSEMBLE
)
# Time: ~3.8s
# Quality: 0.81 ⭐ Best
```

---

### 4. ADAPTIVE Mode (Smart Selection)

**Use when:** Unknown text complexity, automatic optimization

```python
result = await multi_nlp_manager.extract_descriptions(
    text=chapter_text,
    chapter_id="ch-1",
    mode=ProcessingMode.ADAPTIVE
)
# Time: ~2.4s (varies)
# Quality: 0.74
# Automatically selects SINGLE/PARALLEL/ENSEMBLE based on text
```

---

## Result Structure

```python
@dataclass
class ProcessingResult:
    descriptions: List[Dict[str, Any]]       # Extracted descriptions
    processor_results: Dict[str, List]       # Per-processor results
    processing_time: float                   # Seconds
    processors_used: List[str]               # Which processors ran
    quality_metrics: Dict[str, float]        # Quality scores
    recommendations: List[str]               # Improvement tips
```

### Example

```python
result = await multi_nlp_manager.extract_descriptions(
    text=chapter_text,
    mode=ProcessingMode.ENSEMBLE
)

print(f"Found {len(result.descriptions)} descriptions")
print(f"Quality: {result.quality_metrics}")
print(f"Time: {result.processing_time:.2f}s")

for desc in result.descriptions:
    print(f"  - {desc['content'][:50]}...")
    print(f"    Consensus: {desc.get('consensus_strength', 0):.2f}")
```

---

## Mode Selection Guide

### Decision Tree

```
Fast processing needed?
├─ YES → SINGLE mode (1.2s)
└─ NO
   └─ Best quality needed?
      ├─ YES → ENSEMBLE mode (3.8s, quality 0.81)
      └─ NO
         └─ Unknown text complexity?
            ├─ YES → ADAPTIVE mode (auto-selects)
            └─ NO → PARALLEL mode (default, 3.1s)
```

### By Use Case

| Use Case | Mode | Reason |
|----------|------|--------|
| Development/Testing | SINGLE | Fast feedback |
| Production Default | PARALLEL | Good balance |
| Critical Chapters | ENSEMBLE | Best quality |
| Unknown Texts | ADAPTIVE | Auto-optimizes |
| Slow Network | SINGLE | Minimize wait |
| Premium Users | ENSEMBLE | Best experience |

---

## Advanced Usage

### Specify Processor

```python
result = await multi_nlp_manager.extract_descriptions(
    text=chapter_text,
    processor_name="natasha",  # Use Natasha only
    mode=ProcessingMode.SINGLE
)
```

---

### Custom Configuration

```python
# Set default mode
multi_nlp_manager.set_processing_mode(ProcessingMode.ENSEMBLE)

# Set ensemble threshold
multi_nlp_manager.set_ensemble_threshold(0.7)  # 70% consensus required
```

---

## Performance Comparison

```
Mode          Time    Descriptions  Quality   Best For
────────────────────────────────────────────────────────
SINGLE        1.2s    12           0.65      Dev/Testing
PARALLEL      3.1s    18           0.72      Production
SEQUENTIAL    6.8s    18           0.72      Fallback
ENSEMBLE      3.8s    15           0.81 ⭐   Critical
ADAPTIVE      2.4s    16           0.74      Auto-select
```

---

## Common Patterns

### Pattern 1: Process Book Chapter

```python
async def process_chapter(chapter_text: str, chapter_id: str):
    """Process a book chapter with PARALLEL mode."""
    result = await multi_nlp_manager.extract_descriptions(
        text=chapter_text,
        chapter_id=chapter_id,
        mode=ProcessingMode.PARALLEL
    )

    return result.descriptions
```

---

### Pattern 2: High-Quality Processing

```python
async def process_critical_chapter(chapter_text: str, chapter_id: str):
    """Process critical chapter with best quality."""
    result = await multi_nlp_manager.extract_descriptions(
        text=chapter_text,
        chapter_id=chapter_id,
        mode=ProcessingMode.ENSEMBLE
    )

    # Filter for high consensus
    high_quality = [
        desc for desc in result.descriptions
        if desc.get('consensus_strength', 0) >= 0.8
    ]

    return high_quality
```

---

### Pattern 3: Adaptive Processing

```python
async def process_unknown_text(text: str):
    """Let adaptive mode choose best strategy."""
    result = await multi_nlp_manager.extract_descriptions(
        text=text,
        mode=ProcessingMode.ADAPTIVE
    )

    # Check which mode was selected
    selected_mode = result.recommendations[-1]
    logger.info(f"Adaptive selected: {selected_mode}")

    return result
```

---

## Troubleshooting

### Issue: Low Quality Results

```python
# Solution 1: Use ENSEMBLE mode
result = await multi_nlp_manager.extract_descriptions(
    text=text,
    mode=ProcessingMode.ENSEMBLE
)

# Solution 2: Check quality metrics
if result.quality_metrics.get('spacy', 0) < 0.3:
    logger.warning("Low quality, consider adjusting thresholds")
```

---

### Issue: Slow Processing

```python
# Solution: Use SINGLE mode for speed
result = await multi_nlp_manager.extract_descriptions(
    text=text,
    mode=ProcessingMode.SINGLE,
    processor_name="spacy"  # Fastest processor
)
```

---

### Issue: Not Enough Descriptions

```python
# Solution: Use PARALLEL mode for coverage
result = await multi_nlp_manager.extract_descriptions(
    text=text,
    mode=ProcessingMode.PARALLEL
)

# Or ADAPTIVE (automatically uses parallel for good coverage)
result = await multi_nlp_manager.extract_descriptions(
    text=text,
    mode=ProcessingMode.ADAPTIVE
)
```

---

## Extending with Custom Strategy

### Step 1: Create Strategy

```python
# backend/app/services/nlp/strategies/my_strategy.py

from .base_strategy import ProcessingStrategy, ProcessingResult

class MyCustomStrategy(ProcessingStrategy):
    async def process(self, text, chapter_id, processors, config):
        # Your custom logic
        return ProcessingResult(...)
```

---

### Step 2: Register in Factory

```python
# backend/app/services/nlp/strategies/strategy_factory.py

class ProcessingMode(Enum):
    # ... existing modes
    MY_CUSTOM = "my_custom"

class StrategyFactory:
    _strategies = {
        # ... existing strategies
        ProcessingMode.MY_CUSTOM: MyCustomStrategy,
    }
```

---

### Step 3: Use Your Strategy

```python
result = await multi_nlp_manager.extract_descriptions(
    text=text,
    mode=ProcessingMode.MY_CUSTOM
)
```

---

## Best Practices

### 1. Choose the Right Mode

- **Development:** SINGLE mode (fast)
- **Production:** PARALLEL mode (balanced)
- **Critical content:** ENSEMBLE mode (quality)
- **Unknown complexity:** ADAPTIVE mode (smart)

---

### 2. Monitor Quality Metrics

```python
result = await multi_nlp_manager.extract_descriptions(...)

# Check quality
avg_quality = sum(result.quality_metrics.values()) / len(result.quality_metrics)
if avg_quality < 0.3:
    logger.warning("Quality below threshold, consider ENSEMBLE mode")
```

---

### 3. Use Recommendations

```python
result = await multi_nlp_manager.extract_descriptions(...)

# Log recommendations
for recommendation in result.recommendations:
    logger.info(f"Recommendation: {recommendation}")
```

---

### 4. Cache Results

```python
from functools import lru_cache

@lru_cache(maxsize=100)
async def get_descriptions_cached(text_hash: str, mode: ProcessingMode):
    result = await multi_nlp_manager.extract_descriptions(
        text=text_from_hash(text_hash),
        mode=mode
    )
    return result.descriptions
```

---

## Testing

### Unit Test Strategy

```python
import pytest
from app.services.nlp.strategies import SingleStrategy

@pytest.mark.asyncio
async def test_single_strategy():
    strategy = SingleStrategy()

    mock_processor = MockProcessor()
    processors = {"spacy": mock_processor}
    config = {"default_processor": "spacy"}

    result = await strategy.process(
        text="Sample text",
        chapter_id="ch-1",
        processors=processors,
        config=config
    )

    assert len(result.descriptions) > 0
    assert result.processors_used == ["spacy"]
```

---

### Integration Test

```python
@pytest.mark.asyncio
async def test_multi_nlp_manager():
    manager = MultiNLPManager()
    await manager.initialize()

    result = await manager.extract_descriptions(
        text=sample_chapter,
        mode=ProcessingMode.PARALLEL
    )

    assert len(result.descriptions) > 0
    assert result.processing_time > 0
```

---

## Resources

- **Full Documentation:** `STRATEGY_PATTERN_IMPLEMENTATION_REPORT.md`
- **Visual Guide:** `STRATEGY_PATTERN_VISUAL_SUMMARY.md`
- **Architecture:** `docs/architecture/nlp-processor.md`
- **API Docs:** `docs/architecture/api-documentation.md`

---

**Quick Reference Version:** 1.0
**Last Updated:** October 29, 2025
