// Fontes de dados e geração de links para bancos de imagens.
// Funciona no navegador (GitHub Pages) e no Node.js (server.js).
(function () {
const IS_NODE = typeof window === 'undefined';
const SPORTSDB_KEY = (IS_NODE && process.env.THESPORTSDB_KEY) || '123'; // chave gratuita pública
const SPORTSDB = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const UA = 'BancoImagensClubes/1.0 (projeto educativo; Node.js)';

const cache = new Map();
const TTL = 1000 * 60 * 30;

async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  // No navegador não se envia User-Agent: obrigaria a um pedido CORS de verificação que o TheSportsDB recusa.
  const headers = IS_NODE ? { 'User-Agent': UA, Accept: 'application/json' } : {};
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${res.status} em ${new URL(url).host}`);
  const text = await res.text();
  let v;
  try { v = JSON.parse(text); } catch { throw new Error(`Resposta inválida de ${new URL(url).host}`); }
  cache.set(url, { t: Date.now(), v });
  return v;
}

const enc = encodeURIComponent;
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function summarizeTeam(t) {
  return {
    id: t.idTeam,
    name: t.strTeam,
    alternate: t.strTeamAlternate || '',
    short: t.strTeamShort || '',
    country: t.strCountry || '',
    league: t.strLeague || '',
    founded: t.intFormedYear || '',
    stadium: t.strStadium || '',
    location: t.strLocation || '',
    website: t.strWebsite ? `https://${t.strWebsite.replace(/^https?:\/\//, '')}` : '',
    colors: [t.strColour1, t.strColour2, t.strColour3].filter((c) => /^#[0-9a-f]{3,8}$/i.test(c || '')),
    badge: t.strBadge || '',
    youtube: t.strYoutube ? `https://${t.strYoutube.replace(/^https?:\/\//, '')}` : '',
  };
}

async function searchTeams(q) {
  const data = await getJSON(`${SPORTSDB}/searchteams.php?t=${enc(q)}`);
  return (data.teams || []).filter((t) => t.strSport === 'Soccer').map(summarizeTeam);
}

async function lookupTeam(id) {
  const data = await getJSON(`${SPORTSDB}/lookupteam.php?id=${enc(id)}`);
  const t = (data.teams || [])[0];
  if (!t) return null;
  return { raw: t, summary: summarizeTeam(t) };
}

async function teamImages(raw) {
  const groups = [];
  const id = (label, url, extra = {}) => (url ? { label, url, ...extra } : null);

  const identity = [
    id('Escudo', raw.strBadge, { kind: 'png' }),
    id('Logótipo', raw.strLogo, { kind: 'png' }),
    id('Banner', raw.strBanner, { kind: 'jpg', wide: true }),
  ].filter(Boolean);
  if (identity.length) groups.push({ key: 'identidade', title: 'Escudo e identidade', source: 'TheSportsDB', items: identity });

  const fanart = [1, 2, 3, 4].map((n) => id(`Fan art ${n}`, raw[`strFanart${n}`], { wide: true })).filter(Boolean);
  if (fanart.length) groups.push({ key: 'fanart', title: 'Fotos e fan art', source: 'TheSportsDB', items: fanart });

  const tasks = [
    getJSON(`${SPORTSDB}/lookupequipment.php?id=${enc(raw.idTeam)}`).catch(() => ({})),
    raw.idVenue ? getJSON(`${SPORTSDB}/lookupvenue.php?id=${enc(raw.idVenue)}`).catch(() => ({})) : Promise.resolve({}),
  ];
  const [equip, venue] = await Promise.all(tasks);

  const kits = (equip.equipment || [])
    .slice()
    .sort((a, b) => (b.strSeason || '').localeCompare(a.strSeason || ''))
    .map((e) => id(`${e.strSeason || 'Época ?'} · ${kitType(e.strType)}`, e.strEquipment, { kind: 'png' }))
    .filter(Boolean);
  if (!kits.length && raw.strEquipment) kits.push({ label: 'Equipamento atual', url: raw.strEquipment, kind: 'png' });
  if (kits.length) groups.push({ key: 'equipamentos', title: 'Equipamentos por época', source: 'TheSportsDB', items: kits });

  const v = (venue.venues || [])[0];
  if (v) {
    const vi = [id(v.strVenue, v.strThumb, { wide: true }), ...[1, 2, 3, 4].map((n) => id(`${v.strVenue} ${n}`, v[`strFanart${n}`], { wide: true }))].filter(Boolean);
    if (vi.length) groups.push({ key: 'estadio', title: 'Estádio', source: 'TheSportsDB', items: vi });
  }
  return groups;
}

function kitType(t) {
  return { '1st': 'Principal', '2nd': 'Alternativo', '3rd': 'Terceiro', GK: 'Guarda-redes' }[t] || t || 'Equipamento';
}

async function commonsImages(query, limit = 24) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    `&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${enc(`${query} football`)}` +
    '&prop=imageinfo&iiprop=url|mime|extmetadata|size&iiurlwidth=480';
  const data = await getJSON(url);
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages
    .map((p) => {
      const ii = (p.imageinfo || [])[0];
      if (!ii || !/^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(ii.mime)) return null;
      // Ignora fragmentos minúsculos (ex.: peças de equipamento de infocaixas da Wikipédia).
      if (ii.mime !== 'image/svg+xml' && Math.max(ii.width || 0, ii.height || 0) < 300) return null;
      if (/^File:Kit[ _]/i.test(p.title)) return null;
      const m = ii.extmetadata || {};
      const strip = (h) => (h || '').replace(/<[^>]*>/g, '').trim();
      return {
        label: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
        url: ii.url,
        thumb: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        license: strip(m.LicenseShortName && m.LicenseShortName.value),
        author: strip(m.Artist && m.Artist.value).slice(0, 80),
        size: ii.width && ii.height ? `${ii.width}×${ii.height}` : '',
      };
    })
    .filter(Boolean);
}

