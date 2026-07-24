const CACHE_ESTATICO = "mapa-concursos-estatico-v1";
const ARQUIVOS_INICIAIS = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_ESTATICO).then((cache) => cache.addAll(ARQUIVOS_INICIAIS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave !== CACHE_ESTATICO)
          .map((chave) => caches.delete(chave)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);

  if (requisicao.method !== "GET" || url.origin !== self.location.origin) return;

  // Os dados são sempre buscados na rede. Assim, o service worker não impede
  // que as atualizações diárias do GitHub Actions cheguem ao navegador.
  if (url.pathname.startsWith("/data/")) {
    evento.respondWith(fetch(requisicao));
    return;
  }

  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_ESTATICO).then((cache) => cache.put("/index.html", copia));
          return resposta;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  evento.respondWith(
    caches.match(requisicao).then((emCache) => {
      if (emCache) return emCache;

      return fetch(requisicao).then((resposta) => {
        if (!resposta.ok || resposta.type !== "basic") return resposta;

        const copia = resposta.clone();
        caches.open(CACHE_ESTATICO).then((cache) => cache.put(requisicao, copia));
        return resposta;
      });
    }),
  );
});
