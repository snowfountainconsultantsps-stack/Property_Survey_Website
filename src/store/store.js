import { configureStore } from '@reduxjs/toolkit';
import { authApi, surveyApi, assetApi, boundaryApi, locationApi } from './api';
import { authReducer } from './slices';

export const store = configureStore({
  reducer: {
    // Auth API reducer
    [authApi.reducerPath]: authApi.reducer,
    // Survey API reducer
    [surveyApi.reducerPath]: surveyApi.reducer,
    // Asset / Project API reducer
    [assetApi.reducerPath]: assetApi.reducer,
    // Location boundary API reducer
    [boundaryApi.reducerPath]: boundaryApi.reducer,
    // Location hierarchy CRUD reducer
    [locationApi.reducerPath]: locationApi.reducer,
    // Auth slice reducer
    auth: authReducer,
  },
  // Adding the api middleware enables caching, invalidation, polling,
  // and other useful features of `rtk-query`
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(surveyApi.middleware)
      .concat(assetApi.middleware)
      .concat(boundaryApi.middleware)
      .concat(locationApi.middleware),
});
