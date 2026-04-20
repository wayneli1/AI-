import { useCallback } from 'react';

/**
 * 产品管理相关的Hook
 * 包含产品名称标准化、模糊匹配、占位符处理等逻辑
 */
export const useProductManagement = () => {
  // 标准化产品名称：处理中英文混合的空格问题
  const normalizeProductName = useCallback((name) => {
    if (!name || typeof name !== 'string') return '';
    // 1. 统一处理连字符前后的空格
    let normalized = name.replace(/\s*-\s*/g, '-');
    // 2. 移除所有空格
    normalized = normalized.replace(/\s+/g, '');
    // 3. 在英文单词和中文之间添加空格
    normalized = normalized.replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2');
    normalized = normalized.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2');
    // 4. 在英文单词和数字之间添加空格
    normalized = normalized.replace(/([a-zA-Z])(\d)/g, '$1 $2');
    normalized = normalized.replace(/(\d)([a-zA-Z])/g, '$1 $2');
    // 5. 移除多余空格，保留单词间单个空格
    return normalized.replace(/\s+/g, ' ').trim();
  }, []);

  // 模糊匹配占位符：标准化后进行比较
  const fuzzyMatchPlaceholder = useCallback((value, placeholder) => {
    if (!value || !placeholder) return false;
    const normalizedValue = normalizeProductName(value);
    const normalizedPlaceholder = normalizeProductName(placeholder);
    return normalizedValue.includes(normalizedPlaceholder);
  }, [normalizeProductName]);

  // 构建占位符正则表达式
  const buildPlaceholderRegex = useCallback((placeholder) => {
    // 转义特殊字符
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 将空格替换为 \\s*（允许0个或多个空格）
    const pattern = escaped.replace(/\\s+/g, '\\\\s*');
    return new RegExp(pattern, 'g');
  }, []);

  return {
    normalizeProductName,
    fuzzyMatchPlaceholder,
    buildPlaceholderRegex,
  };
};
