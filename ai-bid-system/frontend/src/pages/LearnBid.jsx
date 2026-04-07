import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, FileText, Building2, CheckCircle, X, Loader2,
  BookOpen, Clock, Check, AlertCircle, Filter, Search, BarChart3, Layers, Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { convertToMarkdown, validateBidFile } from '../utils/documentParser';
import { runDifyMarkdownExtraction, analyzeCrossDocumentFrequency, CORE_FIELD_CATEGORIES } from '../utils/difyExtractor';
import { message, Progress, Card, Button, Select, Input, Tag, Table, Checkbox, Tooltip, Tabs, Badge } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const LearnBid = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [chunkProgress, setChunkProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    message: ''
  });
  
  const [extractionResults, setExtractionResults] = useState([]);
  const [crossAnalysis, setCrossAnalysis] = useState([]);
  const [learningSessions, setLearningSessions] = useState([]);
  
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedFields, setSelectedFields] = useState({});
  const [editingFields, setEditingFields] = useState({});
  
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

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

  const filteredAnalysis = useMemo(() => {
    let filtered = crossAnalysis;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(item => {
        const cat = item.classification?.category || 'other';
        return cat === activeCategory;
      });
    }
    
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(item => 
        item.key.toLowerCase().includes(lowerSearch) || 
        item.value.toLowerCase().includes(lowerSearch)
      );
    }
    
    return filtered;
  }, [crossAnalysis, activeCategory, searchText]);

  const categoryStats = useMemo(() => {
    const stats = {};
    Object.keys(CORE_FIELD_CATEGORIES).forEach(key => {
      stats[key] = { total: 0, selected: 0, highConfidence: 0 };
    });
    stats.other = { total: 0, selected: 0, highConfidence: 0 };
    
    crossAnalysis.forEach(item => {
      const cat = item.classification?.category || 'other';
      if (!stats[cat]) stats[cat] = { total: 0, selected: 0, highConfidence: 0 };
      stats[cat].total++;
      if (selectedFields[item.key]) stats[cat].selected++;
      if (item.avgConfidence >= 0.7) stats[cat].highConfidence++;
    });
    
    return stats;
  }, [crossAnalysis, selectedFields]);

  const processSingleFile = async (file, fileIndex, totalFiles) => {
    try {
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

      const markdown = await convertToMarkdown(file);

      await supabase
        .from('bid_learning_sessions')
        .update({
          status: 'chunking',
          extraction_metadata: {
            markdown_size: markdown.length,
            converted_at: new Date().toISOString()
          }
        })
        .eq('id', session.id);

      const extractionResult = await runDifyMarkdownExtraction(
        markdown, 
        file.name,
        {
          onProgress: (p) => {
            setChunkProgress(p);
            const fileBaseProgress = (fileIndex / totalFiles) * 20;
            const chunkProgressPercent = p.percent || 0;
            setProgress(fileBaseProgress + (chunkProgressPercent * 0.8));
          }
        }
      );

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

  const handleFilesSelect = async (files) => {
    if (!user) {
      message.error('请先登录');
      return;
    }

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

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        message.info(`正在处理文件 ${i + 1}/${validFiles.length}: ${file.name}`);
        
        const result = await processSingleFile(file, i, validFiles.length);
        results.push(result.extractionResult);
        sessions.push(result.session);
        
        setProgress(((i + 1) / validFiles.length) * 100);
      }

      setExtractionResults(results);
      setLearningSessions(sessions);

      setProcessingStatus('analyzing');
      message.info('正在进行跨文档分析...');
      
      const analysis = analyzeCrossDocumentFrequency(results);
      setCrossAnalysis(analysis);
      
      const defaultSelected = {};
      analysis.forEach(item => {
        if (item.frequencyNumber >= 2 && item.consistent) {
          defaultSelected[item.key] = true;
        } else if (item.avgConfidence >= 0.75 && item.frequencyNumber >= 1) {
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

  const handleFieldSelect = (key, checked) => {
    setSelectedFields(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  const handleFieldEdit = (key, value) => {
    setEditingFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveToCompany = async () => {
    console.log('🔍 [调试] handleSaveToCompany 开始执行');
    console.log('🔍 [调试] selectedCompanyId:', selectedCompanyId);
    console.log('🔍 [调试] learningSessions:', learningSessions);
    console.log('🔍 [调试] user:', user);

    if (!selectedCompanyId || crossAnalysis.length === 0) {
      message.error('请选择关联的公司');
      return;
    }

    const selectedKeys = Object.keys(selectedFields).filter(key => selectedFields[key]);
    if (selectedKeys.length === 0) {
      message.error('请至少选择一个字段保存');
      return;
    }

    setIsSaving(true);

    try {
      // 步骤1：检查Supabase认证状态
      console.log('🔍 [调试] 步骤1：检查Supabase认证状态');
      const { data: authData } = await supabase.auth.getSession();
      console.log('🔍 [调试] Auth Session:', authData?.session);
      console.log('🔍 [调试] Auth User:', authData?.session?.user);

      if (!authData?.session) {
        throw new Error('用户未登录或会话已过期');
      }

      const currentUserId = authData.session.user.id;
      console.log('🔍 [调试] 当前用户ID:', currentUserId);

      // 步骤2：验证learningSessions的所有权
      console.log('🔍 [调试] 步骤2：验证learningSessions的所有权');
      for (const session of learningSessions) {
        console.log('🔍 [调试] 检查session:', session.id);
        const { data: sessionData, error: sessionCheckError } = await supabase
          .from('bid_learning_sessions')
          .select('id, user_id, status, company_profile_id')
          .eq('id', session.id)
          .single();

        if (sessionCheckError) {
          console.error('❌ [调试] 查询session失败:', sessionCheckError);
          throw new Error(`无法查询学习记录 ${session.id}: ${sessionCheckError.message}`);
        }

        console.log('🔍 [调试] Session数据:', sessionData);
        console.log('🔍 [调试] Session user_id:', sessionData.user_id);
        console.log('🔍 [调试] 当前用户ID:', currentUserId);

        if (sessionData.user_id !== currentUserId) {
          throw new Error(`学习记录 ${session.id} 不属于当前用户 (记录所有者: ${sessionData.user_id}, 当前用户: ${currentUserId})`);
        }
      }

      // 步骤3：更新公司信息
      console.log('🔍 [调试] 步骤3：更新公司信息');
      const { data: company, error: fetchError } = await supabase
        .from('company_profiles')
        .select('custom_fields')
        .eq('id', selectedCompanyId)
        .single();

      if (fetchError) {
        console.error('❌ [调试] 查询公司失败:', fetchError);
        throw fetchError;
      }

      console.log('🔍 [调试] 公司数据:', company);

      const fieldsToSave = {};
      selectedKeys.forEach(key => {
        const analysisItem = crossAnalysis.find(item => item.key === key);
        if (analysisItem) {
          fieldsToSave[key] = editingFields[key] || analysisItem.value;
        }
      });

      console.log('🔍 [调试] 要保存的字段:', fieldsToSave);

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

      console.log('🔍 [调试] 更新后的字段:', updatedFields);

      const { data: updatedCompany, error: updateError } = await supabase
        .from('company_profiles')
        .update({ 
          custom_fields: updatedFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCompanyId)
        .select();

      if (updateError) {
        console.error('❌ [调试] 更新公司失败:', updateError);
        throw updateError;
      }

      console.log('🔍 [调试] 公司更新成功:', updatedCompany);

      // 步骤4：更新learningSessions
      console.log('🔍 [调试] 步骤4：更新learningSessions');
      console.log('🔍 [调试] 要更新的session IDs:', learningSessions.map(s => s.id));

      const updatePromises = learningSessions.map(async (session) => {
        console.log('🔍 [调试] 更新session:', session.id);
        
        const updateData = {
          company_profile_id: selectedCompanyId,
          verified: true,
          verified_at: new Date().toISOString(),
          status: 'completed'
        };

        console.log('🔍 [调试] 更新数据:', updateData);

        const { data: updatedSession, error: updateSessionError } = await supabase
          .from('bid_learning_sessions')
          .update(updateData)
          .eq('id', session.id)
          .eq('user_id', currentUserId)
          .select();

        if (updateSessionError) {
          console.error('❌ [调试] 更新session失败:', updateSessionError);
          console.error('❌ [调试] 错误详情:', {
            code: updateSessionError.code,
            message: updateSessionError.message,
            details: updateSessionError.details,
            hint: updateSessionError.hint
          });
          throw new Error(`更新学习记录 ${session.id} 失败: ${updateSessionError.message}`);
        }

        console.log('🔍 [调试] Session更新成功:', updatedSession);
        return updatedSession;
      });

      const updatedSessions = await Promise.all(updatePromises);
      console.log('🔍 [调试] 所有session更新成功:', updatedSessions);

      message.success(`学习完成！${selectedKeys.length} 个字段已保存到公司信息库`);
      
      setTimeout(() => {
        navigate('/company-profiles');
      }, 1500);

    } catch (error) {
      console.error('❌ [调试] 保存失败:', error);
      console.error('❌ [调试] 错误堆栈:', error.stack);
      message.error(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'orange';
    return 'red';
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return '高可信';
    if (confidence >= 0.6) return '中可信';
    return '低可信';
  };

  const renderCrossAnalysis = () => {
    if (crossAnalysis.length === 0) return null;

    const tabItems = [
      {
        key: 'all',
        label: (
          <span>
            全部 <Badge count={crossAnalysis.length} style={{ backgroundColor: '#722ed1', marginLeft: 4 }} />
          </span>
        ),
      },
      ...Object.entries(CORE_FIELD_CATEGORIES).map(([key, cat]) => {
        const stats = categoryStats[key];
        return {
          key,
          label: (
            <span>
              {cat.label}
              {stats && stats.total > 0 && (
                <Badge count={stats.total} style={{ backgroundColor: '#722ed1', marginLeft: 4 }} />
              )}
            </span>
          ),
        };
      }),
      {
        key: 'other',
        label: (
          <span>
            其他
            {categoryStats.other && categoryStats.other.total > 0 && (
              <Badge count={categoryStats.other.total} style={{ backgroundColor: '#d9d9d9', color: '#666', marginLeft: 4 }} />
            )}
          </span>
        ),
      },
    ];

    const columns = [
      {
        title: '选择',
        dataIndex: 'key',
        key: 'select',
        width: 50,
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
        width: 140,
        render: (key, record) => (
          <div>
            <div className="font-medium text-gray-800">{key}</div>
            <Tag 
              color={record.classification?.category === 'other' ? 'default' : 'purple'} 
              style={{ fontSize: '10px', marginTop: 2 }}
            >
              {record.classification?.label || '其他'}
            </Tag>
          </div>
        )
      },
      {
        title: '提取值',
        dataIndex: 'value',
        key: 'value',
        render: (value, record) => {
          const isEditing = editingFields[record.key] !== undefined;
          const displayValue = isEditing ? editingFields[record.key] : (value || '未提取');
          
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
        title: '频率',
        dataIndex: 'frequency',
        key: 'frequency',
        width: 80,
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
        title: '可信度',
        key: 'confidence',
        width: 90,
        render: (_, record) => (
          <Tooltip title={`平均可信度: ${Math.round(record.avgConfidence * 100)}%`}>
            <Tag color={getConfidenceColor(record.avgConfidence)}>
              {getConfidenceText(record.avgConfidence)}
            </Tag>
          </Tooltip>
        )
      },
      {
        title: '状态',
        key: 'status',
        width: 100,
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
        width: 60,
        render: (_, record) => {
          if (record.allValues.length <= 1) return null;
          
          return (
            <Tooltip 
              title={
                <div>
                  <p className="font-bold mb-1">不同值：</p>
                  {record.allValues.map((item, idx) => (
                    <div key={idx} className="text-xs mb-1">
                      <div>{item.value}</div>
                      <div className="text-gray-400">出现{item.count}次 · 可信度{Math.round(item.avgConfidence * 100)}%</div>
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
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="搜索字段名或值..."
                prefix={<Search size={14} className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="small"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter size={14} />
              <span>已选中 {Object.values(selectedFields).filter(v => v).length}/{crossAnalysis.length} 个字段</span>
            </div>
            <div className="flex gap-2">
              <Button 
                size="small" 
                onClick={() => {
                  const newSelected = {};
                  crossAnalysis.forEach(item => {
                    if (item.frequencyNumber >= 2 && item.consistent) {
                      newSelected[item.key] = true;
                    } else if (item.avgConfidence >= 0.75) {
                      newSelected[item.key] = true;
                    }
                  });
                  setSelectedFields(newSelected);
                }}
              >
                全选优质字段
              </Button>
              <Button 
                size="small" 
                onClick={() => setSelectedFields({})}
              >
                清空选择
              </Button>
              <Button 
                size="small" 
                icon={<Layers size={14} />}
                onClick={() => setDetailVisible(!detailVisible)}
              >
                {detailVisible ? '隐藏详情' : '查看提取详情'}
              </Button>
            </div>
          </div>
          
          <Tabs
            activeKey={activeCategory}
            onChange={setActiveCategory}
            items={tabItems}
            size="small"
            className="mb-4"
          />
          
          <Table
            columns={columns}
            dataSource={filteredAnalysis}
            rowKey="key"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 个字段` }}
            size="middle"
            rowClassName={(record) => 
              selectedFields[record.key] ? 'bg-blue-50' : ''
            }
          />
        </Card>

        {detailVisible && (
          <Card 
            title={
              <div className="flex items-center">
                <BarChart3 size={18} className="mr-2" />
                <span>各文档提取详情</span>
              </div>
            }
            className="border border-gray-200"
          >
            <div className="space-y-4">
              {extractionResults.map((result, idx) => (
                <div key={idx} className="p-4 border border-gray-100 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-500" />
                      <span className="font-medium text-gray-800">
                        {uploadedFiles[idx]?.name}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Tag color="blue">
                        {result.fields?.length || 0} 个字段
                      </Tag>
                      <Tag color="green">
                        {(result.metadata?.kv_extract_count || 0)} 个键值对
                      </Tag>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {result.fields?.map((field, fieldIdx) => (
                      <div key={fieldIdx} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="text-gray-500 text-xs">{field.key}</div>
                        <div className="text-gray-800 truncate" title={field.value}>{field.value}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Tag color={getConfidenceColor(field.confidence || 0.5)} style={{ fontSize: '10px', padding: '0 4px' }}>
                            {Math.round((field.confidence || 0.5) * 100)}%
                          </Tag>
                          <span className="text-gray-400 text-xs">{field.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

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

          {renderProcessingStatus()}

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
                    setActiveCategory('all');
                    setSearchText('');
                    setDetailVisible(false);
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
                    <Zap size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">2. AI智能提取</h4>
                  <p className="text-gray-600 text-sm">AI识别键值对、表格和标题，智能分块分析</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
                    <Building2 size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">3. 分类筛选保存</h4>
                  <p className="text-gray-600 text-sm">按类别筛选、搜索字段，勾选后保存到公司信息库</p>
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
