import React from 'react';
import { isDesignatedBoldLine } from '../lib/clipboard';

interface FormattedSolutionProps {
  text: string;
  className?: string;
}

function renderInlineContent(text: string) {
  // If line contains inline markdown **bold** tokens, parse them
  if (!text.includes('**')) {
    return text;
  }

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold text-foreground">
          {boldText}
        </strong>
      );
    }
    return part;
  });
}

export const FormattedSolution: React.FC<FormattedSolutionProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Filter out empty lines so all lines are displayed continuously together
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  return (
    <div className={`text-xs sm:text-sm leading-relaxed font-sans ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Bold designated header or conclusion line
        if (isDesignatedBoldLine(trimmed)) {
          const cleanText = trimmed.replace(/^\*\*|\*\*$/g, '').trim();
          return (
            <div 
              key={idx} 
              className="font-bold text-foreground py-0.5 tracking-tight"
            >
              {cleanText}
            </div>
          );
        }

        // Normal line (bullet points, calculations, steps) - unbold
        return (
          <div 
            key={idx} 
            className="font-normal text-foreground/90 py-0.5 leading-relaxed"
          >
            {renderInlineContent(line)}
          </div>
        );
      })}
    </div>
  );
};
