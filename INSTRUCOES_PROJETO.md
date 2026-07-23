# Mapa de Concursos — instruções do projeto

## Propósito

O Mapa de Concursos coleta oportunidades do PCI Concursos, identifica os municípios relacionados a cada uma e gera dados para uma interface React com mapa. Na interface, a pessoa usuária permitirá o acesso à própria localização, verá pins de concursos próximos e poderá abrir um pin para consultar seus detalhes e o link **Mais detalhes** para a notícia original no PCI.

O projeto usa Node.js com JavaScript e ES Modules. Preserve `import`/`export`; não use `require`.

## Estrutura e fluxo

```text
src/
  baixar-pci.js              baixa a página de listagem do PCI
  extrair-listagem.js        transforma a listagem em concursos.json
  municipios.js              carrega e localiza municípios
  extrair-noticia.js         extrai localidades da notícia individual
  enriquecer-concursos.js    complementa apenas registros pendentes
  atualizar.js               orquestra o fluxo completo
data/
  municipios.csv
  pci-concursos.html
public/data/
  concursos.json
  resumo.json
```

```text
npm run atualizar
  → baixar página do PCI
  → extrair listagem
  → gerar concursos.json e resumo.json
  → enriquecer concursos pendentes pelas notícias
```

Comandos disponíveis:

```bash
npm run baixar:municipios
npm run baixar:pci
npm run extrair
npm run atualizar
npm run testar:noticia -- "URL_DA_NOTICIA" UF
```

## Contrato atual dos dados

Cada concurso contém, entre outros, `id`, `orgao`, `titulo`, `urlPCI`, `uf`, `localizacao`, `localidades` e `localizacaoPendente`.

Uma localidade contém `codigoIbge`, `cidade`, `uf`, `latitude`, `longitude`, `tipo`, `confianca`, `exibirNoMapa`, `contexto` e `contextos`.

Tipos, prioridades e exibição:

| Tipo | Confiança | Exibir no mapa | Prioridade |
| --- | --- | --- | --- |
| `lotacao` | alta | sim | 5 |
| `sede` | alta | sim | 4 |
| `prova` | média | sim | 3 |
| `inscricao` | média | sim | 2 |
| `mencao` | baixa | somente se não houver tipo mais útil | 1 |

`localizacao` é a localidade principal e deve respeitar essa prioridade. Uma menção nunca substitui lotação, sede, prova ou inscrição. Se a notícia trouxer somente menções válidas, elas devem ser preservadas e exibidas, com `tipo: "mencao"` e confiança baixa.

`localizacaoPendente` só deve ser `false` quando existir uma localidade que possa ser apresentada. Não inventar município com base apenas na sede provável de um órgão.

## Regras de extração importantes

- A listagem pode permitir município em nome oficial de instituição (`permitirNomeInstituicao: true`), como FEA/Andradina, HCPA/Porto Alegre e FURB/Blumenau.
- A notícia completa mantém essa proteção ativada para evitar falsos positivos, como `Hospital Cristiano Machado` → Machado/MG.
- Nomes com espaço ou hífen são equivalentes: `Grão-Pará` e `Grão Pará`.
- Municípios curtos devem continuar funcionando: Itá, Exu, Açu, Ubá e Jaú.
- Não converter estados em cidades: `Estado de São Paulo`, `Estado de Goiás`, `Estado do Tocantins` e `Estado do Rio de Janeiro` não são municípios.
- Preservar intervalos de nomes maiores para evitar sobreposição, por exemplo `Godofredo Viana` não deve gerar `Viana`.
- Uma falha ao enriquecer uma notícia não pode interromper o processamento das demais.
- Enriquecimento é sequencial, com intervalo aproximado de 800 ms entre requisições.

Casos de regressão já validados:

