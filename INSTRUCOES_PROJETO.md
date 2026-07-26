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
  dados-atualizados.js       compara dados sem metadados técnicos de execução
  verificar-alteracoes-dados.js
                             verifica se há mudança efetiva antes do commit
data/
  municipios.csv
  pci-concursos.html
public/data/
  concursos.json
  localidades.json
  municipios.json
  pontos-mapa.json
  resumo.json
frontend/
  src/                       interface React + Leaflet
  scripts/copiar-dados.mjs   leva os JSONs para o build do front-end
  vercel.json                define a política de cache dos dados
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

Quando `localizacaoPendente` é `true`, o concurso também possui `abrangencia` (`nacional`, `estadual`, `distrito_federal` ou `indefinida`) e `motivoSemCidade`. Esses campos descrevem o escopo disponível sem criar uma localização ou pin artificial.

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

## Publicação e fluxo de Git

O ramo de produção é `main`. Enquanto o projeto estiver conectado à Vercel, um `git push origin main` publica uma nova versão do site. Portanto, durante o desenvolvimento é aceitável criar commits locais normalmente, mas o push só deve ser feito quando a alteração estiver verificada e puder ir para produção.

Não será mantida uma branch remota de desenvolvimento neste momento: pushes de outras branches conectadas à Vercel podem gerar *preview deployments*. Se, no futuro, a equipe precisar de revisão por pull request ou homologação, reavaliar esse fluxo junto com a migração de hospedagem.

## Aplicativo, alertas e monetização

O mapa e a consulta de concursos continuarão gratuitos. O `urlPCI` permanece como fonte e link de detalhes de cada concurso. Não acessar todas as notícias apenas para procurar editais: isso aumenta o tempo e a fragilidade da coleta. Caso uma extração confiável de edital seja criada no futuro, exibir **Ver edital** como link adicional, sem remover **Mais detalhes no PCI**.

O aplicativo Android reutiliza o front-end React por meio do Capacitor. A consulta de concursos continuará gratuita. Antes de ativar publicidade ou cobrança, confirmar que a hospedagem escolhida e seus termos atendem ao uso comercial; se necessário, migrar o front-end estático e os JSONs antes do lançamento público.

Modelo definido:

| Plano gratuito | Mapa de Concursos Plus |
| --- | --- |
| Mapa, busca, filtros e detalhes | Todos os recursos gratuitos |
| Conta e favoritos sincronizados | Sem anúncios |
| Um alerta ativo para uma cidade específica | Até 10 alertas por cidade, UF, raio ou Brasil inteiro |
| Banner adaptável e discreto no rodapé | Sem anúncios |
| App Open Ad com limite conservador de frequência | — |
|  | Lembretes de prazo de inscrição dos favoritos |
|  | Preferências avançadas de alertas quando houver necessidade real |

Não haverá pesquisas salvas nesta primeira versão. No plano gratuito, a pessoa escolhe somente uma cidade específica para receber alertas de **novos concursos abertos**. Alertas por UF, raio de uma origem ou Brasil inteiro são recursos Plus. A coleta é diária; por isso não prometer notificações em tempo real. As opções de frequência (imediata, diária e semanal) não fazem parte do produto planejado: há apenas o aviso quando a rotina diária detectar uma novidade compatível.

Preço inicial planejado para o Plus:

- R$ 4,90 por mês.
- R$ 39,90 por ano.
- Sem período de teste gratuito na primeira versão. Preços promocionais e testes só serão avaliados após o beta e dados reais de uso.
- A assinatura será vendida exclusivamente pelo Google Play Billing. O backend validará a compra antes de conceder o plano Plus.

Regras de anúncios:

