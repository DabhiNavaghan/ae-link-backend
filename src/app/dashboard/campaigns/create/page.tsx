'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { generateSlug } from '@/lib/utils/slug';
import { AeLinkApi } from '@/lib/api';

const api = new AeLinkApi();

interface FormData {
  name: string;
  slug: string;
  description: string;
  fallbackUrl: string;
  startDate: string;
  endDate: string;
  metadata: Record<string, string>;
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    description: '',
    fallbackUrl: '',
    startDate: '',
    endDate: '',
    metadata: {},
  });
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
  };

  const handleSlugChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      slug: generateSlug(value),
    }));
  };

  const addMetadata = () => {
    if (metadataKey.trim()) {
      setFormData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataKey]: metadataValue,
        },
      }));
      setMetadataKey('');
      setMetadataValue('');
    }
  };

  const removeMetadata = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      metadata: Object.fromEntries(
        Object.entries(prev.metadata).filter(([k]) => k !== key)
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Campaign name is required');
      return;
    }

    if (!formData.slug.trim()) {
      setError('Slug is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        name: formData.name,
        slug: formData.slug,
      };

      if (formData.description) payload.description = formData.description;
      if (formData.fallbackUrl) payload.fallbackUrl = formData.fallbackUrl;
      if (formData.startDate) payload.startDate = formData.startDate;
      if (formData.endDate) payload.endDate = formData.endDate;
      if (Object.keys(formData.metadata).length > 0) {
        payload.metadata = formData.metadata;
      }

      const campaign = await api.createCampaign(payload);

      router.push(`/dashboard/campaigns/${campaign._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-primary-600 hover:text-primary-700 font-medium mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-slate-900">New Campaign</h1>
          <p className="text-slate-600 mt-2">
            Create a new campaign to organize and track your links
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-lg shadow-sm p-6">
              {/* Campaign Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Summer Festival 2024"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Give your campaign a descriptive name
                </p>
              </div>

              {/* Slug */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">
                    {typeof window !== 'undefined' ? window.location.host : 'aelink.vercel.app'}/c/
                  </span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="summer-festival-2024"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Auto-generated from campaign name. Only letters, numbers, and
                  hyphens.
                </p>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Add details about this campaign..."
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Fallback URL */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Fallback URL
                </label>
                <input
                  type="url"
                  value={formData.fallbackUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fallbackUrl: e.target.value,
                    }))
                  }
                  placeholder="https://allevents.in"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Where users are redirected if no destination URL is found
                </p>
              </div>
            </div>

            {/* Dates Section */}
            <div className="bg-card rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Campaign Duration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="bg-card rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Custom Metadata
              </h3>

              <div className="space-y-4">
                {Object.entries(formData.metadata).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {key}
                      </p>
                      <p className="text-sm text-slate-600">{value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMetadata(key)}
                      className="px-3 py-1 text-sm text-danger-600 hover:bg-danger-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={metadataKey}
                    onChange={(e) => setMetadataKey(e.target.value)}
                    placeholder="Key"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={metadataValue}
                    onChange={(e) => setMetadataValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={addMetadata}
                    className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 text-danger-800">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                type="submit"
                isLoading={loading}
                disabled={loading}
              >
                Create Campaign
              </Button>
            </div>
          </form>

          {/* Preview Card */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg shadow-sm p-6 sticky top-8">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Preview
              </h3>

              <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
                {formData.name ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-500">Campaign Name</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formData.name}
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500">URL Path</p>
                      <p className="text-sm font-mono text-primary-600 break-all">
                        {typeof window !== 'undefined' ? window.location.host : 'aelink.vercel.app'}/c/{formData.slug || 'slug'}
                      </p>
                    </div>

                    {formData.description && (
                      <div className="border-t border-slate-200 pt-3">
                        <p className="text-xs text-slate-500">Description</p>
                        <p className="text-sm text-slate-700">
                          {formData.description}
                        </p>
                      </div>
                    )}

                    {formData.startDate && formData.endDate && (
                      <div className="border-t border-slate-200 pt-3">
                        <p className="text-xs text-slate-500">Duration</p>
                        <p className="text-sm text-slate-700">
                          {new Date(formData.startDate).toLocaleDateString()}{' '}
                          to{' '}
                          {new Date(formData.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {Object.keys(formData.metadata).length > 0 && (
                      <div className="border-t border-slate-200 pt-3">
                        <p className="text-xs text-slate-500 mb-2">Metadata</p>
                        <div className="space-y-1">
                          {Object.entries(formData.metadata).map(
                            ([key, value]) => (
                              <p key={key} className="text-xs text-slate-600">
                                <span className="font-medium">{key}:</span>{' '}
                                {value}
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Fill in campaign details to see preview
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-4">
                Status will be set to{' '}
                <span className="font-medium text-success-600">Active</span>{' '}
                by default
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
