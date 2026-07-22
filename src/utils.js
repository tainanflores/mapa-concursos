export function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarTexto(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function escaparRegex(valor) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function criarIdPelaUrl(url) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).pathname.split("/").filter(Boolean).at(-1);
  } catch {
    return null;
  }
}

export function extrairQuantidadeVagas(texto) {
  const valor = limparTexto(texto);

  if (/cadastro\s+de\s+reserva/i.test(valor)) {
    return null;
  }

  const resultado = valor.match(/([\d.]+)\s+vagas?/i);

  if (!resultado) {
    return null;
  }

  return Number(resultado[1].replace(/\./g, ""));
}

export function extrairSalarioMaximo(texto) {
  const valores = [...String(texto).matchAll(/R\$\s*([\d.]+,\d{2})/gi)];

  if (valores.length === 0) {
    return null;
  }

  const numeros = valores.map((resultado) =>
    Number(resultado[1].replace(/\./g, "").replace(",", ".")),
  );

  return Math.max(...numeros);
}

export function extrairDataFinal(texto) {
  const valor = limparTexto(texto);

  const datas = [...valor.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];

  if (datas.length === 0) {
    return null;
  }

  const ultimaData = datas.at(-1);
  const [, dia, mes, ano] = ultimaData;

  return `${ano}-${mes}-${dia}`;
}