- Usar AdMob nativo no aplicativo Capacitor.
- O banner deve reservar espaço próprio, não cobrir mapa, pins, controles ou conteúdo; ocultá-lo em tela cheia e em modais.
- Usar o formato **App Open Ad** apenas na abertura/retorno do aplicativo, no máximo uma vez a cada 24 horas. Não usar intersticial comum na inicialização nem durante a navegação do mapa.
- Não exibir App Open Ad na primeira abertura após a instalação nem em retornos rápidos ao aplicativo.
- Nunca apresentar banner junto com App Open Ad.
- Uma assinatura Plus válida impede o carregamento e a exibição de anúncios.
- Antes do Google Play Billing estar validado no backend, não bloquear recursos: no máximo, apresentar a comparação de planos como “em breve”.
- Não criar uma espera fixa de cinco segundos: o comportamento de fechar deve respeitar o formato e as políticas do AdMob.
- Antes de ativar anúncios, implementar consentimento adequado de publicidade e privacidade.

Regras de conta, privacidade e notificações:

- O mapa pode ser usado sem conta. Cadastro é necessário apenas para alertas e sincronização de favoritos.
- Uma conta pode ser usada em mais de um aparelho.
- A tela de conta deverá oferecer exclusão definitiva da conta e dos dados associados: perfil, favoritos, alertas e dispositivos.
- Ao tocar em uma notificação, o aplicativo deverá abrir a lista ou o detalhe do concurso que gerou o aviso.
- Não enviar duas vezes a mesma combinação de pessoa, alerta e concurso.
- Métricas devem ser agregadas e mínimas: instalações, contas criadas, alertas criados/pausados, notificações entregues/abertas e conversão para Plus. Não usar localização precisa para segmentação de publicidade.

Arquitetura prevista para recursos pessoais:

```text
Aplicativo Capacitor (React)
  → Supabase: autenticação, favoritos, alertas, dispositivos e plano da conta
  → Firebase Cloud Messaging: entrega gratuita de notificações push
  → rotina diária no GitHub Actions / serviço seguro: compara concursos e envia avisos
```

O Firebase será usado somente para o Firebase Cloud Messaging (FCM), que é gratuito. O Supabase será o banco e a autenticação. Chaves administrativas nunca devem ser incluídas no aplicativo: ficam nos segredos do GitHub Actions ou em uma função/serviço seguro.

Alertas respeitam a área salva de cada pessoa (Brasil, UF ou cidade/origem com raio), registram cada envio para evitar duplicação e notificam apenas concursos novos e abertos. A rotina diária só tenta enviar quando a coleta encontrar uma mudança efetiva nos dados. Lembretes de prazo de favoritos continuam locais no aparelho e não exigem backend.

## Roadmap

### Concluído

- [x] Extrair concursos abertos e encerrados da listagem, com status e tipo de seleção.
- [x] Localizar municípios pela listagem, inclusive em nomes oficiais de instituições.
- [x] Enriquecer concursos pendentes pelas notícias do PCI.
- [x] Classificar localidades por lotação, sede, prova, inscrição e menção, preservando a prioridade.
- [x] Exibir menções somente quando não existir localização mais útil na notícia.
- [x] Documentar o contrato de dados, regras de extração e visão da interface de mapa.
- [x] Criar interface React responsiva com Leaflet, pins por município, popup e tela de detalhes.
- [x] Adicionar busca manual de cidade, geolocalização por ação da pessoa usuária e marcador de origem.
- [x] Adicionar filtros por raio, UF, status, tipo de seleção e período de inscrição.
- [x] Calcular distância por rota sob demanda na tela de detalhes.
- [x] Publicar o front-end na Vercel e corrigir o carregamento de ícones do Leaflet em produção.
- [x] Configurar revalidação dos JSONs para que uma recarga do site obtenha dados atualizados.
- [x] Configurar GitHub Actions diário, com commit e deploy somente quando houver mudança efetiva nos dados.

### 1. Consolidar a coleta e o contrato de dados

