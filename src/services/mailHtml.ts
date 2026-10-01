import DOMPurify from 'dompurify';

// Mail is untrusted: allow ordinary content, never scripts, forms or event handlers.
export function renderMailHtml(content: string, images: Record<string, string> = {}): string {
  const html = DOMPurify.sanitize(content, {
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|cid:|data:image\/(png|jpeg|gif|webp);base64,)/i,
    ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'hr', 'a', 'img'],
    ALLOWED_ATTR: ['colspan', 'rowspan', 'href', 'src', 'alt', 'title', 'width', 'height'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const link of document.querySelectorAll('a')) {
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(link.getAttribute('href') || '')) link.removeAttribute('href');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  for (const image of document.querySelectorAll('img')) {
    const src = image.getAttribute('src') || '';
    if (src.toLowerCase().startsWith('cid:') && images[src.slice(4)]) image.setAttribute('src', images[src.slice(4)]);
    if (!/^(https:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(image.getAttribute('src') || '')) image.removeAttribute('src');
    image.setAttribute('referrerpolicy', 'no-referrer');
    image.setAttribute('loading', 'lazy');
  }
  return document.body.innerHTML;
}
