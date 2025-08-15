const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

class DependencyBundler {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.resourcesDir = path.join(this.projectRoot, 'resources');
        this.pythonDir = path.join(this.resourcesDir, 'python');
        this.scriptsDir = path.join(this.resourcesDir, 'scripts');
    }

    async bundleAll() {
        console.log('🚀 Starting dependency bundling for BDO Loot Bot...');
        
        try {
            await this.ensureDirectories();
            await this.downloadPortablePython();
            await this.installPythonDependencies();
            await this.copyOCRScripts();
            await this.verifyInstallation();
            
            console.log('✅ All dependencies bundled successfully!');
            console.log('📦 Your app is now ready for distribution.');
        } catch (error) {
            console.error('❌ Failed to bundle dependencies:', error);
            process.exit(1);
        }
    }

    async ensureDirectories() {
        console.log('📁 Creating directory structure...');
        await fs.ensureDir(this.resourcesDir);
        await fs.ensureDir(this.pythonDir);
        await fs.ensureDir(this.scriptsDir);
    }

    async downloadPortablePython() {
        console.log('🐍 Downloading portable Python...');
        
        const platform = process.platform;
        let pythonUrl, extractCommand;

        if (platform === 'win32') {
            // Windows embeddable Python
            pythonUrl = 'https://www.python.org/ftp/python/3.11.7/python-3.11.7-embed-amd64.zip';
            extractCommand = 'powershell -command "Expand-Archive -Path python.zip -DestinationPath . -Force"';
        } else if (platform === 'linux') {
            // Portable Python for Linux
            pythonUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20231002/cpython-3.11.6+20231002-x86_64-unknown-linux-gnu-install_only.tar.gz';
            extractCommand = 'tar -xzf python.tar.gz';
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        const downloadPath = path.join(this.pythonDir, platform === 'win32' ? 'python.zip' : 'python.tar.gz');
        
        // Check if already downloaded
        if (fs.existsSync(downloadPath)) {
            console.log('Python already downloaded, skipping...');
            return;
        }

        // Download Python
        await this.downloadFile(pythonUrl, downloadPath);
        
        // Extract Python
        console.log('📦 Extracting Python...');
        execSync(extractCommand, { cwd: this.pythonDir });
        
        // Clean up archive
        await fs.remove(downloadPath);
        
        // For Windows, create get-pip.py
        if (platform === 'win32') {
            await this.setupWindowsPython();
        }
    }

    async setupWindowsPython() {
        console.log('⚙️  Setting up Windows Python environment...');
        
        // Download get-pip.py
        const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
        const getPipPath = path.join(this.pythonDir, 'get-pip.py');
        
        await this.downloadFile(getPipUrl, getPipPath);
        
        // Install pip
        const pythonExe = path.join(this.pythonDir, 'python.exe');
        execSync(`"${pythonExe}" get-pip.py`, { cwd: this.pythonDir });
        
        // Update python311._pth to include site-packages
        const pthFile = path.join(this.pythonDir, 'python311._pth');
        if (fs.existsSync(pthFile)) {
            let content = fs.readFileSync(pthFile, 'utf8');
            if (!content.includes('Lib\\site-packages')) {
                content += '\nLib\\site-packages\n';
                fs.writeFileSync(pthFile, content);
            }
        }
    }

    async installPythonDependencies() {
        console.log('📦 Installing Python dependencies...');
        
        const platform = process.platform;
        let pythonExe, pipExe;
        
        if (platform === 'win32') {
            pythonExe = path.join(this.pythonDir, 'python.exe');
            pipExe = path.join(this.pythonDir, 'Scripts', 'pip.exe');
        } else {
            pythonExe = path.join(this.pythonDir, 'bin', 'python3');
            pipExe = path.join(this.pythonDir, 'bin', 'pip3');
        }

        // Install required packages with compatible versions
        const packages = [
            'typing_extensions>=4.8.0',
            'pillow>=10.1',
            'numpy==1.26.4',  // Compatible with opencv and other packages
            'opencv-python-headless==4.8.1.78',
            'scipy==1.11.4',  // Compatible with numpy 1.26.4
            'torch==2.1.0',   // Remove +cpu suffix for better compatibility
            'torchvision==0.16.0',  // Remove +cpu suffix
            'easyocr==1.7.0',
            // HTTP/Network dependencies for EasyOCR model downloading
            'requests',
            'urllib3',
            'certifi',
            'charset-normalizer',
            'idna',
            // Additional scikit-image dependencies
            'lazy_loader',
            'tifffile',
            'networkx',
            'PyWavelets',
            'imageio',
            'packaging',
            // Additional dependencies for EasyOCR
            'ninja',
            'pyclipper',
            'python-bidi',
            'PyYAML',
            'scikit-image>=0.19.0',
            'Shapely',
            // Dependencies for torch
            'filelock',
            'fsspec',
            'jinja2',
            'MarkupSafe',
            // Additional dependencies
            'sympy',
            'mpmath'
        ];

        const sitePackages = platform === 'win32' 
            ? path.join(this.pythonDir, 'Lib', 'site-packages')
            : path.join(this.pythonDir, 'lib', 'python3.11', 'site-packages');

        await fs.ensureDir(sitePackages);

        // Install packages one by one
        for (const pkg of packages) {
            console.log(`Installing ${pkg}...`);
            try {
                const installCmd = platform === 'win32'
                    ? `"${pipExe}" install --target "${sitePackages}" ${pkg} --no-deps --no-warn-script-location`
                    : `"${pipExe}" install --target "${sitePackages}" ${pkg} --no-deps`;
                
                execSync(installCmd, { 
                    stdio: 'inherit',
                    timeout: 300000 // 5 minutes timeout
                });
            } catch (error) {
                console.warn(`Warning: Failed to install ${pkg}, trying without version constraint...`);
                const basePkg = pkg.split('==')[0];
                try {
                    const installCmd = platform === 'win32'
                        ? `"${pipExe}" install --target "${sitePackages}" ${basePkg} --no-deps --no-warn-script-location`
                        : `"${pipExe}" install --target "${sitePackages}" ${basePkg} --no-deps`;
                    
                    execSync(installCmd, { 
                        stdio: 'inherit',
                        timeout: 300000
                    });
                } catch (fallbackError) {
                    console.error(`Failed to install ${basePkg}:`, fallbackError.message);
                }
            }
        }
    }

    async copyOCRScripts() {
        console.log('📄 Copying OCR scripts...');
        
        const sourceScript = path.join(this.resourcesDir, 'scripts', 'ocr_worker.py');
        
        // Ensure the script exists
        if (!fs.existsSync(sourceScript)) {
            throw new Error('OCR worker script not found. Make sure ocr_worker.py exists in resources/scripts/');
        }
        
        console.log('OCR worker script is ready');
    }

    async verifyInstallation() {
        console.log('🔍 Verifying installation...');
        
        const platform = process.platform;
        const pythonExe = platform === 'win32' 
            ? path.join(this.pythonDir, 'python.exe')
            : path.join(this.pythonDir, 'bin', 'python3');
        
        const testScript = path.join(this.scriptsDir, 'ocr_worker.py');
        
        try {
            // Test Python execution
            execSync(`"${pythonExe}" --version`, { stdio: 'inherit' });
            
            // Test OCR script
            const result = execSync(`"${pythonExe}" "${testScript}" --test`, { 
                encoding: 'utf8',
                timeout: 30000 
            });
            
            const testResult = JSON.parse(result);
            if (testResult.success) {
                console.log('✅ OCR engine test passed');
            } else {
                throw new Error(`OCR test failed: ${testResult.error}`);
            }
        } catch (error) {
            console.error('❌ Installation verification failed:', error.message);
            throw error;
        }
    }

    async downloadFile(url, destination) {
        console.log(`⬇️  Downloading ${url}...`);
        
        const file = fs.createWriteStream(destination);
        
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    return this.downloadFile(response.headers.location, destination)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed with status ${response.statusCode}`));
                    return;
                }
                
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize) {
                        const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                        process.stdout.write(`\r   Progress: ${progress}%`);
                    }
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.log('\n   Download completed');
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(destination, () => {}); // Delete partial file
                    reject(err);
                });
            }).on('error', reject);
        });
    }
}

// Run if called directly
if (require.main === module) {
    const bundler = new DependencyBundler();
    bundler.bundleAll().catch(console.error);
}

module.exports = DependencyBundler;
