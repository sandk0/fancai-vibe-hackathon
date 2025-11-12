"""
ParagraphSegmenter - сегментация текста на параграфы с классификацией типов.

Этот модуль реализует первый этап продвинутого парсинга - разбиение текста
на параграфы и определение их типов (DESCRIPTION, NARRATIVE, DIALOG, META).

Алгоритм: O(n) линейное время, где n - количество строк в тексте.

РЕВОЛЮЦИОННОЕ ОТЛИЧИЕ от классических подходов:
- Работа с ПАРАГРАФАМИ, а не с предложениями
- Многофакторная классификация типов
- Оценка описательности (descriptiveness score)
- Dependency Parsing для извлечения синтаксических паттернов (NEW!)
"""

import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict

from .config import AdvancedParserConfig, ParagraphType, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


@dataclass
class Paragraph:
    """
    Параграф текста с метаданными.

    Attributes:
        text: Текст параграфа
        type: Тип параграфа (DESCRIPTION, NARRATIVE, DIALOG, META)
        start_line: Номер начальной строки в исходном тексте
        end_line: Номер конечной строки
        char_length: Длина в символах
        descriptiveness_score: Оценка описательности (0.0-1.0)
        has_visual_words: Содержит ли визуальные слова
        contains_dialog: Содержит ли диалоги
        metadata: Дополнительные метаданные
    """

    text: str
    type: ParagraphType
    start_line: int
    end_line: int
    char_length: int
    descriptiveness_score: float = 0.0
    has_visual_words: bool = False
    contains_dialog: bool = False
    metadata: Dict = field(default_factory=dict)

    def __repr__(self) -> str:
        preview = self.text[:50].replace("\n", " ")
        return (
            f"Paragraph(type={self.type.value}, lines={self.start_line}-{self.end_line}, "
            f"chars={self.char_length}, score={self.descriptiveness_score:.2f}, "
            f"text='{preview}...')"
        )


