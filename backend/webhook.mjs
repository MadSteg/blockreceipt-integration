import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import { uploadToGCSDirect } from "./lib/uploadToGCSDirect.mjs";
import { ethers, BigNumber } from 'ethers';

async function pickMerchantImageV2(bucketName, merchantOrName) {
  const name = String(merchantOrName||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  const base = `https://storage.googleapis.com/${bucketName}/merchants/${name}/images/`;
  const prefix = name.includes("dunkin") ? (process.env.MERCHANT_PREFIX_DUNKIN || "dunkin") : name;
  const max = Number(process.env.MERCHANT_MAX_IMAGES || 32);
  for (let tries=0; tries<64; tries++){
    const n = 1 + Math.floor(Math.random() * Math.min(max,99));
    const nn = String(n).padStart(2,"0");
    const url = `${base}${prefix}-${nn}.png`;
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.ok) return url;
    } catch {}
  }
  return null;
}


const RPC              = process.env.POLYGON_MAINNET_RPC_URL;
const PK               = process.env.BLOCKCHAIN_PRIVATE_KEY;
const NFT_ADDR         = process.env.NFT_CONTRACT_ADDRESS;
const GCS_PROJECT_ID   = process.env.GCS_PROJECT_ID;
const BUCKET           = process.env.GCS_BUCKET;
const API_KEY          = process.env.WEBHOOK_API_KEY;
const RECEIPT_AES_KEY  = process.env.RECEIPT_AES_KEY || null;

if (!RPC || !PK || !NFT_ADDR || !GCS_PROJECT_ID || !BUCKET || !API_KEY) {
  console.error('Missing required envs. Check RPC/PK/NFT_ADDR/GCS_PROJECT_ID/GCS_BUCKET/WEBHOOK_API_KEY');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));



async function genAiImage(merchantName, items, tokenId){
  try{
    if(!process.env.FAL_KEY) return null;

    const shortItems = Array.isArray(items)
      ? items.slice(0,3).map(i => `${i.qty||1}x ${i.desc||"item"}`).join(", ")
      : "";
    const prompt =
      `Neon synthwave receipt collectible for ${merchantName}. ` +
      `Stylized emblem + subtle receipt motif. Clean center graphic. ` +
      `High-contrast, vibrant gradients. No text. Items: ${shortItems}`;

    const falEndpoint = "https://fal.run/fal-ai/flux/dev";
    const r = await fetch(falEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd"
      })
    });

    if(!r.ok){
      const txt = await r.text().catch(()=> "");
      throw new Error("fal.ai error " + r.status + " " + txt);
    }
    const data = await r.json();
    const url =
      (data?.images && data.images[0]?.url) ||
      (data?.image && data.image.url) ||
      null;
    if(!url) return null;

    const img = await fetch(url);
    if(!img.ok) throw new Error("download failed "+img.status);
    const buf = Buffer.from(await img.arrayBuffer());

    const objectName = `art/receipts/${String(tokenId)}.png`;
    const gcsUrl = await uploadToGCSDirect(
      BUCKET,
      objectName,
      buf,
      "image/png",
      "public, max-age=31536000, immutable"
    );

    console.log("[ai-image] generated ->", gcsUrl);
    return gcsUrl;
  }catch(e){
    console.log("[ai-image] failed:", e?.message || String(e));
    return null;
  }
}

const storage = new Storage();
const bucket = storage.bucket(BUCKET);
app.post("/pos/mint", async (req,res)=>{
  try{
    if(req.get("x-api-key")!==API_KEY) return res.status(401).json({ok:false,error:"Unauthorized"});
    const body=req.body||{};
    const tokenId=Number(body.tokenId);
    const to=String(body.to||"").trim();
    const merchantName=body.merchantName||"Unknown Merchant";
    if(!Number.isFinite(tokenId))return res.status(400).json({ok:false,error:"Bad tokenId"});
    if(!to||!to.startsWith("0x")||to.length!==42)return res.status(400).json({ok:false,error:"Bad recipient"});

    let imageUrl = await genAiImage(merchantName, body.items, tokenId);
if(!imageUrl){
  imageUrl = await pickMerchantImageV2(BUCKET, merchantName);
}
console.log("[picker] imageUrl:", imageUrl);
console.log("[picker] imageUrl:", imageUrl);

    const meta = {
      name: `BlockReceipt #${tokenId}`,
      description: `Receipt from ${merchantName}`,
      image: imageUrl || undefined,
      external_url: "https://blockreceipt.example",
      attributes: [
        { trait_type:"Merchant", value: merchantName },
        { trait_type:"TotalCents", value: Number(body.totalCents||0) },
        { trait_type:"Timestamp", value: Number(body.timestamp || Math.floor(Date.now()/1000)) }
      ],
      items: Array.isArray(body.items)? body.items : undefined,
      paymentLast4: body.paymentLast4 || undefined
    };

    const path=`metadata/${tokenId}.json`;
    const file=bucket.file(path);
    m=>{return m},await uploadToGCSDirect(BUCKET, path, JSON.stringify(meta,null,2), "application/json", "public, max-age=300");

    const metaUrl=`https://storage.googleapis.com/${BUCKET}/${path}`;

    const provider=new ethers.providers.JsonRpcProvider(RPC,{chainId:137,name:"polygon"});
    const signer=new ethers.Wallet(PK,provider);
    const abi=['function mint(address to,uint256 id,uint256 amount,bytes data) external'];
    const nft=new ethers.Contract(NFT_ADDR,abi,signer);
    const fd=await provider.getFeeData();
    const minTip=ethers.utils.parseUnits("25","gwei");
    const tip = fd.maxPriorityFeePerGas && ethers.BigNumber.from(fd.maxPriorityFeePerGas).gte(minTip) ? fd.maxPriorityFeePerGas : minTip;
    const maxFee = fd.maxFeePerGas && ethers.BigNumber.from(fd.maxFeePerGas).gte(tip.mul(2)) ? fd.maxFeePerGas : tip.mul(2);

    const tx=await nft.mint(to,tokenId,1,"0x",{gasLimit:220000,maxPriorityFeePerGas:tip,maxFeePerGas:maxFee});
    const r=await tx.wait();

    res.json({ok:true,tokenId,to,merchantName,metadata:metaUrl,image:imageUrl||null,txHash:tx.hash,blockNumber:r.blockNumber});
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false,error:e?.message||String(e)});
  }
});
app.get("/healthz",(req,res)=>res.json({ok:true,ts:Date.now()}));
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`POS webhook listening on :${PORT}`));
