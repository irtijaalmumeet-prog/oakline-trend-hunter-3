'use client';
import { useEffect, useRef, useState } from 'react';

const COUNTRIES = [['US','United States'],['GB','United Kingdom'],['AE','UAE'],['AU','Australia'],['CA','Canada'],['DE','Germany'],['FR','France'],['SA','Saudi Arabia'],['NL','Netherlands'],['IN','India']];

function token(){ if(typeof window==='undefined')return null; return localStorage.getItem('olth'); }
function setTok(t){ if(t) localStorage.setItem('olth',t); else localStorage.removeItem('olth'); }
async function api(path,{method='GET',body}={}) {
  const res=await fetch(path,{method,headers:{'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||('Error '+res.status)); return data;
}

export default function Home(){
  const [user,setUser]=useState(null); const [booting,setBooting]=useState(true);
  useEffect(()=>{(async()=>{try{if(token())setUser(await api('/api/me'));}catch{setTok(null);}setBooting(false);})();},[]);
  if(booting) return <main className="wrap"><Brand/></main>;
  if(!user) return <Login onLogin={setUser}/>;
  return <Dashboard user={user} onLogout={()=>{setTok(null);setUser(null);}}/>;
}

function Brand(){return(<header className="brandbar"><div className="logo">OL</div><div><h1>Oakline Trend Hunter</h1><p>Live trend &amp; product research</p></div></header>);}

function Login({onLogin}){
  const [email,setEmail]=useState('');const[password,setPassword]=useState('');const[err,setErr]=useState(null);const[busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();setErr(null);setBusy(true);
    try{const{token:t,user}=await api('/api/login',{method:'POST',body:{email,password}});setTok(t);onLogin(user);}
    catch(e){setErr(e.message);}finally{setBusy(false);}}
  return(<main className="wrap"><Brand/><section className="card" style={{maxWidth:420}}>
    <h2>Sign in</h2><p className="hint">Owner and client access.</p>
    <form onSubmit={submit}><div style={{display:'grid',gap:10}}>
      <input type="text" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input type="text" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{WebkitTextSecurity:'disc'}}/>
      {err&&<div style={{color:'#e88',fontSize:13}}>{err}</div>}
      <button className="btn" disabled={busy||!email||!password}>{busy?'Signing in…':'Sign in'}</button>
    </div></form></section></main>);
}

function Dashboard({user,onLogout}){
  const [tab,setTab]=useState('hunt');
  return(<main className="wrap">
    <div className="row" style={{justifyContent:'space-between',alignItems:'flex-start'}}>
      <Brand/>
      <div className="row" style={{fontSize:13}}>
        <span className="hint">{user.email} · {user.role}</span>
        {user.role==='owner'&&<button className="btn ghost" onClick={()=>setTab(tab==='admin'?'hunt':'admin')}>{tab==='admin'?'Hunt':'Manage clients'}</button>}
        <button className="btn ghost" onClick={onLogout}>Sign out</button>
      </div>
    </div>
    {tab==='admin'&&user.role==='owner'?<Admin/>:<Hunt/>}
  </main>);
}

function Admin(){
  const[clients,setClients]=useState([]);const[email,setEmail]=useState('');const[created,setCreated]=useState(null);const[err,setErr]=useState(null);
  async function refresh(){try{setClients((await api('/api/clients')).clients);}catch(e){setErr(e.message);}}
  useEffect(()=>{refresh();},[]);
  async function add(e){e.preventDefault();setErr(null);setCreated(null);try{setCreated(await api('/api/clients',{method:'POST',body:{email}}));setEmail('');refresh();}catch(e){setErr(e.message);}}
  async function remove(em){await api('/api/clients/'+encodeURIComponent(em),{method:'DELETE'});refresh();}
  return(<section className="card"><h2>Client access control</h2>
    <p className="hint">Add a client by email and share the temporary password.</p>
    <form onSubmit={add} className="row"><input type="text" placeholder="client@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="btn">Add client</button></form>
    {err&&<p style={{color:'#e88'}}>{err}</p>}
    {created&&<p style={{fontSize:13}}>Created <b>{created.email}</b> — temp password: <code className="tag">{created.tempPassword}</code></p>}
    <table style={{marginTop:14}}><thead><tr><th>Client</th><th>Added</th><th></th></tr></thead><tbody>
      {clients.map(c=>(<tr key={c.email}><td>{c.email}</td><td className="hint">{new Date(c.createdAt).toLocaleDateString()}</td><td><button className="btn ghost sm" onClick={()=>remove(c.email)}>Remove</button></td></tr>))}
      {clients.length===0&&<tr><td colSpan={3} className="hint">No clients yet.</td></tr>}
    </tbody></table></section>);
}

function Hunt(){
  const[country,setCountry]=useState('US');const[niche,setNiche]=useState('');const[ai,setAi]=useState(false);
  const[busy,setBusy]=useState(false);const[err,setErr]=useState(null);const[data,setData]=useState(null);
  async function run(){setErr(null);setBusy(true);setData(null);
    try{setData(await api('/api/hunt',{method:'POST',body:{country,niche,letAiDecide:ai}}));}
    catch(e){setErr(e.message);}finally{setBusy(false);}}
  const can=country&&(ai||niche.trim());
  return(<>
    <section className="card"><h2>Step 1 — Country</h2><div className="chips">
      {COUNTRIES.map(([c,l])=>(<button key={c} className={'chip'+(country===c?' on':'')} onClick={()=>setCountry(c)}>{l}</button>))}
    </div></section>
    <section className="card"><h2>Step 2 — Niche</h2><p className="hint">Type a niche, or let AI pick a trending one.</p>
      <div className="row">
        <input type="text" placeholder="e.g. home gadgets, pet accessories" value={niche} disabled={ai} onChange={e=>setNiche(e.target.value)}/>
        <label className="toggle"><input type="checkbox" checked={ai} onChange={e=>setAi(e.target.checked)}/> Let AI decide</label>
      </div>
    </section>
    {err&&<section className="card" style={{borderColor:'#a33'}}>{err}</section>}
    <button className="btn" disabled={!can||busy} onClick={run}>{busy?<><span className="spinner"/> Hunting… (10–20s)</>:'Start hunting'}</button>
    {data&&<Results data={data}/>}
  </>);
}

function Results({data}){
  const sCls=(s)=>s>=7.5?'s-hi':s>=6?'s-mid':'s-lo';
  return(<div style={{marginTop:18}}>
    <section className="card"><h2>Results — {data.niche} · {data.country}</h2>
      <p className="hint">Live Google Trends + AI product ideas. Trend data is real and updates over time.</p>
      {data.warnings?.length>0&&<p className="hint" style={{color:'#d8c45a'}}>Note: {data.warnings.join(' | ')}</p>}
    </section>

    <div className="grid2">
      <section className="card"><h2>🔥 Trending now in {data.country}</h2><p className="hint">Live from Google Trends</p>
        <div>{(data.trending||[]).map((t,i)=>(<span className="pill" key={i}>{t.query}{t.traffic?` · ${t.traffic}`:''}</span>))}
        {(!data.trending||data.trending.length===0)&&<span className="hint">No live data returned.</span>}</div>
      </section>
      <section className="card"><h2>📈 Rising for “{data.niche}”</h2><p className="hint">Fast-growing related searches</p>
        <div>{(data.risingQueries||[]).map((t,i)=>(<span className="pill" key={i}>{t.query}{t.value?` · +${t.value}`:''}</span>))}
        {(!data.risingQueries||data.risingQueries.length===0)&&<span className="hint">No rising queries returned.</span>}</div>
      </section>
    </div>

    <section className="card"><h2>🛍️ Product ideas ({data.products?.length||0})</h2>
      <p className="hint">AI-generated from the niche + live trends. Click a platform to research it in your browser.</p>
      <table><thead><tr><th>Product</th><th>Why now</th><th>Demand</th><th>Comp.</th><th>Score</th><th>Research on</th></tr></thead><tbody>
        {(data.products||[]).map((p,i)=>(<tr key={i}>
          <td><b>{p.name}</b><div className="hint">{p.audience}</div></td>
          <td className="hint">{p.whyNow}</td>
          <td>{p.demandScore}</td><td>{p.competitionScore}</td>
          <td className={'score '+sCls(p.finalScore)}>{p.finalScore}</td>
          <td>{(p.links||[]).map((l)=>(<a className="tag" key={l.name} href={l.url} target="_blank" rel="noreferrer" title={l.note}>{l.name} ↗</a>))}</td>
        </tr>))}
        {(!data.products||data.products.length===0)&&<tr><td colSpan={6} className="hint">No product ideas generated.</td></tr>}
      </tbody></table>
    </section>
  </div>);
}
