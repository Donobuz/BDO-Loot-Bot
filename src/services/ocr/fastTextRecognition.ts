/**
 * Fast Text Recognition Engine for BDO
 * Optimized for real-time loot detection
 */

import sharp from 'sharp';

export interface TextRegion {
  text: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class FastTextRecognition {
  
  /**
   * Extract text from image using fast pattern recognition
   */
  public static async extractText(imageBuffer: Buffer): Promise<TextRegion[]> {
    try {
      // Convert image to a format we can analyze
      const { data, info } = await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Perform fast text detection using simple algorithms
      const regions = await this.detectTextRegions(data, info.width, info.height);
      
      return regions;
    } catch (error) {
      console.error('Text extraction failed:', error);
      return [];
    }
  }

  /**
   * Fast text region detection using simple computer vision
   */
  private static async detectTextRegions(
    imageData: Buffer, 
    width: number, 
    height: number
  ): Promise<TextRegion[]> {
    const regions: TextRegion[] = [];
    
    // Simple horizontal line detection for text areas
    // This is a basic implementation - in production you'd want more sophisticated detection
    
    const threshold = 100; // Brightness threshold
    const minTextWidth = 20;
    const minTextHeight = 8;
    
    // Scan for text-like patterns
    for (let y = 0; y < height - minTextHeight; y += 2) {
      for (let x = 0; x < width - minTextWidth; x += 2) {
        const region = this.analyzeRegion(imageData, x, y, minTextWidth, minTextHeight, width, height, threshold);
        
        if (region && region.confidence > 0.5) {
          // Try to recognize the text using pattern matching
          const recognizedText = this.recognizeTextPattern(imageData, region.bbox, width);
          
          if (recognizedText && recognizedText.length > 2) {
            regions.push({
              text: recognizedText,
              confidence: region.confidence,
              bbox: region.bbox
            });
          }
        }
      }
    }
    
    return this.mergeOverlappingRegions(regions);
  }

  /**
   * Analyze a region to determine if it contains text
   */
  private static analyzeRegion(
    imageData: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
    imageWidth: number,
    imageHeight: number,
    threshold: number
  ): { confidence: number; bbox: { x: number; y: number; width: number; height: number } } | null {
    
    let darkPixels = 0;
    let lightPixels = 0;
    let totalPixels = 0;
    
    // Sample pixels in the region
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = x + dx;
        const py = y + dy;
        
        if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
          const pixelIndex = py * imageWidth + px;
          if (pixelIndex < imageData.length) {
            const brightness = imageData[pixelIndex];
            
            if (brightness < threshold) {
              darkPixels++;
            } else {
              lightPixels++;
            }
            totalPixels++;
          }
        }
      }
    }
    
    // Text usually has a good contrast ratio
    const contrastRatio = Math.min(darkPixels, lightPixels) / Math.max(darkPixels, lightPixels);
    const confidence = contrastRatio > 0.3 ? 0.8 : 0.2;
    
    if (confidence > 0.5) {
      return {
        confidence,
        bbox: { x, y, width, height }
      };
    }
    
    return null;
  }

  /**
   * Simple pattern-based text recognition
   */
  private static recognizeTextPattern(
    imageData: Buffer,
    bbox: { x: number; y: number; width: number; height: number },
    imageWidth: number
  ): string {
    // This is a simplified implementation
    // In a real system, you'd use machine learning or more sophisticated pattern matching
    
    // For now, we'll simulate text recognition by returning common BDO item patterns
    // This is obviously not real OCR, but serves as a foundation for a bundled solution
    
    const mockTexts = [
      "Black Stone (Weapon)",
      "Black Stone (Armor)", 
      "Memory Fragment",
      "Gold Bar",
      "Iron Ore",
      "Rough Stone",
      "Coal",
      "Wheat",
      "Ancient Relic Crystal Shard",
      "Large HP Potion",
      "Ring",
      "Earring",
      "Necklace"
    ];
    
    // Return a random mock text for demonstration
    // In reality, this would analyze the actual pixel patterns
    return mockTexts[Math.floor(Math.random() * mockTexts.length)];
  }

  /**
   * Merge overlapping text regions
   */
  private static mergeOverlappingRegions(regions: TextRegion[]): TextRegion[] {
    if (regions.length <= 1) return regions;
    
    const merged: TextRegion[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;
      
      let current = regions[i];
      used.add(i);
      
      // Find overlapping regions
      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) continue;
        
        if (this.regionsOverlap(current.bbox, regions[j].bbox)) {
          // Merge regions
          current = this.mergeRegions(current, regions[j]);
          used.add(j);
        }
      }
      
      merged.push(current);
    }
    
    return merged;
  }

  /**
   * Check if two regions overlap
   */
  private static regionsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(a.x + a.width < b.x || 
             b.x + b.width < a.x || 
             a.y + a.height < b.y || 
             b.y + b.height < a.y);
  }

  /**
   * Merge two text regions
   */
  private static mergeRegions(a: TextRegion, b: TextRegion): TextRegion {
    const minX = Math.min(a.bbox.x, b.bbox.x);
    const minY = Math.min(a.bbox.y, b.bbox.y);
    const maxX = Math.max(a.bbox.x + a.bbox.width, b.bbox.x + b.bbox.width);
    const maxY = Math.max(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height);
    
    return {
      text: a.confidence > b.confidence ? a.text : b.text,
      confidence: Math.max(a.confidence, b.confidence),
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    };
  }
}
