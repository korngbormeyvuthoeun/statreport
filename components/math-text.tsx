'use client';
import katex from 'katex';
import 'katex/dist/katex.min.css';
// No HTML/Markdown from the provider is accepted. KaTeX trust stays disabled.
export function MathText({ text }: { text: string }) {
  const pieces = text.split(
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g,
  );
  return (
    <span className="math-text">
      {pieces.map((p, i) => {
        const display = p.startsWith('$$') || p.startsWith('\\['),
          math = display || p.startsWith('$') || p.startsWith('\\(');
        if (!math) return <span key={i}>{p}</span>;
        const delimiter = p.startsWith('$$') || p.startsWith('\\') ? 2 : 1;
        return (
          <span
            key={i}
            className={display ? 'math-display' : ''}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.slice(delimiter, -delimiter), {
                displayMode: display,
                throwOnError: false,
                trust: false,
                strict: 'warn',
                maxExpand: 100,
                maxSize: 10,
                output: 'htmlAndMathml',
              }),
            }}
          />
        );
      })}
    </span>
  );
}
