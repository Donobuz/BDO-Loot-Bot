import React, { useState, useCallback } from 'react';
import { OCRResult, ItemExtractionResult } from '../../types';
import './OCRTester.css';

interface OCRTesterProps {
  onClose?: () => void;
}

const OCRTester: React.FC<OCRTesterProps> = ({ onClose }) => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [itemResult, setItemResult] = useState<ItemExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const initializeOCR = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.ocr.initialize();
      if (result.success) {
        setIsInitialized(true);
      } else {
        setError(result.error || 'Failed to initialize OCR');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const installDependencies = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.ocr.installDependencies();
      if (result.success) {
        await initializeOCR();
      } else {
        setError(result.error || 'Failed to install dependencies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsInitializing(false);
    }
  }, [initializeOCR]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // For Electron, we need to use a different approach to get the file path
      // In development, we'll use a URL, in production we'll need the actual path
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setSelectedImage(result);
      };
      reader.readAsDataURL(file);
      setOcrResult(null);
      setItemResult(null);
      setError(null);
    }
  }, []);

  const processOCR = useCallback(async (extractItems: boolean = false) => {
    if (!selectedImage || !isInitialized) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      if (extractItems) {
        const result = await window.electronAPI.ocr.extractItems(selectedImage);
        setItemResult(result);
        setOcrResult(null);
      } else {
        const result = await window.electronAPI.ocr.extractText(selectedImage);
        setOcrResult(result);
        setItemResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedImage, isInitialized]);

  return (
    <div className="ocr-tester">
      <div className="ocr-tester-header">
        <h2>OCR Tester</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      <div className="ocr-tester-content">
        {!isInitialized ? (
          <div className="initialization-section">
            <h3>OCR Initialization</h3>
            <p>The bundled OCR system is ready to initialize.</p>
            
            <div className="init-buttons">
              <button 
                onClick={initializeOCR} 
                disabled={isInitializing}
                className="init-button"
              >
                {isInitializing ? 'Initializing...' : 'Initialize OCR'}
              </button>
              
              <button 
                onClick={installDependencies} 
                disabled={isInitializing}
                className="install-button"
              >
                {isInitializing ? 'Checking...' : 'Check System'}
              </button>
            </div>
            
            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
                <p className="error-help">
                  The bundled OCR system should work out of the box. 
                  Check console logs for detailed error information.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="testing-section">
            <div className="upload-section">
              <label htmlFor="image-upload" className="upload-label">
                Select Image for OCR Testing
              </label>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input"
              />
              
              {selectedImage && (
                <div className="selected-image">
                  <p>Image selected for OCR processing</p>
                  <img 
                    src={selectedImage} 
                    alt="Selected for OCR" 
                    className="preview-image"
                  />
                </div>
              )}
            </div>

            {selectedImage && (
              <div className="process-section">
                <div className="process-buttons">
                  <button 
                    onClick={() => processOCR(false)} 
                    disabled={isProcessing}
                    className="process-button"
                  >
                    {isProcessing ? 'Processing...' : 'Extract All Text'}
                  </button>
                  
                  <button 
                    onClick={() => processOCR(true)} 
                    disabled={isProcessing}
                    className="process-button item-button"
                  >
                    {isProcessing ? 'Processing...' : 'Extract Items Only'}
                  </button>
                </div>
              </div>
            )}

            {(ocrResult || itemResult) && (
              <div className="results-section">
                <h3>OCR Results</h3>
                
                {ocrResult && (
                  <div className="text-results">
                    <h4>All Text Extraction</h4>
                    <p><strong>Processing Time:</strong> {ocrResult.processing_time?.toFixed(2)}ms</p>
                    <p><strong>Total Text:</strong> {ocrResult.total_text || 'No text found'}</p>
                    
                    {ocrResult.results && ocrResult.results.length > 0 && (
                      <div className="detailed-results">
                        <h5>Detailed Results:</h5>
                        {ocrResult.results.map((result, index) => (
                          <div key={index} className="result-item">
                            <span className="result-text">"{result.text}"</span>
                            <span className="result-confidence">
                              {(result.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {itemResult && (
                  <div className="item-results">
                    <h4>Item Extraction</h4>
                    <p><strong>Processing Time:</strong> {itemResult.processing_time?.toFixed(2)}ms</p>
                    <p><strong>Items Found:</strong> {itemResult.items?.length || 0}</p>
                    
                    {itemResult.items && itemResult.items.length > 0 && (
                      <div className="item-list">
                        <h5>Detected Items:</h5>
                        {itemResult.items.map((item, index) => (
                          <div key={index} className="item-entry">
                            <span className="item-name">"{item.name}"</span>
                            <span className="item-confidence">
                              {(item.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="error-message">
                    <strong>Error:</strong> {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OCRTester;
