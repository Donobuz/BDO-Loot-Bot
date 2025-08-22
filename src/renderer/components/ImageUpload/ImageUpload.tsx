import React, { useState, useRef, useCallback, useEffect } from 'react';
import { processImageFile, validateImageFile, ProcessedImage } from '../../utils/imageUtils';
import './ImageUpload.css';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageProcessed: (processedImage: ProcessedImage | null) => void;
  onImageRemoved?: () => void;
  disabled?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImageUrl,
  onImageProcessed,
  onImageRemoved,
  disabled = false,
  maxWidth = 200,
  maxHeight = 200
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync previewUrl with currentImageUrl prop changes
  useEffect(() => {
    setPreviewUrl(currentImageUrl || null);
  }, [currentImageUrl]);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setProcessing(true);

    try {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error!);
        return;
      }

      // Process image
      const processedImage = await processImageFile(file, {
        maxWidth,
        maxHeight,
        quality: 0.8,
        format: 'webp'
      });

      // Update preview
      setPreviewUrl(processedImage.dataUrl);
      
      // Notify parent component
      onImageProcessed(processedImage);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      setError(errorMessage);
      onImageProcessed(null);
    } finally {
      setProcessing(false);
    }
  }, [maxWidth, maxHeight, onImageProcessed]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    const files = Array.from(event.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
    }
  }, [disabled, handleFileSelect]);

  const handleUploadClick = useCallback(() => {
    if (disabled || processing) return;
    fileInputRef.current?.click();
  }, [disabled, processing]);

  const handleRemoveImage = useCallback(() => {
    setPreviewUrl(null);
    setError(null);
    onImageProcessed(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (onImageRemoved) {
      onImageRemoved();
    }
  }, [onImageProcessed, onImageRemoved]);

  return (
    <div className="image-upload-container">
      <div 
        className={`image-upload-dropzone ${disabled ? 'disabled' : ''} ${processing ? 'processing' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDrop={handleDrop}
        onClick={handleUploadClick}
      >
        {processing && (
          <div className="upload-processing">
            <div className="processing-spinner"></div>
            <span>Processing image...</span>
          </div>
        )}
        
        {!processing && previewUrl && (
          <div className="image-preview">
            <img src={previewUrl} alt="Item preview" className="preview-image" />
            <div className="image-overlay">
              <button
                type="button"
                className="remove-image-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage();
                }}
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {!processing && !previewUrl && (
          <div className="upload-placeholder">
            <div className="upload-icon">📷</div>
            <div className="upload-text">
              <strong>Click to upload</strong> or drag and drop
            </div>
            <div className="upload-hint">
              PNG, JPG, WebP up to 10MB
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
    </div>
  );
};

export default ImageUpload;
