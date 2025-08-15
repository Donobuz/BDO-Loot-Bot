import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface OCRResult {
    success: boolean;
    results?: Array<{
        text: string;
        confidence: number;
        bbox: number[][];
    }>;
    error?: string;
}

export class PortableOCR {
    private pythonPath: string;
    private ocrScriptPath: string;
    private isInitialized: boolean;

    constructor() {
        this.isInitialized = false;
        this.pythonPath = this.getPythonExecutable();
        this.ocrScriptPath = this.getOCRScriptPath();
    }

    private getPythonExecutable(): string {
        const platform = process.platform;
        const appPath = app ? app.getAppPath() : __dirname;
        const pythonDir = path.join(appPath, 'resources', 'python');

        if (platform === 'win32') {
            return path.join(pythonDir, 'python.exe');
        } else {
            return path.join(pythonDir, 'bin', 'python3');
        }
    }

    private getOCRScriptPath(): string {
        const appPath = app ? app.getAppPath() : __dirname;
        return path.join(appPath, 'resources', 'scripts', 'ocr_worker.py');
    }

    public async initialize(): Promise<boolean> {
        try {
            // Check if Python executable exists
            if (!fs.existsSync(this.pythonPath)) {
                console.error('Python executable not found at:', this.pythonPath);
                return false;
            }

            // Check if OCR script exists
            if (!fs.existsSync(this.ocrScriptPath)) {
                console.error('OCR script not found at:', this.ocrScriptPath);
                return false;
            }

            // Test OCR initialization
            const testResult = await this.testOCREngine();
            this.isInitialized = testResult;
            
            return this.isInitialized;
        } catch (error) {
            console.error('Failed to initialize OCR engine:', error);
            return false;
        }
    }

    private async testOCREngine(): Promise<boolean> {
        return new Promise((resolve) => {
            const process = spawn(this.pythonPath, [this.ocrScriptPath, '--test'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                try {
                    const result = JSON.parse(output);
                    resolve(result.success === true);
                } catch {
                    resolve(false);
                }
            });

            process.on('error', () => {
                resolve(false);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                process.kill();
                resolve(false);
            }, 10000);
        });
    }

    public async recognizeText(imagePath: string): Promise<OCRResult> {
        if (!this.isInitialized) {
            const initSuccess = await this.initialize();
            if (!initSuccess) {
                return {
                    success: false,
                    error: 'OCR engine not initialized'
                };
            }
        }

        return new Promise((resolve) => {
            const process = spawn(this.pythonPath, [this.ocrScriptPath, imagePath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let result = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                result += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const parsed = JSON.parse(result);
                        resolve(parsed);
                    } catch (parseError) {
                        resolve({
                            success: false,
                            error: `Failed to parse OCR result: ${parseError}`
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        error: `OCR process failed with code ${code}: ${errorOutput}`
                    });
                }
            });

            process.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Failed to start OCR process: ${error.message}`
                });
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                process.kill();
                resolve({
                    success: false,
                    error: 'OCR process timed out'
                });
            }, 30000);
        });
    }

    public async recognizeTextFromBuffer(imageBuffer: Buffer): Promise<OCRResult> {
        // Create temporary file
        const tempDir = path.join(require('os').tmpdir(), 'bdo-loot-bot');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `ocr_${Date.now()}.png`);
        
        try {
            fs.writeFileSync(tempFile, imageBuffer);
            const result = await this.recognizeText(tempFile);
            
            // Clean up temp file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            
            return result;
        } catch (error) {
            return {
                success: false,
                error: `Failed to process image buffer: ${error}`
            };
        }
    }

    public isReady(): boolean {
        return this.isInitialized;
    }
}
