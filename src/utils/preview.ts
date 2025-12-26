import sharp from 'sharp';
import { readFileSync } from 'fs';

// ASCII/Unicode block characters for different "brightness" levels
const BLOCKS = {
  // Using quarter blocks for better resolution
  full: '█',
  dark: '▓',
  medium: '▒',
  light: '░',
  empty: ' '
};

// Braille-based rendering for even higher resolution
// Each braille character represents a 2x4 grid of dots
const BRAILLE_BASE = 0x2800;

/**
 * Detect if running in iTerm2
 */
export function isITerm2(): boolean {
  return process.env.TERM_PROGRAM === 'iTerm.app' ||
         process.env.LC_TERMINAL === 'iTerm2';
}

/**
 * Detect if running in a terminal that supports Kitty graphics protocol
 */
export function isKitty(): boolean {
  return process.env.TERM === 'xterm-kitty';
}

/**
 * Convert SVG to ASCII art using block characters
 */
export async function svgToAscii(
  svgPath: string,
  width: number = 32,
  height?: number
): Promise<string> {
  try {
    const svgBuffer = readFileSync(svgPath);

    // Get SVG dimensions to calculate proper aspect ratio
    const metadata = await sharp(svgBuffer).metadata();
    const svgWidth = metadata.width || 32;
    const svgHeight = metadata.height || 32;
    const aspectRatio = svgHeight / svgWidth;

    // Terminal characters are ~2x taller than wide, so we halve the height
    const cellAspectRatio = 2;
    const calculatedHeight = height || Math.max(1, Math.round(width * aspectRatio / cellAspectRatio));

    // Render SVG to grayscale PNG
    const { data, info } = await sharp(svgBuffer)
      .resize(width, calculatedHeight, { fit: 'fill', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const lines: string[] = [];

    for (let y = 0; y < info.height; y++) {
      let line = '';
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // If transparent, use empty space
        if (a < 50) {
          line += BLOCKS.empty;
          continue;
        }

        // Calculate brightness (0-255)
        const brightness = (r + g + b) / 3;

        // Map brightness to block character (inverted: dark pixels = full blocks)
        if (brightness < 64) {
          line += BLOCKS.full;
        } else if (brightness < 128) {
          line += BLOCKS.dark;
        } else if (brightness < 192) {
          line += BLOCKS.medium;
        } else if (brightness < 240) {
          line += BLOCKS.light;
        } else {
          line += BLOCKS.empty;
        }
      }
      lines.push(line);
    }

    return lines.join('\n');
  } catch (error) {
    return `[Preview unavailable: ${error}]`;
  }
}

/**
 * Convert SVG to higher-resolution braille art
 */
export async function svgToBraille(
  svgPath: string,
  width: number = 64,
  height?: number
): Promise<string> {
  try {
    const svgBuffer = readFileSync(svgPath);

    // Get SVG dimensions to calculate proper aspect ratio
    const metadata = await sharp(svgBuffer).metadata();
    const svgWidth = metadata.width || 32;
    const svgHeight = metadata.height || 32;
    const aspectRatio = svgHeight / svgWidth;

    // Terminal characters are ~2x taller than wide, so we halve the height
    const cellAspectRatio = 2;
    const calculatedHeight = height || Math.max(1, Math.round(width * aspectRatio / cellAspectRatio));

    // Render SVG - braille chars are 2x4, so we need width*2 x height*4 pixels
    const pixelWidth = width * 2;
    const pixelHeight = calculatedHeight * 4;

    const { data, info } = await sharp(svgBuffer)
      .resize(pixelWidth, pixelHeight, { fit: 'fill', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const lines: string[] = [];

    // Process in 2x4 blocks for each braille character
    for (let charY = 0; charY < calculatedHeight; charY++) {
      let line = '';
      for (let charX = 0; charX < width; charX++) {
        let brailleValue = 0;

        // Braille dot positions:
        // 0 3
        // 1 4
        // 2 5
        // 6 7
        const dotOffsets = [
          [0, 0, 0x01], [0, 1, 0x02], [0, 2, 0x04], [0, 3, 0x40],
          [1, 0, 0x08], [1, 1, 0x10], [1, 2, 0x20], [1, 3, 0x80]
        ];

        for (const [dx, dy, bit] of dotOffsets) {
          const px = charX * 2 + dx;
          const py = charY * 4 + dy;

          if (px >= info.width || py >= info.height) continue;

          const idx = (py * info.width + px) * 4;
          const a = data[idx + 3];
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

          // Mark dot if pixel is dark and opaque
          if (a > 100 && brightness < 180) {
            brailleValue |= bit;
          }
        }

        line += String.fromCharCode(BRAILLE_BASE + brailleValue);
      }
      lines.push(line);
    }

    return lines.join('\n');
  } catch (error) {
    return `[Braille preview unavailable: ${error}]`;
  }
}

/**
 * Display image inline in iTerm2 using its proprietary escape sequence
 * @param svgPath - Path to SVG file
 * @param pixelSize - Size to render the PNG at (for quality)
 * @param displayWidth - Number of terminal character cells wide to display
 */
export async function displayInITerm2(
  svgPath: string,
  pixelSize: number = 400,
  displayWidth: number = 16
): Promise<string> {
  try {
    const svgBuffer = readFileSync(svgPath);

    // Get the original SVG dimensions to calculate aspect ratio
    const metadata = await sharp(svgBuffer).metadata();
    const svgWidth = metadata.width || 32;
    const svgHeight = metadata.height || 32;
    const aspectRatio = svgHeight / svgWidth;

    // Calculate display height based on aspect ratio
    // Terminal cells are roughly 2:1 (height:width), so we adjust
    const cellAspectRatio = 2; // terminal characters are ~twice as tall as wide
    const displayHeight = Math.max(1, Math.round(displayWidth * aspectRatio / cellAspectRatio));

    // Convert SVG to PNG at high resolution for quality
    const pngBuffer = await sharp(svgBuffer)
      .resize(pixelSize, Math.round(pixelSize * aspectRatio), { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    const base64 = pngBuffer.toString('base64');

    // iTerm2 inline image protocol
    // OSC 1337 ; File=[args] : base64data ST
    // width/height can be specified in cells (N), pixels (Npx), percent (N%), or auto
    const args = `inline=1;width=${displayWidth};height=${displayHeight};preserveAspectRatio=1`;

    return `\x1b]1337;File=${args}:${base64}\x07`;
  } catch (error) {
    return `[iTerm2 preview unavailable: ${error}]`;
  }
}

/**
 * Get the best available preview for the current terminal
 */
export async function getPreview(
  svgPath: string,
  options: { ascii?: boolean; braille?: boolean; width?: number } = {}
): Promise<{ type: 'iterm2' | 'braille' | 'ascii'; content: string }> {

  // Check for iTerm2 first (best quality)
  if (!options.ascii && !options.braille && isITerm2()) {
    const displayWidth = options.width || 16;
    const content = await displayInITerm2(svgPath, 400, displayWidth);
    return { type: 'iterm2', content };
  }

  // Braille gives higher resolution than ASCII blocks
  if (options.braille || (!options.ascii && !isITerm2())) {
    const content = await svgToBraille(svgPath, options.width || 40);
    return { type: 'braille', content };
  }

  // ASCII block fallback
  const content = await svgToAscii(svgPath, options.width || 32);
  return { type: 'ascii', content };
}
