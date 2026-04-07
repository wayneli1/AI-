# merge_server.py - 纯XML节点深度拷贝方案（废弃altChunk，完美适配WPS）
from docx.oxml.ns import qn
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from docx import Document
import json
import requests
import re
import io
import copy
import urllib3


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

def normalize_key(key):
    if not key:
        return key
    return re.sub(r'\s+', '', key)

def find_url_fuzzy(code, url_mapping):
    if code in url_mapping:
        return url_mapping[code]

    normalized_code = normalize_key(code)
    for key, url in url_mapping.items():
        if normalize_key(key) == normalized_code:
            return url

    full_code = f"[INSERT_DOC:{code}]"
    if full_code in url_mapping:
        return url_mapping[full_code]

    normalized_full = normalize_key(full_code)
    for key, url in url_mapping.items():
        if normalize_key(key) == normalized_full:
            return url

    return None


def transfer_images(main_doc, sub_doc, new_element):
    """
    【核心魔法】：借壳生蛋法
    将子文档的物理图片文件打包进主文档的 ZIP 中，并修复 XML 关系映射。
    完全适配 BaseOxmlElement，日志不再疯狂刷屏。
    """
    from docx.oxml.ns import qn
    
    # 使用 lxml 的通配符语法绕过命名空间检查：
    # *[local-name()='blip'] 的意思是不管命名空间是什么，只要标签名是 'blip' 就行
    try:
        blips = new_element.xpath('.//*[local-name()="blip"]')
        imagedatas = new_element.xpath('.//*[local-name()="imagedata"]')
    except Exception as e:
        # 如果还是报错，说明这个节点压根不支持 xpath，直接静默跳过
        return
    
    # 获取需要修改的属性名
    embed_attr = qn('r:embed')
    id_attr = qn('r:id')
    
    # 遍历找到的所有图片节点
    for node, attr_name in [(b, embed_attr) for b in blips] + [(i, id_attr) for i in imagedatas]:
        old_rid = node.get(attr_name)
        
        # 确保这个 rId 在子文档里真的存在
        if old_rid and old_rid in sub_doc.part.related_parts:
            img_part = sub_doc.part.related_parts[old_rid]
            
            # 确认这真的是一个图片文件
            if 'image' in img_part.content_type:
                try:
                    # 1. 提取物理图片的二进制流
                    img_stream = io.BytesIO(img_part.blob)
                    
                    # 2. 借壳：在主文档末尾创建一个假段落
                    dummy_p = main_doc.add_paragraph()
                    dummy_run = dummy_p.add_run()
                    dummy_run.add_picture(img_stream)
                    
                    # 3. 偷蛋：提取刚刚生成的新 rId (同样使用通配符语法)
                    dummy_blip = dummy_p._element.xpath('.//*[local-name()="blip"]')[0]
                    new_rid = dummy_blip.get(embed_attr)
                    
                    # 4. 移花接木：更新 XML 节点
                    node.set(attr_name, new_rid)
                    print(f"   🖼️ 成功迁移图片关系: {old_rid} -> {new_rid}")
                    
                except Exception as e:
                    print(f"   ⚠️ 单张图片迁移失败: {e}")
                finally:
                    # 5. 毁尸灭迹：删除假段落
                    try:
                        p_elm = dummy_p._element
                        p_elm.getparent().remove(p_elm)
                    except Exception:
                        pass
    """
    【核心魔法】：借壳生蛋法
    将子文档的物理图片文件打包进主文档的 ZIP 中，并修复 XML 关系映射。
    """
    from docx.oxml.ns import nsmap
    
    # ⚠️ 关键修复：手动注册缺失的命名空间，防止 XPath 崩溃
    # 补充 VML (v:) 的命名空间
    if 'v' not in nsmap:
        nsmap['v'] = 'urn:schemas-microsoft-com:vml'
        
    try:
        # 使用传入 nsmap 的原生方式查找，彻底规避 Undefined namespace prefix 错误
        blips = new_element.xpath('.//a:blip', namespaces=nsmap)
        imagedatas = new_element.xpath('.//v:imagedata', namespaces=nsmap)
    except Exception as e:
        print(f"   ⚠️ XPath 解析跳过: {e}")
        blips = []
        imagedatas = []
    
    embed_attr = qn('r:embed')
    id_attr = qn('r:id')
    
    # 将找到的图片节点和它们对应的属性名组合起来遍历
    for node, attr_name in [(b, embed_attr) for b in blips] + [(i, id_attr) for i in imagedatas]:
        old_rid = node.get(attr_name)
        
        # 确保这个 rId 在子文档里真的存在
        if old_rid and old_rid in sub_doc.part.related_parts:
            img_part = sub_doc.part.related_parts[old_rid]
            
            # 确认这真的是一个图片文件
            if 'image' in img_part.content_type:
                try:
                    # 1. 提取物理图片的二进制流
                    img_stream = io.BytesIO(img_part.blob)
                    
                    # 2. 借壳：在主文档末尾创建一个假段落，让 python-docx 帮我们完成复杂的 ZIP 注入
                    dummy_p = main_doc.add_paragraph()
                    dummy_run = dummy_p.add_run()
                    dummy_run.add_picture(img_stream)
                    
                    # 3. 偷蛋：从假段落的 XML 里提取刚刚生成的新 rId
                    dummy_blip = dummy_p._element.xpath('.//a:blip', namespaces=nsmap)[0]
                    new_rid = dummy_blip.get(embed_attr)
                    
                    # 4. 移花接木：更新我们正准备插入的 XML 节点
                    node.set(attr_name, new_rid)
                    print(f"   🖼️ 成功迁移图片关系: {old_rid} -> {new_rid}")
                    
                except Exception as e:
                    print(f"   ⚠️ 单张图片迁移失败: {e}")
                finally:
                    # 5. 毁尸灭迹：从 XML 树中彻底删除这个假段落（但图片文件已经合法存留在文档包里了）
                    try:
                        p_elm = dummy_p._element
                        p_elm.getparent().remove(p_elm)
                    except Exception:
                        pass
    """
    【核心魔法】：借壳生蛋法
    将子文档的物理图片文件打包进主文档的 ZIP 中，并修复 XML 关系映射。
    """
    # 查找所有现代内嵌图片 <a:blip> 和 旧版浮动图片 <v:imagedata>
    blips = new_element.xpath('.//a:blip')
    imagedatas = new_element.xpath('.//v:imagedata')
    
    embed_attr = qn('r:embed')
    id_attr = qn('r:id')
    
    # 将找到的图片节点和它们对应的属性名组合起来遍历
    for node, attr_name in [(b, embed_attr) for b in blips] + [(i, id_attr) for i in imagedatas]:
        old_rid = node.get(attr_name)
        
        # 确保这个 rId 在子文档里真的存在
        if old_rid and old_rid in sub_doc.part.related_parts:
            img_part = sub_doc.part.related_parts[old_rid]
            
            # 确认这真的是一个图片文件
            if 'image' in img_part.content_type:
                try:
                    # 1. 提取物理图片的二进制流
                    img_stream = io.BytesIO(img_part.blob)
                    
                    # 2. 借壳：在主文档末尾创建一个假段落，让 python-docx 帮我们完成复杂的 ZIP 注入
                    dummy_p = main_doc.add_paragraph()
                    dummy_run = dummy_p.add_run()
                    dummy_run.add_picture(img_stream)
                    
                    # 3. 偷蛋：从假段落的 XML 里提取刚刚生成的新 rId
                    dummy_blip = dummy_p._element.xpath('.//a:blip')[0]
                    new_rid = dummy_blip.get(embed_attr)
                    
                    # 4. 移花接木：更新我们正准备插入的 XML 节点
                    node.set(attr_name, new_rid)
                    print(f"   🖼️ 成功迁移图片关系: {old_rid} -> {new_rid}")
                    
                except Exception as e:
                    print(f"   ⚠️ 单张图片迁移失败: {e}")
                finally:
                    # 5. 毁尸灭迹：从 XML 树中彻底删除这个假段落（但图片文件已经合法存留在文档包里了）
                    p_elm = dummy_p._element
                    p_elm.getparent().remove(p_elm)


