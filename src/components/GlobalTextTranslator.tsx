import { useEffect, type FC } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'placeholder', 'title'] as const;
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'CODE', 'PRE', 'NOSCRIPT']);

const shouldSkipElement = (element: Element | null) => {
  if (!element) return true;
  if (SKIPPED_TAGS.has(element.tagName)) return true;
  return Boolean(element.closest('[data-no-translate], .notranslate, [contenteditable="true"]'));
};

const preserveAndTranslateAttribute = (
  element: Element,
  attribute: typeof TRANSLATABLE_ATTRIBUTES[number],
  translateText: (value: string) => string
) => {
  const current = element.getAttribute(attribute);
  if (!current) return;

  const originalAttribute = `data-q-i18n-${attribute}`;
  const original = element.getAttribute(originalAttribute) ?? current;
  if (!element.hasAttribute(originalAttribute)) element.setAttribute(originalAttribute, original);

  const translated = translateText(original);
  if (translated !== current) element.setAttribute(attribute, translated);
};

export const GlobalTextTranslator: FC = () => {
  const { language, translateText } = useLanguage();

  useEffect(() => {
    let frame = 0;

    const translateNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (shouldSkipElement(node.parentElement)) return;
        const value = node.nodeValue ?? '';
        const translated = translateText(value);
        if (translated !== value) node.nodeValue = translated;
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as Element;
      if (shouldSkipElement(element)) return;

      TRANSLATABLE_ATTRIBUTES.forEach(attribute => preserveAndTranslateAttribute(element, attribute, translateText));
      element.childNodes.forEach(translateNode);
    };

    const run = () => {
      frame = 0;
      translateNode(document.body);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(run);
    };

    run();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [language, translateText]);

  return null;
};
