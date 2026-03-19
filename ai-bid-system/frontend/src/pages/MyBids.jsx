import React from 'react';
import { Search, Filter, Download, Eye, Edit, Trash2, FileText, Calendar, Tag } from 'lucide-react';

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* 工具栏 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索标书名称或项目编号..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
            />
          </div>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter size={16} className="mr-2" />
            筛选
          </button>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download size={16} className="mr-2" />
            导出
          </button>
        </div>
        <button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          新建标书
        </button>
      </div>

      {/* 标书表格 */}
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

      {/* 分页 */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-100">
        <div className="text-sm text-gray-500">
          显示 1-5 条，共 12 条
        </div>
        <div className="flex space-x-2">
          <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            上一页
          </button>
          <button className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            1
          </button>
          <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
            2
          </button>
          <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
            3
          </button>
          <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyBids;