import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Define survey API for website
export const surveyApi = createApi({
  reducerPath: 'surveyApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Surveys'],
  endpoints: (builder) => ({
    // Location hierarchy — State → District → City → Ward.
    getStates: builder.query({
      query: () => 'surveys/states',
    }),
    getDistricts: builder.query({
      query: (stateId) => `surveys/districts${stateId ? `?state_id=${stateId}` : ''}`,
    }),
    getCities: builder.query({
      query: (districtId) => `surveys/cities${districtId ? `?district_id=${districtId}` : ''}`,
    }),
    getZones: builder.query({
      query: (cityId) => `surveys/zones${cityId ? `?city_id=${cityId}` : ''}`,
    }),
    // Get wards, optionally filtered by city
    getWards: builder.query({
      query: (cityId) => `surveys/wards${cityId ? `?city_id=${cityId}` : ''}`,
    }),
    // Wards within one zone — zone is a ward's real parent.
    getWardsByZone: builder.query({
      query: (zoneId) => `surveys/wards${zoneId ? `?zone_id=${zoneId}` : ''}`,
    }),

    // Get single survey by ID
    getSurvey: builder.query({
      query: (surveyId) => `surveys/${surveyId}`,
      providesTags: ['Surveys'],
    }),

    // Get surveys by polygon ID
    getSurveysByPolygon: builder.query({
      query: (polygonId) => `surveys/polygon/${polygonId}`,
      providesTags: ['Surveys'],
    }),

    // Full property tree for a polygon — owners, utilities, roads, photos,
    // building → floors → (utilities, occupancy, units → owners, utilities, photos).
    getPropertiesByPolygon: builder.query({
      query: (polygonId) => `surveys/polygons/${polygonId}/properties`,
      providesTags: ['Surveys'],
    }),

    // Get surveys by polygon code
    getSurveysByPolygonCode: builder.query({
      query: (polygonCode) => `surveys/polygon/code/${polygonCode}`,
      providesTags: ['Surveys'],
    }),

    // Update survey
    updateSurvey: builder.mutation({
      query: ({ surveyId, data }) => ({
        url: `surveys/${surveyId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Surveys'],
    }),

    // Delete survey
    deleteSurvey: builder.mutation({
      query: (surveyId) => ({
        url: `surveys/${surveyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Surveys'],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetStatesQuery,
  useGetDistrictsQuery,
  useGetCitiesQuery,
  useGetZonesQuery,
  useGetWardsQuery,
  useGetWardsByZoneQuery,
  useGetSurveyQuery,
  useGetSurveysByPolygonQuery,
  useGetPropertiesByPolygonQuery,
  useGetSurveysByPolygonCodeQuery,
  useUpdateSurveyMutation,
  useDeleteSurveyMutation,
} = surveyApi;
