from typing import List


DYNAMIC_KEYWORDS = [
    "简历", "人员", "项目经历", "工作经历", "资格证书",
    "学历", "专业", "工作经验", "类似项目", "业绩",
    "拟投入", "主要人员", "技术负责人", "项目经理",
    "技术骨干", "项目组", "团队", "资质", "证书",
]

MANUAL_KEYWORDS = [
    "报价", "价格", "总价", "单价", "费率", "偏离",
    "折扣", "优惠", "让利", "付款", "工期",
    "商务条款", "技术条款", "投标一览表", "开标",
    "投标报价", "分项报价", "报价明细",
]


def classify_table(anchor_context: str, headers: List[str]) -> str:
    combined = f"{anchor_context} {' '.join(headers)}".lower()
    
    for kw in MANUAL_KEYWORDS:
        if kw in combined:
            return "manual"
    
    for kw in DYNAMIC_KEYWORDS:
        if kw in combined:
            return "dynamic"
    
    return "manual"


def get_table_type_label(anchor_context: str, headers: List[str]) -> str:
    combined = f"{anchor_context} {' '.join(headers)}".lower()
    
    if any(kw in combined for kw in ["简历", "人员", "拟投入", "主要人员"]):
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
