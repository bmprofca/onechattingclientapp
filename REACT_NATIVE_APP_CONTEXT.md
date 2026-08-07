# 1Chatting React Native App Context

This document is the source context for rebuilding the current 1Chatting web frontend as a mobile-first React Native app. Preserve the existing API contract and business behavior; change only presentation, navigation, storage, and platform integrations.

## Product

1Chatting is a WhatsApp business inbox and messaging-operations console. A signed-in user can switch between projects (WABA accounts), monitor conversations, reply to customers, manage contacts and templates, send campaigns, configure automation/AI agents, manage team permissions, and pay for wallet credits/subscriptions.

## API and security contract

- Default API base URL: `https://server.onechatting.com` (`REACT_APP_API_BASE_URL` override).
- Upload API: `https://upload.onesaas.in/api/upload`, header `key: onedevelopers` (override with `REACT_APP_UPLOAD_API_KEY`).
- Most POST requests use the exact envelope `{ data, key }` as JSON.
- `data` is AES encrypted JSON and `key` is a random 32-character hexadecimal secret generated per request. The implementation is CryptoJS AES with `JSON.stringify(payload)`; reproduce this behavior in a shared TypeScript `encryptPayload()` helper. Never log plaintext payloads, tokens, or keys in production.
- Authenticated requests send headers `token` and `username`; JSON requests also send `Content-Type: application/json`.
- The login response supplies the session token/username/profile/projects. Persist these in secure storage (iOS Keychain/Android Keystore via `expo-secure-store` or `react-native-keychain`), not AsyncStorage. Persist non-sensitive UI state separately.
- On HTTP 401/session-check failure, clear secure session and route to Login. Support offline retry, request cancellation, timeout, and a single-flight refresh/session check.
- API responses are not fully uniform. Treat `error` (boolean/string), `message`, and HTTP status as failure indicators; keep raw response for diagnostics and map list data defensively (`list`, `data`, `results`, pagination fields).

## Navigation model

Unauthenticated stack: `Login`, `Register`, `ResetPasswordRequest`, `ResetPassword(token)`. Authenticated root: project-aware shell.

Bottom tabs (mobile replacement for the desktop sidebar):

1. **Inbox** — Live Chat, Open Cases, unread badge.
2. **Campaigns** — campaign list, create, details.
3. **Contacts** — contacts and groups.
4. **Templates** — list, add, edit, view.
5. **More** — dashboard, projects, wallet/transactions, profile, subscription, automation, team, project settings, developer access, support.

Use nested stacks inside every tab. Deep links must support conversation phone, template id, campaign id, project id, payment order id, and password-reset token. Require authentication for all private screens and require a selected project for project-scoped screens.

## Global state

Use Redux Toolkit (or equivalent):

- `auth`: `token`, `username`, `profile`, `projects`, `projectCount`, `selectedProjectId`, session status.
- `project`: selected project info, wallet balance, permissions, ownership, loading/error.
- `inbox`: conversations, active phone/thread, unread count, pagination, socket status.
- `ui`: theme, pending uploads, global banners/toasts, network status.

On app launch: hydrate secure session, call `/account/session-check`, then `/account/profile`; choose stored project or the first returned project. Switching projects updates `selectedProjectId`, refreshes project info, unread count, inbox, and all project-scoped queries.

## Screen and feature parity

### Authentication and account

- Login: email, password, optional Cloudflare Turnstile token, Google sign-in where configured.
- Register: account fields, password validation, legal links, optional Google registration.
- Forgot/reset password: request email, tokenized reset form, captcha.
- Profile: view/edit name, country code, mobile, gender, firm/business details; change password.
- Subscription: plans, purchase flow, current plan.

### Dashboard and projects

- Dashboard cards: project count, wallet balance, message/unread indicators and quick actions.
- Projects: list/create project, project detail, project switcher.
- Project details/config: WABA metadata, profile picture/details, embedded signup, WABA ID submission, auto-reply type, auto-case creation, context settings.

### Inbox and conversations

- Live Chat: conversation list, search/filter, unread state, open thread, send text/template/media, emoji, reply status, message info, media/document/audio/video/location/contact previews.
- Open Cases: searchable/filterable paginated case list, contact lookup, create/edit case, status updates, assign/close actions.
- Use WebSocket behavior from `src/pages/socket.js`; reconnect with exponential backoff, mark stale connection, and reconcile missed messages after reconnect. Mobile uses keyboard-aware composer, attachment action sheet, swipe/back navigation, long-press message actions, and virtualized lists.

### Contacts and templates

- Contacts: paginated list, search, add/edit/delete, import where supported.
- Contact groups: group list, member management, create/edit/delete.
- Templates: list/filter/status, preview, add/edit/view/delete; WhatsApp header/body/footer/buttons and variable previews must match web behavior. Template sending from chat opens a searchable bottom sheet and substitutes variables.

### Campaigns

- Campaign list with pagination and status mapping (`pending`, `scheduled`, `complete`, `stopped`; display-friendly labels may differ).
- Create campaign: name, template, audience type (contacts, groups, Excel upload, Google Sheet), variable mapping, media, schedule/date-time, summary and confirmation.
- Details: campaign metrics/messages, duplicate, delete. Use a stepper on mobile and preserve drafts locally until submission.

### Automation and team

