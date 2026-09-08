/* Do not client.navigate() here.
 * Forcing every tab to reload on activate leaves Chrome's loading spinner
 * running until the user hits Stop — the new navigation never settles on
 * the document that is already open. Workbox skipWaiting + clientsClaim
 * already takes over; the next real visit picks up the new shell.
 */
