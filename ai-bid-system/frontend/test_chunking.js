// 测试分块策略
import { intelligentChunking, getChunkStats } from './src/utils/difyWorkflow.js';

// 模拟投标文件内容
const mockBidDocument = `
第一章 投标人基本情况

一、投标人名称：某某科技有限公司

二、法定代表人：张三

三、统一社会信用代码：91110108MA01ABCDEF

四、注册资本：5000万元人民币

五、公司类型：有限责任公司

六、注册地址：北京市海淀区中关村大街1号

七、联系电话：010-12345678

八、电子邮箱：contact@example.com

九、开户银行：中国工商银行北京分行

十、银行账号：0200001234567890123

第二章 项目概况

本项目为某某政府信息化平台建设项目，预算金额为人民币2000万元。

项目要求投标人具备以下资质：
1. 具有独立法人资格；
2. 具有信息系统集成资质；
3. 具有类似项目经验；
4. 具有良好的商业信誉。

第三章 技术要求

一、系统架构要求
系统应采用微服务架构，支持高并发访问。

二、安全性要求
系统应符合国家信息安全等级保护三级要求。

三、性能要求
系统响应时间应小于2秒，支持1000并发用户。

第四章 评分标准

一、技术方案（40分）
1. 方案完整性（10分）
2. 技术创新性（10分）
3. 可行性分析（10分）
4. 项目团队（10分）

二、商务报价（30分）
1. 报价合理性（15分）
2. 付款方式（15分）

三、企业实力（30分）
1. 企业资质（10分）
2. 项目经验（10分）
3. 售后服务（10分）

第五章 其他事项

一、投标文件递交截止时间：2024年12月31日

二、开标时间：2025年1月10日

三、联系人：李四
联系电话：13800138000
邮箱：bid@example.com
`;

console.log('🧪 测试分块策略优化\n');
console.log(`文档长度: ${mockBidDocument.length} 字符\n`);

// 测试不同分块策略
const testCases = [
  { name: '原始策略', chunkSize: 1500, overlap: 300, minChunkSize: 500, maxChunks: 20 },
  { name: '优化策略', chunkSize: 800, overlap: 200, minChunkSize: 300, maxChunks: 30 },
  { name: '小分块策略', chunkSize: 500, overlap: 100, minChunkSize: 200, maxChunks: 40 },
  { name: '语义分块', chunkSize: 800, overlap: 200, strategy: 'semantic', minChunkSize: 300, maxChunks: 30 },
  { name: '混合分块', chunkSize: 800, overlap: 200, strategy: 'hybrid', minChunkSize: 300, maxChunks: 30 }
];

testCases.forEach(testCase => {
  console.log(`\n=== ${testCase.name} ===`);
  console.log(`参数: chunkSize=${testCase.chunkSize}, overlap=${testCase.overlap}, minChunkSize=${testCase.minChunkSize}, maxChunks=${testCase.maxChunks}, strategy=${testCase.strategy || 'fixed'}`);
  
  try {
    const chunks = intelligentChunking(mockBidDocument, testCase);
    const stats = getChunkStats(chunks);
    
    console.log(`分块数量: ${stats.count}`);
    console.log(`平均大小: ${stats.avgSize} 字符`);
    console.log(`总大小: ${stats.totalSize} 字符`);
    
    // 显示分块预览
    console.log('\n分块预览:');
    chunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`  ${i + 1}. ${chunk.length} 字符: ${chunk.substring(0, 80).replace(/\n/g, ' ')}...`);
    });
    
    if (chunks.length > 3) {
      console.log(`  ... 还有 ${chunks.length - 3} 个分块`);
    }
    
    // 分析分块质量
    const qualityAnalysis = analyzeChunkQuality(chunks);
    console.log('\n分块质量分析:');
    console.log(`  有效分块: ${qualityAnalysis.validChunks}/${chunks.length}`);
    console.log(`  包含公司信息的分块: ${qualityAnalysis.hasCompanyInfo}`);
    console.log(`  平均行数: ${Math.round(qualityAnalysis.avgLines)}`);
    
  } catch (error) {
    console.error(`测试失败: ${error.message}`);
  }
});

// 分块质量分析函数
function analyzeChunkQuality(chunks) {
  let validChunks = 0;
  let hasCompanyInfo = 0;
  let totalLines = 0;
  
  chunks.forEach(chunk => {
    // 检查分块是否有效
    const lines = chunk.split('\n').filter(line => line.trim().length > 0);
    totalLines += lines.length;
    
    if (chunk.length >= 100 && lines.length >= 2) {
      validChunks++;
    }
    
    // 检查是否包含公司信息
    if (chunk.match(/公司|企业|法人|代表|地址|电话|邮箱|传真|银行|账号|信用|代码|资本|类型/i)) {
      hasCompanyInfo++;
    }
  });
  
  return {
    validChunks,
    hasCompanyInfo,
    avgLines: chunks.length > 0 ? totalLines / chunks.length : 0
  };
}

console.log('\n✅ 分块策略测试完成');