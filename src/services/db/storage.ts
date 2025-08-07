import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { BaseDatabase } from './base';
import { SUPABASE_CONFIG } from '../../config/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class StorageService extends BaseDatabase {
  private readonly BUCKET_NAME = 'item-images';
  private bucketChecked = false;
  private bucketExists = false;
  private adminClient: SupabaseClient;

  constructor() {
    super();
    // Create a separate admin client with service role for bucket operations
    try {
      if (!SUPABASE_CONFIG.serviceRoleKey || SUPABASE_CONFIG.serviceRoleKey === 'your_supabase_service_role_key') {
        this.adminClient = this.supabase;
      } else {
        this.adminClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
      }
    } catch (error) {
      console.error('❌ Failed to create admin client:', error);
      this.adminClient = this.supabase; // Fallback to regular client
    }
  }

  /**
   * Initialize the storage bucket if it doesn't exist
   */
  async initializeBucket(): Promise<void> {
    try {
      // Use admin client to list buckets (has full permissions)
      const { data: buckets, error: listError } = await this.adminClient.storage.listBuckets();
      
      if (listError) {
        console.error('❌ Error listing buckets with admin client:', listError);
        
        // Fallback to regular client
        this.adminClient = this.supabase;
        const { data: fallbackBuckets, error: fallbackError } = await this.supabase.storage.listBuckets();
        
        if (fallbackError) {
          console.error('❌ Regular client also failed:', fallbackError);
          return;
        }
        
        const bucketExists = fallbackBuckets?.some(bucket => bucket.name === this.BUCKET_NAME);
        
        if (bucketExists) {
          this.bucketChecked = true;
          this.bucketExists = true;
        }
        return;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);

      if (bucketExists) {
        this.bucketChecked = true;
        this.bucketExists = true;
      } else {
        // Create the bucket with admin client
        const { error: createError } = await this.adminClient.storage.createBucket(this.BUCKET_NAME, {
          public: true,
        });

        if (createError) {
          console.error('❌ Error creating bucket:', createError);
        } else {
          this.bucketChecked = true;
          this.bucketExists = true;
        }
      }
    } catch (error) {
      console.error('❌ Error initializing storage bucket:', error);
    }
  }

  /**
   * Ensure bucket exists, create if needed
   */
  private async ensureBucketExists(): Promise<boolean> {
    try {
      // If we've already confirmed the bucket exists, return true
      if (this.bucketChecked && this.bucketExists) {
        return true;
      }

      // Always check for bucket existence (don't rely on cached negative results)
      const { data: buckets, error: listError } = await this.adminClient.storage.listBuckets();
      
      if (listError) {
        console.error('Error checking bucket existence:', listError);
        return false;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);
      
      if (!bucketExists) {
        const { error: createError } = await this.adminClient.storage.createBucket(this.BUCKET_NAME, {
          public: true,
        });

        if (createError) {
          console.error('Failed to create bucket:', createError);
          return false;
        }
      }
      
      // Cache the positive result
      this.bucketChecked = true;
      this.bucketExists = true;
      return true;
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      return false;
    }
  }

  /**
   * Upload an image to Supabase Storage
   */
  async uploadImage(imageBuffer: Buffer, originalName: string, itemId?: number): Promise<{ success: boolean; data?: { publicUrl: string; fileName: string }; error?: string }> {
    try {
      // Ensure bucket exists first
      const bucketReady = await this.ensureBucketExists();
      if (!bucketReady) {
        return { 
          success: false, 
          error: `Storage bucket '${this.BUCKET_NAME}' not available. Please create it manually in your Supabase dashboard.` 
        };
      }

      // Generate unique filename
      const fileExtension = path.extname(originalName).toLowerCase();
      const fileName = `${itemId || 'temp'}_${uuidv4()}${fileExtension}`;

      // Upload to Supabase Storage using admin client
      const { data: uploadData, error: uploadError } = await this.adminClient.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, imageBuffer, {
          contentType: this.getMimeType(fileExtension),
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return { success: false, error: uploadError.message };
      }

      // Get public URL using admin client
      const { data: publicUrlData } = this.adminClient.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      return {
        success: true,
        data: {
          publicUrl: publicUrlData.publicUrl,
          fileName: fileName,
        },
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Remove an image from Supabase Storage
   */
  async removeImage(imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract filename from URL
      const fileName = this.extractFileNameFromUrl(imageUrl);
      if (!fileName) {
        return { success: false, error: 'Could not extract filename from URL' };
      }

      const { error } = await this.adminClient.storage
        .from(this.BUCKET_NAME)
        .remove([fileName]);

      if (error) {
        console.error('Supabase remove error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing image:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update an item's image (remove old, upload new)
   */
  async updateItemImage(
    itemId: number, 
    newImageBuffer: Buffer, 
    originalName: string, 
    oldImageUrl?: string
  ): Promise<{ success: boolean; data?: { publicUrl: string; fileName: string }; error?: string }> {
    try {
      // Remove old image if it exists
      if (oldImageUrl) {
        await this.removeImage(oldImageUrl);
      }

      // Upload new image
      return await this.uploadImage(newImageBuffer, originalName, itemId);
    } catch (error) {
      console.error('Error updating item image:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(extension: string): string {
    switch (extension.toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  /**
   * Extract filename from Supabase Storage URL
   */
  private extractFileNameFromUrl(url: string): string | null {
    try {
      // Supabase storage URLs typically end with the filename
      const parts = url.split('/');
      return parts[parts.length - 1] || null;
    } catch (error) {
      console.error('Error extracting filename from URL:', error);
      return null;
    }
  }

  /**
   * Upload an image for a specific bdo_item_id (shared across all regions)
   */
  async uploadImageForBdoItem(
    imageBuffer: Buffer, 
    originalName: string, 
    bdoItemId: number, 
    oldImageUrl?: string
  ): Promise<{ success: boolean; data?: { publicUrl: string; fileName: string }; error?: string }> {
    try {
      // Remove old image if it exists
      if (oldImageUrl) {
        await this.removeImage(oldImageUrl);
      }

      // Ensure bucket exists first
      const bucketReady = await this.ensureBucketExists();
      if (!bucketReady) {
        return { 
          success: false, 
          error: `Storage bucket '${this.BUCKET_NAME}' not available. Please create it manually in your Supabase dashboard.` 
        };
      }

      // Generate filename based on bdo_item_id for consistency across regions
      const fileExtension = path.extname(originalName).toLowerCase();
      const fileName = `bdo_item_${bdoItemId}_${uuidv4()}${fileExtension}`;

      // Upload to Supabase Storage using admin client
      const { data: uploadData, error: uploadError } = await this.adminClient.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, imageBuffer, {
          contentType: this.getMimeType(fileExtension),
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return { success: false, error: uploadError.message };
      }

      // Get public URL using admin client
      const { data: publicUrlData } = this.adminClient.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      return {
        success: true,
        data: {
          publicUrl: publicUrlData.publicUrl,
          fileName: fileName,
        },
      };
    } catch (error) {
      console.error('Error uploading image for bdo item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Test service role key functionality
   */
  async testServiceRoleKey(): Promise<boolean> {
    if (!this.adminClient || this.adminClient === this.supabase) {
      return false;
    }

    try {
      // Test service role functionality
      const { data, error } = await this.adminClient.storage.listBuckets();
      
      if (error) {
        console.error('❌ Service role test failed:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Service role test exception:', error);
      return false;
    }
  }
}
