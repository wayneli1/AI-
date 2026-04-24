from typing import List


DYNAMIC_KEYWORDS = [
    "简历", "人员", "项目经历", "工作经历", "资格证书",
    "学历", "专业", "工作经验", "类似项目", "业绩",
    "拟投入", "主要人员", "技术负责人", "项目经理",
    "技术骨干", "项目组", "团队", "资质", "证书",
    # 🆕 新增：招投标常见人员表格关键词
    "拟任", "拟委", "委任", "资历", "任职", "配备",
    "社保证明", "加分", "页码", "职务", "职称",
    "服务团队", "管理机构",
]

# 🆕 公司基本情况表关键词：命中3个以上即识别为公司信息表
COMPANY_INFO_KEYWORDS = [
    "基本情况", "供应商名称", "注册资金", "注册地址",
    "法定代表人", "开户银行", "银行账号", "邮政编码",
    "成立时间", "成立日期", "员工总数", "联系人",
    "营业执照", "投标人名称", "被邀请单位", "营业额",
    "基本账户", "关联企业", "资质证书",
]

MANUAL_KEYWORDS = [
    "报价", "价格", "总价", "单价", "费率", "偏离",
    "折扣", "优惠", "让利", "付款", "工期",
    "商务条款", "技术条款", "投标一览表", "开标",
    "投标报价", "分项报价", "报价明细",
]


def classify_table(anchor_context: str, headers: List[str], cell_texts: List[str] = None) -> str:
    """
    分类表格为 dynamic（可AI填充）或 manual（高危/手动）
    
    改进：增加 cell_texts 参数，用于合并单元格表格的分类
    当 headers 全是同一个词（如"经历"）时，通过单元格内容判断
    """
    combined = f"{anchor_context} {' '.join(headers)}".lower()
    
    # 优先检查 MANUAL 关键词
    for kw in MANUAL_KEYWORDS:
        if kw in combined:
            return "manual"
    
    # 🆕 检查公司基本情况表（命中3个以上关键词 → 归为 dynamic，fillMode 由 detect_table_fill_mode 决定）
    company_score = sum(1 for kw in COMPANY_INFO_KEYWORDS if kw in combined)
    if company_score >= 3:
        return "dynamic"
    
    # 检查 DYNAMIC 关键词（在锚点+headers中）
    for kw in DYNAMIC_KEYWORDS:
        if kw in combined:
            return "dynamic"
    
    # 🆕 如果提供了单元格文本，也在其中搜索
    # 这解决了合并单元格导致 headers 全是同一个词（如"经历"）的问题
    if cell_texts:
        cells_combined = " ".join(cell_texts).lower()
        # 先检查是否包含 MANUAL 关键词
        for kw in MANUAL_KEYWORDS:
            if kw in cells_combined:
                return "manual"
        # 🆕 检查公司基本情况表
        company_score = sum(1 for kw in COMPANY_INFO_KEYWORDS if kw in cells_combined)
        if company_score >= 3:
            return "dynamic"
        for kw in DYNAMIC_KEYWORDS:
            if kw in cells_combined:
                return "dynamic"
    
    # 🐛 修复：如果 headers 大量重复（合并单元格的特征），
    # 检查锚点上下文中是否含动态关键词
    unique_headers = set(h for h in headers if h)
    if len(unique_headers) <= 2 and len(headers) > 3:
        anchor_lower = anchor_context.lower()
        for kw in DYNAMIC_KEYWORDS:
            if kw in anchor_lower:
                return "dynamic"
    
    return "manual"


def get_table_type_label(anchor_context: str, headers: List[str]) -> str:
    combined = f"{anchor_context} {' '.join(headers)}".lower()
    
    # 🆕 优先检查公司基本情况表
    company_score = sum(1 for kw in COMPANY_INFO_KEYWORDS if kw in combined)
    if company_score >= 3:
        return "company_info_table"
    
    if any(kw in combined for kw in ["简历", "人员", "拟投入", "主要人员", "拟任", "拟委", "委任", "资历", "任职", "配备", "服务团队", "管理机构"]):
        return "resume_table"
    if any(kw in combined for kw in ["业绩", "项目经历", "类似项目"]):
        return "experience_table"
    if any(kw in combined for kw in ["资质", "证书", "资格"]):
        return "certificate_table"
    if any(kw in combined for kw in ["报价", "价格", "总价", "单价"]):
        return "pricing_table"
    if any(kw in combined for kw in ["偏离"]):
        return "deviation_table"
    
    return "unknown_table"
