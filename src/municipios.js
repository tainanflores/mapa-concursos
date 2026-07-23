import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

import { escaparRegex, normalizarTexto } from "./utils.js";

const UFS_POR_CODIGO = {
  11: "RO",
  12: "AC",
  13: "AM",
  14: "RR",
  15: "PA",
  16: "AP",
  17: "TO",
  21: "MA",
  22: "PI",
  23: "CE",
  24: "RN",
  25: "PB",
  26: "PE",
  27: "AL",
  28: "SE",
  29: "BA",
  31: "MG",
  32: "ES",
  33: "RJ",
  35: "SP",
  41: "PR",
  42: "SC",
  43: "RS",
  50: "MS",
  51: "MT",
  52: "GO",
  53: "DF",
};

const MUNICIPIOS_AMBIGUOS = new Set([
  "reserva",
  "saude",
  "vitoria",
  "uniao",
  "prata",
  "progresso",
  "paraiso",
  "esperanca",
  "liberdade",
  "fortaleza",
]);

const NOMES_QUE_TAMBEM_SAO_ESTADOS = new Set([
  "goias",
  "sao paulo",
  "rio de janeiro",
  "tocantins",
]);

export async function carregarMunicipios() {
  const csv = await readFile("data/municipios.csv", "utf8");

  const registros = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return registros.map((registro) => {
    const codigoUf = Number(registro.codigo_uf);

    return {
      codigoIbge: Number(registro.codigo_ibge),
      nome: registro.nome,
      nomeNormalizado: normalizarTexto(registro.nome),
      uf: registro.uf || UFS_POR_CODIGO[codigoUf] || null,
      latitude: Number(registro.latitude),
      longitude: Number(registro.longitude),
      capital: registro.capital === "1" || registro.capital === "true",
    };
  });
}

export function encontrarMunicipioNoTexto({
  texto,
  uf,
  municipios,
  permitirNomeInstituicao = false,
}) {
  const encontrados = encontrarMunicipiosNoTexto({
    texto,
    uf,
    municipios,
    permitirNomeInstituicao,
  });

  return encontrados[0] ?? null;
}

export function encontrarMunicipiosNoTexto({
  texto,
  uf,
  municipios,
  permitirNomeInstituicao = false,
}) {
  const textoNormalizado = normalizarTexto(texto);

  const candidatos = municipios
    .filter((municipio) => !uf || municipio.uf === uf)
    .sort((a, b) => b.nomeNormalizado.length - a.nomeNormalizado.length);

  const encontrados = [];
  const intervalosOcupados = [];

  for (const municipio of candidatos) {
    const nome = criarPadraoNomeMunicipio(municipio.nomeNormalizado);

    const regex = new RegExp(`(^|[^a-z0-9])(${nome})(?=[^a-z0-9]|$)`, "gi");

    const ocorrencias = [...textoNormalizado.matchAll(regex)];

    if (ocorrencias.length === 0) {
      continue;
    }

    const possuiEvidencia = possuiEvidenciaGeografica(
      texto,
      textoNormalizado,
      municipio,
    );

    if (!possuiEvidencia) {
      continue;
    }

    const ocorrenciasLivres = ocorrencias
      .map((ocorrencia) => {
        const prefixo = ocorrencia[1] ?? "";

        const textoEncontrado = ocorrencia[2] ?? "";

        const inicio = ocorrencia.index + prefixo.length;

        const fim = inicio + textoEncontrado.length;

        return {
          inicio,
          fim,
        };
      })
      .filter(
        ({ inicio, fim }) =>
          !intervalosOcupados.some(
            (intervalo) => inicio >= intervalo.inicio && fim <= intervalo.fim,
          ),
      );

    if (ocorrenciasLivres.length === 0) {
      continue;
    }

    if (
      apareceComoParteDeEndereco(textoNormalizado, municipio.nomeNormalizado) &&
      !possuiContextoGeografico(
        textoNormalizado,
        municipio.nomeNormalizado,
        municipio.uf,
      )
    ) {
      continue;
    }

    if (
      !permitirNomeInstituicao &&
      apareceComoNomeDeInstituicao(
        textoNormalizado,
        municipio.nomeNormalizado,
      ) &&
      !possuiContextoGeografico(
        textoNormalizado,
        municipio.nomeNormalizado,
        municipio.uf,
      )
    ) {
      continue;
    }

    if (
      !uf &&
      existeUfAoLadoDaCidade(textoNormalizado, municipio.nomeNormalizado) &&
      !cidadeCombinaComUfDoTexto(
        textoNormalizado,
        municipio.nomeNormalizado,
        municipio.uf,
      )
    ) {
      continue;
    }

    const ambiguo = MUNICIPIOS_AMBIGUOS.has(municipio.nomeNormalizado);

    if (
      ambiguo &&
      !possuiContextoGeografico(
        textoNormalizado,
        municipio.nomeNormalizado,
        municipio.uf,
      )
    ) {
      continue;
    }

    const nomeTambemEhEstado = NOMES_QUE_TAMBEM_SAO_ESTADOS.has(
      municipio.nomeNormalizado,
    );

    if (
      nomeTambemEhEstado &&
      apareceComoEstado(textoNormalizado, municipio.nomeNormalizado) &&
      !possuiContextoMunicipalExplicito(
        textoNormalizado,
        municipio.nomeNormalizado,
        municipio.uf,
      )
    ) {
      continue;
    }

    encontrados.push(municipio);

    intervalosOcupados.push(...ocorrenciasLivres);
  }

  return encontrados;
}