- Auto Reply and Flow builder: list/edit automation, nodes/conditions/actions, enable/disable, test/save.
- Agent Management: list agents, fetch by email, add/delete, map agent, change permission.
- Permission List: create/edit permission sets and assign access.
- Agent Config: list/add/delete provider API keys and toggle personal-key mode.
- Developer Access: expose project API credentials/instructions with secure reveal/copy controls.

### Wallet, payments, support

- Wallet recharge: amount, promo code where available, create payment order, open Razorpay/Cashfree/UPI checkout using native/browser SDK, redirect/deep-link return, verify status, refresh balance.
- Transactions: date range, filters, pagination, transaction detail/status.
- Payment status: success/failure/pending state for order id with retry and transaction link.
- Support: FAQs/contact channels and case/help actions.

## API endpoint inventory

Keep endpoint paths exactly as used by the web app. Project-scoped payloads normally include `project_id`; pagination commonly includes `page`, `limit`/`per_page`, and optional `search`/status/date filters.

**Account/session:** `/account/login`, `/account/profile`, `/account/register` (registration implementation), `/account/google-register`, `/account/reset-password-request`, `/account/reset-password`, `/account/edit-profile`, `/account/change-password`, `/account/session-check`.

**Projects:** `/project/info`, `/project/meta-details`, `/project/create-project`, `/project/embed-signup`, `/project/submit-waba-id`, `/project/update-waba-profile-picture`, `/project/update-waba-profile-details`.

**Payments/plans:** `/payment/wallet-topup`, `/payment/verify`, `/payment/payment-status`, `/payment/promo-code/validate?code=…`, `/payment/transactions`, `/plan`, `/plan/purchase`.

**Inbox/messaging:** `/message/total-unread-count`, `/message/open-case-list`, `/message/case-create`, `/message/case-edit`, `/message/case-list`, `/message/send-template`, plus the conversation/message endpoints used by `LiveChat`, `Conversation`, and `Chat` (keep those paths centralized in `api/messages.ts`).

**Templates:** `/template/template-list`, `/template/create-template`, `/template/template-details`, `/template/template-edit`, `/template/template-delete`.

**Campaigns:** `/campaign/list`, `/campaign/campaign-details`, `/campaign/campaign-messages`, `/campaign/delete`, `/campaign/duplicate`.

**Contacts/groups:** `/contact/contact-list` and the contact/group endpoints used by `Contact`, `ContactGroup`, `ContactGroupList`, and campaign audience selectors.

**Automation/project settings:** `/bot-reply/toggle-auto-reply`, `/bot-reply/update-auto-reply-type`, `/bot-reply/update-context`, `/bot-reply/update-auto-case-create`, `/bot-reply/list-api-keys`, `/bot-reply/save-api-key`, `/bot-reply/delete-api-key`.

**Agents/permissions:** `/permission/list`, `/agent/list`, `/agent/fetch-agent`, `/agent/mapping`, `/agent/add`, `/agent/delete`, `/agent/change-permission`, and permission create/edit/set-access paths used by `PermissionsList`.

When an endpoint is not listed above, treat the existing frontend source as canonical: search the corresponding page for its `axios` call and copy its path, method, encrypted payload fields, headers, and response mapping unchanged.

## Mobile UX and design system

- Use safe-area insets, 44pt minimum touch targets, keyboard avoidance, pull-to-refresh, skeletons, empty/error/offline states, and accessible labels.
- Replace desktop tables with cards; dense filters become a filter sheet; modals become bottom sheets; hover tooltips become press/long-press help.
- Inbox uses split behavior: conversation list screen → thread screen on phones, with unread badge and persistent composer.
- Use a restrained 1Chatting palette: white surfaces, slate text, emerald success/primary, red destructive, amber warning, rounded cards, subtle borders, and the existing logo assets.
- Support light/dark theme, dynamic font scaling, RTL-safe layouts, screen-reader semantics, haptic confirmation for destructive/payment actions, and localized date/time/currency formatting.

## Data, uploads, and reliability

- Replace `localStorage` with secure storage plus Redux persistence. Never persist passwords, payment secrets, or raw API keys in plaintext.
- Use `FormData` for uploads with the upload service header; show progress, size/type validation, retry, cancellation, and preview.
- Use React Query/RTK Query for cache invalidation keyed by `projectId`; invalidate project-scoped caches after project switch or mutation.
- Normalize timestamps to ISO internally and render with the user/device timezone. Preserve server pagination and cursor semantics.
- Every mutation needs loading, success, server-error, timeout, and retry states. Disable duplicate submissions and make destructive actions confirmable.

## Suggested project structure

```text
src/
  api/{client,auth,projects,messages,templates,campaigns,contacts,payments,agents}.ts
  crypto/encryptPayload.ts
  navigation/{AuthNavigator,RootNavigator,TabNavigator}.tsx
  store/{auth,project,inbox,ui}.ts
  screens/{auth,inbox,campaigns,contacts,templates,more}.tsx
  components/{MessageBubble,Composer,ProjectSwitcher,BottomSheet,MediaPreview}.tsx
  services/{socket,upload,payments,notifications}.ts
  theme/{colors,spacing,typography}.ts
```

## Acceptance checklist

The mobile app is complete when a user can authenticate, switch projects, see current balance/unread count, receive and send chat messages (including templates/media), manage contacts/templates/campaigns, configure automation/agents/permissions, recharge and verify wallet payments, and edit profile/support settings with the same API payloads and response behavior as this frontend. Test token expiry, project switching, reconnect/offline recovery, upload failure, payment return links, empty lists, pagination, and denied permissions on both iOS and Android.

