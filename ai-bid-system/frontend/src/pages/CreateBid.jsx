import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Button, Input, message, Modal, Table, Tag, Empty, Spin } from 'antd';
import {
  UploadCloud, ArrowLeft, Download, FileText, Cpu, Database, Edit3, Eye
} from 'lucide-react';
import { saveAs } from 'file-saver';

import { fillDocumentBlanks, scanBlanksWithAI } from '../utils/difyWorkflow';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  scanBlanksFromXml,
  replaceBlanksInXml,
  extractDocumentXml,
  generateFilledDocx,
  extractParagraphsForPreview,
  extractIndexedParagraphs,
  mergeBlanks
} from '../utils/wordBlankFiller';

export default function CreateBid() {
  const { user } = useAuth();

  const [step, setStep] = useState('upload');
  const fileInputRef = useRef(null);

  const [originalFile, setOriginalFile] = useState(null);
  const [originalZip, setOriginalZip] = useState(null);
  const [originalXml, setOriginalXml] = useState('');
  const [scannedBlanks, setScannedBlanks] = useState([]);
  const [filledValues, setFilledValues] = useState({});
  const [manualEdits, setManualEdits] = useState({});

  const [targetCompany, setTargetCompany] = useState('');
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [companyList, setCompanyList] = useState([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  const [highlightBlankId, setHighlightBlankId] = useState(null);
  const previewRef = useRef(null);

  const previewParagraphs = useMemo(() => {
    if (!originalXml || scannedBlanks.length === 0) return [];
    return extractParagraphsForPreview(originalXml, scannedBlanks);
  }, [originalXml, scannedBlanks]);

  const scrollToBlank = useCallback((blankId) => {
    setHighlightBlankId(blankId);
    setTimeout(() => {
      const el = document.getElementById(`preview-${blankId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 2000);
      }
    }, 100);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return message.error('请先登录！');

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx') {
      return message.warning('当前仅支持 .docx 格式，请上传 Word 2007+ 文件');
    }

    setOriginalFile(file);
    setIsScanning(true);

    try {
      message.loading({ content: '正在扫描招标文件中的空白位置...', key: 'scan', duration: 0 });

      const { xmlString, zip } = await extractDocumentXml(file);
      setOriginalXml(xmlString);
      setOriginalZip(zip);

      // 并行执行正则扫描和 AI 扫描
      const [regexBlanks, indexedParagraphs] = await Promise.all([
        Promise.resolve(scanBlanksFromXml(xmlString)),
        Promise.resolve(extractIndexedParagraphs(xmlString))
      ]);

      let aiBlanks = [];
      try {
        // 只发送非空段落给 AI 扫描
        const nonEmptyParagraphs = indexedParagraphs.filter(p => p.text.length > 0);
        if (nonEmptyParagraphs.length > 0) {
          message.loading({ content: '正则扫描完成，正在调用 AI 进行智能识别...', key: 'scan', duration: 0 });
          aiBlanks = await scanBlanksWithAI(nonEmptyParagraphs);
        }
      } catch (aiError) {
        console.warn('AI 扫描失败，继续使用正则结果:', aiError);
        message.warning({ content: 'AI 扫描失败，仅使用正则识别结果', key: 'scan', duration: 3 });
      }

      // 合并正则和 AI 结果
      const mergedBlanks = mergeBlanks(regexBlanks, aiBlanks);

      if (mergedBlanks.length === 0) {
        message.warning({ content: '未扫描到空白位置，该文件可能不需要填报，或空白格式未被识别。', key: 'scan', duration: 5 });
        setStep('upload');
        setIsScanning(false);
        return;
      }

      setScannedBlanks(mergedBlanks);
      const initialEdits = {};
      mergedBlanks.forEach(b => { initialEdits[b.id] = ''; });
      setManualEdits(initialEdits);

      const fileExtension = '.' + ext;
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExtension}`;
      const filePath = `${user.id}/${safeFileName}`;
      await supabase.storage.from('documents').upload(filePath, file);
      const uploadedFileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;

      const { data: project, error } = await supabase.from('bidding_projects').insert({
        user_id: user.id,
        project_name: file.name.replace(/\.[^/.]+$/, ''),
        file_url: uploadedFileUrl,
        framework_content: JSON.stringify(mergedBlanks),
        status: 'processing'
      }).select().single();

      if (!error && project) {
        setCurrentProjectId(project.id);
      }

      const scanSummary = `扫描完成，共发现 ${mergedBlanks.length} 处待填写位置！`;
      if (aiBlanks.length > 0) {
        message.success({ content: `${scanSummary} (正则: ${regexBlanks.length}, AI: ${aiBlanks.length})`, key: 'scan' });
      } else {
        message.success({ content: scanSummary, key: 'scan' });
      }
      setStep('scan');
    } catch (err) {
      console.error('扫描失败:', err);
      message.error({ content: '文件扫描失败: ' + err.message, key: 'scan' });
    } finally {
      setIsScanning(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleAutoFill = async () => {
    if (!targetCompany.trim()) {
      return message.warning('请先输入或选择投标主体公司名称！');
    }

    setIsFilling(true);
    try {
      message.loading({ content: `正在调用 AI 分析并填写 ${scannedBlanks.length} 处空白...`, key: 'fill', duration: 0 });

      const result = await fillDocumentBlanks(scannedBlanks, targetCompany);

      setFilledValues(result);

      const merged = {};
      for (const blank of scannedBlanks) {
        merged[blank.id] = result[blank.id] || '';
      }
      setManualEdits(merged);

      if (currentProjectId) {
        await supabase.from('bidding_projects').update({
          analysis_report: JSON.stringify(result),
          status: 'completed'
        }).eq('id', currentProjectId);
      }

      message.success({ content: 'AI 填写完成！请核对并手动修正后导出。', key: 'fill' });
      setStep('review');
    } catch (err) {
      console.error('AI 填写失败:', err);
      message.error({ content: 'AI 填写失败: ' + err.message, key: 'fill' });
      setStep('scan');
    } finally {
      setIsFilling(false);
    }
  };

  const handleExportFilledWord = () => {
    if (!originalZip || !originalXml || scannedBlanks.length === 0) {
      return message.error('缺少原始文件数据，请重新上传');
    }

    try {
      message.loading({ content: '正在生成已填报的 Word 文件...', key: 'export', duration: 0 });

      const finalValues = { ...filledValues, ...manualEdits };
      const modifiedXml = replaceBlanksInXml(originalXml, scannedBlanks, finalValues);

      const blob = generateFilledDocx(originalZip, modifiedXml);
      saveAs(blob, `已填报_${originalFile.name}`);

      message.success({ content: '导出成功！格式 100% 还原原文件。', key: 'export' });
    } catch (err) {
      console.error('导出失败:', err);
      message.error({ content: '导出失败: ' + err.message, key: 'export' });
    }
  };

  const handleManualEdit = (blankId, value) => {
    setManualEdits(prev => ({ ...prev, [blankId]: value }));
  };

  const fetchCompanyList = async () => {
    setIsCompanyModalVisible(true);
    setFetchingCompanies(true);
    try {
      const [docRes, imgRes] = await Promise.all([
        supabase.from('document_categories').select('name'),
        supabase.from('image_categories').select('name')
      ]);
      const allCategories = [
        ...(docRes.data || []).map(i => i.name),
        ...(imgRes.data || []).map(i => i.name)
      ];
      setCompanyList([...new Set(allCategories.filter(name => name && name.trim() !== ''))]);
    } catch (error) {
      // ignore
    } finally {
      setFetchingCompanies(false);
    }
  };

  const blankColumns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (text) => <span className="font-mono text-indigo-600 text-xs">{text}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => {
        const typeMap = {
          underscore: { label: '下划线', color: 'blue' },
          dash: { label: '短横线', color: 'cyan' },
          spaces: { label: '空格', color: 'geekblue' },
          keyword_space: { label: '关键词', color: 'purple' },
          date_pattern: { label: '日期', color: 'orange' },
          empty_cell: { label: '空单元格', color: 'green' }
        };
        const info = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={info.color} className="text-xs">{info.label}</Tag>;
      }
    },
    {
      title: 'AI 填写结果 / 手动修改',
      key: 'value',
      render: (_, record) => (
        <Input
          value={manualEdits[record.id] || ''}
          onChange={(e) => handleManualEdit(record.id, e.target.value)}
          placeholder="手动输入或等待 AI 填写..."
          className="w-full"
          onClick={() => scrollToBlank(record.id)}
        />
      )
    }
  ];

  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-8 relative">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">招标文件智能填报</h2>
        <p className="text-gray-500 mb-12 text-center max-w-xl">
          上传甲方的 .docx 招标文件，系统将自动扫描其中的空白位置（签名栏、日期栏、公司信息等），
          由 AI 结合知识库自动填写，最终导出格式 100% 还原的已填报文件。
        </p>

        <div className="flex gap-8 max-w-4xl w-full justify-center">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            accept=".docx"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 max-w-lg border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-3xl p-16 bg-white shadow-sm hover:shadow-xl cursor-pointer flex flex-col items-center group transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <UploadCloud size={48} className="text-indigo-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">上传招标文件 (.docx)</h3>
            <p className="text-gray-500 text-center text-sm leading-relaxed">
              支持 Word 2007+ 格式 (.docx)<br />
              系统将自动识别文件中的签名栏、日期栏、<br />
              公司信息等空白位置并智能填写
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">
              重要提示：AI 辅助填报内容可能存在随机性，请务必在封标前进行人工复核。
            </span>
          </div>
          <p className="text-xs text-gray-400">本系统仅作为辅助工具</p>
        </div>

        {isScanning && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-10 rounded-2xl shadow-2xl flex flex-col items-center w-[400px]">
              <Cpu size={40} className="text-indigo-500 mb-6 animate-pulse" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">正在扫描文件...</h3>
              <p className="text-gray-500 text-sm">正在解析 Word XML 结构，识别空白填写位置</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'scan' || step === 'review') {
    const isReviewed = step === 'review';

    return (
      <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
        <div className="h-14 bg-white border-b flex items-center justify-between px-6 shadow-sm shrink-0 z-10">
          <div className="flex items-center">
            <Button
              type="text"
              icon={<ArrowLeft size={18} />}
              onClick={() => { setStep('upload'); setScannedBlanks([]); setFilledValues({}); setManualEdits({}); }}
              className="text-gray-600 font-medium"
            >
              重新上传
            </Button>
            <span className="ml-4 text-gray-300">|</span>
            <span className="ml-4 text-sm text-gray-500">
              {originalFile?.name}
            </span>
            <Tag color="blue" className="ml-3">{scannedBlanks.length} 处空白</Tag>
          </div>
          <div className="flex items-center gap-3">
            {isReviewed && (
              <Button
                type="primary"
                icon={<Download size={16} />}
                onClick={handleExportFilledWord}
                className="bg-green-600 hover:bg-green-700 rounded-full px-6 border-0 font-bold"
              >
                导出已填报文件 (.docx)
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* ========== 左侧：原文对照侧边栏 ========== */}
          <div className="w-[360px] bg-white border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-3 border-b border-gray-100 bg-gray-50 shrink-0">
              <h4 className="font-bold text-gray-700 text-sm flex items-center">
                <Eye size={14} className="mr-2 text-indigo-500" />
                原文对照
                <span className="ml-2 text-xs text-gray-400 font-normal">点击表格行定位</span>
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5" ref={previewRef}>
              {previewParagraphs.map((para, pIdx) => {
                if (para.blankIds.length === 0) {
                  return (
                    <div key={pIdx} className="text-xs text-gray-500 leading-relaxed py-1 px-2 rounded">
                      {para.text}
                    </div>
                  );
                }

                const parts = [];
                let remaining = para.text;
                const sortedBlanks = para.blankIds
                  .map(id => scannedBlanks.find(b => b.id === id))
                  .filter(Boolean)
                  .sort((a, b) => para.text.indexOf(a.matchText) - para.text.indexOf(b.matchText));

                let lastIdx = 0;
                for (const blank of sortedBlanks) {
                  const matchIdx = remaining.indexOf(blank.matchText, lastIdx);
                  if (matchIdx === -1) {
                    parts.push({ type: 'text', content: remaining.substring(lastIdx) });
                    break;
                  }
                  if (matchIdx > lastIdx) {
                    parts.push({ type: 'text', content: remaining.substring(lastIdx, matchIdx) });
                  }
                  parts.push({ type: 'blank', id: blank.id, content: blank.matchText });
                  lastIdx = matchIdx + blank.matchText.length;
                }
                if (lastIdx < remaining.length) {
                  parts.push({ type: 'text', content: remaining.substring(lastIdx) });
                }

                return (
                  <div
                    key={pIdx}
                    className="text-xs leading-relaxed py-1.5 px-2 rounded bg-amber-50/60 border border-amber-100"
                  >
                    {parts.map((part, partIdx) => {
                      if (part.type === 'text') {
                        return <span key={partIdx}>{part.content}</span>;
                      }
                      const isHighlighted = highlightBlankId === part.id;
                      const filledValue = manualEdits[part.id];
                      return (
                        <span
                          key={partIdx}
                          id={`preview-${part.id}`}
                          className={`
                            inline-block px-1 py-0.5 rounded mx-0.5 font-bold transition-all duration-300
                            ${isHighlighted
                              ? 'bg-indigo-500 text-white ring-2 ring-indigo-300'
                              : filledValue
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-yellow-200 text-yellow-900 border border-yellow-400'
                            }
                          `}
                          title={filledValue || `待填写 (${part.id})`}
                        >
                          {filledValue || part.content}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
              {previewParagraphs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText size={32} className="text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">原文预览为空</p>
                </div>
              )}
            </div>
          </div>

          {/* ========== 中间：表格编辑区 ========== */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-gray-100 p-4 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-800 flex items-center">
                  <Edit3 size={16} className="mr-2 text-indigo-500" />
                  待填写字段
                  <Tag color="blue" className="ml-2">{scannedBlanks.length} 处</Tag>
                </h3>
                <p className="text-xs text-gray-400">
                  {isReviewed
                    ? 'AI 已完成填写，可直接修改后导出'
                    : '点击任意行 → 左侧自动定位原文位置'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <Table
                dataSource={scannedBlanks}
                columns={blankColumns}
                rowKey="id"
                pagination={false}
                size="middle"
                className="blank-table"
                onRow={(record) => ({
                  onClick: () => scrollToBlank(record.id),
                  className: 'cursor-pointer hover:bg-indigo-50/50 transition-colors'
                })}
                rowClassName={(record) => {
                  const filled = manualEdits[record.id];
                  if (highlightBlankId === record.id) return 'bg-indigo-50';
                  return filled ? 'bg-green-50/40' : '';
                }}
              />
            </div>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700 shrink-0">投标主体：</span>
                <div className="flex items-center shadow-sm rounded-lg overflow-hidden border border-indigo-200 bg-gray-50 flex-1 max-w-xs">
                  <Input
                    placeholder="输入公司名称"
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="flex-1 border-none h-9 bg-transparent font-medium text-sm"
                  />
                  <Button
                    type="text"
                    icon={<Database size={14} />}
                    onClick={fetchCompanyList}
                    className="bg-indigo-100 text-indigo-700 h-9 px-3 rounded-none border-l border-indigo-200 font-medium text-xs"
                  >
                    从库中选
                  </Button>
                </div>

                <div className="flex-1" />

                {!isReviewed ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleAutoFill}
                    loading={isFilling}
                    className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 font-bold border-0 px-8"
                  >
                    AI 自动填写
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleAutoFill}
                      loading={isFilling}
                      className="rounded-xl h-11 font-bold px-6"
                    >
                      重新 AI 填写
                    </Button>
                    <Button
                      type="primary"
                      size="large"
                      icon={<Download size={16} />}
                      onClick={handleExportFilledWord}
                      className="bg-green-600 hover:bg-green-700 rounded-xl h-11 font-bold border-0 px-8"
                    >
                      导出已填报文件
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {isFilling && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-10 rounded-2xl shadow-2xl flex flex-col items-center w-[500px]">
              <Cpu size={40} className="text-indigo-500 mb-6 animate-pulse" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">AI 正在分析并填写...</h3>
              <p className="text-gray-500 text-sm mb-4">
                正在结合知识库为 {scannedBlanks.length} 处空白生成填写内容
              </p>
              <Spin size="large" />
            </div>
          </div>
        )}

        <Modal
          title="选择投标主体"
          open={isCompanyModalVisible}
          onCancel={() => setIsCompanyModalVisible(false)}
          footer={null}
          centered
          width={540}
        >
          {fetchingCompanies ? (
            <div className="flex flex-col items-center py-12"><Spin /></div>
          ) : companyList.length === 0 ? (
            <Empty description="暂无公司记录，请先在知识库中添加" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {companyList.map((name) => (
                <div
                  key={name}
                  onClick={() => {
                    setTargetCompany(name);
                    setIsCompanyModalVisible(false);
                    message.success(`已锁定主体：${name}`);
                  }}
                  className="p-4 border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer flex items-center space-x-3"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-lg">🏢</div>
                  <div className="flex-1 truncate font-bold text-gray-700">{name}</div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="text-center">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">未知步骤，请刷新页面重试</p>
        <Button
          type="primary"
          onClick={() => setStep('upload')}
          className="mt-4 bg-indigo-600"
        >
          返回首页
        </Button>
      </div>
    </div>
  );
}
