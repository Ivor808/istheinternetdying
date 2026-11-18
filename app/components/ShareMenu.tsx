import { useEffect, useRef, useState } from 'react';
import { SITE_URL } from '@/data/site';

// "share" on the Death Index card: the phone share sheet where there is one, otherwise a small menu

interface Props {
  url: string;
  imageUrl: string;
  text: string;
}

const BADGE_MD = `[![Death Index](${SITE_URL}/badge.svg)](${SITE_URL})`;
const EMBED_HTML = `<iframe src="${SITE_URL}/embed" width="400" height="250" style="border:0" title="Death Index" loading="lazy"></iframe>`;

export function ShareMenu({ url, imageUrl, text }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const onShare = async () => {
    // Touch devices get the native sheet; desktop share sheets are awkward, so use the menu there
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: 'Is the internet dying?', text, url });
        return;
      } catch {
        // Cancelled or unsupported: fall back to the menu
      }
    }
    setOpen((v) => !v);
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      window.prompt('Copy this:', value);
    }
  };

  const item = (key: string, label: string, value: string) => (
    <button className="sm-item" onClick={() => copy(key, value)}>
      {copied === key ? 'copied' : label}
    </button>
  );

  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: SM_CSS }} />
      <button className="dc-link" aria-expanded={open} onClick={onShare}>
        share
      </button>
      {open && (
        <span className="sm-menu" role="menu">
          {item('link', 'copy link', `${text} ${url}`)}
          <a className="sm-item" href={imageUrl} download="death-index.png">
            download image
          </a>
          {item('badge', 'README badge', BADGE_MD)}
          {item('embed', 'embed code', EMBED_HTML)}
        </span>
      )}
    </span>
  );
}

const SM_CSS = `
.sm-menu { position: absolute; right: 0; top: calc(100% + 0.5rem); z-index: 10; display: flex; flex-direction: column; min-width: 10.5rem; padding: 0.3rem; background: #14141b; border: 1px solid #2a2a33; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.sm-item { display: block; text-align: left; background: none; border: 0; border-radius: 5px; padding: 0.4rem 0.6rem; color: #ececf1; font: inherit; font-size: 0.8rem; text-decoration: none; cursor: pointer; white-space: nowrap; }
.sm-item:hover { background: #1c1c24; }
`;
