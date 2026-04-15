from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from docx import Document
from io import BytesIO

from schemas.response import (
    NormalBlank, DynamicTable, ManualTable, BlankCell, TableStructure, ParseResponse
)
from services.blank_scanner import scan_normal_blanks
from services.table_parser import parse_table, extract_table_headers
from services.table_classifier import classify_table, get_table_type_label

router = APIRouter()


@router.post("/parse-bid-docx", response_model=ParseResponse)
async def parse_bid_docx(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="仅支持 .docx 格式文件")

    try:
        contents = await file.read()
        doc = Document(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    paragraphs = list(doc.paragraphs)

    normal_blanks_raw = scan_normal_blanks(paragraphs)
    normal_blanks = [NormalBlank(**b) for b in normal_blanks_raw]

    table_structures = []
    dynamic_tables = []
    manual_tables = []

    for idx, table in enumerate(doc.tables):
        table_info = parse_table(table, idx, doc)
        
        headers = table_info["headers"]
        anchor = table_info["anchorContext"]
        table_type = classify_table(anchor, headers)
        type_label = get_table_type_label(anchor, headers)

        table_structure = TableStructure(
            tableId=idx,
            rowCount=table_info["rowCount"],
            colCount=table_info["colCount"],
            headers=headers,
            cells=table_info["cells"],
            blankCells=[BlankCell(**bc) for bc in table_info["blankCells"]],
            anchorContext=anchor,
        )
        table_structures.append(table_structure)

        if table_type == "dynamic":
            dynamic_tables.append(DynamicTable(
                tableId=idx,
                type=type_label,
                anchorContext=anchor,
                headers=headers,
                rowCount=table_info["rowCount"],
                blankCells=[BlankCell(**bc) for bc in table_info["blankCells"]],
            ))
        else:
            manual_tables.append(ManualTable(
                tableId=idx,
                type=type_label,
                anchorContext=anchor,
                headers=headers,
            ))

    meta = {
        "fileName": file.filename,
        "totalParagraphs": len(paragraphs),
        "totalTables": len(doc.tables),
        "totalNormalBlanks": len(normal_blanks),
        "totalDynamicTables": len(dynamic_tables),
        "totalManualTables": len(manual_tables),
    }

    return ParseResponse(
        success=True,
        normalBlanks=normal_blanks,
        dynamicTables=dynamic_tables,
        manualTables=manual_tables,
        tableStructures=table_structures,
        meta=meta,
    )
