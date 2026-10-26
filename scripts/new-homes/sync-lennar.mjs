#!/usr/bin/env node
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile, writeFile, rename} from 'node:fs/promises';
import {pageState, communityUrls, communitiesFromPage} from './lennar-public.mjs';
const exec = promisify(execFile);
const markets = ['orlando', 'tampa', 'ocala', 'jacksonville'];
const output = 'lennar.json';
let previous;
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { previous = {communities: []}; }
async function fetchPage(url) {
  const {stdout} = await exec('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time','40','--retry','2',url], {maxBuffer: 16*1024*1024});
  return pageState(stdout);
}
const communities = [], sourceRuns = {}, checkedAt = new Date().toISOString();
let failed = false;
for (const market of markets) {
  try {
    const state = await fetchPage(`https://www.lennar.com/new-homes/florida/${market}`);
    const urls = communityUrls(state, market);
    if (!urls.length) throw new Error('No active community URLs');
    const rows = new Map();
    // Small bounded batches; no private search endpoints or request flood.
    for (let i=0; i<urls.length; i+=3) {
      const pages = await Promise.all(urls.slice(i,i+3).map(async url => communitiesFromPage(await fetchPage(url),url,market,checkedAt)));
      for (const page of pages) for (const row of page) rows.set(row.slug,row);
    }
    const fresh = [...rows.values()];
    if (!fresh.some(c=>c.lots.length)) throw new Error('Zero available homes; retain previous market');
    communities.push(...fresh);
    sourceRuns[market] = {checkedAt, status:'ok', pages:urls.length, communities:fresh.length, homes:fresh.reduce((s,c)=>s+c.lots.length,0)};
    console.log(market, sourceRuns[market]);
  } catch (error) {
    failed = true;
    const retained = previous.communities.filter(c=>c.market === market);
    communities.push(...retained);
    sourceRuns[market] = {checkedAt, status:'failed-retained', error:String(error.message), retainedCommunities:retained.length};
    console.error(market, sourceRuns[market]);
  }
}
if (!communities.length) throw new Error('No Lennar inventory available; file untouched');
const data = {updatedAt: checkedAt, source:'lennar-public', builder:'lennar', sourceRuns, communities};
await writeFile(output+'.tmp',JSON.stringify(data,null,2)+'\n');
await rename(output+'.tmp',output);
if (failed) process.exitCode = 1;
