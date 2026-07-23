import { carregarMunicipios } from "./municipios.js";

import { extrairLocalidadesDaNoticia } from "./extrair-noticia.js";

const url = process.argv[2];
const uf = process.argv[3] ?? null;

if (!url) {
  console.error("Uso: node src/testar-noticia.js URL UF");

  process.exit(1);
}

const municipios = await carregarMunicipios();

const resultado = await extrairLocalidadesDaNoticia({
  url,
  uf,
  municipios,
});

console.log(JSON.stringify(resultado, null, 2));
