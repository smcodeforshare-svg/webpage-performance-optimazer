/**
 * Backend API Route Handler for /api/products
 */

export default async function handleProductsRequest(req, res) {
  // Route Handler for /api/products
  const products = [
    { id: 1, name: 'Running Shoes', price: 120, active: true },
    { id: 2, name: 'Trail Boots', price: 180, active: true }
  ];
  return res.status(200).json(products);
}
