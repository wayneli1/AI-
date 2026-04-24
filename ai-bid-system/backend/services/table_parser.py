from typing import List, Dict, Any, Tuple, Optional
from docx.table import Table
from docx.document import Document
from docx.oxml.ns import qn
import re


def get_cell_col_span(cell) -> int:
    tc = cell._tc
    gridSpan = tc.find(qn("w:gridSpan"))
    if gridSpan is not None:
        return int(gridSpan.get(qn("w:val")))
    return 1


def get_cell_row_span(cell) -> int:
    tc = cell._tc
    vMerge = tc.find(qn("w:vMerge"))
    if vMerge is not None:
        val = vMerge.get(qn("w:val"))
        if val == "restart":
            return 1
        elif val == "continue":
            return 0
    return 1


def is_cell_merged_continuation(cell) -> bool:
    tc = cell._tc
    vMerge = tc.find(qn("w:vMerge"))
    if vMerge is not None:
        val = vMerge.get(qn("w:val"))
        return val == "continue"
    return False


def get_cell_text(cell) -> str:
    return cell.text.strip().replace("\n", " ").replace("\r", "")


def extract_table_headers(table: Table) -> List[str]:
    """
    改进的表头提取：支持多行表头和复杂合并单元格
    为每一列找到最合适的表头文本
    """
    if not table.rows:
        return []
    
    # 确定表格的实际列数
    max_cols = 0
    for row in table.rows:
        col_count = 0
        for cell in row.cells:
            if not is_cell_merged_continuation(cell):
                col_count += get_cell_col_span(cell)
        max_cols = max(max_cols, col_count)
    
    # 初始化每列的表头文本列表
    column_headers = [[] for _ in range(max_cols)]
    
    # 扫描前3行（通常表头不会超过3行）
    header_row_count = min(3, len(table.rows))
    
    for row_idx in range(header_row_count):
        row = table.rows[row_idx]
        col_idx = 0
        
        for cell in row.cells:
            if is_cell_merged_continuation(cell):
                col_idx += get_cell_col_span(cell)
                continue
            
            text = get_cell_text(cell)
            col_span = get_cell_col_span(cell)
            
            # 将文本添加到对应列的表头候选列表
            if text:  # 只添加非空文本
                for i in range(col_span):
                    if col_idx + i < max_cols:
                        column_headers[col_idx + i].append(text)
            
            col_idx += col_span
    
    # 为每列选择最合适的表头
    headers = []
    for col_idx, header_candidates in enumerate(column_headers):
        if header_candidates:
            # 优先使用最后一个非空表头（通常是最具体的）
            # 如果有多个不同的表头，用空格连接
            unique_headers = []
            for h in header_candidates:
                if h not in unique_headers:
                    unique_headers.append(h)
            
            # 如果只有一个表头，直接使用
            if len(unique_headers) == 1:
                headers.append(unique_headers[0])
            # 如果有多个不同的表头，使用最后一个（最具体的）
            else:
                headers.append(unique_headers[-1])
        else:
            headers.append("")
    
    return headers


def extract_row_headers(table: Table) -> List[str]:
    if not table.rows:
        return []
    row_headers = []
    for row in table.rows:
        if row.cells:
            row_headers.append(get_cell_text(row.cells[0]))
        else:
            row_headers.append("")
    return row_headers


