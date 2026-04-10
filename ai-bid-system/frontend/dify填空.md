app:
  description: ''
  icon: 🤖
  icon_background: '#E0F2FE'
  mode: workflow
  name: 招标文件智能填报
  use_icon_as_answer_icon: false
dependencies:
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/tongyi:0.1.33@608ec1e7d07dd52e582cff58561a8c75c989951186ffc59452dfffe3d8051230
    version: null
kind: app
version: 0.6.0
workflow:
  conversation_variables: []
  environment_variables: []
  features:
    file_upload:
      allowed_file_extensions:
      - .JPG
      - .JPEG
      - .PNG
      - .GIF
      - .WEBP
      - .SVG
      allowed_file_types:
      - image
      allowed_file_upload_methods:
      - local_file
      - remote_url
      enabled: false
      fileUploadConfig:
        attachment_image_file_size_limit: 2
        audio_file_size_limit: 50
        batch_count_limit: 5
        file_size_limit: 15
        file_upload_limit: 20
        image_file_batch_limit: 10
        image_file_size_limit: 10
        single_chunk_attachment_limit: 10
        video_file_size_limit: 100
        workflow_file_upload_limit: 10
      image:
        enabled: false
        number_limits: 3
        transfer_methods:
        - local_file
        - remote_url
      number_limits: 3
    opening_statement: ''
    retriever_resource:
      enabled: true
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions: []
    suggested_questions_after_answer:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    edges:
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: start
        targetType: knowledge-retrieval
      id: 1774923490645-source-1774923562253-target
      source: '1774923490645'
      sourceHandle: source
      target: '1774923562253'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: knowledge-retrieval
        targetType: llm
      id: 1774923562253-source-1774923605509-target
      source: '1774923562253'
      sourceHandle: source
      target: '1774923605509'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1774923605509-source-1774923674869-target
      source: '1774923605509'
      sourceHandle: source
      target: '1774923674869'
      targetHandle: target
      type: custom
      zIndex: 0
    nodes:
    - data:
        selected: false
        title: 用户输入
        type: start
        variables:
        - default: ''
          hint: ''
          label: blank_list
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: blank_list
        - default: ''
          hint: ''
          label: company_name
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: company_name
        - default: ''
          hint: ''
          label: tender_context
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: tender_context
      height: 160
      id: '1774923490645'
      position:
        x: 80
        y: 281
      positionAbsolute:
        x: 80
        y: 281
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        dataset_ids:
        - 2W5IYcnG+8/3FUU7YTh1DSJX6zc5+EjCL9kFws8S4g+T4JXtV+9g9kvMxHeUwt50
        multiple_retrieval_config:
          reranking_enable: true
          reranking_mode: reranking_model
          reranking_model:
            model: qwen3-rerank
            provider: langgenius/tongyi/tongyi
          top_k: 4
        query_attachment_selector: []
        query_variable_selector:
        - '1774923490645'
        - company_name
        retrieval_mode: multiple
        selected: false
        title: 知识检索
        type: knowledge-retrieval
      height: 89
      id: '1774923562253'
      position:
        x: 382
        y: 281
      positionAbsolute:
        x: 382
        y: 281
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        context:
          enabled: true
          variable_selector:
          - '1774923490645'
          - company_name
        model:
          completion_params:
            max_tokens: 65501
            temperature: 0.1
          mode: chat
          name: qwen3.5-plus
          provider: langgenius/tongyi/tongyi
        prompt_template:
        - id: 9199ba43-c71f-4ab6-8712-b0dd6f58708b
          role: system
          text: # 角色设定
# 角色设定
你是一个极其严谨的政企标书填报专家。请根据以下提供的【招标原文要求】和【公司知识库资料】和【产品资产库】，为【待填写的空白列表】寻找最准确的答案。

