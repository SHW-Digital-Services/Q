import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { asyncHandler } from '../middleware';

export const legalRouter = express.Router();

function renderMarkdown(markdown: string) {
  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  return markdown.split(/\r?\n\r?\n/).map((block) => {
    const text = escapeHtml(block.trim());
    if (!text) return '';
    if (text.startsWith('### ')) return `<h3>${text.slice(4)}</h3>`;
    if (text.startsWith('## ')) return `<h2>${text.slice(3)}</h2>`;
    if (text.startsWith('# ')) return `<h1>${text.slice(2)}</h1>`;
    return `<p>${text.replaceAll(/\r?\n/g, '<br/>')}</p>`;
  }).join('\n');
}

legalRouter.get('/:page', asyncHandler(async (req, res) => {
  const page = String(req.params.page || '').replace(/[^a-z0-9_-]/gi, '');
  if (!page) return res.status(400).json({ error: 'Invalid document request' });

  try {
    const filePath = path.join(process.cwd(), 'docs', `${page}.md`);
    const html = renderMarkdown(await fs.readFile(filePath, 'utf8'));
    res.type('html').send(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${page.replaceAll('_', ' ')} — Q Legal</title>
      <style>body{background:#020617;color:#e2e8f0;font:16px/1.6 system-ui;margin:0}main{max-width:48rem;margin:4rem auto;padding:0 1.5rem}h1,h2,h3{line-height:1.2}a{color:#818cf8}</style></head>
      <body><main><nav><a href="/">← Return to Dashboard</a></nav><article>${html}</article>
      <footer>© ${new Date().getFullYear()} Q Life Operating System. All rights reserved.</footer></main></body></html>`);
  } catch (error) {
    console.error(`[Legal] Error rendering ${page}:`, error);
    return res.status(404).send('Document not found');
  }
}));