// Vídeos com licença livre no Wikimedia Commons (webm/ogv, reproduzíveis no navegador).
async function commonsVideos(query, { strict = false, limit = 30 } = {}) {
  const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const needle = norm(query);
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    `&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${enc(`"${query}" filetype:video`)}` +
    '&prop=imageinfo&iiprop=url|mime|extmetadata|size&iiurlwidth=480';
  const data = await getJSON(url);
  const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const strip = (h) => (h || '').replace(/<[^>]*>/g, '').trim();
  return pages
    .map((p) => {
      const ii = (p.imageinfo || [])[0];
      if (!ii || !/^(video\/|application\/ogg)/.test(ii.mime)) return null;
      // Só vídeos cujo título nomeia o clube (a pesquisa do Commons também apanha texto das descrições).
      if (!norm(p.title).includes(needle)) return null;
      const m = ii.extmetadata || {};
      return {
        type: 'video',
        label: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
        url: ii.url,
        thumb: ii.thumburl || '',
        page: ii.descriptionurl,
        duration: formatDuration(ii.duration),
        license: strip(m.LicenseShortName && m.LicenseShortName.value),
        author: strip(m.Artist && m.Artist.value).slice(0, 80),
        size: ii.width && ii.height ? `${ii.width}×${ii.height}` : '',
      };
    })
    .filter(Boolean)
    .map((v, i) => ({ v, i, score: FOOTBALL_WORDS.test(norm(v.label)) ? 0 : 1 }))
    .filter((x) => !strict || x.score === 0)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((x) => x.v);
}

// Palavras que indicam que o vídeo é de futebol (sobem para o topo da lista).
const FOOTBALL_WORDS = /\b(futebol|football|soccer|futbol|fc|sc|jogo|golo|golos|gol|gols|goal|goals|torcida|adeptos|fans|estadio|stadium|match|campeonato|liga|league|taca|copa|cup|treinador|jogador|clube|club|vs|x)\b/;

