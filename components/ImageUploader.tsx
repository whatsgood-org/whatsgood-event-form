"use client";

import { useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, prepareImageForUpload, uploadErrorMessage } from "@/lib/image";

interface Props {
  images: string[];
  onChange: (urls: string[]) => void;
  apiBase: string;
  eventTitle?: string;
  customerUuid?: string;
}

const UPLOAD_TIMEOUT_MS = 90_000;
const UPLOAD_ATTEMPTS = 2;

async function uploadFile(file: File, apiBase: string, eventTitle?: string, customerUuid?: string): Promise<string> {
  // Shrink before sending (ENG-671) — originals over Cloudinary's limits used to 502.
  const upload = await prepareImageForUpload(file);
  // Undecodable in this browser and still oversized — fail fast instead of uploading 20 MB to a 413.
  if (upload.size > MAX_UPLOAD_BYTES) throw new Error(uploadErrorMessage(file.name, 413));
  const formData = new FormData();
  formData.append("file", upload);
  if (eventTitle) formData.append("event_title", eventTitle);
  if (customerUuid) formData.append("customer_uuid", customerUuid);

  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${apiBase}/public/upload-image`, { method: "POST", body: formData, signal: controller.signal });
    } catch {
      // Network drop / timeout (common on mobile, or a cold Railway instance) — retry once.
      if (attempt < UPLOAD_ATTEMPTS) continue;
      throw new Error(uploadErrorMessage(file.name, null));
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return (await res.json()).url;
    const body = await res.json().catch(() => ({}));
    if (res.status >= 500 && res.status !== 502 && attempt < UPLOAD_ATTEMPTS) continue;
    throw new Error(uploadErrorMessage(file.name, res.status, body.detail));
  }
}

export default function ImageUploader({ images, onChange, apiBase, eventTitle, customerUuid }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setUploadCount(files.length);
    setDoneCount(0);

    const results = await Promise.allSettled(
      Array.from(files).map(file =>
        uploadFile(file, apiBase, eventTitle, customerUuid).then(url => {
          setDoneCount(n => n + 1);
          return url;
        })
      )
    );

    const uploaded = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map(r => r.value);

    const failures = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map(r => (r.reason instanceof Error ? r.reason.message : "An image failed to upload."));

    if (failures.length > 0) setError(failures.join(" "));
    if (uploaded.length > 0) onChange([...images, ...uploaded]);

    setUploading(false);
    setUploadCount(0);
    setDoneCount(0);
    // Reset input so the same files can be re-selected if needed
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeImage(url: string) {
    onChange(images.filter(u => u !== url));
  }

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-300 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-12 h-12">
              {/* Track */}
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                {/* Spinning indeterminate arc */}
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke="#6b7280" strokeWidth="3.5"
                  strokeDasharray="28 85"
                  strokeLinecap="round"
                  style={{ animation: "spin 0.9s linear infinite", transformOrigin: "50% 50%" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-500">
                {doneCount}/{uploadCount}
              </span>
            </div>
            <span className="text-sm text-gray-500">Uploading images...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Click or drag to upload — select multiple at once</span>
            <span className="text-xs">Preferred: 3×4 vertical</span>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(url => (
            <div key={url} className="relative group w-24 h-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Event" className="w-full h-full object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
