import { Canvas, createCanvas } from 'canvas';
import { ipfsService } from './ipfsService';
import { logger } from '../utils/logger';

// Define city colors and themes
interface CityColors {
  sky: string;
  building: string;
  landmark: string;
  ground: string;
  window: string;
  cloud: string;
  special: string;
}

type TimeOfDayColors = {
  [key: string]: CityColors;
};

/**
 * Service to generate passport stamps for receipts
 */
export class StampService {
  private canvas: Canvas;
  private ctx: CanvasRenderingContext2D;
  
  // City theme colors based on time of day
  private timeColors: TimeOfDayColors = {
    dawn: {
      sky: '#7088b0',
      building: '#344861',
      landmark: '#e2a85e',
      ground: '#5a6b87',
      window: '#f5edbe',
      cloud: '#f8c1c0',
      special: '#a3abc0'
    },
    day: {
      sky: '#87ceeb',
      building: '#607d8b',
      landmark: '#ffd54f',
      ground: '#8d6e63',
      window: '#ffffff',
      cloud: '#f5f5f5',
      special: '#4fc3f7'
    },
    sunset: {
      sky: '#ff9e80',
      building: '#546e7a',
      landmark: '#ffab40',
      ground: '#795548',
      window: '#ffe0b2',
      cloud: '#ffccbc',
      special: '#ff8a65'
    },
    dusk: {
      sky: '#5c6bc0',
      building: '#37474f',
      landmark: '#ffb74d',
      ground: '#4e342e',
      window: '#fff9c4',
      cloud: '#b39ddb',
      special: '#9575cd'
    },
    night: {
      sky: '#263238',
      building: '#1a237e',
      landmark: '#ffd600',
      ground: '#212121',
      window: '#ffeb3b',
      cloud: '#4527a0',
      special: '#7986cb'
    },
    neon: {
      sky: '#0D0221',
      building: '#0F0326',
      landmark: '#FF2975',
      ground: '#190633',
      window: '#18FFE5',
      cloud: '#261447',
      special: '#721B91'
    }
  };

