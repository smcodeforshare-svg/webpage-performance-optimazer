import React, { useEffect, useState } from 'react';
import moment from 'moment';

export default function ProductList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then((response) => response.json())
      .then((data) => setItems(data));
  }, []);

  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item.name} - {moment(item.createdAt).format('YYYY-MM-DD')}</li>
      ))}
    </ul>
  );
}
