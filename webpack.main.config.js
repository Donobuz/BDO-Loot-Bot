const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
const env = dotenv.config().parsed;
const envKeys = Object.keys(env || {}).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = [
  // Main process configuration
  {
    mode: 'development',
    target: 'electron-main',
    entry: './src/main/core/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'main.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin(envKeys),
      // Copy HTML and JS files needed by main process
      {
        apply: (compiler) => {
          compiler.hooks.afterEmit.tap('CopyMainAssets', () => {
            // Copy regionSelector.html
            const htmlSrc = path.resolve(__dirname, 'src/main/features/regionSelector/regionSelector.html');
            const htmlDest = path.resolve(__dirname, 'dist/main/regionSelector.html');
            if (fs.existsSync(htmlSrc)) {
              fs.copyFileSync(htmlSrc, htmlDest);
            }
            
            // Copy streamingOverlay.html
            const overlayHtmlSrc = path.resolve(__dirname, 'src/main/features/streamingOverlay/streamingOverlay.html');
            const overlayHtmlDest = path.resolve(__dirname, 'dist/main/streamingOverlay.html');
            if (fs.existsSync(overlayHtmlSrc)) {
              fs.copyFileSync(overlayHtmlSrc, overlayHtmlDest);
            }
            
            // Copy overlay.js
            const overlayJsSrc = path.resolve(__dirname, 'src/main/features/streamingOverlay/overlay.js');
            const overlayJsDest = path.resolve(__dirname, 'dist/main/overlay.js');
            if (fs.existsSync(overlayJsSrc)) {
              fs.copyFileSync(overlayJsSrc, overlayJsDest);
            }
          });
        }
      }
    ],
    externals: {
      'sharp': 'commonjs sharp'
    },
    node: {
      __dirname: false,
      __filename: false
    }
  },
  // Preload script configuration
  {
    mode: 'development',
    target: 'electron-preload',
    entry: './src/main/core/preload.ts',
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'preload.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin(envKeys)
    ],
    node: {
      __dirname: false,
      __filename: false
    }
  },
  // Region selector preload script configuration
  {
    mode: 'development',
    target: 'electron-preload',
    entry: './src/main/features/regionSelector/regionSelectorPreload.ts',
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'regionSelectorPreload.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin(envKeys)
    ],
    node: {
      __dirname: false,
      __filename: false
    }
  },
  // Overlay preload script configuration
  {
    mode: 'development',
    target: 'electron-preload',
    entry: './src/main/features/streamingOverlay/overlayPreload.ts',
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'overlayPreload.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin(envKeys)
    ],
    node: {
      __dirname: false,
      __filename: false
    }
  }
];
