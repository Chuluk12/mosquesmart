import React, { useId, useRef, useState } from 'react';
import './s3-upload.css';

export type S3UploadResult = {
  key: string;
  url?: string;
  etag?: string;
  file: File;
};

export type S3UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'success' | 'error';
  error?: string;
};

type Props = {
  uploadFile: (file: File, onProgress: (progress: number) => void, signal: AbortSignal) => Promise<S3UploadResult>;
  onUploaded?: (result: S3UploadResult) => void;
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function S3Upload({
  uploadFile,
  onUploaded,
  accept,
  maxSizeBytes = 100 * 1024 * 1024,
  multiple = true,
  disabled = false,
  className = '',
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const [items, setItems] = useState<S3UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState('');

  const updateItem = (id: string, update: Partial<S3UploadItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...update } : item));
  };

  const upload = async (item: S3UploadItem) => {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
    try {
      const result = await uploadFile(item.file, progress => updateItem(item.id, { progress }), controller.signal);
      updateItem(item.id, { status: 'success', progress: 100 });
      onUploaded?.(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        updateItem(item.id, { status: 'error', error: error instanceof Error ? error.message : 'Upload gagal.' });
      }
    } finally {
      controllers.current.delete(item.id);
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    setValidationError('');
    const files = Array.from(fileList).slice(0, multiple ? undefined : 1);
    const next: S3UploadItem[] = [];
    for (const file of files) {
      if (file.size > maxSizeBytes) {
        setValidationError(`${file.name} melebihi batas ${formatSize(maxSizeBytes)}.`);
        continue;
      }
      next.push({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, progress: 0, status: 'queued' });
    }
    if (!next.length) return;
    setItems(current => multiple ? [...current, ...next] : next);
    next.forEach(item => void upload(item));
  };

  const remove = (item: S3UploadItem) => {
    controllers.current.get(item.id)?.abort();
    controllers.current.delete(item.id);
    setItems(current => current.filter(currentItem => currentItem.id !== item.id));
  };

  return <section className={`s3-upload ${className}`}>
    <input
      ref={inputRef}
      id={inputId}
      className="s3-upload-input"
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      onChange={event => {
        if (event.target.files) addFiles(event.target.files);
        event.target.value = '';
      }}
    />
    <label
      htmlFor={inputId}
      className={`s3-upload-dropzone${dragging ? ' is-dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) addFiles(event.dataTransfer.files); }}
    >
      <span className="s3-upload-icon" aria-hidden="true">↑</span>
      <strong>Tarik file ke sini</strong>
      <span>atau klik untuk memilih {multiple ? 'beberapa file' : 'file'}</span>
      <small>{accept ? `Format: ${accept}` : 'Semua format'} · Maks. {formatSize(maxSizeBytes)}</small>
    </label>
    {validationError && <p className="s3-upload-error" role="alert">{validationError}</p>}
    {items.length > 0 && <ul className="s3-upload-list" aria-live="polite">
      {items.map(item => <li className="s3-upload-item" key={item.id}>
        <div className="s3-upload-file">
          <strong title={item.file.name}>{item.file.name}</strong>
          <small>{formatSize(item.file.size)}</small>
        </div>
        <div className="s3-upload-status">
          {item.status === 'uploading' && <><progress value={item.progress} max="100" /> <span>{item.progress}%</span></>}
          {item.status === 'queued' && <span>Menunggu...</span>}
          {item.status === 'success' && <span className="is-success">Terupload</span>}
          {item.status === 'error' && <span className="is-error" title={item.error}>Gagal</span>}
        </div>
        <button type="button" className="s3-upload-remove" onClick={() => remove(item)} aria-label={`Hapus ${item.file.name}`}>×</button>
      </li>)}
    </ul>}
  </section>;
}
