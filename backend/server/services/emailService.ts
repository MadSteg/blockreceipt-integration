import { MailService } from '@sendgrid/mail';

// Initialize SendGrid mail service
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY!);

export interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

export interface ReceiptEmailParams {
  to: string;
  productName: string;
  merchantName: string;
  receiptId: number;
  receiptNftId: string;
  transactionHash: string;
  walletAddress: string;
  tier: string;
  amount: number;
  ipfsHash?: string;
}

/**
 * Send a generic email using SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: 'noreply@blockreceipt.ai',
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    
    console.log(`Email sent to ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error?.response?.body || error);
    return false;
  }
}

/**
 * Send an NFT receipt confirmation email
 */
export async function sendReceiptEmail(params: ReceiptEmailParams): Promise<boolean> {
  const {
    to,
    productName,
    merchantName,
    receiptId,
    receiptNftId,
    transactionHash,
    walletAddress,
    tier,
    amount,
    ipfsHash
  } = params;

  const truncatedWallet = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  const truncatedTxn = `${transactionHash.substring(0, 6)}...${transactionHash.substring(transactionHash.length - 4)}`;
  
  const subject = `Your NFT Receipt for ${productName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">Your NFT Receipt</h1>
        <p style="color: #666;">Thank you for your purchase</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #333;">Purchase Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Product:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Merchant:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${merchantName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">$${amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
        <h2 style="margin-top: 0; color: #2563eb;">NFT Receipt Information</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff;"><strong>Receipt ID:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff; text-align: right;">#${receiptId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff;"><strong>NFT ID:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff; text-align: right;">${receiptNftId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff;"><strong>Tier:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff; text-align: right;">${tier.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff;"><strong>Delivered to:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff; text-align: right;">${truncatedWallet}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff;"><strong>Transaction:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff; text-align: right;">${truncatedTxn}</td>
          </tr>
          ${ipfsHash ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff;"><strong>IPFS Hash:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #d1e1ff; text-align: right;">${ipfsHash.substring(0, 8)}...${ipfsHash.substring(ipfsHash.length - 6)}</td>
          </tr>` : ''}
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">
          Your receipt has been stored on the blockchain and is permanently accessible via your wallet.
        </p>
        <p style="color: #666; font-size: 12px;">
          © 2025 BlockReceipt.ai - Transforming digital receipts with blockchain technology
        </p>
      </div>
    </div>
  `;
  
  return sendEmail({
    to,
    subject,
    html
  });
}