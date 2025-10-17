export const cfg = {
  appName: import.meta.env.VITE_APP_NAME || "BlockReceipt",
  chainName: import.meta.env.VITE_CHAIN_NAME || "Polygon",
  rpc: import.meta.env.VITE_POLYGON_RPC || "",
  contract: import.meta.env.VITE_CONTRACT_ADDRESS || "",
  metadataBase: (import.meta.env.VITE_METADATA_BASE || "").replace(/\/$/, ""),
  polygonscanBase: (import.meta.env.VITE_POLYGONSCAN_BASE || "https://polygonscan.com").replace(/\/$/, ""),
  exampleWallet: import.meta.env.VITE_EXAMPLE_WALLET || "",
  exampleTokens: String(import.meta.env.VITE_EXAMPLE_TOKENS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),
};
