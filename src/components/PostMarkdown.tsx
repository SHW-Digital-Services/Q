import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './PostMarkdown.css';

const plugins = [remarkGfm];

export function PostMarkdown({ body }: { body: string }) {
  return (
    <div className="post-markdown">
      <Markdown remarkPlugins={plugins} skipHtml>{body}</Markdown>
    </div>
  );
}
