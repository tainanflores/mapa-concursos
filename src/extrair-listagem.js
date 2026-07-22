import * as cheerio from "cheerio";

import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  criarIdPelaUrl,
  extrairDataFinal,
  extrairQuantidadeVagas,
  extrairSalarioMaximo,
  limparTexto,
  normalizarTexto,
} from "./utils.js";

import { carregarMunicipios, encontrarMunicipioNoTexto } from "./municipios.js";

const CAMINHO_HTML = "data/pci-concursos.html";
const CAMINHO_SAIDA = "public/data/concursos.json";
const CAMINHO_RESUMO = "public/data/resumo.json";

const UF_POR_SECAO = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function obterUf(secao, textoUf) {
  const ufElemento = limparTexto(textoUf).toUpperCase();

  if (/^[A-Z]{2}$/.test(ufElemento)) {
    return ufElemento;
  }

  return UF_POR_SECAO[normalizarTexto(secao)] ?? null;
}

function extrairDetalhes($, conteudo) {
  const bloco = conteudo.children(".cd").first();

  const textoCompleto = limparTexto(bloco.text());

  const escolaridade = limparTexto(bloco.find("span span").first().text());

  const spanCargo = bloco.children("span").first().clone();

  spanCargo.children("span").remove();

  const cargoResumo = limparTexto(spanCargo.text());

  return {
    textoCompleto,
    vagas: extrairQuantidadeVagas(textoCompleto),
    salarioMaximo: extrairSalarioMaximo(textoCompleto),
    cargoResumo: cargoResumo || null,
    escolaridades: escolaridade
      ? escolaridade.split("/").map(limparTexto).filter(Boolean)
      : [],
  };
}

function localizarMunicipio({ orgao, titulo, uf, municipios }) {
  const texto = `${orgao} ${titulo}`;

  return encontrarMunicipioNoTexto({
    texto,
    uf,
    municipios,
  });
}

export async function extrairListagem() {
  const [html, municipios] = await Promise.all([
    readFile(CAMINHO_HTML, "utf8"),
    carregarMunicipios(),
  ]);

  const $ = cheerio.load(html);

  const concursos = [];
  let secaoAtual = "Nacional";

  $(".ua, .da, .na").each((_, elemento) => {
    const bloco = $(elemento);

    if (bloco.hasClass("ua")) {
      const textoSecao = limparTexto(bloco.text());
      const sufixo = "Inscrição até:";

      const nomeSecao = textoSecao.slice(0, -sufixo.length).trim();

      if (nomeSecao) {
        secaoAtual = nomeSecao;
      }

      return;
    }

    const conteudo = bloco.children(".ca").first();

    if (!conteudo.length) {
      return;
    }

    const linkPrincipal = conteudo.children("a").first();

    const url = bloco.attr("data-url") || linkPrincipal.attr("href") || null;

    const orgao = limparTexto(linkPrincipal.text());

    if (!orgao || !url) {
      return;
    }

    const titulo =
      limparTexto(linkPrincipal.attr("title")) ||
      limparTexto(conteudo.children(".cb").find("img").first().attr("title")) ||
      orgao;

    const uf = obterUf(secaoAtual, conteudo.children(".cc").text());

    const prazoTexto = limparTexto(conteudo.children(".ce").text());

    const detalhes = extrairDetalhes($, conteudo);

    const municipio = localizarMunicipio({
      orgao,
      titulo,
      uf,
      municipios,
    });

    concursos.push({
      id: criarIdPelaUrl(url),
      fonte: "PCI Concursos",
      classePCI: bloco.attr("class")?.trim() ?? null,
      status: "aberto",

      secao: secaoAtual,
      orgao,
      titulo,
      urlPCI: url,
      uf,

      vagas: detalhes.vagas,
      salarioMaximo: detalhes.salarioMaximo,
      cargoResumo: detalhes.cargoResumo,
      escolaridades: detalhes.escolaridades,

      inscricaoTexto: prazoTexto,
      inscricaoFim: extrairDataFinal(prazoTexto),

      localizacao: municipio
        ? {
            codigoIbge: municipio.codigoIbge,
            cidade: municipio.nome,
            uf: municipio.uf,
            latitude: municipio.latitude,
            longitude: municipio.longitude,
            tipo: "nome_orgao_ou_titulo",
            confianca: "alta",
          }
        : null,

      localidades: municipio
        ? [
            {
              codigoIbge: municipio.codigoIbge,
              cidade: municipio.nome,
              uf: municipio.uf,
              latitude: municipio.latitude,
              longitude: municipio.longitude,
              tipo: "nome_orgao_ou_titulo",
              confianca: "alta",
              contexto: `${orgao} — ${titulo}`,
            },
          ]
        : [],

      localizacaoPendente: !municipio,
      coletadoEm: new Date().toISOString(),
    });
  });

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

  const resumo = {
    geradoEm: new Date().toISOString(),
    total: concursos.length,
    localizados: localizados.length,
    pendentes: pendentes.length,
    porSecao,
  };

  await mkdir("public/data", {
    recursive: true,
  });

  await Promise.all([
    writeFile(CAMINHO_SAIDA, JSON.stringify(concursos, null, 2), "utf8"),

    writeFile(CAMINHO_RESUMO, JSON.stringify(resumo, null, 2), "utf8"),
  ]);

  console.log("Listagem extraída.");
  console.log(`Total: ${resumo.total}`);
  console.log(`Localizados: ${resumo.localizados}`);
  console.log(`Pendentes: ${resumo.pendentes}`);
  console.log(`Saída: ${CAMINHO_SAIDA}`);

  return concursos;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  extrairListagem().catch((erro) => {
    console.error("Erro ao extrair listagem:");
    console.error(erro);
    process.exitCode = 1;
  });
}
