"""
API роуты для тестирования NLP функциональности в BookReader AI.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import traceback


router = APIRouter()


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