def insert_docx_via_xml(main_doc, target_paragraph, subdoc_bytes):
    """
    带图片解析的深度 XML 缝合版
    """
    sub_doc = Document(io.BytesIO(subdoc_bytes))

    target_element = target_paragraph._element
    parent_elm = target_element.getparent()

    if parent_elm is None:
        print(f"   ❌ 无法找到暗码节点的父元素")
        return 0

    insert_index = list(parent_elm).index(target_element)
    inserted_count = 0

    for child in sub_doc._element.body:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag

        if tag == 'sectPr':
            continue

        if tag not in ('p', 'tbl'):
            continue

        # 深度拷贝图纸
        new_element = copy.deepcopy(child)
        
        # 🌟 插入前，执行图片迁移魔法！
        transfer_images(main_doc, sub_doc, new_element)
        
        # 将修复好图片的节点插入主文档
        parent_elm.insert(insert_index, new_element)
        insert_index += 1
        inserted_count += 1

    # 移除暗码段落
    parent_elm.remove(target_element)

    return inserted_count




    """
    将子文档的 XML 节点深度拷贝插入主文档，完全废弃 altChunk。

    参数:
        main_doc: python-docx Document 对象（主文档）
        target_paragraph: python-docx Paragraph 对象（包含 [INSERT_DOC:xxx] 暗码的段落）
        subdoc_bytes: 子文档的二进制数据

    返回:
        成功插入的节点数量
    """
    sub_doc = Document(io.BytesIO(subdoc_bytes))

    target_element = target_paragraph._element
    parent_elm = target_element.getparent()

    if parent_elm is None:
        print(f"   ❌ 无法找到暗码节点的父元素")
        return 0

    insert_index = list(parent_elm).index(target_element)

    inserted_count = 0

    for child in sub_doc._element.body:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag

        if tag == 'sectPr':
            print(f"   ⏭️ 过滤掉 <w:sectPr> 节属性节点，避免破坏主文档页面布局")
            continue

        if tag not in ('p', 'tbl'):
            print(f"   ⏭️ 跳过未知节点类型: <w:{tag}>")
            continue

        new_element = copy.deepcopy(child)
        parent_elm.insert(insert_index, new_element)
        insert_index += 1
        inserted_count += 1

    parent_elm.remove(target_element)

    return inserted_count


