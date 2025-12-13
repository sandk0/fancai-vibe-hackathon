"""
NLP Model Cache Manager
Optimizes memory usage by sharing models between processes

Note: spaCy is imported dynamically to support lite deployments
that use only LangExtract for parsing.
"""

import gc
import logging
import tempfile
import time
from pathlib import Path
from typing import Optional, Dict, Any, TYPE_CHECKING
import threading

# Dynamic import for spacy - not required in lite mode
spacy = None
Language = None  # Type alias, will be set dynamically

logger = logging.getLogger(__name__)


class NLPModelCache:
    """
    Manages NLP model caching and sharing between workers
    Uses shared memory for efficient model reuse
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "initialized"):
            self.models: Dict[str, Any] = {}  # Language type when spacy is loaded
            self.model_stats: Dict[str, Dict[str, Any]] = {}
            self.cache_dir = Path(tempfile.gettempdir()) / "nlp_cache"
            self.cache_dir.mkdir(exist_ok=True)
            self.max_models = 3  # Max models in memory
            self.model_ttl = 3600  # 1 hour TTL
            self.initialized = True
            self._spacy_available = None  # Lazy check
            logger.info("✅ NLP Model Cache initialized")

    def get_model(self, model_name: str = "ru_core_news_lg") -> Any:
        """
        Get or load a spaCy model with caching.
        Returns None if spaCy is not available.
        """
        global spacy

        # Dynamic import of spacy
        if spacy is None:
            try:
                import spacy as _spacy
                spacy = _spacy
                self._spacy_available = True
            except ImportError:
                logger.warning("spaCy not installed - NLP cache unavailable")
                self._spacy_available = False
                return None

        # Check if model is already loaded
        if model_name in self.models:
            self._update_stats(model_name, "hit")
            return self.models[model_name]

        # Check cache limit
        if len(self.models) >= self.max_models:
            self._evict_oldest_model()

        # Try to load from disk cache first
        cached_model = self._load_from_disk_cache(model_name)
        if cached_model:
            self.models[model_name] = cached_model
            self._update_stats(model_name, "disk_hit")
            return cached_model

        # Load fresh model
        logger.info(f"🔄 Loading NLP model: {model_name}")
        start_time = time.time()

        try:
            # Disable unnecessary components for speed
            model = spacy.load(
                model_name, disable=["lemmatizer", "textcat"]  # We don't need these
            )

            # Enable only what we need
            model.enable_pipe("senter")  # Sentence segmentation

            # Optimize for memory
            model.max_length = 1000000  # 1M chars max

            load_time = time.time() - start_time
            logger.info(f"✅ Model {model_name} loaded in {load_time:.2f}s")

            # Cache the model
            self.models[model_name] = model
            self._save_to_disk_cache(model_name, model)
            self._update_stats(model_name, "load", {"load_time": load_time})

            return model

        except Exception as e:
            logger.error(f"❌ Error loading model {model_name}: {str(e)}")
            raise

    def preload_models(self, model_names: list[str]):
        """
        Preload models at worker startup
        """
        logger.info(f"📦 Preloading {len(model_names)} models...")

        for model_name in model_names:
            try:
                self.get_model(model_name)
            except Exception as e:
                logger.error(f"Failed to preload {model_name}: {str(e)}")

    def clear_cache(self):
        """
        Clear all cached models
        """
        logger.info("🗑️ Clearing NLP model cache...")

        # Clear from memory
        self.models.clear()
        self.model_stats.clear()

        # Clear disk cache
        for cache_file in self.cache_dir.glob("*.pkl"):
            try:
                cache_file.unlink()
            except Exception as e:
                logger.error(f"Error deleting cache file: {str(e)}")

        # Force garbage collection
        gc.collect()

        logger.info("✅ Cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        """
        total_hits = sum(s.get("hits", 0) for s in self.model_stats.values())
        total_loads = sum(s.get("loads", 0) for s in self.model_stats.values())

        return {
            "models_in_memory": len(self.models),
            "max_models": self.max_models,
            "total_hits": total_hits,
            "total_loads": total_loads,
            "hit_rate": (
                (total_hits / (total_hits + total_loads) * 100)
                if (total_hits + total_loads) > 0
                else 0
            ),
            "model_stats": self.model_stats,
            "cache_dir_size_mb": self._get_cache_dir_size() / 1024 / 1024,
        }

    def _evict_oldest_model(self):
        """
        Evict least recently used model
        """
        if not self.models:
            return

        # Find oldest model by last access time
        oldest_model = min(
            self.model_stats.items(), key=lambda x: x[1].get("last_access", 0)
        )[0]

        logger.info(f"🔄 Evicting model {oldest_model} from cache")

        # Remove from memory
        if oldest_model in self.models:
            del self.models[oldest_model]

        # Update stats
        self._update_stats(oldest_model, "evict")

        # Garbage collect
        gc.collect()

    def _update_stats(self, model_name: str, event: str, extra: Dict[str, Any] = None):
        """
        Update model statistics
        """
        if model_name not in self.model_stats:
            self.model_stats[model_name] = {
                "hits": 0,
                "disk_hits": 0,
                "loads": 0,
                "evictions": 0,
                "last_access": 0,
            }

        stats = self.model_stats[model_name]
        stats["last_access"] = time.time()

        if event == "hit":
            stats["hits"] += 1
        elif event == "disk_hit":
            stats["disk_hits"] += 1
        elif event == "load":
            stats["loads"] += 1
            if extra and "load_time" in extra:
                stats["avg_load_time"] = (
                    stats.get("avg_load_time", 0) * (stats["loads"] - 1)
                    + extra["load_time"]
                ) / stats["loads"]
        elif event == "evict":
            stats["evictions"] += 1

    def _save_to_disk_cache(self, model_name: str, model: Any):
        """
        Save model to disk cache (not implemented for spaCy models)
        spaCy models are already cached by the library
        """
        # Note: spaCy models are complex and not easily pickleable
        # This is a placeholder for future optimization
        pass

    def _load_from_disk_cache(self, model_name: str) -> Optional[Any]:
        """
        Load model from disk cache (not implemented for spaCy models)
        """
        # Note: spaCy models are complex and not easily pickleable
        # This is a placeholder for future optimization
        return None

    def _get_cache_dir_size(self) -> int:
        """
        Get total size of cache directory in bytes
        """
        total_size = 0
        for file_path in self.cache_dir.rglob("*"):
            if file_path.is_file():
                total_size += file_path.stat().st_size
        return total_size


