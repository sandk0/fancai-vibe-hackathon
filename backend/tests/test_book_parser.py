"""
Тесты для Book Parser - парсер EPUB и FB2 книг с CFI генерацией.

Проверяем парсинг метаданных, глав, CFI и обработку ошибок.
"""

import pytest
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from io import BytesIO

from app.services.book_parser import (
    BookParser,
    BookMetadata,
    BookChapter,
    ParsedBook,
    ParserConfig
)


@pytest.fixture
def book_parser():
    """Fixture для BookParser."""
    return BookParser()


@pytest.fixture
def parser_config():
    """Fixture для конфигурации парсера."""
    return ParserConfig(
        min_chapter_length=100,
        min_content_length_for_analysis=500,
        max_file_size=50 * 1024 * 1024
    )


@pytest.fixture
def sample_epub_file():
    """Создает временный EPUB файл для тестирования."""
    # Создаем простой EPUB структуру
    epub_content = {
        'mimetype': b'application/epub+zip',
        'META-INF/container.xml': b'''<?xml version="1.0"?>
            <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                <rootfiles>
                    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
                </rootfiles>
            </container>''',
        'OEBPS/content.opf': b'''<?xml version="1.0"?>
            <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
                <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                    <dc:title>Test Book</dc:title>
                    <dc:creator>Test Author</dc:creator>
                    <dc:language>ru</dc:language>
                    <dc:identifier id="bookid">test-123</dc:identifier>
                </metadata>
                <manifest>
                    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
                    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
                </manifest>
                <spine toc="ncx">
                    <itemref idref="chapter1"/>
                </spine>
            </package>''',
        'OEBPS/chapter1.xhtml': b'''<?xml version="1.0" encoding="UTF-8"?>
            <html xmlns="http://www.w3.org/1999/xhtml">
                <head><title>Chapter 1</title></head>
                <body>
                    <h1>Chapter 1: The Beginning</h1>
                    <p>This is the first chapter content with a beautiful dark forest and tall pine trees.</p>
                    <p>The old cabin stood in the middle of the clearing.</p>
                </body>
            </html>''',
        'OEBPS/toc.ncx': b'''<?xml version="1.0" encoding="UTF-8"?>
            <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
                <navMap>
                    <navPoint id="chapter1">
                        <navLabel><text>Chapter 1</text></navLabel>
                        <content src="chapter1.xhtml"/>
                    </navPoint>
                </navMap>
            </ncx>'''
    }

    # Создаем временный ZIP файл
    temp_file = tempfile.NamedTemporaryFile(suffix='.epub', delete=False)
    with zipfile.ZipFile(temp_file.name, 'w', zipfile.ZIP_DEFLATED) as epub_zip:
        for file_path, content in epub_content.items():
            epub_zip.writestr(file_path, content)

    yield temp_file.name

    # Cleanup
    Path(temp_file.name).unlink(missing_ok=True)


@pytest.fixture
def sample_fb2_content():
    """Пример FB2 контента."""
    return b'''<?xml version="1.0" encoding="UTF-8"?>
    <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
        <description>
            <title-info>
                <genre>prose</genre>
                <author>
                    <first-name>Test</first-name>
                    <last-name>Author</last-name>
                </author>
                <book-title>Test FB2 Book</book-title>
                <lang>ru</lang>
            </title-info>
        </description>
        <body>
            <section>
                <title><p>Chapter 1</p></title>
                <p>First chapter content here.</p>
            </section>
        </body>
    </FictionBook>'''


class TestBookParserInitialization:
    """Тесты инициализации парсера."""

    def test_parser_creation(self, book_parser):
        """Тест создания парсера."""
        assert book_parser is not None
        assert isinstance(book_parser.config, ParserConfig)

    def test_parser_with_custom_config(self, parser_config):
        """Тест создания парсера с кастомной конфигурацией."""
        parser = BookParser(config=parser_config)
        assert parser.config.min_chapter_length == 100
        assert parser.config.max_file_size == 50 * 1024 * 1024


