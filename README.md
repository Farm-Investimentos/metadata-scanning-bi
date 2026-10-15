# Catálogo de BIs · Metadata Scanning Power BI

O projeto tem como objetivo mapear e catalogar todo o ecossistema de Power BI da Farmtech por meio da Scanner API REST, criando um inventário corporativo de workspaces, relatórios e datasets. Além do levantamento técnico dos ativos, serão documentados responsáveis, objetivos de negócio, métricas, fontes de dados, frequência de atualização, público consumidor, criticidade e qualidade das informações.

O catálogo servirá como base para a governança analítica da empresa, permitindo identificar sobreposições, oportunidades de consolidação e ativos sem utilização, além de apoiar a reorganização dos relatórios em domínios de negócio padronizados

>O resultado esperado é uma arquitetura analítica mais organizada, escalável e alinhada às necessidades do negócio.


---

## Estrutura da pasta

```text
metadata-scanning-bi/
├── ABRIR_CATALOGO.html        ← atalho: abre o catálogo analítico
├── ABRIR_INVENTARIO.html      ← atalho: abre o inventário estruturado
├── ATUALIZAR_CATALOGO.bat     ← regenera os dados dos painéis a partir do Excel e abre o catálogo
├── README.md
│
├── 01-extracao/
│   └── bi-catalog-v2.ipynb    ← extrai metadados via API do Power BI (usa o seu login)
│
├── saida/                     ← resultado bruto da extração (NÃO versionar: contém servidores e e-mails)
│   ├── catalogo_metadados.xlsx
│   ├── metadados.json
│   ├── historico_uso.csv      ← uso acumulado entre extrações (o Usage Metrics só guarda ~30 dias)
│   └── workspaces_acessiveis.csv
│
├── 02-processamento/
│   ├── atualizar_uso.py       ← soma o uso ao histórico e recalcula as colunas de uso do Excel
│   └── gerar_catalogo.py      ← temas, similaridade, clusters, score de saúde → data/catalogo_data.js
│
├── 03-dashboard/              ← painéis HTML + CSS + JS
│   ├── index.html                (catálogo analítico)
│   ├── inventario.html           (inventário estruturado)
│   ├── assets/css/style.css      (visual compartilhado: sidebar com entalhe, vidro, modais)
│   ├── assets/css/inventario.css
│   ├── assets/js/shell.js        (sidebar recolhível, menu mobile, animação dos modais)
│   ├── assets/js/app.js
│   ├── assets/js/inventario.js
│   ├── assets/img/               (logo Farmtech recortada, versões lime e black-green)
│   ├── assets/vendor/d3.min.js   (D3 v7, local, para funcionar offline)
│   └── data/catalogo_data.js     (gerado pelo passo 02; não editar à mão)
│
└── Design-System/
    ├── Cronograma Onboarding.pptx   ← referência de cores e tipografia
    └── logo_farm.jpg                ← logo original (fonte dos PNGs em assets/img)
```

## Como atualizar

1. **Extrair** (quando quiser dados novos): abra `01-extracao/bi-catalog-v2.ipynb` e rode as células. A saída vai para `../saida/` (a pasta `saida` na raiz). Use `ARGS = ["--all", "--atualizar-uso"]` para reativar os modelos de uso antes de ler (veja **Uso e telemetria**). Ao final, o notebook roda `atualizar_uso.py` sozinho.
2. **Processar e abrir**: dê dois cliques em `ATUALIZAR_CATALOGO.bat`. Se preferir o terminal:
   ```powershell
   .venv\Scripts\python.exe 02-processamento\gerar_catalogo.py
   ```
3. Recarregue `03-dashboard/index.html` no navegador.

Dependências do processamento: `pandas` e `openpyxl`, que já estão na `.venv`.

---

## O que o painel mostra

