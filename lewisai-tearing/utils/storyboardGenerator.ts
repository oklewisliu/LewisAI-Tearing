import { Keyframe } from '../types';

/**
 * Generates storyboard pages (images) from a list of keyframes.
 * Layout: 4 columns x 3 rows grid (12 frames per page).
 * Style: Hand-drawn aesthetic.
 */
export const generateStoryboardImages = async (
  frames: Keyframe[], 
  projectName: string = "Storyboard Project"
): Promise<string[]> => {
  const pages: string[] = [];
  const framesPerPage = 12; // 4 cols * 3 rows
  const cols = 4;
  const rows = 3;

  // Canvas Settings (A4 Landscape-ish high res)
  const canvasWidth = 2480; 
  const canvasHeight = 1754;
  const padding = 60;
  const headerHeight = 100;
  
  // Grid Calculation
  const gridWidth = canvasWidth - (padding * 2);
  const gridHeight = canvasHeight - (padding * 2) - headerHeight;
  
  const cellGapX = 40;
  const cellGapY = 50;
  
  const cellWidth = (gridWidth - (cellGapX * (cols - 1))) / cols;
  const cellHeight = (gridHeight - (cellGapY * (rows - 1))) / rows;
  
  // Image area inside cell (keep 16:9 aspect ratio usually, or fit available)
  // We leave space at bottom of cell for text
  const textAreaHeight = 160; 
  const imageAreaHeight = cellHeight - textAreaHeight;
  const imageWidth = cellWidth;
  
  // Font
  const fontMain = "24px 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif";
  const fontHeader = "bold 48px 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif";
  const fontNumber = "bold 32px 'Patrick Hand', 'Comic Sans MS', cursive, sans-serif";

  // Helper to load image
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  // Process pages
  for (let i = 0; i < frames.length; i += framesPerPage) {
    const pageFrames = frames.slice(i, i + framesPerPage);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) continue;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Header
    ctx.fillStyle = '#000000';
    ctx.font = fontHeader;
    ctx.textAlign = 'left';
    ctx.fillText(`${projectName} - Page ${Math.floor(i/framesPerPage) + 1}`, padding, 70);
    
    ctx.beginPath();
    ctx.moveTo(padding, 85);
    ctx.lineTo(canvasWidth - padding, 85);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Draw Frames
    for (let j = 0; j < pageFrames.length; j++) {
      const frame = pageFrames[j];
      const col = j % cols;
      const row = Math.floor(j / cols);
      
      const x = padding + col * (cellWidth + cellGapX);
      const y = padding + headerHeight + row * (cellHeight + cellGapY);

      // Draw Box Border (Hand-drawn style - simple rect for now, could be shaky)
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(x, y, imageWidth, imageAreaHeight);

      // Draw Image
      try {
        const img = await loadImage(frame.imageUrl);
        // Cover fit logic
        const imgAspect = img.width / img.height;
        const boxAspect = imageWidth / imageAreaHeight;
        
        let drawW = imageWidth;
        let drawH = imageAreaHeight;
        let offX = 0;
        let offY = 0;

        if (imgAspect > boxAspect) {
             // Image is wider than box
             drawW = imageAreaHeight * imgAspect;
             offX = (imageWidth - drawW) / 2;
        } else {
             // Image is taller than box
             drawH = imageWidth / imgAspect;
             offY = (imageAreaHeight - drawH) / 2;
        }
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, imageWidth, imageAreaHeight);
        ctx.clip();
        ctx.drawImage(img, x + offX, y + offY, drawW, drawH);
        ctx.restore();
        
      } catch (e) {
        console.error("Failed to load image for storyboard", e);
      }

      // Shot Number (Top Left of box, slightly outside or inside)
      // Let's put it top left outside like the reference
      ctx.fillStyle = '#000000';
      ctx.font = fontNumber;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText((i + j + 1).toString(), x - 5, y - 5);

      // Caption Text (Below box)
      const captionY = y + imageAreaHeight + 25;
      const captionText = frame.caption || "待补充...";
      
      ctx.font = fontMain;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      // Word Wrap
      wrapText(ctx, captionText, x, captionY, imageWidth, 28);
    }

    pages.push(canvas.toDataURL('image/jpeg', 0.8));
  }

  return pages;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(''); // Split by char for Chinese/English mix
    let line = '';
    let testLine = '';
    let lineCount = 0;
    
    // Quick accumulation for efficiency
    for(let n = 0; n < text.length; n++) {
        testLine = line + text[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = text[n];
            y += lineHeight;
            lineCount++;
            if (lineCount > 4) break; // Limit lines
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}
