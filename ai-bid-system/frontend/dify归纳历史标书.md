app:
  description: ''
  icon: 🤖
  icon_background: '#E0EAFF'
  mode: workflow
  name: 历史标书归纳
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
      id: 1775791623582-source-1775791697696-target
      source: '1775791623582'
      sourceHandle: source
      target: '1775791697696'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1775791697696-source-1775791993264-target
      source: '1775791697696'
      sourceHandle: source
      target: '1775791993264'
      targetHandle: target
      type: custom
      zIndex: 0
    nodes:
    - data:
        selected: true
        title: 用户输入
        type: start
        variables:
        - default: ''
          hint: ''
          label: slot_name
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: slot_name
        - default: ''
          hint: ''
          label: slot_type
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: slot_type
        - default: ''
          hint: ''
          label: chapter_path
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: chapter_path
        - hint: ''
          label: samples_text
          options: []
          placeholder: ''
          required: true
          type: text-input
          variable: samples_text
      height: 187
      id: '1775791623582'
      position:
        x: 80
        y: 282
      positionAbsolute:
        x: 80
        y: 282
      selected: true
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
            temperature: 0.7
          mode: chat
          name: deepseek-chat
          provider: langgenius/deepseek/deepseek
        prompt_template:
        - role: system
          text: "你是企业标书标准内容归纳助手。\n\n你的任务不是创作新内容，也不是保留历史项目细节，而是把“同一个固定模板槽位”的多个历史样本，归纳成一版企业可复用的标准内容。\n\
            \n必须遵守以下规则：\n1. 只输出最终标准内容，不要解释，不要加标题，不要加说明。\n2. 删除、泛化或替换所有历史项目专属信息，包括但不限于：\n\
            \   - 项目名称\n   - 招标人/采购人/建设单位名称\n   - 日期\n   - 金额\n   - 编号\n   - 特定案例名称\n\
            3. 保留企业通用能力、承诺、流程、标准写法。\n4. 如果槽位类型是 field，只输出最稳定、最适合作为默认值的一项内容，不要输出多个候选。\n\
            5. 如果样本不足或质量一般，输出要保守，不要虚构新事实。\n6. 输出内容要适合后续直接放入标书模板中使用。\n7. 禁止输出“根据以上内容总结”“标准版如下”之类说明性语言。"
        - id: 1332bb3b-2d9a-481c-8eed-54fb84555736
          role: user
          text: '请归纳以下固定模板槽位的历史样本，输出一版可复用标准内容。


            槽位名称：

            {{#1775791623582.slot_name#}}


            槽位类型：

            {{#1775791623582.slot_type#}}


            章节路径：

            {{#1775791623582.chapter_path#}}


            历史样本：

            {{#1775791623582.samples_text#}}'
        selected: false
        title: LLM
        type: llm
        vision:
          enabled: false
      height: 88
      id: '1775791697696'
      position:
        x: 382
        y: 283
      positionAbsolute:
        x: 382
        y: 283
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        outputs:
        - value_selector:
          - '1775791697696'
          - text
          value_type: string
          variable: result
        selected: false
        title: 输出
        type: end
      height: 88
      id: '1775791993264'
      position:
        x: 684
        y: 283
      positionAbsolute:
        x: 684
        y: 283
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    viewport:
      x: 0
      y: 0
      zoom: 1
  rag_pipeline_variables: []
