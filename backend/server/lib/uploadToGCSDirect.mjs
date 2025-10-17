import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

export async function uploadToGCSDirect(
  bucket,
  objectName,
  content,
  contentType = "application/octet-stream",
  cacheControl = "public, max-age=3600"
) {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/devstorage.read_write"]
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const bodyBuf = Buffer.isBuffer(content) ? content : Buffer.from(String(content));

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token || token}`,
      "Content-Type": contentType,
      "Cache-Control": cacheControl
    },
    body: bodyBuf
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GCS direct upload failed (${r.status}): ${txt}`);
  }

  return `https://storage.googleapis.com/${bucket}/${objectName}`;
}
