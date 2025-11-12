"""
DescriptionBoundaryDetector - детектирование границ многопараграфных описаний.

Этот модуль реализует второй этап продвинутого парсинга - определение границ
полных описаний, которые могут занимать несколько параграфов.

Алгоритм: O(n*w) где n - количество параграфов, w - размер окна lookahead.

РЕВОЛЮЦИОННОЕ ОТЛИЧИЕ от классических подходов:
- Детектирование МНОГОПАРАГРАФНЫХ описаний (не просто предложений!)
- Интеллектуальное определение границ по сигналам продолжения/остановки
- Динамический lookahead window (до 20 параграфов)
- Проверка семантической связности между параграфами
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict

from .config import AdvancedParserConfig, ParagraphType, DEFAULT_CONFIG
from .paragraph_segmenter import Paragraph


@dataclass
class CompleteDescription:
    """
    Полное многопараграфное описание.

    Attributes:
        paragraphs: Список параграфов, составляющих описание
        text: Объединенный текст всех параграфов
        start_paragraph_idx: Индекс начального параграфа
        end_paragraph_idx: Индекс конечного параграфа
        char_length: Общая длина в символах
        paragraph_count: Количество параграфов
        coherence_score: Оценка связности (0.0-1.0)
        boundary_confidence: Уверенность в корректности границ (0.0-1.0)
        metadata: Дополнительные метаданные
    """

    paragraphs: List[Paragraph]
    text: str
    start_paragraph_idx: int
    end_paragraph_idx: int
    char_length: int
    paragraph_count: int
    coherence_score: float = 0.0
    boundary_confidence: float = 0.0
    metadata: Dict = field(default_factory=dict)

    def __repr__(self) -> str:
        preview = self.text[:80].replace("\n", " ")
        return (
            f"CompleteDescription(paras={self.paragraph_count}, "
            f"chars={self.char_length}, coherence={self.coherence_score:.2f}, "
            f"text='{preview}...')"
        )


class DescriptionBoundaryDetector:
    """
    Детектор границ многопараграфных описаний.

    Этот класс реализует второй этап продвинутого парсинга - определение
    полных описаний, которые могут охватывать несколько параграфов.

    Основные задачи:
    1. Поиск начальных параграфов описаний (высокая описательность)
    2. Определение продолжения описания (lookahead window)
    3. Проверка семантической связности между параграфами
    4. Определение границ остановки (stop signals)
    5. Валидация длины (500-4000 символов)

    Алгоритм работает за O(n*w), где n - параграфы, w - lookahead window.
    """

    def __init__(self, config: Optional[AdvancedParserConfig] = None):
        """
        Инициализация детектора границ.

        Args:
            config: Конфигурация парсера (опционально)
        """
        self.config = config or DEFAULT_CONFIG

        # Компиляция паттернов
        self._compile_patterns()

    def _compile_patterns(self):
        """Компиляция регулярных выражений для оптимизации."""
        # Паттерны для сигналов продолжения
        self.continuation_pattern = re.compile(
            r"^\s*("
            + "|".join(re.escape(s) for s in self.config.continuation_signals)
            + r")\b",
            re.IGNORECASE | re.UNICODE,
        )

        # Паттерны для сигналов остановки
        self.stop_pattern = re.compile(
            r"\b(" + "|".join(re.escape(s) for s in self.config.stop_signals) + r")\b",
            re.IGNORECASE | re.UNICODE,
        )

        # Паттерн для местоименных ссылок
        self.pronoun_pattern = re.compile(
            r"\b(он|она|оно|они|его|её|их|этот|эта|это|эти|тот|та|то|те)\b",
            re.IGNORECASE | re.UNICODE,
        )

    def detect(self, paragraphs: List[Paragraph]) -> List[CompleteDescription]:
        """
        Детектировать полные многопараграфные описания.

        Алгоритм:
        1. Найти параграфы с высокой описательностью (>0.5) как стартовые точки
        2. Для каждой стартовой точки:
           a. Применить lookahead window (до 20 параграфов вперед)
           b. Проверить каждый следующий параграф на продолжение
           c. Вычислить coherence score между параграфами
           d. Остановиться при stop signal или низкой coherence
        3. Валидировать длину результата (500-4000 символов)
        4. Удалить перекрывающиеся описания (выбрать лучшее)

        Сложность: O(n*w), где n - параграфы, w - lookahead window

        Args:
            paragraphs: Список сегментированных параграфов

        Returns:
            Список полных многопараграфных описаний
        """
        if not paragraphs:
            return []

        descriptions = []
        used_indices = set()  # Отслеживаем использованные параграфы

        for idx, paragraph in enumerate(paragraphs):
            # Пропустить уже использованные параграфы
            if idx in used_indices:
                continue

            # Фильтр 1: Тип параграфа должен быть DESCRIPTION или MIXED
            if paragraph.type not in [ParagraphType.DESCRIPTION, ParagraphType.MIXED]:
                continue

            # Фильтр 2: Описательность должна быть >= 0.5
            if paragraph.descriptiveness_score < 0.5:
                continue

            # Попытка извлечь полное описание начиная с этого параграфа
            complete_desc = self._extract_complete_description(
                paragraphs, idx, used_indices
            )

            if complete_desc and self._validate_description(complete_desc):
                descriptions.append(complete_desc)
                # Отметить использованные параграфы
                for i in range(
                    complete_desc.start_paragraph_idx,
                    complete_desc.end_paragraph_idx + 1,
                ):
                    used_indices.add(i)

        # Сортировать по длине (приоритет длинным описаниям)
        descriptions.sort(key=lambda d: d.char_length, reverse=True)

        return descriptions

    def _extract_complete_description(
        self, paragraphs: List[Paragraph], start_idx: int, used_indices: set
    ) -> Optional[CompleteDescription]:
        """
        Извлечь полное описание начиная с заданного параграфа.

        Args:
            paragraphs: Список всех параграфов
            start_idx: Индекс начального параграфа
            used_indices: Множество уже использованных индексов

        Returns:
            CompleteDescription или None если не найдено
        """
        current_paragraphs = [paragraphs[start_idx]]
        current_length = paragraphs[start_idx].char_length
        current_text = paragraphs[start_idx].text

        # Lookahead window: до 20 параграфов вперед
        max_look_idx = min(
            start_idx + self.config.lookahead_window_paragraphs, len(paragraphs)
        )

        for i in range(start_idx + 1, max_look_idx):
            # Пропустить уже использованные параграфы
            if i in used_indices:
                break

            next_para = paragraphs[i]

            # Проверка 1: Проверить ограничение по длине
            if current_length + next_para.char_length > self.config.max_char_length:
                break

            # Проверка 2: Проверить тип параграфа
            if next_para.type == ParagraphType.DIALOG:
                break  # Диалог = явный stop signal

            if next_para.type == ParagraphType.META:
                break  # Мета-текст = stop signal

            # Проверка 3: Проверить stop signals
            if self._has_stop_signal(next_para.text):
                break

            # Проверка 4: Вычислить coherence score с текущим описанием
            coherence = self._calculate_coherence(
                current_text, next_para.text, current_paragraphs, next_para
            )

            if coherence < self.config.min_coherence_score:
                break

            # Проверка 5: Если параграф NARRATIVE, проверить описательность
            if next_para.type == ParagraphType.NARRATIVE:
                if next_para.descriptiveness_score < 0.4:
                    break

            # ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - добавить параграф
            current_paragraphs.append(next_para)
            current_text += "\n\n" + next_para.text
            current_length += next_para.char_length

        # Проверить минимальную длину
        if current_length < self.config.min_char_length:
            return None

        # Вычислить boundary confidence
        boundary_confidence = self._calculate_boundary_confidence(
            paragraphs, start_idx, start_idx + len(current_paragraphs) - 1
        )

        # Вычислить общий coherence score
        overall_coherence = self._calculate_overall_coherence(current_paragraphs)

        return CompleteDescription(
            paragraphs=current_paragraphs,
            text=current_text,
            start_paragraph_idx=start_idx,
            end_paragraph_idx=start_idx + len(current_paragraphs) - 1,
            char_length=current_length,
            paragraph_count=len(current_paragraphs),
            coherence_score=overall_coherence,
            boundary_confidence=boundary_confidence,
            metadata={
                "avg_descriptiveness": sum(
                    p.descriptiveness_score for p in current_paragraphs
                )
                / len(current_paragraphs),
            },
        )

    def _has_stop_signal(self, text: str) -> bool:
        """
        Проверить наличие stop signal в тексте.

        Args:
            text: Текст для проверки

        Returns:
            True если найден stop signal
        """
        # Проверить паттерны stop signals
        if self.stop_pattern.search(text):
            return True

        # Проверить начало диалога
        if text.strip().startswith(("—", "–", "«")):
            return True

        return False

    def _calculate_coherence(
        self,
        current_text: str,
        next_text: str,
        current_paragraphs: List[Paragraph],
        next_paragraph: Paragraph,
    ) -> float:
        """
        Вычислить coherence score между текущим описанием и следующим параграфом.

        Факторы:
        - Наличие continuation signals в начале следующего параграфа (40%)
        - Совпадение типов параграфов (20%)
        - Наличие общих визуальных слов (20%)
        - Местоименные ссылки (20%)

        Args:
            current_text: Текст текущего описания
            next_text: Текст следующего параграфа
            current_paragraphs: Список текущих параграфов
            next_paragraph: Следующий параграф

        Returns:
            Coherence score от 0.0 до 1.0
        """
        score = 0.0

        # Фактор 1: Continuation signals (40%)
        if self.continuation_pattern.match(next_text):
            score += 0.4

        # Фактор 2: Совпадение типов (20%)
        last_para = current_paragraphs[-1]
        if last_para.type == next_paragraph.type:
            score += 0.2
        elif (
            last_para.type == ParagraphType.DESCRIPTION
            and next_paragraph.type == ParagraphType.MIXED
        ):
            score += 0.15
        elif (
            last_para.type == ParagraphType.MIXED
            and next_paragraph.type == ParagraphType.DESCRIPTION
        ):
            score += 0.15

        # Фактор 3: Общие визуальные слова (20%)
        current_words = set(current_text.lower().split())
        next_words = set(next_text.lower().split())
        visual_words_current = current_words & self.config.visual_keywords.get(
            "colors", set()
        )
        visual_words_next = next_words & self.config.visual_keywords.get(
            "colors", set()
        )
        if visual_words_current and visual_words_next:
            overlap = len(visual_words_current & visual_words_next)
            if overlap > 0:
                score += 0.2

        # Фактор 4: Местоименные ссылки (20%)
        if self.pronoun_pattern.match(next_text):
            score += 0.2

        return min(score, 1.0)

    def _calculate_overall_coherence(self, paragraphs: List[Paragraph]) -> float:
        """
        Вычислить общий coherence score для набора параграфов.

        Args:
            paragraphs: Список параграфов

        Returns:
            Средний coherence score
        """
        if len(paragraphs) <= 1:
            return 1.0

        coherence_scores = []
        for i in range(len(paragraphs) - 1):
            current_text = "\n\n".join(p.text for p in paragraphs[: i + 1])
            next_para = paragraphs[i + 1]
            coherence = self._calculate_coherence(
                current_text, next_para.text, paragraphs[: i + 1], next_para
            )
            coherence_scores.append(coherence)

        return sum(coherence_scores) / len(coherence_scores)

    def _calculate_boundary_confidence(
        self, all_paragraphs: List[Paragraph], start_idx: int, end_idx: int
    ) -> float:
        """
        Вычислить уверенность в корректности границ описания.

        Факторы:
        - Описательность начального параграфа (30%)
        - Наличие stop signal после конечного параграфа (30%)
        - Плавность перехода на границах (20%)
        - Отсутствие внутренних разрывов (20%)

        Args:
            all_paragraphs: Весь список параграфов
            start_idx: Индекс начала описания
            end_idx: Индекс конца описания

        Returns:
            Boundary confidence от 0.0 до 1.0
        """
        score = 0.0

        # Фактор 1: Описательность начального параграфа (30%)
        start_para = all_paragraphs[start_idx]
        score += 0.3 * start_para.descriptiveness_score

        # Фактор 2: Stop signal после конечного параграфа (30%)
        if end_idx + 1 < len(all_paragraphs):
            next_para = all_paragraphs[end_idx + 1]
            if (
                self._has_stop_signal(next_para.text)
                or next_para.type == ParagraphType.DIALOG
            ):
                score += 0.3
        else:
            # Конец текста = хорошая граница
            score += 0.3

        # Фактор 3: Плавность перехода на границах (20%)
        # Проверить, что начало не обрывается и конец завершается
        start_text = start_para.text.strip()
        end_text = all_paragraphs[end_idx].text.strip()

        # Начало должно быть с заглавной буквы
        if start_text[0].isupper():
            score += 0.1

        # Конец должен быть с точкой
        if end_text.endswith((".", "!", "?")):
            score += 0.1

        # Фактор 4: Отсутствие внутренних разрывов (20%)
        # Проверить, что нет параграфов с очень низкой описательностью внутри
        internal_paras = all_paragraphs[start_idx : end_idx + 1]
        min_internal_descriptiveness = min(
            p.descriptiveness_score for p in internal_paras
        )
        if min_internal_descriptiveness >= 0.3:
            score += 0.2
        elif min_internal_descriptiveness >= 0.2:
            score += 0.1

        return min(score, 1.0)

    def _validate_description(self, description: CompleteDescription) -> bool:
        """
        Валидировать извлеченное описание.

        Проверки:
        1. Длина в допустимом диапазоне (500-4000 символов)
        2. Минимальный coherence score (0.4)
        3. Минимальный boundary confidence (0.5)
        4. Хотя бы один параграф с высокой описательностью (>0.6)

        Args:
            description: Описание для валидации

        Returns:
            True если описание валидно
        """
        # Проверка 1: Длина
        if not self.config.is_valid_length(description.char_length):
            return False

        # Проверка 2: Coherence
        if description.coherence_score < 0.4:
            return False

        # Проверка 3: Boundary confidence
        if description.boundary_confidence < 0.5:
            return False

        # Проверка 4: Хотя бы один параграф с высокой описательностью
        has_high_descriptiveness = any(
            p.descriptiveness_score > 0.6 for p in description.paragraphs
        )
        if not has_high_descriptiveness:
            return False

        return True

    def get_statistics(self, descriptions: List[CompleteDescription]) -> Dict:
        """
        Получить статистику по извлеченным описаниям.

        Args:
            descriptions: Список описаний

        Returns:
            Словарь со статистикой
        """
        if not descriptions:
            return {
                "total": 0,
                "avg_length": 0,
                "avg_paragraphs": 0,
                "avg_coherence": 0,
                "avg_boundary_confidence": 0,
                "length_distribution": {},
            }

        length_distribution = {
            "very_long (2000-3500)": 0,
            "long (1000-2000)": 0,
            "medium (500-1000)": 0,
            "short (100-500)": 0,
        }

        for desc in descriptions:
            if 2000 <= desc.char_length <= 3500:
                length_distribution["very_long (2000-3500)"] += 1
            elif 1000 <= desc.char_length < 2000:
                length_distribution["long (1000-2000)"] += 1
            elif 500 <= desc.char_length < 1000:
                length_distribution["medium (500-1000)"] += 1
            elif 100 <= desc.char_length < 500:
                length_distribution["short (100-500)"] += 1

        return {
            "total": len(descriptions),
            "avg_length": sum(d.char_length for d in descriptions) / len(descriptions),
            "avg_paragraphs": sum(d.paragraph_count for d in descriptions)
            / len(descriptions),
            "avg_coherence": sum(d.coherence_score for d in descriptions)
            / len(descriptions),
            "avg_boundary_confidence": sum(d.boundary_confidence for d in descriptions)
            / len(descriptions),
            "length_distribution": length_distribution,
        }
