import * as cheerio from "cheerio";

import { escaparRegex, limparTexto, normalizarTexto } from "./utils.js";

import { encontrarMunicipiosNoTexto } from "./municipios.js";

function extrairContextoProximo(texto, cidade, raio = 120) {
  const textoNormalizado = normalizarTexto(texto);

  const cidadeNormalizada = normalizarTexto(cidade);

  const indice = textoNormalizado.indexOf(cidadeNormalizada);

  if (indice === -1) {
    return texto;
  }

  const inicio = Math.max(0, indice - raio);

  const fim = Math.min(texto.length, indice + cidade.length + raio);

  return texto.slice(inicio, fim);
}

function pareceCargoComLocalidade(texto, cidade, uf, origemElemento) {
  const textoNormalizado = normalizarTexto(texto);

  const cidadeNormalizada = normalizarTexto(cidade);

  const ufNormalizada = normalizarTexto(uf ?? "");

  if (!textoNormalizado.includes(cidadeNormalizada)) {
    return false;
  }

  const possuiIndicacaoDeVaga =
    /\b\d+\s+vagas?\b/i.test(texto) || /\bcadastro de reserva\b/i.test(texto);

  if (!possuiIndicacaoDeVaga) {
    return false;
  }

  const possuiUfExplicita =
    !ufNormalizada ||
    textoNormalizado.includes(`/${ufNormalizada}`) ||
    textoNormalizado.includes(`- ${ufNormalizada}`);

  /*
   * Em listas de cargos, o PCI costuma omitir
   * a UF porque toda a notícia já pertence ao estado.
   *
   * Exemplo:
   * Assistente de Alunos - Rondonópolis (1 vaga)
   */
  const formatoListaCargoCidade =
    origemElemento === "li" && texto.includes(" - ");

  /*
   * Formato com cidade e UF entre parênteses:
   * Advogado (Teresina/PI) (1 vaga)
   */
  const formatoCidadeEntreParenteses = texto.includes("(") && possuiUfExplicita;

  return formatoListaCargoCidade || formatoCidadeEntreParenteses;
}
function pareceCampus(texto, cidade) {
  const contexto = normalizarTexto(texto);

  const cidadeNormalizada = escaparRegex(normalizarTexto(cidade));

  const padrao = new RegExp(
    `\\bcampus\\s+(?:de\\s+)?${cidadeNormalizada}\\b`,
    "i",
  );

  return padrao.test(contexto);
}

function pareceGuarnicao(texto, cidade, uf) {
  const contexto = normalizarTexto(texto);

  const cidadeNormalizada = escaparRegex(normalizarTexto(cidade));

  const ufNormalizada = escaparRegex(normalizarTexto(uf));

  const padrao = new RegExp(
    `\\bguarnicao\\b[^.!?]{0,100}\\b${cidadeNormalizada}\\b(?:\\s*(?:[/\\-]|\\s)\\s*${ufNormalizada}\\b)?`,
    "i",
  );

  return padrao.test(contexto);
}

function pareceOrgaoMunicipal(contexto, cidade) {
  const cidadeNormalizada = escaparRegex(normalizarTexto(cidade));

  const padrao = new RegExp(
    `(?:camara|prefeitura)(?:\\s+municipal)?\\s+de\\s+${cidadeNormalizada}`,
    "i",
  );

  return padrao.test(contexto);
}

function pareceLocalDaVaga(texto, cidade) {
  const contexto = normalizarTexto(texto);

  const cidadeNormalizada = escaparRegex(normalizarTexto(cidade));

  const mencionaOportunidade =
    /\b(vaga|vagas|cargo|cargos|contratacao|cadastro de reserva|oportunidade|oportunidades|funcao|funcoes)\b/i.test(
      contexto,
    );

  if (!mencionaOportunidade) {
    return false;
  }

  const padroesLocalidade = [
    `\\bem\\b[^.!?;]{0,180}\\b${cidadeNormalizada}\\b`,
    `\\bpara\\b[^.!?;]{0,180}\\b${cidadeNormalizada}\\b`,
    `\\bnas?\\s+cidades?\\s+de\\b[^.!?;]{0,180}\\b${cidadeNormalizada}\\b`,
    `\\bnos?\\s+municipios?\\s+de\\b[^.!?;]{0,180}\\b${cidadeNormalizada}\\b`,
  ];

  return padroesLocalidade.some((padrao) =>
    new RegExp(padrao, "i").test(contexto),
  );
}