- [x] Atualizar `resumo.json` após o enriquecimento, para refletir o resultado final de `concursos.json`.
- [x] Criar testes automatizados com `node:test` para municípios, classificação e prioridades.
- [x] Incluir, de forma explícita, `abrangencia` ou `motivoSemCidade` nos concursos ainda sem município.
- [ ] Continuar adicionando regras específicas somente quando uma notícia real justificar a regra e houver teste de regressão.

### 2. Preparar uma API de dados para a interface

- [x] Definir um seletor/transformador que entregue apenas localidades com `exibirNoMapa: true`.
- [x] Decidir como agrupar múltiplos concursos no mesmo município.
- [x] Definir filtros mínimos: distância, UF, status, tipo de seleção e período de inscrição.
- [x] Manter `urlPCI` como fonte do link externo de cada cartão/popup.

### 3. Construir a interface React de mapa

- [x] Solicitar geolocalização com `navigator.geolocation` apenas após ação da pessoa usuária.
- [x] Prever estado de permissão negada e uma localização manual como alternativa.
- [x] Renderizar pins com latitude e longitude das `localidades` exibíveis.
- [x] Calcular distância por rota quando a pessoa usuária solicitar os detalhes de um concurso.
- [x] Exibir lista de concursos mais próximos, ordenada pela menor distância em linha reta até a origem selecionada.
- [x] Ao clicar em um pin, mostrar órgão, título e o link **Mais detalhes** para `urlPCI`.
- [x] Exibir concursos sem município em lista separada, com abrangência, filtros compatíveis e link para os detalhes; não colocá-los arbitrariamente no mapa.

### 4. Qualidade da experiência e publicação

- [x] Limitar a altura dos popups e permitir rolagem para preservar a usabilidade em telas pequenas.
- [x] Oferecer mapa em tela cheia e modal de detalhes em tela cheia, incluindo suporte a viewport móvel dinâmica.
- [x] Agrupar pins próximos para reduzir sobreposição e permitir zoom progressivo no mapa.
- [x] Garantir foco inicial, retorno e contenção de foco, além de fechamento por `Esc` nos painéis e modais; permitir fechar popup ao clicar no mapa.
- [x] Exibir informações sobre fonte dos dados, limitações, localização e privacidade no próprio site.
- [ ] Fazer uma auditoria manual mais ampla de acessibilidade em teclado e leitor de tela.
- [x] Decidir não exibir data/hora de atualização na interface; a situação e os prazos já aparecem nos pontos e detalhes.
- [x] Configurar atualização periódica no ambiente de publicação.
- [x] Evitar commit/deploy quando somente os metadados técnicos de data tiverem mudado.
- [x] Impedir publicação quando a extração produzir resultado vazio, inconsistente ou 40% menor que o último conjunto publicado; registrar uma falha clara no GitHub Actions.
- [ ] Monitorar alterações no HTML do PCI e falhas de extração.

### 5. Preparar aplicativo sem monetização

- [x] Tornar o front-end instalável como PWA, com manifesto, service worker e botão de instalação quando suportado; manter `/data/*` fora do cache do service worker.
- [x] Integrar Capacitor ao React, criar o projeto Android e gerar/instalar o primeiro APK de desenvolvimento.
- [x] Validar mapa, geolocalização, pesquisa, tela cheia, modais e links externos no aparelho físico.
- [x] Criar favoritos locais persistidos no aparelho, com inclusão pelos detalhes e lista para consultar/remover.
- [x] Decidir não implementar pesquisas salvas nesta primeira versão.
- [x] Criar telas de conta, favoritos e alertas, sem cobrança ativa.
- [ ] Criar uma tela simples de comparação entre Gratuito e Plus, apenas informativa e sem bloquear recursos até existir cobrança real.
- [x] Publicar Política de Privacidade e Termos de Uso acessíveis no site, cobrindo localização, conta, favoritos, notificações, FCM e fontes dos dados.
- [ ] Definir e-mail oficial de suporte e substituir o canal provisório do GitHub nos documentos antes da publicação na Play Store.
- [x] Preparar fonte de dados configurável: usar `VITE_DADOS_BASE_URL` para JSONs remotos e recorrer aos JSONs incluídos no APK se a URL não estiver definida ou falhar.

