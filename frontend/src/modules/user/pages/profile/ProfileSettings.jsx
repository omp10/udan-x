import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Smartphone, Camera, CheckCircle2, Loader2, ImagePlus } from 'lucide-react';
import { userAuthService } from '../../services/authService';
import { useImageUpload } from '../../../../shared/hooks/useImageUpload';
import { Badge, Button, Input, Skeleton } from '../../components/ui';
import toast from 'react-hot-toast';

const ProfileSettings = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const navigate = useNavigate();

  const {
    uploading: photoUploading,
    preview: photoPreview,
    handleFileChange: onPhotoFileChange,
  } = useImageUpload({
    folder: 'user-profiles',
    onSuccess: (url) => setProfileImage(url)
  });

  const avatarSrc = useMemo(() => {
    return (
      photoPreview ||
      profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=E85D04&color=fff`
    );
  }, [name, profileImage, photoPreview]);

  useEffect(() => {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch {
      stored = {};
    }
    if (stored?.name) setName(stored.name);
    if (stored?.email) setEmail(stored.email);
    if (stored?.phone) setPhone(stored.phone);
    if (stored?.profileImage) setProfileImage(stored.profileImage);

    const loadProfile = async () => {
      try {
        const response = await userAuthService.getCurrentUser();
        const user = response?.data?.user || {};
        setName(user.name || stored?.name || '');
        setEmail(user.email || stored?.email || '');
        setPhone(user.phone || stored?.phone || '');
        setProfileImage(user.profileImage || stored?.profileImage || '');
        localStorage.setItem('userInfo', JSON.stringify(user));
      } catch {
        setName((prev) => prev || '');
        setEmail((prev) => prev || '');
        setPhone((prev) => prev || '');
        setProfileImage((prev) => prev || stored?.profileImage || '');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const response = await userAuthService.updateCurrentUser({
        name,
        email,
        profileImage,
      });
      const user = response?.data?.user || {};
      localStorage.setItem('userInfo', JSON.stringify(user));
      toast.success('Profile updated successfully');
      const basePath = window.location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';
      navigate(`${basePath}/profile`);
    } catch (err) {
      setSaveError(err?.message || 'Save failed');
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const photoPickerClass = (variant) =>
    `relative flex h-11 items-center justify-center gap-2 rounded-control border text-[11px] font-bold uppercase tracking-wider transition-all ${
      photoUploading
        ? 'cursor-not-allowed border-line bg-surface-sunken text-ink-faint'
        : variant === 'primary'
          ? 'cursor-pointer border-transparent bg-brand text-white active:scale-[0.99]'
          : 'cursor-pointer border-line bg-surface text-ink active:scale-[0.99]'
    }`;

  return (
    <div className="relative flex min-h-screen max-w-lg mx-auto flex-col bg-surface-page font-sans text-ink">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-5 py-6 shadow-soft">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Back"
          onClick={() => navigate('/taxi/user/profile')}
          className="h-9 w-9 px-0"
        >
          <ArrowLeft size={18} strokeWidth={2.6} />
        </Button>
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.26em] text-ink-faint">Account settings</p>
          <h1 className="mt-1 text-[18px] font-black leading-none tracking-tight text-ink">Your Profile</h1>
        </div>
      </header>

      <div className="no-scrollbar flex-1 space-y-8 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-4 py-4">
              <Skeleton className="h-[110px] w-[110px] rounded-card-lg" />
              <Skeleton className="h-11 w-[280px] rounded-control" />
            </div>
            <Skeleton className="h-12 rounded-control" />
            <Skeleton className="h-12 rounded-control" />
            <Skeleton className="h-12 rounded-control" />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <div className="relative h-[110px] w-[110px] overflow-hidden rounded-card-lg border border-line bg-surface-sunken p-1.5 shadow-premium">
                  <img
                    src={avatarSrc}
                    className={`h-full w-full rounded-card object-cover ${photoUploading ? 'opacity-50 blur-[2px]' : ''}`}
                    alt="User"
                  />
                  {photoUploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="animate-spin text-brand" size={28} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 rounded-card border border-line bg-surface p-2.5 text-ink shadow-premium">
                  <Camera size={18} strokeWidth={2.5} />
                </div>
              </div>

              <div className="mt-1 grid w-full max-w-[280px] grid-cols-2 gap-2">
                <label className={photoPickerClass('secondary')}>
                  <ImagePlus size={14} />
                  Gallery
                  <input
                    type="file"
                    accept="image/*"
                    disabled={photoUploading}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Upload profile photo from gallery"
                    onChange={onPhotoFileChange}
                  />
                </label>
                <label className={photoPickerClass('primary')}>
                  <Camera size={14} />
                  Camera
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    disabled={photoUploading}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Capture profile photo"
                    onChange={onPhotoFileChange}
                  />
                </label>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">
                {photoUploading ? 'Optimizing for WebP...' : 'Change profile photo'}
              </p>
            </div>

            <div className="space-y-5">
              <Input
                label="Full name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                leftIcon={<User size={18} />}
              />

              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@example.com"
                leftIcon={<Mail size={18} />}
              />

              <div>
                <p className="mb-1.5 text-2xs font-black uppercase tracking-[0.2em] text-ink-faint">
                  Phone number
                </p>
                <div className="flex h-12 cursor-not-allowed items-center gap-3 rounded-control border border-line bg-surface-sunken px-4 opacity-80">
                  <Smartphone size={18} className="text-ink-faint" />
                  <span className="flex-1 text-sm font-bold text-ink-faint">
                    {phone ? `+91 ${phone}` : '+91'}
                  </span>
                  <Badge tone="success" icon={<CheckCircle2 size={11} />}>
                    Verified
                  </Badge>
                </div>
              </div>
            </div>

            {saveError && <p className="text-center text-sm font-bold text-rose-500">{saveError}</p>}
          </>
        )}
      </div>

      <div className="border-t border-line bg-surface p-5 pb-10">
        <Button
          block
          size="lg"
          loading={saving}
          disabled={loading || photoUploading}
          onClick={handleSave}
        >
          {saving ? 'Saving changes...' : 'Save profile'}
        </Button>
      </div>
    </div>
  );
};

export default ProfileSettings;
