import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './PostMarkdown.css';

const plugins = [remarkGfm];
export function AssistantMarkdown({ text }: { text: string }) {
  return <div className="post-markdown assistant-markdown"><Markdown remarkPlugins={plugins} skipHtml components={{
    a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ alt }) => <span>{alt || 'Image'}</span>
  }}>{text}</Markdown></div>;
}
