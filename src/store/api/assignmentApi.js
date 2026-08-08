import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// ──────────────────────────────────────────────────────────────
// assignmentApi — which areas each surveyor may work in, and how they're
// progressing. Mirrors the backend under /api/assignments.
// ──────────────────────────────────────────────────────────────
export const assignmentApi = createApi({
  reducerPath: 'assignmentApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Assignments', 'Performance'],
  endpoints: (builder) => ({
    getAssignments: builder.query({
      query: (userId) => `assignments${userId ? `?user_id=${userId}` : ''}`,
      providesTags: ['Assignments'],
    }),
    getPerformance: builder.query({
      query: () => 'assignments/performance',
      providesTags: ['Performance'],
    }),
    // body: { user_id, level: 'ZONE'|'WARD'|'LOCALITY', zone_id|ward_id|locality_id }
    createAssignment: builder.mutation({
      query: (body) => ({ url: 'assignments', method: 'POST', body }),
      invalidatesTags: ['Assignments', 'Performance'],
    }),
    deleteAssignment: builder.mutation({
      query: (id) => ({ url: `assignments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Assignments', 'Performance'],
    }),
  }),
});

export const {
  useGetAssignmentsQuery,
  useGetPerformanceQuery,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
} = assignmentApi;
