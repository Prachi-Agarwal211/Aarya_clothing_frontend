-- Add image_urls column to reviews table
-- Supports array of R2 URLs for review images (max 5 per review)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
