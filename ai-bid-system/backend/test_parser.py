import sys
sys.path.insert(0, '.')

from services.blank_scanner import scan_normal_blanks
from services.table_parser import parse_table
from services.table_classifier import classify_table, get_table_type_label

test_paragraphs = [
    type('obj', (object,), {'text': '投标函'})(),
    type('obj', (object,), {'text': '致：XXX招标有限公司'})(),
    type('obj', (object,), {'text': '投标人名称：_________'})(),
    type('obj', (object,), {'text': '法定代表人：________________'})(),
    type('obj', (object,), {'text': '日期：2024年__月__日'})(),
]

print("=== 测试空白扫描 ===")
blanks = scan_normal_blanks(test_paragraphs)
print(f"扫描到 {len(blanks)} 个空白")
for b in blanks:
    print(f"  [{b['type']}] {b['context'][:50]} -> fill_role: {b['fill_role']}")

print("\n=== 测试表格分类 ===")
test_cases = [
    ("5.4.2 拟投入本项目的主要人员简历表：", ["姓名", "年龄", "职务", "项目经验"]),
    ("附件七：商务条款偏离表", ["招标文件条目", "投标响应", "偏离情况"]),
    ("开标一览表", ["序号", "项目", "报价"]),
    ("售后服务方案", ["服务内容", "响应时间", "承诺"]),
]

for anchor, headers in test_cases:
    cls = classify_table(anchor, headers)
    label = get_table_type_label(anchor, headers)
    print(f"  [{cls}] {label}: {anchor}")

print("\n=== 测试通过 ===")
