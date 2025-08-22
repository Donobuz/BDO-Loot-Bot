import { screen, desktopCapturer } from 'electron';
import sharp from 'sharp';

export interface CaptureRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    display?: string;
}

export interface CaptureResult {
    success: boolean;
    buffer?: Buffer;
    error?: string;
}

export class ScreenCapture {
    private static instance: ScreenCapture;

    public static getInstance(): ScreenCapture {
        if (!ScreenCapture.instance) {
            ScreenCapture.instance = new ScreenCapture();
        }
        return ScreenCapture.instance;
    }

    public async captureRegion(region: CaptureRegion): Promise<CaptureResult> {
        try {
            // Get all displays
            const displays = screen.getAllDisplays();
            let targetDisplay = displays[0]; // Default to primary display

            // If display is specified, find the matching display
            if (region.display) {
                const foundDisplay = displays.find(d => d.id.toString() === region.display);
                if (foundDisplay) {
                    targetDisplay = foundDisplay;
                }
            }

            // Validate region bounds
            const maxX = targetDisplay.bounds.width - region.width;
            const maxY = targetDisplay.bounds.height - region.height;

            if (region.x < 0 || region.y < 0 || region.x > maxX || region.y > maxY) {
                return {
                    success: false,
                    error: `Region bounds invalid. Region: ${region.x},${region.y} ${region.width}x${region.height}, Display: ${targetDisplay.bounds.width}x${targetDisplay.bounds.height}`
                };
            }

            // Capture the entire screen first (required by Electron's desktopCapturer)
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: {
                    width: targetDisplay.bounds.width,
                    height: targetDisplay.bounds.height
                }
            });

            if (sources.length === 0) {
                return {
                    success: false,
                    error: 'No screen sources available'
                };
            }

            // Find the source that matches our target display
            let targetSource = sources[0];
            if (region.display) {
                const foundSource = sources.find(source =>
                    source.display_id === region.display
                );
                if (foundSource) {
                    targetSource = foundSource;
                }
            }

            // Get the full screen buffer and crop to the specified region
            const fullScreenBuffer = targetSource.thumbnail.toPNG();

            // Crop the image to the exact specified region using Sharp
            const croppedBuffer = await sharp(fullScreenBuffer)
                .extract({
                    left: region.x,
                    top: region.y,
                    width: region.width,
                    height: region.height
                })
                .png()
                .toBuffer();

            return {
                success: true,
                buffer: croppedBuffer
            };

        } catch (error) {
            console.error('Region capture failed:', error);
            return {
                success: false,
                error: `Region capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }



    public getAvailableDisplays() {
        return screen.getAllDisplays().map(display => ({
            id: display.id.toString(),
            bounds: display.bounds,
            workArea: display.workArea,
            scaleFactor: display.scaleFactor,
            rotation: display.rotation,
            primary: display.bounds.x === 0 && display.bounds.y === 0
        }));
    }
}