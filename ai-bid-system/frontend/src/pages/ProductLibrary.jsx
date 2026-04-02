import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Tree, Button, Modal, Input, Upload, message, 
  Card, Tag, Empty, Spin, Form, Radio, Space, Popconfirm
} from 'antd';
import { 
  Package, Folder, FileImage, FileText, Plus, 
  Edit, Trash2, Upload as UploadIcon, FolderPlus, File, Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromDocument } from '../utils/documentParser';

const { DirectoryTree } = Tree;
const { TextArea } = Input;

const ProductLibrary = () => {
  const { user } = useAuth();
  
  const [treeData, setTreeData] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductInfo, setSelectedProductInfo] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  
  const [isAssetModalVisible, setIsAssetModalVisible] = useState(false);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [isEditingAsset, setIsEditingAsset] = useState(false);
  const [currentAsset, setCurrentAsset] = useState(null);
  
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('image');
  const [textContent, setTextContent] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [documentFileName, setDocumentFileName] = useState('');
  const documentFileInputRef = useRef(null);
  
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newVersion, setNewVersion] = useState(''); // 现在是选填
  const [savingProduct, setSavingProduct] = useState(false);

  const loadProductTree = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoadingTree(true);
      
      const [productsRes, assetsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .order('company_name')
          .order('product_name')
          .order('version'),
        supabase
          .from('product_assets')
          .select('product_id')
      ]);
      
      if (productsRes.error) throw productsRes.error;
      if (assetsRes.error) throw assetsRes.error;
      
      const companies = {};
      productsRes.data.forEach(product => {
        if (!companies[product.company_name]) {
          companies[product.company_name] = {
            title: product.company_name,
            key: `company-${product.company_name}`,
            icon: <Folder size={14} className="text-yellow-500" />,
            children: []
          };
        }
        
        // 💡 优化 1：去掉了 Badge 数量显示，完全依靠 Antd 原生的树形展开箭头
        // 💡 优化 2：兼容版本号为空的情况
        const versionText = product.version ? ` ${product.version}` : '';
        
        companies[product.company_name].children.push({
          title: (
            <span className="flex items-center">
              <Package size={12} className="mr-1 text-purple-500" />
              {product.product_name}{versionText}
            </span>
          ),
          key: product.id,
          isLeaf: true,
          productId: product.id,
          productInfo: product,
          icon: null
        });
      });
      
      setTreeData(Object.values(companies));
      
      if (selectedProductId) {
        const product = productsRes.data.find(p => p.id === selectedProductId);
        if (product) setSelectedProductInfo(product);
      }
    } catch (error) {
      console.error('加载产品树失败:', error);
      message.error('加载产品数据失败');
    } finally {
      setLoadingTree(false);
    }
  }, [user, selectedProductId]);

  const loadAssets = useCallback(async (productId) => {
    if (!productId) {
      setAssets([]);
      return;
    }
    
    try {
      setLoadingAssets(true);
      const { data, error } = await supabase
        .from('product_assets')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('加载资产失败:', error);
      message.error('加载资产列表失败');
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadProductTree();
  }, [user, loadProductTree]);

  const handleTreeSelect = (selectedKeys, { node }) => {
    if (node.productId) {
      setSelectedProductId(node.productId);
      setSelectedProductInfo(node.productInfo);
      loadAssets(node.productId);
    } else {
      setSelectedProductId(null);
      setSelectedProductInfo(null);
      setAssets([]);
    }
  };

  const handleFileUpload = async (file) => {
    if (!user) return false;
    
    try {
      setUploadingFile(true);
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 9);
      const ext = file.name.split('.').pop().toLowerCase();
      const safeFileName = `${timestamp}_${randomStr}.${ext}`;
      const filePath = `product-assets/${user.id}/${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      
      if (uploadError) {
        if (uploadError.message.includes('duplicate')) {
          message.error('文件已存在，请重命名后重新上传');
          return false;
        }
        throw uploadError;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);
      
      setFileUrl(publicUrlData.publicUrl);
      setDocumentFileName(file.name);
      
      if (assetType === 'document') {
        setIsExtractingText(true);
        try {
          const extractedText = await extractTextFromDocument(file);
          setTextContent(extractedText);
          
          // 自动识别服务手册
          const isServiceManual = 
            // 通过文件名识别
            file.name.includes('服务手册') || 
            file.name.includes('售后') ||
            file.name.includes('manual') ||
            file.name.includes('Manual') ||
            // 通过内容识别
            extractedText.includes('售后服务') ||
            extractedText.includes('服务手册') ||
            extractedText.includes('服务条款') ||
            extractedText.includes('保修') ||
            extractedText.includes('维护');
          
          if (isServiceManual) {
            message.success('服务手册上传成功，已自动识别');
            
            // 自动填写资产名称（如果为空）
            if (!assetName.trim()) {
              // 从文件名提取有意义的名称
              const fileName = file.name.replace(/\.[^/.]+$/, ''); // 移除扩展名
              const cleanName = fileName.replace(/[_-]/g, ' ').replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, '').trim();
              if (cleanName && cleanName.length > 0) {
                setAssetName(cleanName);
              }
            }
          } else {
            message.success('文档上传成功，文本已自动提取');
          }
        } catch (extractError) {
          console.error('文本提取失败:', extractError);
          message.warning('文档上传成功，但文本提取失败，请手动输入或重新上传');
        } finally {
          setIsExtractingText(false);
        }
      } else {
        message.success('文件上传成功');
      }
      
      return false;
    } catch (error) {
      console.error('文件上传失败:', error);
      message.error('文件上传失败');
      return false;
    } finally {
      setUploadingFile(false);
    }
  };
  
  const handleTextFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['docx', 'pdf'].includes(ext)) {
      message.warning('仅支持 .docx 和 .pdf 格式');
      return;
    }
    
    setIsExtractingText(true);
    message.loading({ content: `正在提取文本...`, key: 'extract', duration: 0 });
    
    try {
      const text = await extractTextFromDocument(file);
      setTextContent(text);
      setDocumentFileName(file.name);
      message.success({ content: '文本提取成功！', key: 'extract' });
    } catch (error) {
      console.error('文本提取失败:', error);
      message.error({ content: `提取失败: ${error.message}`, key: 'extract' });
    } finally {
      setIsExtractingText(false);
      if (event.target) event.target.value = '';
    }
  };

  const resetAssetForm = () => {
    setAssetName('');
    setAssetType('image');
    setTextContent('');
    setFileUrl('');
    setDocumentFileName('');
    setCurrentAsset(null);
    setIsEditingAsset(false);
  };

  const resetProductForm = () => {
    setNewCompanyName('');
    setNewProductName('');
    setNewVersion('');
  };

  const handleAddProduct = () => {
    resetProductForm();
    setIsProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    // 💡 优化：移除对 version 的非空校验
    if (!newCompanyName.trim() || !newProductName.trim()) {
      message.warning('请填写公司和产品名称');
      return;
    }
    
    try {
      setSavingProduct(true);
      const { error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          company_name: newCompanyName.trim(),
          product_name: newProductName.trim(),
          version: newVersion.trim() || '' // 选填，默认存空字符串
        });
      
      if (error) {
        if (error.code === '23505') {
          message.error('该产品或版本已存在');
        } else {
          throw error;
        }
        return;
      }
      
      message.success('产品创建成功');
      setIsProductModalVisible(false);
      resetProductForm();
      loadProductTree();
    } catch (error) {
      console.error('创建产品失败:', error);
      message.error('创建产品失败');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      if (selectedProductId === productId) {
        setSelectedProductId(null);
        setSelectedProductInfo(null);
        setAssets([]);
      }
      
      message.success('产品删除成功');
      loadProductTree();
    } catch (error) {
      console.error('删除产品失败:', error);
      message.error('删除产品失败');
    }
  };

  const handleAddAsset = () => {
    if (!selectedProductId) {
      message.warning('请先选择一个产品版本');
      return;
    }
    resetAssetForm();
    setIsAssetModalVisible(true);
  };

  const handleEditAsset = (asset) => {
    setCurrentAsset(asset);
    setAssetName(asset.asset_name);
    setAssetType(asset.asset_type);
    setTextContent(asset.text_content || '');
    setFileUrl(asset.file_url || '');
    setDocumentFileName(asset.file_url ? asset.file_url.split('/').pop() : '');
    setIsEditingAsset(true);
    setIsAssetModalVisible(true);
  };

  const handleSaveAsset = async () => {
    if (!assetName.trim()) {
      message.warning('请输入资产名称');
      return;
    }
    
    if (assetType === 'image' && !fileUrl) {
      message.warning('请上传图片文件');
      return;
    }
    
    if (assetType === 'text' && !textContent.trim()) {
      message.warning('请输入文本内容');
      return;
    }
    
    if (assetType === 'document' && !fileUrl) {
      message.warning('请上传文档文件');
      return;
    }
    
    try {
      const assetData = {
        product_id: selectedProductId,
        asset_name: assetName.trim(),
        asset_type: assetType,
        text_content: (assetType === 'text' || assetType === 'document') ? textContent.trim() : null,
        file_url: (assetType === 'image' || assetType === 'document') ? fileUrl : null
      };
      
      if (isEditingAsset && currentAsset) {
        const { error } = await supabase
          .from('product_assets')
          .update(assetData)
          .eq('id', currentAsset.id);
        
        if (error) throw error;
        message.success('资产更新成功');
      } else {
        const { error } = await supabase
          .from('product_assets')
          .insert(assetData);
        
        if (error) throw error;
        message.success('资产添加成功');
      }
      
      loadAssets(selectedProductId);
      loadProductTree();
      setIsAssetModalVisible(false);
      resetAssetForm();
    } catch (error) {
      console.error('保存资产失败:', error);
      message.error('保存资产失败');
    }
  };

  const handleDeleteAsset = async (assetId) => {
    try {
      const asset = assets.find(a => a.id === assetId);
      
      const { error } = await supabase
        .from('product_assets')
        .delete()
        .eq('id', assetId);
      
      if (error) throw error;
      
      if ((asset?.asset_type === 'image' || asset?.asset_type === 'document') && asset.file_url) {
        try {
          const urlParts = asset.file_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `product-assets/${user.id}/${fileName}`;
          await supabase.storage.from('images').remove([filePath]);
        } catch (e) {
          console.warn('删除存储文件失败:', e);
        }
      }
      
      message.success('资产删除成功');
      loadAssets(selectedProductId);
      loadProductTree();
    } catch (error) {
      console.error('删除资产失败:', error);
      message.error('删除资产失败');
    }
  };

  const renderAssetCard = (asset) => {
    const getAssetIcon = () => {
      switch (asset.asset_type) {
        case 'image': return <FileImage size={14} className="text-blue-500 mr-2" />;
        case 'document': return <File size={14} className="text-purple-500 mr-2" />;
        default: return <FileText size={14} className="text-green-500 mr-2" />;
      }
    };
    
    const getAssetTag = () => {
      switch (asset.asset_type) {
        case 'image': return { label: '图片', color: 'blue' };
        case 'document': return { label: '文档', color: 'purple' };
        default: return { label: '文本', color: 'green' };
      }
    };
    
    const tag = getAssetTag();
    
    return (
      <Card
        key={asset.id}
        className="mb-4 shadow-sm hover:shadow transition-shadow"
        size="small"
        actions={[
          <Edit key="edit" size={14} onClick={() => handleEditAsset(asset)} className="cursor-pointer text-gray-500 hover:text-blue-500 transition-colors" />,
          <Popconfirm
            key="delete"
            title="确定要删除这个资产吗？"
            onConfirm={() => handleDeleteAsset(asset.id)}
            okText="确定"
            cancelText="取消"
          >
            <Trash2 size={14} className="text-red-500 cursor-pointer hover:text-red-600 transition-colors" />
          </Popconfirm>
        ]}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              {getAssetIcon()}
              <span className="font-bold text-gray-800 text-base">{asset.asset_name}</span>
              <Tag color={tag.color} className="ml-3 text-xs border-0">
                {tag.label}
              </Tag>
            </div>
            
            {/* 💡 优化 3：极简展示。隐藏 .docx 文件名和长篇文本内容，文档仅提供下载链接，图片保留缩略图供区分 */}
            {asset.asset_type === 'image' && asset.file_url && (
              <div className="mt-3">
                <img 
                  src={asset.file_url} 
                  alt={asset.asset_name}
                  className="max-w-full h-24 object-cover rounded border border-gray-100"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/200x96?text=加载失败';
                  }}
                />
              </div>
            )}
            
            {asset.asset_type === 'document' && asset.file_url && (
              <div className="mt-3">
                <a 
                  href={asset.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={12} className="mr-1" /> 下载源文件
                </a>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="px-8 pt-6">
        <div className="flex items-center">
          <Package size={24} className="text-purple-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">产品资产库</h1>
            <p className="text-gray-500 text-sm">构建您专属的智能语料库：公司 → 产品 → 资产名称</p>
          </div>
        </div>
        <div className="h-px bg-gray-100 mt-4"></div>
      </div>
      
      <div className="flex h-[calc(100vh-160px)]">
        <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto custom-scrollbar">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center">
                <Folder size={16} className="mr-2 text-yellow-500" />
                产品目录
              </h3>
              <Button
                type="primary"
                size="small"
                icon={<Plus size={14} />}
                onClick={handleAddProduct}
                className="bg-purple-600 hover:bg-purple-700 border-0"
              >
                新建产品
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              点击展开查看名下产品
            </p>
          </div>
          
          {loadingTree ? (
            <div className="flex justify-center py-8"><Spin /></div>
          ) : treeData.length > 0 ? (
            <DirectoryTree
              treeData={treeData}
              onSelect={handleTreeSelect}
              defaultExpandAll
              className="product-tree bg-transparent"
              titleRender={(node) => {
                if (node.productId) {
                  return (
                    <div className="flex items-center justify-between w-full group py-0.5">
                      <span className="text-gray-700">{node.title}</span>
                      <Popconfirm
                        title="确定删除此产品？其下所有资产也将一并清除"
                        onConfirm={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(node.productId);
                        }}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Trash2 
                          size={13} 
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </div>
                  );
                }
                return <span className="font-medium text-gray-800">{node.title}</span>;
              }}
            />
          ) : (
            <Empty 
              description="暂无产品数据" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" size="small" onClick={handleAddProduct}>
                添加第一个产品
              </Button>
            </Empty>
          )}
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gray-50/50">
          {selectedProductInfo ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    {selectedProductInfo.product_name} 
                    {selectedProductInfo.version && <span className="ml-2 text-purple-600 bg-purple-50 px-2 py-0.5 rounded text-sm border border-purple-100">{selectedProductInfo.version}</span>}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1 flex items-center">
                    所属公司：<Tag className="ml-1 border-0 bg-gray-100">{selectedProductInfo.company_name}</Tag>
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<Plus size={16} />}
                  onClick={handleAddAsset}
                  className="bg-purple-600 hover:bg-purple-700 border-0 shadow-sm"
                >
                  录入新资产
                </Button>
              </div>
              
              {loadingAssets ? (
                <div className="flex justify-center py-12"><Spin /></div>
              ) : assets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {assets.map(renderAssetCard)}
                </div>
              ) : (
                <Empty 
                  description="该产品库目前空空如也，请录入相关图片或文案资产" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  className="py-12 bg-white rounded-xl border border-dashed border-gray-200"
                >
                  <Button type="primary" onClick={handleAddAsset}>
                    录入资产
                  </Button>
                </Empty>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                <Package size={40} className="text-purple-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">未选中产品</h3>
              <p className="text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
                请在左侧目录树中点击展开公司，并选择一个具体的产品版本来管理其相关的资质与文案资产。
              </p>
              {treeData.length === 0 && (
                <Button type="primary" icon={<FolderPlus size={16} />} onClick={handleAddProduct} className="bg-purple-600 border-0">
                  创建首个产品
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 新建产品弹窗 */}
      <Modal
        title={
          <div className="flex items-center font-bold text-lg">
            <FolderPlus size={18} className="mr-2 text-purple-500" />
            新建产品分类
          </div>
        }
        open={isProductModalVisible}
        onOk={handleSaveProduct}
        onCancel={() => {
          setIsProductModalVisible(false);
          resetProductForm();
        }}
        okText="创建"
        cancelText="取消"
        confirmLoading={savingProduct}
        centered
      >
        <div className="py-4">
          <Form layout="vertical">
            <Form.Item label="所属公司" required>
              <Input
                placeholder="例如：中核核信信息技术（北京）有限公司"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </Form.Item>
            <Form.Item label="产品名称" required>
              <Input
                placeholder="例如：邮件系统"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </Form.Item>
            {/* 💡 优化 2：版本号改成选填，去除了 required 属性 */}
            <Form.Item label="版本号 (选填)">
              <Input
                placeholder="例如：V6.0"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
      
      {/* 添加/编辑资产弹窗 */}
      <Modal
        title={
          <div className="flex items-center font-bold text-lg">
            {isEditingAsset ? (
              <><Edit size={18} className="mr-2 text-blue-500" />编辑资产</>
            ) : (
              <><Plus size={18} className="mr-2 text-green-500" />录入新资产</>
            )}
          </div>
        }
        open={isAssetModalVisible}
        onOk={handleSaveAsset}
        onCancel={() => {
          setIsAssetModalVisible(false);
          resetAssetForm();
        }}
        okText={isEditingAsset ? "保存修改" : "确认录入"}
        cancelText="取消"
        width={640}
        centered
        confirmLoading={uploadingFile}
      >
        <div className="py-4">
          <div className="mb-6 bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm text-gray-600">
            💡 <strong>资产名称非常重要！</strong>请务必填写清晰（例如：“系统架构拓扑图” 或 “标准保修承诺书”）。<br/>
            AI 在填报标书时，将完全依靠这个名称来匹配并提取对应的图片或文字。
          </div>
          <Form layout="vertical">
            <Form.Item label="资产名称" required>
              <Input
                placeholder="一句话描述该资产，例如：售后服务方案、公安部等保证书..."
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                size="large"
              />
            </Form.Item>
            
            <Form.Item label="资产类型" required>
              <Radio.Group 
                value={assetType} 
                onChange={(e) => {
                  setAssetType(e.target.value);
                  setFileUrl('');
                  setTextContent('');
                  setDocumentFileName('');
                }}
                className="w-full"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Radio.Button value="image" className="text-center h-auto py-3">
                    <FileImage size={24} className="mx-auto mb-1 text-blue-500" />
                    <div>图片资质</div>
                  </Radio.Button>
                  <Radio.Button value="text" className="text-center h-auto py-3">
                    <FileText size={24} className="mx-auto mb-1 text-green-500" />
                    <div>纯文本条款</div>
                  </Radio.Button>
                  <Radio.Button value="document" className="text-center h-auto py-3">
                    <File size={24} className="mx-auto mb-1 text-purple-500" />
                    <div>上传文档解析</div>
                  </Radio.Button>
                </div>
              </Radio.Group>
            </Form.Item>
            
            {assetType === 'image' ? (
              <Form.Item label="上传图片附件" required>
                <Upload
                  name="file"
                  listType="picture-card"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                  accept=".jpg,.jpeg,.png,.gif"
                  disabled={uploadingFile}
                  className="asset-uploader"
                >
                  {fileUrl ? (
                    <div className="relative w-full h-full p-1">
                      <img 
                        src={fileUrl} 
                        alt="预览" 
                        className="w-full h-full object-cover rounded"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded">
                        <span className="text-white text-xs flex items-center"><UploadIcon size={14} className="mr-1"/>更换图片</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 hover:text-blue-500 transition-colors">
                      {uploadingFile ? <Spin /> : (
                        <>
                          <UploadIcon size={24} className="mb-2" />
                          <div className="text-sm">点击上传资质截图</div>
                        </>
                      )}
                    </div>
                  )}
                </Upload>
              </Form.Item>
            ) : assetType === 'document' ? (
              <Form.Item label="上传源文档" required>
                <Upload
                  name="file"
                  listType="text"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                  accept=".docx,.pdf"
                  disabled={uploadingFile}
                >
                  <Button icon={<UploadIcon size={16} />} loading={uploadingFile} className="w-full h-12 border-dashed">
                    {documentFileName || '点击选择 .docx 或 .pdf 文件'}
                  </Button>
                </Upload>
                {textContent && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">已成功解析提取以下文本，供 AI 填报使用：</div>
                    <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto custom-scrollbar">
                      {textContent}
                    </div>
                  </div>
                )}
              </Form.Item>
            ) : (
              <Form.Item label="粘贴条款内容" required>
                <TextArea
                  placeholder="在此直接粘贴您的售后承诺、服务标准等纯文本内容..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={8}
                  className="custom-scrollbar"
                />
              </Form.Item>
            )}
            
            {selectedProductInfo && (
              <div className="text-xs text-gray-400 mt-4 text-center">
                当前操作节点：{selectedProductInfo.company_name} / {selectedProductInfo.product_name} {selectedProductInfo.version}
              </div>
            )}
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default ProductLibrary;