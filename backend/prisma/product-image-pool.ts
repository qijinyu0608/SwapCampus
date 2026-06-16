export const LOCAL_PRODUCT_IMAGES = [
  '/images/products/archive/badminton.jpg',
  '/images/products/archive/books-1.jpg',
  '/images/products/archive/books-2.jpg',
  '/images/products/archive/clothing-rack.jpg',
  '/images/products/archive/fan.jpg',
  '/images/products/archive/keyboard.jpg',
  '/images/products/archive/lamp.jpg',
  '/images/products/archive/plush.jpg',
  '/images/products/archive/powerbank.png',
  '/images/products/archive/storage-shelf.jpg'
] as const;

export function getLocalProductImage(index: number) {
  return LOCAL_PRODUCT_IMAGES[index % LOCAL_PRODUCT_IMAGES.length];
}
