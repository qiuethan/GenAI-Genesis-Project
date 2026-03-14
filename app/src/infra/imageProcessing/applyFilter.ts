import { Skia } from '@shopify/react-native-skia';

export type FilterType = 'none' | 'vivid' | 'dramatic' | 'mono' | 'silvertone' | 'noir';

// Color matrices for different filters (5x4 matrix format for Skia)
const FILTER_MATRICES: Record<FilterType, number[] | null> = {
  none: null,
  
  // Vivid: increased saturation and slight warmth
  vivid: [
    1.2, 0.1, 0, 0, 0,
    0, 1.2, 0.1, 0, 0,
    0, 0, 1.0, 0, 0,
    0, 0, 0, 1, 0,
  ],
  
  // Dramatic: high contrast, slightly desaturated cool tones
  dramatic: [
    1.1, 0, 0, 0, -0.1,
    0, 1.1, 0, 0, -0.1,
    0, 0, 1.2, 0, -0.1,
    0, 0, 0, 1, 0,
  ],
  
  // Mono: standard grayscale using luminance weights
  mono: [
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0, 0, 0, 1, 0,
  ],
  
  // Silvertone: grayscale with higher contrast and slight brightness
  silvertone: [
    0.35, 0.65, 0.13, 0, 0.05,
    0.35, 0.65, 0.13, 0, 0.05,
    0.35, 0.65, 0.13, 0, 0.05,
    0, 0, 0, 1, 0,
  ],
  
  // Noir: high contrast grayscale with deep blacks
  noir: [
    0.4, 0.7, 0.15, 0, -0.15,
    0.4, 0.7, 0.15, 0, -0.15,
    0.4, 0.7, 0.15, 0, -0.15,
    0, 0, 0, 1, 0,
  ],
};

/**
 * Apply a color filter to an image using Skia
 * @param inputUri - URI of the input image (file:// path)
 * @param filter - Filter type to apply
 * @returns Base64 data URI of the processed image, or original URI if filter is none
 */
export const applyFilter = async (
  inputUri: string,
  filter: FilterType
): Promise<string> => {
  // If no filter, return original
  if (filter === 'none' || !FILTER_MATRICES[filter]) {
    return inputUri;
  }

  try {
    // Read the image data from URI
    const imageData = await Skia.Data.fromURI(inputUri);
    const image = Skia.Image.MakeImageFromEncoded(imageData);
    
    if (!image) {
      console.warn('Failed to decode image for filter');
      return inputUri;
    }

    const width = image.width();
    const height = image.height();

    // Create a surface to draw on
    const surface = Skia.Surface.Make(width, height);
    if (!surface) {
      console.warn('Failed to create Skia surface');
      return inputUri;
    }

    const canvas = surface.getCanvas();
    
    // Create color filter from matrix
    const matrix = FILTER_MATRICES[filter]!;
    const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
    
    // Create paint with color filter
    const paint = Skia.Paint();
    paint.setColorFilter(colorFilter);
    
    // Draw the image with the filter applied
    canvas.drawImage(image, 0, 0, paint);
    
    // Get the result as an image snapshot
    const snapshot = surface.makeImageSnapshot();
    if (!snapshot) {
      console.warn('Failed to create snapshot');
      return inputUri;
    }
    
    // Encode to base64 JPEG
    const encoded = snapshot.encodeToBase64();
    if (!encoded) {
      console.warn('Failed to encode filtered image');
      return inputUri;
    }
    
    // Return as data URI
    return `data:image/jpeg;base64,${encoded}`;
  } catch (error) {
    console.error('Error applying filter:', error);
    return inputUri;
  }
};

/**
 * Get the color matrix for a filter type
 */
export const getFilterMatrix = (filter: FilterType): number[] | null => {
  return FILTER_MATRICES[filter];
};
