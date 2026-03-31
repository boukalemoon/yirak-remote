import React from 'react';
import { Shield, Lock, Zap, Heart, Monitor, Settings, User, Terminal, Globe, LogOut, Sun, ExternalLink, Copy, CheckCircle, QrCode, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import type { UserProfile, LogType, ConnectionEntry } from './lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

type Theme = 'otuken' | 'umay' | 'gok' | 'gece';
type Tab = 'dashboard' | 'connections' | 'settings';
type AuthMode = 'login' | 'register' | 'mfa' | 'reset';
interface LogEntryLocal { time: string; msg: string; type: LogType; }

const generateDeviceFingerprint = (): string => {
  const nav = window.navigator;
  const raw = [nav.userAgent, nav.language, screen.width + 'x' + screen.height, screen.colorDepth, new Date().getTimezoneOffset(), nav.hardwareConcurrency || 0].join('|');
  const hash = raw.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return Math.abs(hash).toString(36).toUpperCase();
};
const generateSessionToken = (): string => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
const formatId = (raw: string): string => { const clean = raw.replace(/\D/g, '').padStart(9, '0').slice(0, 9); return `${clean.slice(0,3)}-${clean.slice(3,6)}-${clean.slice(6,9)}`; };
const generateProfileId = (uid: string): string => { const hash = uid.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0); return formatId(Math.abs(hash).toString()); };
const getOrCreateGuestId = (): string => { const key = 'yirak_guest_id'; let id = localStorage.getItem(key); if (!id) { id = formatId(Math.abs(generateDeviceFingerprint().split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)).toString()); localStorage.setItem(key, id); } return id; };

const THEMES: { id: Theme; label: string; color: string; light?: boolean }[] = [
  { id: 'otuken', label: 'Ötüken', color: '#c5a059' },
  { id: 'umay', label: 'Umay', color: '#2e6fbf', light: true },
  { id: 'gok', label: 'Gök', color: '#64ffda' },
  { id: 'gece', label: 'Gece', color: '#ff0080' },
];

