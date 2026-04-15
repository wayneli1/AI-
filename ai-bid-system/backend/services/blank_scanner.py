import re
from typing import List, Dict, Any


MANUAL_PATTERNS = [
    r"报价", r"总价", r"单价", r"合同价", r"投标价",
    r"费率", r"偏离度", r"交货期", r"质保期",
]

DATE_PATTERNS = [
    r"(?:投标)?日期", r"年月日", r"成立日期", r"出生日期",
    r"注册日期", r"签字生效", r"有效期",
    r"自.*?年.*?月.*?日.*?至.*?年.*?月.*?日",
    r"于.*?年.*?月.*?日",
]

ATTACHMENT_KEYWORDS = [
    "营业执照", "审计报告", "资信证明", "法人证书",
    "资质证书", "财务报表", "无重大违法记录",
    "资格证明文件", "声明", "承诺函",
]

STANDALONE_LABEL_PATTERN = re.compile(
    r"(?:签字或盖章|签字|盖章|法人公章|法定代表人|"
    r"被授权人|委托代理人|授权代表|投标人|职务|日期|年月日)[：:]?$"
)

DATE_LABEL_PATTERN = re.compile(r"^(?:投标)?日期[：:]?$|^年月日[：:]?$")

REPEATED_KEYWORD_PATTERN = re.compile(
    r"(单位名称|单位性质|地\s*址|经营期限|法定代表人)[:：]\s*\1[:：]?"
)

COLON_END_PATTERN = re.compile(r"([^：:\n]{2,120})([：:])\s*$")

UNDERSCORE_PATTERN = re.compile(r"_{2,}")

DASH_PATTERN = re.compile(r"-{3,}")

SPACE_AFTER_COLON_PATTERN = re.compile(r"([：:])(\s{3,})")

ROUND_BRACKET_PATTERN = re.compile(
    r"[（(]\s*(盖章处|签章处|盖章|签字|请填写[^）)]*|"
    r"待补充|待定|填写[^）)]*|请盖章)\s*[)）]"
)

SQUARE_BRACKET_PATTERN = re.compile(
    r"[\[【]\s*(填写[^\]】]*|待补充|待定|请填写[^\]】]*)\s*[\]】]"
)

PLACEHOLDER_PATTERN = re.compile(r"待补充|待填")

IMAGE_PLACEHOLDER_PATTERNS = [
    re.compile(r"贴.*(?:复印件|扫描件|照片|图片)处"),
    re.compile(r"(?:复印件|扫描件|证明文件)粘贴处"),
]


def _determine_fill_role(text: str) -> str:
    for pattern in MANUAL_PATTERNS:
        if re.search(pattern, text):
            return "manual"
    return "auto"


def _is_date_like_label(text: str) -> bool:
    normalized = re.sub(r"\s+", "", text).strip()
    if not normalized:
        return False
    return bool(DATE_LABEL_PATTERN.match(normalized))


def _is_date_like_content(text: str) -> bool:
    normalized = re.sub(r"\s+", "", text).strip()
    if not normalized:
        return False
    for pattern in DATE_PATTERNS:
        if re.search(pattern, normalized):
            return True
    return False


def _is_standalone_label(text: str) -> bool:
    normalized = re.sub(r"\s+", "", text).strip()
    if not normalized:
        return False
    return bool(STANDALONE_LABEL_PATTERN.match(normalized))


def _is_structural_empty(para) -> bool:
    text = para.text.strip()
    if text:
        return False
    xml = para._element.xml
    if re.search(r"<w:sectPr[\s>]|<w:bookmarkStart[\s>]|<w:bookmarkEnd[\s>]", xml):
        return True
    return bool(re.search(r"<w:pPr[\s>]", xml))


