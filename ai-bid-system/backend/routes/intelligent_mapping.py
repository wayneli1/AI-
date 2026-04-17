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
    tableHtml: str = ""  # 🆕 完整的表格HTML结构，供AI理解表格布局


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

    # 🆕 简化输入：只传递3个关键变量
    payload = {
        "inputs": {
            "table_html": table_data.get("tableHtml", ""),  # 原始表格HTML
            "personnel_data": json.dumps(person_data, ensure_ascii=False),  # 人员数据JSON
            "position_name": table_data.get("positionName", ""),  # 职位名称
        },
        "response_mode": "blocking",
        "user": "system"
    }
    print(f"🤖 [Dify] 调用智能填充工作流")
    print(f"🤖 [Dify] 表格ID: {table_data.get('tableId')}")
    print(f"🤖 [Dify] 表格HTML长度: {len(table_data.get('tableHtml', ''))} 字符")
    print(f"🤖 [Dify] 职位: {table_data.get('positionName', '')}")

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
    }

    # 把人员数据传给Dify，让AI根据实际数据精准填充
    person_data = request.personData

    try:
        dify_result = call_dify_smart_fill(table_data, person_data, dify_api_key, dify_base_url)

        filled_html = dify_result.get("filled_table_html", "")  # 🆕 接收完整HTML
        
        if not filled_html:
            raise HTTPException(status_code=500, detail="Dify返回的HTML为空")

        print(f"✅ [智能填充] 完成: HTML长度={len(filled_html)}字符")
        return SmartFillResponse(
            tableId=request.tableId,
            personName=request.personData.get("name", ""),
            filled_table_html=filled_html,  # 🆕 返回HTML
            success=True,
            message=f"成功生成填充后的HTML表格"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [智能填充] 失败: {e}")
        raise HTTPException(status_code=500, detail=f"智能填充失败: {str(e)}")
