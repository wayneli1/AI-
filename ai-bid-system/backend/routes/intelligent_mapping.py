import os
import json
import requests as http_requests
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
    fills: List[CellFillResult]
    success: bool
    message: Optional[str] = None


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

    # 只发空白单元格的关键信息，减少数据量
    slim_blanks = []
    for bc in table_data.get("blankCells", []):
        slim_blanks.append({
            "row": bc.get("row"),
            "col": bc.get("col"),
            "label": bc.get("label", ""),
            "headerText": bc.get("headerText", ""),
            "rowHeader": bc.get("rowHeader", ""),
        })

    payload = {
    "inputs": {
        "table_context": table_data.get("anchorContext", ""),
        "table_html": table_data.get("tableHtml", ""),
        "blank_cells": json.dumps(slim_blanks, ensure_ascii=False),
        "personnel_fields": json.dumps(person_data, ensure_ascii=False),
    },
    "response_mode": "blocking",
    "user": "system"
}
    print(f"🤖 [Dify] 调用智能填充工作流")
    print(f"🤖 [Dify] 表格ID: {table_data.get('tableId')}, 空白数: {len(slim_blanks)}")
    print(f"🤖 [Dify] 表格HTML长度: {len(table_data.get('tableHtml', ''))} 字符")  # 新增日志

    try:
        resp = http_requests.post(url, json=payload, headers=headers, timeout=180)
        resp.raise_for_status()
        result = resp.json()

        outputs = result.get("data", {}).get("outputs", {})
        raw_text = outputs.get("mappings", "")

        print(f"✅ [Dify] 原始返回（前300字）: {raw_text[:300]}")

        # 清洗 markdown 代码块
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
            return parsed
        except json.JSONDecodeError as e:
            print(f"❌ [Dify] JSON解析失败: {e}, 原文: {cleaned[:500]}")
            raise HTTPException(status_code=500, detail=f"Dify返回的JSON格式错误: {str(e)}")

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
            fills=[],
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
    }

    # 把人员数据传给Dify，让AI根据实际数据精准填充
    person_data = request.personData

    try:
        dify_result = call_dify_smart_fill(table_data, person_data, dify_api_key, dify_base_url)

        fills_data = dify_result.get("fills", dify_result.get("mappings", []))
        fills = []
        for item in fills_data:
            fills.append(CellFillResult(
                row=item.get("row", 0),
                col=item.get("col", 0),
                label=item.get("label", ""),
                header=item.get("header", item.get("headerText", "")),
                value=str(item.get("value", "")),
                reasoning=item.get("reasoning"),
            ))

        print(f"✅ [智能填充] 完成: {len(fills)} 个单元格")
        return SmartFillResponse(
            tableId=request.tableId,
            personName=request.personData.get("name", ""),
            fills=fills,
            success=True,
            message=f"成功填充 {len(fills)} 个单元格"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [智能填充] 失败: {e}")
        raise HTTPException(status_code=500, detail=f"智能填充失败: {str(e)}")
