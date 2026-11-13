# Onechatting Task Findings

The user confirmed implementation after reviewing the findings. The scope below includes the follow-up clarifications.

## 1. FCM notification opens in the wrong project

- `src/services/pushService.ts` reads the notification's `contactNumber` and `contactName`, but drops its `projectId` when calling the open handler.
- `src/services/notificationService.ts` also dispatches only the contact number and name for notification taps, although notification data includes `projectId`.
- `src/screens/WorkspaceScreen.tsx` opens the contact using the currently selected project. A notification from another project therefore cannot route the chat to its originating project.
- **Finding:** Preserve the notification's project ID through the tap callback and select/route to that project before opening the chat. The notification should not silently open the same contact under the wrong project.

## 2. Media preview cannot swap between attachments

- `src/screens/ChatRoomScreen.tsx` opens the viewer with one URL, one media type, and an optional name.
- `src/components/MediaViewerModal.tsx` only renders that single media item; it has no neighboring media list, previous/next controls, or swipe navigation.
- **Finding:** The preview cannot move between chat attachments. The confirmed behavior is gallery-style swiping through conversation photos and videos.

## 3. Android document/media download shows a success dialog

- `src/components/MediaViewerModal.tsx` downloads to Android's public Downloads location, then calls `Alert.alert('Saved!', ...)`.
- The app already has a top toast component at `src/ui/toast.tsx`, used throughout screens including `src/screens/ContactsScreen.tsx`.
- **Finding:** Replace the Android successful-download alert with the existing toast. Keep download failures and permission problems visible as errors; the requested change is to the success confirmation.

## 4. QR actions are incomplete or unclear

- The QR actions are in `src/components/Modals/ProjectQRModal.tsx`.
- The “Copy Link” handler only changes its icon and displays a success toast; it does not copy the URL to the clipboard.
- The system-share action shares the QR URL and message, not an image of the displayed QR code.
- Action labels are commented out, so the WhatsApp, share, copy, and open-link controls are icon-only.
- **Finding:** Copy should write the link to the clipboard. Sharing should include both the QR image and its link.

## 5. Modal sheets cannot be dragged down to dismiss

- `src/components/animations/SlideUpModal.tsx` animates a sheet and supports backdrop dismissal, but has no drag gesture.
- Several other modals use React Native `Modal` directly, including the interactive-options sheet in `src/screens/ChatRoomScreen.tsx` and sheets/dialogs in `src/components/`.
- **Finding:** Drag-to-dismiss is not consistently available. The confirmed scope is all sheet-style modals, excluding full-screen media preview and centered dialogs.

## 6. Chat template filtering is only partly covered

- `src/components/TemplateModal.tsx` already provides a search field that matches template name and category, and limits results to approved templates.
- It does not provide category filter controls, and its text search reads `template_name` rather than the `name` fallback used elsewhere in the template list.
- **Finding:** Basic text filtering exists, but category controls are missing and search does not cover the `name` fallback. The confirmed scope is name search plus category filtering.

## Proposed implementation scope

1. Route notification taps using the notification's project ID and open the chat in that project.
2. Add swipe navigation between the chat's media attachments in the media preview.
3. Use the existing toast for successful Android downloads.
4. Complete QR copy/share actions with both URL and QR-image sharing.
5. Add drag-to-dismiss to all sheet-style modals.
6. Add category controls and support both template name fields in chat template search.