function formatDuration(sec) {
  if (!sec) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Últimos jogos do clube, com link para o resumo em vídeo (oficial quando existe, senão pesquisa no YouTube).
async function recentMatches(teamId) {
  const data = await getJSON(`${SPORTSDB}/eventslast.php?id=${enc(teamId)}`);
  return (data.results || [])
    .slice()
    .sort((a, b) => (b.dateEvent || '').localeCompare(a.dateEvent || ''))
    .map((e) => {
      const score = e.intHomeScore != null && e.intAwayScore != null ? ` ${e.intHomeScore}-${e.intAwayScore} ` : ' vs ';
      const title = `${e.strHomeTeam}${score}${e.strAwayTeam}`;
      const search = `${e.strHomeTeam} ${e.strAwayTeam} resumo ${(e.dateEvent || '').slice(0, 4)}`;
      return {
        type: 'match',
        label: title,
        url: e.strVideo || `https://www.youtube.com/results?search_query=${enc(search)}`,
        official: Boolean(e.strVideo),
        thumb: e.strThumb ? `${e.strThumb}/medium` : '',
        author: [e.dateEvent, e.strLeague].filter(Boolean).join(' · '),
      };
    });
}

function videoBankLinks(name, youtube) {
  const q = enc(name);
  const s = slug(name);
  return [
    ...(youtube ? [{ group: 'Oficial', name: 'Canal oficial no YouTube', note: 'Vídeos publicados pelo clube', url: youtube }] : []),
    { group: 'Oficial', name: 'YouTube: resumos e golos', note: 'Resumos de jogos', url: `https://www.youtube.com/results?search_query=${enc(name + ' resumo golos')}` },
    { group: 'Licença livre', name: 'Wikimedia Commons (vídeos)', note: 'Vídeos com licença livre', url: `https://commons.wikimedia.org/w/index.php?search=${q}&title=Special:MediaSearch&type=video` },
    { group: 'Licença livre', name: 'Pexels Vídeos', note: 'Vídeos gratuitos', url: `https://www.pexels.com/search/videos/${q}/` },
    { group: 'Licença livre', name: 'Pixabay Vídeos', note: 'Vídeos gratuitos', url: `https://pixabay.com/videos/search/${q}/` },
    { group: 'Agências e stock', name: 'Getty Images (vídeo)', note: 'Imagens de jogos e arquivo', url: `https://www.gettyimages.com/search/2/film?phrase=${q}` },
    { group: 'Agências e stock', name: 'Shutterstock (vídeo)', note: 'Editorial e stock', url: `https://www.shutterstock.com/video/search/${s}` },
    { group: 'Agências e stock', name: 'Adobe Stock (vídeo)', note: 'Stock e editorial', url: `https://stock.adobe.com/search/video?k=${q}` },
    { group: 'Agências e stock', name: 'Storyblocks', note: 'Vídeo stock por subscrição', url: `https://www.storyblocks.com/video/search/${s}` },
    { group: 'Plataformas', name: 'YouTube', note: 'Pesquisa geral', url: `https://www.youtube.com/results?search_query=${q}` },
    { group: 'Plataformas', name: 'Dailymotion', note: 'Pesquisa geral', url: `https://www.dailymotion.com/search/${q}/videos` },
    { group: 'Plataformas', name: 'Vimeo', note: 'Pesquisa geral', url: `https://vimeo.com/search?q=${q}` },
  ];
}

// Links de pesquisa para bancos de imagens externos.
function imageBankLinks(name) {
  const q = enc(name);
  const s = slug(name);
  return [
    { group: 'Licença livre', name: 'Wikimedia Commons', note: 'Imagens com licença livre (CC / domínio público)', url: `https://commons.wikimedia.org/w/index.php?search=${q}&title=Special:MediaSearch&type=image` },
    { group: 'Licença livre', name: 'Flickr (Creative Commons)', note: 'Só fotos com licença Creative Commons', url: `https://www.flickr.com/search/?text=${q}&license=2%2C3%2C4%2C5%2C6%2C9` },
    { group: 'Licença livre', name: 'Unsplash', note: 'Fotos gratuitas de alta resolução', url: `https://unsplash.com/s/photos/${s}` },
    { group: 'Licença livre', name: 'Pexels', note: 'Fotos e vídeos gratuitos', url: `https://www.pexels.com/search/${q}/` },
    { group: 'Licença livre', name: 'Pixabay', note: 'Imagens gratuitas', url: `https://pixabay.com/images/search/${q}/` },
    { group: 'Agências e stock', name: 'Getty Images', note: 'Fotografia editorial de jogos e jogadores', url: `https://www.gettyimages.com/search/2/image?phrase=${q}` },
    { group: 'Agências e stock', name: 'Shutterstock', note: 'Editorial e stock', url: `https://www.shutterstock.com/search?searchterm=${q}` },
    { group: 'Agências e stock', name: 'Adobe Stock', note: 'Stock e editorial', url: `https://stock.adobe.com/search?k=${q}` },
    { group: 'Agências e stock', name: 'Alamy', note: 'Arquivo editorial e histórico', url: `https://www.alamy.com/search.html?qt=${q}` },
    { group: 'Agências e stock', name: 'IMAGO', note: 'Agência especializada em desporto', url: `https://www.imago-images.com/search?querystring=${q}` },
    { group: 'Motores de busca', name: 'Google Imagens', note: 'Pesquisa geral', url: `https://www.google.com/search?tbm=isch&q=${q}` },
    { group: 'Motores de busca', name: 'Google Imagens (Creative Commons)', note: 'Filtro de licenças Creative Commons', url: `https://www.google.com/search?tbm=isch&tbs=sur:cl&q=${q}` },
    { group: 'Motores de busca', name: 'Bing Imagens', note: 'Pesquisa geral', url: `https://www.bing.com/images/search?q=${q}` },
    { group: 'Logótipos', name: 'Wikipedia (escudo oficial)', note: 'Página do clube com o escudo atual', url: `https://en.wikipedia.org/w/index.php?search=${enc(name + ' football club')}` },
    { group: 'Logótipos', name: 'Seeklogo', note: 'Escudos em vetor (SVG/EPS)', url: `https://seeklogo.com/search?q=${q}` },
  ];
}

// Junta tudo o que a página mostra para um clube: por id do TheSportsDB ou por nome livre.
async function getClub({ id, q = '' } = {}) {
  q = String(q).trim().slice(0, 80);
  let team = null;
  let groups = [];
  if (id) {
    if (!/^\d+$/.test(String(id))) throw new Error('Identificador de clube inválido.');
    const found = await lookupTeam(id);
    if (!found) throw new Error('Clube não encontrado.');
    team = found.summary;
    groups = await teamImages(found.raw);
  } else if (q.length < 2) {
    throw new Error('Escreve pelo menos 2 letras do nome do clube.');
  }
  const name = team ? team.alternate.split(',')[0].trim() || team.name : q;
  const searchName = team ? team.name : q;
  const failed = [];
  const tryBoth = async (fn) => {
    const first = await fn(name);
    return first.length || name === searchName ? first : fn(searchName);
  };
  const [commons, cVideos, matches] = await Promise.all([
    tryBoth(commonsImages).catch(() => { failed.push('imagens'); return []; }),
    // Clube com nome de cidade (Liverpool, Porto…): só vídeos que falam de futebol.
    commonsVideos(searchName, { strict: Boolean(team && team.location && team.location.toLowerCase().includes(searchName.toLowerCase())) }).catch(() => { failed.push('vídeos'); return []; }),
    team ? recentMatches(team.id).catch(() => []) : Promise.resolve([]),
  ]);
  const commonsError = failed.length
    ? `O Wikimedia Commons não devolveu ${failed.join(' nem ')} agora. Tenta de novo daqui a pouco ou usa os links do Commons abaixo.`
    : null;
  if (commons.length) groups.push({ key: 'commons', title: 'Wikimedia Commons (licença livre)', source: 'Wikimedia Commons', items: commons });
  const videoGroups = [];
  if (matches.length) videoGroups.push({ key: 'jogos', title: 'Resumos dos últimos jogos', source: 'TheSportsDB + YouTube', items: matches });
  if (cVideos.length) videoGroups.push({ key: 'commons-video', title: 'Vídeos com licença livre', source: 'Wikimedia Commons', items: cVideos });
  return {
    team, query: searchName, groups, commonsError, banks: imageBankLinks(searchName),
    videoGroups, videoBanks: videoBankLinks(searchName, team && team.youtube),
  };
}

const api = { searchTeams, lookupTeam, teamImages, commonsImages, commonsVideos, recentMatches, imageBankLinks, videoBankLinks, getClub, slug };
if (IS_NODE) module.exports = api;
else window.ClubSources = api;
})();
