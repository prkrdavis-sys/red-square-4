/* Do not client.navigate() here.
 * Forcing every tab to reload on activate leaves Chrome's loading spinner
 * running until the user hits Stop — the new navigation never settles on
 * the document that is already open. Workbox skipWaiting + clientsClaim
 * already takes over; the next real visit picks up the new shell.
 *
 * rs4-pages is the previous navigation cache. Leaving it in place lets a
 * timeout fall back to the old document after this worker activates.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('rs4-pages'));
});