class OptimizedNLPProcessor:
    """
    Optimized NLP processor using cached models
    """

    def __init__(self):
        self.cache = NLPModelCache()
        self.batch_size = 32  # Process texts in batches
        self.max_text_length = 10000  # Max text length per chunk

    def process_text(self, text: str, model_name: str = "ru_core_news_lg") -> Any:
        """
        Process text with cached model
        """
        model = self.cache.get_model(model_name)

        # Split long texts
        if len(text) > self.max_text_length:
            chunks = self._split_text(text)
            results = []
            for chunk in chunks:
                doc = model(chunk)
                results.append(doc)
            return results
        else:
            return model(text)

    def process_batch(
        self, texts: list[str], model_name: str = "ru_core_news_lg"
    ) -> list[Any]:
        """
        Process multiple texts in batch for efficiency
        """
        model = self.cache.get_model(model_name)

        # Use pipe for batch processing
        docs = list(
            model.pipe(
                texts,
                batch_size=self.batch_size,
                n_process=1,  # Single process to avoid memory issues
                disable=["lemmatizer", "textcat"],
            )
        )

        return docs

    def _split_text(self, text: str) -> list[str]:
        """
        Split text into chunks at sentence boundaries
        """
        chunks = []
        current_chunk = ""

        sentences = text.split(". ")
        for sentence in sentences:
            if len(current_chunk) + len(sentence) > self.max_text_length:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
            else:
                current_chunk += sentence + ". "

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return self.cache.get_stats()

    def clear_cache(self):
        """Clear model cache"""
        self.cache.clear_cache()


# Global instance
nlp_cache = NLPModelCache()
optimized_nlp = OptimizedNLPProcessor()

__all__ = ["NLPModelCache", "OptimizedNLPProcessor", "nlp_cache", "optimized_nlp"]
