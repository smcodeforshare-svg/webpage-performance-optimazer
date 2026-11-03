export default function Dashboard() {
  const rows = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
  const mapped = rows.reduce((acc, row) => ({ ...acc, [row.id]: row }), {});

  return (
    <ul>
      {Object.keys(mapped).map((key) => (
        <li key={key}>{mapped[key].name}</li>
      ))}
    </ul>
  );
}
