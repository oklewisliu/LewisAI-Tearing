/**
 * Calculates the difference between two image data objects.
 * Used for scene detection.
 */
export const calculateFrameDifference = (
  data1: Uint8ClampedArray,
  data2: Uint8ClampedArray
): number => {
  let diff = 0;
  // Skip pixels to improve performance (check every 4th pixel)
  for (let i = 0; i < data1.length; i += 4 * 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
    diff += rDiff + gDiff + bDiff;
  }
  return diff / (data1.length / 4);
};

/**
 * Applies a "Pencil Sketch" effect to an image URL.
 * Algorithm: Grayscale -> Invert -> Blur -> Color Dodge Blend.
 */
export const applySketchEffect = (
  imageUrl: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // 1. Draw original
      ctx.drawImage(img, 0, 0);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Get raw data
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Create separate buffers for processing
      // We need a grayscale buffer and an inverted buffer
      const grayData = new Float32Array(width * height);
      
      // 2. Grayscale & Invert
      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayData[i / 4] = gray;
      }

      // 3. Gaussian Blur on the Inverted Grayscale
      // We simulate a blur by simple box blur for performance or a small kernel
      // For a better sketch effect, we need a decent blur. 
      // Let's do a simple 2-pass box blur or kernel blur.
      const blurRadius = 4;
      const blurredGray = boxBlur(grayData, width, height, blurRadius);

      // 4. Color Dodge Blend (Base: Grayscale, Blend: Inverted Blurred)
      // Actually, standard sketch algo:
      // Base = Grayscale
      // Blend = Inverted(Blurred(Inverted(Grayscale))) ?? 
      // Simpler: 
      // Top Layer = Invert(Grayscale) -> Blur
      // Bottom Layer = Grayscale
      // Mode = Color Dodge
      
      // Let's try: Result = Base / (1 - Blend)
      // Where Base = Gray, Blend = Blur(Invert(Gray))
      
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const base = grayData[pixelIndex];
        
        // Invert the blurred gray
        const blend = 255 - blurredGray[pixelIndex];
        
        // Color Dodge
        let result = 0;
        if (blend === 255) {
            result = 255;
        } else {
            result = Math.min(255, (base * 255) / (255 - blend));
        }
        
        // Contrast boost for "Pencil" look
        // result = (result - 128) * 1.5 + 128; // Optional contrast
        
        // Make it black and white
        data[i] = result;     // R
        data[i + 1] = result; // G
        data[i + 2] = result; // B
        // Alpha remains same
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};

// Simple fast box blur for single channel float array
function boxBlur(data: Float32Array, w: number, h: number, radius: number): Float32Array {
  const output = new Float32Array(data.length);
  // This is a very simplified blur (horizontal only + vertical only would be better but expensive)
  // For sketch effect, even a simple averaging works.
  // We'll do a simple O(N) separable blur.
  
  const temp = new Float32Array(data.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
          let sum = 0;
          let count = 0;
          for (let k = -radius; k <= radius; k++) {
              const px = Math.min(w - 1, Math.max(0, x + k));
              sum += data[y * w + px];
              count++;
          }
          temp[y * w + x] = sum / count;
      }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
          let sum = 0;
          let count = 0;
          for (let k = -radius; k <= radius; k++) {
              const py = Math.min(h - 1, Math.max(0, y + k));
              sum += temp[py * w + x];
              count++;
          }
          output[y * w + x] = sum / count;
      }
  }
  
  return output;
}
