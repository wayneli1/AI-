import os
import json
import re
import requests as http_requests
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from html.parser import HTMLParser

router = APIRouter()


class BlankCellInfo(BaseModel):
    row: int
    col: int
    label: Optional[str] = None
    headerText: Optional[str] = None
    rowHeader: Optional[str] = None
    text: str


class SmartFillRequest(BaseModel):
    tableId: int
    tableType: str
    anchorContext: str
    headers: List[str]
    blankCells: List[BlankCellInfo]
    personData: Dict[str, Any]
    positionName: str = ""
    tableHtml: str = ""  # 🆕 完整的表格HTML结构，供AI理解表格布局
    fillMode: str = "multi_person"  # 🆕 填充模式：multi_person 或 single_person_detail
    firstRowType: str = "field_row"  # 🆕 第一行类型：title_row (标题行) 或 field_row (字段行)


class CellFillResult(BaseModel):
    row: int
    col: int
    label: Optional[str] = None
    header: str = ""
    value: str = ""
    reasoning: Optional[str] = None


class SmartFillResponse(BaseModel):
    tableId: int
    personName: str
    filled_table_html: str  # 🆕 完整的填充后HTML表格
    success: bool
    message: Optional[str] = None


def sanitize_table_html(html: str) -> str:
    """
    清理Dify返回的HTML表格，移除重复的表头列
    
    Bug场景：Dify有时会生成重复的表头，例如：
    <tr><td>姓名</td><td>年龄</td><td>年龄</td><td>专业</td><td>专业</td></tr>
    
    修复策略：
    1. 解析第一行（表头行）
    2. 检测连续重复的单元格内容
    3. 移除重复列，保留第一次出现
    4. 对所有行应用相同的列删除操作
    """
    if not html or '<table' not in html.lower():
        return html
    
    try:
        # 简单的HTML表格解析
        rows = []
        current_row = []
        in_table = False
        in_row = False
        in_cell = False
        cell_content = []
        
        # 使用正则提取所有行
        table_match = re.search(r'<table[^>]*>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
        if not table_match:
            return html
        
        table_content = table_match.group(1)
        
        # 提取所有行
        row_pattern = r'<tr[^>]*>(.*?)</tr>'
        row_matches = re.findall(row_pattern, table_content, re.DOTALL | re.IGNORECASE)
        
        for row_html in row_matches:
            # 提取单元格
            cell_pattern = r'<td([^>]*)>(.*?)</td>'
            cells = []
            for cell_match in re.finditer(cell_pattern, row_html, re.DOTALL | re.IGNORECASE):
                attrs = cell_match.group(1)
                content = cell_match.group(2).strip()
                cells.append({'attrs': attrs, 'content': content})
            rows.append(cells)
        
        if not rows:
            return html
        
        # 检测第一行（表头）的重复列
        header_row = rows[0]
        columns_to_keep = []
        seen_contents = {}
        
        for col_idx, cell in enumerate(header_row):
            content = cell['content']
            
            # 如果这个内容之前没见过，或者是空白/特殊标记，保留
            if content not in seen_contents or content in ['[空白]', '', ' ']:
                columns_to_keep.append(col_idx)
                seen_contents[content] = col_idx
            else:
                # 重复的列，记录日志
                print(f"[HTML清理] 检测到重复表头列 #{col_idx}: '{content}' (首次出现在列 #{seen_contents[content]})")
        
        # 如果没有重复列，直接返回原HTML
        if len(columns_to_keep) == len(header_row):
            print(f"[HTML清理] 表头无重复，跳过清理")
            return html
        
        print(f"[HTML清理] 移除重复列: 原始 {len(header_row)} 列 -> 清理后 {len(columns_to_keep)} 列")
        
        # 重建表格HTML，只保留非重复列
        cleaned_rows = []
        for row in rows:
            cleaned_cells = []
            for col_idx in columns_to_keep:
                if col_idx < len(row):
                    cell = row[col_idx]
                    attrs_str = cell['attrs'] if cell['attrs'] else ''
                    if attrs_str:
                        attrs_str = ' ' + attrs_str
                    cleaned_cells.append(f'<td{attrs_str}>{cell["content"]}</td>')
            cleaned_rows.append(f'  <tr>\n    {chr(10).join(cleaned_cells)}\n  </tr>')
        
        cleaned_html = '<table border="1">\n' + '\n'.join(cleaned_rows) + '\n</table>'
        
        print(f"[HTML清理] 完成: {len(html)} -> {len(cleaned_html)} 字符")
        return cleaned_html
        
    except Exception as e:
        print(f"[HTML清理] 失败，返回原始HTML: {e}")
        return html


def call_dify_smart_fill(
    table_data: Dict[str, Any],
    person_data: Dict[str, Any],
    dify_api_key: str,
    dify_base_url: str
) -> Dict[str, Any]:
    url = f"{dify_base_url}/workflows/run"

    headers = {
        "Authorization": f"Bearer {dify_api_key}",
        "Content-Type": "application/json"
    }

    # 🆕 传递5个关键变量（新增 fill_mode 和 first_row_type）
    payload = {
        "inputs": {
            "table_html": table_data.get("tableHtml", ""),  # 原始表格HTML
            "personnel_data": json.dumps(person_data, ensure_ascii=False),  # 人员数据JSON
            "position_name": table_data.get("positionName", ""),  # 职位名称
            "fill_mode": table_data.get("fillMode", "multi_person"),  # 🆕 填充模式
            "first_row_type": table_data.get("firstRowType", "field_row"),  # 🆕 第一行类型
        },
        "response_mode": "blocking",
        "user": "system"
    }
    print(f"🤖 [Dify] 调用智能填充工作流")
    print(f"🤖 [Dify] 表格ID: {table_data.get('tableId')}")
    print(f"🤖 [Dify] 表格HTML长度: {len(table_data.get('tableHtml', ''))} 字符")
    print(f"🤖 [Dify] 职位: {table_data.get('positionName', '')}")
    print(f"🤖 [Dify] 填充模式: {table_data.get('fillMode', 'multi_person')}")
    print(f"🤖 [Dify] 第一行类型: {table_data.get('firstRowType', 'field_row')}")

    try:
        resp = http_requests.post(url, json=payload, headers=headers, timeout=180)
        resp.raise_for_status()
        result = resp.json()

        outputs = result.get("data", {}).get("outputs", {})
        filled_html = outputs.get("filled_table_html", "")  # 🆕 接收完整HTML

        print(f"✅ [Dify] 返回HTML长度: {len(filled_html)} 字符")
        print(f"✅ [Dify] HTML预览（前200字）: {filled_html[:200]}")

        return {
            "filled_table_html": filled_html,
            "success": True
        }

    except http_requests.exceptions.RequestException as e:
        print(f"❌ [Dify] 调用失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"❌ [Dify] 响应: {e.response.status_code} {e.response.text[:200]}")
        raise HTTPException(status_code=500, detail=f"Dify API调用失败: {str(e)}")


@router.post("/intelligent-field-mapping", response_model=SmartFillResponse)
async def intelligent_field_mapping(request: SmartFillRequest):
    """
    智能填充接口：接收表格结构 + 人员数据，返回每个空白单元格应填的值。
    """
    print(f"\n🧠 [智能填充] 表格ID={request.tableId}, 类型={request.tableType}, "
          f"空白={len(request.blankCells)}, 人员={request.personData.get('name', '?')}")

    enable = os.getenv("ENABLE_INTELLIGENT_MAPPING", "false").lower() == "true"
    if not enable:
        return SmartFillResponse(
            tableId=request.tableId,
            personName=request.personData.get("name", ""),
            filled_table_html="",  # 🆕 返回空HTML
            success=True,
            message="智能映射未启用"
        )

    dify_api_key = os.getenv("DIFY_FIELD_MAPPING_API_KEY", "")
    dify_base_url = os.getenv("DIFY_BASE_URL", "http://192.168.169.107/v1")

    if not dify_api_key or dify_api_key == "app-placeholder":
        raise HTTPException(status_code=500, detail="DIFY_FIELD_MAPPING_API_KEY 未配置")

    table_data = {
        "tableId": request.tableId,
        "tableType": request.tableType,
        "anchorContext": request.anchorContext,
        "headers": request.headers,
        "blankCells": [bc.dict() for bc in request.blankCells],
        "tableHtml": request.tableHtml,  # 🆕 传递完整的表格HTML
        "positionName": request.positionName,  # 🆕 传递职位名称
        "fillMode": request.fillMode,  # 🆕 传递填充模式
        "firstRowType": request.firstRowType,  # 🆕 传递第一行类型
    }
    
    # 🐛 修复：清理输入HTML中的重复列（在传给Dify之前）
    if table_data.get("tableHtml"):
        table_data["tableHtml"] = sanitize_table_html(table_data["tableHtml"])
        print(f"[智能填充] 输入HTML已清理重复列")

    # 把人员数据传给Dify，让AI根据实际数据精准填充
    person_data = request.personData

    try:
        dify_result = call_dify_smart_fill(table_data, person_data, dify_api_key, dify_base_url)

        filled_html = dify_result.get("filled_table_html", "")  # 🆕 接收完整HTML
        
        if not filled_html:
            raise HTTPException(status_code=500, detail="Dify返回的HTML为空")

        # 🐛 修复：清理Dify返回的HTML，移除重复表头列
        filled_html = sanitize_table_html(filled_html)

        print(f"✅ [智能填充] 完成: HTML长度={len(filled_html)}字符")
        return SmartFillResponse(
            tableId=request.tableId,
            personName=request.personData.get("name", ""),
            filled_table_html=filled_html,  # 🆕 返回清理后的HTML
            success=True,
            message=f"成功生成填充后的HTML表格"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [智能填充] 失败: {e}")
        raise HTTPException(status_code=500, detail=f"智能填充失败: {str(e)}")
