/** Public Lennar page data. No private API, credentials, guessed lots or geocoding. */
export function pageState(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Lennar page has no public page data');
  const state = JSON.parse(match[1])?.props?.pageProps?.initialApolloState;
  if (!state?.ROOT_QUERY) throw new Error('Lennar page data schema changed');
  return state;
}
const absolute = path => path ? new URL(path, 'https://www.lennar.com').href : undefined;
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
const dollars = n => n ? '$' + n.toLocaleString('en-US') : 'Ask for price';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function coordinate(row) {
  const lat = row?.latitude, lng = row?.longitude;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 24 && lat <= 32 && lng >= -88 && lng <= -79
    ? {lat, lng, locationSource: 'lennar-public'} : {};
}
export function communityUrls(state, market) {
  const urlMarket = {tampa: "tampa-manatee", jacksonville: "jacksonville-st-augustine"}[market] || market;
  return [...new Set(Object.entries(state)
    .filter(([key, row]) => /^(MpcType|CommunityType):/.test(key) && row.url && row.status === 'ACTIVE')
    .map(([, row]) => absolute(row.url))
    .filter(url => new URL(url).pathname.startsWith(`/new-homes/florida/${urlMarket}/`)))];
}
export function communitiesFromPage(state, sourceUrl, market, checkedAt) {
  const resolve = value => value?.__ref ? state[value.__ref] : value;
  const records = Object.entries(state).filter(([key]) => key.startsWith('CommunityType:')).map(([, row]) => row);
  const result = [];
  for (const community of records) {
    if (community.status !== 'ACTIVE' || !community.url || !community.address) continue;
    const city = resolve(community.city)?.name;
    if (!city || community.stateCode !== 'FL') continue;
    const mpc = resolve(community.mpc);
    const name = mpc?.name && mpc.name !== community.name ? `${mpc.name} — ${community.name}` : community.name;
    const cUrl = absolute(community.url);
    const plans = (community.plans || []).map(resolve).filter(p => p?.url && p?.name);
    const lots = new Map(), models = [];
    for (const plan of plans) {
      const elevations = plan.elevationImages || plan['elevationImages({"first":1})'] || [];
      const modelPhoto = plan.heroImage?.url || elevations[0]?.image?.url;
      const floorplans = (plan.floorplans || []).map(p => p.default?.image?.url).filter(Boolean);
      const modelPhotos = [...new Set([modelPhoto, ...floorplans].filter(Boolean))];
      models.push({slug: slug(plan.name), name: plan.name, photo: modelPhoto, photos: modelPhotos,
        startingLabel: dollars(positive(plan.startingPrice)), beds: positive(plan.beds),
        baths: String((plan.baths || 0) + (plan.halfBaths || 0) / 2), sqft: String(plan.sqft || ''), sourceUrl: absolute(plan.url)});
      for (const ref of plan.homesites || []) {
        const home = resolve(ref);
        if (!home?.url || !home.address || !['MOVE_IN_READY','UNDER_CONSTRUCTION'].includes(home.status) || home.soldDate) continue;
        const price = positive(home.price);
        const photo = home.elevationImage?.image?.url || modelPhoto;
        lots.set(home.lotid || home.url, {
          lot: String(home.number || home.lotid), address: `${home.address}, ${city}, FL ${community.zipCode || ''}`.trim(),
          plan: plan.name, price, priceLabel: dollars(price), beds: positive(home.beds),
          baths: String((home.baths || 0) + (home.halfBaths || 0) / 2), sqft: String(home.sqft || ''),
          status: home.status === 'MOVE_IN_READY' ? 'ready' : 'building',
          stage: home.status === 'MOVE_IN_READY' ? 'Move-in ready' : 'Under construction',
          photo, photos: [...new Set([photo, ...floorplans].filter(Boolean))], galleryKind: 'model',
          sourceUrl: absolute(home.url), checkedAt, ...coordinate(home),
        });
      }
    }
    const rows = [...lots.values()], prices = rows.map(h=>h.price).filter(Boolean);
    result.push({slug: 'lennar-' + new URL(cUrl).pathname.split('/').slice(3).join('-'), name,
      builder: 'lennar', source: 'lennar-public', sourceUrl: cUrl, checkedAt, market,
      address: `${community.address}, ${city}, FL ${community.zipCode || ''}`.trim(), ...coordinate(community),
      availableCount: rows.length, lowestPrice: prices.length ? Math.min(...prices) : null,
      highestPrice: prices.length ? Math.max(...prices) : null, beds: [...new Set(rows.map(h=>h.beds).filter(Boolean))].sort((a,b)=>a-b),
      lots: rows, models,
    });
  }
  const emptyMasterplan = Object.entries(state).some(([key, row]) => key.startsWith('MpcType:') && absolute(row.url) === sourceUrl && Array.isArray(row.communities) && row.communities.length === 0);
  if (!result.length && !emptyMasterplan) throw new Error(`No active communities parsed from ${sourceUrl}`);
  return result;
}
