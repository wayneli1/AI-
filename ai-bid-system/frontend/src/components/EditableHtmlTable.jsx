import React, { useState, useRef, useEffect } from 'react';
import './EditableHtmlTable.css';

/**
 * 可编辑的HTML表格组件
 * 
 * 功能：
 * 1. 解析HTML字符串为可编辑的表格
 * 2. 支持单元格点击编辑（contentEditable）
 * 3. 处理colspan/rowspan复杂表格结构
 * 4. 编辑后回写HTML字符串
 * 5. 支持通过headerRows控制表头行数（默认0，所有行可编辑）
 */

const EditableHtmlTable = ({ htmlString, onHtmlChange, tableId, headerRows = 0 }) => {
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, cellIndex }
  const [tableData, setTableData] = useState(null);
  const editableRef = useRef(null);

  // 解析HTML表格为数据结构
  useEffect(() => {
    if (!htmlString) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const table = doc.querySelector('table');
      
      if (!table) {
        console.error('未找到table元素');
        return;
      }

      // 提取表格数据
      const rows = Array.from(table.querySelectorAll('tr'));
      const parsedData = {
        tableElement: table.cloneNode(true), // 保存完整的table元素（包含样式）
        rows: rows.map((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          return {
            isHeader: rowIndex < headerRows, // 前headerRows行为表头
            cells: cells.map(cell => ({
              content: cell.textContent.trim(),
              tagName: cell.tagName.toLowerCase(),
              colspan: parseInt(cell.getAttribute('colspan') || '1'),
              rowspan: parseInt(cell.getAttribute('rowspan') || '1'),
              className: cell.className,
              style: cell.getAttribute('style') || '',
              element: cell.cloneNode(true) // 保存原始元素
            }))
          };
        })
      };

      setTableData(parsedData);
    } catch (error) {
      console.error('解析HTML表格失败:', error);
    }
  }, [htmlString]);

  // 将编辑后的数据转回HTML
  const serializeToHtml = (data) => {
    if (!data || !data.tableElement) return htmlString;

    const table = data.tableElement.cloneNode(false); // 只克隆table标签（保留属性）
    const tbody = document.createElement('tbody');

    data.rows.forEach((row) => {
      const tr = document.createElement('tr');
      
      row.cells.forEach((cell) => {
        const cellElement = document.createElement(cell.tagName);
        cellElement.textContent = cell.content;
        
        if (cell.colspan > 1) cellElement.setAttribute('colspan', cell.colspan);
        if (cell.rowspan > 1) cellElement.setAttribute('rowspan', cell.rowspan);
        if (cell.className) cellElement.className = cell.className;
        if (cell.style) cellElement.setAttribute('style', cell.style);
        
        tr.appendChild(cellElement);
      });
      
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table.outerHTML;
  };

  // 处理单元格点击
  const handleCellClick = (rowIndex, cellIndex) => {
    // 表头不可编辑
    if (tableData.rows[rowIndex].isHeader) return;
    
    setEditingCell({ rowIndex, cellIndex });
  };

  // 处理单元格内容变化
  const handleCellBlur = (rowIndex, cellIndex, newContent) => {
    if (!tableData) return;

    const updatedData = {
      ...tableData,
      rows: tableData.rows.map((row, rIdx) => {
        if (rIdx !== rowIndex) return row;
        
        return {
          ...row,
          cells: row.cells.map((cell, cIdx) => {
            if (cIdx !== cellIndex) return cell;
            return { ...cell, content: newContent.trim() };
          })
        };
      })
    };

    setTableData(updatedData);
    setEditingCell(null);

    // 回调通知父组件
    const newHtml = serializeToHtml(updatedData);
    if (onHtmlChange) {
      onHtmlChange(newHtml);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e, rowIndex, cellIndex) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur(); // 触发保存
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null); // 取消编辑
    }
  };

  if (!tableData) {
    return <div>加载中...</div>;
  }

  return (
    <div className="editable-html-table-wrapper">
      <table className="editable-html-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {tableData.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => {
                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.cellIndex === cellIndex;
                const isHeader = row.isHeader;
                const CellTag = cell.tagName;

                return (
                  <CellTag
                    key={cellIndex}
                    colSpan={cell.colspan}
                    rowSpan={cell.rowspan}
                    className={`${cell.className} ${isHeader ? 'table-header' : 'table-cell'} ${isEditing ? 'editing' : ''}`}
                    style={{
                      border: '1px solid #d9d9d9',
                      padding: '8px',
                      cursor: isHeader ? 'default' : 'pointer',
                      backgroundColor: isHeader ? '#fafafa' : (isEditing ? '#e6f7ff' : 'white'),
                      position: 'relative',
                      ...parseStyleString(cell.style)
                    }}
                    onClick={() => !isHeader && handleCellClick(rowIndex, cellIndex)}
                  >
                    {isEditing ? (
                      <div
                        ref={editableRef}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleCellBlur(rowIndex, cellIndex, e.target.textContent)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, cellIndex)}
                        style={{
                          outline: 'none',
                          minHeight: '20px',
                          width: '100%'
                        }}
                        dangerouslySetInnerHTML={{ __html: cell.content }}
                        autoFocus
                      />
                    ) : (
                      <span>{cell.content}</span>
                    )}
                  </CellTag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
        提示：点击单元格可编辑，Enter保存，Esc取消
      </div>
    </div>
  );
};

// 辅助函数：解析style字符串为对象
const parseStyleString = (styleStr) => {
  if (!styleStr) return {};
  
  const styles = {};
  styleStr.split(';').forEach(rule => {
    const [key, value] = rule.split(':').map(s => s.trim());
    if (key && value) {
      // 转换CSS属性名为camelCase
      const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      styles[camelKey] = value;
    }
  });
  
  return styles;
};

export default EditableHtmlTable;
