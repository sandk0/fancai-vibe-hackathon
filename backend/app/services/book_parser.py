"""
Парсер книг EPUB и FB2 для BookReader AI.

Извлекает метаданные, содержимое и структуру книг в поддерживаемых форматах.
"""

import tempfile
import os
import zipfile
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import re

# Библиотеки для парсинга
try:
    import ebooklib
    from ebooklib import epub
    EBOOKLIB_AVAILABLE = True
except ImportError:
    EBOOKLIB_AVAILABLE = False

try:
    from lxml import etree, html
    LXML_AVAILABLE = True
except ImportError:
    LXML_AVAILABLE = False

from bs4 import BeautifulSoup
import hashlib


@dataclass
class BookMetadata:
    """Метаданные книги."""
    title: str
    author: str = ""
    language: str = "ru"
    genre: str = "other"
    description: str = ""
    isbn: str = ""
    publisher: str = ""
    publish_date: str = ""
    cover_image_data: Optional[bytes] = None
    cover_image_type: str = ""


@dataclass
class BookChapter:
    """Глава книги."""
    number: int
    title: str
    content: str
    html_content: str = ""
    word_count: int = 0


@dataclass
class ParsedBook:
    """Результат парсинга книги."""
    metadata: BookMetadata
    chapters: List[BookChapter]
    total_pages: int = 0
    estimated_reading_time: int = 0  # в минутах
    file_format: str = ""


