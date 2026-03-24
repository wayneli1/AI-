import React, { useState } from 'react';
import { Button, Input, message } from 'antd';
import { UploadCloud, ArrowLeft, Save, Download, Search, Wand2 } from 'lucide-react';

export default function CreateBid() {
  // 状态管理
  const [isUploaded, setIsUploaded] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(1);
  
  // Mock数据 - 招标文件原文
  const originalText = `招标文件

项目名称：智慧城市大数据平台建设项目
招标编号：ZC-2025-0382
招标人：XX市大数据管理局
招标代理机构：XX招标有限公司

第一章 投标邀请

1.1 项目概况
XX市大数据管理局拟建设智慧城市大数据平台，整合全市政务数据、社会数据、物联网数据，构建城市级数据资源池，支撑城市运行管理、公共服务、产业发展等应用。

1.2 招标范围
本次招标包括以下内容：
（1）大数据平台基础软件采购与部署
（2）数据采集与治理系统开发
（3）数据共享交换平台建设
（4）数据分析与可视化系统
（5）平台运维保障体系

1.3 项目预算
本项目预算为人民币伍仟捌佰万元整（¥58,000,000.00）。

1.4 投标人资格要求
（1）具有独立法人资格，注册资本不低于5000万元；
（2）具有大数据平台相关项目案例（提供合同复印件）；
（3）通过ISO9001质量管理体系认证；
（4）项目负责人需具备高级工程师职称；
（5）近三年无重大违法记录。

1.5 技术评分标准
1. 技术方案先进性（30分）
   - 架构设计的合理性、可扩展性
   - 技术路线的前瞻性
   - 数据治理能力
   
2. 项目实施方案（25分）
   - 实施计划的科学性
   - 风险控制措施
   - 质量保证体系
   
3. 项目团队实力（20分）
   - 团队人员资质
   - 项目经理经验
   - 技术专家配置
   
4. 售后服务承诺（15分）
   - 服务响应时间
   - 技术支持能力
   - 培训方案
   
5. 类似业绩（10分）
   - 同类项目数量
   - 项目规模与质量

1.6 废标条款
出现以下情况之一，将作废标处理：
（1）投标文件未按规定密封；
（2）投标报价超过预算；
（3）未提供有效的资格证明文件；
（4）投标文件存在虚假材料；
（5）未实质性响应招标要求。

第二章 技术要求

2.1 平台架构要求
平台应采用微服务架构，支持容器化部署，具备高可用、高并发处理能力。支持PB级数据存储，日处理数据量不低于10TB。

2.2 数据治理要求
支持多源异构数据接入，包括关系型数据库、NoSQL数据库、文件数据、流数据等。提供数据质量检查、数据标准管理、元数据管理功能。

2.3 安全要求
平台需通过三级等保测评，具备数据加密传输、访问控制、操作审计、数据脱敏等安全能力。

2.4 性能要求
（1）数据查询响应时间：简单查询<1秒，复杂查询<10秒；
（2）平台可用性：≥99.9%；
（3）并发用户数：支持≥5000并发用户；
（4）系统扩展性：支持横向扩展。

第三章 商务要求

3.1 项目周期
自合同签订之日起12个月内完成全部建设内容，并通过验收。

3.2 付款方式
（1）合同签订后支付30%预付款；
（2）项目完成部署后支付40%进度款；
（3）项目验收合格后支付25%验收款；
（4）质保期满后支付5%质保金。

3.3 售后服务
提供3年免费质保期，7×24小时技术支持，2小时内响应，4小时内到场处理紧急故障。

第四章 投标文件编制要求

4.1 投标文件组成
（1）投标函
（2）法定代表人授权书
（3）投标报价表
（4）技术方案
（5）项目实施方案
（6）项目团队介绍
（7）资格证明文件
（8）售后服务承诺
（9）其他证明材料

4.2 投标文件格式
投标文件应统一用A4纸打印，装订成册，一式八份（正本一份，副本七份），电子版一份（U盘）。

4.3 投标截止时间
2025年4月15日上午9:30（北京时间）。

4.4 开标时间
2025年4月15日上午10:00（北京时间）。

4.5 投标地点
XX市公共资源交易中心三楼开标室。

注意事项：
1. 投标人须仔细阅读本招标文件全部内容，按要求编制投标文件；
2. 如有疑问，请在2025年4月8日前书面提出；
3. 招标人保留对本招标文件解释和修改的权利。

XX市大数据管理局
2025年3月24日`;

  // Mock数据 - 大纲节点
  const [outline, setOutline] = useState([
    {
      id: 1,
      title: '一、投标函',
      content: '致：XX市大数据管理局\n\n我方确认已仔细阅读并完全理解《智慧城市大数据平台建设项目》（招标编号：ZC-2025-0382）招标文件的所有内容，愿意接受招标文件中的各项要求，并承诺：\n\n1. 投标总价为人民币伍仟柒佰捌拾万元整（¥57,800,000.00），详细报价见投标报价表；\n2. 投标有效期自开标之日起90个日历日；\n3. 完全响应招标文件中的技术要求、商务条款及服务承诺；\n4. 如中标，将按规定签订合同并严格执行。\n\n投标人：XX科技有限公司\n法定代表人：张三\n日期：2025年3月24日'
    },
    {
      id: 2,
      title: '二、公司资质与简介',
      content: '## 2.1 公司概况\nXX科技有限公司成立于2015年，注册资本8000万元，是一家专注于大数据与人工智能技术的高新技术企业。公司总部位于北京，在上海、广州、深圳设有分公司，员工总数500余人，其中研发人员占比65%。\n\n## 2.2 核心资质\n- 高新技术企业证书（证书编号：GR202312345678）\n- CMMI 5级认证（软件能力成熟度模型集成）\n- ISO9001质量管理体系认证\n- ISO27001信息安全管理体系认证\n- 信息系统集成资质（三级）\n- 大数据服务能力认证（国家级）\n\n## 2.3 技术实力\n公司拥有自主知识产权的「星云」大数据平台，已在政务、金融、交通等多个行业落地应用。研发团队由博士、硕士领衔，获得专利50余项，软件著作权120余项。'
    },
    {
      id: 3,
      title: '三、技术方案详细说明',
      content: '## 3.1 整体架构设计\n本项目采用「云原生+微服务」架构，基于Kubernetes容器平台部署，整体架构分为四层：\n\n1. **数据采集层**：支持多源异构数据接入，包括API接口、数据库直连、文件传输、流数据采集等。\n2. **数据存储与计算层**：采用Hadoop+Spark技术栈，支持PB级数据存储和实时计算。\n3. **数据治理层**：提供数据质量监控、元数据管理、数据标准管理、数据血缘分析等功能。\n4. **应用服务层**：基于Spring Cloud微服务框架，提供数据查询、分析、可视化等API服务。\n\n## 3.2 关键技术特点\n- **高性能**：采用列式存储和内存计算技术，查询性能提升10倍以上；\n- **高可用**：多活数据中心部署，支持自动故障切换，确保99.99%可用性；\n- **高安全**：全链路数据加密，细粒度访问控制，满足等保三级要求；\n- **易扩展**：模块化设计，支持水平扩展，可平滑升级扩容。'
    },
    {
      id: 4,
      title: '四、项目实施方案',
      content: '## 4.1 实施计划\n本项目总工期12个月，分为五个阶段实施：\n\n| 阶段 | 时间 | 主要交付物 |\n|------|------|------------|\n| 需求调研与设计 | 2个月 | 需求规格说明书、系统设计文档 |\n| 平台开发与测试 | 6个月 | 系统源代码、测试报告 |\n| 系统部署与集成 | 2个月 | 部署文档、集成测试报告 |\n| 用户培训与试运行 | 1个月 | 培训材料、试运行报告 |\n| 项目验收与移交 | 1个月 | 验收报告、运维文档 |\n\n## 4.2 项目团队配置\n本项目组建30人专项团队，包括：\n- 项目经理（1人）：PMP认证，10年以上项目管理经验；\n- 架构师（2人）：大数据领域专家，主导过多个大型项目；\n- 开发工程师（15人）：Java/Python/Scala技术栈；\n- 测试工程师（5人）：自动化测试专家；\n- 实施工程师（5人）：具备丰富的部署运维经验；\n- 文档工程师（2人）：负责技术文档编写。'
    },
    {
      id: 5,
      title: '五、质量保证措施',
      content: '## 5.1 质量管理体系\n严格执行ISO9001质量管理体系，建立四级质量保证机制：\n\n1. **需求质量**：需求双确认机制，确保需求准确无误；\n2. **设计质量**：架构评审会议，设计方案专家评审；\n3. **开发质量**：代码审查、单元测试覆盖率≥85%；\n4. **测试质量**：自动化测试覆盖率≥70%，性能测试、安全测试全面覆盖。\n\n## 5.2 风险控制措施\n- **技术风险**：采用成熟技术栈，预留技术备选方案；\n- **进度风险**：采用敏捷开发模式，每周迭代，及时调整计划；\n- **人员风险**：关键岗位AB角配置，避免人员变动影响；\n- **沟通风险**：建立定期沟通机制，周报、月报及时同步。'
    },
    {
      id: 6,
      title: '六、售后服务承诺',
      content: '## 6.1 服务内容\n1. **免费质保期**：项目验收后提供3年免费质保；\n2. **技术支持**：7×24小时电话/在线支持，建立专属服务群；\n3. **响应时间**：紧急问题30分钟内响应，2小时内提供解决方案，4小时内到场处理；\n4. **定期巡检**：每季度一次系统健康检查，出具巡检报告；\n5. **系统升级**：免费提供小版本升级，大版本升级享受优惠价格。\n\n## 6.2 培训方案\n提供不少于60人天的现场培训：\n- **系统管理员培训**（3天）：平台部署、运维、监控、故障处理；\n- **业务用户培训**（4天）：数据查询、报表制作、数据分析；\n- **开发人员培训**（3天）：API接口使用、二次开发指南。'
    },
    {
      id: 7,
      title: '七、报价文件',
      content: '## 7.1 投标报价总表\n| 项目 | 单价（万元） | 数量 | 合计（万元） |\n|------|--------------|------|--------------|\n| 大数据平台软件 | 1200 | 1套 | 1200 |\n| 数据治理系统 | 800 | 1套 | 800 |\n| 开发实施服务 | 3000 | 1项 | 3000 |\n| 硬件设备（服务器） | 500 | 4台 | 2000 |\n| 三年运维服务 | 200 | 1项 | 200 |\n| **总计** | | | **¥57,800,000.00** |\n\n## 7.2 报价说明\n1. 以上报价含税，税率6%；\n2. 报价包含运输、安装、调试、培训等所有费用；\n3. 付款方式按招标文件要求执行；\n4. 报价有效期与投标有效期一致。'
    }
  ]);

  // 查找当前选中的节点
  const activeNode = outline.find(node => node.id === activeNodeId) || outline[0];

  // 处理大纲内容更新
  const handleOutlineContentChange = (id, newContent) => {
    setOutline(outline.map(node => 
      node.id === id ? { ...node, content: newContent } : node
    ));
  };

  // AI润色当前段落
  const handleAIPolish = () => {
    message.info('AI正在润色当前段落...（模拟功能）');
    setTimeout(() => {
      const polishedContent = activeNode.content + '\n\n【AI优化建议】以上内容已优化表述，增强专业性，符合招标要求。';
      handleOutlineContentChange(activeNodeId, polishedContent);
      message.success('AI润色完成！');
    }, 1500);
  };

  // 保存草稿
  const handleSaveDraft = () => {
    message.success('草稿已保存！');
  };

  // 导出为Word
  const handleExportWord = () => {
    message.info('正在导出Word文档...（模拟功能）');
    setTimeout(() => {
      message.success('标书已导出为Word文档！');
    }, 1000);
  };

  // 模拟上传文件
  const handleUploadFile = () => {
    message.success('招标文件上传成功，开启智能分析台！');
    setIsUploaded(true);
  };

  // 未上传状态：全屏拖拽上传UI
  if (!isUploaded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            智能标书生成工作台
          </h1>
          <p className="text-gray-600 text-lg">
            上传招标文件，开启三栏智能分析体验
          </p>
        </div>
        
        <div className="relative w-full max-w-4xl">
          <label htmlFor="file-upload-drag">
            <div className="border-4 border-dashed border-gray-300 hover:border-purple-400 rounded-3xl p-20 bg-white/80 hover:bg-purple-50/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center group">
              <UploadCloud size={100} className="text-gray-400 group-hover:text-purple-500 mb-10 transition-colors" />
              <h3 className="text-3xl font-bold text-gray-900 mb-6 group-hover:text-purple-700 transition-colors">
                拖拽《招标文件》至此，开启三栏智能分析台
              </h3>
              <p className="text-gray-500 text-center text-lg max-w-2xl">
                支持 PDF、Word 格式，AI 将自动解析评分标准、废标条款，智能生成响应大纲
              </p>
            </div>
          </label>
          <input
            id="file-upload-drag"
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx"
            onChange={handleUploadFile}
          />
        </div>
        
        <div className="mt-12">
          <Button
            type="primary"
            size="large"
            onClick={handleUploadFile}
            className="h-14 px-12 text-lg font-bold"
            icon={<UploadCloud size={24} />}
          >
            模拟上传招标文件（演示用）
          </Button>
        </div>
        
        <div className="mt-16 text-gray-400 text-sm text-center max-w-2xl">
          <p>提示：上传后，您将进入三栏工作台。左侧查看招标原文，中间导航大纲节点，右侧智能编辑内容。</p>
        </div>
      </div>
    );
  }

  // 已上传状态：三栏工作台
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部导航栏 */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-white sticky top-0 z-50">
        <div className="flex items-center">
          <Button
            type="text"
            icon={<ArrowLeft size={20} />}
            onClick={() => setIsUploaded(false)}
            className="mr-4"
          >
            返回
          </Button>
          <h1 className="text-xl font-bold text-gray-900">标书生成工作台</h1>
          <div className="ml-6 text-sm text-gray-500">智慧城市大数据平台建设项目</div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            icon={<Save size={18} />}
            onClick={handleSaveDraft}
            className="h-10"
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<Download size={18} />}
            onClick={handleExportWord}
            className="h-10 bg-purple-600 hover:bg-purple-700"
          >
            导出为 Word
          </Button>
        </div>
      </div>

      {/* 主体内容区 - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：招标原文参考区 */}
        <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-lg mr-2">📄</span>
              <span className="font-semibold text-gray-900">招标文件原文</span>
            </div>
            <div className="w-48">
              <Input
                placeholder="搜索关键词..."
                prefix={<Search size={16} className="text-gray-400" />}
                size="small"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-gray-800 leading-relaxed whitespace-pre-line text-sm">
              {originalText}
            </div>
          </div>
        </div>

        {/* 中间：大纲导航栏 */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-lg mr-2">📑</span>
              <span className="font-semibold text-gray-900">响应大纲</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {outline.length} 个章节，点击切换编辑
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {outline.map((node) => (
              <div
                key={node.id}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  activeNodeId === node.id
                    ? 'bg-purple-100 text-purple-700 font-bold border-l-4 border-purple-600'
                    : 'bg-white hover:bg-gray-100 border border-gray-200'
                }`}
                onClick={() => setActiveNodeId(node.id)}
              >
                <div className="font-medium">{node.title}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {node.content.substring(0, 60)}...
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：智能编辑区 */}
        <div className="flex-1 bg-gray-50 flex flex-col relative">
          <div className="flex-1 overflow-y-auto p-8">
            <div className="bg-white shadow-lg rounded-lg p-8 max-w-4xl mx-auto w-full min-h-[800px]">
              {/* 标题区域 */}
              <div className="mb-8 pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">{activeNode.title}</h2>
                <div className="flex items-center mt-2 text-sm text-gray-500">
                  <div className="px-2 py-1 bg-gray-100 rounded">当前编辑</div>
                  <div className="ml-4">字数：{activeNode.content.length} 字符</div>
                </div>
              </div>
              
              {/* 内容编辑区 */}
              <textarea
                value={activeNode.content}
                onChange={(e) => handleOutlineContentChange(activeNodeId, e.target.value)}
                className="w-full h-[600px] resize-none outline-none text-gray-800 leading-relaxed text-base"
                placeholder="在此编辑标书内容..."
              />
            </div>
          </div>
          
          {/* 底部悬浮操作栏 */}
          <div className="absolute bottom-8 right-8">
            <Button
              type="primary"
              icon={<Wand2 size={18} />}
              onClick={handleAIPolish}
              className="h-12 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
            >
              ✨ AI 润色当前段落
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}