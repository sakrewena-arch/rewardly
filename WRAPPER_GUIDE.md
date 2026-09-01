# 📱💻 Empaquetage natif Rewardly — Guide complet

Ce guide explique comment produire les applications installables à partir de l'application web :

| Cible | Outil | Résultat |
|---|---|---|
| 📱 **Android** | **Capacitor** | `APK` / `AAB` (Play Store) |
| 🍎 **iOS** | **Capacitor** | `IPA` (App Store) |
| 🪟 **Windows** | **Electron** | `exe` (NSIS) + `exe` portable (ou MSI) |
| 🐧 **Linux** | **Electron** | `AppImage` + `deb` |
| 🖥️ **macOS** | **Electron** | `dmg` + `zip` |

---

## ⚠️ 1. UNE SEULE URL À CONFIGURER (obligatoire)

Les wrappers chargent l'application **Next.js déjà déployée** (Server Actions / API / Supabase tournent sur le serveur, pas dans l'app native).

Éditez **`wrapper.config.mjs`** à la racine :

```js
export const APP_URL = process.env.WRAPPER_APP_URL || "https://rewardly.website";
```

> ✅ Action : l'URL par défaut de `wrapper.config.mjs` pointe sur **`https://rewardly.website`**
> (votre app de production). Pour changer, exportez la variable `WRAPPER_APP_URL` au moment du build.
> L'`appId` est `com.rewardly.app` (utilisé pour les stores).

### 🔑 Configuration Android (push FCM + signature)

**Push (optionnel mais recommandé)** : pour activer les notifications push natives
(FCM/APNs), déposez votre fichier `google-services.json` (Android) dans `android/app/`
et activez la capability **Push Notifications** + entitlement APNs dans Xcode (iOS).
Le code d'enregistrement du token est déjà branché côté web
(`src/components/features/NativeCapacitor.tsx`) — il remplit la table `push_tokens`
(base Supabase) via la Server Action `registerPushTokenAction` (migration `00016`).

**Signature release (obligatoire pour le Play Store)** :
- `keytool` local (JDK) : le keystore `android/keystore/rewardly-release.jks` a été
  généré (identifiants dans `android/keystore.properties`, **gitignoré — à ne jamais commiter**).
- Pour changer/refaire : `keytool -genkeypair -keystore android/keystore/rewardly-release.jks -alias rewardly -keyalg RSA -keysize 2048 -validity 10000`
- Le `build.gradle` lit automatiquement `keystore.properties` **ou** les variables
  d'environnement `ANDROID_KEYSTORE_PATH / _PASSWORD / ANDROID_KEY_ALIAS / _PASSWORD`.
- En CI (GitHub Actions), passez ces valeurs en **secrets** du dépôt.

---

## 🛠️ 2. Prérequis