class ParagraphSegmenter:
    """
    Сегментатор текста на параграфы с классификацией типов.

    Этот класс реализует первый этап продвинутого парсинга описаний.
    Основные задачи:
    1. Разбиение текста на параграфы (по пустым строкам и маркерам)
    2. Классификация типов параграфов
    3. Оценка описательности каждого параграфа
    4. Фильтрация служебного текста и антипаттернов

    Алгоритм работает за O(n), где n - количество строк в тексте.
    """

    def __init__(self, config: Optional[AdvancedParserConfig] = None):
        """
        Инициализация сегментатора.

        Args:
            config: Конфигурация парсера (опционально)
        """
        self.config = config or DEFAULT_CONFIG

        # Компиляция регулярных выражений для быстрого поиска
        self._compile_patterns()

        # Lazy loading SpaCy модели для dependency parsing
        self._spacy_nlp = None
        self._dependency_parsing_enabled = True

    def _compile_patterns(self):
        """Компиляция регулярных выражений для оптимизации."""
        # Паттерны для диалогов
        self.dialog_pattern = re.compile(r'[—–]\s*[А-ЯЁ]|[«"][^»"]+[»"]', re.UNICODE)

        # Паттерны для заголовков глав
        self.chapter_pattern = re.compile(
            r"^\s*("
            + "|".join(re.escape(m) for m in self.config.chapter_markers)
            + r")",
            re.IGNORECASE | re.UNICODE,
        )

        # Паттерны для служебного текста
        self.meta_pattern = re.compile(
            r"^\s*(" + "|".join(re.escape(m) for m in self.config.meta_markers) + r")",
            re.UNICODE,
        )

        # Паттерны для антипаттернов
        self.antipattern_regexes = {}
        for antipattern_type, patterns in self.config.antipatterns.items():
            compiled_patterns = [re.compile(p, re.UNICODE) for p in patterns]
            self.antipattern_regexes[antipattern_type] = compiled_patterns

        # Паттерны для визуальных слов
        self.visual_words = set()
        for category, words in self.config.visual_keywords.items():
            self.visual_words.update(words)

    def _load_spacy_model(self):
        """Lazy loading SpaCy модели для dependency parsing."""
        if self._spacy_nlp is None and self._dependency_parsing_enabled:
            try:
                import spacy

                # Загрузить русскую модель ru_core_news_lg
                self._spacy_nlp = spacy.load("ru_core_news_lg")
                logger.info("✅ SpaCy model loaded for dependency parsing")
            except Exception as e:
                logger.warning(
                    f"Failed to load SpaCy model: {e}. Dependency parsing disabled."
                )
                self._dependency_parsing_enabled = False

    def _extract_descriptive_phrases(self, text: str) -> Dict[str, List[str]]:
        """
        Извлечь описательные фразы с использованием dependency parsing.

        Patterns (Perplexity AI recommendation):
        - ADJ + NOUN: "темный лес", "высокий замок"
        - ADJ + ADJ + NOUN: "большой темный лес"
        - NOUN + PREP + NOUN: "замок на холме", "дорога через лес"

        Args:
            text: Текст для анализа

        Returns:
            Словарь с извлеченными фразами по категориям
        """
        if not self._dependency_parsing_enabled:
            return {"adj_noun": [], "adj_adj_noun": [], "noun_prep_noun": []}

        # Lazy load модели
        if self._spacy_nlp is None:
            self._load_spacy_model()

        if self._spacy_nlp is None:
            return {"adj_noun": [], "adj_adj_noun": [], "noun_prep_noun": []}

        try:
            doc = self._spacy_nlp(
                text[:5000]
            )  # Ограничить длину для производительности

            adj_noun_phrases = []
            adj_adj_noun_phrases = []
            noun_prep_noun_phrases = []

            # Pattern 1: ADJ + NOUN
            for token in doc:
                if token.pos_ == "NOUN":
                    # Найти прилагательные, модифицирующие это существительное
                    adjectives = [
                        child
                        for child in token.children
                        if child.pos_ == "ADJ" and child.dep_ == "amod"
                    ]

                    if len(adjectives) == 1:
                        # ADJ + NOUN
                        phrase = f"{adjectives[0].text} {token.text}"
                        adj_noun_phrases.append(phrase)

                    elif len(adjectives) >= 2:
                        # ADJ + ADJ + NOUN
                        sorted_adjs = sorted(adjectives, key=lambda x: x.i)
                        adj_texts = " ".join(adj.text for adj in sorted_adjs)
                        phrase = f"{adj_texts} {token.text}"
                        adj_adj_noun_phrases.append(phrase)

            # Pattern 2: NOUN + PREP + NOUN
            for token in doc:
                if token.pos_ == "NOUN":
                    # Найти предлоги, связанные с этим существительным
                    for child in token.children:
                        if (
                            child.dep_ == "case" and child.pos_ == "ADP"
                        ):  # ADP = предлог
                            # Найти связанное существительное
                            for sibling in token.head.children:
                                if sibling.pos_ == "NOUN" and sibling != token:
                                    phrase = f"{token.text} {child.text} {sibling.text}"
                                    noun_prep_noun_phrases.append(phrase)
                                    break

            return {
                "adj_noun": adj_noun_phrases[:20],  # Топ-20 фраз
                "adj_adj_noun": adj_adj_noun_phrases[:10],
                "noun_prep_noun": noun_prep_noun_phrases[:15],
            }

        except Exception as e:
            logger.error(f"Dependency parsing error: {e}")
            return {"adj_noun": [], "adj_adj_noun": [], "noun_prep_noun": []}

    def segment(self, text: str) -> List[Paragraph]:
        """
        Сегментировать текст на параграфы с классификацией.

        Алгоритм:
        1. Разбить текст на строки
        2. Группировать строки в параграфы (по пустым строкам)
        3. Классифицировать тип каждого параграфа
        4. Оценить описательность
        5. Фильтровать по минимальной длине

        Сложность: O(n), где n - количество строк

        Args:
            text: Исходный текст для сегментации

        Returns:
            Список параграфов с метаданными
        """
        if not text or not text.strip():
            return []

        lines = text.split("\n")
        paragraphs = []

        current_paragraph_lines = []
        start_line = 0

        for line_idx, line in enumerate(lines):
            stripped_line = line.strip()

            # Правило 1: Пустая строка = граница параграфа
            if not stripped_line:
                if current_paragraph_lines:
                    paragraph = self._create_paragraph(
                        current_paragraph_lines, start_line, line_idx - 1
                    )
                    if paragraph:
                        paragraphs.append(paragraph)
                    current_paragraph_lines = []
                continue

            # Правило 2: Заголовок главы = отдельный параграф
            if self.chapter_pattern.match(stripped_line):
                # Сохранить текущий параграф если есть
                if current_paragraph_lines:
                    paragraph = self._create_paragraph(
                        current_paragraph_lines, start_line, line_idx - 1
                    )
                    if paragraph:
                        paragraphs.append(paragraph)

                # Создать параграф для заголовка
                paragraph = self._create_paragraph([line], line_idx, line_idx)
                if paragraph:
                    paragraphs.append(paragraph)

                current_paragraph_lines = []
                start_line = line_idx + 1
                continue

            # Правило 3: Маркер диалога в начале строки = возможная граница
            if stripped_line.startswith(("—", "–", "«")) and current_paragraph_lines:
                # Проверить, является ли это началом нового диалога
                prev_text = "\n".join(current_paragraph_lines).strip()
                if len(prev_text) > 50:  # Предыдущий параграф достаточно длинный
                    paragraph = self._create_paragraph(
                        current_paragraph_lines, start_line, line_idx - 1
                    )
                    if paragraph:
                        paragraphs.append(paragraph)
                    current_paragraph_lines = []
                    start_line = line_idx

            # Правило 4: Накапливать обычные строки
            if not current_paragraph_lines:
                start_line = line_idx
            current_paragraph_lines.append(line)

        # Обработать последний параграф
        if current_paragraph_lines:
            paragraph = self._create_paragraph(
                current_paragraph_lines, start_line, len(lines) - 1
            )
            if paragraph:
                paragraphs.append(paragraph)

        return paragraphs

    def _create_paragraph(
        self, lines: List[str], start_line: int, end_line: int
    ) -> Optional[Paragraph]:
        """
        Создать параграф из списка строк.

        Args:
            lines: Список строк параграфа
            start_line: Номер начальной строки
            end_line: Номер конечной строки

        Returns:
            Объект Paragraph или None если параграф не валиден
        """
        if not lines:
            return None

        # Объединить строки в текст
        text = "\n".join(lines).strip()

        if not text:
            return None

        # Проверить минимальную длину
        char_length = len(text)
        if char_length < self.config.min_paragraph_chars:
            return None

        # Проверить на антипаттерны
        if self._is_antipattern(text):
            return None

        # Классифицировать тип параграфа
        paragraph_type = self._classify_type(text)

        # Оценить описательность
        descriptiveness_score = self._calculate_descriptiveness(text)

        # Проверить наличие визуальных слов
        has_visual_words = self._has_visual_words(text)

        # Проверить наличие диалога
        contains_dialog = bool(self.dialog_pattern.search(text))

        # Извлечь описательные фразы с помощью dependency parsing (NEW!)
        descriptive_phrases = {}
        if paragraph_type in [ParagraphType.DESCRIPTION, ParagraphType.MIXED]:
            # Только для описательных параграфов
            descriptive_phrases = self._extract_descriptive_phrases(text)

        return Paragraph(
            text=text,
            type=paragraph_type,
            start_line=start_line,
            end_line=end_line,
            char_length=char_length,
            descriptiveness_score=descriptiveness_score,
            has_visual_words=has_visual_words,
            contains_dialog=contains_dialog,
            metadata={"descriptive_phrases": descriptive_phrases},
        )

    def _is_antipattern(self, text: str) -> bool:
        """
        Проверить, является ли текст антипаттерном.

        Args:
            text: Текст для проверки

        Returns:
            True если текст является антипаттерном
        """
        for antipattern_type, patterns in self.antipattern_regexes.items():
            for pattern in patterns:
                if pattern.search(text):
                    return True
        return False

    def _classify_type(self, text: str) -> ParagraphType:
        """
        Классифицировать тип параграфа.

        Алгоритм:
        1. Проверить на META (заголовки, эпиграфы)
        2. Проверить на DIALOG (реплики персонажей)
        3. Оценить баланс описание/действие
        4. Классифицировать как DESCRIPTION, NARRATIVE или MIXED

        Args:
            text: Текст параграфа

        Returns:
            Тип параграфа
        """
        # Проверка на META
        if self.chapter_pattern.match(text) or self.meta_pattern.match(text):
            return ParagraphType.META

        # Проверка на DIALOG
        dialog_match = self.dialog_pattern.search(text)
        if dialog_match:
            # Если больше 30% текста - диалог, то тип DIALOG
            dialog_chars = sum(
                len(m.group(0)) for m in self.dialog_pattern.finditer(text)
            )
            if dialog_chars / len(text) > 0.3:
                return ParagraphType.DIALOG

        # Подсчет прилагательных и существительных (простая эвристика)
        words = text.lower().split()

        # Маркеры описательных текстов
        descriptive_markers = [
            "был",
            "была",
            "было",
            "были",
            "выглядел",
            "выглядела",
            "выглядело",
            "выглядели",
            "казался",
            "казалась",
            "казалось",
            "казались",
            "напоминал",
            "напоминала",
            "напоминало",
            "напоминали",
        ]

        # Маркеры повествовательных текстов
        narrative_markers = [
            "пошел",
            "пошла",
            "пошли",
            "сделал",
            "сделала",
            "сделали",
            "сказал",
            "сказала",
            "сказали",
            "подумал",
            "подумала",
            "подумали",
            "решил",
            "решила",
            "решили",
        ]

        descriptive_count = sum(1 for word in words if word in descriptive_markers)
        narrative_count = sum(1 for word in words if word in narrative_markers)

        # Подсчет визуальных слов
        visual_count = sum(1 for word in words if word in self.visual_words)

        # Решение о типе
        if visual_count > 3 or descriptive_count > narrative_count:
            if narrative_count > 0:
                return ParagraphType.MIXED
            return ParagraphType.DESCRIPTION
        elif narrative_count > descriptive_count:
            return ParagraphType.NARRATIVE
        else:
            return ParagraphType.MIXED

    def _calculate_descriptiveness(self, text: str) -> float:
        """
        Оценить описательность текста (0.0-1.0).

        Факторы:
        - Наличие визуальных слов (40%)
        - Соотношение прилагательных к существительным (30%)
        - Отсутствие диалогов и действий (20%)
        - Длина предложений (10%)

        Args:
            text: Текст для оценки

        Returns:
            Оценка описательности от 0.0 до 1.0
        """
        words = text.lower().split()
        if not words:
            return 0.0

        score = 0.0

        # Фактор 1: Визуальные слова (40%)
        visual_count = sum(1 for word in words if word in self.visual_words)
        visual_ratio = min(visual_count / 10.0, 1.0)  # Нормализовать к 10 словам
        score += 0.4 * visual_ratio

        # Фактор 2: Описательные маркеры (30%)
        descriptive_markers = [
            "был",
            "была",
            "было",
            "были",
            "выглядел",
            "выглядела",
            "казался",
            "казалась",
        ]
        descriptive_count = sum(1 for word in words if word in descriptive_markers)
        descriptive_ratio = min(descriptive_count / 5.0, 1.0)
        score += 0.3 * descriptive_ratio

        # Фактор 3: Отсутствие диалогов (20%)
        has_dialog = bool(self.dialog_pattern.search(text))
        if not has_dialog:
            score += 0.2

        # Фактор 4: Средняя длина предложений (10%)
        sentences = re.split(r"[.!?]+", text)
        avg_sentence_length = sum(len(s.split()) for s in sentences) / max(
            len(sentences), 1
        )
        # Длинные предложения (>15 слов) типичны для описаний
        length_score = min(avg_sentence_length / 15.0, 1.0)
        score += 0.1 * length_score

        return min(score, 1.0)

    def _has_visual_words(self, text: str) -> bool:
        """
        Проверить наличие визуальных слов в тексте.

        Args:
            text: Текст для проверки

        Returns:
            True если текст содержит визуальные слова
        """
        words = text.lower().split()
        return any(word in self.visual_words for word in words)

    def filter_by_type(
        self, paragraphs: List[Paragraph], types: List[ParagraphType]
    ) -> List[Paragraph]:
        """
        Фильтровать параграфы по типам.

        Args:
            paragraphs: Список параграфов
            types: Список допустимых типов

        Returns:
            Отфильтрованный список параграфов
        """
        return [p for p in paragraphs if p.type in types]

    def filter_by_descriptiveness(
        self, paragraphs: List[Paragraph], min_score: float = 0.5
    ) -> List[Paragraph]:
        """
        Фильтровать параграфы по минимальному уровню описательности.

        Args:
            paragraphs: Список параграфов
            min_score: Минимальная оценка описательности (0.0-1.0)

        Returns:
            Отфильтрованный список параграфов
        """
        return [p for p in paragraphs if p.descriptiveness_score >= min_score]

    def get_statistics(self, paragraphs: List[Paragraph]) -> Dict:
        """
        Получить статистику по параграфам.

        Args:
            paragraphs: Список параграфов

        Returns:
            Словарь со статистикой
        """
        if not paragraphs:
            return {
                "total": 0,
                "by_type": {},
                "avg_length": 0,
                "avg_descriptiveness": 0,
                "with_visual_words": 0,
                "with_dialog": 0,
            }

        type_counts = {}
        for paragraph in paragraphs:
            type_name = paragraph.type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1

        return {
            "total": len(paragraphs),
            "by_type": type_counts,
            "avg_length": sum(p.char_length for p in paragraphs) / len(paragraphs),
            "avg_descriptiveness": sum(p.descriptiveness_score for p in paragraphs)
            / len(paragraphs),
            "with_visual_words": sum(1 for p in paragraphs if p.has_visual_words),
            "with_dialog": sum(1 for p in paragraphs if p.contains_dialog),
        }
