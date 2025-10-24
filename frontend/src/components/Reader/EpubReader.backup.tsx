import { useState, useEffect, useCallback, useRef } from 'react';
import ePub from 'epubjs';
import type { Book, Rendition } from 'epubjs';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import { STORAGE_KEYS } from '@/types/state';
import type { BookDetail, Description, GeneratedImage } from '@/types/api';
import { ImageModal } from '@/components/Images/ImageModal';

interface EpubReaderProps {
  book: BookDetail;
}

export const EpubReader: React.FC<EpubReaderProps> = ({ book }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [renditionReady, setRenditionReady] = useState(false);
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const restoredCfi = useRef<string | null>(null); // CFI который восстанавливаем

  // Функция для извлечения номера главы из location
  const getChapterFromLocation = useCallback((location: any): number => {
    try {
      if (!bookRef.current) return 1;

      // Получаем текущий href spine элемента
      const currentHref = location?.start?.href;
      if (!currentHref) {
        console.warn('⚠️ No href in location');
        return 1;
      }

      // Получаем spine из книги
      const spine = (bookRef.current as any).spine;
      if (!spine || !spine.items) {
        console.warn('⚠️ No spine items');
        return 1;
      }

      // Находим индекс текущего spine элемента
      const spineIndex = spine.items.findIndex((item: any) => {
        return item.href === currentHref || item.href.includes(currentHref);
      });

      if (spineIndex === -1) {
        console.warn('⚠️ Spine item not found for href:', currentHref);
        return 1;
      }

      // ВАЖНО: chapter_number в БД = порядковый номер в spine (начиная с 1)
      // Парсер EPUB нумерует главы последовательно по spine (включая предисловие и т.д.)
      const chapter = spineIndex + 1;
      console.log(`📖 Chapter detected: ${chapter} (spine index: ${spineIndex}, href: ${currentHref})`);
      return Math.max(1, chapter);

    } catch (error) {
      console.error('❌ Error extracting chapter from location:', error);
      return 1;
    }
  }, []);

  // Инициализация epub.js и загрузка книги
  useEffect(() => {
    if (!isReady) {
      console.log('⏳ Component not ready yet');
      return;
    }

    const initEpub = async () => {
      if (!viewerRef.current) {
        console.error('❌ Viewer ref is null');
        setError('Viewer container not found');
        return;
      }

      try {
        console.log('📥 Downloading EPUB file...');

        // Загружаем файл через fetch (с авторизацией)
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const response = await fetch(booksAPI.getBookFileUrl(book.id), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to download EPUB: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('✅ EPUB file downloaded successfully', {
          size: arrayBuffer.byteLength
        });

        // Инициализируем epub.js напрямую с ArrayBuffer
        const epubBook = ePub(arrayBuffer);
        bookRef.current = epubBook;

        // Ждем полной загрузки книги
        console.log('⏳ Waiting for book to load...');
        await epubBook.ready;
        console.log('✅ Book ready');

        // Генерируем locations для отслеживания прогресса (ПОСЛЕ загрузки книги)
        console.log('📊 Generating locations for progress tracking...');
        await epubBook.locations.generate(1600); // 1600 символов на "страницу"
        const locationsTotal = (epubBook.locations as any).total || 0;
        console.log('✅ Locations generated:', locationsTotal);

        // ДИАГНОСТИКА: Проверяем что locations действительно готовы
        console.log('🔍 Locations ready check:', {
          total: locationsTotal,
          length: epubBook.locations.length(),
          hasPercentageFromCfi: typeof epubBook.locations.percentageFromCfi === 'function',
          hasCfiFromPercentage: typeof epubBook.locations.cfiFromPercentage === 'function'
        });

        if (locationsTotal <= 0) {
          console.warn('⚠️ Locations not generated, falling back to manual calculation');
        }

        // Создаем rendition
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Применяем темную тему
        rendition.themes.default({
          body: {
            color: '#e5e7eb !important',
            background: '#1f2937 !important',
            'font-family': 'Georgia, serif !important',
            'font-size': '1.1em !important',
            'line-height': '1.6 !important',
          },
          p: {
            'margin-bottom': '1em !important',
          },
          a: {
            color: '#60a5fa !important',
          },
        });

        // Обработчик изменения позиции (подписываемся ДО display чтобы не пропустить событие)
        rendition.on('relocated', async (location: any) => {
          const cfi = location.start.cfi;

          // Определяем текущую главу из location и обновляем
          // React автоматически пропустит обновление если значение не изменилось
          const chapter = getChapterFromLocation(location);
          setCurrentChapter(chapter);

          // ДИАГНОСТИКА: Логируем каждое relocated событие
          console.log('🔄 relocated event fired:', {
            cfi: cfi.substring(0, 80) + '...',
            fullCfi: cfi,
            chapter,
            restoredCfi: restoredCfi.current?.substring(0, 80) + '...',
            isExactMatch: cfi === restoredCfi.current,
            hasRestoredCfi: !!restoredCfi.current
          });

          // Пропускаем все relocated события с CFI, который мы только что восстановили
          // (epub.js может генерировать несколько relocated при display())
          if (restoredCfi.current && cfi === restoredCfi.current) {
            console.log('⏳ Skipping relocated event - EXACT match with restored position');
            return;
          }

          // Проверяем близость CFI даже если не точное совпадение
          if (restoredCfi.current) {
            // Сравниваем по проценту если CFI не совпадают
            let restoredPercent = 0;
            let currentPercent = 0;

            const locTotal = (epubBook.locations as any).total || 0;
            if (epubBook.locations && locTotal > 0) {
              restoredPercent = Math.round((epubBook.locations.percentageFromCfi(restoredCfi.current) || 0) * 100);
              currentPercent = Math.round((epubBook.locations.percentageFromCfi(cfi) || 0) * 100);

              console.log('🔍 Comparing positions:', {
                restoredPercent: restoredPercent + '%',
                currentPercent: currentPercent + '%',
                diff: Math.abs(currentPercent - restoredPercent) + '%',
                withinThreshold: Math.abs(currentPercent - restoredPercent) <= 3
              });

              // Если в пределах 3% - это скорее всего округление epub.js, пропускаем
              // (epub.js может корректировать CFI к началу параграфа/узла)
              if (Math.abs(currentPercent - restoredPercent) <= 3) {
                console.log('⏳ Skipping relocated event - within 3% of restored position (epub.js rounding)');
                restoredCfi.current = null; // Сбрасываем т.к. это первое событие после restore
                return;
              }
            }

            console.log('✅ First real page turn detected, auto-save now enabled');
            restoredCfi.current = null;
          }

          // Вычисляем прогресс
          let progressPercent = 0;

          const locationsTotal = (epubBook.locations as any)?.total || 0;
          if (epubBook.locations && locationsTotal > 0) {
            // Используем locations если они сгенерированы
            const currentLocation = epubBook.locations.percentageFromCfi(cfi);
            progressPercent = Math.round((currentLocation || 0) * 100);

            // ДИАГНОСТИКА: Детальное логирование расчета прогресса
            console.log('📊 Progress calculation (via locations):', {
              rawPercentage: currentLocation,
              roundedPercent: progressPercent + '%',
              locationsTotal,
              cfiLength: cfi.length
            });
          } else {
            // Альтернативный расчет через currentLocation()
            const current = rendition.currentLocation() as any;
            if (current && current.start && current.start.percentage !== undefined) {
              progressPercent = Math.round(current.start.percentage * 100);

              console.log('📊 Progress calculation (via currentLocation):', {
                rawPercentage: current.start.percentage,
                roundedPercent: progressPercent + '%'
              });
            }
          }

          console.log('📍 Location changed:', {
            cfi: cfi.substring(0, 50) + '...',
            progress: progressPercent + '%',
            locationsTotal
          });

          // Debounced сохранение
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }

          saveTimeoutRef.current = setTimeout(async () => {
            try {
              // Вычисляем точный процент скролла внутри iframe
              let scrollOffsetPercent = 0.0;
              const contents = rendition.getContents() as any;
              if (contents && contents.length > 0) {
                const iframe = contents[0];
                const doc = iframe.document;
                if (doc && doc.documentElement) {
                  const scrollTop = doc.documentElement.scrollTop || doc.body?.scrollTop || 0;
                  const scrollHeight = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 0;
                  const clientHeight = doc.documentElement.clientHeight || doc.body?.clientHeight || 0;
                  const maxScroll = scrollHeight - clientHeight;

                  if (maxScroll > 0) {
                    scrollOffsetPercent = (scrollTop / maxScroll) * 100;
                  }

                  console.log('📏 Scroll metrics:', {
                    scrollTop,
                    scrollHeight,
                    clientHeight,
                    maxScroll,
                    scrollOffsetPercent: scrollOffsetPercent.toFixed(2) + '%'
                  });
                }
              }

              await booksAPI.updateReadingProgress(book.id, {
                current_chapter: 1,
                current_position_percent: progressPercent,
                reading_location_cfi: cfi,
                scroll_offset_percent: scrollOffsetPercent,
              });
              console.log('💾 Reading progress saved:', {
                cfi: cfi.substring(0, 50),
                progress: progressPercent + '%',
                scrollOffset: scrollOffsetPercent.toFixed(2) + '%'
              });
            } catch (error) {
              console.error('❌ Error saving reading progress:', error);
            }
          }, 2000);
        });

        // Загружаем прогресс чтения
        const { progress } = await booksAPI.getReadingProgress(book.id);

        if (progress?.reading_location_cfi) {
          const savedCfi = progress.reading_location_cfi;
          const savedPercent = progress.current_position || 0;

          // ДИАГНОСТИКА: Логируем запрошенную позицию
          console.log('📖 Attempting to restore position:', {
            savedCfi: savedCfi.substring(0, 80) + '...',
            savedPercent: savedPercent + '%',
            fullCfi: savedCfi
          });

          // Проверяем что percentageFromCfi работает ДО display
          const locTotal = (epubBook.locations as any)?.total || 0;
          if (epubBook.locations && locTotal > 0) {
            const testPercent = epubBook.locations.percentageFromCfi(savedCfi);
            console.log('🧪 Testing percentageFromCfi BEFORE display:', {
              result: testPercent,
              asPercent: Math.round((testPercent || 0) * 100) + '%',
              expectedPercent: savedPercent + '%',
              match: Math.round((testPercent || 0) * 100) === savedPercent
            });
          }

          // ВАЖНО: Используем процент для восстановления, а не прямой CFI
          // epub.js может округлять CFI, но locations.cfiFromPercentage() более надежен
          let cfiToRestore = savedCfi;

          if (epubBook.locations && locTotal > 0 && savedPercent > 0) {
            // Вычисляем CFI из процента для более точного восстановления
            const percentValue = savedPercent / 100;
            const cfiFromPercent = epubBook.locations.cfiFromPercentage(percentValue);

            console.log('🔄 Trying cfiFromPercentage approach:', {
              savedPercent: savedPercent + '%',
              percentValue: percentValue,
              cfiFromPercent: cfiFromPercent?.substring(0, 80) + '...',
              savedCfi: savedCfi.substring(0, 80) + '...'
            });

            // Используем CFI из процента если он валиден
            if (cfiFromPercent && cfiFromPercent !== 'epubcfi()') {
              cfiToRestore = cfiFromPercent;
              console.log('✅ Using cfiFromPercentage for more accurate restoration');
            }
          }

          restoredCfi.current = cfiToRestore; // Запоминаем CFI

          // Вызываем display
          await rendition.display(cfiToRestore);

          // ДИАГНОСТИКА: Проверяем куда реально попали СРАЗУ после display
          // Даем небольшую задержку для завершения рендеринга
          await new Promise(resolve => setTimeout(resolve, 300));

          const actualLocation = rendition.currentLocation() as any;
          const actualCfi = actualLocation?.start?.cfi;
          let actualPercent = 0;

          const locationsTotal2 = (epubBook.locations as any)?.total || 0;
          if (epubBook.locations && locationsTotal2 > 0 && actualCfi) {
            const percentValue = epubBook.locations.percentageFromCfi(actualCfi);
            actualPercent = Math.round((percentValue || 0) * 100);

            console.log('🧪 Testing percentageFromCfi AFTER display:', {
              result: percentValue,
              asPercent: actualPercent + '%'
            });
          }

          console.log('🎯 Actually restored to:', {
            actualCfi: actualCfi?.substring(0, 80) + '...',
            actualPercent: actualPercent + '%',
            fullActualCfi: actualCfi,
            cfiMatch: actualCfi === savedCfi,
            percentDiff: Math.abs(actualPercent - savedPercent) + '%'
          });

          // Определяем и устанавливаем текущую главу
          const currentLoc = rendition.currentLocation();
          if (currentLoc) {
            const initialChapter = getChapterFromLocation(currentLoc);
            console.log(`📖 Initial chapter set to: ${initialChapter}`);
            setCurrentChapter(initialChapter);
          }

          if (actualCfi !== savedCfi) {
            console.warn('⚠️ CFI MISMATCH DETECTED!', {
              requested: savedCfi,
              actual: actualCfi,
              requestedPercent: savedPercent + '%',
              actualPercent: actualPercent + '%',
              percentDiff: Math.abs(actualPercent - savedPercent) + '%',
              cfiDiff: {
                requestedLength: savedCfi.length,
                actualLength: actualCfi?.length || 0,
                requestedEnd: savedCfi.substring(savedCfi.length - 20),
                actualEnd: actualCfi?.substring((actualCfi?.length || 0) - 20)
              }
            });
          } else {
            console.log('✅ CFI restoration EXACT MATCH!');
          }

          // HYBRID APPROACH: Применяем точный scroll для компенсации округления CFI
          const savedScrollOffset = progress.scroll_offset_percent || 0;
          if (savedScrollOffset > 0) {
            console.log('🔧 Applying fine-tuned scroll restoration:', {
              savedScrollOffset: savedScrollOffset.toFixed(2) + '%'
            });

            // Ждем еще немного чтобы рендеринг полностью завершился
            await new Promise(resolve => setTimeout(resolve, 200));

            const contents = rendition.getContents() as any;
            if (contents && contents.length > 0) {
              const iframe = contents[0];
              const doc = iframe.document;
              if (doc && doc.documentElement) {
                const scrollHeight = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 0;
                const clientHeight = doc.documentElement.clientHeight || doc.body?.clientHeight || 0;
                const maxScroll = scrollHeight - clientHeight;

                if (maxScroll > 0) {
                  const targetScrollTop = (savedScrollOffset / 100) * maxScroll;
                  doc.documentElement.scrollTop = targetScrollTop;
                  if (doc.body) {
                    doc.body.scrollTop = targetScrollTop;
                  }

                  console.log('✅ Fine-tuned scroll applied:', {
                    targetScrollTop,
                    maxScroll,
                    scrollHeight,
                    clientHeight,
                    requestedOffset: savedScrollOffset.toFixed(2) + '%'
                  });
                }
              }
            }
          }
        } else {
          console.log('📖 Starting from beginning (no saved progress)');
          restoredCfi.current = null; // Нет восстановленной позиции
          await rendition.display();

          // Устанавливаем первую главу
          console.log('📖 Initial chapter set to: 1');
          setCurrentChapter(1);
        }

        console.log('✅ EPUB reader initialized');
        setIsLoading(false);

        // Устанавливаем флаг что rendition готов для highlights
        // С небольшой задержкой чтобы DOM точно был готов
        setTimeout(() => {
          console.log('✅ Rendition ready for highlights');
          setRenditionReady(true);
        }, 500);
      } catch (err) {
        console.error('❌ Error initializing EPUB reader:', err);
        setError(err instanceof Error ? err.message : 'Error loading book');
        setIsLoading(false);
      }
    };

    initEpub();

    // Cleanup
    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [book.id, isReady]);

  // Устанавливаем isReady после первого рендера
  useEffect(() => {
    // Небольшая задержка чтобы убедиться что DOM готов
    const timer = setTimeout(() => {
      console.log('🎯 Setting ready state, viewerRef:', !!viewerRef.current);
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Загрузка описаний и изображений для текущей главы
  useEffect(() => {
    console.log('🔄 useEffect triggered:', {
      bookId: book.id,
      currentChapter,
      condition: book.id && currentChapter > 0
    });

    const loadDescriptionsAndImages = async () => {
      try {
        console.log('📚 Loading descriptions and images for chapter:', currentChapter);

        // Загружаем описания для текущей главы
        const descriptionsResponse = await booksAPI.getChapterDescriptions(
          book.id,
          currentChapter,
          false // не извлекать новые, использовать кэш
        );

        console.log('✅ Descriptions loaded:', descriptionsResponse.nlp_analysis.total_descriptions);
        setDescriptions(descriptionsResponse.nlp_analysis.descriptions || []);

        // Загружаем изображения для этой главы
        const imagesResponse = await imagesAPI.getBookImages(book.id, currentChapter);
        console.log('✅ Images loaded:', imagesResponse.images.length);
        setImages(imagesResponse.images);
      } catch (error: any) {
        console.error('❌ Error loading descriptions/images:', error);
        console.error('❌ Error details:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          bookId: book.id,
          chapter: currentChapter
        });
        // Не показываем ошибку пользователю, просто логируем
        setDescriptions([]);
        setImages([]);
      }
    };

    if (book.id && currentChapter > 0) {
      loadDescriptionsAndImages();
    }
  }, [book.id, currentChapter]); // Перезагружаем при смене главы

  // Функция для выделения описаний в тексте EPUB
  const highlightDescriptionsInText = useCallback(() => {
    if (!renditionRef.current || descriptions.length === 0) {
      return;
    }

    console.log('🎨 Highlighting descriptions in text:', descriptions.length);

    const rendition = renditionRef.current;
    const contents = rendition.getContents() as any;

    if (!contents || contents.length === 0) {
      console.warn('⚠️ No iframe content available for highlighting');
      return;
    }

    const iframe = contents[0];
    const doc = iframe.document;

    if (!doc || !doc.body) {
      console.warn('⚠️ No document body available');
      return;
    }

    // Удаляем старые highlights
    const oldHighlights = doc.querySelectorAll('.description-highlight');
    oldHighlights.forEach((el: Element) => {
      const parent = el.parentNode;
      if (parent) {
        // Заменяем span с highlight на обычный текст
        const textNode = doc.createTextNode(el.textContent || '');
        parent.replaceChild(textNode, el);
        parent.normalize(); // Объединяем соседние text nodes
      }
    });

    // Добавляем новые highlights
    let highlightedCount = 0;
    descriptions.forEach((desc, descIndex) => {
      try {
        const text = desc.content;
        if (!text || text.length < 10) {
          console.log(`⏭️ Skipping description ${descIndex}: too short (${text?.length || 0} chars)`);
          return;
        }

        console.log(`🔍 Searching for description ${descIndex}:`, {
          type: desc.type,
          textPreview: text.substring(0, 100) + '...',
          searchString: text.substring(0, 50)
        });

        // Ищем текст в body
        const walker = doc.createTreeWalker(
          doc.body,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        let found = false;

        // ФИКС: Убираем заголовки глав из поиска
        let searchText = text;
        const chapterHeaderMatch = text.match(/^(Глава (первая|вторая|третья|четвертая|пятая|шестая|седьмая|восьмая|девятая|десятая|одиннадцатая|двенадцатая|тринадцатая|четырнадцатая|пятнадцатая|шестнадцатая|семнадцатая|восемнадцатая|девятнадцатая|двадцатая|\d+))\s+/i);
        if (chapterHeaderMatch) {
          // Пропускаем заголовок главы
          searchText = text.substring(chapterHeaderMatch[0].length).trim();
          console.log(`🔧 Removed chapter header from search: "${chapterHeaderMatch[0]}" -> searching for: "${searchText.substring(0, 50)}..."`);
        }

        if (searchText.length < 10) {
          console.log(`⏭️ Skipping description ${descIndex}: too short after header removal`);
          return;
        }

        while ((node = walker.nextNode())) {
          const nodeText = node.nodeValue || '';
          const index = nodeText.indexOf(searchText.substring(0, 50)); // Ищем первые 50 символов

          if (index !== -1) {
            found = true;
            console.log(`✅ Found match for description ${descIndex} at index ${index}`);
            highlightedCount++;
            const parent = node.parentNode;
            if (!parent || parent.classList?.contains('description-highlight')) {
              continue; // Уже выделено
            }

            // Создаем span для highlight
            const span = doc.createElement('span');
            span.className = 'description-highlight';
            span.setAttribute('data-description-id', desc.id);
            span.setAttribute('data-description-type', desc.type);
            span.style.cssText = `
              background-color: rgba(96, 165, 250, 0.2);
              border-bottom: 2px solid #60a5fa;
              cursor: pointer;
              transition: background-color 0.2s;
            `;

            // Hover effect
            span.addEventListener('mouseenter', () => {
              span.style.backgroundColor = 'rgba(96, 165, 250, 0.3)';
            });
            span.addEventListener('mouseleave', () => {
              span.style.backgroundColor = 'rgba(96, 165, 250, 0.2)';
            });

            // Click handler
            span.addEventListener('click', () => {
              console.log('🖱️ Description clicked:', desc.id);

              // Находим изображение для этого описания
              const image = images.find(img => img.description?.id === desc.id);

              if (image) {
                console.log('🖼️ Found image for description:', image.image_url);
                setSelectedImage(image);
              } else {
                console.log('🎨 No image generated yet, generating...');
                // TODO: Показать индикатор загрузки и запустить генерацию
                imagesAPI.generateImageForDescription(desc.id)
                  .then(result => {
                    console.log('✅ Image generated:', result.image_url);
                    // Создаем временный объект GeneratedImage для показа
                    const newImage: GeneratedImage = {
                      id: result.image_id,
                      description_id: result.description_id,
                      image_url: result.image_url,
                      generation_time: result.generation_time,
                      created_at: result.created_at,
                      description: desc,
                    };
                    setSelectedImage(newImage);
                    // Добавляем в список изображений
                    setImages(prev => [...prev, newImage]);
                  })
                  .catch(error => {
                    console.error('❌ Error generating image:', error);
                  });
              }
            });

            // Разбиваем текст и вставляем span
            const before = nodeText.substring(0, index);
            const highlighted = nodeText.substring(index, index + searchText.length);
            const after = nodeText.substring(index + searchText.length);

            const beforeNode = before ? doc.createTextNode(before) : null;
            const afterNode = after ? doc.createTextNode(after) : null;

            span.textContent = highlighted;

            parent.insertBefore(span, node);
            if (beforeNode) parent.insertBefore(beforeNode, span);
            if (afterNode) parent.insertBefore(afterNode, span.nextSibling);
            parent.removeChild(node);

            console.log(`✨ Highlighted: "${highlighted.substring(0, 50)}..."`);
            break; // Выделяем только первое совпадение
          }
        }

        if (!found) {
          console.warn(`⚠️ No match found for description ${descIndex}`);
        }
      } catch (error) {
        console.error('❌ Error highlighting description:', error);
      }
    });

    console.log(`🎨 Highlighting complete: ${highlightedCount}/${descriptions.length} descriptions highlighted`);
  }, [descriptions, images]);

  // Применяем highlights после загрузки страницы
  useEffect(() => {
    console.log('🔍 Highlight effect triggered:', {
      hasRendition: !!renditionRef.current,
      descriptionsCount: descriptions.length,
      renditionReady
    });

    if (!renditionReady || !renditionRef.current || descriptions.length === 0) {
      console.log('⏸️ Skipping highlights:', {
        renditionReady,
        hasRendition: !!renditionRef.current,
        descriptionsCount: descriptions.length
      });
      return;
    }

    const rendition = renditionRef.current;

    // Применяем highlights когда страница отрисована
    const handleRendered = () => {
      console.log('📄 Page rendered, applying highlights in 300ms...');
      // Небольшая задержка чтобы DOM точно был готов
      setTimeout(() => {
        highlightDescriptionsInText();
      }, 300);
    };

    rendition.on('rendered', handleRendered);

    // Первоначальное применение
    console.log('🚀 Starting initial highlighting...');
    handleRendered();

    return () => {
      rendition.off('rendered', handleRendered);
    };
  }, [descriptions, highlightDescriptionsInText, renditionReady]);

  // Навигация
  const handlePrevPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.prev();
    }
  }, []);

  const handleNextPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  }, []);

  return (
    <div className="relative h-full w-full bg-gray-900">
      {/* EPUB Viewer - всегда рендерится */}
      <div ref={viewerRef} className="h-full w-full" />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <p className="text-red-400 mb-4">Ошибка загрузки книги</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-300">Загрузка книги...</p>
          </div>
        </div>
      )}

      {/* Navigation arrows - показываем только после загрузки */}
      {!isLoading && !error && (
        <>
          <button
            onClick={handlePrevPage}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Previous page"
          >
            ←
          </button>
          <button
            onClick={handleNextPage}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Next page"
          >
            →
          </button>
        </>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage.image_url}
          title={selectedImage.description?.type || 'Generated Image'}
          description={selectedImage.description?.content || ''}
          imageId={selectedImage.id}
          descriptionData={selectedImage.description ? {
            id: selectedImage.description.id,
            type: selectedImage.description.type,
            content: selectedImage.description.content,
            confidence_score: 0,
            priority_score: selectedImage.description.priority_score,
            entities_mentioned: []
          } : undefined}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          onImageRegenerated={(newImageUrl) => {
            // Обновляем URL изображения после регенерации
            setImages(prev =>
              prev.map(img =>
                img.id === selectedImage.id
                  ? { ...img, image_url: newImageUrl }
                  : img
              )
            );
          }}
        />
      )}
    </div>
  );
};