function existeUfAoLadoDaCidade(textoNormalizado, nomeMunicipio) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);

  const regex = new RegExp(
    `\\b${nome}\\b\\s*(?:[/\\-]|,)?\\s*[a-z]{2}\\b`,
    "i",
  );

  return regex.test(textoNormalizado);
}

function cidadeCombinaComUfDoTexto(textoNormalizado, nomeMunicipio, uf) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);
  const sigla = escaparRegex(normalizarTexto(uf ?? ""));

  const padroes = [
    `${nome}\\s*\\/\\s*${sigla}\\b`,
    `${nome}\\s*-\\s*${sigla}\\b`,
    `${nome}\\s*,\\s*${sigla}\\b`,
    `${nome}\\s+${sigla}\\b`,
  ];

  return padroes.some((padrao) =>
    new RegExp(`(^|[^a-z0-9])${padrao}`, "i").test(textoNormalizado),
  );
}

function possuiContextoGeografico(textoNormalizado, nomeMunicipio, uf) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);
  const sigla = escaparRegex(normalizarTexto(uf ?? ""));

  const padroes = [
    `municipio\\s+de\\s+${nome}`,
    `municipio\\s+do\\s+${nome}`,
    `cidade\\s+de\\s+${nome}`,
    `cidade\\s+do\\s+${nome}`,

    `camara(?:\\s+municipal)?\\s+de\\s+${nome}`,
    `prefeitura(?:\\s+municipal)?\\s+de\\s+${nome}`,

    `sediad[oa]s?\\s+no\\s+municipio\\s+de\\s+${nome}`,
    `sediad[oa]s?\\s+na\\s+cidade\\s+de\\s+${nome}`,

    `sede\\s+no\\s+municipio\\s+de\\s+${nome}`,
    `sede\\s+na\\s+cidade\\s+de\\s+${nome}`,

    `${nome}\\s*[/\\-]\\s*${sigla}`,
    `${nome}\\s*,\\s*${sigla}`,
    `${nome}\\s+${sigla}\\b`,
  ];

  return padroes.some((padrao) =>
    new RegExp(`(^|[^a-z0-9])${padrao}([^a-z0-9]|$)`, "i").test(
      textoNormalizado,
    ),
  );
}

