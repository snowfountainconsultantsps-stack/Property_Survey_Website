import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// ──────────────────────────────────────────────────────────────
// locationApi — CRUD for the administrative hierarchy:
//   State → District → City → Zone → Ward
// Mirrors the backend under /api/locations.
// ──────────────────────────────────────────────────────────────
export const locationApi = createApi({
  reducerPath: 'locationApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Locations'],
  endpoints: (builder) => ({
    // Whole hierarchy in one call — the manager page needs every level at once.
    getLocationTree: builder.query({
      query: () => 'locations/tree',
      providesTags: ['Locations'],
    }),
    // level: 'states' | 'districts' | 'cities' | 'zones' | 'wards'
    getLocations: builder.query({
      query: ({ level, parentId, includeInactive }) => {
        const p = new URLSearchParams();
        if (parentId) p.set('parent_id', parentId);
        if (includeInactive) p.set('include_inactive', '1');
        const q = p.toString();
        return `locations/${level}${q ? `?${q}` : ''}`;
      },
      providesTags: ['Locations'],
    }),
    createLocation: builder.mutation({
      query: ({ level, ...body }) => ({ url: `locations/${level}`, method: 'POST', body }),
      invalidatesTags: ['Locations'],
    }),
    updateLocation: builder.mutation({
      query: ({ level, id, ...body }) => ({ url: `locations/${level}/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Locations'],
    }),
    // Archives by default; pass hard:true to permanently remove (childless only).
    deleteLocation: builder.mutation({
      query: ({ level, id, hard }) => ({
        url: `locations/${level}/${id}${hard ? '?hard=1' : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Locations'],
    }),
  }),
});

export const {
  useGetLocationTreeQuery,
  useGetLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} = locationApi;
