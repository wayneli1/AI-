import React, { useState } from 'react';
import { Search, FileText, BookOpen, Award, Clock, Download, Eye, Share2, Tag, Filter, Grid, List, Star } from 'lucide-react';

const KnowledgeBase = () => {
  const [viewMode, setViewMode] = useState('grid');

  const documents = [
    {
      id: 1,
      title: '标书撰写规范指南',
      category: '规范文档',
      description: '详细的标书撰写规范和模板，包括技术方案、商务条款、报价策略等完整指南。',
      tags: ['规范', '模板', '写作'],
      author: '标书专家组',
      date: '2024-03-19',
      views: 1245,
      downloads: 389,
      rating: 4.9,
      icon: <FileText size={24} className="text-blue-600" />,
      color: 'bg-blue-50',
    },
    {
      id: 2,
      title: '投标法律法规汇编',
      category: '法律文件',
      description: '国内外投标相关法律法规解读和注意事项，帮助企业规避法律风险。',
      tags: ['法律', '法规', '合规'],
      author: '法务部',
      date: '2024-03-18',
      views: 987,
      downloads: 256,
      rating: 4.8,
      icon: <BookOpen size={24} className="text-green-600" />,
      color: 'bg-green-50',
    },
    {
      id: 3,
      title: '成功中标案例集',
      category: '案例分享',
      description: '历年成功中标案例分析和经验总结，包含各行业典型项目。',
      tags: ['案例', '经验', '分析'],
      author: '项目部',
      date: '2024-03-17',
      views: 1567,
      downloads: 512,
      rating: 4.9,
      icon: <Award size={24} className="text-purple-600" />,
      color: 'bg-purple-50',
    },
    {
      id: 4,
      title: '价格策略与报价技巧',
      category: '商务指导',
      description: '如何制定合理的投标价格策略和报价技巧，提高中标率。',
      tags: ['价格', '策略', '商务'],
      author: '商务部',
      date: '2024-03-16',
      views: 1123,
      downloads: 421,
      rating: 4.7,
      icon: <BookOpen size={24} className="text-yellow-600" />,
      color: 'bg-yellow-50',
    },
    {
      id: 5,
      title: '技术方案模板库',
      category: '模板资源',
      description: '各类技术方案模板和编写要点，涵盖不同行业和技术领域。',
      tags: ['技术', '模板', '方案'],
      author: '技术部',
      date: '2024-03-15',
      views: 1890,
      downloads: 689,
      rating: 4.8,
      icon: <FileText size={24} className="text-red-600" />,
      color: 'bg-red-50',
    },
    {
      id: 6,
      title: '竞争对手分析指南',
      category: '市场分析',
      description: '如何分析竞争对手和制定应对策略，提升竞争优势。',
      tags: ['竞争', '分析', '策略'],
      author: '市场部',
      date: '2024-03-14',
      views: 876,
      downloads: 234,
      rating: 4.6,
      icon: <BookOpen size={24} className="text-indigo-600" />,
      color: 'bg-indigo-50',
    },
    {
      id: 7,
      title: '投标流程标准化',
      category: '流程管理',
      description: '标准化投标流程和项目管理方法，提高投标效率和质量。',
      tags: ['流程', '管理', '标准'],
      author: '质管部',
      date: '2024-03-13',
      views: 765,
      downloads: 198,
      rating: 4.7,
      icon: <FileText size={24} className="text-teal-600" />,
      color: 'bg-teal-50',
    },
    {
      id: 8,
      title: '电子投标系统操作手册',
      category: '操作指南',
      description: '各类电子投标系统的操作指南和注意事项。',
      tags: ['系统', '操作', '指南'],
      author: '信息部',
      date: '2024-03-12',
      views: 543,
      downloads: 167,
      rating: 4.5,
      icon: <BookOpen size={24} className="text-pink-600" />,
      color: 'bg-pink-50',
    },
  ];

  const categories = ['全部', '规范文档', '法律文件', '案例分享', '商务指导', '模板资源', '市场分析', '流程管理', '操作指南'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* 工具栏 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索知识文档..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
            />
          </div>
          <div className="flex space-x-2">
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  cat === '全部' 
                    ? 'bg-purple-100 text-purple-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
            <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Filter size={16} className="mr-2" />
              更多
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
            >
              <List size={18} />
            </button>
          </div>
          <button className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            <FileText size={16} className="mr-2" />
            上传文档
          </button>
        </div>
      </div>

      {/* 文档网格 */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div key={doc.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className={`h-3 ${doc.color}`}></div>
              <div className="p-6">
                <div className="flex items-start mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${doc.color}`}>
                    {doc.icon}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500">{doc.category}</span>
                    <h3 className="font-bold text-gray-900 mt-1">{doc.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{doc.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {doc.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <div className="flex items-center">
                    <span>{doc.author}</span>
                    <span className="mx-2">•</span>
                    <Clock size={12} className="mr-1" />
                    {doc.date}
                  </div>
                  <div className="flex items-center">
                    <Star size={12} className="mr-1 text-yellow-500" />
                    {doc.rating}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Eye size={14} className="mr-1" />
                      {doc.views}
                    </div>
                    <div className="flex items-center">
                      <Download size={14} className="mr-1" />
                      {doc.downloads}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
                      <Download size={16} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg">
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 列表视图 */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">文档信息</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">分类</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">标签</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">作者</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">日期</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">热度</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${doc.color}`}>
                        {doc.icon}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{doc.title}</div>
                        <div className="text-sm text-gray-500 mt-1 line-clamp-1">{doc.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {doc.category}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{doc.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-700">{doc.author}</td>
                  <td className="py-4 px-4 text-sm text-gray-700">{doc.date}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-900">{doc.views}</div>
                      <div className="mx-2 text-gray-300">|</div>
                      <div className="flex items-center text-yellow-600">
                        <Star size={12} className="mr-1" />
                        {doc.rating}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex space-x-2">
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
                        <Download size={16} />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg">
                        <Share2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 知识库统计 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
              <div className="text-sm text-gray-600 mt-1">文档总数</div>
            </div>
            <FileText size={24} className="text-blue-600" />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            最近更新：{documents[0].date}
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {documents.reduce((sum, doc) => sum + doc.views, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mt-1">总浏览次数</div>
            </div>
            <Eye size={24} className="text-green-600" />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            日均访问：{Math.round(documents.reduce((sum, doc) => sum + doc.views, 0) / 30)} 次
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {documents.reduce((sum, doc) => sum + doc.downloads, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mt-1">总下载次数</div>
            </div>
            <Download size={24} className="text-purple-600" />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            最受欢迎：{documents.sort((a, b) => b.downloads - a.downloads)[0].title}
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {(documents.reduce((sum, doc) => sum + doc.rating, 0) / documents.length).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">平均评分</div>
            </div>
            <Star size={24} className="text-yellow-600" />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            共 {documents.length} 份文档参与评分
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;