- Node.js 18+ , npm
- **Android** : JDK **21** (Capacitor 8 l'exige — Android Studio embarque un JDK 21 dans `Android Studio\jbr`) + Android SDK
- **iOS** : macOS + Xcode 15+ (Le build iOS ne peut PAS se faire sous Windows)
- **Desktop** : aucune dépendance système (Electron embarque Chromium)

> 💡 **JDK 21 (build Android)** : si votre `JAVA_HOME` pointe sur un JDK 17 (comme ici), le build Gradle échoue
> avec `error: invalid source release: 21`. Pointez Gradle vers un JDK 21 en créant
> `C:\Users\<vous>\.gradle\gradle.properties` :
> ```
> org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr
> ```

---

## 🔄 3. Unifier les assets (icônes, splash)

```bash
npm run wrap:icons      # régénère assets/ + desktop/build/icon.png + icônes natifs
npm run wrap:sync       # wrap:icons + npx cap sync
```

---

## 📱 4. BUILD ANDROID (.apk / .aab)

```bash
npm run wrap:sync
npm run android:build                # => android/app/build/outputs/apk/debug/app-debug.apk
```

**APK de production (signé) ou bundle Play Store** :
1. Ouvrez le projet dans Android Studio : `npm run android`
2. Menu **Build > Generate Signed Bundle / APK**
3. Créez un keystore (gardez-le précieusement !) et générez `aab` (Play) ou `apk` (installation directe)

> 💡 Le AAB est exigé par le Play Store ; le APK sert aux installs manuelles de test.

---

## 🍎 5. BUILD iOS (.ipa / App Store)

Sur un **Mac** :

```bash
npm run wrap:sync
npx cap open ios        # ouvre Xcode
```

Dans Xcode :
1. Sélectionnez le target **App**, réglez le **Signing** (compte Apple + bundle `com.rewardly.app`)
2. **Product > Archive** puis **Distribute App** (App Store Connect)

> Le projet iOS est déjà scaffoldé (`ios/`) ; il faut simplement un Mac pour le compiler.

---

## 🪟 6. BUILD DESKTOP (Windows / Linux / macOS)

```bash
npm run desktop:install          # installe electron + electron-builder dans desktop/
npm run desktop:dev              # lance l'app en développement

npm run desktop:build:win        # => desktop/release/ : setup .exe + portable .exe  (sous Windows)
npm run desktop:build:linux      # => desktop/release/ : .AppImage + .deb           (sous Linux)
npm run desktop:build:mac        # => desktop/release/ : .dmg + .zip                 (sur macOS)
```

- **Windows** : le NSIS génère un installateur (répertoire, raccourcis) + portable.
- **Linux** : AppImage (universel) + deb.
- **macOS** : l'installateur doit être signé/notarisé pour éviter les alertes Gatekeeper.

> ⚠️ **Cross-build** : `electron-builder` ne peut produire les cibles **Linux/AppImage et macOS** qu'à partir
> de machines Linux/macOS (le `mksquashfs`/`hdiutil` n'existe pas sous Windows). Les builds Windows s'effectuent
> sous Windows. Le plus simple : lancer `desktop:build:linux` / `desktop:build:mac` sur les OS correspondants,
> ou via une CI GitHub Actions (ubuntu + macos runners).

---

## 🏪 7. Éléments à prévoir pour les Stores

- **Play Store / App Store** : captures d'écran, description, confidentialité, formulaire de test.
- **iOS — attention à la règle 4.2 (Apple)** : une app qui n'est « qu'un site web » peut être refusée.
  → Apportez de la valeur native : **notifications push** (`@capacitor/push-notifications` + APNs), **connexion par scan**, **courbe de stockage**, etc.
- **Notifications push web vs native** : vos notifications PWA actuelles (service worker) ne fonctionnent pas derrière un wrapper natif ;
  pour du natif, ajoutez `@capacitor/push-notifications` et gérez le token FCM côté Supabase.
- **Google Play 20 apps testers** obligatoire pour les comptes de publication.

---

## 🧹 8. Rappels utiles

- La config Capacitor est dans `capacitor.config.ts` (lit `wrapper.config.mjs`).
- Le wrapper Electron lit **la même** `wrapper.config.mjs` (fichier unique 😉).
- `dist/` = page de secours locale (chargement/offline), inoffensive : c'est un simple
  `index.html` indépendant de l'app Next.js (aucun SSR / Server Action embarqué).
- Toujours **resync et rebuilder** après changement de l'URL : `npm run wrap:sync`.

### 📦 8bis. Régénérer `dist/` (page de secours Capacitor)

`dist/` n'est **pas** le build de l'application : c'est un écran de chargement minimal
affiché par la WebView native pendant que `APP_URL` est rejointe (ou en cas d'offline).

Le fichier `dist/index.html` actuel est statique et versionné. Pour le remplacer :

```bash
# Génère un index.html minimal prêt à être chargé par Capacitor
node scripts/generate-dist.mjs
```

Ce script écrit simplement `dist/index.html` avec un écran « Connexion à la plateforme… ».
Il n'y a **rien à compiler** : l'app entière reste servie par `APP_URL`.

### 🔒 8ter. Edge Functions (Supabase) — accès contrôlé

Les Edge Functions `process-task`, `process-deposit`, `process-withdrawal` et
`send-notification` **vérifient désormais l'authentification admin** :
- l'appelant doit fournir `Authorization: Bearer <JWT>` d'un utilisateur dont le
  profil a le rôle `admin` ou `super_admin` ;
- l'`admin_id` utilisé dans les RPC provient du JWT **vérifié**, jamais du body.

Si des versions précédentes (sans contrôle) ont été déployées, supprimez-les ou
redéployez les nouvelles versions depuis `supabase/functions/` :

```bash
npx supabase functions deploy send-notification
npx supabase functions deploy process-task
npx supabase functions deploy process-withdrawal
npx supabase functions deploy process-deposit
```