app:
  description: ''
  icon: 🤖
  icon_background: '#FFEAD5'
  mode: workflow
  name: 招标文件空白扫描
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
        targetType: llm
      id: 1774926704614-source-1774926729150-target
      source: '1774926704614'
      sourceHandle: source
      target: '1774926729150'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1774926729150-source-1774926763293-target
      source: '1774926729150'
      sourceHandle: source
      target: '1774926763293'
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
          label: paragraphs_text
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: paragraphs_text
      height: 108
      id: '1774926704614'
      position:
        x: 80
        y: 282
      positionAbsolute:
        x: 80
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        context:
          enabled: true
          variable_selector:
          - '1774926704614'
          - paragraphs_text
        model:
          completion_params:
            max_tokens: 65501
            temperature: 0.1
          mode: chat
          name: qwen3.5-plus
          provider: langgenius/tongyi/tongyi
        prompt_template:
        - id: daa352a9-98ff-423d-a7b7-60c6a959d1a0
          role: system
          text: "# 角色设定\n你是一个极其严谨、专业的企业级招标文件“填空位”解析引擎。你的唯一任务是精准穿透传入的 JSON 文本段落，找出所有需要由用户或\
            \ AI 填写的“空白占位符”，并为它们进行“精准的分类打标”。\n\n# \U0001F6D1 核心过滤与分类打标（fill_role 规则）\n\
            这是你最重要的任务！对于每一个你提取出的空白，你必须根据其前后的上下文语义，判定它的 `fill_role`（填写角色）：\n\n\U0001F7E2\
            \ \"auto\"（优先允许AI自动复用）：\n原则上，只要是可以通过企业通用资料库查到的信息，都标记为 auto。\n包括但不限于：供应商名称、公司名称、单位、法定代表人、授权代表、地址、邮编、电话、传真、联系人、开户银行、银行账号、开户行、税号、统一社会信用代码、营业执照、资质证书等。（⚠️\
            \ 如果拿不准，优先标记为 auto，交由下游系统尝试匹配）\n\n\U0001F534 \"manual\"（严禁AI触碰，强制人工填写）：\n\
            凡是涉及项目特异性、商业核心机密的，必须死死锁住，标记为 manual！上下文包含以下线索时标记为 manual：\n1. 钱与报价：报价、总价、单价、合计、金额、合同价、费率、大写、小写、元、人民币等。\n\
            2. 技术与响应：技术偏离度、参数说明、人员派遣名单、交货期、质保期等。\n\n# \U0001F50D 扫描识别规则与锚点法则\n请仔细提取以下形态的空白：\n\
            1. 【线条类】：明显的下划线 `_________` 或破折号 `--------`。\n2. 【占位符类】：具有填空暗示的括号或词汇，如\
            \ `（盖章处）`、`（请填写）`、`[填写公司名称]`、`待补充`、`待定`。\n3. 【隐形空格类】：带有明确引导词且后面跟着连续空格的（如\
            \ `开户行：      `）。\n   - ⚠️ **极其重要**：提取 `matchText` 时，**绝对不允许把冒号和前面的文字提取进去！**\
            \ - 错误提取：`\"matchText\": \"开户行：      \"`\n   - 正确提取：`\"matchText\": \"\
            \      \"`（只提取空格），然后 `context` 完整保留原句。\n4. 【锚点依赖法则（防垃圾噪音）】：任何被提取的纯空格空白，其左侧或右侧必须有明确的“属性名词”（如“名称：”）。纯粹为了排版产生的连续空格，坚决忽略，绝不提取！\n\
            \n# \U0001F6A8 严格执行的纪律\n1. **纯净输出**：必须且只能输出一个合法的 JSON 数组，**绝对不允许**包含 Markdown\
            \ 格式（如 ```json ），**绝对不允许**有任何解释性废话。\n2. **原样提取**：`matchText` 必须是 `context`\
            \ 中完全一致的子字符串，连一个半角空格都不能多或少！\n3. **排除干扰**：忽略页码（如 `第 1 页`）、目录（如 `第一章.....1`）等非填写项。\n\
            4. \U0001F6D1 **绝对封杀日期提取**：绝对不要提取任何落款日期、签订日期（如 `____年__月__日` 或 `202_年_月_日`），将其视为普通文本直接放过！绝不允许出现在输出的\
            \ JSON 中！\n\n# 输出格式规范\n返回一个 JSON 数组，结构如下：\n[\n  {\n    \"paraIndex\":\
            \ 0, // 必须与输入的索引完全一致\n    \"context\": \"完整的段落文本内容\",\n    \"matchText\"\
            : \"精确匹配到的空白占位符原文\",\n    \"type\": \"空白类型（underscore / dash / brackets\
            \ / keyword_space / placeholder）\",\n    \"fill_role\": \"auto 或 manual\"\
            , \n    \"confidence\": \"high\" // 识别置信度（high/medium/low）\n  }\n]\n\n\
            # 示例参考\n输入数据示例：\n[\n  { \"paraIndex\": 0, \"text\": \"投标人名称：_________\"\
            \ },\n  { \"paraIndex\": 1, \"text\": \"投标总报价：________元\" },\n  { \"paraIndex\"\
            : 2, \"text\": \"法定代表人：       \" },\n  { \"paraIndex\": 3, \"text\": \"\
            日期：____年__月__日\" }\n]\n\n输出数据示例：\n[\n  {\n    \"paraIndex\": 0,\n    \"\
            context\": \"投标人名称：_________\",\n    \"matchText\": \"_________\",\n \
            \   \"type\": \"underscore\",\n    \"fill_role\": \"auto\",\n    \"confidence\"\
            : \"high\"\n  },\n  {\n    \"paraIndex\": 1,\n    \"context\": \"投标总报价：________元\"\
            ,\n    \"matchText\": \"________\",\n    \"type\": \"underscore\",\n \
            \   \"fill_role\": \"manual\",\n    \"confidence\": \"high\"\n  },\n \
            \ {\n    \"paraIndex\": 2,\n    \"context\": \"法定代表人：       \",\n    \"\
            matchText\": \"       \",\n    \"type\": \"keyword_space\",\n    \"fill_role\"\
            : \"auto\",\n    \"confidence\": \"high\"\n  }\n  // 注意：paraIndex为3的日期段落被完全忽略，没有被提取！\n\
            ]\n\n请严格按照上述规则，开始扫描传入的段落数据{{#1774926704614.paragraphs_text#}}并直接输出 JSON\
            \ 数组。"
        selected: true
        title: LLM
        type: llm
        vision:
          enabled: false
      height: 87
      id: '1774926729150'
      position:
        x: 381
        y: 282
      positionAbsolute:
        x: 381
        y: 282
      selected: true
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        outputs:
        - value_selector:
          - '1774926729150'
          - text
          value_type: string
          variable: text
        selected: false
        title: 输出
        type: end
      height: 88
      id: '1774926763293'
      position:
        x: 684
        y: 282
      positionAbsolute:
        x: 684
        y: 282
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    viewport:
      x: -2
      y: -1
      zoom: 1
  rag_pipeline_variables: []