class TestEPUBParsing:
    """Тесты парсинга EPUB файлов."""

    @pytest.mark.asyncio
    async def test_parse_epub_success(self, book_parser, sample_epub_file):
        """Тест успешного парсинга EPUB файла."""
        result = await book_parser.parse_book(sample_epub_file, file_format="epub")

        assert isinstance(result, ParsedBook)
        assert result.metadata.title == "Test Book"
        assert result.metadata.author == "Test Author"
        assert result.metadata.language == "ru"
        assert result.file_format == "epub"
        assert len(result.chapters) > 0

    @pytest.mark.asyncio
    async def test_parse_epub_extracts_chapters(self, book_parser, sample_epub_file):
        """Тест извлечения глав из EPUB."""
        result = await book_parser.parse_book(sample_epub_file, file_format="epub")

        assert len(result.chapters) >= 1
        chapter = result.chapters[0]
        assert isinstance(chapter, BookChapter)
        assert chapter.number == 1
        assert chapter.title == "Chapter 1: The Beginning"
        assert len(chapter.content) > 0
        assert "forest" in chapter.content.lower()

    @pytest.mark.asyncio
    async def test_parse_epub_calculates_statistics(self, book_parser, sample_epub_file):
        """Тест расчета статистики книги."""
        result = await book_parser.parse_book(sample_epub_file, file_format="epub")

        assert result.total_pages > 0
        assert result.estimated_reading_time > 0
        assert result.chapters[0].word_count > 0

    @pytest.mark.asyncio
    async def test_parse_epub_generates_cfi(self, book_parser, sample_epub_file):
        """Тест генерации CFI (Canonical Fragment Identifier)."""
        result = await book_parser.parse_book(sample_epub_file, file_format="epub")

        # Генерируем CFI для позиции в первой главе
        chapter = result.chapters[0]
        cfi = book_parser.generate_cfi(chapter_number=1, paragraph_index=0)

        assert cfi is not None
        assert isinstance(cfi, str)
        assert "epubcfi(" in cfi.lower() or "/" in cfi  # CFI формат

    @pytest.mark.asyncio
    async def test_parse_epub_with_cover_image(self, book_parser):
        """Тест извлечения обложки из EPUB."""
        # Создаем EPUB с обложкой
        epub_content = {
            'mimetype': b'application/epub+zip',
            'META-INF/container.xml': b'''<?xml version="1.0"?>
                <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                    <rootfiles>
                        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
                    </rootfiles>
                </container>''',
            'OEBPS/content.opf': b'''<?xml version="1.0"?>
                <package xmlns="http://www.idpf.org/2007/opf">
                    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                        <dc:title>Book with Cover</dc:title>
                        <dc:creator>Author</dc:creator>
                        <meta name="cover" content="cover-image"/>
                    </metadata>
                    <manifest>
                        <item id="cover-image" href="cover.jpg" media-type="image/jpeg"/>
                    </manifest>
                    <spine><itemref idref="chapter1"/></spine>
                </package>''',
            'OEBPS/cover.jpg': b'\xff\xd8\xff\xe0'  # Fake JPEG header
        }

        temp_file = tempfile.NamedTemporaryFile(suffix='.epub', delete=False)
        with zipfile.ZipFile(temp_file.name, 'w') as epub_zip:
            for path, content in epub_content.items():
                epub_zip.writestr(path, content)

        try:
            result = await book_parser.parse_book(temp_file.name, file_format="epub")

            assert result.metadata.cover_image_data is not None
            assert result.metadata.cover_image_type in ["image/jpeg", "jpeg"]
        finally:
            Path(temp_file.name).unlink(missing_ok=True)


class TestFB2Parsing:
    """Тесты парсинга FB2 файлов."""

    @pytest.mark.asyncio
    async def test_parse_fb2_success(self, book_parser, sample_fb2_content):
        """Тест успешного парсинга FB2 файла."""
        temp_file = tempfile.NamedTemporaryFile(suffix='.fb2', delete=False, mode='wb')
        temp_file.write(sample_fb2_content)
        temp_file.close()

        try:
            result = await book_parser.parse_book(temp_file.name, file_format="fb2")

            assert isinstance(result, ParsedBook)
            assert result.metadata.title == "Test FB2 Book"
            assert result.metadata.author == "Test Author"
            assert result.file_format == "fb2"
            assert len(result.chapters) > 0
        finally:
            Path(temp_file.name).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_parse_fb2_extracts_chapters(self, book_parser, sample_fb2_content):
        """Тест извлечения глав из FB2."""
        temp_file = tempfile.NamedTemporaryFile(suffix='.fb2', delete=False, mode='wb')
        temp_file.write(sample_fb2_content)
        temp_file.close()

        try:
            result = await book_parser.parse_book(temp_file.name, file_format="fb2")

            assert len(result.chapters) >= 1
            chapter = result.chapters[0]
            assert chapter.title == "Chapter 1"
            assert "First chapter content" in chapter.content
        finally:
            Path(temp_file.name).unlink(missing_ok=True)


class TestCFIGeneration:
    """Тесты генерации CFI (Canonical Fragment Identifier)."""

    def test_generate_cfi_for_chapter(self, book_parser):
        """Тест генерации CFI для главы."""
        cfi = book_parser.generate_cfi(chapter_number=1, paragraph_index=0)

        assert cfi is not None
        assert isinstance(cfi, str)

    def test_generate_cfi_with_offset(self, book_parser):
        """Тест генерации CFI с offset."""
        cfi = book_parser.generate_cfi(
            chapter_number=2,
            paragraph_index=5,
            character_offset=123
        )

        assert cfi is not None
        # CFI должен содержать информацию о позиции

    def test_parse_cfi(self, book_parser):
        """Тест парсинга CFI обратно в позицию."""
        original_cfi = book_parser.generate_cfi(chapter_number=3, paragraph_index=2)

        # Парсим CFI обратно
        position = book_parser.parse_cfi(original_cfi)

        assert position is not None
        assert "chapter" in position or "chapter_number" in position


