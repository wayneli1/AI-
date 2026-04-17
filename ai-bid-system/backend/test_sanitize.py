#!/usr/bin/env python3
"""
测试HTML表格去重功能
"""

import sys
sys.path.insert(0, '.')

from routes.intelligent_mapping import sanitize_table_html


def test_duplicate_headers():
    """测试重复表头的场景"""
    print("=" * 60)
    print("测试1: 重复表头（年龄, 年龄 / 专业, 专业）")
    print("=" * 60)
    
    # 模拟Dify返回的带重复表头的HTML
    buggy_html = """<table border="1">
  <tr>
    <td>姓名</td>
    <td>何英</td>
    <td>性别</td>
    <td>男</td>
    <td>年龄</td>
    <td>年龄</td>
  </tr>
  <tr>
    <td>毕业学校</td>
    <td>中山大学</td>
    <td></td>
    <td></td>
    <td>学历</td>
    <td>硕士</td>
  </tr>
  <tr>
    <td>职务</td>
    <td>高级工程师</td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  </tr>
</table>"""
    
    print("\n原始HTML:")
    print(buggy_html)
    
    cleaned_html = sanitize_table_html(buggy_html)
    
    print("\n清理后HTML:")
    print(cleaned_html)
    
    # 验证：第一行的重复"年龄"应该只保留一个
    # 统计第一行中"年龄"出现的次数
    first_row_match = cleaned_html.split('</tr>')[0]
    age_count_in_first_row = first_row_match.count('<td>年龄</td>')
    
    assert age_count_in_first_row == 1, f"第一行应该只有一个'年龄'列，实际有{age_count_in_first_row}个"
    
    print("\n[OK] 测试通过：重复列已移除")


def test_no_duplicates():
    """测试无重复的正常表格"""
    print("\n" + "=" * 60)
    print("测试2: 无重复表头（正常表格）")
    print("=" * 60)
    
    normal_html = """<table border="1">
  <tr>
    <td>姓名</td>
    <td>年龄</td>
    <td>专业</td>
  </tr>
  <tr>
    <td>张三</td>
    <td>35</td>
    <td>计算机</td>
  </tr>
</table>"""
    
    print("\n原始HTML:")
    print(normal_html)
    
    cleaned_html = sanitize_table_html(normal_html)
    
    print("\n清理后HTML:")
    print(cleaned_html)
    
    # 验证：应该保持不变
    assert '<td>姓名</td>' in cleaned_html
    assert '<td>年龄</td>' in cleaned_html
    assert '<td>专业</td>' in cleaned_html
    assert '<td>张三</td>' in cleaned_html
    
    print("\n[OK] 测试通过：正常表格未被修改")


def test_empty_cells():
    """测试包含空白单元格的表格"""
    print("\n" + "=" * 60)
    print("测试3: 包含空白单元格")
    print("=" * 60)
    
    html_with_blanks = """<table border="1">
  <tr>
    <td>姓名</td>
    <td>[空白]</td>
    <td>年龄</td>
    <td>[空白]</td>
  </tr>
  <tr>
    <td>张三</td>
    <td></td>
    <td>35</td>
    <td></td>
  </tr>
</table>"""
    
    print("\n原始HTML:")
    print(html_with_blanks)
    
    cleaned_html = sanitize_table_html(html_with_blanks)
    
    print("\n清理后HTML:")
    print(cleaned_html)
    
    # 验证：空白单元格应该保留（因为它们不算重复）
    assert cleaned_html.count('<td>[空白]</td>') == 2, "空白单元格应该保留"
    
    print("\n[OK] 测试通过：空白单元格正确保留")


if __name__ == "__main__":
    try:
        test_duplicate_headers()
        test_no_duplicates()
        test_empty_cells()
        
        print("\n" + "=" * 60)
        print("[SUCCESS] 所有测试通过！")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
