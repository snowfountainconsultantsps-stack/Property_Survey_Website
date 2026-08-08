import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { locationApi } from './locationApi';

// ──────────────────────────────────────────────────────────────
// boundaryApi — location-hierarchy (State/District/City/Ward) boundary
// upload + read. Mirrors the backend under /api/boundaries.
// ──────────────────────────────────────────────────────────────
export const boundaryApi = createApi({
  reducerPath: 'boundaryApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Boundaries'],
  endpoints: (builder) => ({
    // level: 'STATE' | 'DISTRICT' | 'CITY' | 'WARD', parentId: optional scope
    getBoundaries: builder.query({
      query: ({ level, parentId }) =>
        `boundaries?level=${level}${parentId ? `&parent_id=${parentId}` : ''}`,
      providesTags: ['Boundaries'],
    }),
    // formData: FormData with field `file`
    uploadSingleBoundary: builder.mutation({
      query: ({ level, id, formData }) => ({
        url: `boundaries/${level}/${id}/upload`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Boundaries'],
      // Keep the location tree in step for the same cross-slice reason.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(locationApi.util.invalidateTags(['Locations']));
        } catch { /* nothing changed */ }
      },
    }),
    // formData: FormData with fields file, match_field, shapefile_field (+ optional parent_id)
    bulkUploadBoundaries: builder.mutation({
      query: ({ level, formData }) => ({
        url: `boundaries/${level}/bulk-upload`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Boundaries'],
    }),

    // ─── Import: build the hierarchy FROM a shapefile ──────────────
    // Preview writes nothing — it reports the file's attribute fields and,
    // once a name field is chosen, exactly which rows would be created or
    // updated. Commit re-sends the same file with the confirmed mapping.
    previewBoundaryImport: builder.mutation({
      query: ({ level, formData }) => ({
        url: `boundaries/${level}/import/preview`,
        method: 'POST',
        body: formData,
      }),
    }),
    commitBoundaryImport: builder.mutation({
      query: ({ level, formData }) => ({
        url: `boundaries/${level}/import/commit`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Boundaries'],
      // Publishing also CREATES location rows, which live in locationApi — a
      // separate slice, so `invalidatesTags` above can't reach it. Without
      // this the new rows (and their "Published" badges) stay stale until a
      // manual reload.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(locationApi.util.invalidateTags(['Locations']));
        } catch {
          // Failed publish changes nothing, so there is nothing to refresh.
        }
      },
    }),
  }),
});

export const {
  useGetBoundariesQuery,
  useUploadSingleBoundaryMutation,
  useBulkUploadBoundariesMutation,
  usePreviewBoundaryImportMutation,
  useCommitBoundaryImportMutation,
} = boundaryApi;
