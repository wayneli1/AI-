"""
文本替换工具模块
提供保留格式的段落文本替换功能，支持跨run的文本替换
"""


def replace_text_preserve_format(paragraph, old_text, new_text):
    """
    在段落中替换文本，保留所有格式（加粗、下划线、字体等）
    支持处理跨run的情况
    
    Args:
        paragraph: python-docx Paragraph 对象
        old_text: 要替换的原始文本
        new_text: 替换后的新文本
        
    Returns:
        bool: 是否成功替换
    """
    if not old_text:
        # 如果 old_text 为空，说明是插入操作（如冒号后直接插入）
        if paragraph.runs:
            # 在第一个 run 的末尾插入
            paragraph.runs[0].text = paragraph.runs[0].text + new_text
            return True
        else:
            # 段落没有 run，创建一个新的
            paragraph.add_run(new_text)
            return True
    
    # 获取段落的完整文本
    full_text = paragraph.text
    
    # 检查是否包含要替换的文本
    if old_text not in full_text:
        return False
    
    # 找到替换位置
    start_idx = full_text.index(old_text)
    end_idx = start_idx + len(old_text)
    
    # 遍历 runs，找到覆盖范围
    current_pos = 0
    runs_to_modify = []
    
    for run in paragraph.runs:
        run_len = len(run.text)
        run_start = current_pos
        run_end = current_pos + run_len
        
        # 判断 run 是否与替换范围重叠
        if run_end > start_idx and run_start < end_idx:
            # 计算在当前 run 内的重叠范围
            overlap_start = max(0, start_idx - run_start)
            overlap_end = min(run_len, end_idx - run_start)
            runs_to_modify.append((run, overlap_start, overlap_end, run_start))
        
        current_pos += run_len
    
    # 执行替换
    if runs_to_modify:
        # 在第一个 run 中插入新文本
        first_run, first_start, first_end, _ = runs_to_modify[0]
        first_run.text = (
            first_run.text[:first_start] + 
            new_text + 
            first_run.text[first_end:]
        )
        
        # 清空其他 run 的重叠部分
        for run, start, end, _ in runs_to_modify[1:]:
            run.text = run.text[:start] + run.text[end:]
        
        return True
    
    return False


def replace_text_fuzzy(paragraph, old_text, new_text):
    """
    模糊替换：尝试多种策略定位并替换文本
    
    策略优先级：
    1. 精确匹配
    2. 去除空格后匹配
    3. 下划线/横线模糊匹配
    
    Args:
        paragraph: python-docx Paragraph 对象
        old_text: 要替换的原始文本
        new_text: 替换后的新文本
        
    Returns:
        bool: 是否成功替换
    """
    # 策略1: 精确匹配
    if replace_text_preserve_format(paragraph, old_text, new_text):
        return True
    
    # 策略2: 去除空格后匹配
    full_text = paragraph.text
    normalized_old = old_text.replace(' ', '').replace('\t', '').replace('\n', '')
    normalized_full = full_text.replace(' ', '').replace('\t', '').replace('\n', '')
    
    if normalized_old in normalized_full:
        # 找到归一化后的位置，映射回原始文本
        norm_idx = normalized_full.index(normalized_old)
        
        # 映射回原始索引
        original_idx = 0
        norm_count = 0
        for i, char in enumerate(full_text):
            if char not in (' ', '\t', '\n'):
                if norm_count == norm_idx:
                    original_idx = i
                    break
                norm_count += 1
        
        # 计算原始文本中对应的长度
        original_end = original_idx
        norm_matched = 0
        for i in range(original_idx, len(full_text)):
            if full_text[i] not in (' ', '\t', '\n'):
                norm_matched += 1
                if norm_matched == len(normalized_old):
                    original_end = i + 1
                    break
        
        # 提取原始匹配文本并替换
        actual_old_text = full_text[original_idx:original_end]
        if replace_text_preserve_format(paragraph, actual_old_text, new_text):
            return True
    
    # 策略3: 下划线/横线模糊匹配
    import re
    if re.match(r'^_{2,}$', old_text):
        # 匹配任意长度的下划线
        pattern = r'_{2,}'
        match = re.search(pattern, full_text)
        if match:
            matched_text = match.group()
            return replace_text_preserve_format(paragraph, matched_text, new_text)
    
    if re.match(r'^-{3,}$', old_text):
        # 匹配任意长度的横线
        pattern = r'-{3,}'
        match = re.search(pattern, full_text)
        if match:
            matched_text = match.group()
            return replace_text_preserve_format(paragraph, matched_text, new_text)
    
    return False
