from pydantic import BaseModel
from typing import List, Optional


class FillBlankItem(BaseModel):
    """单个填空项"""
    paraIndex: int
    originalText: str  # 原始占位符文本，用于验证定位
    filledText: str    # 填充的内容
    blankType: Optional[str] = None  # 填空类型：underscore/dash/keyword_space等


class FillBlanksRequest(BaseModel):
    """填充文档请求体"""
    normal_blanks: List[FillBlankItem]
    dynamic_tables: Optional[List[dict]] = []
    mapping: Optional[dict] = {}
