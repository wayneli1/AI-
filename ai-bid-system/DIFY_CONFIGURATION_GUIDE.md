app:
  description: ''
  icon: 🤖
  icon_background: '#FFEAD5'
  mode: workflow
  name: 智能字段映射工作流
  use_icon_as_answer_icon: false
dependencies:
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/deepseek:0.0.11@35bcd3f233f99d07bdadef8b326945df3bda5e8f773330144bc90d84800336b9
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
      id: 1776326402237-source-1776326463037-target
      source: '1776326402237'
      sourceHandle: source
      target: '1776326463037'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1776326463037-source-1776327022582-target
      source: '1776326463037'
      sourceHandle: source
      target: '1776327022582'
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
          label: table_context
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: table_context
        - default: ''
          hint: ''
          label: blank_cells
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: blank_cells
        - default: ''
          hint: ''
          label: personnel_fields
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: personnel_fields
        - default: ''
          hint: ''
          label: table_html
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: table_html
      height: 187
      id: '1776326402237'
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
          enabled: false
          variable_selector: []
        model:
          completion_params:
            max_tokens: 8192
            temperature: 0.1
          mode: chat
          name: deepseek-chat
          provider: langgenius/deepseek/deepseek
        prompt_template:
        - id: 8d5ee15f-8363-443e-ac11-e82d3f7f0c48
          role: system
          text: "你是专业的表格填充助手，根据人员信息智能填充简历表格的空白单元格。\n\n# 输入数据\n\n**表格上下文：**\n{{#1776326402237.table_context#}}\n\
            \n**完整表格结构（HTML）：**\n{{#1776326402237.table_html#}}\n\n**需要填充的空白单元格列表：**\n\
            {{#1776326402237.blank_cells#}}\n\n**人员信息数据源：**\n{{#1776326402237.personnel_fields#}}\n\
            \n---\n\n# 任务说明\n\n1. 仔细阅读 table_html，理解表格的完整结构（包括表头、合并单元格、行列关系）\n2. 查看\
            \ blank_cells 列表，了解哪些位置（row/col）需要填充\n3. 根据每个空白单元格的 label、headerText、rowHeader\
            \ 理解其字段含义\n4. 从 personnel_fields 中提取对应的值进行填充\n5. 为每个空白单元格返回填充结果\n\n---\n\
            \n# 字段映射规则\n\n基本信息字段：\n- 姓名/名字 → name\n- 性别 → gender\n- 学历 → education\n\
            - 学位 → degree\n- 专业 → major\n- 毕业学校/院校/毕业院校 → school\n- 职称/资格/专业技术职称 →\
            \ title\n- 职务/职位 → job_title\n- 电话/联系方式/手机 → phone\n- 身份证号/身份证 → id_number\n\
            - 出生日期/出生年月 → birth_date\n- 工作单位/机构/单位 → organization\n\n项目经历字段：\n- 从\
            \ personnel_fields.custom_fields.job_positions 数组中查找对应职位\n- 从该职位的 experiences\
            \ 数组中提取项目信息\n- 按 row 号分配不同项目：\n  * row=1 → experiences[0]（第1个项目）\n  *\
            \ row=2 → experiences[1]（第2个项目）\n  * row=3 → experiences[2]（第3个项目）\n-\
            \ 项目字段映射：\n  * 项目名称 → project_name\n  * 时间/起止时间 → time_range（数组格式：[\"\
            2020-01\", \"2021-12\"]）\n  * 角色/担任角色 → role\n  * 项目描述/工作内容 → description\n\
            \n---\n\n# 处理规则\n\n1. **必须为每个空白单元格返回填充结果**（即使无法确定值也要返回空字符串 \"\"）\n2. **保持原有的\
            \ row 和 col 信息不变**\n3. 注意 table_html 中的合并单元格（rowspan/colspan），理解其语义关系\n\
            4. 使用 table_context 理解表格的整体用途（如\"项目负责人简历表\"）\n5. 对于时间范围字段，如果 time_range\
            \ 是数组格式，转换为字符串（如\"2020-01至2021-12\"）\n6. 对于找不到对应值的字段，返回空字符串 \"\"，不要返回\
            \ null 或省略\n\n---\n\n# 输出格式\n\n**严格按照以下 JSON 格式输出，不要添加任何 markdown 标记（如\
            \ ```json）或其他文本：**\n\n{\n  \"fills\": [\n    {\n      \"row\": 1,\n  \
            \    \"col\": 2,\n      \"label\": \"姓名\",\n      \"header\": \"姓名\",\n\
            \      \"value\": \"张三\"\n    },\n    {\n      \"row\": 1,\n      \"col\"\
            : 4,\n      \"label\": \"性别\",\n      \"header\": \"性别\",\n      \"value\"\
            : \"男\"\n    },\n    {\n      \"row\": 2,\n      \"col\": 2,\n      \"\
            label\": \"项目名称\",\n      \"header\": \"项目名称\",\n      \"value\": \"某某工程项目\"\
            \n    }\n  ]\n}\n\n---\n\n# 输出要求\n\n1. 只输出纯 JSON，不要包含任何其他文本或标记\n2. 确保\
            \ JSON 格式正确，可以被解析\n3. fills 数组中的每个对象必须包含：row, col, label, header, value\n\
            4. value 必须是字符串类型，空值用 \"\"（不要用 null）\n5. 不要省略任何空白单元格，即使无法确定值也要返回"
        selected: true
        title: LLM
        type: llm
        vision:
          enabled: false
      height: 88
      id: '1776326463037'
      position:
        x: 382
        y: 282
      positionAbsolute:
        x: 382
        y: 282
      selected: true
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        outputs:
        - value_selector:
          - '1776326463037'
          - text
          value_type: string
          variable: mappings
        selected: false
        title: 输出
        type: end
      height: 88
      id: '1776327022582'
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
      x: 0
      y: 0
      zoom: 1
  rag_pipeline_variables: []
