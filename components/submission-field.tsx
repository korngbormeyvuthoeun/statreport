'use client';
/* oxlint-disable next/no-img-element -- Device-local photo previews must never go through an image optimization server. */
import { useEffect, useRef, useState, type Ref } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  ImagePlus,
  Keyboard,
  LoaderCircle,
  ScanText,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  combinePhotoText,
  MAX_PHOTOS,
  PHOTO_ACCEPT,
  TranscriptionSchema,
  type Transcription,
} from '@/lib/photos';
import { preparePhoto } from '@/lib/photo-client';

type Photo = { id: string; name: string; dataUrl: string };
type Props = {
  target: 'question' | 'answer';
  value: string;
  onChange: (value: string) => void;
  inputRef: Ref<HTMLTextAreaElement>;
  disabled: boolean;
  readOnly?: boolean;
  configured: boolean;
  error?: string;
  onPhotoState: (
    target: 'question' | 'answer',
    pending: boolean,
    working: boolean,
  ) => void;
};

export default function SubmissionField({
  target,
  value,
  onChange,
  inputRef,
  disabled,
  readOnly = false,
  configured,
  error,
  onPhotoState,
}: Props) {
  const [mode, setMode] = useState('text');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [result, setResult] = useState<Transcription | null>(null);
  const [draft, setDraft] = useState('');
  const [checked, setChecked] = useState(false);
  const [append, setAppend] = useState(true);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const operation = useRef(false);
  const locked = disabled || working;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    onPhotoState(target, photos.length > 0, working);
  }, [target, photos.length, working, onPhotoState]);
  useEffect(
    () => () => onPhotoState(target, false, false),
    [target, onPhotoState],
  );
  useEffect(() => {
    if (result) reviewRef.current?.focus();
  }, [result]);
  const invalidate = () => {
    setResult(null);
    setDraft('');
    setChecked(false);
    setPhotoError('');
    setNotice('');
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || locked || operation.current) return;
    const selected = Array.from(files);
    if (photos.length + selected.length > MAX_PHOTOS) {
      setPhotoError(
        `Add up to ${MAX_PHOTOS} photos for your ${target}. Remove a page before adding more.`,
      );
      return;
    }
    operation.current = true;
    setWorking(true);
    setStage('Preparing your photos…');
    setPhotoError('');
    const added: Photo[] = [];
    try {
      for (const file of selected) {
        const dataUrl = await preparePhoto(file);
        added.push({ id: crypto.randomUUID(), name: file.name, dataUrl });
      }
      if (mounted.current) {
        invalidate();
        setPhotos((p) => [...p, ...added]);
      }
    } catch (e) {
      if (mounted.current)
        setPhotoError(
          e instanceof Error
            ? e.message
            : 'These photos could not be opened. Please try again.',
        );
    } finally {
      operation.current = false;
      if (mounted.current) {
        setWorking(false);
        setStage('');
      }
    }
  };
  const extract = async () => {
    if (locked || operation.current || !photos.length) return;
    if (!configured) {
      setPhotoError(
        'Photo reading needs AI setup. You can still type or paste your work.',
      );
      return;
    }
    operation.current = true;
    setWorking(true);
    setStage('Reading your photos…');
    setPhotoError('');
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort('timeout'), 130000);
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, images: photos.map((p) => p.dataUrl) }),
        signal: controller.signal,
      });
      const data = (await response.json()) as unknown;
      if (!response.ok)
        throw new Error(
          (data as { error?: { message?: string } }).error?.message ||
            'Photo reading failed. Your photos are still here; please try again.',
        );
      const parsed = TranscriptionSchema.parse(data);
      if (mounted.current) {
        setResult(parsed);
        setDraft(parsed.text);
        setChecked(false);
      }
    } catch (e) {
      if (mounted.current)
        setPhotoError(
          controller.signal.aborted
            ? 'Photo reading stopped. Your photos are kept here; retry when you’re ready.'
            : e instanceof Error
              ? e.message
              : 'Could not read these photos. Please try again.',
        );
    } finally {
      clearTimeout(timer);
      controllerRef.current = null;
      operation.current = false;
      if (mounted.current) {
        setWorking(false);
        setStage('');
      }
    }
  };
  const useText = () => {
    if (!checked || locked) return;
    try {
      onChange(combinePhotoText(value, draft, append));
      setPhotos([]);
      invalidate();
      setMode('text');
      setNotice(
        `Photo text added to your ${target}. You can keep editing below.`,
      );
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Check the photo text.');
    }
  };
  const discard = () => {
    setPhotos([]);
    invalidate();
    setMode('text');
  };
  const move = (index: number, direction: number) => {
    setPhotos((p) => {
      const next = [...p];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
    invalidate();
  };
  return (
    <section className="submission-field" aria-labelledby={`${target}-heading`}>
      <div className="submission-field-heading">
        <span className="field-step">{target === 'question' ? '1' : '2'}</span>
        <div>
          <h3 id={`${target}-heading`}>
            {target === 'question' ? 'Your statistics question' : 'Your answer'}{' '}
            <span className="required">*</span>
          </h3>
          <p id={`${target}-hint`} className="field-hint">
            {readOnly
              ? 'The question stays the same for this revision.'
              : target === 'question'
                ? 'Include all subparts, tables, and graphs.'
                : 'Include your calculations and written reasoning.'}
          </p>
        </div>
      </div>
      <Tabs
        value={mode}
        onValueChange={(v) => !locked && setMode(String(v))}
        className="entry-tabs"
      >
        {!readOnly && (
          <TabsList aria-label={`How to add your ${target}`}>
            <TabsTrigger value="text" disabled={locked}>
              <Keyboard size={16} />
              Type / paste
            </TabsTrigger>
            <TabsTrigger value="photos" disabled={locked}>
              <Camera size={16} />
              Photos{' '}
              {photos.length > 0 && (
                <span className="count-badge">{photos.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="text">
          {photos.length > 0 && (
            <div className="photo-pending">
              <p>
                Your photo draft is waiting in Photos. Review it there or
                discard it to continue typing.
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={locked}
                onClick={discard}
              >
                Discard photo draft
              </Button>
            </div>
          )}
          <label htmlFor={target} className="sr-only">
            {target === 'question'
              ? 'Type or paste your statistics question'
              : 'Type or paste your answer'}
          </label>
          <textarea
            id={target}
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            disabled={locked}
            placeholder={
              target === 'question'
                ? 'Type or paste the complete question here…'
                : 'Show how you approached each part…'
            }
            rows={5}
            maxLength={20000}
            aria-invalid={!!error}
            aria-describedby={`${target}-hint${error ? ` ${target}-error` : ''}`}
          />
          <div className="field-bottom">
            <span>
              {target === 'question'
                ? 'Plain text and statistical notation welcome.'
                : 'Your reasoning matters as much as the result.'}
            </span>
            <span>{value.length.toLocaleString()} / 20,000</span>
          </div>
        </TabsContent>
        {!readOnly && (
          <TabsContent value="photos">
            <div className="photo-workspace">
              <div className="photo-upload">
                <ScanText size={28} strokeWidth={1.4} />
                <h4>
                  {photos.length
                    ? 'Add another page if you need it'
                    : `Add a photo of your ${target}`}
                </h4>
                <p>Use a clear, well-lit photo with the whole page in view.</p>
                <div className="photo-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked || photos.length >= MAX_PHOTOS}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={17} />
                    Choose photos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked || photos.length >= MAX_PHOTOS}
                    onClick={() => cameraRef.current?.click()}
                  >
                    <Camera size={17} />
                    Take a photo
                  </Button>
                </div>
                <p className="photo-formats">
                  JPG, PNG, WebP · Up to 3 pages · 15 MB per photo
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  multiple
                  hidden
                  aria-label={`Choose ${target} photos`}
                  onChange={(e) => {
                    void addPhotos(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  capture="environment"
                  hidden
                  aria-label={`Take ${target} photo`}
                  onChange={(e) => {
                    void addPhotos(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {photos.length > 0 && (
                <ol
                  className="photo-pages"
                  aria-label={`${target} photo pages`}
                >
                  {photos.map((photo, index) => (
                    <li key={photo.id}>
                      <Dialog>
                        <DialogTrigger
                          render={
                            <button
                              type="button"
                              className="photo-thumbnail"
                              aria-label={`Enlarge ${target} page ${index + 1}`}
                            />
                          }
                        >
                          <img
                            src={photo.dataUrl}
                            alt={`${target} page ${index + 1}`}
                          />
                        </DialogTrigger>
                        <DialogContent className="photo-dialog">
                          <DialogHeader>
                            <DialogTitle>
                              {target === 'question' ? 'Question' : 'Answer'} ·
                              page {index + 1}
                            </DialogTitle>
                          </DialogHeader>
                          <img
                            src={photo.dataUrl}
                            alt={`Full ${target} page ${index + 1}`}
                          />
                        </DialogContent>
                      </Dialog>
                      <div className="photo-page-info">
                        <strong>Page {index + 1}</strong>
                        <span title={photo.name}>{photo.name}</span>
                      </div>
                      <div className="photo-page-controls">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={locked || index === 0}
                          aria-label={`Move ${target} page ${index + 1} earlier`}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={locked || index === photos.length - 1}
                          aria-label={`Move ${target} page ${index + 1} later`}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={locked}
                          aria-label={`Remove ${target} page ${index + 1}`}
                          onClick={() => {
                            setPhotos((p) =>
                              p.filter((x) => x.id !== photo.id),
                            );
                            invalidate();
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {!result && (
                <div className="photo-read-actions">
                  <p className="photo-privacy">
                    Reading sends these photos to OpenAI. StatReport keeps no
                    photo archive. Only the text you confirm goes into your
                    report.
                  </p>
                  {!configured && (
                    <p className="photo-setup">
                      Photo reading needs AI setup. You can choose photos now or
                      use Type / paste.
                    </p>
                  )}
                  <Button
                    type="button"
                    className="primary-button"
                    disabled={locked || !photos.length}
                    onClick={() => {
                      void extract();
                    }}
                  >
                    <ScanText size={17} />
                    Read {photos.length > 1 ? 'photos' : 'photo'}
                  </Button>
                  <p className="photo-next">
                    Next: check the text before using it.
                  </p>
                </div>
              )}
              {working && (
                <output className="photo-loading">
                  <LoaderCircle size={18} className="spin" />
                  <span>{stage}</span>
                  {stage === 'Reading your photos…' && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => controllerRef.current?.abort()}
                    >
                      <X size={16} />
                      Cancel
                    </Button>
                  )}
                </output>
              )}
              {result && (
                <div className="photo-review">
                  <div className="photo-review-heading">
                    <Check size={19} />
                    <h4>Check what we read</h4>
                  </div>
                  <p>
                    Compare with your photos. Fix any misread numbers, symbols,
                    or words. Keep your original reasoning.
                  </p>
                  {result.warnings.length > 0 && (
                    <div className="photo-warnings">
                      <strong>Take a closer look</strong>
                      <ul>
                        {result.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <label htmlFor={`${target}-photo-text`}>
                    Text from your photos
                  </label>
                  <textarea
                    ref={reviewRef}
                    id={`${target}-photo-text`}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setChecked(false);
                    }}
                    rows={8}
                    maxLength={20000}
                    disabled={locked}
                    placeholder="If the photo wasn’t readable, enter what you can read or try a clearer photo."
                  />
                  {value.trim() && (
                    <div className="photo-checkbox">
                      <Checkbox
                        id={`${target}-append`}
                        checked={append}
                        onCheckedChange={(v) => setAppend(!!v)}
                        disabled={locked}
                      />
                      <label htmlFor={`${target}-append`}>
                        Add to my existing text{' '}
                        <span>
                          Uncheck to replace the text currently in this field.
                        </span>
                      </label>
                    </div>
                  )}
                  <div className="photo-checkbox">
                    <Checkbox
                      id={`${target}-checked`}
                      checked={checked}
                      onCheckedChange={(v) => setChecked(!!v)}
                      disabled={locked}
                    />
                    <label htmlFor={`${target}-checked`}>
                      I checked this text against my photos.
                    </label>
                  </div>
                  <div className="photo-actions">
                    <Button
                      type="button"
                      className="primary-button"
                      disabled={locked || !checked || !draft.trim()}
                      onClick={useText}
                    >
                      Use this {target}
                      <Check size={17} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked}
                      onClick={() => {
                        void extract();
                      }}
                    >
                      Read again
                    </Button>
                  </div>
                </div>
              )}
              {photoError && (
                <p className="photo-error" role="alert">
                  {photoError}
                </p>
              )}
              {photos.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="photo-discard"
                  disabled={locked}
                  onClick={discard}
                >
                  Discard photos and use typing
                </Button>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
      {notice && (
        <output className="photo-success">
          <Check size={16} />
          {notice}
        </output>
      )}
      {error && (
        <p className="field-error" id={`${target}-error`}>
          {error}
        </p>
      )}
    </section>
  );
}
