import React from 'react';
import { Search, Grid, List, Filter, Download, Eye, Edit, Trash2, FileText, Calendar, Tag, MoreVertical, Share2 } from 'lucide-react';

const MyBids = () => {
  const bids = [
    {
      id: 1,
      name: 'XX智慧城市项目',
      projectCode: 'PROJ-2024-001',
      status: '进行中',
      statusColor: 'bg-blue-100 text-blue-800',
      progress: 75,
      lastModified: '2024-03-19 14:30',
      size: '2.4 MB',
      type: '技术方案',
    },
    {
      id: 2,
      name: 'YY数据中心建设',
      projectCode: 'PROJ-2024-002',
      status: '已完成',
      statusColor: 'bg-green-100 text-green-800',
      progress: 100,
      lastModified: '2024-03-18 09:15',
      size: '3.1 MB',
      type: '商务标',
    },
    {
      id: 3,
      name: 'ZZ网络升级项目',
      projectCode: 'PROJ-2024-003',
      status: '待审核',
      statusColor: 'bg-yellow-100 text-yellow-800',
      progress: 90,
      lastModified: '2024-03-17 16:45',
      size: '1.8 MB',
      type: '技术方案',
    },
    {
      id: 4,
      name: 'AA安全系统采购',
      projectCode: 'PROJ-2024-004',
      status: '草稿',
      statusColor: 'bg-gray-100 text-gray-800',
      progress: 30,
      lastModified: '2024-03-16 11:20',
      size: '0.9 MB',
      type: '综合标',
    },
    {
      id: 5,
      name: 'BB云平台部署',
      projectCode: 'PROJ-2024-005',
      status: '已提交',
      statusColor: 'bg-purple-100 text-purple-800',
      progress: 100,
      lastModified: '2024-03-15 10:10',
      size: '4.2 MB',
      type: '技术方案',
    },
  ];

  const [viewMode, setViewMode] = React.useState('grid'); // 'grid' 或 'list'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* 页面标题和新建按钮 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <p className="text-gray-500 text-sm mt-1">管理您的所有标书项目</p>
        </div>
        <button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center">
          <FileText size={18} className="mr-2" />
          新建标书
        </button>
      </div>

      {/* 搜索与视图切换工具栏 */}
      <div className="flex justify-between items-center mb-8">
        {/* 左侧：搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="请输入方案名称"
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50/50"
          />
        </div>

        {/* 右侧：功能图标 */}
        <div className="flex items-center space-x-3">
          {/* 视图切换 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            >
              <Grid size={20} className={viewMode === 'grid' ? 'text-purple-600' : 'text-gray-500'} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            >
              <List size={20} className={viewMode === 'list' ? 'text-purple-600' : 'text-gray-500'} />
            </button>
          </div>
        </div>
      </div>

      {/* 项目网格区域 */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {bids.map((bid) => (
            <div key={bid.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
              {/* 卡片头部 */}
              <div className="p-5 border-b border-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mr-3">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 truncate max-w-[180px]">{bid.name}</h3>
                      <p className="text-xs text-gray-500">{bid.projectCode}</p>
                    </div>
                  </div>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={18} />
                  </button>
                </div>
                
                {/* 状态标签 */}
                <div className="flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${bid.statusColor}`}>
                    {bid.status}
                  </span>
                  <span className="text-xs text-gray-500">{bid.type}</span>
                </div>
              </div>

              {/* 卡片内容 */}
              <div className="p-5">
                {/* 进度条 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">完成进度</span>
                    <span className="font-medium text-gray-900">{bid.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${bid.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* 文件信息 */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <Calendar size={14} className="mr-2 text-gray-400" />
                    <span>最后修改: {bid.lastModified}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Tag size={14} className="mr-2 text-gray-400" />
                    <span>文件大小: {bid.size}</span>
                  </div>
                </div>
              </div>

              {/* 卡片底部操作栏 */}
              <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/50">
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye size={18} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                      <Edit size={18} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <Share2 size={18} />
                    </button>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // 列表视图（保留原有表格样式）
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">标书名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">项目编号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">进度</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">最后修改</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">类型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <FileText size={20} className="text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium text-gray-900">{bid.name}</div>
                        <div className="text-xs text-gray-500">{bid.size}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-700">{bid.projectCode}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${bid.statusColor}`}>
                      {bid.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full" 
                          style={{ width: `${bid.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-700">{bid.progress}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar size={14} className="mr-2" />
                      {bid.lastModified}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <Tag size={14} className="mr-2 text-gray-400" />
                      <span className="text-sm text-gray-700">{bid.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex space-x-2">
                      <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit size={16} />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100">
        <div className="text-sm text-gray-500">
          显示 1-{bids.length} 条，共 {bids.length} 条
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            上一页
          </button>
          <div className="flex space-x-1">
            <button className="w-10 h-10 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center">
              1
            </button>
            <button className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center">
              2
            </button>
            <button className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center">
              3
            </button>
            <span className="w-10 h-10 flex items-center justify-center text-gray-400">
              ...
            </span>
            <button className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center">
              5
            </button>
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center">
            下一页
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyBids;