import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ImageAnalysisResult {
  nftName: string;
  description: string;
  traits: string[];
}

export class ImageAnalysisService {
  /**
   * Analyze an image and generate an NFT name and description
   */
  async analyzeImageForNFT(imageUrl: string, originalFileName: string): Promise<ImageAnalysisResult> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert NFT curator specializing in creating engaging names and descriptions for digital collectibles. 
            Your task is to analyze images and create compelling NFT metadata that would appeal to collectors.
            Focus on unique characteristics, personality, and traits that make each piece special.
            Keep names catchy but not overly long (2-4 words max).
            Respond with JSON in this exact format: { "nftName": "string", "description": "string", "traits": ["trait1", "trait2", "trait3"] }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and create an engaging NFT name and description. Original filename: ${originalFileName}. 
                Focus on what makes this image unique and collectible. If it's an animal, describe its personality and distinctive features.
                Create 3-5 key traits that collectors would find appealing.`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ],
          },
        ],
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        nftName: result.nftName || this.generateFallbackName(originalFileName),
        description: result.description || "A unique digital collectible",
        traits: result.traits || ["Unique", "Collectible", "Digital Art"]
      };

    } catch (error) {
      console.error('Error analyzing image:', error);
      return {
        nftName: this.generateFallbackName(originalFileName),
        description: "A unique digital collectible from the BlockReceipt collection",
        traits: ["Unique", "Collectible", "Digital Art"]
      };
    }
  }

  /**
   * Generate a fallback name from filename
   */
  private generateFallbackName(fileName: string): string {
    return fileName
      .replace(/\.(png|jpg|jpeg|gif)$/i, '') // Remove extension
      .replace(/^screenshot[-_]?/i, '') // Remove 'screenshot' prefix
      .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize words
      .trim() || "Digital Collectible";
  }

  /**
   * Batch analyze multiple images
   */
  async analyzeMultipleImages(images: Array<{ fileName: string; url: string }>): Promise<Array<{ fileName: string; analysis: ImageAnalysisResult }>> {
    const results = [];
    
    for (const image of images) {
      try {
        console.log(`Analyzing image: ${image.fileName}`);
        const analysis = await this.analyzeImageForNFT(image.url, image.fileName);
        results.push({
          fileName: image.fileName,
          analysis
        });
        
        // Add a small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error analyzing ${image.fileName}:`, error);
        results.push({
          fileName: image.fileName,
          analysis: {
            nftName: this.generateFallbackName(image.fileName),
            description: "A unique digital collectible",
            traits: ["Unique", "Collectible"]
          }
        });
      }
    }
    
    return results;
  }
}

export const imageAnalysisService = new ImageAnalysisService();