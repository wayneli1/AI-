app:
  description: ''
  icon: 🤖
  icon_background: '#FFEAD5'
  mode: workflow
  name: 招标解析
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
        targetType: document-extractor
      id: 1773977851685-source-1773978049422-target
      source: '1773977851685'
      sourceHandle: source
      target: '1773978049422'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: document-extractor
        targetType: llm
      id: 1773978049422-source-1773978083557-target
      source: '1773978049422'
      sourceHandle: source
      target: '1773978083557'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1773978083557-source-1773978117077-target
      source: '1773978083557'
      sourceHandle: source
      target: '1773978117077'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: document-extractor
        targetType: llm
      id: 1773978049422-source-1773986100934-target
      selected: false
      source: '1773978049422'
      sourceHandle: source
      target: '1773986100934'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1773986100934-source-1773978117077-target
      source: '1773986100934'
      sourceHandle: source
      target: '1773978117077'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: document-extractor
        targetType: llm
      id: 1773978049422-source-1773986673558-target
      source: '1773978049422'
      sourceHandle: source
      target: '1773986673558'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: llm
        targetType: end
      id: 1773986673558-source-1773978117077-target
      source: '1773986673558'
      sourceHandle: source
      target: '1773978117077'
      targetHandle: target
      type: custom
      zIndex: 0
    nodes:
    - data:
        selected: false
        title: 用户输入
        type: start
        variables:
        - allowed_file_extensions: []
          allowed_file_types:
          - image
          - document
          - audio
          - video
          allowed_file_upload_methods:
          - local_file
          - remote_url
          default: ''
          hint: ''
          label: tender_file
          options: []
          placeholder: ''
          required: true
          type: file
          variable: tender_file
      height: 109
      id: '1773977851685'
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
        is_array_file: false
        selected: false
        title: 文档提取器
        type: document-extractor
        variable_selector:
        - '1773977851685'
        - tender_file
      height: 104
      id: '1773978049422'
      position:
        x: 356
        y: 265
      positionAbsolute:
        x: 356
        y: 265
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        context:
          enabled: true
          variable_selector:
          - '1773978049422'
          - text
        desc: 深度解析投标文件
        model:
          completion_params:
            max_tokens: 8192
            temperature: 0.2
          mode: chat
          name: deepseek-chat
          provider: langgenius/deepseek/deepseek
        prompt_template:
        - id: 9096e4bb-07da-4a99-875a-f3faa1852cd3
          role: system
          text: '你是一位拥有 20 年经验的资深招投标法务与商务专家。请极其严谨地审阅我提供的【招标文件全文】，并深度解析，输出一份结构清晰、逻辑严密的《招标文件解读报告》。不要在开头说任何废话、开场白或自我介绍。请直接开始输出报告内容。


            👇👇👇【招标文件全文如下】👇👇👇

            {{#1773978049422.text#}}

            👆👆👆【招标文件全文结束】👆👆👆


            【输出要求】

            1. 必须严格使用标准 Markdown 输出，必须包含下面模板中的 ##、### 标题标记。

            2. 严禁输出任何 HTML 标签，包括但不限于 <br>、<div>、<table>、<span>、<p>。

            3. 不要输出总标题“招标文件解读报告”，直接从“## A. 基础审核”开始输出。

            4. 所有表格必须使用标准 GitHub Flavored Markdown 表格语法。

            5. 表格单元格内不要使用换行标签；如需表达多项内容，请用“；”或“1. 2. 3.”写在同一个单元格内。

            6. 如果原文没有相关信息，请在表格中填“未提及”或“无要求”。

            7. 提取的信息必须精准、精简。对于废标项等高风险内容，必须在文字旁标注 **[高风险]**。

            8. 不要输出任何开场白、结尾总结、免责声明或模板说明。


            【请严格按照以下 Markdown 模板输出】：


            ## A. 基础审核

            ### 1. 项目基本信息表

            | 项目要素 | 具体内容 | 备注 |

            |---|---|---|

            | 项目名称 | | |

            | 招标编号 | | |

            | 招标人 | | |

            | 招标代理机构 | | |

            | 预算金额/最高限价 | | |


            ### 2. 关键时间节点表

            | 时间节点 | 具体时间 | 重要提醒 |

            |---|---|---|

            | 招标文件发售时间 | | |

            | 投标截止时间 | | [绝对不可逾期] |

            | 开标时间 | | |

            | 投标有效期 | | |


            ## B. 资格与合规

            ### 1. 资格性审查要求表

            | 审查项目 | 具体要求 | 证明材料 |

            |---|---|---|

            | 营业执照/法人资格 | | |

            | 财务状况 | | |

            | 依法缴纳税收与社保 | | |

            | 无重大违法记录 | | |

            | 特殊资质要求 | | (如行业特定许可证) |


            ## C. 评标与计分标准

            ### 1. 评分权重表

            | 评分维度 | 分值权重 | 简述 |

            |---|---|---|

            | 价格分 | | |

            | 技术分 | | |

            | 商务分 | | |


            ### 2. 核心加分项与扣分项

            | 类别 | 评分标准描述 | 难度/重要性 |

            |---|---|---|

            | 业绩要求 | | |

            | 关键技术指标 | | |


            ## D. 无效标与废标项 (极其重要)

            ### 1. 致命风险排查表

            | 风险点 | 详细描述 | 风险等级 |

            |---|---|---|

            | 格式与签章 | (未按要求签字盖章条款) | **[高风险]** |

            | 报价风险 | (超过预算等多重报价条款) | **[高风险]** |

            | 实质性响应 | (带★或▲不可偏离条款) | **[高风险]** |

            | 其他废标项 | (文件中列明的情形) | **[高风险]** |


            ## E. 总体建议与下一步行动

            | 维度 | 分析与建议 |

            |---|---|

            | 投标决策 | (给出是否建议投标的结论) |

            | 资源配置 | (建议准备哪些核心材料) |'
        selected: false
        title: LLM
        type: llm
        vision:
          enabled: false
      height: 116
      id: '1773978083557'
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
    - data:
        outputs:
        - value_selector:
          - '1773978083557'
          - text
          value_type: string
          variable: report
        - value_selector:
          - '1773986673558'
          - text
          value_type: string
          variable: frame
        - value_selector:
          - '1773986100934'
          - text
          value_type: string
          variable: checklist
        selected: false
        title: 输出
        type: end
      height: 140
      id: '1773978117077'
      position:
        x: 986
        y: 282
      positionAbsolute:
        x: 986
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
          - '1773978049422'
          - text
        desc: 商务清单
        model:
          completion_params:
            max_tokens: 8192
            temperature: 0.1
          mode: chat
          name: deepseek-chat
          provider: langgenius/deepseek/deepseek
        prompt_template:
        - id: ac82822d-2cf6-473c-9a39-3fed19780b8b
          role: system
          text: '你是一位极其严谨的资深投标专员。你的任务是通读我提供的【招标文件全文】，为投标团队梳理出一份绝不遗漏的《商务资料客观材料准备清单》。不要在开头说任何废话、开场白或自我介绍。请直接开始输出报告内容。


            👇👇👇【招标文件全文如下】👇👇👇

            {{#1773978049422.text#}}

            👆👆👆【招标文件全文结束】👆👆👆


            【工作指令】

            请仔细检索全文中的“投标人资格要求”、“投标文件组成”、“评标办法/打分表”以及“附件格式”部分。将所有需要投标方人为准备、盖章、提供复印件或原件的客观材料提取出来，并按以下维度分类输出。


            【输出格式必须严格遵循以下 Markdown 模板，必须包含 ## 标题标记和标准表格】：

            额外要求：
            1. 必须严格使用标准 Markdown 输出。
            2. 严禁输出任何 HTML 标签，包括 <br>、<table>、<div> 等。
            3. 不要输出总标题“商务资料清单”，直接从“## 一、资格要求和符合性审查材料”开始。
            4. 每个二级标题下只能输出一个标准 Markdown 表格。
            5. 表格单元格内不得使用换行标签；如需列举多个材料，请使用“；”分隔。
            6. 如果某类没有内容，也要保留标题和表头，并填写“未提及”。
            7. 不要输出解释性引导语或总结语。


            ## 一、资格要求和符合性审查材料

            | 资料名称 | 资料内容/要求 | 说明/出处 |

            |---|---|---|

            | (提取营业执照等) | (具体年份或盖章要求) | (如：开标前三个月内) |


            ## 二、投标报价核心文件

            | 资料名称 | 资料内容/要求 | 说明/出处 |

            |---|---|---|

            | (如：开标一览表) | (密封或份数要求) | (如：单独密封) |


            ## 三、客观材料加分项 (核心)

            | 资料名称 | 资料内容/要求 | 说明/出处 |

            |---|---|---|

            | (证明业绩的合同等) | (具体得分规则) | (如：每提供一份得2分) |


            ## 四、其他资料与声明函

            | 资料名称 | 资料内容/要求 | 说明/出处 |

            |---|---|---|

            | (中小企业声明函等) | (细节要求) | (类似近三个月社保等隐藏要求) |'
        selected: false
        title: LLM 2
        type: llm
        vision:
          enabled: false
      height: 116
      id: '1773986100934'
      position:
        x: 684
        y: 436
      positionAbsolute:
        x: 684
        y: 436
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    - data:
        context:
          enabled: true
          variable_selector:
          - '1773978049422'
          - text
        desc: 投标格式
        model:
          completion_params:
            max_tokens: 8192
            temperature: 0.1
          mode: chat
          name: deepseek-chat
          provider: langgenius/deepseek/deepseek
        prompt_template:
        - id: 0dc02a49-0e84-4165-a779-5ec445ca1a41
          role: system
          text: '你是一位极其负责的标书编制专家。你的任务是通读【招标文件全文】，将其中要求的【投标文件格式】（通常在附件部分）进行全量提取和还原。不要在开头说任何废话、开场白或自我介绍。请直接开始输出报告内容。


            👇👇👇【招标文件全文如下】👇👇👇

            {{#1773978049422.text#}}

            👆👆👆【招标文件全文结束】👆👆👆

            【深度提取指令】 1. 全面检索：从全文中寻找名为“投标文件格式”、“附件”章节 。 2. 内容还原：不仅仅是列出标题，必须将每一个附件（如附件一至附件十七）的具体正文内容、表格结构、填空说明、落款要求完整地提取出来
            。 3. 格式转换：


            将文档中的表格转换为标准 Markdown 表格，严禁输出 HTML 标签。

            将需要填空的地方留空，不要删除或者增加额外东西。

            将签名、盖章的位置明确标注。 4. 逻辑补全：如果招标文件中要求“技术标自拟格式”，请根据评标标准中的技术得分项（如：应急响应、维保方案、培训方案），贴心地为用户拟定出对应的技术标二级、三级目录
            。


            【输出要求】

            1. 必须严格使用标准 Markdown 输出，严禁输出 <br>、<div>、<table> 等任何 HTML 标签。

            2. 不要输出总标题“投标文件完整框架”或“投标文件完整框架（草稿）”，直接输出正文结构。

            3. 标题层级必须使用 Markdown 标题标记：#, ##, ###。

            4. 不要输出“以下是整理结果”“根据招标文件整理如下”等说明性文字。

            5. 只保留原文结构、附件模板、填空说明、签章说明和技术标建议目录，不要额外分析点评。


            【输出结构】

            # 第一部分：商务/资格证明文件内容

            (此处开始全量输出附件一、附件二等的内容...)

            # 第二部分：技术方案建议目录

            (此处根据评标标准拟定技术标大纲...)'
        selected: true
        title: LLM 3
        type: llm
        vision:
          enabled: false
      height: 116
      id: '1773986673558'
      position:
        x: 684
        y: 100.68049208922713
      positionAbsolute:
        x: 684
        y: 100.68049208922713
      selected: true
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
    viewport:
      x: -122.94911956350597
      y: 200.73388429416974
      zoom: 0.7578582832551997
  rag_pipeline_variables: []
