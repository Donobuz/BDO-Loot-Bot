# BDO Loot Bot OCR System

A high-performance, template-based OCR system for Black Desert Online loot tracking.

## Features

- **Cross-platform**: Works on Windows and Linux
- **Template-based**: Only recognizes items from your configured loot tables
- **User preferences integration**: Uses your designated OCR region
- **High accuracy**: EasyOCR with custom preprocessing for gaming text
- **Fast processing**: Optimized for real-time loot detection
- **Portable**: All dependencies bundled automatically

## Architecture

### Core Components

1. **TemplateManager**: Manages location-specific item templates
2. **PortableOCR**: Handles the Python/EasyOCR interface
3. **TemplateOCR**: Main OCR processor with template matching
4. **BDOLootBot**: High-level interface for loot tracking sessions

### Template System

Each grinding location has a JSON template defining:
- Expected loot items with variations and fuzzy matching
- Text processing filters
- Quantity detection patterns
- Item values for calculations

Example template structure:
```json
{
    "name": "Polly Forest",
    "items": [
        {
            "name": "Polly's Feather",
            "variations": ["Pollys Feather", "Polly Feather"],
            "fuzzyMatch": true,
            "fuzzyPattern": "polly.{0,2}s?.{0,2}feather",
            "minSimilarity": 0.75,
            "value": 2500
        }
    ],
    "patterns": [
        {
            "type": "quantity",
            "regex": "^(\\d+)x\\s+(.+)$",
            "groups": ["quantity", "item"]
        }
    ]
}
```

## Setup

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Bundle OCR dependencies:
```bash
npm run setup-ocr
```

This will automatically download and bundle:
- Portable Python runtime
- EasyOCR and dependencies
- OpenCV for image processing

### Usage

```typescript
import { getOCRService } from './services/ocr';

const ocrService = getOCRService();

// Initialize
await ocrService.initialize();

// Set user preferences (including OCR region)
ocrService.setUserPreferences(userPreferences);

// Set location
await ocrService.setGrindLocation('polly-forest');

// Start session
ocrService.startSession();

// Process loot images
const result = await ocrService.processLootDrop(imageBuffer);
if (result.success) {
    console.log(\`Found \${result.itemsFound} items\`);
}

// Get session summary
const summary = ocrService.getSessionSummary();
```

## Templates

Templates are stored in `resources/templates/` as JSON files. Each location should have its own template file named `{location-name}.json`.

### Adding New Locations

1. Create a new template file: `resources/templates/new-location.json`
2. Define the expected loot items with variations
3. Test with sample images
4. Reload templates: `ocrService.reloadTemplates()`

### Template Best Practices

- Include common OCR misreadings in variations
- Use fuzzy matching for complex item names
- Set appropriate confidence thresholds
- Test with actual game screenshots

## Performance Optimization

### Image Preprocessing
- Automatic contrast enhancement
- Noise reduction
- Sharpening for better text detection
- Grayscale conversion

### Template Matching
- Exact string matching (fastest)
- Fuzzy pattern matching for variations
- Levenshtein distance for similarity scoring
- Character filtering to reject invalid text

### User OCR Region
- Crops processing to user-defined screen area
- Reduces processing time and false positives
- Set via user preferences: `designated_ocr_region`

## Troubleshooting

### OCR Not Working
1. Check if Python dependencies are installed: `npm run setup-ocr`
2. Verify image quality (contrast, resolution)
3. Check OCR region positioning
4. Test with example images

### Poor Recognition Accuracy
1. Adjust OCR region to focus on loot text
2. Update template variations for common misreadings
3. Check image preprocessing settings
4. Verify game UI scaling settings

### Performance Issues
1. Ensure OCR region is as small as possible
2. Check Python installation and dependencies
3. Monitor system resources during processing
4. Consider GPU acceleration for EasyOCR

## Distribution

The bundler automatically includes all necessary dependencies for distribution:
- Portable Python runtime (platform-specific)
- EasyOCR and all dependencies
- OCR worker scripts
- Location templates

Build command automatically bundles everything:
```bash
npm run dist
```

## API Reference

### BDOLootBot

Main interface for loot tracking:

- `initialize()`: Initialize OCR engine
- `setUserPreferences(preferences)`: Set user preferences
- `setGrindLocation(location)`: Set grinding location
- `startSession()`: Start loot tracking session
- `processLootDrop(imageBuffer)`: Process loot image
- `getSessionSummary()`: Get session statistics
- `endSession()`: End current session

### Template System

- `TemplateManager`: Manages location templates
- `LocationTemplate`: Individual location configuration
- `TemplateOCR`: Core OCR processing with template matching

See `/src/examples/ocrExample.ts` for complete usage examples.
