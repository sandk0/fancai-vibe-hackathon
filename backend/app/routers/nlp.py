"""
API роуты для тестирования NLP функциональности в BookReader AI.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import traceback

from ..services.nlp_processor import nlp_processor


router = APIRouter()


class TextAnalysisRequest(BaseModel):
    """Модель запроса для анализа текста."""
    text: str
    chapter_id: str = None


@router.get("/nlp/test-libraries")
async def test_nlp_libraries() -> Dict[str, Any]:
    """
    Тестовый endpoint для проверки загрузки NLP библиотек.
    
    Returns:
        Информация о доступных NLP библиотеках и моделях
    """
    results = {}
    
    # Тестируем spaCy
    try:
        import spacy
        try:
            nlp = spacy.load("ru_core_news_lg")
            results["spacy"] = {
                "status": "ok", 
                "version": spacy.__version__,
                "model": "ru_core_news_lg loaded",
                "test": "✓ spaCy работает"
            }
        except OSError:
            results["spacy"] = {
                "status": "library_ok_model_missing", 
                "version": spacy.__version__,
                "model": "ru_core_news_lg not found",
                "test": "⚠️ spaCy установлен, но модель не найдена"
            }
    except ImportError as e:
        results["spacy"] = {"status": "error", "error": str(e)}
    
    # Тестируем NLTK
    try:
        import nltk
        try:
            nltk.data.find('tokenizers/punkt')
            results["nltk"] = {
                "status": "ok", 
                "version": nltk.__version__,
                "test": "✓ NLTK работает"
            }
        except LookupError:
            results["nltk"] = {
                "status": "library_ok_data_missing", 
                "version": nltk.__version__,
                "test": "⚠️ NLTK установлен, но данные не найдены"
            }
    except ImportError as e:
        results["nltk"] = {"status": "error", "error": str(e)}
    
    # Тестируем Stanza
    try:
        import stanza
        try:
            # Проверяем наличие русской модели
            stanza.download('ru', processors='tokenize', verbose=False)
            nlp_stanza = stanza.Pipeline('ru', processors='tokenize', verbose=False)
            results["stanza"] = {
                "status": "ok", 
                "version": stanza.__version__,
                "test": "✓ Stanza работает"
            }
        except Exception as e:
            results["stanza"] = {
                "status": "library_ok_model_issue", 
                "version": stanza.__version__,
                "test": f"⚠️ Stanza установлен, но модель недоступна: {str(e)}"
            }
    except ImportError as e:
        results["stanza"] = {"status": "error", "error": str(e)}
    
    # Тестируем Natasha
    try:
        import natasha
        version = getattr(natasha, '__version__', 'unknown')
        results["natasha"] = {
            "status": "ok", 
            "version": version,
            "test": "✓ Natasha работает"
        }
    except ImportError as e:
        results["natasha"] = {"status": "error", "error": str(e)}
    
    # Тестируем pymorphy3
    try:
        import pymorphy3
        morph = pymorphy3.MorphAnalyzer()
        results["pymorphy3"] = {
            "status": "ok", 
            "version": pymorphy3.__version__,
            "test": "✓ pymorphy3 работает"
        }
    except ImportError as e:
        results["pymorphy3"] = {"status": "error", "error": str(e)}
    
    # Тестируем библиотеки для парсинга книг
    try:
        import ebooklib
        results["ebooklib"] = {
            "status": "ok", 
            "version": ebooklib.VERSION,
            "test": "✓ ebooklib работает"
        }
    except ImportError as e:
        results["ebooklib"] = {"status": "error", "error": str(e)}
    
    try:
        import lxml
        results["lxml"] = {
            "status": "ok", 
            "version": lxml.__version__,
            "test": "✓ lxml работает"
        }
    except ImportError as e:
        results["lxml"] = {"status": "error", "error": str(e)}
    
    # Подсчёт успешных тестов
    working_libraries = sum(1 for lib in results.values() if lib["status"] == "ok")
    total_libraries = len(results)
    
    return {
        "summary": {
            "working": working_libraries,
            "total": total_libraries,
            "status": "healthy" if working_libraries == total_libraries else "partial"
        },
        "libraries": results,
        "message": f"NLP libraries test completed: {working_libraries}/{total_libraries} working"
    }


@router.get("/nlp/test-simple")
async def test_nlp_simple() -> Dict[str, Any]:
    """
    Простой тест обработки русского текста с помощью доступных библиотек.
    
    Returns:
        Результат обработки тестового предложения
    """
    test_text = "Вечером в старом замке горели свечи, освещая тёмные коридоры."
    results = {}
    
    # Тест spaCy
    try:
        import spacy
        nlp = spacy.load("ru_core_news_lg")
        doc = nlp(test_text)
        
        results["spacy"] = {
            "tokens": [token.text for token in doc],
            "entities": [(ent.text, ent.label_) for ent in doc.ents],
            "pos_tags": [(token.text, token.pos_) for token in doc]
        }
    except Exception as e:
        results["spacy"] = {"error": str(e)}
    
    # Тест pymorphy3
    try:
        import pymorphy3
        morph = pymorphy3.MorphAnalyzer()
        words = test_text.split()
        
        results["pymorphy3"] = {
            "morphology": [
                {"word": word, "normal_form": morph.parse(word)[0].normal_form}
                for word in words if word.isalpha()
            ]
        }
    except Exception as e:
        results["pymorphy3"] = {"error": str(e)}
    
    return {
        "test_text": test_text,
        "results": results,
        "message": "NLP processing test completed"
    }


@router.post("/nlp/extract-descriptions")
async def extract_descriptions(request: TextAnalysisRequest) -> Dict[str, Any]:
    """
    Извлекает описания из предоставленного текста с помощью NLP.
    
    Args:
        request: Запрос с текстом для анализа
        
    Returns:
        Извлеченные описания с приоритизацией
    """
    try:
        if not nlp_processor.is_available():
            raise HTTPException(
                status_code=503, 
                detail="NLP processor is not available. spaCy model not loaded."
            )
        
        if not request.text.strip():
            raise HTTPException(
                status_code=400,
                detail="Text cannot be empty"
            )
        
        if len(request.text) > 50000:  # Ограничение на размер текста
            raise HTTPException(
                status_code=400,
                detail="Text is too long. Maximum 50,000 characters allowed."
            )
        
        # Извлечение описаний
        descriptions = nlp_processor.extract_descriptions_from_text(
            request.text, 
            request.chapter_id
        )
        
        # Статистика по типам
        type_stats = {}
        for desc in descriptions:
            desc_type = desc["type"].value
            if desc_type not in type_stats:
                type_stats[desc_type] = 0
            type_stats[desc_type] += 1
        
        # Топ-10 описаний по приоритету
        top_descriptions = descriptions[:10]
        
        return {
            "summary": {
                "total_descriptions": len(descriptions),
                "text_length": len(request.text),
                "by_type": type_stats,
                "top_priority_score": descriptions[0]["priority_score"] if descriptions else 0
            },
            "descriptions": [
                {
                    "type": desc["type"].value,
                    "content": desc["content"],
                    "confidence_score": round(desc["confidence_score"], 3),
                    "priority_score": round(desc["priority_score"], 2),
                    "word_count": desc["word_count"],
                    "entities_mentioned": desc["entities_mentioned"],
                    "position_in_chapter": desc["position_in_chapter"]
                }
                for desc in top_descriptions
            ],
            "message": f"Extracted {len(descriptions)} descriptions from text"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing text: {str(e)}"
        )


@router.get("/nlp/test-book-sample")
async def test_book_sample() -> Dict[str, Any]:
    """
    Тестирует извлечение описаний на примере текста книги.
    
    Returns:
        Результат обработки тестового отрывка
    """
    sample_text = """
    Старый замок возвышался на скалистом утёсе, его чёрные башни терялись в утреннем тумане. 
    Каменные стены, покрытые мхом и плющом, хранили тайны веков. В высоких окнах не горел свет, 
    лишь ветер гулял по пустым залам.
    
    Элара медленно поднималась по винтовой лестнице. Её длинные рыжие волосы развевались на сквозняке, 
    а изумрудные глаза внимательно осматривали каждую ступень. В руках она сжимала древний посох из 
    серебра, украшенный синими сапфирами.
    
    Воздух был пропитан запахом старых книг и свечного воска. Тяжёлая тишина давила на плечи, 
    нарушаемая лишь эхом шагов. Где-то вдалеке послышался скрип половиц - кто-то ещё бродил 
    по замку в этот мрачный вечер.
    
    На массивном дубовом столе лежал раскрытый фолиант в кожаном переплёте. Золотые буквы 
    мерцали в свете единственной свечи, отбрасывая причудливые тени на стены. Рядом стояла 
    серебряная чаша с таинственным зельем.
    
    Внезапно раздался громкий удар грома. Молния озарила комнату ослепительным светом, 
    и в этот миг Элара увидела тёмную фигуру в углу. Незнакомец в чёрном плаще медленно 
    повернулся к ней, и она разглядела горящие красным огнём глаза.
    """
    
    try:
        descriptions = nlp_processor.extract_descriptions_from_text(sample_text)
        
        # Группировка по типам для лучшего отображения
        by_type = {}
        for desc in descriptions:
            desc_type = desc["type"].value
            if desc_type not in by_type:
                by_type[desc_type] = []
            by_type[desc_type].append({
                "content": desc["content"],
                "confidence": round(desc["confidence_score"], 3),
                "priority": round(desc["priority_score"], 2),
                "entities": desc["entities_mentioned"]
            })
        
        return {
            "sample_text_preview": sample_text[:200] + "...",
            "total_descriptions": len(descriptions),
            "by_type": by_type,
            "priority_ranking": [
                {
                    "rank": i + 1,
                    "type": desc["type"].value,
                    "content": desc["content"][:100] + "..." if len(desc["content"]) > 100 else desc["content"],
                    "priority_score": round(desc["priority_score"], 2)
                }
                for i, desc in enumerate(descriptions[:5])  # Топ-5
            ],
            "message": "Book sample analysis completed successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing book sample: {str(e)}"
        )