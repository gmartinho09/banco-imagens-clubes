// Teste rápido contra as APIs reais: node test.js
const { searchTeams, lookupTeam, teamImages, imageBankLinks } = require('./sources');
(async () => {
  const teams = await searchTeams('Benfica');
  console.assert(teams.length > 0, 'pesquisa sem resultados');
  const t = await lookupTeam(teams[0].id);
  const groups = await teamImages(t.raw);
  console.assert(groups.some((g) => g.key === 'identidade'), 'sem escudo');
  console.assert(imageBankLinks('Benfica').length >= 10, 'poucos bancos');
  console.log('OK:', t.summary.name, groups.map((g) => `${g.title} (${g.items.length})`).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
