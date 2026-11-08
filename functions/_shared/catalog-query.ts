export const catalogQuery=`
SELECT l.id,l.title,l.description,l.price_cents AS priceCents,l.category,l.condition,
       l.image_url AS image,l.fulfillment,l.created_at AS createdAt,
       s.display_name AS seller,s.id AS sellerId,d.neighborhood,s.whatsapp AS contactWhatsapp,'PUBLICADO' AS status
FROM marketplace_listings l
JOIN marketplace_sellers s ON s.id=l.seller_id
LEFT JOIN marketplace_listing_details d ON d.listing_id=l.id
WHERE l.status='published' AND s.status!='suspended'
ORDER BY l.created_at DESC,l.id DESC
LIMIT 200
`;
