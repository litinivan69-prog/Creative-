"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BRAND_ASSET_FILE_SIZE = 20 * 1024 * 1024;
const OVERSIZED_FILE_MESSAGE =
  "Файл слишком большой. Максимальный размер для MVP — 20 МБ. Сожмите PDF или добавьте материал текстом.";

type BrandAssetFileInputProps = {
  className: string;
};

export function BrandAssetFileInput({ className }: BrandAssetFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  function validateSelectedFile() {
    const file = inputRef.current?.files?.[0];
    const nextError = file && file.size > MAX_BRAND_ASSET_FILE_SIZE ? OVERSIZED_FILE_MESSAGE : "";

    setError(nextError);
    return !nextError;
  }

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    function handleSubmit(event: SubmitEvent) {
      if (!validateSelectedFile()) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
      Файл
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className={className}
        onChange={validateSelectedFile}
      />
      <span className="text-xs font-medium leading-5 text-stone-500">
        PDF, PNG, JPG, WEBP до 20 МБ. Большие брендбуки пока добавляйте текстовым описанием или сжимайте перед загрузкой.
      </span>
      {error ? (
        <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-800">
          {error}
        </span>
      ) : null}
    </label>
  );
}
