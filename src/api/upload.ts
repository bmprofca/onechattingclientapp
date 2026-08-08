const UPLOAD_URL = 'https://upload.onesaas.in/api/upload';
const UPLOAD_KEY = 'onedevelopers';

export type UploadedFile = {
  success: boolean;
  url: string;
  meta: {
    id: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    image?: { width: number; height: number; type: string };
  };
};

export type PickedFile = {
  uri: string;
  name: string;
  type: string; // mime type, e.g. 'image/png'
};

export async function uploadFile(file: PickedFile): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/octet-stream',
  } as any);

  let response: Response;
  try {
    response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        key: UPLOAD_KEY,
        Accept: 'application/json, text/plain, */*',
        // Do NOT set 'Content-Type' manually — RN needs to set the
        // multipart boundary itself, or the server can't parse the body.
      },
      body: formData,
    });
  } catch (networkError: any) {
    console.log('[uploadFile] network error:', networkError?.message, networkError);
    throw new Error(
      `Network error reaching upload server: ${networkError?.message || 'unknown'}`,
    );
  }

  // Read raw text first so we can see exactly what the server sent back,
  // even if it's HTML (404/500 page) instead of JSON.
  const rawText = await response.text();
  console.log('[uploadFile] status:', response.status);
  console.log('[uploadFile] raw response:', rawText);

  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (parseError) {
    console.log('[uploadFile] response was not valid JSON');
    throw new Error(
      `Server returned non-JSON (status ${response.status}): ${rawText.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `Upload failed with status ${response.status}`,
    );
  }

  if (!data?.success || !data?.url) {
    throw new Error(
      data?.error || data?.message || 'Upload response missing success/url fields',
    );
  }

  return data;
}