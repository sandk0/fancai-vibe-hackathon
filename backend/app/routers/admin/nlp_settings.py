"""
Admin API routes for Multi-NLP configuration and management.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone
import logging

from ...core.auth import get_current_admin_user
from ...models.user import User
from ...services.settings_manager import settings_manager

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for settings
class ProcessorSpecificSettings(BaseModel):
    """Настройки специфичные для процессора."""

    enabled: bool = True
    weight: float = 1.0
    confidence_threshold: float = 0.3
    min_description_length: int = 50
    max_description_length: int = 1000
    min_word_count: int = 10
    custom_settings: Dict[str, Any] = {}


class SpacyProcessorSettings(ProcessorSpecificSettings):
    """Специализированные настройки для spaCy процессора."""

    model_name: str = "ru_core_news_lg"
    disable_components: list[str] = []
    entity_types: list[str] = ["PERSON", "LOC", "GPE", "FAC", "ORG"]
    literary_patterns: bool = True
    character_detection_boost: float = 1.2
    location_detection_boost: float = 1.1
    atmosphere_keywords: list[str] = [
        "мрачный",
        "светлый",
        "таинственный",
        "величественный",
        "уютный",
    ]


class NatashaProcessorSettings(ProcessorSpecificSettings):
    """Специализированные настройки для Natasha процессора."""

    enable_morphology: bool = True
    enable_syntax: bool = True
    enable_ner: bool = True
    literary_boost: float = 1.3
    person_patterns: list[str] = [
        r"\b(?:юноша|девушка|старик|женщина|мужчина|ребёнок|дитя)\b",
        r"\b(?:княгиня|князь|царь|царица|король|королева)\b",
    ]
    location_patterns: list[str] = [
        r"\b(?:дворец|замок|крепость|терем|хижина|изба)\b",
        r"\b(?:лес|поле|река|озеро|море|гора|холм)\b",
    ]
    atmosphere_indicators: list[str] = [
        r"\b(?:мрачно|светло|тихо|шумно|весело|грустно)\b",
        r"\b(?:туман|дымка|мгла|солнце|тень|свет)\b",
    ]


class StanzaProcessorSettings(ProcessorSpecificSettings):
    """Настройки для Stanza процессора."""

    model_name: str = "ru"
    processors: list[str] = ["tokenize", "pos", "lemma", "ner"]
    complex_syntax_analysis: bool = True
    dependency_parsing: bool = True


class MultiNLPSettings(BaseModel):
    """Расширенные настройки для мульти-процессорной NLP системы."""

    model_config = {"protected_namespaces": ()}

    # Глобальные настройки
    processing_mode: str = "single"  # single, parallel, sequential, ensemble, adaptive
    default_processor: str = "spacy"
    max_parallel_processors: int = 3
    ensemble_voting_threshold: float = 0.6
    adaptive_text_analysis: bool = True
    quality_monitoring: bool = True
    auto_processor_selection: bool = True

    # Настройки процессоров
    spacy_settings: SpacyProcessorSettings = SpacyProcessorSettings()
    natasha_settings: NatashaProcessorSettings = NatashaProcessorSettings()
    stanza_settings: StanzaProcessorSettings = StanzaProcessorSettings()

    # Для обратной совместимости
    processor_type: str = "spacy"
    available_processors: list[str] = [
        "spacy",
        "natasha",
        "stanza",
        "ensemble",
        "adaptive",
    ]
    available_spacy_models: list[str] = [
        "ru_core_news_lg",
        "ru_core_news_md",
        "ru_core_news_sm",
    ]


@router.get("/multi-nlp-settings", response_model=MultiNLPSettings)
async def get_multi_nlp_settings(admin_user: User = Depends(get_current_admin_user)):
    """Get comprehensive multi-processor NLP configuration settings."""

    from ...services.settings_manager import settings_manager
    from ...services.multi_nlp_manager import multi_nlp_manager

    try:
        # Получаем статус NLP системы
        nlp_status = await multi_nlp_manager.get_processor_status()

        # Загружаем глобальные настройки
        processing_mode = await settings_manager.get_setting(
            "nlp_global", "processing_mode", "single"
        )
        default_processor = await settings_manager.get_setting(
            "nlp_global", "default_processor", "spacy"
        )
        max_parallel = await settings_manager.get_setting(
            "nlp_global", "max_parallel_processors", 3
        )
        voting_threshold = await settings_manager.get_setting(
            "nlp_global", "ensemble_voting_threshold", 0.6
        )

        # Загружаем настройки spaCy процессора
        spacy_enabled = await settings_manager.get_setting("nlp_spacy", "enabled", True)
        spacy_weight = await settings_manager.get_setting("nlp_spacy", "weight", 1.0)
        spacy_confidence = await settings_manager.get_setting(
            "nlp_spacy", "confidence_threshold", 0.3
        )
        spacy_model = await settings_manager.get_setting(
            "nlp_spacy", "model_name", "ru_core_news_lg"
        )
        spacy_literary_patterns = await settings_manager.get_setting(
            "nlp_spacy", "literary_patterns", True
        )
        spacy_char_boost = await settings_manager.get_setting(
            "nlp_spacy", "character_detection_boost", 1.2
        )
        spacy_loc_boost = await settings_manager.get_setting(
            "nlp_spacy", "location_detection_boost", 1.1
        )

        # Загружаем настройки Natasha процессора
        natasha_enabled = await settings_manager.get_setting(
            "nlp_natasha", "enabled", True
        )
        natasha_weight = await settings_manager.get_setting(
            "nlp_natasha", "weight", 1.2
        )
        natasha_confidence = await settings_manager.get_setting(
            "nlp_natasha", "confidence_threshold", 0.4
        )
        natasha_literary_boost = await settings_manager.get_setting(
            "nlp_natasha", "literary_boost", 1.3
        )
        natasha_morphology = await settings_manager.get_setting(
            "nlp_natasha", "enable_morphology", True
        )
        natasha_syntax = await settings_manager.get_setting(
            "nlp_natasha", "enable_syntax", True
        )
        natasha_ner = await settings_manager.get_setting(
            "nlp_natasha", "enable_ner", True
        )

        # Загружаем настройки Stanza процессора
        stanza_enabled = await settings_manager.get_setting(
            "nlp_stanza", "enabled", False
        )
        stanza_weight = await settings_manager.get_setting("nlp_stanza", "weight", 0.8)
        stanza_confidence = await settings_manager.get_setting(
            "nlp_stanza", "confidence_threshold", 0.5
        )

        return MultiNLPSettings(
            # Глобальные настройки
            processing_mode=processing_mode,
            default_processor=default_processor,
            max_parallel_processors=max_parallel,
            ensemble_voting_threshold=voting_threshold,
            adaptive_text_analysis=True,
            quality_monitoring=True,
            auto_processor_selection=True,
            # Настройки spaCy
            spacy_settings=SpacyProcessorSettings(
                enabled=spacy_enabled,
                weight=spacy_weight,
                confidence_threshold=spacy_confidence,
                model_name=spacy_model,
                literary_patterns=spacy_literary_patterns,
                character_detection_boost=spacy_char_boost,
                location_detection_boost=spacy_loc_boost,
            ),
            # Настройки Natasha
            natasha_settings=NatashaProcessorSettings(
                enabled=natasha_enabled,
                weight=natasha_weight,
                confidence_threshold=natasha_confidence,
                literary_boost=natasha_literary_boost,
                enable_morphology=natasha_morphology,
                enable_syntax=natasha_syntax,
                enable_ner=natasha_ner,
            ),
            # Настройки Stanza
            stanza_settings=StanzaProcessorSettings(
                enabled=stanza_enabled,
                weight=stanza_weight,
                confidence_threshold=stanza_confidence,
            ),
            # Обратная совместимость
            processor_type=default_processor,
            available_processors=nlp_status.get(
                "available_processors", ["spacy", "natasha"]
            )
            + ["ensemble", "adaptive"],
        )

    except Exception as e:
        logger.error(f"Error getting multi-NLP settings: {e}")
        # Возвращаем настройки по умолчанию
        return MultiNLPSettings()


@router.put("/multi-nlp-settings")
async def update_multi_nlp_settings(
    settings: MultiNLPSettings, admin_user: User = Depends(get_current_admin_user)
):
    """Update comprehensive multi-processor NLP configuration settings."""

    from ...services.settings_manager import settings_manager
    from ...services.multi_nlp_manager import multi_nlp_manager

    try:
        # Сохраняем глобальные настройки
        await settings_manager.set_setting(
            "nlp_global", "processing_mode", settings.processing_mode
        )
        await settings_manager.set_setting(
            "nlp_global", "default_processor", settings.default_processor
        )
        await settings_manager.set_setting(
            "nlp_global", "max_parallel_processors", settings.max_parallel_processors
        )
        await settings_manager.set_setting(
            "nlp_global",
            "ensemble_voting_threshold",
            settings.ensemble_voting_threshold,
        )

        # Сохраняем настройки spaCy процессора
        spacy_settings = settings.spacy_settings
        await settings_manager.set_setting(
            "nlp_spacy", "enabled", spacy_settings.enabled
        )
        await settings_manager.set_setting("nlp_spacy", "weight", spacy_settings.weight)
        await settings_manager.set_setting(
            "nlp_spacy", "confidence_threshold", spacy_settings.confidence_threshold
        )
        await settings_manager.set_setting(
            "nlp_spacy", "model_name", spacy_settings.model_name
        )
        await settings_manager.set_setting(
            "nlp_spacy", "literary_patterns", spacy_settings.literary_patterns
        )
        await settings_manager.set_setting(
            "nlp_spacy",
            "character_detection_boost",
            spacy_settings.character_detection_boost,
        )
        await settings_manager.set_setting(
            "nlp_spacy",
            "location_detection_boost",
            spacy_settings.location_detection_boost,
        )
        await settings_manager.set_setting(
            "nlp_spacy", "atmosphere_keywords", spacy_settings.atmosphere_keywords
        )

        # Сохраняем настройки Natasha процессора
        natasha_settings = settings.natasha_settings
        await settings_manager.set_setting(
            "nlp_natasha", "enabled", natasha_settings.enabled
        )
        await settings_manager.set_setting(
            "nlp_natasha", "weight", natasha_settings.weight
        )
        await settings_manager.set_setting(
            "nlp_natasha", "confidence_threshold", natasha_settings.confidence_threshold
        )
        await settings_manager.set_setting(
            "nlp_natasha", "literary_boost", natasha_settings.literary_boost
        )
        await settings_manager.set_setting(
            "nlp_natasha", "enable_morphology", natasha_settings.enable_morphology
        )
        await settings_manager.set_setting(
            "nlp_natasha", "enable_syntax", natasha_settings.enable_syntax
        )
        await settings_manager.set_setting(
            "nlp_natasha", "enable_ner", natasha_settings.enable_ner
        )
        await settings_manager.set_setting(
            "nlp_natasha", "person_patterns", natasha_settings.person_patterns
        )
        await settings_manager.set_setting(
            "nlp_natasha", "location_patterns", natasha_settings.location_patterns
        )
        await settings_manager.set_setting(
            "nlp_natasha",
            "atmosphere_indicators",
            natasha_settings.atmosphere_indicators,
        )

        # Сохраняем настройки Stanza процессора
        stanza_settings = settings.stanza_settings
        await settings_manager.set_setting(
            "nlp_stanza", "enabled", stanza_settings.enabled
        )
        await settings_manager.set_setting(
            "nlp_stanza", "weight", stanza_settings.weight
        )
        await settings_manager.set_setting(
            "nlp_stanza", "confidence_threshold", stanza_settings.confidence_threshold
        )
        await settings_manager.set_setting(
            "nlp_stanza", "model_name", stanza_settings.model_name
        )
        await settings_manager.set_setting(
            "nlp_stanza", "processors", stanza_settings.processors
        )
        await settings_manager.set_setting(
            "nlp_stanza",
            "complex_syntax_analysis",
            stanza_settings.complex_syntax_analysis,
        )
        await settings_manager.set_setting(
            "nlp_stanza", "dependency_parsing", stanza_settings.dependency_parsing
        )

        # Переинициализируем менеджер NLP с новыми настройками
        await multi_nlp_manager.initialize()

        return {
            "message": "Multi-NLP settings updated successfully",
            "settings": settings,
            "processors_reloaded": True,
        }

    except Exception as e:
        logger.error(f"Error updating multi-NLP settings: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update multi-NLP settings: {str(e)}"
        )


@router.get("/nlp-processor-status")
async def get_nlp_processor_status(admin_user: User = Depends(get_current_admin_user)):
    """Get detailed status of all NLP processors."""

    from ...services.multi_nlp_manager import multi_nlp_manager

    try:
        status = await multi_nlp_manager.get_processor_status()
        return {
            "status": "success",
            "data": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting NLP processor status: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get processor status: {str(e)}"
        )


@router.post("/nlp-processor-test")
async def test_nlp_processors(
    request: dict,  # {"text": "...", "processors": ["spacy", "natasha"], "mode": "parallel"}
    admin_user: User = Depends(get_current_admin_user),
):
    """Test NLP processors with sample text and compare results."""

    from ...services.multi_nlp_manager import multi_nlp_manager, ProcessingMode

    try:
        text = request.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="Text is required for testing")

        request.get("processors", ["spacy", "natasha"])
        mode = request.get("mode", "parallel")

        # Конвертируем режим в enum
        processing_mode = ProcessingMode(mode)

        # Обрабатываем текст
        result = await multi_nlp_manager.extract_descriptions(
            text=text, chapter_id="test", processor_name=None, mode=processing_mode
        )

        return {
            "status": "success",
            "test_text": text[:200] + "..." if len(text) > 200 else text,
            "processing_mode": mode,
            "processors_used": result.processors_used,
            "total_descriptions": len(result.descriptions),
            "processing_time_seconds": result.processing_time,
            "quality_metrics": result.quality_metrics,
            "recommendations": result.recommendations,
            "processor_results": {
                proc: {
                    "count": len(descriptions),
                    "sample_descriptions": descriptions[
                        :3
                    ],  # Первые 3 описания как пример
                }
                for proc, descriptions in result.processor_results.items()
            },
            "best_descriptions": result.descriptions[:5],  # Топ 5 описаний
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error testing NLP processors: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to test processors: {str(e)}"
        )


@router.get("/nlp-processor-info")
async def get_nlp_processor_info(admin_user: User = Depends(get_current_admin_user)):
    """Get current NLP processor information."""

    from ...services.multi_nlp_manager import multi_nlp_manager

    try:
        # Получаем статус всех процессоров
        status = await multi_nlp_manager.get_processor_status()

        return {
            "processor_info": {
                "type": "multi_processor",
                "loaded": len(status.get("available_processors", [])) > 0,
                "available": len(status.get("available_processors", [])) > 0,
                "processors": status.get("processor_details", {}),
                "current_mode": status.get("processing_mode", "single"),
            },
            "available_models": {
                "spacy": ["ru_core_news_lg", "ru_core_news_md", "ru_core_news_sm"],
                "natasha": ["default"],
                "stanza": ["ru"],
            },
        }
    except Exception as e:
        logger.error(f"Error getting NLP processor info: {e}")
        return {
            "processor_info": {
                "type": "multi_processor",
                "loaded": False,
                "available": False,
                "error": str(e),
            },
            "available_models": {
                "spacy": ["ru_core_news_lg"],
                "natasha": ["default"],
                "stanza": ["ru"],
            },
        }
