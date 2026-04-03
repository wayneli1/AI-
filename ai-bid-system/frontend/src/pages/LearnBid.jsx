import { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Building2, CheckCircle, X, Loader2,
  BookOpen, FileCheck, Target, Clock, BarChart
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { convertToMarkdown, validateBidFile } from '../utils/documentParser';
import { runDifyMarkdownExtraction } from '../utils/difyExtractor';
import { message, Progress, Card, Button, Select, Input, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const LearnBid = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 文件上传状态
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('idle'); // idle, converting, chunking, extracting, merging, awaiting_verification
  const [progress, setProgress] = useState(0);
  const [chunkProgress, setChunkProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    message: ''
  });
  
  // 处理结果状态
  const [extractionResult, setExtractionResult] = useState(null);
  const [learningSession, setLearningSession] = useState(null);
  
  // 公司关联状态
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 校验编辑状态
  const [editingFields, setEditingFields] = useState({});

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

  // 文件上传处理
  const handleFileSelect = async (file) => {
    if (!user) {
      message.error('请先登录');
      return;
    }

    // 验证文件
    const validation = validateBidFile(file);
    if (!validation.isValid) {
      message.error(validation.message);
      return;
    }

    setUploadedFile(file);
    setProcessingStatus('converting');
    setProgress(10);

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
      setLearningSession(session);
      setProgress(20);

      // 2. 转换为Markdown
      const markdown = await convertToMarkdown(file);
      setProgress(40);

      // 更新学习记录
      await supabase
        .from('bid_learning_sessions')
        .update({
          markdown_content: markdown,
          markdown_size: markdown.length,
          status: 'chunking'
        })
        .eq('id', session.id);

      setProcessingStatus('chunking');
      setProgress(50);

      // 3. 调用Dify提取信息（带分块进度跟踪）
      const extractionResult = await runDifyMarkdownExtraction(
        markdown, 
        file.name,
        {
          onProgress: (progress) => {
            setChunkProgress(progress);
            // 更新总体进度：50% + (50% * 分块进度百分比)
            const chunkProgressPercent = progress.percent || 0;
            setProgress(50 + (chunkProgressPercent * 0.5));
          }
        }
      );
      setExtractionResult(extractionResult);
      setProgress(80);

      // 4. 更新学习记录
      await supabase
        .from('bid_learning_sessions')
        .update({
          extraction_result: extractionResult,
          extraction_metadata: {
            extracted_at: new Date().toISOString(),
            field_count: Object.keys(extractionResult || {}).length,
            confidence_score: extractionResult?.metadata?.overall_confidence || 0,
            chunk_stats: extractionResult?.metadata?.processing_stats
          },
          status: 'awaiting_verification'
        })
        .eq('id', session.id);

      setProcessingStatus('awaiting_verification');
      setProgress(100);
      setChunkProgress({ current: 0, total: 0, percent: 0, message: '' });

      message.success('文件分析完成！请校验提取的信息');

    } catch (error) {
      console.error('处理文件失败:', error);
      message.error(`处理失败: ${error.message}`);
      
      if (learningSession?.id) {
        await supabase
          .from('bid_learning_sessions')
          .update({ status: 'failed' })
          .eq('id', learningSession.id);
      }
      
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
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // 字段编辑处理
  const handleFieldEdit = (section, field, value) => {
    setEditingFields(prev => ({
      ...prev,
      [`${section}.${field}`]: value
    }));
  };

  // 保存到公司信息库
  const handleSaveToCompany = async () => {
    if (!selectedCompanyId || !extractionResult) {
      message.error('请选择关联的公司');
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

      // 2. 合并提取结果到custom_fields
      const currentFields = company.custom_fields || {};
      const updatedFields = mergeExtractionToCustomFields(currentFields, extractionResult, learningSession.id);

      // 3. 更新公司信息
      const { error: updateError } = await supabase
        .from('company_profiles')
        .update({ 
          custom_fields: updatedFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCompanyId);

      if (updateError) throw updateError;

      // 4. 更新学习记录状态
      const { error: sessionError } = await supabase
        .from('bid_learning_sessions')
        .update({
          company_profile_id: selectedCompanyId,
          verified: true,
          verified_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', learningSession.id);

      if (sessionError) throw sessionError;

      message.success('学习完成！信息已保存到公司信息库');
      
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

  // 合并提取结果到custom_fields
  const mergeExtractionToCustomFields = (currentFields, extractionResult, sessionId) => {
    const merged = { ...currentFields };
    
    // 公司基本信息
    if (extractionResult.company_info) {
      merged.learned_company_name = extractionResult.company_info.name || merged.learned_company_name;
      merged.learned_legal_representative = extractionResult.company_info.legal_rep || merged.learned_legal_representative;
      merged.learned_uscc = extractionResult.company_info.uscc || merged.learned_uscc;
      merged.learned_address = extractionResult.company_info.address || merged.learned_address;
      merged.learned_phone = extractionResult.company_info.phone || merged.learned_phone;
      merged.learned_email = extractionResult.company_info.email || merged.learned_email;
    }
    
    // 项目模板
    if (extractionResult.project_info) {
      merged.project_templates = merged.project_templates || [];
      merged.project_templates.push({
        type: extractionResult.project_info.type,
        name: extractionResult.project_info.name,
        amount_range: extractionResult.project_info.amount,
        duration: extractionResult.project_info.duration,
        requirements: extractionResult.project_info.requirements,
        source_session: sessionId,
        learned_date: new Date().toISOString()
      });
    }
    
    // 技术要求库
    if (extractionResult.technical_requirements) {
      merged.technical_requirements_library = merged.technical_requirements_library || [];
      extractionResult.technical_requirements.forEach(req => {
        merged.technical_requirements_library.push({
          ...req,
          source_session: sessionId,
          learned_date: new Date().toISOString()
        });
      });
    }
    
    // 评分标准库
    if (extractionResult.scoring_criteria) {
      merged.scoring_criteria_library = merged.scoring_criteria_library || [];
      extractionResult.scoring_criteria.forEach(criteria => {
        merged.scoring_criteria_library.push({
          ...criteria,
          source_session: sessionId,
          learned_date: new Date().toISOString()
        });
      });
    }
    
    // 学习来源记录
    merged._learning_sources = merged._learning_sources || [];
    merged._learning_sources.push({
      session_id: sessionId,
      filename: learningSession?.original_filename,
      extraction_date: new Date().toISOString(),
      confidence_score: extractionResult.metadata?.overall_confidence || 0
    });
    
    return merged;
  };

  // 渲染提取结果
  const renderExtractionResult = () => {
    if (!extractionResult) return null;

    return (
      <div className="space-y-6">
        {/* 公司信息 */}
        {extractionResult.company_info && (
          <Card 
            title={
              <div className="flex items-center">
                <Building2 size={18} className="mr-2" />
                <span>公司信息</span>
                <Tag color="blue" className="ml-2">置信度: {(extractionResult.company_info._confidence || 0.8 * 100).toFixed(1)}%</Tag>
              </div>
            }
            className="border border-gray-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(extractionResult.company_info).map(([key, value]) => {
                if (key.startsWith('_')) return null;
                const fieldKey = `company_info.${key}`;
                const isEditing = editingFields[fieldKey] !== undefined;
                
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium text-gray-500 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {isEditing ? (
                      <Input
                        value={editingFields[fieldKey]}
                        onChange={(e) => handleFieldEdit('company_info', key, e.target.value)}
                        onBlur={() => handleFieldEdit('company_info', key, undefined)}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="p-2 border border-transparent hover:border-gray-300 rounded cursor-text"
                        onClick={() => handleFieldEdit('company_info', key, value)}
                      >
                        <span className="text-gray-800">{value || '未提取'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 项目信息 */}
        {extractionResult.project_info && (
          <Card 
            title={
              <div className="flex items-center">
                <Target size={18} className="mr-2" />
                <span>项目信息</span>
              </div>
            }
            className="border border-gray-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(extractionResult.project_info).map(([key, value]) => {
                if (key.startsWith('_')) return null;
                const fieldKey = `project_info.${key}`;
                const isEditing = editingFields[fieldKey] !== undefined;
                
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium text-gray-500 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {isEditing ? (
                      <Input
                        value={editingFields[fieldKey]}
                        onChange={(e) => handleFieldEdit('project_info', key, e.target.value)}
                        onBlur={() => handleFieldEdit('project_info', key, undefined)}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="p-2 border border-transparent hover:border-gray-300 rounded cursor-text"
                        onClick={() => handleFieldEdit('project_info', key, value)}
                      >
                        <span className="text-gray-800">{value || '未提取'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 技术要求 */}
        {extractionResult.technical_requirements && extractionResult.technical_requirements.length > 0 && (
          <Card 
            title={
              <div className="flex items-center">
                <FileCheck size={18} className="mr-2" />
                <span>技术要求 ({extractionResult.technical_requirements.length}项)</span>
              </div>
            }
            className="border border-gray-200"
          >
            <div className="space-y-3">
              {extractionResult.technical_requirements.map((req, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded border border-gray-100">
                  <div className="font-medium text-gray-800">{req.title || `要求 ${index + 1}`}</div>
                  <div className="text-sm text-gray-600 mt-1">{req.description}</div>
                  {req.standards && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-500">标准: </span>
                      <Tag color="green" className="text-xs">{req.standards}</Tag>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 评分标准 */}
        {extractionResult.scoring_criteria && extractionResult.scoring_criteria.length > 0 && (
          <Card 
            title={
              <div className="flex items-center">
                <BarChart size={18} className="mr-2" />
                <span>评分标准 ({extractionResult.scoring_criteria.length}项)</span>
              </div>
            }
            className="border border-gray-200"
          >
            <div className="space-y-3">
              {extractionResult.scoring_criteria.map((criteria, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-gray-800">{criteria.item}</div>
                    <Tag color="blue">{criteria.weight || '0'}分</Tag>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{criteria.description}</div>
                  {criteria.requirements && (
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">要求: </span>
                      {criteria.requirements}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  // 渲染处理状态
  const renderProcessingStatus = () => {
    if (processingStatus === 'idle') return null;

    const statusConfig = {
      converting: {
        title: '转换中',
        description: '正在将文件转换为Markdown格式...',
        icon: <Loader2 className="animate-spin" />
      },
      chunking: {
        title: '分块分析中',
        description: '正在智能分块并分析文档内容...',
        icon: <Loader2 className="animate-spin" />
      },
      extracting: {
        title: 'AI分析中',
        description: 'AI正在分析文档内容，提取关键信息...',
        icon: <Loader2 className="animate-spin" />
      },
      awaiting_verification: {
        title: '分析完成',
        description: '请校验AI提取的信息',
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
            <p className="text-gray-600 mt-1">上传投标文件，AI自动提取关键信息并保存到公司信息库</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* 文件上传区域 */}
          {!extractionResult && (
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
                    <h3 className="text-xl font-bold text-gray-900 mb-3">上传投标文件</h3>
                    <p className="text-gray-600 text-center mb-6 max-w-md">
                      支持 PDF 和 DOCX 格式，最大50MB。AI将自动分析文档内容，提取公司信息、项目要求等关键信息。
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <FileText size={16} className="mr-1" />
                        <span>PDF / DOCX</span>
                      </div>
                      <div className="flex items-center">
                        <Clock size={16} className="mr-1" />
                        <span>约1-3分钟处理时间</span>
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    if (e.target) e.target.value = '';
                  }}
                  disabled={processingStatus !== 'idle'}
                />
              </div>
              
              {uploadedFile && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText size={20} className="text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium text-blue-800">{uploadedFile.name}</p>
                      <p className="text-blue-600 text-sm mt-1">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setUploadedFile(null);
                      setProcessingStatus('idle');
                      setProgress(0);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    disabled={processingStatus !== 'idle'}
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 处理状态显示 */}
          {renderProcessingStatus()}

          {/* 提取结果和校验区域 */}
          {extractionResult && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">提取结果校验</h2>
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

              {renderExtractionResult()}

              {/* 操作按钮 */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                 <Button
                   onClick={() => {
                     setExtractionResult(null);
                     setProcessingStatus('idle');
                     setProgress(0);
                     setChunkProgress({ current: 0, total: 0, percent: 0, message: '' });
                     setUploadedFile(null);
                     setLearningSession(null);
                     setSelectedCompanyId(null);
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
                  disabled={!selectedCompanyId || isSaving}
                  icon={<CheckCircle size={16} />}
                >
                  {isSaving ? '保存中...' : '确认保存到公司信息库'}
                </Button>
              </div>
            </div>
          )}

          {/* 使用说明 */}
          {!extractionResult && processingStatus === 'idle' && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">如何使用</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
                    <Upload size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">1. 上传文件</h4>
                  <p className="text-gray-600 text-sm">上传完整的投标文件（PDF或DOCX格式）</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                    <FileText size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">2. AI自动分析</h4>
                  <p className="text-gray-600 text-sm">AI将提取公司信息、项目要求、评分标准等</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
                    <Building2 size={24} />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">3. 保存到公司库</h4>
                  <p className="text-gray-600 text-sm">校验后保存到公司信息库，用于后续标书生成</p>
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