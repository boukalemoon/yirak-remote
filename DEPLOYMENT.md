# Ötüken Remote - Canlı Ortam ve Yayına Alma Rehberi

Bu belge, uygulamanın test aşamasından sonra tüm platformlarda (Windows, macOS, Linux, Android, iOS) nasıl yayına alınacağını ve gereken altyapıyı açıklar.

## 1. Sistem Altyapısı (Gereksinimler)

Gerçek zamanlı uzak masaüstü bağlantısı için şu bileşenler gereklidir:

### A. Sinyalleşme Sunucusu (Signaling Server)
Cihazların birbirini bulması için bir Node.js sunucusu.
- **Öneri:** Google Cloud Run, Heroku veya DigitalOcean.
- **Teknoloji:** Socket.io

### B. STUN/TURN Sunucuları
WebRTC bağlantılarının ateş duvarlarını aşması için.
- **STUN:** Google'ın ücretsiz sunucuları (stun.l.google.com:19302) başlangıç için yeterlidir.
- **TURN:** Profesyonel kullanım için **Twilio**, **Xirsys** veya kendi sunucunuzda **Coturn**.

### C. Firebase Yapılandırması
- **Firebase Hosting:** Web sürümünü barındırmak için.
- **Firestore:** Loglar ve bağlantı geçmişi için.
- **Auth:** Kullanıcı yönetimi için.

---

## 2. Platform Bazlı Kurulum Adımları

### Masaüstü (Windows, macOS, Linux)
Uygulama **Electron** altyapısını kullanır.
1. Bağımlılıkları yükleyin: `npm install`
2. Geliştirme modunda çalıştırın: `npm run desktop:dev`
3. Paketleyin (Kurulum dosyası oluşturun): `npm run desktop:build`
   - Bu komut `dist_electron/` klasöründe `.exe`, `.msi` (Windows), `.dmg` (Mac) veya `.deb` (Linux) dosyalarını oluşturur.
   - **Not:** macOS `.dmg` dosyası oluşturmak için bir Mac bilgisayar veya GitHub Actions gereklidir.

### Mobil (Android, iOS)
Uygulama **Capacitor** altyapısını kullanır.
1. Android Studio (Android için) veya Xcode (iOS için) kurulu olmalıdır.
2. Android için: `npm run mobile:android`
3. iOS için: `npm run mobile:ios`
   - Bu komutlar native projeleri açar, oradan APK veya IPA alabilirsiniz.

---

## 3. Canlı Ortama Alma (Deployment)

### GitHub Üzerinden Otomatik Yayın (CI/CD)
1. Projeyi GitHub'a yükleyin.
2. **GitHub Actions** (`.github/workflows/build.yml`) yapılandırıldı.
3. Bir sürüm yayınlamak için:
   - Kodunuzu bir tag ile pushlayın: `git tag v1.0.0 && git push origin v1.0.0`
   - GitHub otomatik olarak Windows (`.msi`, `.exe`) ve macOS (`.dmg`) dosyalarını oluşturup **Releases** kısmına ekleyecektir.
4. **Firebase Hosting:** Her `push` işleminde Firebase Hosting'e otomatik dağıtım yapabilirsiniz.

### Firebase Hosting Kurulumu
1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting`
4. `npm run build`
5. `firebase deploy`

---

## 4. Güvenlik Notları
- Canlı ortamda Firebase Security Rules (`firestore.rules`) dosyasının en sıkı haliyle yayında olduğundan emin olun.
- API anahtarlarınızı GitHub'a yüklemeyin, `.env` dosyası kullanın.
