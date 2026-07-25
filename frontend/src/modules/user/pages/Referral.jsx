import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Copy, Gift, Share2 } from 'lucide-react';
import { userAuthService } from '../services/authService';
import {
  getReferralSettingsContent,
  getReferralTranslationContent,
} from '../../shared/services/referralTranslationService';
import {
  applyReferralSettingPlaceholders,
  buildReferralPreviewBlocks,
  getStoredReferralLanguageCode,
  USER_REFERRAL_TRANSLATION_FIELDS,
} from '../../shared/utils/referralTranslationFields';
import { useSettings } from '../../../shared/context/SettingsContext';
import { Button, Card, Skeleton } from '../components/ui';

const MotionDiv = motion.div;


const readStoredUserInfo = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo') || '{}');
  } catch {
    return {};
  }
};

const LEGACY_BRAND_REGEX = /\bzyder\b/gi;

const replaceLegacyReferralBrand = (value, appName) => {
  const safeAppName = String(appName || '').trim() || 'App';
  return String(value || '').replace(LEGACY_BRAND_REGEX, safeAppName);
};

const Referral = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('refer');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(() => {
    const stored = readStoredUserInfo();
    return {
      referralCode: stored.referralCode || '',
      referralCount: Number(stored.referralCount || 0),
    };
  });
  const [translation, setTranslation] = useState({
    language_code: 'en',
    user_referral: {
      instant_referrer_user: '',
      instant_referrer_user_and_new_user: '',
      conditional_referrer_user_ride_count: '',
      conditional_referrer_user_earnings: '',
      dual_conditional_referrer_user_and_new_user_ride_count: '',
      dual_conditional_referrer_user_and_new_user_earnings: '',
      banner_text: '',
    },
  });

  useEffect(() => {
    const loadReferralPage = async () => {
      setLoading(true);

      const languageCode = getStoredReferralLanguageCode('user');
      const stored = readStoredUserInfo();
      const fallbackUserSection = {
        instant_referrer_user: '',
        instant_referrer_user_and_new_user: '',
        conditional_referrer_user_ride_count: '',
        conditional_referrer_user_earnings: '',
        dual_conditional_referrer_user_and_new_user_ride_count: '',
        dual_conditional_referrer_user_and_new_user_earnings: '',
        banner_text: '',
      };

      try {
        const [userResponse, translationResponse, settingsResponse] = await Promise.all([
          userAuthService.getCurrentUser(),
          getReferralTranslationContent(languageCode),
          getReferralSettingsContent('user'),
        ]);

        const user = userResponse?.data?.user || {};
        const translationData = translationResponse?.data || {};
        const settingsData = settingsResponse?.data || {};
        const hydratedUserReferral = applyReferralSettingPlaceholders(
          translationData.user_referral || fallbackUserSection,
          settingsData,
        );

        setProfile({
          referralCode: user.referralCode || stored.referralCode || '',
          referralCount: Number(user.referralCount || 0),
        });
        setTranslation({
          language_code: translationData.language_code || languageCode,
          user_referral: hydratedUserReferral,
        });

        localStorage.setItem(
          'userInfo',
          JSON.stringify({
            ...stored,
            referralCode: user.referralCode || '',
            referralCount: Number(user.referralCount || 0),
          }),
        );
      } catch {
        try {
          const [translationResponse, settingsResponse] = await Promise.all([
            getReferralTranslationContent(languageCode),
            getReferralSettingsContent('user'),
          ]);
          setTranslation({
            language_code: translationResponse?.data?.language_code || languageCode,
            user_referral: applyReferralSettingPlaceholders(
              translationResponse?.data?.user_referral || fallbackUserSection,
              settingsResponse?.data || {},
            ),
          });
        } catch {
          // Keep local fallback state.
        }
      } finally {
        setLoading(false);
      }
    };

    loadReferralPage();
  }, []);

  const appName = settings.general?.app_name || 'App';
  const referralCode = profile.referralCode || '';
  const normalizedUserReferral = Object.fromEntries(
    Object.entries(translation.user_referral || {}).map(([key, value]) => [
      key,
      replaceLegacyReferralBrand(value, appName),
    ]),
  );
  const bannerText = normalizedUserReferral.banner_text || `${appName} Refer and Earn`;
  const infoBlocks = buildReferralPreviewBlocks(
    normalizedUserReferral,
    USER_REFERRAL_TRANSLATION_FIELDS,
  );

  const handleCopy = async () => {
    if (!referralCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures silently.
    }
  };

  const handleShare = async () => {
    if (!referralCode) {
      return;
    }
    const signupLink = `${window.location.origin}/taxi/user/signup?ref=${encodeURIComponent(referralCode)}`;
    const shareText = `${bannerText}\nUse my referral code ${referralCode} to sign up.\n${signupLink}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: bannerText,
          text: shareText,
        });
        return;
      }
    } catch {
      // Fall through to desktop-friendly sharing options.
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures and continue to WhatsApp fallback.
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-surface-page pb-28 font-sans text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface px-5 pt-10 pb-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="h-9 w-9 px-0"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </Button>
          <div className="flex-1 pr-12 text-center">
            <h1 className="text-[19px] font-black tracking-tight text-ink">Referrals</h1>
          </div>
        </div>
      </header>

      <div className="px-5 pt-5">
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-soft px-5 py-5">
            <div className="min-w-0">
              <p className="text-2xl font-black leading-tight text-ink">{bannerText}</p>
              <p className="mt-1.5 text-[11px] font-bold text-ink-faint">
                Language: {translation.language_code?.toUpperCase() || 'EN'}
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand text-white">
              <Gift size={20} strokeWidth={2.4} />
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="rounded-control border border-dashed border-line bg-surface-sunken px-3 py-3 text-center">
                <p className="text-lg font-black tracking-wide text-ink">{referralCode || 'Not available'}</p>
                <p className="mt-1 text-2xs font-black uppercase tracking-wider text-ink-faint">
                  Your referral code
                </p>
              </div>
              <Button
                onClick={handleCopy}
                disabled={!referralCode}
                leftIcon={copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              >
                Copy
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1 rounded-control bg-surface-sunken p-1">
              {[
                { key: 'refer', label: 'Refer and earn' },
                { key: 'history', label: 'Referral history' },
              ].map((tab) => (
                <Button
                  key={tab.key}
                  size="sm"
                  variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-[340px] px-4 pb-4">
            {loading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-5 w-40 rounded-control" />
                <Skeleton lines={5} />
                <Skeleton lines={3} />
              </div>
            ) : activeTab === 'refer' ? (
              <div className="space-y-4">
                <h2 className="text-lg font-black text-ink">How it works?</h2>
                {infoBlocks.length === 0 ? (
                  <p className="text-sm font-medium text-ink-faint">
                    Referral content will appear here after admin updates this language.
                  </p>
                ) : (
                  infoBlocks.map((block) => (
                    <div
                      key={block.key}
                      className="prose prose-sm max-w-none text-sm leading-6 text-ink-soft dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: block.html }}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-card-lg border border-dashed border-line bg-surface-sunken px-5 py-8 text-center">
                <p className="text-sm font-bold text-ink-soft">Successful referrals</p>
                <p className="mt-2 text-4xl font-black text-ink">{profile.referralCount}</p>
                <p className="mt-2 text-xs font-medium text-ink-faint">
                  Detailed referral history is not available on this screen yet.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Button
          block
          size="lg"
          className="mt-5"
          onClick={handleShare}
          disabled={!referralCode}
          rightIcon={<Share2 size={16} />}
        >
          Refer now
        </Button>
      </div>

      <AnimatePresence>
        {copied ? (
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-card border border-line bg-surface px-4 py-3 text-xs font-bold text-ink shadow-premium"
          >
            Referral code copied
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Referral;
