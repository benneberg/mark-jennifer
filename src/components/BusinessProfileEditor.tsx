import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { getDefaultBusinessProfile } from '../storage/entities';
import type { BusinessProfile } from '../types';
import { nowIso } from '../utils/dates';
import { ConfirmModal } from './ConfirmModal';

interface BusinessProfileEditorProps {
  profile: BusinessProfile;
  onSaveProfile: (next: BusinessProfile) => Promise<void>;
  onResetProfile: () => Promise<void>;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

export function BusinessProfileEditor({
  profile,
  onSaveProfile,
  onResetProfile,
  onNotify,
}: BusinessProfileEditorProps) {
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [ownersText, setOwnersText] = useState(profile.owners.join(', '));
  const [location, setLocation] = useState(profile.location);
  const [tagline, setTagline] = useState(profile.tagline);
  const [website, setWebsite] = useState(profile.website);
  const [accommodation, setAccommodation] = useState(profile.accommodation);
  const [unitCapacityGuests, setUnitCapacityGuests] = useState(
    String(profile.unitCapacityGuests)
  );
  const [defaultRateSek, setDefaultRateSek] = useState(
    String(profile.defaultRatePerPersonNightSek)
  );
  const [offeringsText, setOfferingsText] = useState(profile.offerings.join('\n'));
  const [extrasText, setExtrasText] = useState(profile.extras.join('\n'));
  const [pressText, setPressText] = useState(profile.verifiedPress.join('\n'));
  const [voice, setVoice] = useState(profile.voice);
  const [channelsText, setChannelsText] = useState(profile.defaultChannels.join(', '));
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    setBusinessName(profile.businessName);
    setOwnersText(profile.owners.join(', '));
    setLocation(profile.location);
    setTagline(profile.tagline);
    setWebsite(profile.website);
    setAccommodation(profile.accommodation);
    setUnitCapacityGuests(String(profile.unitCapacityGuests));
    setDefaultRateSek(String(profile.defaultRatePerPersonNightSek));
    setOfferingsText(profile.offerings.join('\n'));
    setExtrasText(profile.extras.join('\n'));
    setPressText(profile.verifiedPress.join('\n'));
    setVoice(profile.voice);
    setChannelsText(profile.defaultChannels.join(', '));
  }, [profile]);

  const toLines = (val: string) =>
    val
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

  const toCommaList = (val: string) =>
    val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaults = getDefaultBusinessProfile();
    const capacity = Number(unitCapacityGuests);
    const rate = Number(defaultRateSek);

    const next: BusinessProfile = {
      businessName: businessName.trim() || defaults.businessName,
      owners: toCommaList(ownersText),
      location: location.trim() || defaults.location,
      tagline: tagline.trim() || defaults.tagline,
      website: website.trim() || defaults.website,
      accommodation: accommodation.trim() || defaults.accommodation,
      unitCapacityGuests: Number.isFinite(capacity) && capacity >= 1 ? Math.round(capacity) : 2,
      defaultRatePerPersonNightSek:
        Number.isFinite(rate) && rate >= 0 ? Math.round(rate) : 0,
      offerings: toLines(offeringsText),
      extras: toLines(extrasText),
      verifiedPress: toLines(pressText),
      voice: voice.trim() || defaults.voice,
      defaultChannels: toCommaList(channelsText),
      updatedAt: nowIso(),
    };

    try {
      await onSaveProfile(next);
      onNotify('Business profile saved.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save business profile', 'danger');
    }
  };

  const handleConfirmReset = async () => {
    await onResetProfile();
    setResetOpen(false);
    onNotify('Reset business profile to defaults.', 'info');
  };

  const fieldCls =
    'w-full p-3 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none';

  return (
    <form onSubmit={handleSave} className="space-y-4 pb-8">
      <div className="p-4 rounded-[22px] bg-[var(--sand)] dark:bg-[#1C1C1A] border border-[var(--border)] text-xs text-[#181817] dark:text-[#F4EFE4] space-y-1">
        <div className="font-semibold">Factual Business Baseline</div>
        <p className="opacity-80 leading-relaxed">
          All campaigns, modules, and Jennifer replies draw facts, rates, offerings, and verified
          press from here instead of guessing.
        </p>
      </div>

      <div className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Business Name
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={`min-h-[42px] ${fieldCls}`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Owners (comma-separated)
            </label>
            <input
              type="text"
              value={ownersText}
              onChange={(e) => setOwnersText(e.target.value)}
              className={`min-h-[42px] ${fieldCls}`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={`min-h-[42px] ${fieldCls}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Tagline
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={`min-h-[42px] ${fieldCls}`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Unit Capacity (guests)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={unitCapacityGuests}
              onChange={(e) => setUnitCapacityGuests(e.target.value)}
              className={`min-h-[42px] font-mono-tabular ${fieldCls}`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Standard Rate (SEK / person / night)
            </label>
            <input
              type="number"
              min={0}
              step={50}
              value={defaultRateSek}
              onChange={(e) => setDefaultRateSek(e.target.value)}
              className={`min-h-[42px] font-mono-tabular ${fieldCls}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Accommodation Description
          </label>
          <textarea
            rows={2}
            value={accommodation}
            onChange={(e) => setAccommodation(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Core Offerings (one per line)
          </label>
          <textarea
            rows={4}
            value={offeringsText}
            onChange={(e) => setOfferingsText(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Verified Press &amp; Accolades (one per line)
          </label>
          <textarea
            rows={3}
            value={pressText}
            onChange={(e) => setPressText(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Extras / Included Details (one per line)
          </label>
          <textarea
            rows={2}
            value={extrasText}
            onChange={(e) => setExtrasText(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Brand Voice
          </label>
          <textarea
            rows={2}
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Default Channels (comma-separated)
          </label>
          <input
            type="text"
            value={channelsText}
            onChange={(e) => setChannelsText(e.target.value)}
            className={`min-h-[42px] ${fieldCls}`}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Website
          </label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className={`min-h-[42px] ${fieldCls}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset defaults</span>
        </button>

        <button
          type="submit"
          className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)]"
        >
          Save Profile
        </button>
      </div>

      <ConfirmModal
        open={resetOpen}
        title="Reset business profile to defaults?"
        description="This restores the default Hedetangen business profile facts and rates."
        confirmLabel="Reset"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetOpen(false)}
      />
    </form>
  );
}
