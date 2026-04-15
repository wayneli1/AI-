from typing import List, Dict, Any, Tuple, Optional
from docx.table import Table
from docx.document import Document
from docx.oxml.ns import qn


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
    if not table.rows:
        return []
    first_row = table.rows[0]
    headers = []
    for cell in first_row.cells:
        text = get_cell_text(cell)
        col_span = get_cell_col_span(cell)
        headers.append(text)
        for _ in range(col_span - 1):
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
    cells = []
    headers = extract_table_headers(table)
    row_headers = extract_row_headers(table)
    
    for row_idx, row in enumerate(table.rows):
        col_idx = 0
        for cell in row.cells:
            if is_cell_merged_continuation(cell):
                col_idx += get_cell_col_span(cell)
                continue
            
            cell_text = get_cell_text(cell)
            col_span = get_cell_col_span(cell)
            row_span = get_cell_row_span(cell)
            
            header_text = ""
            if col_idx < len(headers):
                header_text = headers[col_idx]
            
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


def find_blank_cells(cells: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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
            
            label = ""
            if header_text and row_header and header_text != row_header:
                label = f"{header_text}（项：{row_header}）"
            elif header_text:
                label = header_text
            elif row_header:
                label = row_header
            
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


def get_anchor_context(doc: Document, table: Table) -> str:
    try:
        table_element = table._element
        body = doc._element.body
        
        prev_element = table_element.getprevious()
        while prev_element is not None:
            tag = prev_element.tag.split("}")[-1]
            if tag == "p":
                for para in doc.paragraphs:
                    if para._element == prev_element:
                        text = para.text.strip()
                        if text:
                            return text
            prev_element = prev_element.getprevious()
        
        return ""
    except Exception:
        return ""


import re


def parse_table(table: Table, table_index: int, doc: Document) -> Dict[str, Any]:
    headers = extract_table_headers(table)
    cells = parse_table_cells(table, table_index)
    blank_cells = find_blank_cells(cells)
    anchor_context = get_anchor_context(doc, table)
    
    return {
        "tableId": table_index,
        "rowCount": len(table.rows),
        "colCount": len(table.columns) if table.columns else 0,
        "headers": [h for h in headers if h],
        "cells": cells,
        "blankCells": blank_cells,
        "anchorContext": anchor_context,
    }