| Aba | Para que serve |
|---|---|
| **Visão geral** | KPIs, relatórios por tema, workspaces × recomendação, mais acessados e insights automáticos |
| **Grafo de relatórios** | Como cada relatório se conecta aos outros. Pode ser colorido por tema, cluster, workspace ou recomendação, e agrupado por tema. Tem filtro de similaridade mínima e de workspace, e opção de ocultar teste/homologação. Clique num nó para ver os detalhes |
| **Temas & clusters** | Um cartão por tema-alvo, com as **tabelas-chave candidatas** (fatos e dimensões). O modal de cada tema traz o mapa relatórios ↔ tabelas e o **modelo-alvo proposto**. Abaixo ficam os clusters detectados automaticamente |
| **Tabelas & colunas** | Grafo de tabelas, com dois modos: *usadas juntas* ou *colunas parecidas*, que revela tabelas duplicadas com nomes diferentes. Também lista as colunas compartilhadas entre workspaces (candidatas a dimensão conformada) e traz o inventário de tabelas |
| **Sobreposições** | Matriz de similaridade e lista de pares (mesmo modelo, duplicado, alta ou média sobreposição), com comparação lado a lado de cada par |
| **Racionalização** | Score de saúde de 0 a 100, recomendação **Manter / Consolidar / Revisar / Arquivar** com os motivos, scatter de uso × atualização e exportação em CSV do plano de ação |
| **Catálogo completo** | Tabela pesquisável de todos os relatórios, com opção de incluir BI Histórico e Usage Metrics. Exporta CSV |

A busca no topo (atalho `Ctrl K`) encontra relatórios, tabelas, medidas e temas. Todo modal tem link **Abrir no Power BI**. A sidebar recolhe e expande pelo botão encaixado no entalhe da borda, e a escolha fica salva no navegador.

## Painel de inventário (entregável: inventário e catalogação estruturada)

`inventario.html` mostra **só o inventário**, sem as análises de similaridade e racionalização. Ele cobre os 167 relatórios da varredura, incluindo BI Histórico e Usage Metrics, e dá a cada um uma **ficha catalográfica padronizada**.

| Aba | Para que serve |
|---|---|
| **Resumo do inventário** | Totais (dashboards, workspaces, páginas, medidas, fontes, completude), dashboards por workspace e por situação, tema, ano de criação e modo de armazenamento |
| **Catálogo estruturado** | Tabela com filtros por situação, workspace, tema e modo. Clique numa linha para abrir a ficha. Exporta **CSV** (uma coluna por campo) e **JSON** (fichas aninhadas por grupo + dicionário) |
| **Hierarquia** | Workspace › dashboard › página, com zoom. Cartões por workspace com sigla, volume e completude |
| **Completude** | % de preenchimento de cada campo, mapa workspace × campo e lista das fichas com lacunas |
| **Dicionário de campos** | Cada campo da ficha: descrição, origem (API REST, DAX `INFO.VIEW`, Usage Metrics ou derivado), tipo, % de preenchimento e exemplo |

**ID de catálogo.** Cada dashboard recebe um código no formato `SIGLA-NN`, por exemplo `CRE-05`. A sigla vem do workspace, e o número é a ordem de criação dentro dele. O código é gerado no navegador a partir de `catalogo_data.js`, então pode mudar se um relatório mais antigo for adicionado ou removido do workspace.

**Situação.** É uma classificação, e não uma recomendação:

- **Produtivo:** relatório em workspace produtivo.
- **Não produtivo:** teste, homologação, UAT ou versão antiga.
- **Histórico:** está no workspace BI Histórico.
- **Sistema:** Usage Metrics gerado pelo Power BI.

**Completude.** São avaliados 14 campos por ficha. Um campo que não se aplica ao relatório fica fora da conta. Por exemplo, "medidas documentadas" não conta para um relatório sem medidas.

---

## Regras de análise

**Escopo**
- O workspace **BI Histórico** fica fora de relações, clusters, temas e score, porque ele recebe os BIs que serão descontinuados. Esses relatórios aparecem apenas no Catálogo completo.
- Os relatórios automáticos *Usage Metrics Report* também ficam fora da análise.

**Tema de cada relatório.** O tema é definido por palavras-chave, com pesos diferentes conforme a origem:

| Origem | Peso |
|---|---|
| Nome do relatório | 12 |
| Workspace | 4 |
| Tabelas-fato | 3 |
| Páginas | 2 |
| Dimensões | 1,5 |
| Medidas | 0,25 |

As palavras-chave ficam no dicionário `PALAVRAS` em `gerar_catalogo.py`. Ajuste esse dicionário para recalibrar a classificação.

**Similaridade entre relatórios.** A fórmula é: 50% tabelas + 25% medidas + 25% colunas.
- O cálculo usa Jaccard ponderado por IDF, ou seja, tabelas raras pesam mais que tabelas comuns.
- Tabelas genéricas não contam: calendário, `_medidas`, `LocalDateTable` e similares (regex `GENERICA`).
- Relatórios que usam o mesmo dataset recebem similaridade de no mínimo 0,95.
- Relatórios com o mesmo nome-base, ignorando "homolog", "teste", "old", "v2" e datas, são marcados como **duplicado**.

**Clusters.** São calculados com o algoritmo de Louvain sobre as arestas com similaridade ≥ 0,2.

**Score de saúde.** O score começa em 100 e perde pontos conforme a tabela abaixo.

| Critério | Penalidade |
|---|---|
| **Uso:** 0 views | −40 |
| **Uso:** menos de 5 views | −25 |
| **Uso:** menos de 20 views | −10 |
| **Uso:** apenas 1 usuário | −8 |
| **Uso:** sem telemetria | −10 |
| **Atualização:** dados parados há mais de 180 dias | −30 |
| **Atualização:** dados parados há mais de 60 dias | −18 |
| **Atualização:** dados parados há mais de 14 dias | −8 |
| **Atualização:** último refresh falhou | −10 |
| **Atualização:** agenda de refresh desativada | −8 |
| **Ambiente:** teste, homologação, old ou UAT | −15 |
| **Ambiente:** criado há mais de 2 anos | −5 |
| **Sobreposição:** cada par forte | −5 (máx. −15) |

**Recomendação.** A recomendação sai do score e da sobreposição:
- **Arquivar:** score abaixo de 40, ou versão de teste com menos de 5 views.
- **Consolidar:** tem um par forte (mesmo modelo, duplicado ou alta sobreposição).
- **Revisar:** score abaixo de 65.
- **Manter:** os demais casos.

### Técnicas utilizadas

| Técnica | Onde | Por que foi usada | Limite |
|---|---|---|---|
| **Clusters com Louvain** | Aba Temas & clusters, cor "Cluster" no grafo | Agrupa relatórios que se parecem entre si **sem precisar dizer quantos grupos existem**. O número de grupos é um resultado, e não uma entrada como no k-means. Trabalha direto sobre o grafo de similaridade já calculado e é rápido. Ao maximizar a modularidade, ele separa o que é mais ligado por dentro do que por fora, o que se aproxima da pergunta do projeto: quais BIs vivem sobre a mesma base. | Depende do limiar de 0,2: mais baixo junta grupos que não têm relação, mais alto quebra grupos legítimos. O resultado é um ponto de partida. |
| **Palavras-chave ponderadas por origem** | Tema de cada relatório | O nome do relatório (peso 12) é a intenção de quem o criou, e as medidas (peso 0,25) são numerosas e ruidosas, com 6 mil medidas. Cada palavra conta no máximo 2 vezes por texto, para uma repetição não decidir sozinha. Os 8 temas vêm do negócio, e um modelo aprendido não saberia reproduzi-los sem exemplos. | Cobertura depende do dicionário `PALAVRAS`. Relatórios com nomes genéricos caem em "Outros". |
| **Jaccard ponderado por IDF** | Similaridade entre relatórios | Jaccard compara conjuntos de tabelas, medidas e colunas sem ser distorcido pelo tamanho do modelo. O peso IDF faz uma tabela usada por quase todos os relatórios valer pouco como sinal de duplicidade, e uma tabela rara valer muito. | Compara **nomes**: sem as expressões DAX, duas medidas com o mesmo nome e contas diferentes parecem iguais. |
| **Pesos 50% tabelas, 25% medidas, 25% colunas** | Similaridade | A tabela é a origem do dado, mais estável e mais relevante para consolidar. Medidas e colunas confirmam o parentesco. | Pesos definidos por julgamento, não estimados. Podem ser recalibrados em `gerar_catalogo.py`. |
| **Mínimo de 0,95 para o mesmo dataset e regra de nome-base** | Pares "mesmo modelo" e "duplicado" | Dois relatórios que apontam para o mesmo dataset são o mesmo dado por definição. Cópias entre ambientes (teste, homolog., old, v2) são o caso mais comum de duplicidade e se identificam pelo nome. | A regra de nome-base pode juntar relatórios de nome parecido mas finalidade diferente. |
| **Tabelas-chave por tema** | Cartões de tema | Pontua cada tabela pelas palavras do tema que aparecem nela e nas colunas, dá peso maior a tabelas fato (1,5) e soma pontos pelo número de relatórios que a usam. Isso favorece o que já é reaproveitado, que é o melhor candidato a modelo único. | É uma lista de candidatas para a discussão, e não uma decisão de arquitetura. |
| **Score por penalidades** | Racionalização | Começa em 100 e subtrai pontos por critério, com cada motivo mostrado ao lado da recomendação. É simples de auditar e de contestar com o owner. | Limiares como 60 e 180 dias foram escolhidos por julgamento. O uso medido pode estar subestimado se a telemetria estiver congelada. |
| **Grafo de forças (D3)** | Grafo de relatórios e de tabelas | Relatórios ligados se aproximam e os isolados ficam à margem, o que dá uma leitura imediata da estrutura. | A posição no plano não tem significado exato. Para ver a similaridade de um par, abra a comparação lado a lado. |
| **Histórico de uso acumulado** | `historico_uso.csv` | O Usage Metrics guarda só 30 dias por vez. Somar o uso a cada extração é a única forma de ter um período maior sem acesso de administrador. | Só cobre os períodos em que houve extração. O que ficou fora da janela antes da primeira extração não é recuperável por essa fonte. |

### Uso e telemetria

O uso vem do modelo **Usage Metrics Report** de cada workspace (tabela `'Report views'`). Existe um modelo por workspace, filtrado por `ReportId`; os relatórios "Usage Metrics Report" que aparecem por relatório no Power BI leem esse mesmo modelo.


| Coluna | Regra |
|---|---|
| `ultima_visualizacao` | Data mais recente entre todos os usuários do relatório, no histórico acumulado |
| `primeira_visualizacao` | Primeira view registrada. `primeira_visualizacao_exata = não` quando só há o total da janela: nesse caso, é o início da janela (a view pode ser anterior) |
| `periodo_uso_coberto` | Data de criação do relatório até `ultima_visualizacao` |
| `views_total`, `viewers_total`, `views_por_usuario` | Somados sobre o histórico acumulado (`saida/historico_uso.csv`), sem contar o mesmo dia duas vezes |
| `telemetria_desde`, `uso_dados_ate` | Janela que o Usage Metrics do workspace realmente cobre |
| `situacao_telemetria` | `atual`, `congelada desde AAAA-MM-DD` ou `sem telemetria` |

A aba `uso_por_usuario` traz, por usuário, as views, a primeira e a última visualização. A aba `uso_telemetria_workspace` mostra, por workspace, até quando há dados e o status do refresh do modelo de uso.

Para ter o uso até hoje:

1. Rode a extração com `--atualizar-uso`. O notebook dispara o refresh de cada modelo de uso antes de ler. É a única ação de escrita do script. Se o Power BI recusar, a chamada aparece na aba `erros`; nesse caso, abrir o relatório de uso do workspace no Power BI também reativa o refresh.
2. Extraia com frequência menor que 30 dias. Cada extração traz o uso **por dia** e soma ao histórico, então o período cresce a cada execução, desde o primeiro visualizador registrado. O que já saiu da janela de 30 dias antes da primeira extração não pode ser recuperado por essa fonte; isso só é possível pelo log de atividades do Power BI, que exige perfil de administrador.

### Limitações conhecidas
- **Uso.** Vem do modelo *Usage Metrics* de cada workspace (ver **Uso e telemetria**). Alguns workspaces não têm esse modelo acessível: BI Dados & Analytics, Tecnologia, Comercial, Homologação, Crédito UAT, Mercado de Capitais e Gestão de Fundos. Os relatórios desses workspaces aparecem como **sem telemetria**. Confirme o uso desses relatórios antes de arquivá-los.
- **Expressões DAX.** Não vieram na extração, então a comparação de medidas é feita pelo nome.
- **Classificação automática.** Os temas e as tabelas-chave são um **ponto de partida** para a discussão com os owners, e não uma decisão final.
