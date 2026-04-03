import { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Building2, CheckCircle, X, Loader2,
  BookOpen, Clock, Check, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { convertToMarkdown, validateBidFile } from '../utils/documentParser';
import { runDifyMarkdownExtraction, analyzeCrossDocumentFrequency } from '../utils/difyExtractor';
import { message, Progress, Card, Button, Select, Input, Tag, Table, Checkbox, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const LearnBid = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 文件上传状态
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('idle'); // idle, converting, chunking, extracting, analyzing, awaiting_verification
  const [progress, setProgress] = useState(0);
  const [chunkProgress, setChunkProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    message: ''
  });
  
  // 处理结果状态
  const [extractionResults, setExtractionResults] = useState([]); // 每份文档的提取结果
  const [crossAnalysis, setCrossAnalysis] = useState([]); // 跨文档分析结果
  const [learningSessions, setLearningSessions] = useState([]);
  
  // 公司关联状态
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 字段选择状态
  const [selectedFields, setSelectedFields] = useState({}); // {key: true/false}
  const [editingFields, setEditingFields] = useState({}); // {key: value}

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // 加载公司列表
  useEffect(() => {
    const loadCompanies = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('company_profiles')
            .select('id, company_name, uscc, legal_rep_name')
            .eq('user_id', user.id)
            .order('company_name', { ascending: true });

          if (error) throw error;
          setCompanies(data || []);
        } catch (error) {
          console.error('加载公司列表失败:', error);
          message.error('加载公司列表失败');
        }
      }
    };

    loadCompanies();
  }, [user]);

  // 处理单个文件
  const processSingleFile = async (file, fileIndex, totalFiles) => {
    try {
      // 1. 创建学习记录
      const { data: session, error: sessionError } = await supabase
        .from('bid_learning_sessions')
        .insert({
          user_id: user.id,
          original_filename: file.name,
          original_file_size: file.size,
          status: 'converting'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. 转换为Markdown
      const markdown = await convertToMarkdown(file);

      // 更新学习记录
      await supabase
        .from('bid_learning_sessions')
        .update({
          markdown_content: markdown,
          markdown_size: markdown.length,
          status: 'chunking'
        })
        .eq('id', session.id);

      // 3. 调用Dify提取信息
      const extractionResult = await runDifyMarkdownExtraction(
        markdown, 
        file.name,
        {
          onProgress: (progress) => {
            // 更新分块进度
            setChunkProgress(progress);
            // 更新总体进度：每个文件占20%，分块占80%
            const fileBaseProgress = (fileIndex / totalFiles) * 20;
            const chunkProgressPercent = progress.percent || 0;
            setProgress(fileBaseProgress + (chunkProgressPercent * 0.8));
          }
        }
      );

      // 4. 更新学习记录
      await supabase
        .from('bid_learning_sessions')
        .update({
          extraction_result: extractionResult,
          extraction_metadata: {
            extracted_at: new Date().toISOString(),
            field_count: extractionResult.fields?.length || 0,
            chunk_stats: extractionResult.metadata?.processing_stats
          },
          status: 'completed'
        })
        .eq('id', session.id);

      return {
        session,
        extractionResult
      };

    } catch (error) {
      console.error(`处理文件 ${file.name} 失败:`, error);
      throw error;
    }
  };

  // 批量处理文件
  const handleFilesSelect = async (files) => {
    if (!user) {
      message.error('请先登录');
      return;
    }

    // 验证所有文件
    const validFiles = [];
    for (const file of files) {
      const validation = validateBidFile(file);
      if (!validation.isValid) {
        message.error(`${file.name}: ${validation.message}`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      message.error('没有有效的文件');
      return;
    }

    setUploadedFiles(validFiles);
    setProcessingStatus('converting');
    setProgress(0);
    setChunkProgress({ current: 0, total: 0, percent: 0, message: '' });

    try {
      const results = [];
      const sessions = [];

      // 逐个处理文件
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        message.info(`正在处理文件 ${i + 1}/${validFiles.length}: ${file.name}`);
        
        const result = await processSingleFile(file, i, validFiles.length);
        results.push(result.extractionResult);
        sessions.push(result.session);
        
        // 更新进度
        setProgress(((i + 1) / validFiles.length) * 100);
      }

      setExtractionResults(results);
      setLearningSessions(sessions);

      // 进行跨文档分析
      setProcessingStatus('analyzing');
      message.info('正在进行跨文档分析...');
      
      const analysis = analyzeCrossDocumentFrequency(results);
      setCrossAnalysis(analysis);
      
      // 默认选中高频且一致的字段
      const defaultSelected = {};
      analysis.forEach(item => {
        if (item.frequencyNumber >= 2 && item.consistent) {
          defaultSelected[item.key] = true;
        }
      });
      setSelectedFields(defaultSelected);

      setProcessingStatus('awaiting_verification');
      message.success(`分析完成！共处理 ${validFiles.length} 份文档，提取 ${analysis.length} 个字段`);

    } catch (error) {
      console.error('批量处理文件失败:', error);
      message.error(`处理失败: ${error.message}`);
      
      setProcessingStatus('idle');
      setProgress(0);
      setChunkProgress({ current: 0, total: 0, percent: 0, message: '' });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesSelect(files);
  };

  // 字段选择处理
  const handleFieldSelect = (key, checked) => {
    setSelectedFields(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  // 字段编辑处理
  const handleFieldEdit = (key, value) => {
    setEditingFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 保存到公司信息库
  const handleSaveToCompany = async () => {
    if (!selectedCompanyId || crossAnalysis.length === 0) {
      message.error('请选择关联的公司');
      return;
    }

    // 获取选中的字段
    const selectedKeys = Object.keys(selectedFields).filter(key => selectedFields[key]);
    if (selectedKeys.length === 0) {
      message.error('请至少选择一个字段保存');
      return;
    }

    setIsSaving(true);

    try {
      // 1. 获取当前公司的custom_fields
      const { data: company, error: fetchError } = await supabase
        .from('company_profiles')
        .select('custom_fields')
        .eq('id', selectedCompanyId)
        .single();

      if (fetchError) throw fetchError;

      // 2. 构建要保存的字段
      const fieldsToSave = {};
      selectedKeys.forEach(key => {
        const analysisItem = crossAnalysis.find(item => item.key === key);
        if (analysisItem) {
          // 使用编辑后的值或原始值
          fieldsToSave[key] = editingFields[key] || analysisItem.value;
        }
      });

      // 3. 合并到custom_fields
      const currentFields = company.custom_fields || {};
      const updatedFields = {
        ...currentFields,
        ...fieldsToSave,
        _learning_sources: [
          ...(currentFields._learning_sources || []),
          {
            session_ids: learningSessions.map(s => s.id),
            filenames: uploadedFiles.map(f => f.name),
            extraction_date: new Date().toISOString(),
            field_count: selectedKeys.length
          }
        ]
      };

      // 4. 更新公司信息
      const { error: updateError } = await supabase
        .from('company_profiles')
        .update({ 
          custom_fields: updatedFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCompanyId);

      if (updateError) throw updateError;

      // 5. 更新学习记录状态
      const updatePromises = learningSessions.map(session =>
        supabase
          .from('bid_learning_sessions')
          .update({
            company_profile_id: selectedCompanyId,
            verified: true,
            verified_at: new Date().toISOString(),
            status: 'completed'
          })
          .eq('id', session.id)
      );

      await Promise.all(updatePromises);

      message.success(`学习完成！${selectedKeys.length} 个字段已保存到公司信息库`);
      
      // 跳转到公司信息页面
      setTimeout(() => {
        navigate('/company-profiles');
      }, 1500);

    } catch (error) {
      console.error('保存失败:', error);
      message.error(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 渲染跨文档分析结果
  const renderCrossAnalysis = () => {
    if (crossAnalysis.length === 0) return null;

    const columns = [
      {
        title: '选择',
        dataIndex: 'key',
        key: 'select',
        width: 60,
        render: (key) => (
          <Checkbox 
            checked={!!selectedFields[key]} 
            onChange={(e) => handleFieldSelect(key, e.target.checked)}
          />
        )
      },
      {
        title: '字段名',
        dataIndex: 'key',
        key: 'key',
        width: 150,
        render: (key) => (
          <div className="font-medium text-gray-800">{key}</div>
        )
      },
      {
        title: '提取值',
        dataIndex: 'value',
        key: 'value',
        render: (value, record) => {
          const isEditing = editingFields[record.key] !== undefined;
          const displayValue = editingFields[record.key] || value || '未提取';
          
          return (
            <div 
              className="p-2 border border-transparent hover:border-gray-300 rounded cursor-text min-h-[40px]"
              onClick={() => handleFieldEdit(record.key, value)}
            >
              {isEditing ? (
                <Input
                  value={editingFields[record.key]}
                  onChange={(e) => handleFieldEdit(record.key, e.target.value)}
                  onBlur={() => handleFieldEdit(record.key, undefined)}
                  autoFocus
                  size="small"
                />
              ) : (
                <span className="text-gray-800">{displayValue}</span>
              )}
            </div>
          );
        }
      },
      {
        title: '出现频率',
        dataIndex: 'frequency',
        key: 'frequency',
        width: 100,
        render: (frequency, record) => {
          const [current, total] = frequency.split('/').map(Number);
          const percent = (current / total) * 100;
          
          let color = 'green';
          if (percent < 40) color = 'red';
          else if (percent < 70) color = 'orange';
          
          return (
            <div className="flex items-center">
              <Tag color={color}>{frequency}</Tag>
              {record.consistent && (
                <Tooltip title="所有文档中值一致">
                  <Check size={14} className="text-green-500 ml-1" />
                </Tooltip>
              )}
            </div>
          );
        }
      },
      {
        title: '状态',
        key: 'status',
        width: 120,
        render: (_, record) => {
          const [current, total] = record.frequency.split('/').map(Number);
          
          if (current === total && record.consistent) {
            return <Tag color="success">高频且一致</Tag>;
          } else if (current >= Math.ceil(total / 2) && record.consistent) {
            return <Tag color="processing">中频一致</Tag>;
          } else if (current >= 2) {
            return <Tag color="warning">低频出现</Tag>;
          } else {
            return <Tag color="default">单次出现</Tag>;
          }
        }
      },
      {
        title: '详情',
        key: 'details',
        width: 100,
        render: (_, record) => {
          if (record.allValues.length <= 1) return null;
          
          return (
            <Tooltip 
              title={
                <div>
                  <p>不同值：</p>
                  {record.allValues.map((item, idx) => (
                    <div key={idx} className="text-xs">
                      {item.value} (出现{item.count}次)
                    </div>
                  ))}
                </div>
              }
            >
              <AlertCircle size={16} className="text-gray-400 cursor-help" />
            </Tooltip>
          );
        }
      }
    ];

    return (
      <div className="space-y-6">
        <Card 
          title={
            <div className="flex items-center">
              <Building2 size={18} className="mr-2" />
              <span>跨文档分析结果</span>
              <Tag color="blue" className="ml-2">
                共 {uploadedFiles.length} 份文档，{crossAnalysis.length} 个字段
              </Tag>
            </div>
          }
          className="border border-gray-200"
        >
          <div className="mb-4 text-sm text-gray-600">
            建议优先选择高频且值一致的字段保存。已自动选中出现2次以上且值一致的字段。
          </div>
          
          <Table
            columns={columns}
            dataSource={crossAnalysis}
            rowKey="key"
            pagination={false}
            size="middle"
            rowClassName={(record) => 
              selectedFields[record.key] ? 'bg-blue-50' : ''
            }
          />
          
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              已选中 {Object.values(selectedFields).filter(v => v).length} 个字段
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                size="small" 
                onClick={() => {
                  // 全选高频字段
                  const newSelected = {};
                  crossAnalysis.forEach(item => {
                    if (item.frequencyNumber >= 2 && item.consistent) {
                      newSelected[item.key] = true;
                    }
                  });
                  setSelectedFields(newSelected);
                }}
              >
                全选高频字段
              </Button>
              <Button 
                size="small" 
                onClick={() => setSelectedFields({})}
              >
                清空选择
              </Button>
            </div>
          </div>
        </Card>

        {/* 文档详情 */}
        <Card 
          title={
            <div className="flex items-center">
              <FileText size={18} className="mr-2" />
              <span>各文档提取详情</span>
            </div>
          }
          className="border border-gray-200"
        >
          <div className="space-y-4">
            {extractionResults.map((result, idx) => (
              <div key={idx} className="p-4 border border-gray-100 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-800">
                    {uploadedFiles[idx]?.name}
                  </div>
                  <Tag color="blue">
                    {result.fields?.length || 0} 个字段
                  </Tag>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {result.fields?.slice(0, 6).map((field, fieldIdx) => (
                    <div key={fieldIdx} className="text-sm">
                      <span className="text-gray-500">{field.key}:</span>
                      <span className="ml-1 text-gray-800 truncate">{field.value}</span>
                    </div>
                  ))}
                  {result.fields?.length > 6 && (
                    <div className="text-sm text-gray-400">
                      还有 {result.fields.length - 6} 个字段...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  // 渲染处理状态
  const renderProcessingStatus = () => {
    if (processingStatus === 'idle') return null;

    const statusConfig = {
      converting: {
        title: '转换中',
        description: `正在将 ${uploadedFiles.length} 份文件转换为Markdown格式...`,
        icon: <Loader2 className="animate-spin" />
      },
      chunking: {
        title: '分块分析中',
        description: '正在智能分块并分析文档内容...',
        icon: <Loader2 className="animate-spin" />
      },
      analyzing: {
        title: '跨文档分析中',
        description: '正在对比多份文档，分析高频字段...',
        icon: <Loader2 className="animate-spin" />
      },
      awaiting_verification: {
        title: '分析完成',
        description: '请勾选要保存的字段并关联公司',
        icon: <CheckCircle className="text-green-500" />
      }
    };

    const config = statusConfig[processingStatus];
    if (!config) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center mb-4">
          {config.icon}
          <h3 className="text-lg font-semibold ml-2">{config.title}</h3>
        </div>
        <p className="text-gray-600 mb-4">{config.description}</p>
        
        {/* 分块进度详情 */}
        {processingStatus === 'chunking' && chunkProgress.total > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-800">
                分块进度: {chunkProgress.current}/{chunkProgress.total}
              </span>
              <span className="text-sm text-blue-600">{chunkProgress.percent}%</span>
            </div>
            <Progress percent={chunkProgress.percent} status="active" />
            {chunkProgress.message && (
              <p className="text-sm text-blue-700 mt-2">{chunkProgress.message}</p>
            )}
          </div>
        )}
        
        <Progress percent={progress} status="active" />
        
        {/* 文件处理列表 */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <FileText size={14} className="text-gray-400 mr-2" />
                <span className="text-gray-700 truncate">{file.name}</span>
                <span className="ml-2 text-gray-500 text-xs">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center">
          <BookOpen size={24} className="text-purple-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">学习投标文件</h1>
            <p className="text-gray-600 mt-1">批量上传投标文件，AI自动发现高频字段并保存到公司信息库</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* 文件上传区域 */}
          {crossAnalysis.length === 0 && (
            <div className="mb-10">
              <div 
                ref={dropZoneRef}
                className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer ${
                  isDragging ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-purple-300 hover:bg-gray-50'
                } ${processingStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => processingStatus === 'idle' && fileInputRef.current?.click()}
              >
                {processingStatus === 'idle' ? (
                  <>
                    <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                      <Upload size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">批量上传投标文件</h3>
                    <p className="text-gray-600 text-center mb-6 max-w-md">
                      支持 PDF 和 DOCX 格式，最大50MB。AI将对比多份文档，自动发现高频出现的公司信息字段。
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <FileText size={16} className="mr-1" />
                        <span>PDF / DOCX</span>
                      </div>
                      <div className="flex items-center">
                        <Clock size={16} className="mr-1" />
                        <span>支持多文件批量上传</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                      <Loader2 size={40} className="animate-spin" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">处理中...</h3>
                    <p className="text-gray-600 text-center mb-6 max-w-md">
                      正在分析文件内容，请稍候
                    </p>
                  </>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) handleFilesSelect(files);
                    if (e.target) e.target.value = '';
                  }}
                  disabled={processingStatus !== 'idle'}
                />
              </div>
              
              {uploadedFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      已选择 {uploadedFiles.length} 个文件
                    </span>
                    <button 
                      onClick={() => {
                        setUploadedFiles([]);
                        setProcessingStatus('idle');
                        setProgress(0);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                      disabled={processingStatus !== 'idle'}
                    >
                      清空列表
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText size={16} className="text-blue-600 mr-2" />
                          <div>
                            <p className="font-medium text-blue-800 text-sm">{file.name}</p>
                            <p className="text-blue-600 text-xs mt-1">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            const newFiles = [...uploadedFiles];
                            newFiles.splice(idx, 1);
                            setUploadedFiles(newFiles);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          disabled={processingStatus !== 'idle'}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 处理状态显示 */}
          {renderProcessingStatus()}

          {/* 跨文档分析结果 */}
          {crossAnalysis.length > 0 && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">跨文档分析结果</h2>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">关联到公司:</span>
                  <Select
                    placeholder="选择公司"
                    style={{ width: 200 }}
                    value={selectedCompanyId}
                    onChange={setSelectedCompanyId}
                    disabled={isSaving}
                  >
                    {companies.map(company => (
                      <Option key={company.id} value={company.id}>
                        {company.company_name}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>

              {renderCrossAnalysis()}

              {/* 操作按钮 */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <Button
                  onClick={() => {
                    setCrossAnalysis([]);
                    setExtractionResults([]);
                    setProcessingStatus('idle');
                    setProgress(0);
                    setChunkProgress({ current: 0, total: 0, percent: 0, message: '' });
                    setUploadedFiles([]);
                    setLearningSessions([]);
                    setSelectedCompanyId(null);
                    setSelectedFields({});
                    setEditingFields({});
                  }}
                  disabled={isSaving}
                >
                  重新上传
                </Button>
                <Button
                  type="primary"
                  onClick={handleSaveToCompany}
                  loading={isSaving}
                  disabled={!selectedCompanyId || isSaving || Object.values(selectedFields).filter(v => v).length === 0}
                  icon={<CheckCircle size={16} />}
                >
                  {isSaving ? '保存中...' : `确认保存 (${Object.values(selectedFields).filter(v => v).length}个字段)`}
                </Button>
              </div>
            </div>
          )}

          {/* 使用说明 */}
          {crossAnalysis.length === 0 && processingStatus === 'idle' && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">如何使用</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
                    <Upload size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">1. 批量上传</h4>
                  <p className="text-gray-600 text-sm">上传多份投标文件（PDF或DOCX格式）</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                    <FileText size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">2. AI跨文档分析</h4>
                  <p className="text-gray-600 text-sm">AI对比多份文档，发现高频出现的字段</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
                    <Building2 size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">3. 勾选保存</h4>
                  <p className="text-gray-600 text-sm">勾选高频字段，保存到公司信息库</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearnBid;