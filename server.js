const http = require('http');
const fs = require('fs');
const path = require('path');
const { searchTeams, lookupTeam, teamImages, commonsImages, imageBankLinks } = require('./sources');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function api(url, res) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);

  if (url.pathname === '/api/search') {
    if (q.length < 2) return send(res, 400, { error: 'Escreve pelo menos 2 letras do nome do clube.' });
    const teams = await searchTeams(q);
    return send(res, 200, { query: q, teams });
  }

  if (url.pathname === '/api/club') {
    const idParam = url.searchParams.get('id');
    let team = null;
    let groups = [];
    if (idParam) {
      if (!/^\d+$/.test(idParam)) return send(res, 400, { error: 'Identificador de clube inválido.' });
      const found = await lookupTeam(idParam);
      if (!found) return send(res, 404, { error: 'Clube não encontrado.' });
      team = found.summary;
      groups = await teamImages(found.raw);
    } else if (q.length < 2) {
      return send(res, 400, { error: 'Indica um clube (id ou q).' });
    }
    const name = team ? team.alternate.split(',')[0].trim() || team.name : q;
    const searchName = team ? team.name : q;
    let commons = [];
    let commonsError = null;
    try { commons = await commonsImages(name); if (!commons.length && name !== searchName) commons = await commonsImages(searchName); }
    catch (e) { commonsError = 'O Wikimedia Commons não respondeu agora. Usa o link do Commons abaixo.'; }
    if (commons.length) groups.push({ key: 'commons', title: 'Wikimedia Commons (licença livre)', source: 'Wikimedia Commons', items: commons });
    return send(res, 200, { team, query: searchName, groups, commonsError, banks: imageBankLinks(searchName) });
  }

  send(res, 404, { error: 'Rota desconhecida.' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(url, res);
    const file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('Não encontrado'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  } catch (e) {
    send(res, 502, { error: `Não foi possível contactar a fonte de dados (${e.message}). Tenta de novo daqui a pouco.` });
  }
});

server.listen(PORT, () => console.log(`Banco de imagens de clubes em http://localhost:${PORT}`));
