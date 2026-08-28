export const MAX_CAPTURE_DIMENSION = 2048;
export const MAX_CAPTURE_PIXELS = 4_000_000;

export type ProjectPreviewCapture = () => Promise<Blob>;
export type RegisterProjectPreviewCapture = (capture: ProjectPreviewCapture | null) => void;

export function scaledVisibleCanvasRegion(input: {
  canvasWidth: number; canvasHeight: number; canvasClientWidth: number; canvasClientHeight: number;
  canvasOffsetLeft: number; canvasOffsetTop: number; scrollLeft: number; scrollTop: number;
  viewportWidth: number; viewportHeight: number;
}) {
  const scaleX = input.canvasWidth / input.canvasClientWidth;
  const scaleY = input.canvasHeight / input.canvasClientHeight;
  const left = Math.max(0, input.scrollLeft - input.canvasOffsetLeft);
  const top = Math.max(0, input.scrollTop - input.canvasOffsetTop);
  return {
    x: left * scaleX,
    y: top * scaleY,
    width: Math.min(input.canvasClientWidth - left, input.viewportWidth) * scaleX,
    height: Math.min(input.canvasClientHeight - top, input.viewportHeight) * scaleY,
  };
}

export function hasVisiblePixelVariation(pixels: Uint8ClampedArray): boolean {
  if (pixels.length < 8) return false;
  const [red, green, blue, alpha] = pixels;
  for (let index = 4; index < pixels.length; index += 4) {
    if (Math.abs(pixels[index]! - red!) > 2 || Math.abs(pixels[index + 1]! - green!) > 2 || Math.abs(pixels[index + 2]! - blue!) > 2 || Math.abs(pixels[index + 3]! - alpha!) > 2) return true;
  }
  // A uniform colored viewport is valid content; only the renderer's known
  // empty white/transparent clear is considered blank.
  return alpha! > 8 && (red! < 250 || green! < 250 || blue! < 250);
}

export function boundedCaptureSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("The preview is not ready to capture.");
  }
  const scale = Math.min(
    1,
    MAX_CAPTURE_DIMENSION / width,
    MAX_CAPTURE_DIMENSION / height,
    Math.sqrt(MAX_CAPTURE_PIXELS / (width * height)),
  );
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function canvasToBoundedPng(source: HTMLCanvasElement): Promise<Blob> {
  return canvasRegionToBoundedPng(source, 0, 0, source.width, source.height);
}

export async function canvasRegionToBoundedPng(source: HTMLCanvasElement, sourceX: number, sourceY: number, sourceWidth: number, sourceHeight: number): Promise<Blob> {
  const size = boundedCaptureSize(sourceWidth, sourceHeight);
  const output = document.createElement("canvas");
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext("2d", { alpha: false });
  if (!context) throw new Error("The preview renderer could not be captured.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  let pixels: Uint8ClampedArray;
  try {
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
    // Pixel access forces browsers to reject a tainted canvas before upload.
    pixels = context.getImageData(0, 0, output.width, output.height).data;
  } catch {
    throw new Error("This preview contains content that the browser cannot capture safely.");
  }
  if (!hasVisiblePixelVariation(pixels)) throw new Error("The preview produced a blank image. Reposition it and try again.");
  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
  if (!blob || blob.size === 0) throw new Error("The preview produced a blank image. Reposition it and try again.");
  return blob;
}
