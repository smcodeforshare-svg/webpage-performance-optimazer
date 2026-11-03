import React from 'react';
import { ProductList } from './components/ProductList';
import { DashboardStats } from './components/BadEffect';

export default function App() {
  return (
    <main>
      <h1>Sample E-Commerce Store</h1>
      <DashboardStats />
      <ProductList searchTerm="shoes" />
    </main>
  );
}
