import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { asyncHandler } from '../middleware.js';

export const legalRouter = express.Router();

function renderMarkdown(markdown: string) {
  // Front matter describes the source document and is not public page content.
  const body = markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  return renderToStaticMarkup(createElement(Markdown, {
    remarkPlugins: [remarkGfm],
    skipHtml: true,
    children: body
  }));
}

legalRouter.get('/:page', asyncHandler(async (req, res) => {
  const page = String(req.params.page || '').replace(/[^a-z0-9_-]/gi, '');
  if (!page) return res.status(400).json({ error: 'Invalid document request' });

  try {
    const filePath = path.join(process.cwd(), 'docs', `${page}.md`);
    let html = renderMarkdown(await fs.readFile(filePath, 'utf8'));
    if (page === 'third_party_notices') {
      const [llamaLicense, webLlmLicense] = await Promise.all([
        fs.readFile(path.join(process.cwd(), 'docs', 'LLAMA-3.2-LICENSE.txt'), 'utf8'),
        fs.readFile(path.join(process.cwd(), 'node_modules', '@mlc-ai', 'web-llm', 'LICENSE'), 'utf8')
      ]);
      const escapeLicense = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      html += `<h2>Llama 3.2 Community License</h2><pre>${escapeLicense(llamaLicense)}</pre>`;
      html += `<h2>WebLLM — Apache License 2.0</h2><pre>${escapeLicense(webLlmLicense)}</pre>`;
    }
    res.type('html').send(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <link rel="icon" href="/logo.png"/>
      <title>${page.replaceAll('_', ' ')} — Q Legal</title>
      <style>
        body{background:#020617;color:#e2e8f0;font:16px/1.7 system-ui;margin:0}
        main{max-width:56rem;margin:3rem auto;padding:0 1.5rem}
        article{min-width:0;overflow-wrap:anywhere;margin:2rem 0}
        h1,h2,h3,h4,h5,h6{line-height:1.3;color:#f8fafc;margin:2rem 0 1rem}
        h1{font-size:2rem}h2{font-size:1.5rem}h3{font-size:1.25rem}
        p,ul,ol,blockquote{margin:1rem 0}ul,ol{padding-left:1.5rem}li+li{margin-top:.4rem}
        a{color:#a5b4fc;text-underline-offset:3px}a:hover{color:#c7d2fe}
        a:focus-visible{outline:2px solid #a5b4fc;outline-offset:4px}
        blockquote{border-left:3px solid #818cf8;padding-left:1rem;color:#cbd5e1}
        table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:1.5rem 0}
        th,td{border:1px solid #475569;padding:.65rem .85rem;text-align:left;vertical-align:top}
        th{background:#1e293b;color:#f8fafc}code{background:#0f172a;border-radius:.25rem;padding:.15rem .3rem;font-size:.9em}
        pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:1rem;font:12px/1.55 ui-monospace,monospace}
        pre code{padding:0}hr{border:0;border-top:1px solid #334155;margin:2rem 0}
        img{max-width:100%;height:auto}footer{border-top:1px solid #334155;padding-top:1.5rem;color:#94a3b8;font-size:.875rem}
        @media(max-width:600px){main{margin:1.5rem auto;padding:0 1rem}h1{font-size:1.75rem}th,td{padding:.5rem}}
      </style></head>
      <body><main><nav><a href="/">← Return to Dashboard</a></nav><article>${html}</article>
      <footer>© ${new Date().getFullYear()} Q Life Operating System. All rights reserved.</footer></main></body></html>`);
  } catch (error) {
    console.error(`[Legal] Error rendering ${page}:`, error);
    return res.status(404).send('Document not found');
  }
}));
