const CAMPOS_TECNICOS = new Set([
  "coletadoEm",
  "geradoEm",
  "enriquecidoEm",
  "enriquecimentoTentadoEm",
]);

function normalizarValor(valor) {
  if (Array.isArray(valor)) {
    return valor.map(normalizarValor);
  }

  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => !CAMPOS_TECNICOS.has(chave))
        .sort(([chaveA], [chaveB]) => chaveA.localeCompare(chaveB))
        .map(([chave, item]) => [chave, normalizarValor(item)]),
    );
  }

  return valor;
}

/**
 * Compara os dados publicados, desconsiderando metadados que mudam a cada
 * execução do extrator. A ordem dos itens dos arrays é preservada porque ela
 * também faz parte do conteúdo exibido ao usuário.
 */
export function dadosMudaram(anterior, atual) {
  return (
    JSON.stringify(normalizarValor(anterior)) !==
    JSON.stringify(normalizarValor(atual))
  );
}
