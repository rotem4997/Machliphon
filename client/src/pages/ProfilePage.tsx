import { useState, useRef } from 'react';
import { Camera, Save, X, Edit3, Phone, Mail, MapPin, Building } from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSubstitute = user?.role === 'substitute';

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '054-1234567',
    address: isSubstitute ? 'רחוב הרצל 15, תל אביב' : '',
    education: isSubstitute ? 'תואר ראשון בחינוך' : '',
    photoUrl: '',
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (form.photoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(form.photoUrl);
      }
      const url = URL.createObjectURL(file);
      setForm(prev => ({ ...prev, photoUrl: url }));
      toast.success('תמונה הועלתה');
    }
  };

  const handleSave = () => {
    setEditing(false);
    toast.success('הפרופיל עודכן בהצלחה');
  };

  const roleName = {
    substitute: 'מחליפה',
    manager: 'מנהלת / מדריכה',
    authority_admin: 'מנהל/ת רשות',
    super_admin: 'מנהל/ת מערכת',
  }[user?.role || 'manager'];

  return (
    <div className="max-w-2xl mx-auto fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-navy-900">פרופיל</h1>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Edit3 size={16} />
            עריכה
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={16} />
              שמור
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2 text-sm text-red-500">
              <X size={16} />
              ביטול
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="card p-6">
        {/* Photo + Name */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-navy-900 flex items-center justify-center overflow-hidden">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-mint-400">
                  {(form.firstName || 'מ')[0]}
                </span>
              )}
            </div>
            {editing && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -left-1 bg-mint-500 text-white rounded-full p-2 shadow-md hover:bg-mint-600"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </>
            )}
          </div>
          {!editing && (
            <>
              <h2 className="text-xl font-bold text-navy-900">{form.firstName} {form.lastName}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{roleName}</p>
              {user?.authorityName && (
                <p className="text-xs text-slate-400 mt-0.5">{user.authorityName}</p>
              )}
            </>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">שם פרטי</label>
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">שם משפחה</label>
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">אימייל</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">טלפון</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              {isSubstitute && (
                <>
                  <div>
                    <label className="label">כתובת</label>
                    <input
                      className="input"
                      value={form.address}
                      onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">השכלה</label>
                    <input
                      className="input"
                      value={form.education}
                      onChange={e => setForm(prev => ({ ...prev, education: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="flex items-center gap-3 py-3">
                <Mail size={16} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500">אימייל</p>
                  <p className="text-sm font-medium text-navy-900">{form.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3">
                <Phone size={16} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500">טלפון</p>
                  <p className="text-sm font-medium text-navy-900">{form.phone}</p>
                </div>
              </div>
              {user?.authorityName && (
                <div className="flex items-center gap-3 py-3">
                  <Building size={16} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">רשות</p>
                    <p className="text-sm font-medium text-navy-900">{user.authorityName}</p>
                  </div>
                </div>
              )}
              {isSubstitute && form.address && (
                <div className="flex items-center gap-3 py-3">
                  <MapPin size={16} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">כתובת</p>
                    <p className="text-sm font-medium text-navy-900">{form.address}</p>
                  </div>
                </div>
              )}
              {isSubstitute && form.education && (
                <div className="flex items-center gap-3 py-3">
                  <Building size={16} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">השכלה</p>
                    <p className="text-sm font-medium text-navy-900">{form.education}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