export default function App() {
  const [currentUser, setCurrentUser] = React.useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [theme, setTheme] = React.useState<Theme>('otuken');
  const [activeTab, setActiveTab] = React.useState<Tab>('dashboard');
  const [connFilter, setConnFilter] = React.useState<'all' | 'active' | 'timeout'>('all');
  const [connectionId, setConnectionId] = React.useState(() => getOrCreateGuestId());
  const [targetId, setTargetId] = React.useState('');
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [connectionHistory, setConnectionHistory] = React.useState<ConnectionEntry[]>([]);
  const [copied, setCopied] = React.useState(false);
  const [sessionToken, setSessionToken] = React.useState('');
  const [deviceFingerprint, setDeviceFingerprint] = React.useState('');
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [isGuest, setIsGuest] = React.useState(false);
  const [logs, setLogs] = React.useState<LogEntryLocal[]>([]);
  const [showAuth, setShowAuth] = React.useState(false);
  const [showDonation, setShowDonation] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [mfaCode, setMfaCode] = React.useState(['', '', '', '', '', '']);
  const [isMfaValidating, setIsMfaValidating] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [resetSent, setResetSent] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = React.useState('');
  const [passwordChangeError, setPasswordChangeError] = React.useState('');
  const [passwordChangeDone, setPasswordChangeDone] = React.useState(false);
  const [profileUpdateDone, setProfileUpdateDone] = React.useState(false);
  const mfaRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  React.useEffect(() => { if (showAuth && authMode === 'mfa') setTimeout(() => mfaRefs.current[0]?.focus(), 100); }, [showAuth, authMode]);
  React.useEffect(() => {
    const on = () => { setIsOnline(true); addLocalLog('İnternet bağlantısı kuruldu.', 'sys'); };
    const off = () => { setIsOnline(false); addLocalLog('İnternet bağlantısı kesildi.', 'warn'); };
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        const profileId = generateProfileId(user.id);
        setConnectionId(profileId);
        setSessionToken(generateSessionToken());
        const fp = generateDeviceFingerprint();
        setDeviceFingerprint(fp);
        await supabase.from('users').upsert({ id: user.id, email: user.email, connection_id: profileId, device_fingerprint: fp, last_seen: new Date().toISOString() }, { onConflict: 'id' });
        const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (profile) { setUserProfile(profile as UserProfile); if (profile.theme) setTheme(profile.theme as Theme); if (profile.display_name) setDisplayName(profile.display_name); if (profile.phone) setPhone(profile.phone); }
        fetchLogs(user.id); fetchConnections(user.id);
      } else {
        setUserProfile(null); setSessionToken(''); setDeviceFingerprint(''); setConnectionId(getOrCreateGuestId());
        setLogs([{ time: ts(), msg: 'Yırak v1.0.0 başlatıldı...', type: 'sys' }, { time: ts(), msg: 'Lütfen giriş yapın.', type: 'warn' }]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const ts = () => new Date().toLocaleTimeString('tr-TR');
  const addLocalLog = (msg: string, type: LogType = 'info') => setLogs(prev => [{ time: ts(), msg, type }, ...prev].slice(0, 50));
  const fetchLogs = async (userId: string) => { const { data } = await supabase.from('logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50); if (data) setLogs(data.map(l => ({ time: new Date(l.created_at).toLocaleTimeString('tr-TR'), msg: l.msg, type: l.type as LogType }))); };
  const fetchConnections = async (userId: string) => { const { data } = await supabase.from('connections').select('*').eq('caller_id', userId).order('created_at', { ascending: false }).limit(20); if (data) setConnectionHistory(data as ConnectionEntry[]); };
  const addLog = async (msg: string, type: LogType = 'info') => { addLocalLog(msg, type); if (!currentUser) return; await supabase.from('logs').insert({ user_id: currentUser.id, msg, type }); };
  const updateTheme = async (t: Theme) => { setTheme(t); if (currentUser) await supabase.from('users').update({ theme: t }).eq('id', currentUser.id); };
  const copyId = () => {
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(connectionId).then(() => { setCopied(true); addLog('Kimlik panoya kopyalandı.', 'info'); setTimeout(() => setCopied(false), 2000); }); }
      else { const ta = document.createElement('textarea'); ta.value = connectionId; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); setCopied(true); addLog('Kimlik panoya kopyalandı.', 'info'); setTimeout(() => setCopied(false), 2000); }
    } catch { addLog('Kopyalama başarısız.', 'warn'); }
  };

  const handleRegister = async () => {
    setAuthError(''); if (!displayName.trim()) { setAuthError('Ad Soyad zorunludur.'); return; } if (password.length < 6) { setAuthError('Şifre en az 6 karakter olmalı.'); return; }
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName, phone } } });
    if (error) { setAuthError(error.message); return; }
    setAuthMode('mfa'); addLog('Yeni hesap oluşturuldu. MFA bekleniyor.', 'sys');
  };
  const handleLogin = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setAuthError(error.message); return; }
    setAuthMode('mfa'); addLog('Giriş başarılı. MFA bekleniyor.', 'info');
  };
  const handlePasswordReset = async () => {
    setAuthError(''); if (!resetEmail) { setAuthError('Lütfen e-posta adresinizi girin.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
    if (error) { setAuthError(error.message); return; }
    setResetSent(true); addLog('Şifre sıfırlama e-postası gönderildi.', 'sys');
  };
  const handleUpdateProfile = async () => {
    if (!currentUser) return; setProfileUpdateDone(false);
    const { error } = await supabase.from('users').update({ display_name: displayName, phone }).eq('id', currentUser.id);
    if (error) { addLog(`Profil güncellenemedi: ${error.message}`, 'error'); return; }
    setProfileUpdateDone(true); addLog('Profil güncellendi.', 'sys'); setTimeout(() => setProfileUpdateDone(false), 3000);
  };
  const handleChangePassword = async () => {
    setPasswordChangeError(''); if (!currentPassword) { setPasswordChangeError('Mevcut şifrenizi girin.'); return; }
    if (newPassword.length < 6) { setPasswordChangeError('Yeni şifre en az 6 karakter olmalı.'); return; }
    if (newPassword !== newPasswordConfirm) { setPasswordChangeError('Yeni şifreler eşleşmiyor.'); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentUser?.email || '', password: currentPassword });
    if (signInError) { setPasswordChangeError('Mevcut şifreniz hatalı.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordChangeError(error.message); return; }
    setPasswordChangeDone(true); setCurrentPassword(''); setNewPassword(''); setNewPasswordConfirm(''); addLog('Şifre güncellendi.', 'sys');
  };
  const validateMfa = async () => {
    setIsMfaValidating(true); const code = mfaCode.join('');
    setTimeout(() => { if (code === '1453') { setShowAuth(false); addLog('MFA doğrulaması başarılı.', 'sys'); setMfaCode(['','','','','','']); } else { setAuthError('Hatalı MFA kodu.'); setMfaCode(['','','','','','']); mfaRefs.current[0]?.focus(); } setIsMfaValidating(false); }, 1400);
  };
  const handleLogout = async () => { await supabase.auth.signOut(); setIsGuest(false); setConnectionHistory([]); addLog('Oturum kapatıldı.', 'warn'); setActiveTab('dashboard'); };
  const handleGuestLogin = () => { setIsGuest(true); setShowAuth(false); setAuthError(''); addLog('Misafir olarak devam ediliyor.', 'warn'); };
  const startSharing = async () => { try { addLog('Ekran paylaşımı izni isteniyor...', 'info'); const ms = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); setStream(ms); if (videoRef.current) videoRef.current.srcObject = ms; addLog('Ekran paylaşımı aktif.', 'info'); } catch { addLog('Ekran paylaşımı iptal edildi.', 'error'); } };
  const stopSharing = () => { stream?.getTracks().forEach(t => t.stop()); setStream(null); addLog('Ekran paylaşımı durduruldu.', 'warn'); };
  const handleConnect = async () => {
    if (!currentUser && !isGuest) { setShowAuth(true); return; } if (!targetId.trim()) return;
    setIsConnecting(true); addLog(`${targetId} kimliğine bağlanılıyor...`, 'warn');
    if (currentUser) await supabase.from('connections').insert({ caller_id: currentUser.id, receiver_id: targetId, status: 'pending' });
    setTimeout(() => { setIsConnecting(false); addLog(`${targetId} ile bağlantı kurulamadı (Zaman aşımı).`, 'error'); }, 3000);
  };

  const isLight = theme === 'umay';

  return (
    <div className="min-h-screen flex flex-col selection:bg-steppe-gold selection:text-steppe-stone">
      <header className="border-b border-steppe-border sticky top-0 z-50 backdrop-blur-md" style={{ background: isLight ? 'rgba(240,244,248,0.92)' : 'rgba(17,16,16,0.85)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 gokturk-border flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
              <span className="text-steppe-gold font-display text-xl">𐰇</span>
            </div>
            <div>
              <h1 className="text-lg text-steppe-gold leading-none">Yırak Remote</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[9px] runic-text opacity-40">𐰖𐰃𐰺𐰴</p>
                <span className="text-[7px] px-1 border border-steppe-border text-steppe-gold opacity-60 uppercase tracking-widest">v1.0.0</span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 border border-steppe-border" style={{ background: 'var(--surface-primary)' }}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} style={{ boxShadow: isOnline ? '0 0 6px rgba(74,222,128,0.6)' : '0 0 6px rgba(248,113,113,0.6)' }} />
            <span className="text-[9px] uppercase tracking-widest text-steppe-muted">{isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
            {isGuest && <span className="text-[9px] uppercase tracking-widest text-yellow-400 ml-2 pl-2 border-l border-steppe-border">Misafir</span>}
          </div>
          <nav className="hidden md:flex gap-8 items-center">
            {(['dashboard', 'connections', 'settings'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`text-[11px] uppercase tracking-widest transition-colors ${activeTab === tab ? 'text-steppe-gold' : 'text-steppe-muted hover:text-steppe-paper'}`}>
                {tab === 'dashboard' ? 'Panel' : tab === 'connections' ? 'Bağlantılar' : 'Ayarlar'}
              </button>
            ))}
            {currentUser ? (
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-steppe-gold opacity-70">{userProfile?.display_name || currentUser.email}</span>
                <button onClick={handleLogout} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-steppe-muted hover:text-red-400 transition-colors"><LogOut size={12} /> Çıkış</button>
              </div>
            ) : isGuest ? (
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-yellow-400 opacity-70">Misafir</span>
                <button onClick={() => { setShowAuth(true); setAuthMode('login'); setIsGuest(false); }} className="btn-ghost px-5 py-2">Giriş Yap</button>
              </div>
            ) : (
              <button onClick={() => { setShowAuth(true); setAuthMode('login'); }} className="btn-ghost px-5 py-2">Giriş Yap</button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="gokturk-border p-6 surface-card">
                <p className="text-[10px] uppercase tracking-widest text-steppe-muted mb-4 flex items-center gap-2"><User size={12} className="text-steppe-gold" /> Sizin Kimliğiniz</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-display text-steppe-gold">{connectionId}</span>
                  <button onClick={copyId} className="p-2 border border-steppe-border hover:border-steppe-gold transition-colors text-steppe-muted hover:text-steppe-gold">
                    {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-green-400' : isGuest ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                  <span className="text-[9px] text-steppe-muted uppercase tracking-widest">{currentUser ? 'Profil ID' : isGuest ? 'Misafir ID' : 'Cihaz ID (Geçici)'}</span>
                </div>
                {currentUser && sessionToken && (
                  <div className="mt-2 p-2 border border-steppe-border" style={{ background: 'var(--log-bg)' }}>
                    <p className="text-[8px] text-steppe-muted font-mono">SESSION: {sessionToken.slice(0, 8)}...</p>
                    <p className="text-[8px] text-steppe-muted font-mono">FP: {deviceFingerprint.slice(0, 8)}...</p>
                  </div>
                )}
                <p className="text-[10px] text-steppe-muted mt-4 italic">"Birlikte güç, ayrılık ta zayıflık vardır." — Bilge Kağan</p>
              </div>

              <div className="gokturk-border p-6 surface-card">
                <p className="text-[10px] uppercase tracking-widest text-steppe-muted mb-4 flex items-center gap-2"><Monitor size={12} className="text-steppe-gold" /> Uzak Masaüstü Bağlan</p>
                <input type="text" placeholder="HEDEF KİMLİK (Örn: 123-456-789)" className="input-field mb-4" value={targetId} onChange={e => setTargetId(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleConnect} disabled={isConnecting || !targetId} className="btn-primary disabled:opacity-40">{isConnecting ? 'Bağlanıyor...' : 'Bağlantı Kur'}</button>
                  <button onClick={stream ? stopSharing : startSharing} className="btn-ghost">{stream ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}</button>
                </div>
                {!currentUser && !isGuest && <p className="text-[9px] text-red-400 mt-3 text-center uppercase tracking-wider">Giriş yapın veya misafir olarak devam edin</p>}
                {isGuest && <p className="text-[9px] text-yellow-400 mt-3 text-center uppercase tracking-wider">Misafir mod — geçmiş kaydedilmez</p>}
              </div>

              <div className="p-5 surface-card border border-steppe-border" style={{ background: isLight ? 'rgba(46,111,191,0.06)' : 'rgba(197,160,89,0.05)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--accent-primary)', color: 'var(--btn-text)' }}>Q</div>
                  <p className="text-[11px] uppercase tracking-widest text-steppe-gold">QRtım ile Tanışın</p>
                </div>
                <p className="text-[10px] text-steppe-muted leading-relaxed mb-4">Dijital kartvizitinizi oluşturun. Yırak Remote hesabınızla entegre çalışır.</p>
                <button onClick={() => window.open('https://qartim.com', '_blank')} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-steppe-gold hover:opacity-80 transition-opacity"><ExternalLink size={12} /> qartim.com'u Ziyaret Et</button>
              </div>

              <div className="p-5 surface-card border border-steppe-border">
                <div className="flex items-center gap-3 mb-3"><Heart size={14} className="text-steppe-gold" /><p className="text-[11px] uppercase tracking-widest text-steppe-gold">Bozkırın Gücüyle Gelişiyoruz</p></div>
                <p className="text-[10px] text-steppe-muted leading-relaxed mb-4">Yırak Remote tamamen ücretsizdir. Sunucu maliyetleri bağışlarınızla desteklenmektedir.</p>
                <button onClick={() => setShowDonation(true)} className="btn-ghost w-full">Destek Ol (Bağış)</button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <StatCard icon={<Shield size={18} />} title="Güvenlik" value="AES-256" sub="Uçtan Uca" />
                <StatCard icon={<Zap size={18} />} title="Gecikme" value={stream ? '4ms' : '12ms'} sub="Düşük Gecikme" />
                <StatCard icon={<Globe size={18} />} title="Sunucu" value="Frankfurt" sub="Aktif" />
              </div>
              <div className="relative aspect-video gokturk-border overflow-hidden flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, var(--accent-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                {stream ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain bg-black" /> : (
                  <div className="text-center z-10 p-12">
                    <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 4, repeat: Infinity }} className="mb-6 inline-block p-6 rounded-full border border-steppe-border" style={{ background: 'var(--border-primary)' }}>
                      <Monitor size={44} className="text-steppe-gold opacity-50" />
                    </motion.div>
                    <h3 className="text-base text-steppe-gold opacity-60 mb-2">Bağlantı Bekleniyor</h3>
                    <p className="text-[11px] text-steppe-muted max-w-xs mx-auto leading-relaxed">Uzak masaüstüne bağlanmak için sol panelden hedef kimliği girin.</p>
                  </div>
                )}
                {['top-4 left-4 border-t-2 border-l-2','top-4 right-4 border-t-2 border-r-2','bottom-4 left-4 border-b-2 border-l-2','bottom-4 right-4 border-b-2 border-r-2'].map((c, i) => <div key={i} className={`absolute w-4 h-4 ${c}`} style={{ borderColor: 'var(--border-strong)' }} />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="surface-card border border-steppe-border p-5">
                  <h3 className="text-[10px] uppercase tracking-widest text-steppe-muted mb-4 flex items-center gap-2"><Terminal size={12} className="text-steppe-gold" /> Sistem Günlüğü</h3>
                  <div className="font-mono text-[10px] space-y-2 h-36 overflow-y-auto flex flex-col-reverse" style={{ background: 'var(--log-bg)', padding: '0.75rem' }}>
                    {logs.length > 0 ? logs.map((log, i) => (
                      <div key={i} className={log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : log.type === 'sys' ? 'text-green-400' : 'text-steppe-muted'}>
                        <span className="opacity-40 mr-2">[{log.time}]</span>{log.msg}
                      </div>
                    )) : <div className="text-steppe-muted opacity-30">Günlük kaydı bulunamadı...</div>}
                  </div>
                </div>
                <div className="surface-card border border-steppe-border p-5">
                  <h3 className="text-[10px] uppercase tracking-widest text-steppe-muted mb-4 flex items-center gap-2"><Lock size={12} className="text-steppe-gold" /> Güvenlik Altyapısı</h3>
                  <div className="space-y-3">
                    <SecurityFeature title="P2P Doğrudan Bağlantı" desc="Verileriniz merkezi sunucularımıza uğramaz, doğrudan cihazlar arası aktarılır." />
                    <SecurityFeature title="Kuantum Dirençli Şifreleme" desc="Geleceğin tehditlerine karşı bugünden hazırlıklı altyapı." />
                    <SecurityFeature title="Açık Kaynak Kod" desc="Topluluk tarafından denetlenebilir, şeffaf güvenlik protokolleri." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl text-steppe-gold flex items-center gap-3"><Monitor size={20} /> Bağlantı Geçmişi</h2>
              <div className="flex gap-2">
                {(['all', 'active', 'timeout'] as const).map(f => (
                  <button key={f} onClick={() => setConnFilter(f)} className={`text-[9px] uppercase tracking-widest px-3 py-1 border transition-all ${connFilter === f ? 'border-steppe-gold text-steppe-gold' : 'border-steppe-border text-steppe-muted hover:border-steppe-gold'}`}>
                    {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : 'Zaman Aşımı'}
                  </button>
                ))}
              </div>
            </div>
            <div className="gokturk-border surface-card p-8">
              {!currentUser && !isGuest ? (
                <div className="text-center py-16"><Monitor size={32} className="text-steppe-muted mx-auto mb-4 opacity-30" /><p className="text-[11px] text-steppe-muted mb-4">Bağlantı geçmişini görmek için giriş yapın.</p><button onClick={() => setShowAuth(true)} className="btn-ghost px-6 py-2">Giriş Yap</button></div>
              ) : isGuest ? (
                <div className="text-center py-16"><Monitor size={32} className="text-steppe-muted mx-auto mb-4 opacity-30" /><p className="text-[11px] text-steppe-muted mb-4">Misafir modunda geçmiş kaydedilmez.</p><button onClick={() => { setShowAuth(true); setAuthMode('register'); }} className="btn-ghost px-6 py-2">Hesap Oluştur</button></div>
              ) : connectionHistory.filter(c => connFilter === 'all' || c.status === connFilter).length > 0 ? (
                <div className="space-y-3">
                  {connectionHistory.filter(c => connFilter === 'all' || c.status === connFilter).map(conn => (
                    <div key={conn.id} className="flex justify-between items-center p-4 border border-steppe-border hover:border-steppe-gold transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-2" style={{ background: 'var(--border-primary)' }}><Monitor size={14} className="text-steppe-gold" /></div>
                        <div><p className="text-sm text-steppe-gold">{conn.receiver_id}</p><p className="text-[10px] text-steppe-muted">{new Date(conn.created_at).toLocaleString('tr-TR')}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] uppercase tracking-widest px-2 py-1 ${conn.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{conn.status === 'active' ? 'Aktif' : 'Zaman Aşımı'}</span>
                        <button onClick={() => { setTargetId(conn.receiver_id); setActiveTab('dashboard'); }} className="btn-ghost text-[9px] py-1 px-3">Tekrar Bağlan</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-16 text-steppe-muted italic text-sm">{connFilter === 'all' ? 'Henüz bağlantı kaydı bulunmuyor.' : 'Bu filtrede kayıt yok.'}</div>}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl text-steppe-gold flex items-center gap-3"><Settings size={20} /> Uygulama Ayarları</h2>
            <section className="gokturk-border surface-card p-8">
              <h3 className="text-[10px] uppercase tracking-widest text-steppe-muted mb-6 flex items-center gap-2"><Sun size={12} className="text-steppe-gold" /> Görünüm Teması</h3>
              <div className="grid grid-cols-4 gap-3">{THEMES.map(t => <ThemeButton key={t.id} active={theme === t.id} onClick={() => updateTheme(t.id)} label={t.label} color={t.color} isLight={!!t.light} />)}</div>
            </section>
            <section className="gokturk-border surface-card p-8">
              <h3 className="text-[10px] uppercase tracking-widest text-steppe-muted mb-6 flex items-center gap-2"><User size={12} className="text-steppe-gold" /> Profil Bilgileri</h3>
              {currentUser ? (
                <div className="space-y-4">
                  <div className="p-3 border border-steppe-border text-[10px] text-steppe-muted" style={{ background: 'var(--surface-primary)' }}><span className="text-steppe-gold">E-posta:</span> {currentUser.email}</div>
                  <input type="text" placeholder="AD SOYAD" className="input-field" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                  <input type="tel" placeholder="TELEFON" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
                  {profileUpdateDone && <div className="p-3 border border-green-500/30 text-center" style={{ background: 'rgba(34,197,94,0.05)' }}><CheckCircle size={14} className="text-green-400 mx-auto mb-1" /><p className="text-[10px] text-green-400">Profil güncellendi!</p></div>}
                  <button onClick={handleUpdateProfile} className="btn-primary">Profili Güncelle</button>
                </div>
              ) : <div className="text-center py-6"><p className="text-[10px] text-steppe-muted mb-4">Profil bilgilerini görmek için giriş yapın.</p><button onClick={() => setShowAuth(true)} className="btn-ghost px-6 py-2">Giriş Yap</button></div>}
            </section>
            <section className="gokturk-border surface-card p-8">
              <h3 className="text-[10px] uppercase tracking-widest text-steppe-muted mb-6 flex items-center gap-2"><Shield size={12} className="text-steppe-gold" /> Hesap Güvenliği</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border border-steppe-border">
                  <div><p className="text-xs text-steppe-gold">İki Faktörlü Doğrulama (MFA)</p><p className="text-[10px] text-steppe-muted">Her girişte e-posta onayı istenir.</p></div>
                  <div className="w-10 h-5 rounded-full relative cursor-pointer" style={{ background: 'var(--accent-primary)' }}><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                </div>
                <button onClick={() => { setShowChangePassword(!showChangePassword); setPasswordChangeError(''); setPasswordChangeDone(false); }} className="w-full py-3 border border-steppe-border text-steppe-gold text-[10px] uppercase tracking-widest hover:border-steppe-gold transition-all">{showChangePassword ? 'İptal' : 'Şifreyi Değiştir'}</button>
                {showChangePassword && (
                  <div className="space-y-3 pt-2">
                    <input type="password" placeholder="MEVCUT ŞİFRE" className="input-field" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                    <input type="password" placeholder="YENİ ŞİFRE" className="input-field" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <input type="password" placeholder="YENİ ŞİFRE (TEKRAR)" className="input-field" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} />
                    {passwordChangeError && <p className="text-[10px] text-red-400">{passwordChangeError}</p>}
                    {passwordChangeDone && <div className="p-3 border border-green-500/30 text-center" style={{ background: 'rgba(34,197,94,0.05)' }}><CheckCircle size={16} className="text-green-400 mx-auto mb-1" /><p className="text-[10px] text-green-400">Şifreniz güncellendi!</p></div>}
                    {!passwordChangeDone && <button onClick={handleChangePassword} className="btn-primary">Şifreyi Güncelle</button>}
                  </div>
                )}
              </div>
            </section>
            <section className="gokturk-border surface-card p-8">
              <h3 className="text-[10px] uppercase tracking-widest text-steppe-muted mb-6 flex items-center gap-2"><QrCode size={12} className="text-steppe-gold" /> QRtım Entegrasyonu</h3>
              <div className="flex items-center justify-between p-4 border border-steppe-border mb-4" style={{ background: 'var(--surface-primary)' }}>
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-yellow-400" /><div><p className="text-[11px] text-steppe-paper">QRtım Hesabı</p><p className="text-[9px] text-steppe-muted">Henüz bağlanmadı</p></div></div>
                <span className="text-[9px] uppercase tracking-widest text-yellow-400 border border-yellow-400/30 px-2 py-1">Bağlı Değil</span>
              </div>
              <p className="text-[10px] text-steppe-muted leading-relaxed mb-5">QRtım dijital kartvizit hesabınızı bağlayın. Bağlantı kimliğiniz otomatik kartvizitinize eklenir.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => window.open('https://qartim.com/register', '_blank')} className="btn-primary">Hesap Oluştur</button>
                <button onClick={() => window.open('https://qartim.com/login', '_blank')} className="btn-ghost">Giriş Yap</button>
              </div>
            </section>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showAuth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="w-full max-w-md gokturk-border p-8 relative" style={{ background: 'var(--bg-primary)' }}>
              <button onClick={() => { setShowAuth(false); setAuthError(''); setResetSent(false); }} className="absolute top-4 right-4 text-steppe-muted hover:text-steppe-gold transition-colors text-xs">[X]</button>
              {authMode === 'login' && (
                <><h2 className="text-lg text-steppe-gold mb-6">Giriş Yap</h2>
                <div className="space-y-4">
                  <input type="email" placeholder="E-POSTA" className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
                  <input type="password" placeholder="ŞİFRE" className="input-field" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
                  {authError && <p className="text-[10px] text-red-400">{authError}</p>}
                  <button onClick={handleLogin} className="btn-primary">Devam Et</button>
                  <button onClick={() => { setAuthMode('reset'); setAuthError(''); setResetSent(false); setResetEmail(''); }} className="w-full text-[10px] text-steppe-muted hover:text-steppe-gold transition-colors text-center">Şifremi Unuttum</button>
                  <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-steppe-border" /></div><div className="relative flex justify-center"><span className="text-[9px] text-steppe-muted px-3" style={{ background: 'var(--bg-primary)' }}>VEYA</span></div></div>
                  <button onClick={() => window.open('https://qartim.com/login', '_blank')} className="w-full flex items-center justify-center gap-3 p-3 border border-steppe-border hover:border-steppe-gold transition-all group" style={{ background: 'var(--surface-primary)' }}>
                    <QrCode size={14} className="text-steppe-gold" /><span className="text-[10px] uppercase tracking-widest text-steppe-muted group-hover:text-steppe-paper transition-colors">QRtım Hesabıyla Devam Et</span><ArrowRight size={12} className="text-steppe-muted group-hover:text-steppe-gold transition-colors" />
                  </button>
                  <button onClick={handleGuestLogin} className="w-full flex items-center justify-center gap-2 p-3 border border-steppe-border hover:border-steppe-gold transition-all group" style={{ background: 'var(--surface-primary)' }}>
                    <User size={14} className="text-steppe-muted group-hover:text-steppe-gold transition-colors" /><span className="text-[10px] uppercase tracking-widest text-steppe-muted group-hover:text-steppe-paper transition-colors">Hesap Açmadan Devam Et</span>
                  </button>
                  <p className="text-[9px] text-center text-steppe-muted opacity-60">Misafir modunda bağlantı geçmişi kaydedilmez.</p>
                  <p className="text-[10px] text-center text-steppe-muted">Hesabınız yok mu?{' '}<button onClick={() => { setAuthMode('register'); setAuthError(''); }} className="text-steppe-gold underline underline-offset-2">Kayıt Ol</button></p>
                </div></>
              )}
              {authMode === 'register' && (
                <><h2 className="text-lg text-steppe-gold mb-6">Hesap Oluştur</h2>
                <div className="space-y-4">
                  <input type="text" placeholder="AD SOYAD" className="input-field" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                  <input type="email" placeholder="E-POSTA" className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
                  <input type="tel" placeholder="TELEFON (İsteğe bağlı)" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
                  <input type="password" placeholder="ŞİFRE (min. 6 karakter)" className="input-field" value={password} onChange={e => setPassword(e.target.value)} />
                  {authError && <p className="text-[10px] text-red-400">{authError}</p>}
                  <button onClick={handleRegister} className="btn-primary">Kayıt Ol</button>
                  <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-steppe-border" /></div><div className="relative flex justify-center"><span className="text-[9px] text-steppe-muted px-3" style={{ background: 'var(--bg-primary)' }}>ZATEN QRTIM HESABINIZ VAR MI?</span></div></div>
                  <button onClick={() => window.open('https://qartim.com/login', '_blank')} className="w-full flex items-center justify-center gap-3 p-3 border border-steppe-border hover:border-steppe-gold transition-all group" style={{ background: 'var(--surface-primary)' }}>
                    <QrCode size={14} className="text-steppe-gold" /><span className="text-[10px] uppercase tracking-widest text-steppe-muted group-hover:text-steppe-paper transition-colors">QRtım ile Giriş Yap</span><ArrowRight size={12} className="text-steppe-muted group-hover:text-steppe-gold transition-colors" />
                  </button>
                  <div className="p-3 border border-steppe-border text-[9px] text-steppe-muted leading-relaxed">🛡️ Hesabınızı <span className="text-steppe-gold">ShieldAuth MFA</span> ile güçlendirin — kayıt sonrası aktifleştirebilirsiniz.</div>
                  <p className="text-[10px] text-center text-steppe-muted">Zaten hesabınız var mı?{' '}<button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-steppe-gold underline underline-offset-2">Giriş Yap</button></p>
                </div></>
              )}
              {authMode === 'mfa' && (
                <><h2 className="text-lg text-steppe-gold mb-2">MFA Doğrulama</h2>
                <p className="text-[10px] text-steppe-muted mb-6">E-posta adresinize gönderilen 6 haneli kodu girin. <span className="text-steppe-gold">(Demo: 1453)</span></p>
                <div className="space-y-6">
                  <div className="flex justify-between gap-2">
                    {mfaCode.map((d, i) => (
                      <input key={i} type="text" maxLength={1} ref={el => (mfaRefs.current[i] = el)} className="w-full aspect-square text-center text-xl text-steppe-gold focus:outline-none" style={{ background: 'var(--log-bg)', border: '1px solid var(--border-primary)', transition: 'border-color 0.2s' }} value={d}
                        onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)')} onBlur={e => (e.target.style.borderColor = 'var(--border-primary)')}
                        onChange={e => { const nc = [...mfaCode]; nc[i] = e.target.value; setMfaCode(nc); if (e.target.value && i < 5) mfaRefs.current[i+1]?.focus(); }}
                        onKeyDown={e => { if (e.key === 'Backspace' && !mfaCode[i] && i > 0) mfaRefs.current[i-1]?.focus(); }} />
                    ))}
                  </div>
                  {authError && <p className="text-[10px] text-red-400">{authError}</p>}
                  <button onClick={validateMfa} disabled={isMfaValidating} className="btn-primary disabled:opacity-50">{isMfaValidating ? 'Doğrulanıyor...' : 'Doğrula'}</button>
                  <div className="p-3 border border-steppe-border text-center" style={{ background: 'var(--surface-primary)' }}>
                    <p className="text-[9px] text-steppe-muted mb-2">Dijital kartvizitiniz hazır mı?</p>
                    <button onClick={() => window.open('https://qartim.com', '_blank')} className="flex items-center justify-center gap-2 mx-auto text-[10px] text-steppe-gold hover:opacity-80 transition-opacity"><QrCode size={11} /> QRtım'da profil oluştur <ArrowRight size={11} /></button>
                  </div>
                </div></>
              )}
              {authMode === 'reset' && (
                <><h2 className="text-lg text-steppe-gold mb-2">Şifre Sıfırla</h2>
                <p className="text-[10px] text-steppe-muted mb-6">Kayıtlı e-posta adresinizi girin, sıfırlama bağlantısı gönderelim.</p>
                <div className="space-y-4">
                  {!resetSent ? (
                    <><input type="email" placeholder="E-POSTA ADRESİNİZ" className="input-field" value={resetEmail} onChange={e => setResetEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePasswordReset(); }} />
                    {authError && <p className="text-[10px] text-red-400">{authError}</p>}
                    <button onClick={handlePasswordReset} className="btn-primary">Sıfırlama Bağlantısı Gönder</button></>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}><CheckCircle size={28} className="text-green-400" /></div>
                      <p className="text-[12px] text-green-400 mb-2">E-posta gönderildi!</p>
                      <p className="text-[10px] text-steppe-muted"><span className="text-steppe-gold">{resetEmail}</span> adresini kontrol edin.</p>
                    </div>
                  )}
                  <button onClick={() => { setAuthMode('login'); setAuthError(''); setResetSent(false); setResetEmail(''); }} className="w-full text-[10px] text-steppe-muted hover:text-steppe-gold transition-colors text-center">← Giriş ekranına dön</button>
                </div></>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDonation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }} className="w-full max-w-md gokturk-border p-8 relative" style={{ background: 'var(--bg-primary)' }}>
              <button onClick={() => setShowDonation(false)} className="absolute top-4 right-4 text-steppe-muted hover:text-steppe-gold transition-colors text-xs">Kapat [X]</button>
              <Heart size={20} className="text-steppe-gold mb-4" />
              <h2 className="text-lg text-steppe-gold mb-2">Bozkıra Destek Ol</h2>
              <p className="text-[11px] text-steppe-muted mb-8 leading-relaxed">Yırak Remote tamamen ücretsiz ve açık kaynaklıdır. Sunucu maliyetlerimizi karşılamak için bağışlarınızı bekliyoruz.</p>
              <div className="space-y-3 mb-8">
                {[{amount:'50 TL',label:'Kımız Ismarlayın'},{amount:'250 TL',label:'At Koşturun'},{amount:'1000 TL',label:'Otağ Kurun'},{amount:'Dilediğiniz kadar',label:'Kendi Miktarınızı Belirleyin'}].map(opt => <DonationOption key={opt.amount} amount={opt.amount} label={opt.label} />)}
              </div>
              <button onClick={() => { setShowDonation(false); addLog('Bağış işleminiz için teşekkür ederiz!', 'sys'); }} className="btn-primary">Ödeme Sayfasına Git</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-steppe-border py-6 text-center" style={{ background: isLight ? 'rgba(240,244,248,0.8)' : 'rgba(0,0,0,0.2)' }}>
        <p className="text-[9px] text-steppe-muted tracking-[0.3em] uppercase">© 2026 Yırak Remote — Türk Yazılım Geliştiricileri Topluluğu</p>
      </footer>
    </div>
  );
}

function ThemeButton({ active, onClick, label, color, isLight }: { active: boolean; onClick: () => void; label: string; color: string; isLight?: boolean; }) {
  return (
    <button onClick={onClick} className={`p-3 border transition-all flex flex-col items-center gap-2 group ${active ? 'border-steppe-border' : 'border-transparent hover:border-steppe-border'}`} style={{ background: active ? 'var(--border-primary)' : 'transparent' }}>
      <div className="w-7 h-7 rounded-full border-2 border-white/20" style={{ background: color }} />
      <span className={`text-[9px] uppercase tracking-widest transition-colors ${active ? 'text-steppe-gold' : 'text-steppe-muted group-hover:text-steppe-paper'}`}>{label}</span>
      {isLight && <Sun size={10} className="text-steppe-muted" />}
    </button>
  );
}
function DonationOption({ amount, label }: { amount: string; label: string }) {
  return <div className="flex justify-between items-center p-4 border border-steppe-border hover:border-steppe-gold transition-all cursor-pointer group" style={{ background: 'var(--surface-primary)' }}><span className="text-[11px] text-steppe-muted group-hover:text-steppe-paper transition-colors">{label}</span><span className="text-steppe-gold font-display text-sm">{amount}</span></div>;
}
function StatCard({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string; sub: string }) {
  return <div className="p-5 surface-card border border-steppe-border group"><div className="text-steppe-gold opacity-50 mb-3 group-hover:opacity-100 transition-opacity">{icon}</div><div className="text-[9px] uppercase tracking-widest text-steppe-muted mb-1">{title}</div><div className="text-lg font-display text-steppe-gold">{value}</div><div className="text-[9px] text-steppe-muted uppercase tracking-tight">{sub}</div></div>;
}
function SecurityFeature({ title, desc }: { title: string; desc: string }) {
  return <div className="flex gap-3"><div className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--accent-primary)' }} /><div><h4 className="text-[10px] text-steppe-gold mb-1">{title}</h4><p className="text-[10px] text-steppe-muted leading-relaxed">{desc}</p></div></div>;
}