### 6. Criar recursos pessoais e alertas

- [x] Modelar a base Supabase e preparar o cliente: perfis, favoritos, pesquisas salvas, alertas, dispositivos e registro de envios, todos protegidos por Row Level Security.
- [x] Criar o projeto Supabase e aplicar a migration inicial no painel.
- [x] Implementar autenticação por e-mail e sincronização de favoritos entre aparelhos, mantendo a cópia local como contingência.
- [x] Oferecer confirmação de senha no cadastro e recuperação de senha por e-mail.
- [x] Decidir não sincronizar pesquisas salvas; manter apenas favoritos e alertas.
- [x] Integrar Firebase Cloud Messaging no app Android e validar o primeiro envio em ambiente de teste.
- [x] Permitir configurar alertas de novos concursos por alcance nacional, UF ou raio de cidade.
- [x] Criar rotina segura no GitHub Actions que detecta concursos novos e abertos, aplica a área de cada alerta, evita duplicação e envia pelo FCM sem expor credenciais administrativas.
- [x] Criar disparo manual de notificação de teste para validar GitHub Actions, Supabase, Firebase e o APK sem depender de concurso novo.
- [x] Simplificar a tela e o banco de alertas: remover frequência, situação e tipo; preparar cidade específica como alerta gratuito e UF, raio ou Brasil como recursos Plus. Os tipos Plus permanecem liberados durante os testes, até a cobrança ser ativada.
- [ ] Fazer o toque em uma notificação abrir os concursos ou o detalhe relacionado no aplicativo.
- [ ] Limpar ou desativar tokens FCM inválidos retornados pelo Firebase, para não repetir tentativas a aparelhos removidos.
- [x] Implementar lembretes locais para favoritos: avisos 7, 3 e 1 dia antes do prazo, com horário configurável no APK e sem backend.
- [ ] Restringir lembretes locais de prazo a contas Plus quando o controle de planos e a cobrança estiverem ativos.

### 7. Preparar monetização sem ativá-la

- [x] Criar uma migration do Supabase para perfil de plano (`gratuito`/`plus`), limites e criação automática de perfil para novas contas.
- [ ] Aplicar a migration de planos no projeto Supabase; as contas existentes e futuras deverão iniciar como `gratuito`.
- [ ] Centralizar no front-end os limites do plano, sem bloqueio definitivo enquanto o Google Play Billing não estiver validado.
- [x] Definir os limites iniciais: gratuito com 1 alerta ativo para cidade específica; Plus com até 10 alertas por cidade, UF, raio ou Brasil, lembretes de prazo, sem anúncios e futuras preferências avançadas.
- [x] Definir o preço inicial do Plus: R$ 4,90/mês ou R$ 39,90/ano, sem teste gratuito na primeira versão.
- [x] Criar tela informativa “Mapa de Concursos Plus”, sem compra ativa, explicando o que será gratuito e Premium.
- [ ] Incluir exclusão definitiva de conta e dados pessoais na tela de conta antes do lançamento público.
- [ ] Confirmar a hospedagem compatível com uso comercial antes de ativar anúncios ou assinaturas; migrar o frontend e JSONs se necessário.
- [ ] Atualizar os documentos legais com provedores, anúncios e pagamentos efetivamente ativados.

### 8. Ativar modelo freemium e publicar beta

