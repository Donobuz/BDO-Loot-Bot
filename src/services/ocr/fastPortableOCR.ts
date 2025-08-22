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

export class FastPortableOCR {
    private pythonPath: string;
    private ocrScriptPath: string;
    private isInitialized: boolean;

    constructor() {
        this.isInitialized = false;
        this.pythonPath = this.getPythonExecutable();
        this.ocrScriptPath = this.getFastOCRScriptPath();
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

    private getFastOCRScriptPath(): string {
        const appPath = app ? app.getAppPath() : __dirname;
        return path.join(appPath, 'resources', 'scripts', 'fast_ocr_worker.py');
    }

    public async initialize(): Promise<boolean> {
        try {
            console.log('🚀 Initializing Fast OCR engine...');
            console.log('Python path:', this.pythonPath);
            console.log('Fast OCR script path:', this.ocrScriptPath);
            
            // Check if Python executable exists
            if (!fs.existsSync(this.pythonPath)) {
                console.error('❌ Python executable not found at:', this.pythonPath);
                return false;
            }

            // Check if fast OCR script exists
            if (!fs.existsSync(this.ocrScriptPath)) {
                console.error('❌ Fast OCR script not found at:', this.ocrScriptPath);
                // Fall back to original OCR script
                this.ocrScriptPath = path.join(path.dirname(this.ocrScriptPath), 'ocr_worker.py');
                if (!fs.existsSync(this.ocrScriptPath)) {
                    console.error('❌ No OCR script found');
                    return false;
                }
            }

            // Test fast OCR initialization
            console.log('🔄 Testing Fast OCR engine...');
            const testResult = await this.testOCREngine();
            
            this.isInitialized = testResult;
            
            if (this.isInitialized) {
                console.log('✅ Fast OCR engine ready!');
            } else {
                console.error('❌ Fast OCR engine failed to initialize');
            }
            
            return this.isInitialized;
        } catch (error) {
            console.error('❌ Failed to initialize Fast OCR engine:', error);
            return false;
        }
    }

    private async testOCREngine(): Promise<boolean> {
        return new Promise((resolve) => {
            const process = spawn(this.pythonPath, [this.ocrScriptPath, '--test'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result.success === true);
                    } catch (parseError) {
                        console.error('Failed to parse test result:', parseError);
                        resolve(false);
                    }
                } else {
                    console.error('Fast OCR test failed:', errorOutput);
                    resolve(false);
                }
            });

            process.on('error', (error) => {
                console.error('Fast OCR test process error:', error);
                resolve(false);
            });

            // Timeout after 10 seconds for initialization
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
                    error: 'Fast OCR engine not initialized'
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
                        error: `Fast OCR process failed with code ${code}: ${errorOutput}`
                    });
                }
            });

            process.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Failed to start Fast OCR process: ${error.message}`
                });
            });

            // Much shorter timeout for fast OCR - 3 seconds max
            const timeout = setTimeout(() => {
                if (!process.killed) {
                    console.log('Fast OCR timed out after 3s, killing...');
                    process.kill('SIGTERM');
                    setTimeout(() => {
                        if (!process.killed) {
                            process.kill('SIGKILL');
                        }
                    }, 1000);
                }
                resolve({
                    success: false,
                    error: 'Fast OCR process timed out'
                });
            }, 3000); // 3 seconds for fast processing
            
            process.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    public async recognizeTextFromBuffer(imageBuffer: Buffer): Promise<OCRResult> {
        // Create temporary file
        const tempDir = path.join(require('os').tmpdir(), 'bdo-loot-bot');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `fast_ocr_${Date.now()}.png`);
        
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
