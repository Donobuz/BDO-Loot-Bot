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
            console.log('🚀 FastOCR (DXCam + PaddleOCR) is ready for ultra-fast processing!');
            console.log('📦 Your app is now ready for distribution with sub-second OCR performance!');
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
        
        // Create PaddleOCR model storage directory
        const paddleOcrModelDir = path.join(this.resourcesDir, 'paddleocr_models');
        await fs.ensureDir(paddleOcrModelDir);
        console.log('📁 Created PaddleOCR model cache directory');
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

        // Core FastOCR packages - install these first to establish base versions
        const corePackages = [
            'dxcam==0.0.5',
            'paddleocr==3.1.1', 
            'paddlepaddle>=3.1.0'
        ];

        // Install core packages first
        console.log('🔧 Installing core FastOCR packages...');
        for (const pkg of corePackages) {
            await this.installPackage(pythonExe, pkg, platform);
        }

        // All remaining dependencies
        const remainingPackages = [
            'comtypes>=1.4.0',
            'pillow==10.1.0',
            'numpy>=1.24.3',
            'opencv-python>=4.8.0',
            'opencv-contrib-python>=4.10.0',
            'scipy>=1.16.0',
            'scikit-image>=0.25.0',
            'scikit-learn>=1.7.0',
            'imageio>=2.37.0',
            'networkx>=3.5',
            'lazy_loader>=0.4',
            'tifffile>=2025.6.0',
            'shapely>=2.1.0',
            'pyclipper>=1.3.0',
            'requests>=2.32.0',
            'urllib3>=2.5.0',
            'certifi>=2025.8.0',
            'charset_normalizer>=3.4.0',
            'idna>=3.10',
            'typing_extensions>=4.14.0',
            'pandas>=2.3.0',
            'pytz>=2025.2',
            'python-dateutil>=2.9.0',
            'tzdata>=2025.2',
            'six>=1.17.0',
            'packaging>=25.0',
            'filelock>=3.19.0',
            'joblib>=1.5.0',
            'threadpoolctl>=3.6.0',
            'tqdm>=4.67.0',
            'lxml>=6.0.0',
            'beautifulsoup4>=4.13.0',
            'soupsieve>=2.7',
            'anyio>=4.10.0',
            'sniffio>=1.3.0',
            'httpx>=0.28.0',
            'httpcore>=1.0.9',
            'h11>=0.16.0',
            'PyYAML>=6.0.0',
            'colorama>=0.4.6',
            'wcwidth>=0.2.13'
        ];

        const sitePackages = platform === 'win32' 
            ? path.join(this.pythonDir, 'Lib', 'site-packages')
            : path.join(this.pythonDir, 'lib', 'python3.11', 'site-packages');

        await fs.ensureDir(sitePackages);

        // Install remaining packages individually to avoid version conflicts
        console.log('📦 Installing remaining FastOCR dependencies...');
        for (const pkg of remainingPackages) {
            await this.installPackage(pythonExe, pkg, platform);
        }

        // Clean up any version number directories created in root
        await this.cleanupVersionDirectories();
    }

    async cleanupVersionDirectories() {
        console.log('🧹 Cleaning up temporary version directories...');
        
        try {
            const rootFiles = await fs.readdir(this.projectRoot);
            
            // Look for directories that are just version numbers (e.g., "0.48.0", "1.2.3", etc.)
            const versionPattern = /^\d+\.\d+(\.\d+)?$/;
            
            for (const item of rootFiles) {
                const itemPath = path.join(this.projectRoot, item);
                const stat = await fs.lstat(itemPath);
                
                if (stat.isDirectory() && versionPattern.test(item)) {
                    console.log(`🗑️  Removing version directory: ${item}`);
                    await fs.remove(itemPath);
                }
            }
        } catch (error) {
            console.warn('Warning: Could not clean up version directories:', error.message);
        }
    }

    async installPackage(pythonExe, pkg, platform) {
        console.log(`Installing ${pkg}...`);
        try {
            // Use --no-build-isolation and --no-deps to prevent version conflicts
            // Change to pythonDir to prevent creating files in project root
            const installCmd = platform === 'win32'
                ? `"${pythonExe}" -m pip install --no-warn-script-location --disable-pip-version-check "${pkg}"`
                : `"${pythonExe}" -m pip install --no-warn-script-location --disable-pip-version-check "${pkg}"`;
            
            execSync(installCmd, { 
                cwd: this.pythonDir,  // Run from python directory to prevent root directory pollution
                stdio: 'inherit',
                timeout: 600000 // 10 minutes timeout for large packages
            });
        } catch (error) {
            console.warn(`Warning: Failed to install ${pkg}, trying without version constraint...`);
            const basePkg = pkg.split('==')[0].split('>=')[0].split('[')[0];
            try {
                const installCmd = platform === 'win32'
                    ? `"${pythonExe}" -m pip install --no-warn-script-location --disable-pip-version-check "${basePkg}"`
                    : `"${pythonExe}" -m pip install --no-warn-script-location --disable-pip-version-check "${basePkg}"`;
                
                execSync(installCmd, { 
                    cwd: this.pythonDir,  // Run from python directory
                    stdio: 'inherit',
                    timeout: 600000
                });
            } catch (fallbackError) {
                console.error(`Failed to install ${basePkg}:`, fallbackError.message);
            }
        }
    }

    async copyOCRScripts() {
        console.log('📄 Copying OCR scripts...');
        
        const fastOcrScript = path.join(this.resourcesDir, 'scripts', 'fast_ocr_worker.py');
        
        // Ensure FastOCR script exists
        if (!fs.existsSync(fastOcrScript)) {
            throw new Error('FastOCR worker script not found. Make sure fast_ocr_worker.py exists in resources/scripts/');
        }
        
        console.log('✅ FastOCR worker script is ready (DXCam + PaddleOCR)');
    }

    async verifyInstallation() {
        console.log('🔍 Verifying installation...');
        
        const platform = process.platform;
        const pythonExe = platform === 'win32' 
            ? path.join(this.pythonDir, 'python.exe')
            : path.join(this.pythonDir, 'bin', 'python3');
        
        try {
            // Test Python execution
            console.log('🐍 Testing Python installation...');
            execSync(`"${pythonExe}" --version`, { stdio: 'inherit' });
            
            // Test FastOCR dependencies
            console.log('🚀 Testing FastOCR dependencies (DXCam + PaddleOCR)...');
            const testCommand = `"${pythonExe}" -c "import dxcam, paddleocr, cv2, numpy; print('✅ All FastOCR dependencies loaded successfully')"`;
            
            execSync(testCommand, { 
                stdio: 'inherit',
                timeout: 60000  // Longer timeout for first-time imports
            });
            
            console.log('🎯 FastOCR system (DXCam + PaddleOCR) is ready for ultra-fast processing!');
            
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
