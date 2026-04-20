import { useEffect } from 'react';
import { message } from 'antd';
import { supabase } from '../lib/supabase';
import { extractDocumentXml } from '../utils/wordBlankFiller';
import { filterIgnoredBlanks } from '../utils/wordBlankFiller';

/**
 * 项目加载和自动保存相关的Hook
 */
export const useProjectLoader = (
  urlProjectId,
  user,
  currentProjectId,
  step,
  manualEdits,
  dynamicTableEdits,
  dynamicTableImages,
  selectedPersonRoles,
  filledTableHtmls,
  manualFillModes,
  setCurrentProjectId,
  setOriginalFile,
  setOriginalXml,
  setOriginalZip,
  setScannedBlanks,
  setDynamicTables,
  setManualTables,
  setTableStructures,
  setParseMeta,
  setManualEdits,
  setDynamicTableEdits,
  setDynamicTableImages,
  setSelectedPersonRoles,
  setFilledTableHtmls,
  setManualFillModes,
  setAuditResults,
  setStep
) => {
  // 加载已有项目
  const loadExistingProject = async (id) => {
    try {
      message.loading({ content: '正在从云端恢复标书数据...', key: 'load', duration: 0 });
      const { data, error } = await supabase.from('bidding_projects').select('*').eq('id', id).single();
      if (error) throw error;

      if (data) {
        setCurrentProjectId(data.id);
        
        if (data.file_url) {
          const response = await fetch(data.file_url);
          const blob = await response.blob();
          const file = new File([blob], `${data.project_name}.docx`, { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          });
          setOriginalFile(file);
          
          const { xmlString, zip } = await extractDocumentXml(file);
          setOriginalXml(xmlString);
          setOriginalZip(zip);
        }

        if (data.framework_content) {
          const parsed = JSON.parse(data.framework_content);
          if (Array.isArray(parsed)) {
            const blanks = filterIgnoredBlanks(parsed);
            setScannedBlanks(blanks);
          } else {
            setScannedBlanks(parsed.normalBlanks || []);
            setDynamicTables(parsed.dynamicTables || []);
            setManualTables(parsed.manualTables || []);
            setTableStructures(parsed.tableStructures || []);
            setParseMeta(parsed.meta || null);
          }
        }

        if (data.analysis_report) {
          const edits = JSON.parse(data.analysis_report);
          if (edits && typeof edits === 'object' && !Array.isArray(edits) && edits.manualEdits !== undefined) {
            // 新格式：包含 manualEdits + dynamicTableEdits
            setManualEdits(edits.manualEdits || {});
            setDynamicTableEdits(edits.dynamicTableEdits || {});
            setDynamicTableImages(edits.dynamicTableImages || {});
            setSelectedPersonRoles(edits.selectedPersonRoles || {});
            setFilledTableHtmls(edits.filledTableHtmls || {});
            setManualFillModes(edits.manualFillModes || {});
          } else {
            // 旧格式：只有 manualEdits
            setManualEdits(edits);
          }
          setAuditResults([]);
          setStep('review'); 
        } else if (data.framework_content) {
          setStep('scan'); 
        } else {
          setStep('upload');
        }

        message.success({ content: '项目恢复成功！', key: 'load' });
      }
    } catch (err) {
      console.error("加载历史项目失败:", err);
      message.error({ content: '恢复项目失败，可能文件已损坏', key: 'load' });
      setStep('upload');
    }
  };

  // URL参数加载项目
  useEffect(() => {
    if (urlProjectId && user) {
      loadExistingProject(urlProjectId);
    }
  }, [urlProjectId, user]);

  // 自动保存
  useEffect(() => {
    if (!currentProjectId || step === 'upload') return;

    const debounceTimer = setTimeout(async () => {
      try {
        await supabase.from('bidding_projects').update({ 
          analysis_report: JSON.stringify({
            manualEdits,
            dynamicTableEdits,
            dynamicTableImages,
            selectedPersonRoles,
            filledTableHtmls,
            manualFillModes,
          })
        }).eq('id', currentProjectId);
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [manualEdits, dynamicTableEdits, dynamicTableImages, selectedPersonRoles, filledTableHtmls, manualFillModes, currentProjectId, step]);

  return {
    loadExistingProject,
  };
};
