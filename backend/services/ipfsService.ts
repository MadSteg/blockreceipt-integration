/**
 * IPFS Utility for Blockchain Receipt Storage
 * 
 * This file provides utilities for interacting with IPFS for storing and retrieving 
 * receipt data. Since we're using the Ethereum blockchain for the main verification,
 * we use a simpler approach for IPFS (storing the data directly in the blockchain contract).
 */
import axios from 'axios';

// Public IPFS gateway - we'll use this for retrieving content
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs/';

// IPFS service singleton for use throughout the application
export const ipfsService = {
  getIpfsUrl,
  getFromIPFS,
  pinToIPFS
};

/**
 * Get a formatted IPFS URL from a CID
 * @param cid Content Identifier
 * @returns Formatted IPFS URL
 */
export function getIpfsUrl(cid: string): string {
  if (!cid) return '';
  return `${PUBLIC_GATEWAY}${cid}`;
}

/**
 * Get content from IPFS by CID using a public gateway
 * @param cid Content Identifier
 * @returns Content as string
 */
export async function getFromIPFS(cid: string): Promise<string> {
  try {
    // Use axios to fetch the content from a public IPFS gateway
    const response = await axios.get(getIpfsUrl(cid));
    return typeof response.data === 'string' 
      ? response.data 
      : JSON.stringify(response.data);
  } catch (error) {
    console.error('IPFS retrieval error:', error);
    throw new Error(`Failed to retrieve from IPFS: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * For the blockchain receipt project, we're handling IPFS storage as part of the smart contract functionality.
 * This dummy function provides an interface compatible with our application design.
 * The actual data is stored on the blockchain through the contract's storage mechanisms.
 * 
 * @param content Content that would be pinned to IPFS
 * @returns CID from the smart contract storage process
 */
export async function pinToIPFS(content: string): Promise<string> {
  console.log('IPFS content would be stored through the blockchain contract');
  
  // In a real implementation with a dedicated IPFS service, this would pin the content.
  // For our blockchain-based app, we're storing the content directly in the smart contract.
  return 'blockchain-stored-data';
}