def scan_normal_blanks(paragraphs) -> List[Dict[str, Any]]:
    blanks = []
    blank_counter = 0

    for para_index, para in enumerate(paragraphs):
        text = para.text
        if not text or not text.strip():
            continue

        text = text.strip()
        has_blank_already = False

        # 1) 复读机式占位符
        for m in REPEATED_KEYWORD_PATTERN.finditer(text):
            blank_counter += 1
            marked_ctx = text[: m.start()] + "【🎯】" + text[m.end() :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": m.group(1),
                "type": "repeated_keyword",
                "confidence": "high",
                "index": m.start(),
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 2) 图片贴图占位符
        is_image_placeholder = any(p.search(text) for p in IMAGE_PLACEHOLDER_PATTERNS)
        if is_image_placeholder and not has_blank_already:
            blank_counter += 1
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": "[图片插入位置：]【🎯】",
                "matchText": text,
                "type": "image_placeholder",
                "confidence": "high",
                "index": 0,
                "fill_role": "auto",
                "source": "regex",
            })
            has_blank_already = True

        # 3) 冒号结尾无内容
        if not _is_date_like_label(text):
            colon_match = COLON_END_PATTERN.match(text)
            if colon_match:
                colon_char = colon_match.group(2)
                colon_idx = text.rfind(colon_char)
                blank_counter += 1
                blanks.append({
                    "id": f"blank_{blank_counter}",
                    "paraIndex": para_index,
                    "context": text,
                    "markedContext": text[: colon_idx + 1] + "【🎯】",
                    "matchText": "",
                    "type": "keyword_space",
                    "confidence": "medium",
                    "index": colon_idx + 1,
                    "fill_role": _determine_fill_role(text),
                    "source": "regex",
                })
                has_blank_already = True

        # 4) 下划线
        for m in UNDERSCORE_PATTERN.finditer(text):
            blank_counter += 1
            marked_ctx = text[: m.start()] + "【🎯】" + text[m.end() :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": m.group(),
                "type": "underscore",
                "confidence": "high",
                "index": m.start(),
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 5) 短横线
        for m in DASH_PATTERN.finditer(text):
            blank_counter += 1
            marked_ctx = text[: m.start()] + "【🎯】" + text[m.end() :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": m.group(),
                "type": "dash",
                "confidence": "high",
                "index": m.start(),
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 6) 冒号后长空格
        for m in SPACE_AFTER_COLON_PATTERN.finditer(text):
            space_start = m.start() + len(m.group(1))
            space_str = m.group(2)
            blank_counter += 1
            marked_ctx = text[:space_start] + "【🎯】" + text[space_start + len(space_str) :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": space_str,
                "type": "keyword_space",
                "confidence": "medium",
                "index": space_start,
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 7) 圆括号填空
        for m in ROUND_BRACKET_PATTERN.finditer(text):
            blank_counter += 1
            marked_ctx = text[: m.start()] + "【🎯】" + text[m.end() :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": m.group(),
                "type": "brackets",
                "confidence": "high",
                "index": m.start(),
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 8) 方括号填空
        for m in SQUARE_BRACKET_PATTERN.finditer(text):
            blank_counter += 1
            marked_ctx = text[: m.start()] + "【🎯】" + text[m.end() :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": m.group(),
                "type": "brackets",
                "confidence": "high",
                "index": m.start(),
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 9) 占位符文本
        for m in PLACEHOLDER_PATTERN.finditer(text):
            blank_counter += 1
            marked_ctx = text[: m.start()] + "【🎯】" + text[m.end() :]
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": marked_ctx,
                "matchText": m.group(),
                "type": "placeholder",
                "confidence": "high",
                "index": m.start(),
                "fill_role": _determine_fill_role(text),
                "source": "regex",
            })
            has_blank_already = True

        # 10) 附件/资质类占位
        has_attachment_hint = any(kw in text for kw in ATTACHMENT_KEYWORDS)
        has_blank_marker = bool(re.search(r"_{3,}|-{4,}|[：:]\s{3,}", text))
        is_requirement = bool(re.search(r"复印件|原件|提供|出具|须具备|副本|声明|加盖公章", text)) or has_blank_marker
        if (
            has_attachment_hint
            and is_requirement
            and not has_blank_already
            and 5 < len(text) < 300
        ):
            blank_counter += 1
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": "【🎯】" + text,
                "matchText": "[附件/资质插入位]",
                "type": "attachment",
                "confidence": "high",
                "index": len(text),
                "fill_role": "auto",
                "source": "regex",
            })
            has_blank_already = True

        # 11) 标签后接空段落推断
        next_para = paragraphs[para_index + 1] if para_index + 1 < len(paragraphs) else None
        if (
            _is_standalone_label(text)
            and not _is_date_like_label(text)
            and next_para is not None
            and _is_structural_empty(next_para)
            and not has_blank_already
        ):
            colon_match = re.search(r"[：:]", text)
            colon_idx = text.rfind(colon_match.group()) if colon_match else -1
            insert_pos = colon_idx + 1 if colon_match else len(text)
            blank_counter += 1
            blanks.append({
                "id": f"blank_{blank_counter}",
                "paraIndex": para_index,
                "context": text,
                "markedContext": text[:insert_pos] + "【🎯】",
                "matchText": "",
                "type": "keyword_space",
                "confidence": "medium",
                "index": insert_pos,
                "fill_role": _determine_fill_role(text),
                "source": "regex",
                "inferredFromNextParagraph": True,
            })

    # 过滤日期假空白
    filtered = []
    for b in blanks:
        haystack = " ".join([
            b.get("context", ""),
            b.get("markedContext", ""),
            b.get("matchText", ""),
        ])
        if not _is_date_like_content(haystack):
            filtered.append(b)

    # 按阅读顺序排序
    filtered.sort(key=lambda x: (x["paraIndex"], x["index"]))

    # 分配段落内序号
    current_para = -1
    ordinal = 1
    for b in filtered:
        if b["paraIndex"] != current_para:
            current_para = b["paraIndex"]
            ordinal = 1
        b["blankOrdinalInParagraph"] = ordinal
        ordinal += 1

    return filtered
