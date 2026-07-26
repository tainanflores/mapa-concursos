# Front-end — Mapa de Concursos

Aplicação React/Vite do Mapa de Concursos. Ela exibe oportunidades em um mapa
interativo, permite pesquisa por cidade, filtros, favoritos, alertas e conta de
usuário. O mesmo front-end é distribuído no navegador e no aplicativo Android
por meio do Capacitor.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build web

```bash
npm run build
```

Durante o build, `scripts/copiar-dados.mjs` copia os JSONs públicos da raiz do
projeto para `public/data`.

## Dados remotos no APK

Crie `frontend/.env.local` a partir de `.env.example` e informe:

```env
VITE_DADOS_BASE_URL=https://mapa-concursos.vercel.app/data
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Sem `VITE_DADOS_BASE_URL`, o APK usa os dados incluídos durante o build. Com a
variável configurada, ele consulta a versão atual hospedada na Vercel e usa a
cópia incluída apenas como contingência.

## Android

Depois do build web, sincronize os assets com o projeto Android:

```bash
npx cap sync android
```

As instruções de assinatura e geração da versão de publicação ficam em
`android/key.properties.example`. Nunca versione a chave de assinatura nem o
arquivo `key.properties`.
