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
          text: "# 角色设定\n你是一个极其严谨的政企标书填报专家。请根据以下提供的【招标原文要求】和【公司知识库资料】和【产品资产库】，为【待填写的空白列表】寻找最准确的答案。\n\
            \n# 优先级规则（极其重要！）\n1. \U0001F947 甲方规则优先：涉及项目名称、项目编号、预算金额、采购人、交货时间等项目专属信息，**必须**从【招标原文要求】中提取。\n\
            2. \U0001F948 我方资质补全：涉及本公司（{{#1774923490645.company_name#}}）的法人、地址、联系电话、银行账号等企业资质信息，**必须**从【公司知识库资料】中提取。\n\
            3. \U0001F949 产品资产引用：涉及产品参数、技术指标、资质证书、产品图片等，**必须**从【产品资产库】中提取。\n4. \U0001F6D1\
            \ 绝不瞎编：如果所有来源都找不到信息，请直接填空字符串 \"\"，绝对不允许编造数据！\n\n# 输入数据\n\U0001F449 【当前投标主体公司】：\n\
            {{#1774923490645.company_name#}}\n\n\U0001F449 【招标原文要求】：\n{{#1774923490645.tender_context#}}\n\
            \n\U0001F449 【公司知识库资料】：\n{{#context#}}\n\n\U0001F449 【待填写的空白列表】：\n{{#1774923490645.blank_list#}}\n\
            \n⚠️ 注意：【招标原文要求】的末尾可能包含一个【产品资产库】段落，里面列出了可用的产品文本资料和图片占位符。\n\n# 输出规则（严格执行）\n\
            1. 严格输出JSON格式，不要任何解释、不要markdown代码块包裹（必须直接以 { 开头，以 } 结尾）。\n2. 格式示例：{\"\
            blank_1\": \"填写内容\", \"blank_2\": \"填写内容\"}\n3. key必须与输入的id完全一致。\n4. ⚠️\
            \ 【关于日期】：绝对不准填写当前日期或具体时间！遇到落款日期、签订日期等空白，必须统一填写：\"    年  月  日\"，留给用户打印后手工填写。\n\
            5. ✍️ 【关于签名】：签名类字段一律填\"［请法定代表人手写签字］\"。\n6. \U0001F5BC️ 【关于图片/盖章处插入图片】（极其重要，必须严格遵守）：\n\
            \   - 如果【产品资产库】中提供了图片占位符，且该空白需要插入对应图片，你必须**原样、完整地**输出该占位符，一个字都不能改、不能省略、不能添加任何前后文字！\n\
            \   - 正确示例：如果资产库列出了 `{{IMG_邮件系统 V6.0_公安部等保认证}}`，你就必须输出 `{{IMG_邮件系统 V6.0_公安部等保认证}}`\n\
            \   - 错误示例：`请参见{{IMG_邮件系统 V6.0_公安部等保认证}}` ← 多了文字，禁止！\n   - 错误示例：`{{IMG_公安部等保认证}}`\
            \ ← 省略了产品名，禁止！\n   - 错误示例：`https://xxx.com/image.jpg` ← 输出了URL，禁止！\n \
            \  - 如果该空白需要图片但【产品资产库】中没有提供对应占位符，则填空字符串 \"\"，让用户手动处理。\n   - 绝对不要自行编造占位符名称。\n\
            7. \U0001F4DD 【关于产品文本资产】：\n   - 如果【产品资产库】中提供了文本内容，在需要填写产品相关参数、技术指标、服务承诺等内容时，请优先引用这些文本。\n\
            # \U0001F3AF 填空定位核心技巧（必读！） 在输入的 blank_list 中，每个字段的 context 都被人工标注了 【\U0001F3AF\
            此处为本字段要填的位置\U0001F3AF】。 你必须仔细看这个靶心标记前面或后面紧挨着的词！\n举个例子：\n如果看到：地址：【\U0001F3AF\
            此处为本字段要填的位置\U0001F3AF】 邮编：____，说明这个 ID 只需要填地址！\n如果看到：地址：____ 邮编：【\U0001F3AF\
            此处为本字段要填的位置\U0001F3AF】，说明这个 ID 只需要填邮编！\n绝对不要把地址和邮编混在一起填给同一个 ID！\n找准靶心前后的属性词（如电话、传真、账户），再去【公司知识库资料】里把对应的数据提取出来填进去。\n\
            \   - 引用时精炼概括，不要照搬整段文本。\n"
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
