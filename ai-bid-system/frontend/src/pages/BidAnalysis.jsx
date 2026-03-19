import React from 'react';
import { BarChart3, TrendingUp, Target, CheckCircle, AlertTriangle, PieChart } from 'lucide-react';

const BidAnalysis = () => {
  const analysisData = [
    { category: '技术方案', score: 85, average: 72, trend: 'up' },
    { category: '价格合理性', score: 92, average: 78, trend: 'up' },
    { category: '公司资质', score: 78, average: 80, trend: 'down' },
    { category: '售后服务', score: 88, average: 75, trend: 'up' },
    { category: '交付周期', score: 70, average: 68, trend: 'up' },
  ];

  const requirements = [
    { text: 'ISO9001质量体系认证', status: 'met', critical: true },
    { text: '3年以上行业经验', status: 'met', critical: true },
    { text: '项目负责人具备高级职称', status: 'unmet', critical: true },
    { text: '提供3个类似项目案例', status: 'met', critical: false },
    { text: '7×24小时技术支持', status: 'met', critical: false },
    { text: '30天交付周期', status: 'unmet', critical: true },
  ];

  const strengths = [
    '技术方案得分较高，创新点突出',
    '价格优势明显，性价比高',
    '售后服务完善，响应速度快',
  ];

  const weaknesses = [
    '公司资质方面缺少特定认证',
    '交付周期较长，需优化生产流程',
    '项目负责人资质不符合要求',
  ];

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mr-4">
              <BarChart3 size={24} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">86.4</div>
              <div className="text-sm text-gray-500">综合得分</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-green-600 flex items-center">
            <TrendingUp size={12} className="mr-1" />
            较上月提升 5.2%
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mr-4">
              <Target size={24} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">85%</div>
              <div className="text-sm text-gray-500">通过率</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-green-600">高于行业平均 12%</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mr-4">
              <CheckCircle size={24} className="text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">28</div>
              <div className="text-sm text-gray-500">已满足要求</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500">总计 32 项要求</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center mr-4">
              <AlertTriangle size={24} className="text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">4</div>
              <div className="text-sm text-gray-500">未满足要求</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-red-600">其中 3 项为关键要求</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 评分分析 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">各维度评分</h3>
            <PieChart size={20} className="text-gray-400" />
          </div>
          <div className="space-y-4">
            {analysisData.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{item.category}</span>
                  <div className="flex items-center">
                    <span className="font-bold text-gray-900">{item.score}分</span>
                    <span className="ml-2 text-xs text-gray-500">（平均 {item.average}分）</span>
                    {item.trend === 'up' ? (
                      <span className="ml-2 text-xs text-green-600 flex items-center">
                        <TrendingUp size={10} className="mr-1" /> 优异
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-red-600 flex items-center">
                        <TrendingUp size={10} className="mr-1 rotate-180" /> 需改进
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    style={{ width: `${item.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 要求符合情况 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">招标要求符合情况</h3>
          <div className="space-y-3">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  {req.status === 'met' ? (
                    <CheckCircle size={16} className="text-green-500 mr-3" />
                  ) : (
                    <AlertTriangle size={16} className="text-red-500 mr-3" />
                  )}
                  <span className={`text-sm ${req.critical ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                    {req.text}
                    {req.critical && <span className="ml-2 text-xs text-red-600">（关键）</span>}
                  </span>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${req.status === 'met' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {req.status === 'met' ? '已满足' : '未满足'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 优劣势分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mr-3">
              <TrendingUp size={18} className="text-green-600" />
            </div>
            优势分析
          </h3>
          <ul className="space-y-3">
            {strengths.map((strength, index) => (
              <li key={index} className="flex items-start">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                </div>
                <span className="text-gray-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mr-3">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            待改进项
          </h3>
          <ul className="space-y-3">
            {weaknesses.map((weakness, index) => (
              <li key={index} className="flex items-start">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                </div>
                <span className="text-gray-700">{weakness}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-bold">建议：</span> 
              尽快补充项目负责人高级职称认证，优化生产流程缩短交付周期。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidAnalysis;