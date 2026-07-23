import { readFile, writeFile } from "node:fs/promises";

import { carregarMunicipios } from "./municipios.js";
import {
  agruparPinsPorMunicipio,
  criarLocalidadesParaMapa,
} from "./dados-mapa.js";

import { extrairLocalidadesDaNoticia } from "./extrair-noticia.js";

const CAMINHO_CONCURSOS = "public/data/concursos.json";
const CAMINHO_RESUMO = "public/data/resumo.json";
const CAMINHO_LOCALIDADES_MAPA = "public/data/localidades.json";
const CAMINHO_PONTOS_MAPA = "public/data/pontos-mapa.json";

const INTERVALO_REQUISICOES_MS = 800;

function aguardar(milisegundos) {
  return new Promise((resolve) => {
    setTimeout(resolve, milisegundos);
  });
}

function deveEnriquecer(concurso) {
  return concurso.localizacaoPendente === true;
}

function criarResumo(concursos) {
  const localizados = concursos.filter(
    (concurso) => !concurso.localizacaoPendente,
  );

  const pendentes = concursos.filter(
    (concurso) => concurso.localizacaoPendente,
  );

  const porSecao = concursos.reduce((resultado, concurso) => {
    resultado[concurso.secao] = (resultado[concurso.secao] ?? 0) + 1;

    return resultado;
  }, {});

  return {
    geradoEm: new Date().toISOString(),
    total: concursos.length,
    localizados: localizados.length,
    pendentes: pendentes.length,
    porSecao,
  };
}

function possuiLocalidadeUtil(localidades) {
  return localidades.some(
    (localidade) =>
      localidade.tipo !== "mencao" && localidade.exibirNoMapa !== false,
  );
}

function escolherLocalizacaoPrincipal(localidades) {
  const prioridade = {
    lotacao: 5,
    sede: 4,
    prova: 3,
    inscricao: 2,
    mencao: 1,
  };

  return (
    [...localidades].sort(
      (a, b) => (prioridade[b.tipo] ?? 0) - (prioridade[a.tipo] ?? 0),
    )[0] ?? null
  );
}

function transformarLocalizacaoPrincipal(localidade) {
  if (!localidade) {
    return null;
  }

  return {
    codigoIbge: localidade.codigoIbge,

    cidade: localidade.cidade,

    uf: localidade.uf,

    latitude: localidade.latitude,

    longitude: localidade.longitude,

    tipo: localidade.tipo,

    confianca: localidade.confianca,
  };
}

async function enriquecerConcurso({ concurso, municipios }) {
  const dadosNoticia = await extrairLocalidadesDaNoticia({
    url: concurso.urlPCI,
    uf:
      String(concurso.secao).toLowerCase() === "nacional" ? null : concurso.uf,
    municipios,
  });

  const localidadesNoticia = dadosNoticia.localidades ?? [];

  /*
   * Quando a notícia encontra localidades úteis,
   * elas substituem a localização simplificada
   * encontrada apenas pelo nome do órgão.
   */
  if (localidadesNoticia.length > 0) {
    const temLocalidadeUtil = possuiLocalidadeUtil(localidadesNoticia);

    /*
     * Menções só são exibidas quando a notícia não oferece uma localização
     * mais útil, como lotação, sede, prova ou inscrição.
     */
    const localidades = temLocalidadeUtil
      ? localidadesNoticia
      : localidadesNoticia.map((localidade) => ({
          ...localidade,
          exibirNoMapa: true,
        }));

    const principal = escolherLocalizacaoPrincipal(localidades);

    const { abrangencia, motivoSemCidade, ...concursoLocalizado } = concurso;

    return {
      ...concursoLocalizado,

      publicadoEm: dadosNoticia.publicadoEm,

      localidades,

      localizacao: transformarLocalizacaoPrincipal(principal),

      localizacaoPendente: false,

      enriquecidoPelaNoticia: true,

      enriquecidoEm: new Date().toISOString(),
    };
  }

  /*
   * Se a notícia não encontrou nada confiável,
   * preservamos os dados que vieram da listagem.
   */
  return {
    ...concurso,

    publicadoEm: dadosNoticia.publicadoEm,

    enriquecidoPelaNoticia: true,

    enriquecidoEm: new Date().toISOString(),
  };
}

export async function enriquecerConcursos() {
  const [conteudo, municipios] = await Promise.all([
    readFile(CAMINHO_CONCURSOS, "utf8"),

    carregarMunicipios(),
  ]);

  const concursos = JSON.parse(conteudo);

  const resultado = [];

  let processados = 0;
  let enriquecidos = 0;
  let erros = 0;

  for (const concurso of concursos) {
    if (!deveEnriquecer(concurso)) {
      resultado.push(concurso);
      continue;
    }

    processados += 1;

    console.log(`[${processados}] Enriquecendo: ${concurso.orgao}`);

    try {
      const concursoEnriquecido = await enriquecerConcurso({
        concurso,
        municipios,
      });

      resultado.push(concursoEnriquecido);

      enriquecidos += 1;
    } catch (erro) {
      console.error(`Falha ao enriquecer ${concurso.orgao}:`);

      console.error(erro instanceof Error ? erro.message : erro);

      /*
       * Não interrompe toda a atualização por causa
       * de uma notícia individual.
       */
      resultado.push({
        ...concurso,

        enriquecimentoErro: erro instanceof Error ? erro.message : String(erro),

        enriquecimentoTentadoEm: new Date().toISOString(),
      });

      erros += 1;
    }

    await aguardar(INTERVALO_REQUISICOES_MS);
  }

  const resumo = criarResumo(resultado);
  const localidadesParaMapa = criarLocalidadesParaMapa(resultado);
  const pontosParaMapa = agruparPinsPorMunicipio(localidadesParaMapa);

  await Promise.all([
    writeFile(CAMINHO_CONCURSOS, JSON.stringify(resultado, null, 2), "utf8"),

    writeFile(CAMINHO_RESUMO, JSON.stringify(resumo, null, 2), "utf8"),

    writeFile(
      CAMINHO_LOCALIDADES_MAPA,
      JSON.stringify(localidadesParaMapa, null, 2),
      "utf8",
    ),

    writeFile(
      CAMINHO_PONTOS_MAPA,
      JSON.stringify(pontosParaMapa, null, 2),
      "utf8",
    ),
  ]);

  console.log("");
  console.log("Enriquecimento concluído.");

  console.log(`Selecionados: ${processados}`);

  console.log(`Enriquecidos: ${enriquecidos}`);

  console.log(`Erros: ${erros}`);

  console.log(`Localizados no total: ${resumo.localizados}`);

  console.log(`Pendentes no total: ${resumo.pendentes}`);

  return resultado;
}
