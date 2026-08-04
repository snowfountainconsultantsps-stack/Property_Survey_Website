# RTK Query Setup Guide

## What was installed and configured:

### 1. **Dependencies**
- `@reduxjs/toolkit` - Redux state management with RTK Query
- `react-redux` - React bindings for Redux

### 2. **Store Structure**
```
src/store/
├── store.ts       - Redux store configuration
├── api.ts         - RTK Query API definitions
└── hooks.ts       - Pre-typed Redux hooks
```

### 3. **How to Use:**

#### Query Data
```jsx
import { useGetPropertiesQuery } from './store/api';

function MyComponent() {
  const { data, isLoading, error } = useGetPropertiesQuery();
  // Use the data...
}
```

#### Mutate Data
```jsx
import { useAddPropertyMutation } from './store/api';

function AddProperty() {
  const [addProperty, { isLoading }] = useAddPropertyMutation();
  
  const handleAdd = async (property) => {
    await addProperty(property);
  };
}
```

#### Pre-typed Hooks
```jsx
import { useAppDispatch, useAppSelector } from './store/hooks';

const dispatch = useAppDispatch();
const state = useAppSelector(state => state.something);
```

### 4. **Next Steps:**
1. Update the `baseUrl` in [src/store/api.ts](src/store/api.ts) with your actual API endpoint
2. Modify the endpoints in the `propertyApi` to match your backend API
3. Import and use the hooks in your components
4. The store is automatically configured in [src/main.jsx](src/main.jsx)

### 5. **Key Features Enabled:**
- Automatic caching of API responses
- Request deduplication
- Automatic refetching on mount
- Loading and error states
- Optimistic updates support
- Cache invalidation support
