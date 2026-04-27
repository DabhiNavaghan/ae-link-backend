'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { generateSlug } from '@/lib/utils/slug';
import { SmartLinkApi } from '@/lib/api';

const api = new SmartLinkApi();

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
            className="font-medium mb-4"
            style={{ color: 'var(--color-primary)' }}
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>New Campaign</h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Create a new campaign to organize and track your links
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              {/* Campaign Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Summer Festival 2024"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-primary)' } as any}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Give your campaign a descriptive name
                </p>
              </div>

              {/* Slug */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  Slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/c/
                  </span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="summer-festival-2024"
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-primary)' } as any}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Auto-generated from campaign name. Only letters, numbers, and
                  hyphens.
                </p>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
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
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-primary)' } as any}
                />
              </div>

              {/* Fallback URL */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
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
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-primary)' } as any}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Where users are redirected if no destination URL is found
                </p>
              </div>
            </div>

            {/* Dates Section */}
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
                Campaign Duration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
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
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-primary)' } as any}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
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
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-primary)' } as any}
                  />
                </div>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
                Custom Metadata
              </h3>

              <div className="space-y-4">
                {Object.entries(formData.metadata).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {key}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMetadata(key)}
                      className="px-3 py-1 text-sm rounded"
                      style={{ color: 'var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
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
                    className="flex-1 px-4 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)' }}
                  />
                  <input
                    type="text"
                    value={metadataValue}
                    onChange={(e) => setMetadataValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-4 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)' }}
                  />
                  <button
                    type="button"
                    onClick={addMetadata}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition"
                    style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
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
            <div className="rounded-lg shadow-sm p-6 sticky top-8" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Preview
              </h3>

              <div className="rounded-lg p-4 space-y-3 border" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                {formData.name ? (
                  <>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Campaign Name</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                        {formData.name}
                      </p>
                    </div>

                    <div className="pt-3" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>URL Path</p>
                      <p className="text-sm font-mono break-all" style={{ color: 'var(--color-primary)' }}>
                        {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/c/{formData.slug || 'slug'}
                      </p>
                    </div>

                    {formData.description && (
                      <div className="pt-3" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Description</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {formData.description}
                        </p>
                      </div>
                    )}

                    {formData.startDate && formData.endDate && (
                      <div className="pt-3" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Duration</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {new Date(formData.startDate).toLocaleDateString()}{' '}
                          to{' '}
                          {new Date(formData.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {Object.keys(formData.metadata).length > 0 && (
                      <div className="pt-3" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Metadata</p>
                        <div className="space-y-1">
                          {Object.entries(formData.metadata).map(
                            ([key, value]) => (
                              <p key={key} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
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
                  <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-tertiary)' }}>
                    Fill in campaign details to see preview
                  </p>
                )}
              </div>

              <p className="text-xs mt-4" style={{ color: 'var(--color-text-tertiary)' }}>
                Status will be set to{' '}
                <span className="font-medium" style={{ color: 'var(--color-success)' }}>Active</span>{' '}
                by default
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