def parse_table_cells(table: Table, table_index: int) -> List[Dict[str, Any]]:
    """
    改进的单元格解析：确保每个单元格都有正确的headerText
    """
    cells = []
    headers = extract_table_headers(table)
    row_headers = extract_row_headers(table)
    
    # 第一遍：收集所有单元格信息
    for row_idx, row in enumerate(table.rows):
        col_idx = 0
        for cell in row.cells:
            if is_cell_merged_continuation(cell):
                col_idx += get_cell_col_span(cell)
                continue
            
            cell_text = get_cell_text(cell)
            col_span = get_cell_col_span(cell)
            row_span = get_cell_row_span(cell)
            
            # 获取列表头
            header_text = ""
            if col_idx < len(headers):
                header_text = headers[col_idx]
            else:
                # 如果headers不够长，尝试从该列的前几行找到表头
                header_text = _find_column_header(table, col_idx)
            
            row_header = ""
            if row_idx < len(row_headers):
                row_header = row_headers[row_idx]
            
            cells.append({
                "tableIndex": table_index,
                "row": row_idx,
                "col": col_idx,
                "text": cell_text,
                "colSpan": col_span,
                "rowSpan": row_span,
                "isHeader": row_idx == 0,
                "headerText": header_text,
                "rowHeader": row_header,
            })
            col_idx += col_span
    
    return cells


def _find_column_header(table: Table, target_col: int) -> str:
    """
    为指定列查找表头文本
    扫描前3行，找到该列位置的第一个非空文本
    """
    header_row_count = min(3, len(table.rows))
    
    for row_idx in range(header_row_count):
        row = table.rows[row_idx]
        col_idx = 0
        
        for cell in row.cells:
            if is_cell_merged_continuation(cell):
                col_idx += get_cell_col_span(cell)
                continue
            
            col_span = get_cell_col_span(cell)
            
            # 检查该单元格是否覆盖目标列
            if col_idx <= target_col < col_idx + col_span:
                text = get_cell_text(cell)
                if text:
                    return text
            
            col_idx += col_span
    
    return ""


