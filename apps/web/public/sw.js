const CACHE_NAME = "bakersmania-shell-v2";
const SHELL_ASSETS = [
  "/",
  "/login",
  "/icon.svg",
  "/manifest.webmanifest",
  "/admin",
  "/admin/billing",
  "/admin/reports",
  "/admin/tenants",
  "/bakery",
  "/bakery/categories",
  "/bakery/customers",
  "/bakery/expenses",
  "/bakery/inventory",
  "/bakery/inventory/sellers",
  "/bakery/labour",
  "/bakery/labour/attendance",
  "/bakery/labour/payments",
  "/bakery/orders",
  "/bakery/prices",
  "/bakery/products",
  "/bakery/routes",
  "/bakery/truck-loading",
  "/customer",
  "/customer/billing",
  "/customer/orders",
  "/customer/profile",
  "/vehicle",
  "/vehicle/prices",
  "/vehicle/routes",
  "/vehicle/truck-loading"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        if (event.request.mode === "navigate") {
          const segments = requestUrl.pathname.split("/").filter(Boolean);
          const surface = segments.length > 1 && ["bakery", "customer", "vehicle"].includes(segments[1]) ? segments[1] : segments[0];
          if (surface && ["admin", "bakery", "customer", "vehicle"].includes(surface)) {
            return caches.match(`/${surface}`) || caches.match("/");
          }
        }

        return caches.match("/");
      })
  );
});
