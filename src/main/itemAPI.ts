import { IpcMainInvokeEvent } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { itemsService } from '../services/db/items';
import { adminDatabase } from '../services/db/admin';
import { StorageService } from '../services/db/storage';
import { ItemType } from '../services/db/types';

// Arsha API base URL
const ARSHA_API_BASE = 'https://api.arsha.io/v2';

// Initialize storage service
const storageService = new StorageService();

interface ArshaAPIResponse {
  name: string;
  id: number;
  sid: number;
  minEnhance: number;
  maxEnhance: number;
  basePrice: number;
  currentStock: number;
  totalTrades: number;
  priceMin: number;
  priceMax: number;
  lastSoldPrice: number;
  lastSoldTime: number;
}

async function fetchItemFromArsha(bdoItemId: number, region: string): Promise<ArshaAPIResponse> {
  const url = `${ARSHA_API_BASE}/${region}/item?id=${bdoItemId}&lang=en`;
  
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'BDO-Loot-Bot/1.0.0',
        'Accept': 'application/json'
      }
    }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          if (response.statusCode === 404) {
            reject(new Error(`Item not found in ${region} region - item may not be available in this market`));
            return;
          }
          
          if (response.statusCode === 500) {
            reject(new Error(`${region} market API is temporarily unavailable`));
            return;
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: Failed to fetch item data from ${region} market`));
            return;
          }
          
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (parseError) {
          reject(new Error(`Failed to parse response from ${region} market API`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`Network error connecting to ${region} market: ${error.message}`));
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`Request timeout for ${region} market API`));
    });
  });
}

export const itemHandlers = {
  'items:get-all': async (event: IpcMainInvokeEvent) => {
    try {
      return await itemsService.getAll();
    } catch (error) {
      console.error('Error getting all items:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:get-active': async (event: IpcMainInvokeEvent) => {
    try {
      return await itemsService.getActive();
    } catch (error) {
      console.error('Error getting active items:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:get-archived': async (event: IpcMainInvokeEvent) => {
    try {
      return await itemsService.getArchived();
    } catch (error) {
      console.error('Error getting archived items:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:get-by-id': async (event: IpcMainInvokeEvent, id: number) => {
    try {
      return await itemsService.getById(id);
    } catch (error) {
      console.error('Error getting item by ID:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:create': async (event: IpcMainInvokeEvent, item: any) => {
    try {
      return await itemsService.create(item);
    } catch (error) {
      console.error('Error creating item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:create-from-api': async (event: IpcMainInvokeEvent, bdoItemId: number, region: string, conversionData?: { convertible_to_bdo_item_id: number | null; conversion_ratio: string; type: ItemType; base_price: number | null } | null) => {
    try {
      // Check if item already exists for this region (including archived)
      const existingItem = await itemsService.getByBdoIdAndRegionIncludingArchived(bdoItemId, region);
      if (existingItem.success && existingItem.data) {
        // If item is archived, unarchive it
        if (existingItem.data.archived) {
          console.log(`Item ${bdoItemId} found archived for region ${region}, unarchiving...`);
          const unarchiveResult = await itemsService.unarchive(existingItem.data.id);
          if (unarchiveResult.success) {
            return { 
              success: true, 
              unarchived: true, 
              data: unarchiveResult.data,
              message: `Item unarchived for ${region} region` 
            };
          } else {
            return { success: false, error: `Failed to unarchive item: ${unarchiveResult.error}` };
          }
        } else {
          // Item exists and is active
          console.log(`Item ${bdoItemId} already exists and is active for region ${region}`);
          return { 
            success: true, 
            skipped: true, 
            data: existingItem.data,
            message: `Item already exists in ${region} region` 
          };
        }
      }

      // Item doesn't exist, fetch from API and create new
      const arshaData = await fetchItemFromArsha(bdoItemId, region);
      
      const newItem = {
        name: arshaData.name,
        bdo_item_id: bdoItemId,
        base_price: conversionData?.type === 'trash_loot' && conversionData?.base_price ? conversionData.base_price : arshaData.basePrice,
        last_sold_price: arshaData.lastSoldPrice,
        loot_table_ids: [], // Empty for now, can be set later
        region: region,
        // Set type based on conversion data or default to marketplace
        type: conversionData?.type || 'marketplace',
        convertible_to_bdo_item_id: conversionData?.convertible_to_bdo_item_id || null,
        conversion_ratio: conversionData?.conversion_ratio ? parseInt(conversionData.conversion_ratio) : 1,
      };
      
      const result = await itemsService.create(newItem);
      console.log(`Created item: ${arshaData.name} for region ${region}`);
      return result;
    } catch (error) {
      console.error('Error creating item from API:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:create-manual': async (event: IpcMainInvokeEvent, itemData: { name: string; bdo_item_id: number; region?: string | null; base_price?: number; convertible_to_bdo_item_id?: number; conversion_ratio?: number; type?: ItemType }) => {
    try {
      // For trash loot and convertible items, use null region (global)
      const effectiveRegion = (itemData.type === 'trash_loot' || itemData.type === 'conversion') ? null : itemData.region;
      
      // Check if item already exists for this region (including archived)
      const existingItem = effectiveRegion 
        ? await itemsService.getByBdoIdAndRegionIncludingArchived(itemData.bdo_item_id, effectiveRegion)
        : await itemsService.getByBdoIdGlobalIncludingArchived(itemData.bdo_item_id);
        
      if (existingItem.success && existingItem.data) {
        // If item is archived, unarchive it
        if (existingItem.data.archived) {
          console.log(`Item ${itemData.bdo_item_id} found archived ${effectiveRegion ? `for region ${effectiveRegion}` : 'globally'}, unarchiving...`);
          const unarchiveResult = await itemsService.unarchive(existingItem.data.id);
          if (unarchiveResult.success) {
            return { 
              success: true, 
              unarchived: true, 
              data: unarchiveResult.data,
              message: `Item unarchived ${effectiveRegion ? `for ${effectiveRegion} region` : 'globally'}` 
            };
          } else {
            return { success: false, error: `Failed to unarchive item: ${unarchiveResult.error}` };
          }
        } else {
          // Item exists and is active
          console.log(`Item ${itemData.bdo_item_id} already exists and is active ${effectiveRegion ? `for region ${effectiveRegion}` : 'globally'}`);
          return { 
            success: true, 
            skipped: true, 
            data: existingItem.data,
            message: `Item already exists ${effectiveRegion ? `in ${effectiveRegion} region` : 'globally'}` 
          };
        }
      }

      // For convertible items, don't auto-calculate prices since target item prices vary by region
      // Users should set base_price manually if needed
      let calculatedBasePrice = itemData.base_price || 0;
      let calculatedLastSoldPrice = 0;

      const newItem = {
        name: itemData.name,
        bdo_item_id: itemData.bdo_item_id,
        base_price: calculatedBasePrice,
        last_sold_price: calculatedLastSoldPrice,
        loot_table_ids: [], // Empty for now, can be set later
        region: effectiveRegion || null,
        type: itemData.type || 'marketplace',
        convertible_to_bdo_item_id: itemData.convertible_to_bdo_item_id || null,
        conversion_ratio: itemData.conversion_ratio || 1,
      };
      
      const result = await itemsService.create(newItem);
      console.log(`Created manual item: ${itemData.name} ${effectiveRegion ? `for region ${effectiveRegion}` : 'globally'}`);
      return result;
    } catch (error) {
      console.error('Error creating manual item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:update': async (event: IpcMainInvokeEvent, id: number, updates: any) => {
    try {
      return await itemsService.update(id, updates);
    } catch (error) {
      console.error('Error updating item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:archive': async (event: IpcMainInvokeEvent, id: number) => {
    try {
      return await itemsService.archive(id);
    } catch (error) {
      console.error('Error archiving item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:unarchive': async (event: IpcMainInvokeEvent, id: number) => {
    try {
      return await itemsService.unarchive(id);
    } catch (error) {
      console.error('Error unarchiving item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:sync-prices': async (event: IpcMainInvokeEvent, region: string) => {
    try {
      let updated = 0;
      const regionItemsResult = await itemsService.getByRegion(region);
      
      if (!regionItemsResult.success || !regionItemsResult.data) {
        return { success: false, error: regionItemsResult.error || 'Failed to get items for region' };
      }

      const regionItems = regionItemsResult.data;
      
      // Filter to only marketplace items
      const marketplaceItems = regionItems.filter(item => {
        return item.type === 'marketplace';
      });
      
      
      for (const item of marketplaceItems) {
        try {
          const arshaData = await fetchItemFromArsha(item.bdo_item_id, region);
          
          await itemsService.updatePrices(
            item.bdo_item_id, 
            region, 
            arshaData.basePrice, 
            arshaData.lastSoldPrice
          );
          
          updated++;
          
          // Rate limit: 1000ms delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`Failed to sync prices for item ${item.bdo_item_id} in ${region}:`, error);
        }
      }
      
      return { success: true, updated };
    } catch (error) {
      console.error('Error syncing prices:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'items:upload-image': async (event: IpcMainInvokeEvent, itemId: number, imageBuffer: Buffer, originalName: string) => {
    try {
      // Process image with Sharp (resize and optimize)
      const processedImageBuffer = await sharp(imageBuffer)
        .resize(200, 200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toBuffer();

      // Get current item to check for existing image
      const itemResult = await itemsService.getById(itemId);
      if (!itemResult.success || !itemResult.data) {
        return { success: false, error: 'Item not found' };
      }

      const oldImageUrl = itemResult.data.image_url;

      // Upload to Supabase Storage
      const uploadResult = await storageService.updateItemImage(
        itemId,
        processedImageBuffer,
        originalName,
        oldImageUrl || undefined
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Update item with new image URL
      const updateResult = await itemsService.update(itemId, { 
        image_url: uploadResult.data!.publicUrl 
      });
      
      if (!updateResult.success) {
        // Clean up uploaded file if database update failed
        await storageService.removeImage(uploadResult.data!.publicUrl);
        return updateResult;
      }

      return {
        success: true,
        data: {
          ...updateResult.data,
          image_url: uploadResult.data!.publicUrl
        }
      };
    } catch (error) {
      console.error('Error uploading item image:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to upload image' };
    }
  },

  'items:remove-image': async (event: IpcMainInvokeEvent, itemId: number) => {
    try {
      
      // Get current item to find image URL
      const itemResult = await itemsService.getById(itemId);
      
      if (!itemResult.success || !itemResult.data) {
        return { success: false, error: 'Item not found' };
      }

      const item = itemResult.data;
      
      // Remove image from Supabase Storage if it exists
      if (item.image_url) {
        const removeResult = await storageService.removeImage(item.image_url);
        if (!removeResult.success) {
          console.warn('⚠️ [BACKEND] Failed to remove image from storage:', removeResult.error);
          // Continue with database update even if storage removal fails
        } else {
        }
      } else {
      }

      // Update item to remove image_url using admin permissions
      const updateResult = await adminDatabase.updateItemAsAdmin(itemId, { image_url: null });
      
      return updateResult;
    } catch (error) {
      console.error('❌ [BACKEND] Error removing item image:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove image' };
    }
  },

  'items:upload-image-for-bdo-item': async (event: IpcMainInvokeEvent, bdoItemId: number, imageBuffer: Buffer, originalName: string) => {
    try {
      // Process image with Sharp (resize and optimize)
      const processedImageBuffer = await sharp(imageBuffer)
        .resize(200, 200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toBuffer();

      // Get current image URL from any item with this bdo_item_id to remove old image
      let oldImageUrl: string | undefined;
      const existingItemsResult = await itemsService.getByBdoItemId(bdoItemId);
      if (existingItemsResult.success && existingItemsResult.data && existingItemsResult.data.length > 0) {
        // Use the first item's image_url (they should all be the same for a bdo_item_id)
        oldImageUrl = existingItemsResult.data[0].image_url || undefined;
      }

      // Upload image to storage (single upload for all regions)
      console.log(`📤 Uploading image for BDO Item ID ${bdoItemId}...`);
      const uploadResult = await storageService.uploadImageForBdoItem(
        processedImageBuffer,
        originalName,
        bdoItemId,
        oldImageUrl
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Update all items with this bdo_item_id to use the same image URL
      console.log(`🔄 Updating all items with BDO Item ID ${bdoItemId} to use uploaded image...`);
      const updateResult = await itemsService.updateImageForAllRegions(
        bdoItemId, 
        uploadResult.data!.publicUrl
      );
      
      if (!updateResult.success) {
        // Clean up uploaded file if database update failed
        await storageService.removeImage(uploadResult.data!.publicUrl);
        return updateResult;
      }

      console.log(`✅ Image uploaded and applied to ${updateResult.data?.length || 0} items`);
      return {
        success: true,
        data: {
          imageUrl: uploadResult.data!.publicUrl,
          fileName: uploadResult.data!.fileName,
          updatedItems: updateResult.data?.length || 0
        }
      };
    } catch (error) {
      console.error('Error uploading image for bdo item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to upload image' };
    }
  },

  'items:get-by-bdo-item-id': async (event: IpcMainInvokeEvent, bdoItemId: number) => {
    try {
      return await itemsService.getByBdoItemId(bdoItemId);
    } catch (error) {
      console.error('Error getting items by bdo item id:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
