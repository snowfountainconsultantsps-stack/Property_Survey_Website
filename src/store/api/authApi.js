import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Define authentication API
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/',
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Users'],
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: 'auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation({
      query: (userData) => ({
        url: 'auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    logout: builder.mutation({
      query: () => ({
        url: 'auth/logout',
        method: 'POST',
      }),
    }),
    getCurrentUser: builder.query({
      query: () => 'auth/me',
    }),
    refreshToken: builder.mutation({
      query: () => ({
        url: 'auth/refresh',
        method: 'POST',
      }),
    }),

    // ─── Admin: user management ─────────────────────────────────
    getAllUsers: builder.query({
      query: () => 'auth/users',
      providesTags: ['Users'],
    }),
    createUser: builder.mutation({
      query: (userData) => ({
        url: 'auth/users',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['Users'],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({ url: `auth/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Users'],
    }),
    updateUserStatus: builder.mutation({
      query: ({ id, is_active }) => ({
        url: `auth/users/${id}/status`,
        method: 'PUT',
        body: { is_active },
      }),
      invalidatesTags: ['Users'],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useRefreshTokenMutation,
  useGetAllUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
  useUpdateUserStatusMutation,
} = authApi;