- IFMT: lotações em MT e Cuiabá/MT como `prova`.
- CREF-15/PI: Teresina e Picos como `lotacao`; Bom Jesus como `prova`.
- Governo do Piauí: cidades encontradas apenas como `mencao` são exibidas se não houver localidade mais forte.
- MOBI-Rio: a expressão `Município do Rio de Janeiro` deve identificar Rio de Janeiro/RJ.

## Pendências sem município

Quando a notícia não mencionar uma cidade confiável, manter o concurso pendente. Em etapa futura, o dado pode receber uma classificação de abrangência, por exemplo `nacional`, `estadual` ou `distrito_federal`, sem gerar um pin geográfico enganoso.

Regra especial do Distrito Federal só deve ser adotada conscientemente: usar Brasília/DF para órgão distrital representa sede ou abrangência, não necessariamente local de lotação.

## Diretrizes de desenvolvimento

1. Examinar os arquivos relacionados antes de alterar regras.
2. Preferir mudanças pequenas, localizadas e sem dependências novas.
3. Antes de criar uma regra, avaliar falsos positivos e registrar um teste de regressão.
4. Não rebaixar uma classificação existente: lotação, prova e menção têm semânticas distintas.
5. Rodar `npm run extrair` para mudanças de listagem e `npm run atualizar` para mudanças de enriquecimento.
6. Após o fluxo completo, conferir se `concursos.json` e `resumo.json` possuem os mesmos totais de localizados e pendentes.

## Roadmap

### Concluído

- [x] Extrair concursos abertos e encerrados da listagem, com status e tipo de seleção.
- [x] Localizar municípios pela listagem, inclusive em nomes oficiais de instituições.
- [x] Enriquecer concursos pendentes pelas notícias do PCI.
- [x] Classificar localidades por lotação, sede, prova, inscrição e menção, preservando a prioridade.
- [x] Exibir menções somente quando não existir localização mais útil na notícia.
- [x] Documentar o contrato de dados, regras de extração e visão da interface de mapa.

### 1. Consolidar a coleta e o contrato de dados

- [x] Atualizar `resumo.json` após o enriquecimento, para refletir o resultado final de `concursos.json`.
- [x] Criar testes automatizados com `node:test` para municípios, classificação e prioridades.
- [ ] Incluir, de forma explícita, `abrangencia` ou `motivoSemCidade` nos concursos ainda sem município.
- [ ] Continuar adicionando regras específicas somente quando uma notícia real justificar a regra e houver teste de regressão.

### 2. Preparar uma API de dados para a interface

- [ ] Definir um seletor/transformador que entregue apenas localidades com `exibirNoMapa: true`.
- [ ] Decidir como agrupar múltiplos concursos no mesmo município.
- [ ] Definir filtros mínimos: distância, UF, status, tipo de seleção e período de inscrição.
- [x] Manter `urlPCI` como fonte do link externo de cada cartão/popup.

### 3. Construir a interface React de mapa

- [ ] Solicitar geolocalização com `navigator.geolocation` apenas após ação da pessoa usuária.
- [ ] Prever estado de permissão negada e uma localização manual como alternativa.
- [ ] Renderizar pins com latitude e longitude das `localidades` exibíveis.
- [ ] Calcular e ordenar a proximidade em relação à localização da pessoa usuária.
- [ ] Ao clicar em um pin, mostrar órgão, título, status, tipo de seleção, inscrição, vagas, salário, cidade, tipo da localidade e o link **Mais detalhes** para `urlPCI`.
- [ ] Exibir concursos sem município em lista separada; não colocá-los arbitrariamente no mapa.

### 4. Qualidade da experiência e publicação

- [ ] Tratar agrupamento de pins próximos e acessibilidade do popup.
- [ ] Exibir data/hora da última atualização dos dados.
- [ ] Configurar atualização periódica no ambiente de publicação.
- [ ] Monitorar alterações no HTML do PCI e falhas de extração.

## Próxima tarefa recomendada

Definir e incluir `abrangencia` ou `motivoSemCidade` nos concursos sem município, sem criar pins geográficos artificiais.
