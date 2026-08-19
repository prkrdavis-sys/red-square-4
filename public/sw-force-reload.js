/* Reload every open tab when a new worker activates so stale PWA shells cannot linger. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        windows.map((client) => ('navigate' in client ? client.navigate(client.url) : Promise.resolve())),
      );
    })(),
  );
});
