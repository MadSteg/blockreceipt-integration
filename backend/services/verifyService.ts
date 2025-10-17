import { ethers } from 'ethers';

export async function verifyReceipt(tokenId: string) {
  try {
    // For demo purposes, simulate verification for demo tokens 1, 2, 3
    const demoTokens = ['1', '2', '3'];
    
    if (demoTokens.includes(tokenId)) {
      // Return simulated verification success for demo
      return {
        success: true,
        tokenId,
        exists: true,
        metadataUri: `ipfs://demo-metadata-${tokenId}`,
        totalSupply: '1',
        contractAddress: '0x1111111111111111111111111111111111111111',
        network: {
          name: 'polygon-amoy',
          chainId: 80002
        },
        verifiedAt: new Date().toISOString(),
        isDemoToken: true
      };
    }

    // For real tokens, try blockchain verification
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC URL not configured for blockchain verification');
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const contractAddress = process.env.RECEIPT_NFT_CONTRACT_ADDRESS;
    
    if (!contractAddress || contractAddress === '0x1111111111111111111111111111111111111111') {
      throw new Error('Contract address not configured for blockchain verification');
    }
    
    // ERC-1155 ABI for the enhanced receipt contract
    const contractABI = [
      "function uri(uint256 tokenId) public view returns (string memory)",
      "function balanceOf(address account, uint256 id) public view returns (uint256)",
      "function totalSupply(uint256 id) public view returns (uint256)",
      "function exists(uint256 id) public view returns (bool)"
    ];
    
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // Verify the token exists and get metadata URI
    const tokenExists = await contract.exists(tokenId);
    
    if (!tokenExists) {
      throw new Error(`Token ID ${tokenId} does not exist on the blockchain`);
    }
    
    // Get metadata URI
    const metadataUri = await contract.uri(tokenId);
    
    // Get total supply for this token
    const totalSupply = await contract.totalSupply(tokenId);
    
    // Get network info
    const network = await provider.getNetwork();
    
    return {
      success: true,
      tokenId,
      exists: tokenExists,
      metadataUri,
      totalSupply: totalSupply.toString(),
      contractAddress,
      network: {
        name: network.name,
        chainId: network.chainId
      },
      verifiedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error('Verification error:', error);
    
    // Return detailed error info
    return {
      success: false,
      tokenId,
      error: error.message || 'Unknown verification error',
      verifiedAt: new Date().toISOString()
    };
  }
}

export async function verifyReceiptOwnership(tokenId: string, walletAddress: string) {
  try {
    const rpcUrl = process.env.RPC_URL || 'https://polygon-amoy.g.alchemy.com/v2/aW44pWE6n-X1AhiLXaJQPu3POOrIlArr';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    const contractAddress = process.env.RECEIPT_NFT_CONTRACT_ADDRESS || '0x1111111111111111111111111111111111111111';
    
    const contractABI = [
      "function balanceOf(address account, uint256 id) public view returns (uint256)"
    ];
    
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // Check if the wallet owns this token
    const balance = await contract.balanceOf(walletAddress, tokenId);
    
    return {
      success: true,
      tokenId,
      walletAddress,
      balance: balance.toString(),
      owns: balance.gt(0),
      verifiedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error('Ownership verification error:', error);
    
    return {
      success: false,
      tokenId,
      walletAddress,
      error: error.message || 'Unknown ownership verification error',
      verifiedAt: new Date().toISOString()
    };
  }
}