class BookParser:
    """Главный класс для парсинга книг."""
    
    def __init__(self):
        """Инициализация парсера."""
        self.supported_formats = []
        
        if EBOOKLIB_AVAILABLE:
            self.supported_formats.extend(['epub'])
        
        if LXML_AVAILABLE:
            self.supported_formats.extend(['fb2'])
    
    def is_format_supported(self, file_format: str) -> bool:
        """Проверяет поддержку формата."""
        return file_format.lower() in self.supported_formats
    
    def get_supported_formats(self) -> List[str]:
        """Возвращает список поддерживаемых форматов."""
        return self.supported_formats.copy()
    
    def detect_format(self, file_path: str) -> str:
        """Определяет формат файла книги."""
        file_path = Path(file_path)
        extension = file_path.suffix.lower()
        
        if extension == '.epub':
            return 'epub'
        elif extension == '.fb2':
            return 'fb2'
        elif extension == '.xml':
            # Проверяем, не является ли XML файлом FB2
            try:
                with open(file_path, 'rb') as f:
                    content = f.read(1000)  # Читаем первые 1000 байт
                    if b'FictionBook' in content:
                        return 'fb2'
            except:
                pass
        
        return 'unknown'
    
    def parse_book(self, file_path: str) -> ParsedBook:
        """
        Парсит книгу и извлекает её содержимое.
        
        Args:
            file_path: Путь к файлу книги
            
        Returns:
            Объект ParsedBook с содержимым книги
            
        Raises:
            ValueError: Если формат не поддерживается
            Exception: При ошибках парсинга
        """
        file_format = self.detect_format(file_path)
        
        if file_format == 'epub':
            return self._parse_epub(file_path)
        elif file_format == 'fb2':
            return self._parse_fb2(file_path)
        else:
            raise ValueError(f"Unsupported book format: {file_format}")
    
    def _parse_epub(self, file_path: str) -> ParsedBook:
        """Парсит EPUB файл."""
        if not EBOOKLIB_AVAILABLE:
            raise ImportError("ebooklib is required for EPUB parsing")
        
        try:
            book = epub.read_epub(file_path)
            
            # Извлекаем метаданные
            metadata = self._extract_epub_metadata(book)
            
            # Извлекаем главы
            chapters = self._extract_epub_chapters(book)
            
            # Рассчитываем статистику
            total_words = sum(ch.word_count for ch in chapters)
            estimated_reading_time = max(1, total_words // 200)  # 200 слов в минуту
            total_pages = max(1, total_words // 250)  # 250 слов на страницу
            
            return ParsedBook(
                metadata=metadata,
                chapters=chapters,
                total_pages=total_pages,
                estimated_reading_time=estimated_reading_time,
                file_format='epub'
            )
            
        except Exception as e:
            raise Exception(f"Error parsing EPUB file: {str(e)}")
    
    def _parse_fb2(self, file_path: str) -> ParsedBook:
        """Парсит FB2 файл."""
        if not LXML_AVAILABLE:
            raise ImportError("lxml is required for FB2 parsing")
        
        try:
            # Читаем FB2 файл
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Парсим XML
            try:
                root = etree.fromstring(content)
            except etree.XMLSyntaxError:
                # Пробуем исправить некорректный XML
                content_str = content.decode('utf-8', errors='ignore')
                content_str = re.sub(r'<\?xml[^>]*\?>', '', content_str)  # Удаляем XML декларацию
                root = etree.fromstring(content_str.encode('utf-8'))
            
            # Извлекаем метаданные
            metadata = self._extract_fb2_metadata(root)
            
            # Извлекаем главы
            chapters = self._extract_fb2_chapters(root)
            
            # Рассчитываем статистику
            total_words = sum(ch.word_count for ch in chapters)
            estimated_reading_time = max(1, total_words // 200)
            total_pages = max(1, total_words // 250)
            
            return ParsedBook(
                metadata=metadata,
                chapters=chapters,
                total_pages=total_pages,
                estimated_reading_time=estimated_reading_time,
                file_format='fb2'
            )
            
        except Exception as e:
            raise Exception(f"Error parsing FB2 file: {str(e)}")
    
    def _extract_epub_metadata(self, book) -> BookMetadata:
        """Извлекает метаданные из EPUB."""
        metadata = BookMetadata(title="Unknown")
        
        try:
            # Заголовок
            title = book.get_metadata('DC', 'title')
            if title:
                metadata.title = title[0][0]
            
            # Автор
            creators = book.get_metadata('DC', 'creator')
            if creators:
                metadata.author = creators[0][0]
            
            # Язык
            languages = book.get_metadata('DC', 'language')
            if languages:
                metadata.language = languages[0][0]
            
            # Описание
            descriptions = book.get_metadata('DC', 'description')
            if descriptions:
                metadata.description = descriptions[0][0]
            
            # ISBN
            identifiers = book.get_metadata('DC', 'identifier')
            for identifier in identifiers:
                if 'isbn' in str(identifier[1]).lower():
                    metadata.isbn = identifier[0]
                    break
            
            # Издатель
            publishers = book.get_metadata('DC', 'publisher')
            if publishers:
                metadata.publisher = publishers[0][0]
            
            # Дата публикации
            dates = book.get_metadata('DC', 'date')
            if dates:
                metadata.publish_date = dates[0][0]
            
            # Обложка
            cover_found = False
            
            # Сначала пробуем найти по типу ITEM_COVER
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_COVER:
                    metadata.cover_image_data = item.get_content()
                    metadata.cover_image_type = item.media_type
                    cover_found = True
                    break
            
            # Если не нашли, ищем по имени среди изображений
            if not cover_found:
                for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                    name = item.get_name().lower()
                    if 'cover' in name:
                        metadata.cover_image_data = item.get_content()
                        metadata.cover_image_type = item.media_type or 'image/jpeg'
                        cover_found = True
                        break
            
            # Если всё ещё не нашли, берем первое изображение
            if not cover_found:
                images = list(book.get_items_of_type(ebooklib.ITEM_IMAGE))
                if images:
                    metadata.cover_image_data = images[0].get_content()
                    metadata.cover_image_type = images[0].media_type or 'image/jpeg'
            
        except Exception as e:
            print(f"Warning: Error extracting EPUB metadata: {e}")
        
        return metadata
    
    def _extract_epub_chapters(self, book) -> List[BookChapter]:
        """Извлекает главы из EPUB."""
        chapters = []
        chapter_number = 1
        
        try:
            # Получаем все HTML документы
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    content = item.get_content().decode('utf-8')
                    
                    # Извлекаем текст из HTML
                    soup = BeautifulSoup(content, 'html.parser')
                    
                    # Удаляем скрипты и стили
                    for tag in soup(["script", "style"]):
                        tag.decompose()
                    
                    # Получаем чистый текст
                    text_content = soup.get_text()
                    text_content = re.sub(r'\s+', ' ', text_content).strip()
                    
                    # Пропускаем слишком короткий контент
                    if len(text_content) < 100:
                        continue
                    
                    # Пытаемся извлечь заголовок
                    title = ""
                    for tag in ['h1', 'h2', 'h3', 'title']:
                        title_tag = soup.find(tag)
                        if title_tag:
                            title = title_tag.get_text().strip()
                            break
                    
                    if not title:
                        title = f"Глава {chapter_number}"
                    
                    # Подсчитываем слова
                    word_count = len(text_content.split())
                    
                    chapter = BookChapter(
                        number=chapter_number,
                        title=title,
                        content=text_content,
                        html_content=content,
                        word_count=word_count
                    )
                    
                    chapters.append(chapter)
                    chapter_number += 1
            
        except Exception as e:
            print(f"Warning: Error extracting EPUB chapters: {e}")
        
        return chapters
    
    def _extract_fb2_metadata(self, root) -> BookMetadata:
        """Извлекает метаданные из FB2."""
        metadata = BookMetadata(title="Unknown")
        
        try:
            # Пространства имён для FB2
            namespaces = {'fb': 'http://www.gribuser.ru/xml/fictionbook/2.0'}
            
            # Заголовок
            title_elem = root.find('.//fb:book-title', namespaces)
            if title_elem is not None and title_elem.text:
                metadata.title = title_elem.text.strip()
            
            # Автор
            author_elems = root.findall('.//fb:author', namespaces)
            if author_elems:
                author_parts = []
                for author in author_elems[:1]:  # Берём первого автора
                    first_name = author.find('.//fb:first-name', namespaces)
                    last_name = author.find('.//fb:last-name', namespaces)
                    middle_name = author.find('.//fb:middle-name', namespaces)
                    
                    if first_name is not None and first_name.text:
                        author_parts.append(first_name.text.strip())
                    if middle_name is not None and middle_name.text:
                        author_parts.append(middle_name.text.strip())
                    if last_name is not None and last_name.text:
                        author_parts.append(last_name.text.strip())
                
                if author_parts:
                    metadata.author = " ".join(author_parts)
            
            # Жанр
            genre_elem = root.find('.//fb:genre', namespaces)
            if genre_elem is not None and genre_elem.text:
                metadata.genre = genre_elem.text.strip()
            
            # Язык
            lang_elem = root.find('.//fb:lang', namespaces)
            if lang_elem is not None and lang_elem.text:
                metadata.language = lang_elem.text.strip()
            
            # Описание/аннотация
            annotation_elem = root.find('.//fb:annotation', namespaces)
            if annotation_elem is not None:
                # Извлекаем текст из всех параграфов аннотации
                paragraphs = annotation_elem.findall('.//fb:p', namespaces)
                if paragraphs:
                    description_parts = []
                    for p in paragraphs:
                        if p.text:
                            description_parts.append(p.text.strip())
                    metadata.description = " ".join(description_parts)
            
            # Дата публикации
            date_elem = root.find('.//fb:date', namespaces)
            if date_elem is not None and date_elem.text:
                metadata.publish_date = date_elem.text.strip()
            
        except Exception as e:
            print(f"Warning: Error extracting FB2 metadata: {e}")
        
        return metadata
    
    def _extract_fb2_chapters(self, root) -> List[BookChapter]:
        """Извлекает главы из FB2."""
        chapters = []
        
        try:
            namespaces = {'fb': 'http://www.gribuser.ru/xml/fictionbook/2.0'}
            
            # Ищем секции (главы)
            sections = root.findall('.//fb:section', namespaces)
            
            chapter_number = 1
            for section in sections:
                # Извлекаем заголовок
                title = ""
                title_elem = section.find('.//fb:title', namespaces)
                if title_elem is not None:
                    title_parts = []
                    for p in title_elem.findall('.//fb:p', namespaces):
                        if p.text:
                            title_parts.append(p.text.strip())
                    if title_parts:
                        title = " ".join(title_parts)
                
                if not title:
                    title = f"Глава {chapter_number}"
                
                # Извлекаем содержимое
                content_parts = []
                paragraphs = section.findall('.//fb:p', namespaces)
                
                for p in paragraphs:
                    # Пропускаем параграфы из заголовков
                    if p.getparent().tag.endswith('title'):
                        continue
                    
                    if p.text:
                        content_parts.append(p.text.strip())
                
                content = " ".join(content_parts)
                content = re.sub(r'\s+', ' ', content).strip()
                
                # Пропускаем слишком короткие секции
                if len(content) < 100:
                    continue
                
                word_count = len(content.split())
                
                chapter = BookChapter(
                    number=chapter_number,
                    title=title,
                    content=content,
                    html_content="",  # FB2 не содержит HTML
                    word_count=word_count
                )
                
                chapters.append(chapter)
                chapter_number += 1
        
        except Exception as e:
            print(f"Warning: Error extracting FB2 chapters: {e}")
        
        return chapters
    
    def validate_book_file(self, file_path: str) -> Dict[str, Any]:
        """
        Валидирует файл книги.
        
        Args:
            file_path: Путь к файлу
            
        Returns:
            Словарь с результатами валидации
        """
        result = {
            "is_valid": False,
            "format": "unknown",
            "error": None,
            "file_size": 0,
            "estimated_chapters": 0
        }
        
        try:
            if not os.path.exists(file_path):
                result["error"] = "File not found"
                return result
            
            file_size = os.path.getsize(file_path)
            result["file_size"] = file_size
            
            # Проверяем размер файла (макс 50MB)
            if file_size > 50 * 1024 * 1024:
                result["error"] = "File too large (max 50MB)"
                return result
            
            if file_size < 1024:  # Мин 1KB
                result["error"] = "File too small"
                return result
            
            file_format = self.detect_format(file_path)
            result["format"] = file_format
            
            if not self.is_format_supported(file_format):
                result["error"] = f"Unsupported format: {file_format}"
                return result
            
            # Пробуем парсить для проверки валидности
            try:
                parsed_book = self.parse_book(file_path)
                result["is_valid"] = True
                result["estimated_chapters"] = len(parsed_book.chapters)
            except Exception as e:
                result["error"] = f"Parse error: {str(e)}"
                return result
            
        except Exception as e:
            result["error"] = f"Validation error: {str(e)}"
        
        return result


# Глобальный экземпляр парсера
book_parser = BookParser()