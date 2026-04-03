// 测试脚本 - 验证跨文档分析功能
import { analyzeCrossDocumentFrequency, mockCrossDocumentAnalysis } from './difyExtractor.js';

// 测试数据
const testResults = [
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '注册资本', value: '500万元' },
      { key: '联系电话', value: '13800138000' },
      { key: '公司地址', value: '北京市朝阳区' }
    ]
  },
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '注册资本', value: '500万元' },
      { key: '项目经理', value: '李四' },
      { key: '联系电话', value: '13800138000' }
    ]
  },
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '公司地址', value: '北京市朝阳区' },
      { key: '统一社会信用代码', value: '91110108MA01ABCDEF' }
    ]
  },
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '注册资本', value: '500万元' },
      { key: '开户银行', value: '中国工商银行' }
    ]
  },
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '公司地址', value: '北京市海淀区' }, // 不一致的值
      { key: '电子邮箱', value: 'contact@example.com' }
    ]
  }
];

console.log('🧪 开始测试跨文档分析功能...\n');

// 测试真实分析
console.log('📊 真实分析结果：');
const analysis = analyzeCrossDocumentFrequency(testResults);
analysis.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.key}: ${item.value}`);
  console.log(`   频率: ${item.frequency}, 一致: ${item.consistent ? '✅' : '❌'}`);
  if (item.allValues.length > 1) {
    console.log(`   不同值: ${item.allValues.map(v => `${v.value}(${v.count}次)`).join(', ')}`);
  }
  console.log('');
});

// 测试模拟分析
console.log('🎭 模拟分析结果：');
const mockAnalysis = mockCrossDocumentAnalysis();
mockAnalysis.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.key}: ${item.value} (${item.frequency})`);
});

console.log('\n✅ 测试完成！');

// 统计结果
const highFreqFields = analysis.filter(item => item.frequencyNumber >= 3);
const consistentFields = analysis.filter(item => item.consistent);

console.log('\n📈 统计信息：');
console.log(`总字段数: ${analysis.length}`);
console.log(`高频字段(≥3次): ${highFreqFields.length}`);
console.log(`一致字段: ${consistentFields.length}`);
console.log(`推荐保存字段: ${analysis.filter(item => item.frequencyNumber >= 2 && item.consistent).length}`);