function possuiContextoMunicipalExplicito(textoNormalizado, nomeMunicipio, uf) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);
  const sigla = escaparRegex(normalizarTexto(uf ?? ""));

  const padroes = [
    `municipio\\s+de\\s+${nome}`,
    `municipio\\s+do\\s+${nome}`,
    `municipio\\s+da\\s+${nome}`,
    `cidade\\s+de\\s+${nome}`,
    `camara(?:\\s+municipal)?\\s+de\\s+${nome}`,
    `prefeitura(?:\\s+municipal)?\\s+de\\s+${nome}`,
    `${nome}\\s*[/\\-]\\s*${sigla}`,
    `${nome}\\s+${sigla}\\b`,
  ];

  return padroes.some((padrao) =>
    new RegExp(`(^|[^a-z0-9])${padrao}([^a-z0-9]|$)`, "i").test(
      textoNormalizado,
    ),
  );
}

function apareceComoEstado(textoNormalizado, nomeMunicipio) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);

  const padroes = [
    `estado\\s+de\\s+${nome}`,
    `estado\\s+do\\s+${nome}`,
    `estado\\s+da\\s+${nome}`,

    `abrange[^.!?]{0,120}\\b${nome}\\b`,
    `abrangendo[^.!?]{0,120}\\b${nome}\\b`,
  ];

  return padroes.some((padrao) =>
    new RegExp(padrao, "i").test(textoNormalizado),
  );
}

function apareceComoParteDeEndereco(textoNormalizado, nomeMunicipio) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);

  const padroes = [
    `bairro\\s+[^,.!?;]{0,40}\\b${nome}\\b`,
    `distrito\\s+[^,.!?;]{0,40}\\b${nome}\\b`,
    `rua\\s+[^,.!?;]{0,60}\\b${nome}\\b`,
    `avenida\\s+[^,.!?;]{0,60}\\b${nome}\\b`,
    `av\\.?\\s+[^,.!?;]{0,60}\\b${nome}\\b`,
    `travessa\\s+[^,.!?;]{0,60}\\b${nome}\\b`,
    `rodovia\\s+[^,.!?;]{0,60}\\b${nome}\\b`,
  ];

  return padroes.some((padrao) =>
    new RegExp(padrao, "i").test(textoNormalizado),
  );
}

function apareceComoNomeDeInstituicao(textoNormalizado, nomeMunicipio) {
  const nome = criarPadraoNomeMunicipio(nomeMunicipio);

  const padroes = [
    `hospital\\s+[^,.!?;/()-]{1,80}\\b${nome}\\b`,
    `escola\\s+[^,.!?;/()-]{1,80}\\b${nome}\\b`,
    `colegio\\s+[^,.!?;/()-]{1,80}\\b${nome}\\b`,
    `instituto\\s+[^,.!?;/()-]{1,80}\\b${nome}\\b`,
    `fundacao\\s+[^,.!?;/()-]{1,80}\\b${nome}\\b`,
  ];

  return padroes.some((padrao) =>
    new RegExp(padrao, "i").test(textoNormalizado),
  );
}

function criarPadraoNomeMunicipio(nomeMunicipio) {
  return nomeMunicipio
    .split(/[\s-]+/)
    .map(escaparRegex)
    .join("[\\s-]+");
}

function possuiCapitalizacaoDeNomeProprio(textoOriginal, nomeMunicipio) {
  const partes = nomeMunicipio.split(/[\s-]+/).map(escaparRegex);

  const nomeFlexivel = partes.join("[\\s\\-–—]+");

  const regex = new RegExp(
    `(^|[^\\p{L}\\p{N}])${nomeFlexivel}(?=[^\\p{L}\\p{N}]|$)`,
    "u",
  );

  return regex.test(textoOriginal);
}

function possuiEvidenciaGeografica(textoOriginal, textoNormalizado, municipio) {
  const possuiContexto = possuiContextoGeografico(
    textoNormalizado,
    municipio.nomeNormalizado,
    municipio.uf,
  );

  if (possuiContexto) {
    return true;
  }

  return possuiCapitalizacaoDeNomeProprio(textoOriginal, municipio.nome);
}