def find_and_replace_insert_codes(main_doc, url_mapping):
    """
    遍历主文档所有段落，查找 [INSERT_DOC:xxx] 暗码，
    下载对应子文档并调用 insert_docx_via_xml 进行合并。
    """
    total_merged = 0

    paragraphs_to_process = []
    for para in main_doc.paragraphs:
        para_text = para.text
        codes = re.findall(r'\[INSERT_DOC:([^\]]+)\]', para_text)
        for code in codes:
            paragraphs_to_process.append((para, code))

    if not paragraphs_to_process:
        print("   ℹ️ 未找到任何 [INSERT_DOC:xxx] 暗码")
        return 0

    print(f"   📍 共找到 {len(paragraphs_to_process)} 个暗码引用")

    for para, code in paragraphs_to_process:
        print(f"\n   📍 处理暗号: [INSERT_DOC:{code}]")

        url = find_url_fuzzy(code, url_mapping)

        if not url:
            print(f"   ❌ 未找到对应URL，替换为错误提示文本")
            para.clear()
            para.add_run(f"[未找到附件: {code}]")
            continue

        print(f"   🔗 URL: {url}")

        try:
            resp = requests.get(url, timeout=60, verify=False)
            print(f"   📊 HTTP状态码: {resp.status_code}")
            print(f"   📊 响应大小: {len(resp.content)} bytes")

            if len(resp.content) < 1000:
                print(f"   ⚠️ 响应内容太小，可能不是有效的docx文件")
                print(f"   ⚠️ 内容预览: {resp.content[:200]}")
                para.clear()
                para.add_run(f"[附件无效: {code}]")
                continue

            resp.raise_for_status()
        except Exception as e:
            print(f"   ❌ 下载失败: {e}")
            para.clear()
            para.add_run(f"[下载失败: {code}]")
            continue

        try:
            count = insert_docx_via_xml(main_doc, para, resp.content)
            print(f"   ✅ 成功插入 {count} 个节点")
            total_merged += 1
        except Exception as e:
            print(f"   ❌ XML合并失败: {e}")
            import traceback
            traceback.print_exc()
            para.clear()
            para.add_run(f"[合并失败: {code}]")

    return total_merged


@app.post("/api/merge-docs")
async def merge_docs(file: UploadFile = File(...), mapping: str = Form(...)):
    print("\n==========================")
    print("📥 成功接收到前端请求！")
    print("==========================")
    print("\n" + "=" * 70)
    print("🚀 [merge_docs] 开始处理文档合并请求（纯XML节点深度拷贝）")
    print("=" * 70)

    try:
        doc_bytes = await file.read()
        print(f"📥 接收到主文档: {len(doc_bytes)} bytes")

        url_mapping = json.loads(mapping)
        print(f"\n📋 mapping 接收结果:")
        print(f"   条目数量: {len(url_mapping)}")
        for key, url in url_mapping.items():
            print(f"   - 键: [{key}] -> {url}")

        main_doc = Document(io.BytesIO(doc_bytes))
        print(f"\n📄 主文档段落数: {len(main_doc.paragraphs)}")

        print(f"\n{'='*60}")
        print("🔍 开始扫描文档中的 [INSERT_DOC:xxx] 暗码并合并子文档")
        print(f"{'='*60}")

        total_merged = find_and_replace_insert_codes(main_doc, url_mapping)

        print(f"\n{'='*60}")
        print(f"📦 合并完成，共成功合并 {total_merged} 个附件")
        print(f"{'='*60}")

        output_io = io.BytesIO()
        main_doc.save(output_io)
        output_io.seek(0)

        final_size = len(output_io.getvalue())
        print(f"\n✅ 最终文档大小: {final_size} bytes")
        print("=" * 70 + "\n")

        return StreamingResponse(
            output_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename=Merged_Bid.docx"}
        )

    except Exception as e:
        print(f"\n💥 服务器致命错误: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("merge_server:app", host="0.0.0.0", port=8003, reload=True)
