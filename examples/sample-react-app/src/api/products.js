export async function loadProducts() {
  const response = await fetch('/api/products');
  return response.json();
}

export async function syncProducts() {
  const response = await fetch('/api/products');
  return response.json();
}
