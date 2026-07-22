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

export function encontrarMunicipioNoTexto({ texto, uf, municipios }) {
  const textoNormalizado = normalizarTexto(texto);

  const candidatos = municipios
    .filter((municipio) => !uf || municipio.uf === uf)
    .filter((municipio) => municipio.nomeNormalizado.length >= 4)
    .sort((a, b) => b.nomeNormalizado.length - a.nomeNormalizado.length);

  for (const municipio of candidatos) {
    const nome = escaparRegex(municipio.nomeNormalizado);

    const regex = new RegExp(`(^|[^a-z0-9])${nome}([^a-z0-9]|$)`, "i");

    if (regex.test(textoNormalizado)) {
      return municipio;
    }
  }

  return null;
}
