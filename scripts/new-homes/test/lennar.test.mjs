import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageState, communityUrls, communitiesFromPage} from '../lennar-public.mjs';
const fixture = () => ({ROOT_QUERY:{},
 'CityType:c':{name:'Haines City'},
 'CommunityType:c':{id:'c',name:'Majors Collection',status:'ACTIVE',address:'2506 Aveeno Way',zipCode:'33844',stateCode:'FL',city:{__ref:'CityType:c'},url:'/new-homes/florida/orlando/haines-city/scenic-terrace/majors-collection',latitude:28.06593,longitude:-81.621917,plans:[{__ref:'PlanType:p'}]},
 'PlanType:p':{name:'Gehrig',url:'/new-homes/florida/orlando/haines-city/scenic-terrace/majors-collection/gehrig',beds:4,baths:2,sqft:1733,homesites:[{__ref:'HomesiteType:h'}]},
 'HomesiteType:h':{number:'0903',lotid:'26391720903',address:'2122 Parsley Drive',status:'MOVE_IN_READY',price:271490,beds:4,baths:2,sqft:1733,latitude:28.066408,longitude:-81.621704,url:'/new-homes/florida/orlando/haines-city/scenic-terrace/majors-collection/gehrig/26391720903'}
});
const parse = state => communitiesFromPage(state,'https://www.lennar.com/new-homes/florida/orlando/haines-city/scenic-terrace','orlando','2026-10-26T00:00:00Z');
test('preserves builder identity, full dollars, exact address and official home coordinates',()=>{
 const [c]=parse(fixture()); assert.equal(c.builder,'lennar');assert.match(c.slug,/^lennar-/);assert.equal(c.lots[0].price,271490);assert.equal(c.lots[0].lat,28.066408);assert.notEqual(c.lots[0].lat,c.lat);assert.equal(c.lots[0].address,'2122 Parsley Drive, Haines City, FL 33844');
});
test('does not turn sold or coming-soon homes into available inventory',()=>{
 for(const status of ['SOLD','COMING_SOON']){const s=fixture();s['HomesiteType:h'].status=status;assert.equal(parse(s)[0].lots.length,0);}
 const s=fixture();s['HomesiteType:h'].soldDate='2026-10-25';assert.equal(parse(s)[0].lots.length,0);
});
test('missing or invalid home location never becomes a community pin',()=>{
 const s=fixture();s['HomesiteType:h'].latitude=0;const c=parse(s)[0];assert.equal(c.lots[0].lat,undefined);assert.ok(c.lat);
});
test('schema failures throw rather than erase inventory',()=>{
 assert.throws(()=>pageState('<html>Access denied</html>'));assert.throws(()=>parse({ROOT_QUERY:{}}));
});
test('recognizes canonical market slugs and excludes upcoming communities',()=>{
 const s={'MpcType:x':{status:'ACTIVE',url:'/new-homes/florida/tampa-manatee/land-o-lakes/angeline'},'MpcType:y':{status:'COMING_SOON',url:'/new-homes/florida/tampa-manatee/land-o-lakes/other'}};
 assert.equal(communityUrls(s,'tampa').length,1);
});
test('live snapshot integrity: unique homes, real coordinates and correct builders',async()=>{
 const inventory=JSON.parse(await readFile('map-inventory.json','utf8'));
 const lennar=JSON.parse(await readFile('lennar.json','utf8'));
 assert.ok(Object.values(lennar.sourceRuns).every(m=>m.status==='ok'));
 const urls=new Set();
 for(const c of lennar.communities){assert.match(c.slug,/^lennar-/);assert.ok(c.lat>24&&c.lat<32);for(const h of c.lots){assert.ok(!urls.has(h.sourceUrl));urls.add(h.sourceUrl);assert.ok(h.price===null||h.price>10000);assert.match(h.sourceUrl,/^https:\/\/www\.lennar\.com\//);assert.ok(h.checkedAt);}}
 assert.equal(inventory.communities.filter(c=>c.builder==='lennar').length,lennar.communities.length);
 assert.ok(inventory.communities.some(c=>c.builder==='drhorton'));
});
