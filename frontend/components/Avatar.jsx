import React from "react";
import { avatarSVG, svgToPngDataUrl } from "../lib/avatar";

export function Avatar({ seed, size=160, rounded=true, allowDownload=false, variant=0 }) {
  const svg = React.useMemo(()=>avatarSVG(seed, size, variant),[seed,size,variant]);
  const onDownload = async () => {
    const dataUrl = await svgToPngDataUrl(svg, size);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `blockreceipt-${seed}.png`;
    a.click();
  };
  return (
    <div style={{display:"inline-flex", flexDirection:"column", alignItems:"center", gap:8}}>
      <div
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{
          width:size, height:size, borderRadius: rounded? 16: 0,
          overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.45)"
        }}
      />
      {allowDownload && (
        <button onClick={onDownload}
          style={{background:"#111", color:"#20FFE3", border:"1px solid #222", padding:"6px 10px", borderRadius:8}}>
          Download PNG
        </button>
      )}
    </div>
  );
}
