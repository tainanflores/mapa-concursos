export const PROPORCAO_MINIMA_DO_TOTAL_ANTERIOR = 0.6;

function ehInteiroNaoNegativo(valor) {
  return Number.isInteger(valor) && valor >= 0;
}

/**
 * Impede que uma alteração no HTML do PCI publique uma extração parcial ou
 * vazia. A comparação é propositalmente tolerante a encerramentos normais de
 * concursos, mas bloqueia uma queda de 40% ou mais de um dia para o outro.
 */
export function validarResumoExtraido({ anterior, atual }) {
  const erros = [];

  for (const campo of ["total", "localizados", "pendentes"]) {
    if (!ehInteiroNaoNegativo(atual[campo])) {
      erros.push(`O campo "${campo}" deve ser um inteiro não negativo.`);
    }
  }

  if (atual.total === 0) {
    erros.push("A extração não encontrou nenhum concurso.");
  }

  if (atual.localizados + atual.pendentes !== atual.total) {
    erros.push(
      "Os totais de localizados e pendentes não correspondem ao total extraído.",
    );
  }

  if (anterior && ehInteiroNaoNegativo(anterior.total) && anterior.total > 0) {
    const totalMinimoAceito = Math.ceil(
      anterior.total * PROPORCAO_MINIMA_DO_TOTAL_ANTERIOR,
    );

    if (atual.total < totalMinimoAceito) {
      erros.push(
        `A extração encontrou ${atual.total} concursos; o mínimo aceitável ` +
          `para o total anterior de ${anterior.total} é ${totalMinimoAceito}.`,
      );
    }
  }

  return erros;
}
