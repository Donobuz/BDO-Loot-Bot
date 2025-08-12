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
    entry: './src/main/main.ts',
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
            const htmlSrc = path.resolve(__dirname, 'src/main/regionSelector.html');
            const htmlDest = path.resolve(__dirname, 'dist/main/regionSelector.html');
            if (fs.existsSync(htmlSrc)) {
              fs.copyFileSync(htmlSrc, htmlDest);
            }
            
            // Copy regionSelectorPreload.js
            const jsSrc = path.resolve(__dirname, 'src/main/regionSelectorPreload.js');
            const jsDest = path.resolve(__dirname, 'dist/main/regionSelectorPreload.js');
            if (fs.existsSync(jsSrc)) {
              fs.copyFileSync(jsSrc, jsDest);
            }
            
            // Copy streamingOverlay.html
            const overlayHtmlSrc = path.resolve(__dirname, 'src/main/streamingOverlay.html');
            const overlayHtmlDest = path.resolve(__dirname, 'dist/main/streamingOverlay.html');
            if (fs.existsSync(overlayHtmlSrc)) {
              fs.copyFileSync(overlayHtmlSrc, overlayHtmlDest);
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
    entry: './src/main/preload.ts',
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
  }
];
