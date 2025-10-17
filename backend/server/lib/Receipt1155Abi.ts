/**
 * ABI for Receipt1155 Smart Contract
 * This is a simplified ABI with just the methods we need
 */
export const Receipt1155Abi = [
  // Basic ERC-1155 & ERC-721 methods
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function uri(uint256 id) view returns (string)",
  
  // Receipt-specific methods
  "function mintReceipt(uint256 tokenId, bytes32 receiptHash, string memory tokenURI) public returns (uint256)",
  "function receiptHashes(uint256 tokenId) view returns (bytes32)",
  "function verifyReceipt(uint256 tokenId, bytes32 receiptHash) view returns (bool)",
  
  // Events
  "event ReceiptMinted(address indexed owner, uint256 indexed tokenId, bytes32 receiptHash)",
  "event ReceiptVerified(uint256 indexed tokenId, bool verified)"
];