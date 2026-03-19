import React, { useState } from 'react';
import { Search, Plus, Filter, Package, Tag, DollarSign, BarChart, Edit, Trash2, Eye, TrendingUp, Star } from 'lucide-react';

const ProductLibrary = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const products = [
    {
      id: 1,
      name: '企业级服务器',
      category: '硬件设备',
      sku: 'SRV-2024-X1',
      price: 85000,
      stock: 25,
      status: '在售',
      sales: 124,
      rating: 4.8,
      description: '高性能企业级服务器，适用于数据中心',
      tags: ['热销', '推荐'],
    },
    {
      id: 2,
      name: '网络交换机',
      category: '硬件设备',
      sku: 'SW-2024-G2',
      price: 12000,
      stock: 120,
      status: '在售',
      sales: 89,
      rating: 4.5,
      description: '48口千兆企业级交换机',
      tags: ['热销'],
    },
    {
      id: 3,
      name: '云存储解决方案',
      category: '软件服务',
      sku: 'CS-2024-PRO',
      price: 50000,
      stock: 10,
      status: '在售',
      sales: 45,
      rating: 4.9,
      description: '企业级云存储与备份解决方案',
      tags: ['新品', '推荐'],
    },
    {
      id: 4,
      name: '企业ERP系统',
      category: '软件服务',
      sku: 'ERP-2024-ENT',
      price: 180000,
      stock: 8,
      status: '在售',
      sales: 32,
      rating: 4.7,
      description: '全面的企业资源规划系统',
      tags: ['定制'],
    },
    {
      id: 5,
      name: '安防监控系统',
      category: '解决方案',
      sku: 'SEC-2024-FULL',
      price: 95000,
      stock: 15,
      status: '在售',
      sales: 67,
      rating: 4.6,
      description: '智能安防监控全套解决方案',
      tags: ['热销'],
    },
    {
      id: 6,
      name: '旧型号路由器',
      category: '硬件设备',
      sku: 'RT-2020-OLD',
      price: 2000,
      stock: 5,
      status: '停售',
      sales: 210,
      rating: 4.2,
      description: '旧型号路由器，库存清仓',
      tags: ['清仓'],
    },
    {
      id: 7,
      name: 'IT运维服务',
      category: '技术服务',
      sku: 'SVC-2024-IT',
      price: 15000,
      stock: null,
      status: '在售',
      sales: 78,
      rating: 4.8,
      description: '全年IT系统运维支持服务',
      tags: ['服务'],
    },
    {
      id: 8,
      name: '数据分析平台',
      category: '软件服务',
      sku: 'DA-2024-ANALYTICS',
      price: 75000,
      stock: 12,
      status: '在售',
      sales: 28,
      rating: 4.9,
      description: '大数据分析与可视化平台',
      tags: ['新品', '推荐'],
    },
  ];

  const categories = [
    { id: 'all', name: '全部', count: products.length },
    { id: 'hardware', name: '硬件设备', count: products.filter(p => p.category === '硬件设备').length },
    { id: 'software', name: '软件服务', count: products.filter(p => p.category === '软件服务').length },
    { id: 'solution', name: '解决方案', count: products.filter(p => p.category === '解决方案').length },
    { id: 'service', name: '技术服务', count: products.filter(p => p.category === '技术服务').length },
  ];

  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => {
        const catMap = {
          'hardware': '硬件设备',
          'software': '软件服务',
          'solution': '解决方案',
          'service': '技术服务',
        };
        return p.category === catMap[activeCategory];
      });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* 工具栏 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索产品名称或SKU..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
            />
          </div>
          <div className="flex space-x-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center px-3 py-1.5 rounded-lg text-sm ${
                  activeCategory === cat.id
                    ? 'bg-purple-100 text-purple-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat.name}
                <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
          <button className="flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter size={16} className="mr-2" />
            更多筛选
          </button>
        </div>
        
        <button className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} className="mr-2" />
          添加产品
        </button>
      </div>

      {/* 产品表格 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">产品信息</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">SKU</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">分类</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">价格</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">库存</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">销售</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mr-4">
                      <Package size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.description}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <code className="text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">{product.sku}</code>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    <Tag size={14} className="mr-2 text-gray-400" />
                    <span className="text-sm text-gray-700">{product.category}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    <DollarSign size={14} className="mr-1 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {product.price.toLocaleString('zh-CN')}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  {product.stock !== null ? (
                    <div className={`font-medium ${product.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                      {product.stock} 台
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">不限</span>
                  )}
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    product.status === '在售' 
                      ? 'bg-green-100 text-green-800'
                      : product.status === '停售'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    <BarChart size={14} className="mr-2 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-900">{product.sales} 件</div>
                      <div className="flex items-center text-xs text-gray-500">
                        <Star size={10} className="mr-1 text-yellow-500" />
                        {product.rating}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex space-x-2">
                    <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
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

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{products.length}</div>
              <div className="text-sm text-gray-600 mt-1">产品总数</div>
            </div>
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <Package size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp size={14} className="mr-2" />
            较上月新增 3 款产品
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {products.filter(p => p.status === '在售').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">在售产品</div>
            </div>
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <TrendingUp size={24} className="text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            停售产品：{products.filter(p => p.status === '停售').length} 款
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                ¥{products.reduce((sum, p) => sum + p.price, 0).toLocaleString('zh-CN')}
              </div>
              <div className="text-sm text-gray-600 mt-1">总货值</div>
            </div>
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <DollarSign size={24} className="text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            平均价格：¥{(products.reduce((sum, p) => sum + p.price, 0) / products.length).toLocaleString('zh-CN', {maximumFractionDigits: 0})}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductLibrary;