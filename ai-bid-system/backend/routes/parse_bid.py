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
    print(f"\n{'='*60}")
    print(f"📥 [后端] 收到解析请求")
    print(f"📥 [后端] 文件名: {file.filename}")
    print(f"{'='*60}")

    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="仅支持 .docx 格式文件")

    try:
        contents = await file.read()
        print(f"📥 [后端] 文件大小: {len(contents)} bytes")
        doc = Document(BytesIO(contents))
    except Exception as e:
        print(f"❌ [后端] 文件解析失败: {e}")
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    paragraphs = list(doc.paragraphs)
    print(f"📄 [后端] 段落数: {len(paragraphs)}, 表格数: {len(doc.tables)}")

    normal_blanks_raw = scan_normal_blanks(paragraphs)
    normal_blanks = [NormalBlank(**b) for b in normal_blanks_raw]
    print(f"📊 [后端] 空白扫描完成: {len(normal_blanks)} 个普通填空")

    table_structures = []
    dynamic_tables = []
    manual_tables = []

    for idx, table in enumerate(doc.tables):
        table_info = parse_table(table, idx, doc)
        
        headers = table_info["headers"]
        anchor = table_info["anchorContext"]
        table_type = classify_table(anchor, headers)
        type_label = get_table_type_label(anchor, headers)
        print(f"📊 [后端] 表格 {idx}: type={table_type}, label={type_label}, rows={table_info['rowCount']}, anchor=\"{anchor[:40]}\"")
        print(f"📊 [后端] 表格 {idx} headers: {headers}")
        print(f"📊 [后端] 表格 {idx} blankCells: {len(table_info['blankCells'])}")

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
                fillMode=table_info.get("fillMode", "multi_person"),  # 🆕 填充模式
                emptyRowCount=table_info.get("emptyRowCount", 0),  # 🆕 空白行数
            ))
            print(f"   🔧 [后端] 表格 {idx} fillMode={table_info.get('fillMode')}, emptyRows={table_info.get('emptyRowCount')}")
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

    print(f"\n{'='*60}")
    print(f"✅ [后端] 解析完成!")
    print(f"   普通填空: {meta['totalNormalBlanks']}")
    print(f"   动态表格: {meta['totalDynamicTables']}")
    print(f"   高危表格: {meta['totalManualTables']}")
    print(f"{'='*60}\n")

    return ParseResponse(
        success=True,
        normalBlanks=normal_blanks,
        dynamicTables=dynamic_tables,
        manualTables=manual_tables,
        tableStructures=table_structures,
        meta=meta,
    )
