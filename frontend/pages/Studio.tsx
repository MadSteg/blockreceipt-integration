import React from "react";
import { Avatar } from "../components/Avatar";

export default function Studio(){
  const [seed,setSeed] = React.useState("Dunkin Donuts");
  return (
    <div style={{padding:24, color:"#fff"}}>
      <h2 style={{marginBottom:12}}>BlockReceipt Avatar Studio</h2>
      <div style={{display:"flex", gap:12, alignItems:"center", marginBottom:20}}>
        <input
          value={seed} onChange={e=>setSeed(e.target.value)}
          placeholder="Type a merchant or wallet address"
          style={{width:420, padding:"10px 12px", borderRadius:10, border:"1px solid #333",
                  background:"#0d0d0f", color:"#eee"}}
        />
        <span style={{opacity:.7}}>Seed: <code>{seed}</code></span>
      </div>
      <Avatar seed={seed} size={320} rounded allowDownload />
    </div>
  );
}
