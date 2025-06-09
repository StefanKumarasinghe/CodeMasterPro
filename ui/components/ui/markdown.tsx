import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './code-block';

interface MarkdownProps {
  children: string;
}

export function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || '');
          return match ? (
            <CodeBlock code={String(children)} language={match[1]} />
          ) : (
            <code className={className}>{children}</code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
} 