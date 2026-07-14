self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload no-JSON */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Luxaris Design", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/proyectos/agenda" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/proyectos/agenda";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/proyectos") && "focus" in client) {
          client.focus();
          return client.navigate(url);
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Web Share Target: recibir fotos compartidas desde la app Galería ──────────
// El picker de archivos está roto en varios Android (MIUI); compartir DESDE la
// galería hacia la PWA no depende de él. El POST llega aquí, los archivos se
// guardan en Cache y la página /proyectos/compartir los recoge.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/proyectos/compartir") return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const files = form.getAll("fotos").filter((f) => f && f.type && f.type.startsWith("image/"));
        const cache = await caches.open("luxaris-shared-photos");
        await cache.put(
          "/shared-meta",
          new Response(JSON.stringify({ count: files.length, at: Date.now() }), {
            headers: { "content-type": "application/json" },
          })
        );
        await Promise.all(
          files.map((f, i) =>
            cache.put(
              "/shared-" + i,
              new Response(f, {
                headers: {
                  "content-type": f.type,
                  "x-file-name": encodeURIComponent(f.name || "foto-" + i + ".jpg"),
                  "x-file-modified": String(f.lastModified || Date.now()),
                },
              })
            )
          )
        );
      } catch { /* sin archivos — la página mostrará el estado vacío */ }
      return Response.redirect("/proyectos/compartir", 303);
    })()
  );
});
