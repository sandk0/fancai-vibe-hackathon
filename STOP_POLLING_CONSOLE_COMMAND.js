// СКОПИРУЙТЕ И ВСТАВЬТЕ ЭТО В КОНСОЛЬ БРАУЗЕРА (F12 -> Console)
// Это принудительно остановит все timeouts и очистит состояние

// 1. Остановить все активные timeouts
let id = setTimeout(() => {}, 0);
while (id--) {
  clearTimeout(id);
}
console.log('✅ Все timeouts остановлены');

// 2. Перезагрузить страницу с очисткой кэша
location.reload(true);
