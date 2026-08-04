import { useState, useEffect, useMemo, startTransition } from 'react';
import { useAppSelector } from '../store/hooks';
import { useGetSurveyQuery, useGetSurveysByPolygonQuery, useUpdateSurveyMutation, useDeleteSurveyMutation } from '../store/api/surveyApi';
import { X, Save, Loader, ChevronDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SurveyDetailsEditor = ({ polygonId, polygonCode, onClose }) => {
  console.log('🔍 SurveyDetailsEditor mounted with:', { polygonId, polygonCode });
  
  const { data: surveysData, isLoading: isFetchingSurveys, error: surveysError } = useGetSurveysByPolygonQuery(polygonId, {
    skip: !polygonId,
  });
  
  useEffect(() => {
    console.log('📊 Surveys Query Result:', { surveysData, isFetchingSurveys, surveysError });
  }, [surveysData, isFetchingSurveys, surveysError]);
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);
  const { data: surveyData, isLoading: isFetchingSurvey, error: surveyError } = useGetSurveyQuery(selectedSurveyId, {
    skip: !selectedSurveyId,
  });
  const [updateSurvey, { isLoading: isSaving }] = useUpdateSurveyMutation();
  const [deleteSurvey, { isLoading: isDeleting }] = useDeleteSurveyMutation();
  const [formData, setFormData] = useState({});
  const [isModified, setIsModified] = useState(false);
  
  // Get user role from Redux store
  const { user } = useAppSelector((state) => state.auth);
  const isGisAdmin = user?.role === 'GIS_ADMIN';

  // Get first survey ID when surveys load (memoized to prevent re-renders)
  const firstSurveyId = useMemo(() => {
    return surveysData?.surveys?.[0]?.id || null;
  }, [surveysData?.surveys]);

  // Update selected survey when first survey ID changes
  useEffect(() => {
    if (firstSurveyId && !selectedSurveyId) {
      startTransition(() => {
        setSelectedSurveyId(firstSurveyId);
      });
    }
  }, [firstSurveyId, selectedSurveyId]);

  useEffect(() => {
    if (surveyData?.survey) {
      startTransition(() => {
        setFormData(surveyData.survey);
        setIsModified(false);
      });
    }
  }, [surveyData?.survey]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setIsModified(true);
  };

  const handleSurveyChange = (e) => {
    const surveyId = parseInt(e.target.value);
    setSelectedSurveyId(surveyId);
    setIsModified(false);
  };

  const handleSave = async () => {
    try {
      await updateSurvey({
        surveyId: selectedSurveyId,
        data: formData,
      }).unwrap();
      toast.success('Survey updated successfully');
      setIsModified(false);
    } catch (err) {
      console.error('Update error:', err);
      toast.error(`Error updating survey: ${err.data?.message || err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this survey? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteSurvey(selectedSurveyId).unwrap();
      toast.success('Survey deleted successfully');
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(`Error deleting survey: ${err.data?.message || err.message}`);
    }
  };

  if (isFetchingSurveys) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400">Loading surveys...</p>
        </div>
      </div>
    );
  }

  if (surveysError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
        <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error loading surveys</p>
        <p className="text-sm text-red-500 dark:text-red-400">{surveysError.data?.message || 'Failed to load surveys'}</p>
      </div>
    );
  }

  if (!surveysData?.surveys || surveysData.surveys.length === 0) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900 rounded-lg">
        <p className="text-yellow-700 dark:text-yellow-400 font-medium">No surveys found for this polygon</p>
      </div>
    );
  }

  const isLoading = isFetchingSurvey;
  const error = surveyError;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex justify-between items-center rounded-t-lg">
        <div>
          <h3 className="text-lg font-bold">Survey Details</h3>
          <p className="text-blue-100 text-sm">Polygon: {polygonCode}</p>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-blue-500 p-2 rounded transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Survey Selector */}
      <div className="bg-gray-100 dark:bg-gray-900/60 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Survey ({surveysData.surveys.length} available)
        </label>
        <div className="relative">
          <select
            value={selectedSurveyId || ''}
            onChange={handleSurveyChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            {surveysData.surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                Survey #{survey.id} - {survey.survey_status || 'DRAFT'} - {new Date(survey.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Form Content */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">Loading survey details...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg m-4">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error loading survey</p>
          <p className="text-sm text-red-500 dark:text-red-400">{error.data?.message || 'Failed to load survey details'}</p>
        </div>
      ) : !formData.id ? (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900 rounded-lg m-4">
          <p className="text-yellow-700 dark:text-yellow-400 font-medium">No survey details available</p>
        </div>
      ) : (
        <div className="p-6">
          {/* Basic Survey Info Section */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Survey Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Survey Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Survey Date</label>
                <input
                  type="date"
                  name="survey_date"
                  value={formData.survey_date ? formData.survey_date.split('T')[0] : ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Survey Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Survey Status</label>
                <select
                  name="survey_status"
                  value={formData.survey_status || 'DRAFT'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Property Unit Information */}
          {formData.PropertyUnit && (
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Property Unit Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Unit Number</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formData.PropertyUnit.unit_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Floor Number</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formData.PropertyUnit.floor_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Usage Type</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formData.PropertyUnit.usage_type || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Owner & Contact Information */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Owner & Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner Name</label>
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter owner name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  name="mobile_number"
                  value={formData.mobile_number || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter mobile number"
                />
              </div>
            </div>
          </div>

          {/* Occupancy & Utilities */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Occupancy & Utilities</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Occupancy Status</label>
                <select
                  name="occupancy_status"
                  value={formData.occupancy_status || 'SELF'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SELF">Self Occupied</option>
                  <option value="RENTED">Rented</option>
                  <option value="VACANT">Vacant</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Road Width (meters)</label>
                <input
                  type="number"
                  name="road_width"
                  value={formData.road_width || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter road width"
                  step="0.1"
                />
              </div>
            </div>

            {/* Utilities Checkboxes */}
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Utilities Available</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="water_connection"
                    checked={formData.water_connection || false}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Water</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="electricity_connection"
                    checked={formData.electricity_connection || false}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Electricity</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="sewer_connection"
                    checked={formData.sewer_connection || false}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Sewer</span>
                </label>
              </div>
            </div>
          </div>

          {/* Non-Residential Details */}
          {formData.NonResidentialDetail && (
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Non-Residential Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50 dark:bg-amber-950/40 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Business Name</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formData.NonResidentialDetail.business_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Ownership Type</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formData.NonResidentialDetail.ownership_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Operational Status</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formData.NonResidentialDetail.operational_status || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Non-Residential Subtype Details */}
          {formData.NonResidentialSubtypeDetail && (
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Business Subtype</h4>
              <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Subtype</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{formData.NonResidentialSubtypeDetail.subtype || 'N/A'}</p>
                {formData.NonResidentialSubtypeDetail.extra_attributes && Object.keys(formData.NonResidentialSubtypeDetail.extra_attributes).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">Additional Attributes</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(formData.NonResidentialSubtypeDetail.extra_attributes).map(([key, value]) => (
                        <span key={key} className="text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded border border-purple-200 dark:border-purple-800">
                          <strong>{key}:</strong> {String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Survey Images */}
          {formData.SurveyImages && formData.SurveyImages.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4">Survey Images</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.SurveyImages.map((image, index) => (
                  <div key={index} className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <img
                      src={image.image_url}
                      alt={`Survey ${index + 1}`}
                      className="w-full h-32 object-cover hover:scale-110 transition-transform cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer with Actions */}
      {formData.id && (
        <div className="bg-gray-50 dark:bg-gray-900/60 px-6 py-4 border-t border-gray-200 dark:border-gray-700 rounded-b-lg flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            {isGisAdmin && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium text-sm text-white ${
                  isDeleting
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 cursor-pointer'
                }`}
                title="Delete this survey (GIS_ADMIN only)"
              >
                {isDeleting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Survey
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition font-medium text-sm"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={!isModified || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium text-sm text-white ${
                isModified && !isSaving
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyDetailsEditor;