class TestErrorHandling:
    """Тесты обработки ошибок."""

    @pytest.mark.asyncio
    async def test_parse_nonexistent_file(self, book_parser):
        """Тест парсинга несуществующего файла."""
        with pytest.raises(FileNotFoundError):
            await book_parser.parse_book("/nonexistent/file.epub", file_format="epub")

    @pytest.mark.asyncio
    async def test_parse_invalid_format(self, book_parser):
        """Тест парсинга файла неподдерживаемого формата."""
        temp_file = tempfile.NamedTemporaryFile(suffix='.txt', delete=False)
        temp_file.write(b"Not an epub or fb2 file")
        temp_file.close()

        try:
            with pytest.raises(ValueError, match="Unsupported file format"):
                await book_parser.parse_book(temp_file.name, file_format="txt")
        finally:
            Path(temp_file.name).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_parse_corrupted_epub(self, book_parser):
        """Тест парсинга поврежденного EPUB файла."""
        temp_file = tempfile.NamedTemporaryFile(suffix='.epub', delete=False)
        temp_file.write(b"Not a valid ZIP file")
        temp_file.close()

        try:
            with pytest.raises(Exception):  # Может быть различные исключения
                await book_parser.parse_book(temp_file.name, file_format="epub")
        finally:
            Path(temp_file.name).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_parse_file_too_large(self, book_parser):
        """Тест парсинга слишком большого файла."""
        config = ParserConfig(max_file_size=1024)  # 1KB limit
        parser = BookParser(config=config)

        # Создаем файл больше лимита
        temp_file = tempfile.NamedTemporaryFile(suffix='.epub', delete=False)
        temp_file.write(b"x" * 2048)  # 2KB
        temp_file.close()

        try:
            with pytest.raises(ValueError, match="too large"):
                await parser.parse_book(temp_file.name, file_format="epub")
        finally:
            Path(temp_file.name).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_parse_epub_missing_metadata(self, book_parser):
        """Тест парсинга EPUB без метаданных."""
        # Минимальный EPUB без метаданных
        epub_content = {
            'mimetype': b'application/epub+zip',
            'META-INF/container.xml': b'''<?xml version="1.0"?>
                <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                    <rootfiles>
                        <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
                    </rootfiles>
                </container>''',
            'content.opf': b'''<?xml version="1.0"?>
                <package xmlns="http://www.idpf.org/2007/opf">
                    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                        <dc:title>Untitled</dc:title>
                    </metadata>
                    <manifest></manifest>
                    <spine></spine>
                </package>'''
        }

        temp_file = tempfile.NamedTemporaryFile(suffix='.epub', delete=False)
        with zipfile.ZipFile(temp_file.name, 'w') as epub_zip:
            for path, content in epub_content.items():
                epub_zip.writestr(path, content)

        try:
            result = await book_parser.parse_book(temp_file.name, file_format="epub")

            # Должны быть значения по умолчанию
            assert result.metadata.title == "Untitled"
            assert result.metadata.author == ""  # Default
        finally:
            Path(temp_file.name).unlink(missing_ok=True)


class TestContentCleaning:
    """Тесты очистки контента."""

    def test_clean_html_content(self, book_parser):
        """Тест очистки HTML из контента."""
        html_content = "<p>Text with <b>bold</b> and <i>italic</i> formatting.</p>"
        cleaned = book_parser.clean_html(html_content)

        assert "<b>" not in cleaned
        assert "<i>" not in cleaned
        assert "bold" in cleaned
        assert "italic" in cleaned

    def test_preserve_paragraph_structure(self, book_parser):
        """Тест сохранения структуры параграфов."""
        html_content = "<p>First paragraph.</p><p>Second paragraph.</p>"
        cleaned = book_parser.clean_html(html_content)

        # Параграфы должны быть разделены
        assert "First paragraph" in cleaned
        assert "Second paragraph" in cleaned


class TestMetadataExtraction:
    """Тесты извлечения метаданных."""

    def test_extract_genre_from_metadata(self, book_parser):
        """Тест определения жанра из метаданных."""
        # Тест будет зависеть от реализации
        # Можем мокировать или тестировать с реальными данными
        pass

    def test_extract_isbn(self, book_parser):
        """Тест извлечения ISBN."""
        pass

    def test_extract_publisher_info(self, book_parser):
        """Тест извлечения информации об издателе."""
        pass