  constructor() {
    // Create canvas for stamp generation
    this.canvas = createCanvas(200, 200);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Generate a stamp for a receipt and upload to IPFS
   * @param receiptData The receipt data
   * @param promotional Whether this is a promotional receipt
   * @returns URI for the uploaded stamp
   */
  async generateStamp(
    receiptData: { 
      merchantName: string; 
      date: string; 
      total: number;
      category?: string;
    },
    promotional: boolean = false
  ): Promise<string> {
    try {
      // Clear canvas
      this.ctx.clearRect(0, 0, 200, 200);
      
      // Get time of day from receipt date
      const date = new Date(receiptData.date);
      const hour = date.getHours();
      let timeOfDay = 'day';
      
      if (hour < 6) timeOfDay = 'dawn';
      else if (hour < 11) timeOfDay = 'day';
      else if (hour < 17) timeOfDay = 'sunset';
      else if (hour < 21) timeOfDay = 'dusk';
      else timeOfDay = 'night';
      
      // If promotional, use neon theme
      if (promotional) timeOfDay = 'neon';
      
      // Draw base circle
      this.drawStampCircle(this.ctx, timeOfDay);
      
      // Draw merchant initial in the center
      this.drawMerchantInitial(this.ctx, receiptData.merchantName, timeOfDay);
      
      // Draw city skyline based on receipt category
      this.drawCitySkyline(this.ctx, receiptData.category || 'general', timeOfDay);
      
      // Draw date stamp at the bottom
      this.drawDateStamp(this.ctx, receiptData.date);
      
      // Add price indicator stars
      const stars = Math.min(5, Math.max(1, Math.ceil(receiptData.total / 20)));
      this.drawPriceStars(this.ctx, stars, timeOfDay);
      
      // Upload to IPFS and return URI
      const stampBuffer = this.canvas.toBuffer('image/png');
      const response = await ipfsService.pinFileToIPFS(stampBuffer, `receipt_stamp_${Date.now()}.png`);
      
      const stampUri = `ipfs://${response.IpfsHash}`;
      logger.info(`Generated stamp and uploaded to IPFS: ${stampUri}`);
      
      return stampUri;
    } catch (error) {
      logger.error(`Failed to generate stamp: ${error instanceof Error ? error.message : String(error)}`);
      // Return default stamp if there's an error
      return 'ipfs://QmdefaultStampHash';
    }
  }
  
  /**
   * Draw the base circle of the stamp
   */
  private drawStampCircle(ctx: CanvasRenderingContext2D, timeOfDay: string): void {
    const colors = this.timeColors[timeOfDay];
    
    // Outer circle
    ctx.beginPath();
    ctx.arc(100, 100, 95, 0, Math.PI * 2);
    ctx.strokeStyle = colors.building;
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(100, 100, 90, 0, Math.PI * 2);
    ctx.fillStyle = colors.sky;
    ctx.fill();
    
    // Perforated edge
    for (let i = 0; i < 36; i++) {
      const angle = (i * 10) * Math.PI / 180;
      const x1 = 100 + 95 * Math.cos(angle);
      const y1 = 100 + 95 * Math.sin(angle);
      const x2 = 100 + 100 * Math.cos(angle);
      const y2 = 100 + 100 * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = colors.building;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  
  /**
   * Draw the merchant's initial in the center
   */
  private drawMerchantInitial(ctx: CanvasRenderingContext2D, merchantName: string, timeOfDay: string): void {
    const colors = this.timeColors[timeOfDay];
    const initial = merchantName.charAt(0).toUpperCase();
    
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = colors.landmark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, 100, 100);
    
    // Add subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  
  /**
   * Draw a minimalist city skyline based on category
   */
  private drawCitySkyline(ctx: CanvasRenderingContext2D, category: string, timeOfDay: string): void {
    const colors = this.timeColors[timeOfDay];
    
    // Define unique skyline based on category hash
    const categoryHash = this.hashString(category);
    
    // Draw ground
    ctx.fillStyle = colors.ground;
    ctx.fillRect(25, 130, 150, 20);
    
    // Draw buildings
    for (let i = 0; i < 10; i++) {
      const x = 30 + i * 15;
      const heightSeed = (categoryHash + i) % 40;
      const height = 30 + heightSeed;
      
      ctx.fillStyle = colors.building;
      ctx.fillRect(x, 130 - height, 10, height);
      
      // Draw windows
      const windowCount = Math.max(1, Math.floor(height / 10));
      for (let j = 0; j < windowCount; j++) {
        ctx.fillStyle = colors.window;
        ctx.fillRect(x + 3, 125 - height + (j * 10) + 3, 4, 4);
      }
    }
    
    // Draw landmark based on category
    const landmarkX = 85 + (categoryHash % 30);
    const landmarkHeight = 50 + (categoryHash % 30);
    ctx.fillStyle = colors.landmark;
    
    // Different landmark styles
    switch (categoryHash % 5) {
      case 0: // Tower
        ctx.fillRect(landmarkX, 130 - landmarkHeight, 15, landmarkHeight);
        ctx.beginPath();
        ctx.moveTo(landmarkX, 130 - landmarkHeight);
        ctx.lineTo(landmarkX + 7.5, 130 - landmarkHeight - 15);
        ctx.lineTo(landmarkX + 15, 130 - landmarkHeight);
        ctx.fill();
        break;
      case 1: // Dome
        ctx.fillRect(landmarkX, 130 - landmarkHeight + 20, 20, landmarkHeight - 20);
        ctx.beginPath();
        ctx.arc(landmarkX + 10, 130 - landmarkHeight + 20, 10, Math.PI, 0);
        ctx.fill();
        break;
      case 2: // Modern building
        ctx.fillRect(landmarkX, 130 - landmarkHeight, 20, landmarkHeight);
        ctx.fillStyle = colors.window;
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 3; j++) {
            ctx.fillRect(landmarkX + 3 + (j * 6), 130 - landmarkHeight + 5 + (i * 10), 3, 5);
          }
        }
        break;
      case 3: // Pagoda
        for (let i = 0; i < 3; i++) {
          const width = 20 - (i * 4);
          const height = 15;
          const y = 130 - height * (i + 1);
          const x = landmarkX + (i * 2);
          ctx.fillRect(x, y, width, height);
        }
        break;
      case 4: // Bridge
        ctx.beginPath();
        ctx.moveTo(landmarkX - 10, 130 - 20);
        ctx.quadraticCurveTo(landmarkX + 15, 130 - 50, landmarkX + 40, 130 - 20);
        ctx.lineWidth = 5;
        ctx.strokeStyle = colors.landmark;
        ctx.stroke();
        
        // Pillars
        ctx.fillStyle = colors.landmark;
        ctx.fillRect(landmarkX, 130 - 20, 5, 20);
        ctx.fillRect(landmarkX + 25, 130 - 20, 5, 20);
        break;
    }
    
    // Draw clouds if daytime
    if (['dawn', 'day', 'sunset'].includes(timeOfDay)) {
      for (let i = 0; i < 3; i++) {
        const x = 40 + (i * 50) + (categoryHash % 20);
        const y = 50 + (i * 5);
        this.drawCloud(ctx, x, y, colors.cloud);
      }
    } else if (timeOfDay === 'night' || timeOfDay === 'neon') {
      // Draw stars/lights at night
      for (let i = 0; i < 20; i++) {
        const x = 30 + (categoryHash + i * 7) % 140;
        const y = 30 + (categoryHash + i * 11) % 60;
        ctx.fillStyle = colors.window;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  /**
   * Draw a simple cloud
   */
  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 2, 9, 0, Math.PI * 2);
    ctx.arc(x + 20, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  
  /**
   * Draw date stamp at the bottom
   */
  private drawDateStamp(ctx: CanvasRenderingContext2D, dateString: string): void {
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit',
      year: 'numeric'
    });
    
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formattedDate, 100, 160);
  }
  
  /**
   * Draw price indicator stars
   */
  private drawPriceStars(ctx: CanvasRenderingContext2D, count: number, timeOfDay: string): void {
    const colors = this.timeColors[timeOfDay];
    
    for (let i = 0; i < count; i++) {
      const x = 50 + i * 25;
      const y = 175;
      this.drawStar(ctx, x, y, 5, colors.special);
    }
  }
  
  /**
   * Draw a star shape
   */
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI * 2 * i / 10 - Math.PI / 2;
      const radius = i % 2 === 0 ? size : size / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * Simple string hashing function to get consistent results
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const stampService = new StampService();