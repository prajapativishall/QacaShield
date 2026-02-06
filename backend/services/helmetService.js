import fs from "fs/promises";
import path from "path";
import { Jimp } from "jimp";

/**
 * Simulates a Helmet Detection Service using Basic Image Analysis.
 * 
 * Logic:
 * 1. Analyzes the upper region of the image (where a helmet should be).
 * 2. Checks for "Helmet-like" characteristics:
 *    - High Brightness (White/Yellow helmets)
 *    - Significant deviation from skin tones.
 * 3. REJECTS if:
 *    - The area is too dark (Dark hair).
 *    - The area matches skin tone ranges (Exposed forehead).
 */
export async function detectHelmet(imagePath) {
  try {
    // 1. Load the image
    const image = await Jimp.read(imagePath);
    
    // Resize to max width 800px to speed up processing and avoid memory issues
    if (image.bitmap.width > 800) {
        image.resize({ w: 800 });
    }

    // 2. Define the Region of Interest (ROI): Top 25% of the image, centered horizontally
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // Crop to the "Head/Helmet" area
    const roiWidth = Math.floor(width * 0.4); // Middle 40% width
    const roiHeight = Math.floor(height * 0.25); // Top 25% height
    const roiX = Math.floor((width - roiWidth) / 2);
    const roiY = 0; // Start from top
    
    const roi = image.clone().crop({ x: roiX, y: roiY, w: roiWidth, h: roiHeight });

    // 3. Analyze Pixels in ROI
    let totalR = 0, totalG = 0, totalB = 0;
    let skinPixels = 0;
    let darkPixels = 0;
    let brightPixels = 0;
    let totalEdgeScore = 0; // For texture analysis (Smooth vs Rough)
    
    const pixelCount = roiWidth * roiHeight;

    // Scan pixels
    for (let y = 0; y < roiHeight; y++) {
      for (let x = 0; x < roiWidth; x++) {
        const pixel = roi.getPixelColor(x, y);
        // Manual conversion: 0xRRGGBBAA
        const r = (pixel >>> 24) & 0xFF;
        const g = (pixel >>> 16) & 0xFF;
        const b = (pixel >>> 8) & 0xFF;
        const gray = (r + g + b) / 3;

        // Texture/Roughness Analysis (Compare with neighbors)
        if (x < roiWidth - 1 && y < roiHeight - 1) {
            const pixelNext = roi.getPixelColor(x + 1, y);
            const rN = (pixelNext >>> 24) & 0xFF;
            const gN = (pixelNext >>> 16) & 0xFF;
            const bN = (pixelNext >>> 8) & 0xFF;
            const grayNext = (rN + gN + bN) / 3;

            const pixelDown = roi.getPixelColor(x, y + 1);
            const rD = (pixelDown >>> 24) & 0xFF;
            const gD = (pixelDown >>> 16) & 0xFF;
            const bD = (pixelDown >>> 8) & 0xFF;
            const grayDown = (rD + gD + bD) / 3;

            totalEdgeScore += Math.abs(gray - grayNext) + Math.abs(gray - grayDown);
        }

        totalR += r;
        totalG += g;
        totalB += b;

        // Simple Skin Tone Detection Rule (approximation)
        // R > 60, G > 40, B > 20, R > G, R > B, |R-G| > 15
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
          skinPixels++;
        }

        // Dark Hair Detection (Low brightness)
        // Average < 60
        if (gray < 60) {
          darkPixels++;
        }
        
        // Bright Helmet Detection (White/Yellow/Orange)
        // High brightness > 180 (lowered slightly from 200)
        if (gray > 180) {
          brightPixels++;
        }
      }
    }

    const skinRatio = skinPixels / pixelCount;
    const darkRatio = darkPixels / pixelCount;
    const brightRatio = brightPixels / pixelCount;
    const roughness = totalEdgeScore / pixelCount; // Average edge difference

    console.log(`[Helmet Check] Skin: ${(skinRatio*100).toFixed(1)}%, Dark: ${(darkRatio*100).toFixed(1)}%, Bright: ${(brightRatio*100).toFixed(1)}%, Roughness: ${roughness.toFixed(1)}`);

    // 4. Decision Logic
    
    // Case A: Too much skin in the "Helmet" area -> Likely exposed forehead/face
    if (skinRatio > 0.15) {
       return {
        detected: false,
        confidence: 0.85,
        message: "No helmet detected. Exposed skin found in head region."
      };
    }

    // Case B: Too dark -> Likely black hair or dark background without shiny helmet
    // Refined Logic (Version 4 - Texture Aware):
    // - User Stats: Hair is "Rough" (high texture), Helmet is "Smooth" (low texture).
    // - Hair Roughness > 20 (approx), Helmet Roughness < 15.
    
    // Rule 1: Significant Dark Area (> 30%) with Low Brightness (< 5.5%)
    // If it's Dark AND Low Brightness, we check Texture.
    // If Rough -> Hair (Reject).
    // If Smooth -> Matte Helmet (Accept).
    if (darkRatio > 0.30 && brightRatio < 0.055) {
      if (roughness > 20.0) {
         return {
          detected: false,
          confidence: 0.80,
          message: "No helmet detected. Detected dark hair (rough texture)."
        };
      } else {
         // It is Dark, Low Brightness, but SMOOTH. Likely a Matte Black Helmet.
         console.log("[Helmet Check] Accepted as Matte Black Helmet (Smooth Texture).");
         return {
          detected: true,
          confidence: 0.85,
          message: "Helmet detected (Matte Black)."
        };
      }
    }

    // Rule 2: Very Dark (> 70%) regardless of brightness (unless super shiny)
    if (darkRatio > 0.70 && brightRatio < 0.15) {
      return {
        detected: false,
        confidence: 0.90,
        message: "No helmet detected. Area is too dark."
      };
    }
    
    // Case C: Brightness check (Optional but good for safety)
    // If not skin and not dark, it might be a colored helmet (Blue, Red, etc.)
    // We default to ACCEPT if it doesn't look like skin or hair.
    
    return {
      detected: true,
      confidence: 0.92,
      message: "Helmet detected successfully."
    };

  } catch (error) {
    console.error("Helmet detection service error:", error);
    // Fallback: If Jimp fails, we default to fail for safety in this strict mode
    return {
      detected: false,
      confidence: 0,
      message: "Could not analyze image quality. Please try again."
    };
  }
}
