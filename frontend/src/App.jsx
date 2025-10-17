import { useEffect, useMemo, useState } from "react";
import { cfg } from "./lib/config";

async function fetchJson(url) {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function TokenCard({ tokenId }) {
  const url = `${cfg.metadataBase}/${tokenId}.json`;
  const scan = `${cfg.polygonscanBase}/token/${cfg.contract}?a=${tokenId}`;
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    setMeta(null); setErr("");
    fetchJson(url).then(j => { if(on) setMeta(j); }).catch(e => { if(on) setErr(e.message || String(e)); });
    return () => { on = false; };
  }, [url]);

  return (
    <div style={{border:"1px solid #2a2a2a", borderRadius:16, padding:16, background:"#111", color:"#eee"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{fontWeight:700, fontSize:18}}>{meta?.name || `BlockReceipt #${tokenId}`}</div>
        <a href={scan} target="_blank" rel="noreferrer" style={{color:"#00C2FF", textDecoration:"none", fontSize:14}}>
          View on Polygonscan
        </a>
      </div>

      <div style={{color:"#aaa", marginTop:4}}>{meta?.description || "Receipt NFT"}</div>

      {meta?.image && (
        <div style={{marginTop:12}}>
          <img src={meta.image} alt="" style={{maxWidth:"100%", borderRadius:12, border:"1px solid #222"}} />
        </div>
      )}

      {Array.isArray(meta?.attributes) && meta.attributes.length > 0 && (
        <div style={{display:"flex", flexWrap:"wrap", gap:8, marginTop:12}}>
          {meta.attributes.slice(0,6).map((a, i) => (
            <span key={i} style={{background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:999, padding:"6px 10px", color:"#7fffd4", fontSize:12}}>
              {a.trait_type}: {String(a.value)}
            </span>
          ))}
        </div>
      )}

      {err && <div style={{color:"#ff6b6b", marginTop:12}}>Error loading metadata: {err}</div>}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState(cfg.exampleTokens[0] || "");
  const ids = useMemo(() => cfg.exampleTokens, []);

  return (
    <div style={{minHeight:"100vh", background:"#0b0b0e", color:"#eee", fontFamily:"Inter, system-ui, sans-serif"}}>
      <div style={{maxWidth:860, margin:"0 auto", padding:"24px 16px"}}>
        <h1 style={{fontSize:28, margin:"8px 0"}}>{cfg.appName}</h1>
        <div style={{color:"#9aa0a6", marginBottom:16}}>
          {cfg.chainName} • Contract {cfg.contract.slice(0,6)}…{cfg.contract.slice(-4)}
        </div>

        <div style={{display:"flex", gap:8, marginBottom:16}}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            placeholder="Enter tokenId e.g. 10108"
            style={{flex:1, padding:"10px 12px", borderRadius:10, border:"1px solid #2a2a2a", background:"#121218", color:"#eee"}}
          />
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr", gap:16}}>
          {input && /^\d+$/.test(input) && <TokenCard tokenId={input} />}
          {ids.filter(id => String(id)!==String(input)).map(id => <TokenCard key={id} tokenId={id} />)}
        </div>
      </div>
    </div>
  );
}
