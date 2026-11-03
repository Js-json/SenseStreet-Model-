import React, { useState } from 'react';
import { FileWarning, Send, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { uploadHazard, getDeviceId } from '../services/hazardService';

const HAZARD_TYPES = [
  { value: 'pothole', label: '🕳️ Pothole', color: '#f59e0b' },
  { value: 'sudden_brake', label: '🛑 Sudden Brake Area', color: '#f97316' },
  { value: 'crash', label: '💥 Crash / Accident', color: '#ef4444' },
];

export default function Report() {
  const [formData, setFormData] = useState({
    type: 'pothole',
    description: '',
    latitude: '',
    longitude: '',
    intensity: 15,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setGettingLocation(false);
      },
      (err) => {
        setError('Could not get location: ' + err.message);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.latitude || !formData.longitude) {
      setError('Please provide location coordinates');
      return;
    }

    setIsSubmitting(true);
    try {
      await uploadHazard({
        type: formData.type,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        intensity: parseFloat(formData.intensity),
        source: 'manual',
        description: formData.description,
        deviceId: getDeviceId(),
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ type: 'pothole', description: '', latitude: '', longitude: '', intensity: 15 });
      }, 3000);
    } catch (err) {
      setError('Failed to submit report. Check Firebase configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container has-bottom-nav">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="page-content flex items-center justify-center" style={{ minHeight: '70vh' }}>
          <div className="glass-card p-10 text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-700" />
            </div>
            <h2 className="text-xl font-bold mb-2">Report Submitted!</h2>
            <p className="text-sm text-zinc-500">Your hazard report has been sent to the community map. Thank you for helping make roads safer.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container has-bottom-nav">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="page-content">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileWarning size={24} className="text-amber-600" />
              Report Hazard
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Manually report a road hazard you've encountered</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Hazard Type */}
            <div>
              <label className="form-label">Hazard Type</label>
              <div className="grid grid-cols-1 gap-2">
                {HAZARD_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`glass-card p-4 flex items-center gap-3 cursor-pointer transition-all ${
                      formData.type === t.value ? 'border-zinc-900 shadow-md' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={t.value}
                      checked={formData.type === t.value}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        formData.type === t.value ? 'border-zinc-900' : 'border-zinc-300'
                      }`}
                    >
                      {formData.type === t.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="form-label">Location</label>
              <button
                type="button"
                onClick={getLocation}
                disabled={gettingLocation}
                className="btn-secondary w-full mb-3 justify-center"
              >
                <MapPin size={16} />
                {gettingLocation ? 'Getting location...' : 'Use Current Location'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="Latitude"
                    className="form-input"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="Longitude"
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Intensity */}
            <div>
              <label className="form-label">Severity (1–50)</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  name="intensity"
                  min="1"
                  max="50"
                  value={formData.intensity}
                  onChange={handleChange}
                  className="flex-1 accent-zinc-900"
                />
                <span className="text-lg font-bold text-zinc-900 w-10 text-right">{formData.intensity}</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description (optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the hazard, road condition, etc."
                rows={3}
                className="form-input resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-4 text-base"
            >
              <Send size={18} />
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
