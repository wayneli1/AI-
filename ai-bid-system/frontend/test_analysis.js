// 测试跨文档分析函数
import { analyzeCrossDocumentFrequency } from './src/utils/difyExtractor.js';

const testResults = [
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '注册资本', value: '500万元' }
    ]
  },
  {
    fields: [
      { key: '法定代表人', value: '张三' },
      { key: '注册资本', value: '500万元' }
    ]
  }
];

try {
  const analysis = analyzeCrossDocumentFrequency(testResults);
  console.log('测试分析结果:');
  console.log(JSON.stringify(analysis, null, 2));
  
  // 检查字段
  console.log('\n字段详情:');
  analysis.forEach(item => {
    console.log(`字段 ${item.key}:`);
    console.log(`  frequencyNumber: ${item.frequencyNumber} (类型: ${typeof item.frequencyNumber})`);
    console.log(`  consistent: ${item.consistent} (类型: ${typeof item.consistent})`);
    console.log(`  包含frequencyNumber: ${'frequencyNumber' in item}`);
    console.log(`  包含consistent: ${'consistent' in item}`);
  });
} catch (error) {
  console.error('测试失败:', error);
}