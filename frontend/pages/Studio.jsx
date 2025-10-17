import React from "react";
import { Avatar } from "../components/Avatar";
import { avatarSVG, svgToPngDataUrl } from "../lib/avatar";

function Variant({ seed, variant }) {
  const svg = React.useMemo(()=>avatarSVG(seed, 180, variant),[seed,variant]);
  const onDownload = async () => {
    const url = await svgToPngDataUrl(svg, 1024);
    const a = document.createElement("a"); a.href=url; a.download=`blockreceipt-${seed}-v${variant}.png`; a.click();
  };
  return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
      <div dangerouslySetInnerHTML={{__html: svg}} style={{width:180,height:180,borderRadius:16,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.45)"}}/>
      <button onClick={onDownload} style={{background:"#111", color:"#20FFE3", border:"1px solid #222", padding:"6px 10px", borderRadius:8}}>Download</button>
    </div>
  );
}

export default function Studio(){
  const [typed, setTyped] = React.useState("0x31551DE1Bd94Fe9B76801Ed226697a57D806d6ff");
  const [seed, setSeed] = React.useState(typed);
  const [variant, setVariant] = React.useState(0);

  const onGenerate = () => { setSeed(typed.trim() || "blockreceipt"); setVariant(0); };
  const onRandomize = () => setVariant(v => (v+1)%8);

  return (
    <div style={{padding:24, color:"#fff"}}>
      <h2 style={{marginBottom:12}}>BlockReceipt Avatar Studio</h2>
      <div style={{display:"flex", gap:12, alignItems:"center", marginBottom:20, flexWrap:"wrap"}}>
        <input
          value={typed} onChange={e=>setTyped(e.target.value)}
          placeholder="Type a merchant, wallet, or phrase"
          style={{minWidth:420, padding:"10px 12px", borderRadius:10, border:"1px solid #333",
                  background:"#0d0d0f", color:"#eee"}}
        />
        <button onClick={onGenerate}  style={{background:"#20FFE3", color:"#02151a", border:"none", padding:"10px 14px", borderRadius:10, fontWeight:700}}>Generate</button>
        <button onClick={onRandomize} style={{background:"#111", color:"#20FFE3", border:"1px solid #222", padding:"10px 14px", borderRadius:10}}>Next Variant</button>
        <span style={{opacity:.7}}>Seed: <code>{seed}</code> • Variant: {variant}</span>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"320px 1fr", gap:24}}>
        <div><Avatar seed={seed} size={320} rounded allowDownload /></div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16}}>
          {Array.from({length:8}).map((_,i)=>(
            <div key={i} style={{cursor:"pointer"}} onClick={()=>setVariant(i)}>
              <Variant seed={seed} variant={i}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
