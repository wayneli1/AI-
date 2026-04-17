from pydantic import BaseModel
from typing import List, Optional, Any


class NormalBlank(BaseModel):
    id: str
    paraIndex: int
    context: str
    markedContext: str
    matchText: str
    type: str
    confidence: str
    index: int
    fill_role: str
    source: str
    blankOrdinalInParagraph: Optional[int] = None
    inferredFromNextParagraph: Optional[bool] = None


class TableCell(BaseModel):
    tableIndex: int
    row: int
    col: int
    text: str
    colSpan: int
    rowSpan: int
    isHeader: bool
    headerText: str
    rowHeader: str


class BlankCell(BaseModel):
    tableIndex: int
    row: int
    col: int
    headerText: str
    rowHeader: str
    label: str


class DynamicTable(BaseModel):
    tableId: int
    type: str
    anchorContext: str
    headers: List[str]
    rowCount: int
    blankCells: Optional[List[BlankCell]] = None
    fillMode: Optional[str] = "multi_person"  # "multi_person" 或 "single_person_detail"
    emptyRowCount: Optional[int] = 0  # 空白行数量


class ManualTable(BaseModel):
    tableId: int
    type: str
    anchorContext: str
    headers: List[str]


class TableStructure(BaseModel):
    tableId: int
    rowCount: int
    colCount: int
    headers: List[str]
    cells: List[TableCell]
    blankCells: List[BlankCell]
    anchorContext: str


class ParseResponse(BaseModel):
    success: bool
    normalBlanks: List[NormalBlank]
    dynamicTables: List[DynamicTable]
    manualTables: List[ManualTable]
    tableStructures: Optional[List[TableStructure]] = None
    meta: Optional[dict] = None
