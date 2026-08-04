import { useGetPropertiesQuery } from '../store/api';

export function PropertyList() {
  const { data: properties, isLoading, error } = useGetPropertiesQuery();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {JSON.stringify(error)}</div>;

  return (
    <div>
      <h2>Properties</h2>
      {properties && properties.length > 0 ? (
        <ul>
          {properties.map((property) => (
            <li key={property.id}>{property.name}</li>
          ))}
        </ul>
      ) : (
        <p>No properties found</p>
      )}
    </div>
  );
}
