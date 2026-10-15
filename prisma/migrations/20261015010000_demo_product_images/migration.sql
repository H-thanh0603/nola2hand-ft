-- Replace broken seed images only; preserve seller-uploaded photos.
BEGIN;
WITH photos(title, filename) AS (VALUES
  ('Bàn phím cơ AULA WIN 60 HE MAX Keycap Limited', 'aula-win60-he.webp'),
  ('iPhone 14 Pro Max 128GB Tím', 'iphone-14-pro-max-purple.jpg'),
  ('Laptop Dell Latitude Core i7 16GB', 'dell-latitude-7480.jpg'),
  ('Tai nghe Sony WH-1000XM4', 'sony-wh-1000xm4.jpg')
)
UPDATE "ListingImage" AS image
SET "url" = 'http://localhost:4000/assets/products/' || photos.filename
FROM "Listing" AS listing, "User" AS seller, photos
WHERE image."listingId" = listing.id
  AND listing."sellerId" = seller.id
  AND seller.email = 'seller@nola2hand.vn'
  AND listing.title = photos.title
  AND image.url LIKE 'https://cdn.nola2hand.vn/demo/%';
COMMIT;
