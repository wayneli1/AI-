import os
import requests
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ==================== 请求/响应模型 ====================

class PersonnelField(BaseModel):
    """人员库字段定义"""
    fieldName: str  # 字段名称，如 "name"
    fieldLabel: str  # 字段标签，如 "姓名"
    fieldType: str  # 字段类型: "string", "date", "array", "nested"
    fieldPath: str  # 字段路径，如 "name" 或 "custom_fields.job_positions[].project_experiences[]"
    description: Optional[str] = None  # 字段描述


class BlankCellInfo(BaseModel):
    """空白单元格信息"""
    row: int
    col: int
    label: Optional[str] = None  # 后端识别的语义标签
    headerText: Optional[str] = None  # 列标题
    rowHeader: Optional[str] = None  # 行标题
    text: str  # 单元格原始文本


class TableMappingRequest(BaseModel):
    """智能映射请求"""
    tableId: int
    tableType: str  # 表格类型标签
    anchorContext: str  # 表格上下文
    headers: List[str]  # 表头
    blankCells: List[BlankCellInfo]  # 空白单元格列表
    personnelFields: List[PersonnelField]  # 人员库字段定义


class CellMapping(BaseModel):
    """单元格映射结果"""
    row: int
    col: int
    label: Optional[str] = None
    mappedField: Optional[str] = None  # 映射到的字段名
    mappedFieldPath: Optional[str] = None  # 字段路径
    confidence: str  # "high", "medium", "low"
    reasoning: Optional[str] = None  # AI推理说明


class TableMappingResponse(BaseModel):
    """智能映射响应"""
    tableId: int
    mappings: List[CellMapping]
    success: bool
    message: Optional[str] = None


# ==================== Dify API 调用 ====================

def call_dify_workflow(
    table_data: Dict[str, Any],
    personnel_schema: List[Dict[str, Any]],
    dify_api_key: str,
    dify_base_url: str = "http://192.168.169.107/v1"
) -> Dict[str, Any]:
    """
    调用 Dify 工作流进行智能字段映射
    
    Args:
        table_data: 表格数据（包含空白单元格、表头、上下文等）
        personnel_schema: 人员库字段定义
        dify_api_key: Dify API Key
        dify_base_url: Dify API 基础URL
    
    Returns:
        Dify 工作流返回的映射结果
    """
    url = f"{dify_base_url}/workflows/run"
    
    headers = {
        "Authorization": f"Bearer {dify_api_key}",
        "Content-Type": "application/json"
    }
    
    # 构建 Dify 工作流输入
    payload = {
        "inputs": {
            "table_context": table_data.get("anchorContext", ""),
            "table_type": table_data.get("tableType", ""),
            "table_headers": table_data.get("headers", []),
            "blank_cells": table_data.get("blankCells", []),
            "personnel_fields": personnel_schema
        },
        "response_mode": "blocking",  # 同步模式
        "user": "system"
    }
    
    print(f"\n{'='*60}")
    print(f"🤖 [Dify] 调用智能映射工作流")
    print(f"🤖 [Dify] 表格ID: {table_data.get('tableId')}")
    print(f"🤖 [Dify] 空白单元格数: {len(table_data.get('blankCells', []))}")
    print(f"🤖 [Dify] 人员字段数: {len(personnel_schema)}")
    print(f"{'='*60}")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        print(f"✅ [Dify] 工作流执行成功")
        print(f"✅ [Dify] 返回数据: {result.get('data', {}).get('outputs', {})}")
        
        return result.get("data", {}).get("outputs", {})
    
    except requests.exceptions.RequestException as e:
        print(f"❌ [Dify] 工作流调用失败: {e}")
        raise HTTPException(status_code=500, detail=f"Dify API 调用失败: {str(e)}")


# ==================== API 端点 ====================

@router.post("/intelligent-field-mapping", response_model=TableMappingResponse)
async def intelligent_field_mapping(request: TableMappingRequest):
    """
    智能字段映射接口
    
    接收表格结构和人员库字段定义，调用 Dify 工作流进行 AI 推理，
    返回每个空白单元格应该映射到哪个人员库字段。
    """
    print(f"\n{'='*60}")
    print(f"🧠 [智能映射] 收到映射请求")
    print(f"🧠 [智能映射] 表格ID: {request.tableId}")
    print(f"🧠 [智能映射] 表格类型: {request.tableType}")
    print(f"🧠 [智能映射] 空白单元格数: {len(request.blankCells)}")
    print(f"🧠 [智能映射] 人员字段数: {len(request.personnelFields)}")
    print(f"{'='*60}")
    
    # 检查是否启用智能映射
    enable_intelligent_mapping = os.getenv("ENABLE_INTELLIGENT_MAPPING", "false").lower() == "true"
    
    if not enable_intelligent_mapping:
        print(f"⚠️ [智能映射] 智能映射已禁用，返回空映射结果（前端将使用本地规则映射）")
        return TableMappingResponse(
            tableId=request.tableId,
            mappings=[],
            success=True,
            message="智能映射已禁用，请在 .env 中设置 ENABLE_INTELLIGENT_MAPPING=true 启用"
        )
    
    # 从环境变量获取 Dify 配置
    dify_api_key = os.getenv("DIFY_FIELD_MAPPING_API_KEY", "app-placeholder")
    dify_base_url = os.getenv("DIFY_BASE_URL", "http://192.168.169.107/v1")
    
    # 准备表格数据
    table_data = {
        "tableId": request.tableId,
        "tableType": request.tableType,
        "anchorContext": request.anchorContext,
        "headers": request.headers,
        "blankCells": [cell.dict() for cell in request.blankCells]
    }
    
    # 准备人员库字段定义
    personnel_schema = [field.dict() for field in request.personnelFields]
    
    try:
        # 调用 Dify 工作流
        dify_result = call_dify_workflow(
            table_data=table_data,
            personnel_schema=personnel_schema,
            dify_api_key=dify_api_key,
            dify_base_url=dify_base_url
        )
        
        # 解析 Dify 返回的映射结果
        mappings_data = dify_result.get("mappings", [])
        
        mappings = []
        for mapping in mappings_data:
            mappings.append(CellMapping(
                row=mapping.get("row"),
                col=mapping.get("col"),
                label=mapping.get("label"),
                mappedField=mapping.get("mappedField"),
                mappedFieldPath=mapping.get("mappedFieldPath"),
                confidence=mapping.get("confidence", "medium"),
                reasoning=mapping.get("reasoning")
            ))
        
        print(f"\n{'='*60}")
        print(f"✅ [智能映射] 映射完成")
        print(f"✅ [智能映射] 成功映射 {len(mappings)} 个单元格")
        print(f"{'='*60}\n")
        
        return TableMappingResponse(
            tableId=request.tableId,
            mappings=mappings,
            success=True,
            message=f"成功映射 {len(mappings)} 个空白单元格"
        )
    
    except Exception as e:
        print(f"❌ [智能映射] 映射失败: {e}")
        raise HTTPException(status_code=500, detail=f"智能映射失败: {str(e)}")


@router.post("/batch-intelligent-mapping")
async def batch_intelligent_mapping(requests: List[TableMappingRequest]):
    """
    批量智能映射接口
    
    一次性处理多个表格的字段映射
    """
    results = []
    
    for req in requests:
        try:
            result = await intelligent_field_mapping(req)
            results.append(result)
        except Exception as e:
            results.append(TableMappingResponse(
                tableId=req.tableId,
                mappings=[],
                success=False,
                message=str(e)
            ))
    
    return {
        "success": True,
        "total": len(requests),
        "results": results
    }
