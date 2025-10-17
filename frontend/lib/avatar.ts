const PALETTE = [
  "#FF3EC8","#20FFE3","#7C3AED","#FF4D8D","#00C2FF",
  "#0D0D0F","#111218","#181A22"
];

function hash32(str: string) {
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function avatarSeed(input: string) {
  const h = hash32(input || "blockreceipt");
  const r = (n: number) => ((h >> (n % 24)) & 0xff) / 255;
  return {
    bg1: PALETTE[ (h      ) % PALETTE.length ],
    bg2: PALETTE[ (h >> 3 ) % PALETTE.length ],
    accent: PALETTE[ (h >> 6 ) % PALETTE.length ],
    stripe: PALETTE[ (h >> 9 ) % PALETTE.length ],
    shape: (h >> 12) % 4,
    noise: r(15),
    tilt: (r(18)-0.5)*10,
  };
}

export function avatarSVG(input: string, size=420) {
  const s = avatarSeed(input);
  const id = "g"+hash32(input).toString(16);
  const g = (n:number)=>`${id}-${n}`;
  const w=size,h=size;
  const cup = `
    <g transform="translate(${w*0.3},${h*0.28}) rotate(${s.tilt})">
      <rect x="0" y="0" rx="${w*0.04}" width="${w*0.4}" height="${h*0.55}"
            fill="${s.accent}" stroke="${s.stripe}" stroke-width="${w*0.02}"/>
      <rect x="${w*0.12}" y="${-h*0.08}" width="${w*0.16}" height="${h*0.12}" rx="${w*0.02}"
            fill="${s.stripe}"/>
      <rect x="${w*0.19}" y="${-h*0.22}" width="${w*0.02}" height="${h*0.22}" rx="${w*0.01}"
            fill="${s.stripe}"/>
    </g>`;
  const coin = `
    <g transform="translate(${w*0.26},${h*0.2}) rotate(${s.tilt})">
      <ellipse cx="${w*0.24}" cy="${h*0.38}" rx="${w*0.22}" ry="${h*0.22}"
               fill="${s.accent}" stroke="${s.stripe}" stroke-width="${w*0.02}"/>
      <text x="${w*0.24}" y="${h*0.40}" fill="${s.stripe}" font-size="${w*0.14}"
            font-weight="700" text-anchor="middle">R</text>
    </g>`;
  const tri = `
    <g transform="translate(${w*0.18},${h*0.18}) rotate(${s.tilt})">
      <polygon points="${w*0.05},${h*0.6} ${w*0.5},${h*0.6} ${w*0.275},${h*0.15}"
               fill="${s.accent}" stroke="${s.stripe}" stroke-width="${w*0.02}"/>
    </g>`;
  const ticket = `
    <g transform="translate(${w*0.2},${h*0.28}) rotate(${s.tilt})">
      <rect x="0" y="0" width="${w*0.55}" height="${h*0.36}" rx="${w*0.06}"
            fill="${s.accent}" stroke="${s.stripe}" stroke-width="${w*0.02}"/>
      <circle cx="${w*0.07}" cy="${h*0.18}" r="${w*0.04}" fill="${s.stripe}"/>
      <circle cx="${w*0.48}" cy="${h*0.18}" r="${w*0.04}" fill="${s.stripe}"/>
    </g>`;

  const center = [cup, coin, tri, ticket][s.shape];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${g(1)}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${s.bg1}"/>
      <stop offset="100%" stop-color="${s.bg2}"/>
    </linearGradient>
    <filter id="${g(2)}">
      <feTurbulence type="fractalNoise" baseFrequency="${0.8+s.noise*0.5}" numOctaves="1" result="n"/>
      <feColorMatrix type="saturate" values="0" result="m"/>
      <feBlend in="SourceGraphic" in2="m" mode="overlay"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#${g(1)})"/>
  <g opacity="0.15" filter="url(#${g(2)})">
    <rect width="100%" height="100%" fill="#000"/>
  </g>
  <g opacity="0.25" stroke="${s.stripe}">
    ${Array.from({length:6}).map((_,i)=>`<line x1="0" y1="${h*0.7 + i*12}" x2="${w}" y2="${h*0.7 + i*12}"/>`).join("")}
  </g>
  ${center}
</svg>`;
}

export async function svgToPngDataUrl(svg: string, size=420) {
  const blob = new Blob([svg], {type: "image/svg+xml"});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}
