// Fontes de dados e geração de links para bancos de imagens.
const SPORTSDB_KEY = process.env.THESPORTSDB_KEY || '123'; // chave gratuita pública
const SPORTSDB = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const UA = 'BancoImagensClubes/1.0 (projeto educativo; Node.js)';

const cache = new Map();
const TTL = 1000 * 60 * 30;

async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
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

module.exports = { searchTeams, lookupTeam, teamImages, commonsImages, imageBankLinks, slug };
