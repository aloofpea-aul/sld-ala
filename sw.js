// Service Worker สำหรับ Single Line Diagram - สถานีไฟฟ้าอ่าวลึก
// ทำหน้าที่แค่ให้ "ติดตั้งขึ้นหน้าจอโฮมได้" (PWA installable) และเปิดได้แม้เน็ตหลุดชั่วคราว
// (ใช้ข้อมูลสำรองที่ฝังในไฟล์ index.html เอง — ไม่ได้ทำให้ข้อมูลจาก Google Sheet ทำงานออฟไลน์ได้)

const CACHE_NAME = 'sld-aoluek-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// กลยุทธ์: หน้าเว็บหลัก (index.html) ใช้แบบ "network-first" เสมอ (พยายามโหลดของใหม่ล่าสุดก่อน)
// ถ้าเน็ตหลุด/ต่อไม่ได้ ค่อย fallback ไปใช้ไฟล์ที่แคชไว้ล่าสุดแทน กันเปิดไม่ขึ้นเลย
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // ไม่ยุ่งกับ Google Sheet / OSM tiles ฯลฯ ให้เบราว์เซอร์จัดการตามปกติ

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
