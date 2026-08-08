import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// ──────────────────────────────────────────────────────────────
// assetApi — projects + digital-asset (GIS) endpoints for the admin UI.
// Mirrors the backend under /api/projects and /api/assets.
// ──────────────────────────────────────────────────────────────
export const assetApi = createApi({
  reducerPath: 'assetApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Projects', 'Uploads', 'Features', 'Summary', 'Catalog', 'Tax'],
  endpoints: (builder) => ({
    // ─── Catalog ───────────────────────────────────────────────
    getCategories: builder.query({
      query: () => 'assets/categories',
      providesTags: ['Catalog'],
    }),
    createCategory: builder.mutation({
      query: (body) => ({ url: 'assets/categories', method: 'POST', body }),
      invalidatesTags: ['Catalog'],
    }),
    createLayer: builder.mutation({
      query: (body) => ({ url: 'assets/layers', method: 'POST', body }),
      invalidatesTags: ['Catalog'],
    }),
    updateLayer: builder.mutation({
      query: ({ id, ...body }) => ({ url: `assets/layers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Catalog'],
    }),
    deleteLayer: builder.mutation({
      query: (id) => ({ url: `assets/layers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Catalog'],
    }),

    // Query features by their survey answers, e.g. roads with width_m < 10.
    // body: { layer_id, filters: [{ key, op, value }], project_id?, ward_id?, status? }
    searchFeatures: builder.mutation({
      query: (body) => ({ url: 'assets/features/search', method: 'POST', body }),
    }),

    // ─── Projects ──────────────────────────────────────────────
    getProjects: builder.query({
      query: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return `projects${q ? `?${q}` : ''}`;
      },
      providesTags: ['Projects'],
    }),
    getProject: builder.query({
      query: (id) => `projects/${id}`,
      providesTags: ['Projects'],
    }),
    // `area` is an optional { zone_id, ward_id, locality_id } — the totals then
    // count only what the filtered map is showing.
    getProjectSummary: builder.query({
      query: (arg) => {
        const { id, ...area } = typeof arg === 'object' ? arg : { id: arg };
        const q = new URLSearchParams(
          Object.entries(area).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString();
        return `projects/${id}/summary${q ? `?${q}` : ''}`;
      },
      providesTags: ['Summary'],
    }),
    createProject: builder.mutation({
      query: (body) => ({ url: 'projects', method: 'POST', body }),
      invalidatesTags: ['Projects'],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `projects/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Projects'],
    }),
    deleteProject: builder.mutation({
      query: (id) => ({ url: `projects/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Projects'],
    }),

    // ─── Layered map (project-scoped) ──────────────────────────
    getAssetMap: builder.query({
      query: ({ projectId, status = 'PUBLISHED', ...area }) => {
        const p = new URLSearchParams({ project_id: projectId, status });
        for (const col of ['zone_id', 'ward_id', 'locality_id']) {
          if (area[col]) p.set(col, area[col]);
        }
        return `assets/map?${p.toString()}`;
      },
      providesTags: ['Features'],
    }),

    // Per-layer feature/status aggregates (optionally scoped by ward/project).
    getAssetStats: builder.query({
      query: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return `assets/stats${q ? `?${q}` : ''}`;
      },
      providesTags: ['Summary'],
    }),

    // ─── Property tax (computed from the survey; admin approves) ───
    getPropertyTax: builder.query({
      query: (propertyId) => `tax/property/${propertyId}`,
      providesTags: ['Tax'],
    }),
    approvePropertyTax: builder.mutation({
      query: (propertyId) => ({ url: `tax/property/${propertyId}/approve`, method: 'POST' }),
      invalidatesTags: ['Tax'],
    }),

    // ─── Upload workflow ───────────────────────────────────────
    getUploads: builder.query({
      query: (projectId) => `assets/uploads?project_id=${projectId}`,
      providesTags: ['Uploads'],
    }),
    // Every survey recorded against one feature, with surveyor names, photos
    // and the layer's question schema for labelling the answers.
    getFeatureSurveys: builder.query({
      query: (featureId) => `assets/features/${featureId}/surveys`,
      providesTags: ['Features'],
    }),

    // Optional { zone_id, ward_id, locality_id } narrows a staged batch to one
    // area while it's being reviewed.
    getUploadFeatures: builder.query({
      query: (arg) => {
        const { uploadId, ...area } = typeof arg === 'object' ? arg : { uploadId: arg };
        const p = new URLSearchParams();
        for (const col of ['zone_id', 'ward_id', 'locality_id']) {
          if (area[col]) p.set(col, area[col]);
        }
        const q = p.toString();
        return `assets/uploads/${uploadId}/features${q ? `?${q}` : ''}`;
      },
      providesTags: ['Features'],
    }),
    // Body: { feature_code?, properties?, status?, geometry?, ward_id?, polygon_id? }
    updateFeature: builder.mutation({
      query: ({ id, ...body }) => ({ url: `assets/features/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Features', 'Summary'],
    }),
    deleteFeature: builder.mutation({
      query: (id) => ({ url: `assets/features/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Features', 'Summary'],
    }),
    // Multipart: pass { layerId, formData } where formData is a FormData with
    // fields file, project_id (+ optional notes). Zone/ward/locality are
    // matched from each feature's geometry server-side, not sent from here.
    uploadAssetFile: builder.mutation({
      query: ({ layerId, formData }) => ({
        url: `assets/layers/${layerId}/uploads`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Uploads', 'Summary'],
    }),
    // Multipart: formData with fields file, project_id. Creates Polygon
    // (parcel) records — separate from the layer upload above. Each parcel is
    // stamped with the ward/zone/locality its geometry falls in.
    uploadPropertyFile: builder.mutation({
      query: (formData) => ({
        url: `assets/uploads/property`,
        method: 'POST',
        body: formData,
      }),
    }),
    // Re-stamp zone/ward/locality on a batch already imported — for features
    // uploaded before their ward boundary existed.
    matchUploadAreas: builder.mutation({
      query: (uploadId) => ({ url: `assets/uploads/${uploadId}/match-areas`, method: 'POST' }),
      invalidatesTags: ['Uploads', 'Features', 'Summary'],
    }),
    verifyUpload: builder.mutation({
      query: (uploadId) => ({ url: `assets/uploads/${uploadId}/verify`, method: 'POST' }),
      invalidatesTags: ['Uploads', 'Features', 'Summary'],
    }),
    publishUpload: builder.mutation({
      query: (uploadId) => ({ url: `assets/uploads/${uploadId}/publish`, method: 'POST' }),
      invalidatesTags: ['Uploads', 'Features', 'Summary'],
    }),
    rejectUpload: builder.mutation({
      query: (uploadId) => ({ url: `assets/uploads/${uploadId}/reject`, method: 'POST' }),
      invalidatesTags: ['Uploads', 'Features', 'Summary'],
    }),
    deleteUpload: builder.mutation({
      query: (uploadId) => ({ url: `assets/uploads/${uploadId}`, method: 'DELETE' }),
      invalidatesTags: ['Uploads', 'Features', 'Summary'],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useCreateLayerMutation,
  useUpdateLayerMutation,
  useDeleteLayerMutation,
  useSearchFeaturesMutation,
  useGetProjectsQuery,
  useGetProjectQuery,
  useGetProjectSummaryQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetAssetMapQuery,
  useGetAssetStatsQuery,
  useGetPropertyTaxQuery,
  useApprovePropertyTaxMutation,
  useGetUploadsQuery,
  useGetUploadFeaturesQuery,
  useGetFeatureSurveysQuery,
  useUpdateFeatureMutation,
  useDeleteFeatureMutation,
  useUploadAssetFileMutation,
  useUploadPropertyFileMutation,
  useVerifyUploadMutation,
  usePublishUploadMutation,
  useRejectUploadMutation,
  useDeleteUploadMutation,
  useMatchUploadAreasMutation,
} = assetApi;
