import { useDispatch, useSelector } from 'react-redux';

// Export pre-typed hooks for better usage
export const useAppDispatch = () => useDispatch();
export const useAppSelector = (selector) => useSelector(selector);
