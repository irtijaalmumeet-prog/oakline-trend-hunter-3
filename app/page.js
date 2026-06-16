'use client';
import { useEffect, useState } from 'react';

const COUNTRIES = [['US','United States'],['GB','United Kingdom'],['AE','UAE'],['AU','Australia'],['CA','Canada'],['DE','Germany'],['FR','France'],['SA','Saudi Arabia'],['NL','Netherlands'],['IN','India']];

function token(){ if(typeof window==='undefined')return null; return localStorage.getItem('olth'); }
function setTok(t){ if(t) localStorage.setItem('olth',t); else localStorage.removeItem('olth'); }
function deviceId(){
  if(typeof window==='undefined')return '';
  let d=localStorage.getItem('oth_did');
  if(!d){ d=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2)); localStorage.setItem('oth_did',d); }
  return d;
}
function deviceLabel(){ if(typeof navigator==='undefined')return 'Unknown device'; return (navigator.userAgent||'Unknown').slice(0,180); }
async function api(path,{method='GET',body}={}) {
  const res=await fetch(path,{method,headers:{'Content-Type':'application/json','x-device-id':deviceId(),...(token()?{Authorization:'Bearer '+token()}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.message||data.error||('Error '+res.status)); return data;
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
    try{const{token:t,user}=await api('/api/login',{method:'POST',body:{email,password,deviceId:deviceId(),deviceLabel:deviceLabel()}});setTok(t);onLogin(user);}
    catch(e){setErr(e.message);}finally{setBusy(false);}}
  return(<main className="wrap"><Brand/><section className="card" style={{maxWidth:420}}>
    <h2>Sign in</h2><p className="hint">Owner and client access.</p>
    <form onSubmit={submit}><div style={{display:'grid',gap:10}}>
      <input type="text" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input type="text" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{WebkitTextSecurity:'disc'}}/>
      {err&&<div style={{color:'#e88',fontSize:13,lineHeight:1.4}}>{err}</div>}
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
        {user.role==='owner'&&<button className="btn ghost" onClick={()=>setTab(tab==='admin'?'hunt':'admin')}>{tab==='admin'?'Hunt':'Manage access'}</button>}
        <button className="btn ghost" onClick={onLogout}>Sign out</button>
      </div>
    </div>
    {tab==='admin'&&user.role==='owner'?<Admin/>:<Hunt/>}
  </main>);
}

function Admin(){
  const[clients,setClients]=useState([]);const[email,setEmail]=useState('');const[days,setDays]=useState('');const[created,setCreated]=useState(null);const[err,setErr]=useState(null);
  async function refresh(){try{setClients((await api('/api/clients')).clients);}catch(e){setErr(e.message);}}
  useEffect(()=>{refresh();},[]);
  async function add(e){e.preventDefault();setErr(null);setCreated(null);try{setCreated(await api('/api/clients',{method:'POST',body:{email,accessDays:days?Number(days):0}}));setEmail('');setDays('');refresh();}catch(e){setErr(e.message);}}
  async function remove(em){if(!confirm('Remove '+em+'? Their devices are removed too.'))return;await api('/api/clients?email='+encodeURIComponent(em),{method:'DELETE'});refresh();}
  async function setPw(em){const pw=prompt('New password for '+em+':');if(!pw)return;try{await api('/api/clients',{method:'PUT',body:{email:em,password:pw}});alert('Password updated. Share it with '+em+'.');}catch(e){alert(e.message);}}
  async function setDaysFor(em){const d=prompt('How many days from now can '+em+' use the tool?\n(Enter a number, or 0 for unlimited)');if(d===null)return;try{await api('/api/clients',{method:'PUT',body:{email:em,accessDays:Number(d)||0}});refresh();}catch(e){alert(e.message);}}
  function expiryLabel(c){ if(!c.expiresAt) return <span className="hint">No limit</span>; const exp=new Date(c.expiresAt); const left=Math.ceil((c.expiresAt-Date.now())/86400000); return left>0?<span style={{color:'#e8c96b'}}>{exp.toLocaleDateString()} ({left}d left)</span>:<span style={{color:'#e88'}}>Expired</span>; }
  return(<>
  <section className="card"><h2>Client access control</h2>
    <p className="hint">Add a client by email. Optionally set how many days they can use the tool (blank = unlimited).</p>
    <form onSubmit={add} className="row"><input type="text" placeholder="client@email.com" value={email} onChange={e=>setEmail(e.target.value)}/><input type="text" placeholder="days (optional)" value={days} onChange={e=>setDays(e.target.value.replace(/[^0-9]/g,''))} style={{maxWidth:140,minWidth:120}}/><button className="btn">Add client</button></form>
    {err&&<p style={{color:'#e88'}}>{err}</p>}
    {created&&<p style={{fontSize:13}}>Created <b>{created.email}</b> — temp password: <code className="tag">{created.tempPassword}</code></p>}
    <table style={{marginTop:14}}><thead><tr><th>Client</th><th>Access</th><th>Added</th><th>Actions</th></tr></thead><tbody>
      {clients.map(c=>(<tr key={c.email}><td>{c.email}</td><td>{expiryLabel(c)}</td><td className="hint">{c.createdAt?new Date(c.createdAt).toLocaleDateString():''}</td><td className="row" style={{gap:6}}>
        <button className="btn ghost sm" onClick={()=>setPw(c.email)}>Set password</button>
        <button className="btn ghost sm" onClick={()=>setDaysFor(c.email)}>Set days</button>
        <button className="btn ghost sm" onClick={()=>remove(c.email)}>Remove</button>
      </td></tr>))}
      {clients.length===0&&<tr><td colSpan={4} className="hint">No clients yet.</td></tr>}
    </tbody></table>
  </section>
  <Devices/>
  </>);
}

function Devices(){
  const[devices,setDevices]=useState([]);const[err,setErr]=useState(null);const[busy,setBusy]=useState('');
  async function refresh(){try{setDevices((await api('/api/devices')).devices);}catch(e){setErr(e.message);}}
  useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t);},[]);
  async function act(email,id,action){setBusy(id+action);try{await api('/api/devices',{method:'POST',body:{email,deviceId:id,action}});await refresh();}catch(e){setErr(e.message);}finally{setBusy('');}}
  async function del(email,id){if(!confirm('Forget this device? It will need approval again next time.'))return;setBusy(id+'del');try{await api('/api/devices?email='+encodeURIComponent(email)+'&deviceId='+encodeURIComponent(id),{method:'DELETE'});await refresh();}catch(e){setErr(e.message);}finally{setBusy('');}}
  const order={pending:0,approved:1,blocked:2};
  const sorted=[...devices].sort((a,b)=>(order[a.status]??9)-(order[b.status]??9));
  const pending=devices.filter(d=>d.status==='pending').length;
  const color=(s)=>({pending:'#d8c45a',approved:'#5ac46a',blocked:'#e88'}[s]||'#999');
  return(<section className="card"><h2>Device approvals {pending>0&&<span className="tag" style={{background:'#2c7a3f',color:'#fff'}}>{pending} waiting</span>}</h2>
    <p className="hint">Clients can only sign in from devices you approve. New devices appear here as “pending”. Block to kick a device out immediately.</p>
    {err&&<p style={{color:'#e88'}}>{err}</p>}
    <table style={{marginTop:14}}><thead><tr><th>Client</th><th>Device</th><th>Status</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>
      {sorted.map(d=>(<tr key={d.email+d.deviceId}>
        <td>{d.email}</td>
        <td className="hint" title={d.label}>{shortDevice(d.label)}</td>
        <td><span style={{color:color(d.status),fontWeight:600,textTransform:'capitalize'}}>{d.status}</span></td>
        <td className="hint">{d.lastSeen?new Date(d.lastSeen).toLocaleString():'—'}</td>
        <td className="row" style={{gap:6}}>
          {d.status!=='approved'&&<button className="btn sm" disabled={busy===d.deviceId+'approve'} onClick={()=>act(d.email,d.deviceId,'approve')}>Approve</button>}
          {d.status!=='blocked'&&<button className="btn ghost sm" disabled={busy===d.deviceId+'block'} onClick={()=>act(d.email,d.deviceId,'block')}>Block</button>}
          <button className="btn ghost sm" disabled={busy===d.deviceId+'del'} onClick={()=>del(d.email,d.deviceId)}>Forget</button>
        </td>
      </tr>))}
      {devices.length===0&&<tr><td colSpan={5} className="hint">No devices yet. They appear when a client first tries to sign in.</td></tr>}
    </tbody></table>
  </section>);
}
function shortDevice(ua){ if(!ua)return 'Unknown device';
  const os=/Windows/.test(ua)?'Windows':/iPhone|iPad/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Mac/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'Device';
  const br=/Edg/.test(ua)?'Edge':/Chrome/.test(ua)?'Chrome':/Firefox/.test(ua)?'Firefox':/Safari/.test(ua)?'Safari':'Browser';
  return br+' on '+os; }

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
