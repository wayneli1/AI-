import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Tree, Button, Modal, Input, Upload, message, 
  Card, Tag, Empty, Spin, Form, Radio, Space, Popconfirm, Badge
} from 'antd';
import { 
  Package, Folder, FileImage, FileText, Plus, 
  Edit, Trash2, Upload as UploadIcon, FolderPlus, File
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
  const [newVersion, setNewVersion] = useState('');
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
      
      const assetCounts = {};
      (assetsRes.data || []).forEach(a => {
        assetCounts[a.product_id] = (assetCounts[a.product_id] || 0) + 1;
      });
      
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
        
        const assetCount = assetCounts[product.id] || 0;
        companies[product.company_name].children.push({
          title: (
            <span className="flex items-center">
              <Package size={12} className="mr-1 text-purple-500" />
              {product.product_name} {product.version}
              {assetCount > 0 && (
                <Badge count={assetCount} size="small" className="ml-2" />
              )}
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
      
      // 如果是文档类型，自动提取文本
      if (assetType === 'document') {
        setIsExtractingText(true);
        try {
          const extractedText = await extractTextFromDocument(file);
          setTextContent(extractedText);
          message.success('文档上传成功，文本已自动提取');
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
    message.loading({ content: `正在提取 ${file.name} 中的文本...`, key: 'extract', duration: 0 });
    
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
    if (!newCompanyName.trim() || !newProductName.trim() || !newVersion.trim()) {
      message.warning('请填写完整的产品信息');
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
          version: newVersion.trim()
        });
      
      if (error) {
        if (error.code === '23505') {
          message.error('该产品版本已存在');
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
      
      // 删除存储中的文件（图片和文档）
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
        className="mb-4"
        size="small"
        actions={[
          <Edit key="edit" size={14} onClick={() => handleEditAsset(asset)} className="cursor-pointer" />,
          <Popconfirm
            key="delete"
            title="确定要删除这个资产吗？"
            onConfirm={() => handleDeleteAsset(asset.id)}
            okText="确定"
            cancelText="取消"
          >
            <Trash2 size={14} className="text-red-500 cursor-pointer" />
          </Popconfirm>
        ]}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              {getAssetIcon()}
              <span className="font-medium text-gray-900 text-sm">{asset.asset_name}</span>
              <Tag color={tag.color} className="ml-2 text-xs">
                {tag.label}
              </Tag>
            </div>
            
            {asset.asset_type === 'image' && asset.file_url && (
              <div className="mt-2">
                <img 
                  src={asset.file_url} 
                  alt={asset.asset_name}
                  className="max-w-full h-24 object-cover rounded border"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/200x96?text=加载失败';
                  }}
                />
              </div>
            )}
            
            {asset.asset_type === 'document' && asset.file_url && (
              <div className="mt-2">
                <div className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded border">
                  <File size={12} className="mr-2" />
                  <span className="truncate flex-1">
                    {asset.file_url.split('/').pop()}
                  </span>
                  <a 
                    href={asset.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 ml-2 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    下载原文件
                  </a>
                </div>
              </div>
            )}
            
            {(asset.asset_type === 'text' || asset.asset_type === 'document') && asset.text_content && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border max-h-20 overflow-y-auto">
                {asset.text_content.length > 150 
                  ? `${asset.text_content.substring(0, 150)}...` 
                  : asset.text_content}
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
            <p className="text-gray-500 text-sm">三级结构：公司 → 产品版本 → 资产（图片/文本）</p>
          </div>
        </div>
        <div className="h-px bg-gray-100 mt-4"></div>
      </div>
      
      <div className="flex h-[calc(100vh-160px)]">
        <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto">
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
              >
                新建产品
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              点击产品版本查看资产
            </p>
          </div>
          
          {loadingTree ? (
            <div className="flex justify-center py-8"><Spin /></div>
          ) : treeData.length > 0 ? (
            <DirectoryTree
              treeData={treeData}
              onSelect={handleTreeSelect}
              defaultExpandAll
              className="product-tree"
              titleRender={(node) => {
                if (node.productId) {
                  return (
                    <div className="flex items-center justify-between w-full group">
                      <span>{node.title}</span>
                      <Popconfirm
                        title="确定删除此产品？其下所有资产也将被删除"
                        onConfirm={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(node.productId);
                        }}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Trash2 
                          size={12} 
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </div>
                  );
                }
                return node.title;
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
        
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedProductInfo ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedProductInfo.product_name} {selectedProductInfo.version}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    所属公司：{selectedProductInfo.company_name}
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<Plus size={16} />}
                  onClick={handleAddAsset}
                >
                  添加资产
                </Button>
              </div>
              
              {loadingAssets ? (
                <div className="flex justify-center py-12"><Spin /></div>
              ) : assets.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {assets.map(renderAssetCard)}
                </div>
              ) : (
                <Empty 
                  description="该产品暂无资产" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={handleAddAsset}>
                    添加第一个资产
                  </Button>
                </Empty>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <Package size={64} className="text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">请选择产品版本</h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                在左侧目录树中选择一个产品版本，即可管理该产品的图片和文本资产
              </p>
              {treeData.length === 0 && (
                <Button type="primary" icon={<FolderPlus size={16} />} onClick={handleAddProduct}>
                  创建第一个产品
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 新建产品弹窗 */}
      <Modal
        title={
          <div className="flex items-center">
            <FolderPlus size={18} className="mr-2 text-purple-500" />
            新建产品
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
      >
        <div className="py-4">
          <Form layout="vertical">
            <Form.Item label="所属公司" required>
              <Input
                placeholder="例如：某某邮件公司"
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
            <Form.Item label="版本号" required>
              <Input
                placeholder="例如：V6.0"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
              />
            </Form.Item>
          </Form>
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            创建产品后，可以为该产品添加图片和文本资产，用于智能填报标书
          </div>
        </div>
      </Modal>
      
      {/* 添加/编辑资产弹窗 */}
      <Modal
        title={
          <div className="flex items-center">
            {isEditingAsset ? (
              <>
                <Edit size={18} className="mr-2 text-blue-500" />
                编辑资产
              </>
            ) : (
              <>
                <Plus size={18} className="mr-2 text-green-500" />
                添加资产
              </>
            )}
          </div>
        }
        open={isAssetModalVisible}
        onOk={handleSaveAsset}
        onCancel={() => {
          setIsAssetModalVisible(false);
          resetAssetForm();
        }}
        okText={isEditingAsset ? "保存修改" : "添加资产"}
        cancelText="取消"
        width={600}
        confirmLoading={uploadingFile}
      >
        <div className="py-4">
          <Form layout="vertical">
            <Form.Item label="资产名称" required>
              <Input
                placeholder="例如：系统架构图、标准服务手册"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
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
                <Space direction="vertical">
                  <Radio value="image">
                    <div className="flex items-center">
                      <FileImage size={16} className="mr-2 text-blue-500" />
                      图片（系统架构图、产品截图等）
                    </div>
                  </Radio>
                  <Radio value="text">
                    <div className="flex items-center">
                      <FileText size={16} className="mr-2 text-green-500" />
                      文本（手动粘贴文本内容）
                    </div>
                  </Radio>
                  <Radio value="document">
                    <div className="flex items-center">
                      <File size={16} className="mr-2 text-purple-500" />
                      文档（上传 docx/pdf，自动提取文本给 AI）
                    </div>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            
            {assetType === 'image' ? (
              <Form.Item label="上传图片" required>
                <Upload
                  name="file"
                  listType="picture-card"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                  accept=".jpg,.jpeg,.png,.gif"
                  disabled={uploadingFile}
                >
                  {fileUrl ? (
                    <div className="relative">
                      <img 
                        src={fileUrl} 
                        alt="预览" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <UploadIcon size={20} className="text-white" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      {uploadingFile ? <Spin /> : (
                        <>
                          <UploadIcon size={24} className="text-gray-400 mb-2" />
                          <div className="text-gray-500 text-sm">点击上传</div>
                        </>
                      )}
                    </div>
                  )}
                </Upload>
                <div className="text-xs text-gray-500 mt-2">
                  支持 JPG、PNG、GIF 格式
                </div>
              </Form.Item>
            ) : assetType === 'document' ? (
              <Form.Item label="上传文档" required>
                <Upload
                  name="file"
                  listType="text"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                  accept=".docx,.pdf"
                  disabled={uploadingFile}
                >
                  <Button icon={<UploadIcon size={16} />} loading={uploadingFile}>
                    {documentFileName || '选择 docx/pdf 文件'}
                  </Button>
                </Upload>
                <div className="text-xs text-gray-500 mt-2">
                  支持 .docx 和 .pdf 格式，自动提取文本给 AI 使用
                </div>
                {textContent && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">提取的文本内容：</div>
                    <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto">
                      {textContent.length > 500 
                        ? `${textContent.substring(0, 500)}...` 
                        : textContent}
                    </div>
                  </div>
                )}
              </Form.Item>
            ) : (
              <Form.Item label="文本内容" required>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">文本内容</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={documentFileInputRef}
                      className="hidden"
                      onChange={handleTextFileUpload}
                      accept=".docx,.pdf"
                    />
                    <Button
                      size="small"
                      type="dashed"
                      icon={<UploadIcon size={12} />}
                      loading={isExtractingText}
                      onClick={() => documentFileInputRef.current?.click()}
                      className="text-xs"
                    >
                      上传文件自动提取
                    </Button>
                  </div>
                </div>
                <TextArea
                  placeholder="手动粘贴文本，或上传 .docx/.pdf 文件自动提取..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={6}
                  showCount
                  maxLength={5000}
                />
                <div className="text-xs text-gray-500 mt-2">
                  支持手动粘贴，或上传 .docx/.pdf 文件自动提取文本
                </div>
              </Form.Item>
            )}
            
            {selectedProductInfo && (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                将添加到：<strong>{selectedProductInfo.product_name} {selectedProductInfo.version}</strong>
                （{selectedProductInfo.company_name}）
              </div>
            )}
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default ProductLibrary;