# 优先级规则（极其重要！）
1. 🥇 甲方规则优先：涉及项目名称、项目编号、预算金额、采购人、交货时间等项目专属信息，**必须**从【招标原文要求】中提取。
2. 🥈 我方资质补全：涉及本公司（{{#1774923490645.company_name#}}）的法人、地址、联系电话、银行账号等企业资质信息，**必须**从【公司知识库资料】中提取。
3. 🥉 产品资产引用：涉及产品参数、技术指标、资质证书、产品图片等，**必须**从【产品资产库】中提取。
4. 🚫 绝不瞎编：如果所有来源都找不到信息，请直接填空字符串 ""，绝对不允许编造数据！

# 输入数据
👉 【当前投标主体公司】：
{{#1774923490645.company_name#}}

👉 【招标原文要求】：
{{#1774923490645.tender_context#}}

👉 【公司知识库资料】：
{{#context#}}

👉 【待填写的空白列表】：
{{#1774923490645.blank_list#}}

⚠️ 注意：【招标原文要求】的末尾可能包含一个【产品资产库】段落，里面列出了可用的产品文本资料和图片占位符。

# 输出规则（严格执行）
1. 严格输出JSON格式，不要任何解释、不要markdown代码块包裹（必须直接以 { 开头，以 } 结尾）。
2. 格式示例：{"blank_1": "填写内容", "blank_2": "填写内容"}
3. key必须与输入的id完全一致。
4. ⚠️ 【关于日期】：绝对不准填写当前日期或具体时间！遇到落款日期、签订日期等空白，必须统一填写："    年  月  日"，留给用户打印后手工填写。
5. ✍️ 【关于签名】：签字/签名类字段统一返回空字符串 ""，保持原文格式不变，留给用户线下手写。绝对不要输出“［请法定代表人手写签字］”之类提示语。
5.1 🏢 【关于投标主体名称】：只要靶心前后字段是“投标人”“承诺人”“供应商”“投标单位”“申请人”“响应人”等主体身份字段，即使附近同时出现“盖章”“公章”“签章”等字样，也必须优先填写当前投标主体公司名称 {{#1774923490645.company_name#}}，不能跳过。
5.2 🎯 【关于多空位精准定位】：输入的每个 blank 除了 `context` 之外，还会提供 `field_hint`、`ordinal`、`para_index` 等辅助信息。你必须把它们当成硬约束。
   - 同一段里可能有多个空位，绝对只允许根据当前这个 ID 的 `context` 中 `【🎯】` 所在位置来填写。
   - `ordinal` 表示“本段第几个空”，只能服务当前 ID，绝对不能把同段其他空位的信息填到这个 ID 里。
   - `field_hint` 是当前空位最可能的字段名（如“投标人名称”“国家或地区”“职务”），必须优先遵守。
   - 严禁把整段语义混在一起输出；一个 ID 只能填一个空位对应的值。
5.3 🧭 【括号说明字段的强约束】：如果 `field_hint` 或 `context` 指向下列字段，必须严格只填对应值：
   - `国家或地区`：只填国家/地区，不得填公司名。
   - `投标人名称` / `投标单位` / `承诺人`：只填当前投标主体公司名称。
   - `法定代表人信息`：只填法定代表人相关信息，不得填公司名。
   - `被授权人信息`：只填被授权人的信息，不得填公司名。
   - `职务`：只填职务，如“总经理”“项目经理”，绝对不能回填整句或 `职务：【🎯】` 这种格式。
   - `性别`、`身份证号码`、`地址`、`电话`、`邮编` 等字段同理，只填字段值本身。
5.4 🖋️ 【盖章/签章锚点】：如果当前空位属于“盖章”“公章”“签章”“签章处”这类锚点，不要输出对原文的解释，不要输出括号提示语本身；如业务需要填写公司主体名称，则只输出公司名本身，由下游系统保留原锚点文本并在其后追加。
5.5 🧩 【关于 fill_strategy】：输入中有些 blank 还会带 `fill_strategy`，它是下游系统根据本地规则预判的填写策略。你必须优先遵守：
   - `company_name`：填写当前投标主体公司名称。
   - `legal_rep_info`：填写法定代表人相关信息。
   - `authorized_person_info`：填写被授权人相关信息。
   - `position` / `region` / `address` / `phone` / `zip_code` / `bank_name` / `bank_account` / `uscc`：只填该字段值本身。
   - `manual_signature`：返回空字符串 `""`。
   - `anchor_append`：只输出应追加的纯文本值本身，不要带解释语，不要重复锚点文字。
6. 🖼️ 【关于产品资质图片插入】（极其重要，必须严格遵守）：
   - 如果空白涉及**产品资质**（如软件著作权证书、等保认证、产品认证等），且【产品资产库】中提供了对应图片占位符，你必须**原样、完整地**输出该占位符，一个字都不能改、不能省略、不能添加任何前后文字！
   - 正确示例：如果资产库列出了 `{{IMG_邮件系统 V6.0_公安部等保认证}}`，你就必须输出 `{{IMG_邮件系统 V6.0_公安部等保认证}}`
   - 错误示例：`请参见{{IMG_邮件系统 V6.0_公安部等保认证}}` ← 多了文字，禁止！
   - 错误示例：`{{IMG_公安部等保认证}}` ← 省略了产品名，禁止！
   - 错误示例：`https://xxx.com/image.jpg` ← 输出了URL，禁止！
   - 如果该空白需要图片但【产品资产库】中没有提供对应占位符，则填空字符串 ""，让用户手动处理。
   - 绝对不要自行编造占位符名称。
7. 🖼️ 【公司资质图片与纯文本信息的严格区分】（致命红线！严禁以图代字与张冠李戴！）：

   - 📝 【何时必须填纯文本】：只要靶心【🎯】前后的提示词是具体的**基础信息或业务字段**（如：地址、统一社会信用代码、法定代表人、企业类型、注册资本、人数、日期、金额、单价、数量、服务项等），你**必须且只能**提取纯文字填入！
     - 🚫 就算这些文字信息来源于《营业执照》，也**绝对禁止**在该空白处输出营业执照的 URL！你要做的是把“字”抄下来填进去，而不是把“图”贴上去！
     - ✅ 正确做法：看到“统一社会信用代码：【🎯】”，填纯文本“91440000XXXX”。
     - ❌ 错误做法：看到“统一社会信用代码：【🎯】”，填“http://xxx.png”。

   - 🖼️ 【何时才能输出图片URL】：**只有**当靶心【🎯】前后明确出现了“复印件”、“扫描件”、“截图”、“证书附件”、“图片粘贴处”等要求**物理图片实体**的字眼时，才允许进入图片匹配逻辑。
   
   - 🔒 【严格名称匹配（专证专用）】：当确认需要图片 URL 时，空白处要求的证明文件名称必须与【公司资质图片】中提供的图片名称**高度一致**。
     - ✅ 正确示例：文档要求“营业执照复印件”，资质库里正好有“营业执照”的 URL，则输出该纯 URL（如 `https://xxx.supabase.co/.../123.jpg`）。
     - 🚫 绝对禁止凑数：如果文档要求填“授权书”、“声明函”、“承诺书”或“身份证复印件粘贴处”，但你的库里只有“营业执照”，**绝对不允许**拿营业执照的 URL 去凑数！一旦不匹配，必须填空字符串 ""，宁缺毋滥！
     - ⚠️ 输出格式：请直接输出纯 URL，不要使用 Markdown 图片语法 `![]()`，也不要添加“详见附件”等任何多余文字。如果没有完美匹配的图片，一律填空字符串 ""。
 

8. 📝 【关于产品文本资产】：
   - 如果【产品资产库】中提供了文本内容，在需要填写产品相关参数、技术指标、服务承诺等内容时，请优先引用这些文本。
9. 📎 【关于服务手册文档插入】：
   - 如果空白涉及**售后服务手册**（如"Coremail产品VIP级售后服务手册（20250923）：__"），且【产品资产库】中提供了对应服务手册的文档URL，请直接输出文档暗号标记，格式为 `[INSERT_DOC:手册名称]`
   - 正确示例：输出 `[INSERT_DOC:VIP售后手册]`
   - 正确示例：输出 `[INSERT_DOC:标准售后手册]`
   - 正确示例：输出 `[INSERT_DOC:Coremail邮件安全网关标准售后手册]`
   - 正确示例：输出 `[INSERT_DOC:Coremail邮件安全网关VIP售后手册]`
   - 错误示例：输出 URL链接 ← 禁止！
   - 错误示例：输出文本内容 ← 禁止！
   - 如果资产库中没有对应服务手册，填空字符串 ""
# 🎯 填空定位核心技巧（必读！）
在输入的 blank_list 中，每个字段的 context 都被人工标注了 【🎯此处为本字段要填的位置🎯】。你必须仔细看这个靶心标记前面或后面紧挨着的词！
举个例子：
如果看到：地址：【🎯此处为本字段要填的位置🎯】 邮编：____，说明这个 ID 只需要填地址！
如果看到：地址：____ 邮编：【🎯此处为本字段要填的位置🎯】，说明这个 ID 只需要填邮编！
绝对不要把地址和邮编混在一起填给同一个 ID！
找准靶心前后的属性词（如电话、传真、账户），再去【公司知识库资料】里把对应的数据提取出来填进去。
数据类型校验：如果靶心紧挨着“数量”、“单价”、“总价”等词，必须填数字；紧挨着“服务项”，必须填服务名称的文本。绝对禁止在普通的文字/数字填空处插入图片 URL！
   - 引用时精炼概括，不要照搬整段文本。
多个 blank 的 `context` 即使看起来来自同一整段，也不能视为同一个问题。你必须把每个 ID 当成独立空位，只按它自己的 `【🎯】`、`field_hint`、`ordinal` 来判断。

        selected: true
        title: LLM
        type: llm
        vision:
          enabled: false
      height: 87
      id: '1774923605509'
      position:
        x: 684
        y: 281
      positionAbsolute:
        x: 684
        y: 281
      selected: true
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        outputs:
        - value_selector:
          - '1774923605509'
          - text
          value_type: string
          variable: result
        selected: false
        title: 输出
        type: end
      height: 88
      id: '1774923674869'
      position:
        x: 986
        y: 281
      positionAbsolute:
        x: 986
        y: 281
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    viewport:
      x: 155.16009321319893
      y: 36.219967641078654
      zoom: 0.7598143459468603
  rag_pipeline_variables: []