def find_blank_cells(cells: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    改进的空白单元格查找：生成更准确的label
    """
    blank_cells = []
    
    for cell in cells:
        if cell["isHeader"]:
            continue
        if cell["rowSpan"] == 0:
            continue
        
        text = cell["text"]
        if not text or re.match(r"^[\s\u3000_－-]+$", text):
            header_text = cell.get("headerText", "")
            row_header = cell.get("rowHeader", "")
            
            # 改进的label生成逻辑
            label = ""
            
            # 优先使用列表头
            if header_text and header_text.strip():
                label = header_text
                # 如果行表头也有值且不同，添加行表头作为补充信息
                if row_header and row_header.strip() and row_header != header_text:
                    # 避免重复信息（如果行表头已经包含在列表头中）
                    if row_header not in header_text:
                        label = f"{header_text}（{row_header}）"
            # 如果没有列表头，使用行表头
            elif row_header and row_header.strip():
                label = row_header
            # 如果都没有，使用列位置作为标识
            else:
                label = f"第{cell['col'] + 1}列"
            
            # 过滤掉纯数字的label（通常是序号列）
            if label and not re.match(r"^[0-9]+$", label):
                blank_cells.append({
                    "tableIndex": cell["tableIndex"],
                    "row": cell["row"],
                    "col": cell["col"],
                    "headerText": header_text,
                    "rowHeader": row_header,
                    "label": label,
                })
    
    return blank_cells


def generate_table_html(table: Table) -> str:
    """
    生成表格的HTML表示，包含完整的结构信息
    这样Dify可以看到完整的表格布局和内容
    
    🐛 修复：避免重复列（python-docx的row.cells会重复返回横向合并的单元格）
    """
    html_lines = ['<table border="1">']
    
    for row_idx, row in enumerate(table.rows):
        html_lines.append('  <tr>')
        
        # 🐛 修复：使用set跟踪已处理的单元格，避免重复
        processed_cells = set()
        
        for cell_idx, cell in enumerate(row.cells):
            # 使用单元格的内存地址作为唯一标识
            cell_id = id(cell._tc)
            
            # 跳过已处理的单元格（横向合并会导致重复）
            if cell_id in processed_cells:
                continue
            processed_cells.add(cell_id)
            
            # 跳过垂直合并的延续单元格
            if is_cell_merged_continuation(cell):
                continue
            
            text = get_cell_text(cell)
            # 空白单元格标记为[空白]，便于Dify识别
            display_text = text if text else "[空白]"
            
            col_span = get_cell_col_span(cell)
            row_span = get_cell_row_span(cell)
            
            # 构建td标签
            attrs = []
            if col_span > 1:
                attrs.append(f'colspan="{col_span}"')
            if row_span > 1:
                attrs.append(f'rowspan="{row_span}"')
            
            attrs_str = ' ' + ' '.join(attrs) if attrs else ''
            html_lines.append(f'    <td{attrs_str}>{display_text}</td>')
        
        html_lines.append('  </tr>')
    
    html_lines.append('</table>')
    return '\n'.join(html_lines)


def get_anchor_context(doc: Document, table: Table) -> str:
    """
    获取表格的锚点上下文：向上收集最多5个非空段落
    这样可以捕获距离表格稍远的标题（如"拟委任的本合同项目主要人员资历表"）
    """
    try:
        table_element = table._element
        body = doc._element.body
        
        contexts = []
        prev_element = table_element.getprevious()
        
        while prev_element is not None and len(contexts) < 5:
            tag = prev_element.tag.split("}")[-1]
            if tag == "p":
                for para in doc.paragraphs:
                    if para._element == prev_element:
                        text = para.text.strip()
                        if text:
                            contexts.append(text)
                        break
            elif tag == "tbl":
                # 遇到另一个表格，停止向上查找
                break
            prev_element = prev_element.getprevious()
        
        # 反转顺序（最远的在前，最近的在后）
        contexts.reverse()
        return " ".join(contexts) if contexts else ""
    except Exception:
        return ""


def count_empty_rows(table: Table) -> int:
    """
    统计表格中的空白行数量（跳过表头）
    空白行定义：所有单元格都为空或只包含空格/下划线/短横线
    """
    empty_count = 0
    for row_idx in range(1, len(table.rows)):  # 跳过表头（第0行）
        row = table.rows[row_idx]
        is_empty = True
        
        for cell in row.cells:
            text = get_cell_text(cell)
            # 如果单元格有实际内容（不是空白、下划线、短横线）
            if text and not re.match(r'^[\s\u3000_\-－]+$', text):
                is_empty = False
                break
        
        if is_empty:
            empty_count += 1
    
    return empty_count


def detect_first_row_type(table: Table) -> str:
    """
    检测第一行是标题行还是字段行
    返回: "title_row" (标题行，不需要填充) 或 "field_row" (字段行，需要填充)
    
    判断规则：
    1. 如果第一行包含多个常见字段名（姓名、年龄等），判定为字段行
    2. 如果第一行只有1个单元格且文本较长，判定为标题行
    3. 如果第一行跨列合并且文本较长，判定为标题行
    4. 默认判定为字段行
    """
    if not table.rows or len(table.rows) < 1:
        return "field_row"
    
    first_row = table.rows[0]
    first_row_texts = [get_cell_text(cell) for cell in first_row.cells]
    
    # 常见字段名关键词
    field_keywords = ['姓名', '年龄', '性别', '学历', '专业', '职务', '职称', 
                      '证书', '编号', '时间', '单位', '项目', '业绩', '经验',
                      '工作', '资格', '等级', '日期', '毕业', '院校']
    
    # 统计第一行包含字段关键词的单元格数量
    field_count = sum(1 for text in first_row_texts 
                     if any(kw in text for kw in field_keywords))
    
    # 如果第一行有多个字段关键词（>=2），判定为字段行
    if field_count >= 2:
        return "field_row"
    
    # 如果第一行只有1个单元格且文本较长（>10字符），判定为标题行
    non_empty_cells = [text for text in first_row_texts if text]
    if len(non_empty_cells) == 1 and len(non_empty_cells[0]) > 10:
        return "title_row"
    
    # 如果第一行第一个单元格跨列合并（colspan > 2）且文本较长（>8字符），判定为标题行
    if first_row.cells:
        first_cell = first_row.cells[0]
        col_span = get_cell_col_span(first_cell)
        first_text = get_cell_text(first_cell)
        if col_span > 2 and len(first_text) > 8:
            return "title_row"
    
    # 默认判定为字段行
    return "field_row"


def detect_table_fill_mode(table: Table, headers: List[str], anchor_context: str, empty_row_count: int = None) -> str:
    """
    检测表格填充模式
    返回: "multi_person" (汇总表) 或 "single_person_detail" (单人简历表)
    
    判断规则：
    1. 汇总表：空白行 >= 3 且表头不含"项目/业绩/经验/工作经历"
    2. 单人简历表：表头含"项目/业绩/经验/工作经历"
    
    empty_row_count: 优先使用从 blankCells 推导的空行数（更精确），
                     未传入时回退到 count_empty_rows（兼容旧调用方式）
    """
    # 统计空白行：优先使用外部传入的精确值
    if empty_row_count is None:
        empty_row_count = count_empty_rows(table)
    
    # 检查表头和锚点文本中的关键词
    combined_text = ' '.join(headers) + ' ' + anchor_context
    project_keywords = ['项目', '业绩', '经验', '工作经历', '项目经历', '主要业绩']
    has_project_keywords = any(kw in combined_text for kw in project_keywords)
    
    # 判断模式
    if empty_row_count >= 3 and not has_project_keywords:
        return "multi_person"  # 汇总表：多个空白行，无项目关键词
    else:
        return "single_person_detail"  # 单人简历表


def parse_table(table: Table, table_index: int, doc: Document) -> Dict[str, Any]:
    print(f"🔍 [DEBUG] 开始解析表格 {table_index}...")
    
    try:
        print(f"🔍 [DEBUG] 提取表头...")
        headers = extract_table_headers(table)
        print(f"✅ [DEBUG] 表头提取成功: {len(headers)} 列")
        
        print(f"🔍 [DEBUG] 解析单元格...")
        cells = parse_table_cells(table, table_index)
        print(f"✅ [DEBUG] 单元格解析成功: {len(cells)} 个")
        
        print(f"🔍 [DEBUG] 查找空白单元格...")
        blank_cells = find_blank_cells(cells)
        print(f"✅ [DEBUG] 空白单元格查找完成: {len(blank_cells)} 个")
        
        print(f"🔍 [DEBUG] 获取锚点上下文...")
        anchor_context = get_anchor_context(doc, table)
        print(f"✅ [DEBUG] 锚点上下文: {anchor_context[:50]}...")
        
        print(f"🔍 [DEBUG] 生成表格 HTML...")
        table_html = generate_table_html(table)
        print(f"✅ [DEBUG] HTML 生成成功: {len(table_html)} 字符")
        
        print(f"🔍 [DEBUG] 检测填充模式...")
        # 🐛 修复：从 blankCells 推导空行数，而非扫描全空行
        # 原因：表格内含标题行/小标题行/序号列时，count_empty_rows 会误判为 0
        empty_row_count = len(set(bc["row"] for bc in blank_cells))
        fill_mode = detect_table_fill_mode(table, headers, anchor_context, empty_row_count)
        print(f"✅ [DEBUG] 填充模式: {fill_mode}, 空白行: {empty_row_count}")
        
        print(f"🔍 [DEBUG] 检测第一行类型...")
        first_row_type = detect_first_row_type(table)
        print(f"✅ [DEBUG] 第一行类型: {first_row_type}")
        
    except Exception as e:
        print(f"❌ [DEBUG] 表格 {table_index} 解析过程出错: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    return {
        "tableId": table_index,
        "rowCount": len(table.rows),
        "colCount": len(headers),  # ✅ 修复：使用 headers 长度，避免 table.columns Bug
        "headers": [h for h in headers if h],
        "cells": cells,
        "blankCells": blank_cells,
        "anchorContext": anchor_context,
        "tableHtml": table_html,  # 新增：完整的表格HTML结构
        "fillMode": fill_mode,  # 🆕 填充模式
        "emptyRowCount": empty_row_count,  # 🆕 空白行数量
        "firstRowType": first_row_type,  # 🆕 第一行类型
    }