- [ ] Criar conta AdMob, configurar consentimento e usar IDs de teste durante o desenvolvimento.
- [ ] Integrar AdMob nativo no Capacitor: banner adaptável em área reservada e App Open Ad no máximo uma vez a cada 24 horas, sem mostrar na primeira abertura pós-instalação ou em retornos rápidos.
- [ ] Ocultar anúncios para Plus, mapas em tela cheia, modais e telas críticas; nunca cobrir mapa, pins ou controles.
- [ ] Integrar Google Play Billing em ambiente sandbox e validar compras/assinaturas em backend seguro antes de conceder o plano Plus.
- [ ] Ativar Plus: sem anúncios, até 10 alertas por cidade, UF, raio ou Brasil, lembretes de prazo e preferências avançadas planejadas.
- [ ] Implementar métricas mínimas de produto, sem localização precisa para publicidade: instalações, contas, alertas, entrega/abertura de notificações e conversão para Plus.
- [ ] Preparar ficha da Play Store: ícone, screenshots, classificação indicativa, Data Safety, política de privacidade e beta fechado.
- [ ] Publicar beta fechado, recolher feedback e só então habilitar anúncios e assinaturas para público real.

## Próxima tarefa recomendada

Aplicar a migration de planos e limites no Supabase, mantendo todas as contas como gratuitas inicialmente. Em seguida, criar a tela informativa do Mapa de Concursos Plus, ainda sem bloquear recursos nem integrar cobrança.

## Automação e hospedagem

O scraper permanece na raiz do repositório e é executado pelo workflow `.github/workflows/atualizar-concursos.yml`. Ele usa `npm ci`, executa `npm run atualizar` e bloqueia o fluxo se o resumo for vazio, inconsistente ou tiver queda superior a 40% em relação ao último conjunto publicado. Em seguida, executa `npm test`. Antes de versionar `public/data/*.json`, compara os dados gerados com o último commit, ignorando `coletadoEm`, `geradoEm`, `enriquecidoEm` e `enriquecimentoTentadoEm`. Portanto, só cria commit quando houver mudança efetiva para o site.

O agendamento diário está ativo às 07:17 no horário de Brasília (`17 10 * * *` em UTC). Uma execução sem alteração efetiva não gera deploy na Vercel.

O front-end React está em `frontend/` e é hospedado na Vercel, usando `frontend/` como diretório-raiz do projeto. Os JSONs gerados na raiz são copiados durante o build, para que o site entregue `/data/concursos.json`, `/data/localidades.json`, `/data/municipios.json`, `/data/pontos-mapa.json` e `/data/resumo.json`. O `frontend/vercel.json` configura os dados com `Cache-Control: public, max-age=0, must-revalidate`: em uma recarga, o navegador valida a versão atual sem precisar limpar o cache manualmente.

Para o APK, a variável de build `VITE_DADOS_BASE_URL` pode apontar para uma pasta pública `data`, como `https://dominio.exemplo/data`. Sem essa variável, ou caso a consulta remota falhe, o aplicativo usa os JSONs copiados para dentro do APK. Os dados públicos recebem `Access-Control-Allow-Origin: *`, necessário para que o WebView do Capacitor consulte uma origem diferente. O arquivo `frontend/.env.example` documenta a configuração; criar `frontend/.env.local` com a URL real quando houver hospedagem de dados.

## Supabase

O esquema inicial está em `supabase/migrations/20260724000000_initial_schema.sql`. Ele não armazena os concursos públicos: guarda apenas dados pessoais, como favoritos, pesquisas, alertas, dispositivos e registro de notificações. Todas as tabelas possuem Row Level Security; a pessoa autenticada só pode acessar registros com o próprio `usuario_id`.

Para configurar o ambiente local, copiar os valores públicos do projeto para `frontend/.env.local`:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Nunca incluir a chave `service_role` no front-end, no APK ou em arquivos versionados. Ela será usada futuramente somente em automações seguras, como uma função que envia notificações.

No Supabase, em **Authentication → URL Configuration**, o `Site URL` e as `Redirect URLs` devem incluir o domínio publicado do site. No Vercel, configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos ambientes de Production e Preview antes de publicar recursos de conta.