export function classificarContexto(texto, cidade, uf, origemElemento) {
  const contexto = normalizarTexto(extrairContextoProximo(texto, cidade));

  const contem = (...radicais) =>
    radicais.some((radical) => contexto.includes(normalizarTexto(radical)));

  /*
   * A regra de prova precisa vir antes das regras
   * de lotação. Uma frase sobre prova pode também
   * conter palavras como cargo, vaga ou seleção.
   */
  const contextoProva =
    contem("prova", "avaliac", "exame") &&
    contem("aplicad", "realizad", "ocorrer", "acontecer", "previst");

  if (contextoProva) {
    return "prova";
  }

  if (pareceLocalDaVaga(texto, cidade)) {
    return "lotacao";
  }

  if (pareceGuarnicao(texto, cidade, uf)) {
    return "lotacao";
  }

  if (pareceCampus(texto, cidade)) {
    return "lotacao";
  }

  if (pareceCargoComLocalidade(texto, cidade, uf, origemElemento)) {
    return "lotacao";
  }

  if (pareceOrgaoMunicipal(contexto, cidade)) {
    return "lotacao";
  }

  if (
    contem(
      "lotacao",
      "lotad",
      "atuacao",
      "atuar",
      "exercicio",
      "local de trabalho",
      "desempenhar",
      "atividades",
      "funcoes",
      "guarnicao",
    )
  ) {
    return "lotacao";
  }

  if (contem("sede", "sediad")) {
    return "sede";
  }

  if (contem("inscric", "document") && contem("presencial", "entrega")) {
    return "inscricao";
  }

  return "mencao";
}

function confiancaPorTipo(tipo) {
  if (tipo === "lotacao" || tipo === "sede") {
    return "alta";
  }

  if (tipo === "prova" || tipo === "inscricao") {
    return "media";
  }

  return "baixa";
}

function extrairFraseDaCidade(texto, nomeCidade) {
  const frases = texto
    .split(/(?<=[.!?;])\s+/)
    .map(limparTexto)
    .filter(Boolean);

  const cidadeNormalizada = normalizarTexto(nomeCidade);

  const fraseEncontrada = frases.find((frase) =>
    normalizarTexto(frase).includes(cidadeNormalizada),
  );

  return fraseEncontrada ?? texto;
}

function extrairBlocosTextuais($) {
  const artigo = $("article#noticia").first();

  if (!artigo.length) {
    return [];
  }

  const blocos = [];

  artigo.find("h1, h2, h3, h4, p, li, th, td").each((_, elemento) => {
    const texto = limparTexto($(elemento).text());

    if (!texto) {
      return;
    }

    blocos.push({
      tag: elemento.tagName?.toLowerCase() ?? null,

      texto,
    });
  });

  return blocos;
}

export async function baixarNoticia(url) {
  const resposta = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MapaConcursos/0.1; projeto pessoal)",

      Accept: "text/html,application/xhtml+xml",

      "Accept-Language": "pt-BR,pt;q=0.9",
    },

    redirect: "follow",

    signal: AbortSignal.timeout(30_000),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao baixar notícia: HTTP ${resposta.status}`);
  }

  return resposta.text();
}

export async function extrairLocalidadesDaNoticia({ url, uf, municipios }) {
  const html = await baixarNoticia(url);
  const $ = cheerio.load(html);

  const artigo = $("article#noticia").first();

  if (!artigo.length) {
    return {
      publicadoEm: null,
      localidades: [],
      blocos: [],
    };
  }

  const publicadoEm =
    artigo.find("abbr.published").first().attr("title") ?? null;

  const blocos = extrairBlocosTextuais($);

  const localidades = [];

  for (const bloco of blocos) {
    const encontrados = encontrarMunicipiosNoTexto({
      texto: bloco.texto,
      uf,
      municipios,
    });

    for (const municipio of encontrados) {
      const contexto = extrairFraseDaCidade(bloco.texto, municipio.nome);

      const tipo = classificarContexto(
        contexto,
        municipio.nome,
        municipio.uf,
        bloco.tag,
      );

      localidades.push({
        codigoIbge: municipio.codigoIbge,

        cidade: municipio.nome,

        uf: municipio.uf,

        latitude: municipio.latitude,

        longitude: municipio.longitude,

        tipo,

        confianca: confiancaPorTipo(tipo),

        exibirNoMapa: tipo !== "mencao",

        contexto,

        origemElemento: bloco.tag,
      });
    }
  }

  return {
    publicadoEm,

    localidades: removerLocalidadesDuplicadas(localidades),

    //blocos,
  };
}

function removerLocalidadesDuplicadas(localidades) {
  const prioridadeTipo = {
    lotacao: 5,
    sede: 4,
    prova: 3,
    inscricao: 2,
    mencao: 1,
  };

  const prioridadeConfianca = {
    alta: 3,
    media: 2,
    baixa: 1,
  };

  const unicas = new Map();

  for (const localidade of localidades) {
    const chave = String(localidade.codigoIbge);

    const existente = unicas.get(chave);

    if (!existente) {
      unicas.set(chave, {
        ...localidade,
        contextos: [localidade.contexto],
      });

      continue;
    }

    if (!existente.contextos.includes(localidade.contexto)) {
      existente.contextos.push(localidade.contexto);
    }

    const pontuacaoAtual =
      (prioridadeTipo[existente.tipo] ?? 0) * 10 +
      (prioridadeConfianca[existente.confianca] ?? 0);

    const pontuacaoNova =
      (prioridadeTipo[localidade.tipo] ?? 0) * 10 +
      (prioridadeConfianca[localidade.confianca] ?? 0);

    if (pontuacaoNova > pontuacaoAtual) {
      existente.tipo = localidade.tipo;

      existente.confianca = localidade.confianca;

      existente.exibirNoMapa = localidade.tipo !== "mencao";

      existente.contexto = localidade.contexto;

      existente.origemElemento = localidade.origemElemento;
    }
  }

  return [...unicas.values()];
}
