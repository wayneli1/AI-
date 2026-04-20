import { useState, useRef, useCallback, useEffect } from 'react';
import { renderAsync } from 'docx-preview';
import { deriveAuditFieldHint } from '../utils/createBidHelpers';

const DESKTOP_BREAKPOINT = 1280;
const MIN_PREVIEW_PANEL_WIDTH = 360;
const MAX_PREVIEW_PANEL_WIDTH = 960;
const MIN_EDITOR_PANEL_WIDTH = 480;

/**
 * 预览面板相关的Hook
 * 包含预览渲染、锚点装饰、滚动定位、高亮等逻辑
 */
export const usePreviewPanel = (originalFile, step, scannedBlanks, manualEdits) => {
  const [highlightBlankId, setHighlightBlankId] = useState(null);
  const previewRef = useRef(null);
  const previewScrollRef = useRef(null);
  const previewResizeStateRef = useRef({ startX: 0, startWidth: 0 });
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(() => {
    const viewportWidth = window.innerWidth;
    const maxWidth = Math.min(MAX_PREVIEW_PANEL_WIDTH, viewportWidth - MIN_EDITOR_PANEL_WIDTH);
    const defaultWidth = Math.round(viewportWidth * 0.48);
    return Math.min(Math.max(defaultWidth, MIN_PREVIEW_PANEL_WIDTH), maxWidth);
  });

  const clampPreviewPanelWidth = useCallback((nextWidth, viewportWidth = window.innerWidth) => {
    const maxWidth = Math.max(
      MIN_PREVIEW_PANEL_WIDTH,
      Math.min(MAX_PREVIEW_PANEL_WIDTH, viewportWidth - MIN_EDITOR_PANEL_WIDTH)
    );
    return Math.min(Math.max(nextWidth, MIN_PREVIEW_PANEL_WIDTH), maxWidth);
  }, []);

  const getPreviewLocatorText = useCallback((blank) => {
    if (!blank) return '';

    if (blank.type === 'empty_cell') {
      return (blank._cellLabel || blank.context || '').replace('：[空白单元格]', '').trim();
    }

    if (blank.context && blank.matchText) {
      const contextWithoutBlank = blank.context.replace(blank.matchText, ' ').replace(/\s+/g, ' ').trim();
      if (contextWithoutBlank) return contextWithoutBlank;
    }

    if (blank.matchText && !/^\s+$/.test(blank.matchText) && blank.matchText !== '[空白单元格]') {
      return blank.matchText.trim();
    }

    return (blank.context || '').trim();
  }, []);

  const normalizePreviewText = useCallback((text) => {
    return (text || '').replace(/\s+/g, ' ').trim();
  }, []);

  const collectPreviewCandidates = useCallback((container) => {
    const selector = 'span, p, td, th, div, li';
    const rawCandidates = Array.from(container.querySelectorAll(selector))
      .map((node, index) => ({ node, text: normalizePreviewText(node.textContent), index }))
      .filter(({ text }) => text && text.length <= 400);

    return rawCandidates.filter(({ node, text }) => {
      const duplicateDescendant = Array.from(node.querySelectorAll(selector)).some((child) => {
        if (child === node) return false;
        return normalizePreviewText(child.textContent) === text;
      });
      return !duplicateDescendant;
    });
  }, [normalizePreviewText]);

  const getPreviewAnchorTokens = useCallback((blank) => {
    if (!blank) return [];

    const tokens = [];
    const locatorText = getPreviewLocatorText(blank);
    const cleanContext = normalizePreviewText(blank.context || '');
    const cleanMatchText = normalizePreviewText(blank.matchText || '');

    if (blank.type === 'empty_cell') {
      const label = normalizePreviewText((blank._cellLabel || '').replace('：[空白单元格]', ''));
      if (label) tokens.push(label);

      if (label.includes('（项：')) {
        const parts = label.replace('）', '').split('（项：').map((part) => normalizePreviewText(part));
        parts.forEach((part) => {
          if (part) tokens.push(part);
        });
      }
    }

    if (cleanMatchText && cleanMatchText !== '[空白单元格]' && !/^_+$/.test(cleanMatchText) && !/^-+$/.test(cleanMatchText)) {
      tokens.push(cleanMatchText);
    }

    if (locatorText) tokens.push(normalizePreviewText(locatorText));
    if (cleanContext) tokens.push(cleanContext);

    return [...new Set(tokens)].filter((token) => token && token.length >= 2);
  }, [getPreviewLocatorText, normalizePreviewText]);

  const getBlankDisplayName = useCallback((blank) => {
    if (!blank) return '';
    if (blank._cellLabel) return blank._cellLabel;
    const locatorText = getPreviewLocatorText(blank);
    if (locatorText) return locatorText;
    return normalizePreviewText(blank.context || blank.matchText || blank.id);
  }, [getPreviewLocatorText, normalizePreviewText]);

  const clearPreviewAnchors = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    container.querySelectorAll('[data-preview-blank-ids]').forEach((node) => {
      node.removeAttribute('data-preview-blank-ids');
      node.removeAttribute('data-preview-primary-blank-id');
      node.classList.remove('preview-blank-anchor', 'preview-blank-anchor-active');
      node.style.cursor = '';
      node.style.transition = '';
      node.style.borderRadius = '';
      node.style.backgroundColor = '';
      node.style.boxShadow = '';
      node.onclick = null;
      node.onkeydown = null;
    });
  }, []);

  const applyPreviewAnchorStyles = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    container.querySelectorAll('[data-preview-blank-ids]').forEach((node) => {
      const ids = (node.getAttribute('data-preview-blank-ids') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const relatedBlanks = ids
        .map((id) => scannedBlanks.find((blank) => blank.id === id))
        .filter(Boolean);

      const hasFilled = relatedBlanks.some((blank) => !!manualEdits[blank.id]);
      const hasPending = relatedBlanks.some((blank) => !manualEdits[blank.id]);
      const isActive = highlightBlankId && ids.includes(highlightBlankId);

      node.style.cursor = 'pointer';
      node.style.transition = 'background-color 0.2s ease, box-shadow 0.2s ease';
      node.style.borderRadius = '6px';

      if (isActive) {
        node.style.backgroundColor = 'rgba(224, 231, 255, 0.85)';
        node.style.boxShadow = 'inset 0 0 0 2px rgba(79, 70, 229, 0.85), 0 0 0 3px rgba(165, 180, 252, 0.45)';
        return;
      }

      if (hasFilled && !hasPending) {
        node.style.backgroundColor = 'rgba(220, 252, 231, 0.75)';
        node.style.boxShadow = 'inset 0 0 0 1px rgba(34, 197, 94, 0.55)';
        return;
      }

      node.style.backgroundColor = 'rgba(254, 240, 138, 0.55)';
      node.style.boxShadow = 'inset 0 0 0 1px rgba(245, 158, 11, 0.55)';
    });
  }, [highlightBlankId, manualEdits, scannedBlanks]);

  const resolvePreviewBlankId = useCallback((anchor) => {
    if (!anchor) return '';

    const blankIds = (anchor.getAttribute('data-preview-blank-ids') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (blankIds.length === 0) return '';
    if (highlightBlankId && blankIds.includes(highlightBlankId)) return highlightBlankId;

    const primaryBlankId = anchor.getAttribute('data-preview-primary-blank-id');
    if (primaryBlankId && blankIds.includes(primaryBlankId)) return primaryBlankId;

    return blankIds.find((id) => scannedBlanks.some((blank) => blank.id === id)) || blankIds[0];
  }, [highlightBlankId, scannedBlanks]);

  const findPreviewAnchor = useCallback((blank) => {
    const container = previewRef.current;
    if (!container || !blank) return null;

    const exactAnchor = container.querySelector(`[data-preview-blank-ids~="${blank.id}"]`) ||
      Array.from(container.querySelectorAll('[data-preview-blank-ids]')).find((node) => {
        const ids = (node.getAttribute('data-preview-blank-ids') || '').split(',').map((item) => item.trim());
        return ids.includes(blank.id);
      });
    if (exactAnchor) return exactAnchor;

    const locatorText = getPreviewLocatorText(blank);
    if (!locatorText) return null;

    const candidates = Array.from(
      container.querySelectorAll('p, td, th, span, div, li')
    );

    return candidates.find((node) => {
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      return text && text.includes(locatorText) && text.length <= 300;
    }) || null;
  }, [getPreviewLocatorText]);

  const scrollToTable = useCallback((blankId) => {
    setHighlightBlankId(blankId);
    setTimeout(() => {
      const el = document.querySelector(`[data-row-key="${blankId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400');
        const input = el.querySelector('input');
        if (input) input.focus({ preventScroll: true });
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 2000);
      }
    }, 100);
  }, []);

  const decoratePreviewAnchors = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    clearPreviewAnchors();
    if (scannedBlanks.length === 0) return;

    const candidates = collectPreviewCandidates(container);
    const assignedOccurrenceCounts = new Map();

    scannedBlanks.forEach((blank) => {
      const tokens = getPreviewAnchorTokens(blank);
      if (tokens.length === 0) return;

      const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
      const primaryToken = normalizePreviewText(sortedTokens[0]);
      const blankKey = normalizePreviewText(getBlankDisplayName(blank) || primaryToken);
      const blankOccurrence = assignedOccurrenceCounts.get(blankKey) || 0;

      const matchedCandidates = [];

      tokens.forEach((token, tokenIndex) => {
        candidates.forEach(({ node, text, index }) => {
          if (!text.includes(token)) return;

          matchedCandidates.push({
            node,
            text,
            index,
            token,
            score: token.length * 100 - text.length - tokenIndex * 10
          });
        });
      });

      const exactPrimaryCandidates = matchedCandidates
        .filter(({ text }) => text === primaryToken)
        .sort((a, b) => b.score - a.score || a.index - b.index);

      let bestNode = exactPrimaryCandidates[blankOccurrence]?.node || null;

      if (!bestNode) {
        const rankedCandidates = matchedCandidates.sort((a, b) => b.score - a.score || a.index - b.index);
        bestNode = rankedCandidates.find(({ node }) => !node.hasAttribute('data-preview-blank-ids'))?.node
          || rankedCandidates[0]?.node
          || null;
      }

      if (!bestNode) return;
      assignedOccurrenceCounts.set(blankKey, blankOccurrence + 1);

      const existingIds = (bestNode.getAttribute('data-preview-blank-ids') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (!existingIds.includes(blank.id)) {
        existingIds.push(blank.id);
      }

      bestNode.setAttribute('data-preview-blank-ids', existingIds.join(','));
      if (!bestNode.getAttribute('data-preview-primary-blank-id')) {
        bestNode.setAttribute('data-preview-primary-blank-id', blank.id);
      }
      const titleText = existingIds
        .map((id) => scannedBlanks.find((item) => item.id === id))
        .filter(Boolean)
        .map((item) => getBlankDisplayName(item))
        .filter(Boolean)
        .join('\n');
      bestNode.setAttribute('title', titleText || getBlankDisplayName(blank));
      bestNode.setAttribute('tabindex', '0');
      bestNode.setAttribute('role', 'button');
      bestNode.classList.add('preview-blank-anchor');
      bestNode.style.cursor = 'pointer';
      bestNode.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const targetBlankId = resolvePreviewBlankId(bestNode);
        if (targetBlankId) {
          scrollToTable(targetBlankId);
        }
      };
      bestNode.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        const targetBlankId = resolvePreviewBlankId(bestNode);
        if (targetBlankId) {
          scrollToTable(targetBlankId);
        }
      };
    });
    applyPreviewAnchorStyles();
  }, [applyPreviewAnchorStyles, clearPreviewAnchors, collectPreviewCandidates, getBlankDisplayName, getPreviewAnchorTokens, normalizePreviewText, resolvePreviewBlankId, scannedBlanks, scrollToTable]);

  const scrollToBlank = useCallback((blankId) => {
    setHighlightBlankId(blankId);
    setTimeout(() => {
      const blank = scannedBlanks.find((item) => item.id === blankId);
      const el = findPreviewAnchor(blank);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-50'), 2000);
      }
    }, 100);
  }, [findPreviewAnchor, scannedBlanks]);

  const handlePreviewResizeStart = useCallback((event) => {
    if (!isDesktopViewport) return;

    previewResizeStateRef.current = {
      startX: event.clientX,
      startWidth: previewPanelWidth
    };
    setIsResizingPreview(true);
  }, [isDesktopViewport, previewPanelWidth]);

  // 窗口大小调整监听
  useEffect(() => {
    const handleWindowResize = () => {
      const viewportWidth = window.innerWidth;
      setIsDesktopViewport(viewportWidth >= DESKTOP_BREAKPOINT);
      setPreviewPanelWidth((currentWidth) => clampPreviewPanelWidth(currentWidth, viewportWidth));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [clampPreviewPanelWidth]);

  // 预览面板拖拽调整大小
  useEffect(() => {
    if (!isResizingPreview) return undefined;

    const handleMouseMove = (event) => {
      const { startX, startWidth } = previewResizeStateRef.current;
      const deltaX = event.clientX - startX;
      setPreviewPanelWidth(clampPreviewPanelWidth(startWidth + deltaX));
    };

    const stopResize = () => {
      setIsResizingPreview(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [clampPreviewPanelWidth, isResizingPreview]);

  // 预览渲染
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return undefined;

    if (!originalFile || (step !== 'scan' && step !== 'review')) {
      container.innerHTML = '';
      setPreviewError('');
      setIsRenderingPreview(false);
      return undefined;
    }

    let cancelled = false;

    const renderPreview = async () => {
      setIsRenderingPreview(true);
      setPreviewError('');

      try {
        const arrayBuffer = await originalFile.arrayBuffer();
        if (cancelled) return;

        container.innerHTML = '';
        await renderAsync(arrayBuffer, container, null, {
          className: 'docx-preview-render',
          ignoreWidth: false,
          ignoreHeight: true,
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true
        });
      } catch (error) {
        if (!cancelled) {
          console.error('原文预览渲染失败:', error);
          setPreviewError('原文预览渲染失败，请重新上传后重试');
        }
      } finally {
        if (!cancelled) {
          setIsRenderingPreview(false);
        }
      }
    };

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [originalFile, step]);

  // 装饰预览锚点
  useEffect(() => {
    if (!previewRef.current || isRenderingPreview) return;
    decoratePreviewAnchors();
  }, [decoratePreviewAnchors, isRenderingPreview]);

  // 应用预览锚点样式
  useEffect(() => {
    applyPreviewAnchorStyles();
  }, [applyPreviewAnchorStyles]);

  return {
    highlightBlankId,
    setHighlightBlankId,
    previewRef,
    previewScrollRef,
    isRenderingPreview,
    previewError,
    isDesktopViewport,
    isResizingPreview,
    previewPanelWidth,
    scrollToBlank,
    handlePreviewResizeStart,
  };
};
