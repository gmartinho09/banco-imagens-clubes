# Banco de Imagens de Clubes

Procura qualquer clube de futebol e reúne, numa só página:

- **Imagens diretas** (com link para abrir/copiar): escudo, logótipo, banner, fan art, equipamentos por época e estádio, vindos do [TheSportsDB](https://www.thesportsdb.com).
- **Imagens com licença livre** do [Wikimedia Commons](https://commons.wikimedia.org), com licença, autor e resolução.
- **Links de pesquisa já feitos** para 15 bancos de imagens: Commons, Flickr CC, Unsplash, Pexels, Pixabay, Getty Images, Shutterstock, Adobe Stock, Alamy, IMAGO, Google/Bing Imagens e sites de logótipos.
- Botões para copiar um link, todos os links ou tudo em JSON.

Se o clube não estiver na base do TheSportsDB, a página mostra na mesma as imagens do Commons e os links dos bancos para o nome escrito.

## Como correr

Precisa de Node.js 18 ou mais recente. Não tem dependências.

```bash
npm start
```

Abre http://localhost:3000 (ou `http://localhost:3000/?q=Benfica` para ir direto a um clube).

## API

| Rota | Devolve |
|---|---|
| `GET /api/search?q=Porto` | Lista de clubes encontrados |
| `GET /api/club?id=134114` | Ficha do clube, imagens agrupadas e links dos bancos |
| `GET /api/club?q=Nome` | Imagens do Commons e links dos bancos para um nome livre |

## Configuração

- `PORT`: porta do servidor (padrão 3000).
- `THESPORTSDB_KEY`: chave do TheSportsDB. A chave gratuita `123` é usada por padrão; uma chave Patreon dá mais resultados (por exemplo, todo o histórico de equipamentos).

## Notas

- As respostas das APIs ficam em cache 30 minutos.
- Escudos e marcas pertencem aos clubes. Antes de usar uma imagem, confirma a licença: o Commons exige atribuição e as agências de stock exigem licença paga.
