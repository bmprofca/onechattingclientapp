# OneChatting production keystore

Share this whole folder with the developer. It is the Android upload key for the Play Store app `com.onechatting.app`. Every release AAB and APK must be signed with this same keystore. Do not generate a new keystore. A new one cannot update the existing Play listing.

Keep this folder private. Do not commit it, upload it to GitHub, or paste the passwords into chat.

## Place it in the App project

Clone the App repo, then copy this folder so the path is:

`App/android/production-keystore`

The folder name must stay `production-keystore`. `android/app/build.gradle` loads `production-keystore/keystore.properties` and signs the release build with the keystore sitting next to that file.

After copying, `git status` in the App repo must not list the keystore, `keystore.properties`, or `keystore-credentials.txt`. Those three names are in `App/.gitignore`. `context.md` may stay untracked.

## Files in this folder

| File | What it is |
| --- | --- |
| `onechatting-upload.keystore` | PKCS12 upload keystore. This is the key Play Console expects. |
| `keystore.properties` | Passwords, alias, and keystore file name. Gradle reads this for release builds. |
| `keystore-credentials.txt` | Same secrets in plain text, plus the certificate identity. |
| `context.md` | This note. It does not contain passwords. |

`keystore.properties` must keep these keys: `storePassword`, `keyPassword`, `keyAlias`, `storeFile`. `storeFile` must stay `onechatting-upload.keystore` (the file name in this folder, not a full path).

## Identity

| Field | Value |
| --- | --- |
| Application id | `com.onechatting.app` |
| Key alias | `onechatting-upload` |
| Store type | PKCS12 |
| Validity | 10000 days |
| Certificate | `CN=OneChatting, OU=Mobile, O=Onesaas Technologies Private Limited, C=IN` |
| App version in the repo | `versionName` 1.2, `versionCode` 3 in `android/app/build.gradle` |

Debug builds do not use this keystore. They use `android/app/debug.keystore`.

`android/app/google-services.json` is the Firebase Android client config. It is not a signing key and it cannot replace this keystore.

## Build a signed release

From `App/android` on Windows, after this folder is in place:

```bat
gradlew.bat bundleRelease
gradlew.bat assembleRelease
```

Outputs:

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

Bump `versionCode` in `android/app/build.gradle` before each Play upload. Play rejects an AAB whose `versionCode` is not higher than the one already published.

If `keystore.properties` is missing, the release signing config is empty and the release build cannot be signed.
