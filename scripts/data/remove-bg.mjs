// Blueprinted & built by Claudesy.
/**
 * Remove white background from PKM logo
 * Converts JPG to PNG with transparent background
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, '../public/pkm.jpg');
const outputPath = path.join(__dirname, '../public/pkm.png');

async function removeWhiteBackground() {
  try {
    // Read the image
    const image = sharp(inputPath);
    const { width, height } = await image.metadata();

    // Get raw pixel data
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Debug: sample some pixel values
    console.log('Sample pixels from center area:');
    const centerY = Math.floor(info.height / 2);
    const centerX = Math.floor(info.width / 2);
    for (let dy = -5; dy <= 5; dy++) {
      const idx = ((centerY + dy) * info.width + centerX) * 4;
      console.log(`  Pixel [${centerX}, ${centerY + dy}]: R=${data[idx]}, G=${data[idx+1]}, B=${data[idx+2]}, A=${data[idx+3]}`);
    }

    // Process pixels - remove white/light pixels
    let removed = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Remove if pixel is white/near-white (all channels > 250)
      if (r > 250 && g > 250 && b > 250) {
        data[i + 3] = 0;
        removed++;
      }
    }
    console.log(`Removed ${removed} white pixels`);

    // Save as PNG with transparency
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
      .png()
      .toFile(outputPath);

    console.log(`✓ Created ${outputPath} with transparent background`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

removeWhiteBackground();
