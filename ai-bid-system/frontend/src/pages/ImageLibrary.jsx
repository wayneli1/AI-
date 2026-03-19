import React, { useState } from 'react';
import { Search, Upload, Filter, Grid, List, Image as ImageIcon, Tag, Calendar, Download, Trash2, Eye } from 'lucide-react';

const ImageLibrary = () => {
  const [viewMode, setViewMode] = useState('grid');
  
  const images = [
    {
      id: 1,
      name: '营业执照',
      category: '资质证书',
      size: '1.2 MB',
      uploadDate: '2024-03-19',
      tags: ['官方', '必需'],
      thumbnail: 'https://picsum.photos/300/200?random=1',
      description: '公司营业执照扫描件',
    },
    {
      id: 2,
      name: 'ISO9001认证',
      category: '资质证书',
      size: '0.8 MB',
      uploadDate: '2024-03-18',
      tags: ['认证', '质量'],
      thumbnail: 'https://picsum.photos/300/200?random=2',
      description: 'ISO9001质量体系认证证书',
    },
    {
      id: 3,
      name: '产品展示图',
      category: '产品图片',
      size: '2.1 MB',
      uploadDate: '2024-03-17',
      tags: ['产品', '展示'],
      thumbnail: 'https://picsum.photos/300/200?random=3',
      description: '主要产品高清展示图',
    },
    {
      id: 4,
      name: '项目案例图',
      category: '案例图片',
      size: '3.4 MB',
      uploadDate: '2024-03-16',
      tags: ['案例', '成功'],
      thumbnail: 'https://picsum.photos/300/200?random=4',
      description: '成功项目案例现场图片',
    },
    {
      id: 5,
      name: '团队合影',
      category: '公司文化',
      size: '4.2 MB',
      uploadDate: '2024-03-15',
      tags: ['团队', '文化'],
      thumbnail: 'https://picsum.photos/300/200?random=5',
      description: '公司团队集体合影',
    },
    {
      id: 6,
      name: '专利证书',
      category: '资质证书',
      size: '1.5 MB',
      uploadDate: '2024-03-14',
      tags: ['专利', '技术'],
      thumbnail: 'https://picsum.photos/300/200?random=6',
      description: '技术专利证书扫描件',
    },
    {
      id: 7,
      name: '工厂实拍',
      category: '公司实力',
      size: '5.1 MB',
      uploadDate: '2024-03-13',
      tags: ['工厂', '实力'],
      thumbnail: 'https://picsum.photos/300/200?random=7',
      description: '生产工厂实地拍摄照片',
    },
    {
      id: 8,
      name: '荣誉证书',
      category: '资质证书',
      size: '0.9 MB',
      uploadDate: '2024-03-12',
      tags: ['荣誉', '奖项'],
      thumbnail: 'https://picsum.photos/300/200?random=8',
      description: '行业荣誉证书和奖项',
    },
  ];

  const categories = ['全部', '资质证书', '产品图片', '案例图片', '公司文化', '公司实力'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* 工具栏 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索图片名称或描述..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
            />
          </div>
          <div className="flex space-x-2">
            {categories.map((cat) => (
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
          </div>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter size={16} className="mr-2" />
            筛选
          </button>
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
            <Upload size={16} className="mr-2" />
            上传图片
          </button>
        </div>
      </div>

      {/* 图片网格 */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {images.map((img) => (
            <div key={img.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative h-48 overflow-hidden bg-gray-50">
                <img 
                  src={img.thumbnail} 
                  alt={img.name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 flex space-x-2">
                  <button className="p-1.5 bg-white/80 backdrop-blur-sm rounded-lg hover:bg-white">
                    <Eye size={14} className="text-gray-700" />
                  </button>
                  <button className="p-1.5 bg-white/80 backdrop-blur-sm rounded-lg hover:bg-white">
                    <Download size={14} className="text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{img.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{img.description}</p>
                  </div>
                  <span className="text-xs text-gray-500">{img.size}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-500">
                    <Tag size={12} className="mr-1" />
                    {img.category}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar size={12} className="mr-1" />
                    {img.uploadDate}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {img.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {tag}
                    </span>
                  ))}
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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">图片</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">分类</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">标签</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">大小</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">上传时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {images.map((img) => (
                <tr key={img.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden">
                      <img src={img.thumbnail} alt={img.name} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium text-gray-900">{img.name}</div>
                      <div className="text-xs text-gray-500">{img.description}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {img.category}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1">
                      {img.tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-700">{img.size}</td>
                  <td className="py-4 px-4 text-sm text-gray-700">{img.uploadDate}</td>
                  <td className="py-4 px-4">
                    <div className="flex space-x-2">
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
                        <Download size={16} />
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

      {/* 统计信息 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ImageIcon size={20} className="text-gray-400 mr-3" />
            <div>
              <div className="font-medium text-gray-900">图片库统计</div>
              <div className="text-sm text-gray-500">共 {images.length} 张图片，占用空间 19.2 MB</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            最近更新：2024-03-19
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageLibrary;