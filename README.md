# Banco de Imagens de Clubes

Procura qualquer clube de futebol e reúne, numa só página:

- **Imagens diretas** (com link para abrir/copiar): escudo, logótipo, banner, fan art, equipamentos por época e estádio, vindos do [TheSportsDB](https://www.thesportsdb.com).
- **Imagens com licença livre** do [Wikimedia Commons](https://commons.wikimedia.org), com licença, autor e resolução.
- **Links de pesquisa já feitos** para 15 bancos de imagens: Commons, Flickr CC, Unsplash, Pexels, Pixabay, Getty Images, Shutterstock, Adobe Stock, Alamy, IMAGO, Google/Bing Imagens e sites de logótipos.
- **Vídeos**, num separador próprio:
  - vídeos com licença livre do Wikimedia Commons, que tocam diretamente na página;
  - resumos dos últimos jogos do clube (link para o YouTube);
  - canal oficial do clube no YouTube;
  - links de pesquisa para 12 bancos de vídeo: YouTube, Commons, Pexels, Pixabay, Getty Images, Shutterstock, Adobe Stock, Storyblocks, Dailymotion e Vimeo.
- Botões para copiar um link, todos os links ou tudo em JSON (imagens e vídeos).

Se o clube não estiver na base do TheSportsDB, a página mostra na mesma as imagens e vídeos do Commons e os links dos bancos para o nome escrito.

## Site online

https://gmartinho09.github.io/banco-imagens-clubes/

O site é estático (pasta `docs/`, publicada pelo GitHub Pages): o navegador consulta diretamente o TheSportsDB e o Wikimedia Commons, sem servidor.

## Como correr localmente

Precisa de Node.js 18 ou mais recente. Não tem dependências.

```bash
npm start
```

Abre http://localhost:3000 (ou `http://localhost:3000/?q=Benfica` para ir direto a um clube).

## API (opcional, só com `npm start`)

| Rota | Devolve |
|---|---|
| `GET /api/search?q=Porto` | Lista de clubes encontrados |
| `GET /api/club?id=134114` | Ficha do clube, imagens agrupadas e links dos bancos |
| `GET /api/club?q=Nome` | Imagens do Commons e links dos bancos para um nome livre |

## Configuração

- `PORT`: porta do servidor (padrão 3000).
- `THESPORTSDB_KEY` (só no servidor Node): chave do TheSportsDB. A chave gratuita `123` é usada por padrão; uma chave Patreon dá mais resultados (por exemplo, todo o histórico de equipamentos).

## Notas

- As respostas das APIs ficam em cache 30 minutos.
- Para mudar o site, edita `docs/index.html` (página) e `docs/sources.js` (fontes e links, partilhado com o servidor).
- Escudos e marcas pertencem aos clubes. Antes de usar uma imagem, confirma a licença: o Commons exige atribuição e as agências de stock exigem licença paga.
