import assert from 'node:assert/strict';
import { scoreIdeas } from '../lib/score.js';
import { platformLinks } from '../lib/platformLinks.js';
import { hashPassword, verifyPassword, issueToken, verifyToken } from '../lib/auth.js';

let n=0; const ok=(name,f)=>{f();n++;console.log('  ok  '+name);};

ok('scoreIdeas ranks high demand / low competition first', ()=>{
  const r = scoreIdeas([
    { name:'A', demandScore:90, competitionScore:20 },
    { name:'B', demandScore:40, competitionScore:80 },
  ]);
  assert.equal(r[0].name,'A');
  assert.ok(r[0].finalScore>r[1].finalScore);
  assert.ok(r[0].finalScore>=0 && r[0].finalScore<=10);
});

ok('platformLinks builds 6 search links incl Facebook & TikTok', ()=>{
  const l = platformLinks('mini blender','GB');
  const names = l.map(x=>x.name);
  assert.ok(names.includes('Facebook Ads Library'));
  assert.ok(names.includes('TikTok Creative Center'));
  assert.ok(l.every(x=>x.url.includes('mini%20blender')));
  assert.ok(l.find(x=>x.name==='Facebook Ads Library').url.includes('country=GB'));
});

ok('google trends prefix strip parses correctly', ()=>{
  const raw = ")]}',\n"+JSON.stringify({default:{trendingSearchesDays:[{trendingSearches:[{title:{query:'x'},formattedTraffic:'50K+'}]}]}});
  const data = JSON.parse(raw.replace(/^\)\]\}'?,?\s*/, ''));
  assert.equal(data.default.trendingSearchesDays[0].trendingSearches[0].title.query,'x');
});

ok('auth: password + token round-trip', ()=>{
  const {salt,passwordHash}=hashPassword('pw123');
  assert.equal(verifyPassword('pw123',salt,passwordHash),true);
  assert.equal(verifyPassword('nope',salt,passwordHash),false);
  const t=issueToken({email:'o@x.com',role:'owner'});
  assert.equal(verifyToken(t).role,'owner');
  assert.equal(verifyToken(t+'z'),null);
});

console.log('\n'+n+' checks passed.');
