# 多职位管理功能使用指南

## 功能概述

人员专家库现在支持一人多职位管理，每个职位可以有独立的项目经历列表。在填写标书时，可以选择人员的特定职位来填充动态表格。

## 数据结构

### 新格式（推荐）
```json
{
  "custom_fields": {
    "job_positions": [
      {
        "position_name": "产品经理",
        "project_experiences": [
          {
            "project_name": "XX系统开发",
            "time_range": ["2023-01-01", "2023-12-31"],
            "role": "产品经理",
            "description": "负责产品规划和需求管理"
          }
        ]
      },
      {
        "position_name": "项目经理",
        "project_experiences": [
          {
            "project_name": "YY项目实施",
            "time_range": ["2022-06-01", "2023-05-31"],
            "role": "项目经理",
            "description": "负责项目整体管理"
          }
        ]
      }
    ]
  }
}
```

### 旧格式（自动兼容）
```json
{
  "job_title": "产品经理",
  "custom_fields": {
    "project_experiences": [
      {
        "project_name": "XX系统开发",
        "time_range": ["2023-01-01", "2023-12-31"],
        "role": "产品经理",
        "description": "负责产品规划"
      }
    ]
  }
}
```

## 使用流程

### 1. 在人员专家库添加人员

1. 点击"新增人员"按钮
2. 填写基础信息（姓名、性别、学历等）
3. 在"职位与项目经历"区块：
   - 默认有一个空职位，填写职位名称（如：产品经理）
   - 点击"添加项目经历"，填写该职位下的项目
   - 点击"添加职位"，可以为同一人员添加更多职位
4. 上传证件附件
5. 点击"保存"

### 2. 在标书填写页面使用

1. 上传标书模板，系统自动识别动态表格
2. 点击"填写复杂表格"按钮
3. 在弹窗中：
   - **第一步**：从下拉框选择人员（已选过的人员会被禁用）
   - **第二步**：选择该人员的职位（只显示该人员拥有的职位）
   - 系统自动展开该职位的项目经历，生成表格行
4. 可以直接编辑表格单元格
5. 可以删除不需要的行（二次确认）
6. 点击"确定"后导出Word文档

## 核心特性

### 职位互斥
- 同一人员在同一表格中只能选择一个职位
- 选择职位后，该人员在下拉框中会被禁用
- 删除所有该人员的行后，会自动重新启用

### 智能数据映射
- **简历表**（包含"项目"、"时间"等关键词）：一个项目一行
- **汇总表**（人员基础信息）：一个人一行

### 兼容性
- 自动识别新旧数据格式
- 旧数据会被转换为新格式显示
- 保存时统一使用新格式

## 字段映射规则

| 表头关键词 | 数据来源 |
|-----------|---------|
| 姓名 | profile.name |
| 职务/职位 | profile.job_title |
| 职称/资格 | profile.title |
| 性别 | profile.gender |
| 学历 | profile.education |
| 学位 | profile.degree |
| 专业 | profile.major |
| 院校/毕业院校 | profile.school |
| 电话/联系方式 | profile.phone |
| 身份证 | profile.id_number |
| 出生日期/出生年月 | profile.birth_date |
| 机构/单位 | profile.organization |
| 部门 | profile.department |
| 拟.*职务 | profile.assigned_role |
| 项目名称 | experience.project_name |
| 时间/年月 | experience.time_range |
| 角色 | experience.role |
| 内容/描述 | experience.description |

## 技术实现

### 前端状态管理
```javascript
// 记录已选人员+职位组合
selectedPersonRoles: { 
  [tableId]: { 
    "张三": "产品经理",
    "李四": "项目经理"
  } 
}

// 临时存储第一级选择
tempPersonSelection: { 
  [tableId]: "张三" 
}

// 表格数据
dynamicTableEdits: { 
  [tableId]: [
    { _personName: "张三", _positionName: "产品经理", ...headers }
  ] 
}
```

### 辅助函数
- `getJobPositions(profile)`: 兼容读取新旧格式
- `getPositionOptions(personName)`: 提取某人的所有职位
- `handlePositionSelect(tableId, positionName)`: 选择职位后生成行数据
- `handleRemovePersonPosition(tableId, personName, positionName)`: 移除人员+职位组合

## 注意事项

1. 职位名称必填，不能为空
2. 同一人员可以有多个职位，但在同一表格中只能选一个
3. 删除人员时会同时删除所有附件
4. 图片附件会自动追加到表格下方
5. 建议为每个职位添加至少一个项目经历

## 故障排查

### 问题：选择人员后没有职位可选
- 检查该人员是否添加了职位
- 检查职位名称是否为空

### 问题：表格数据映射不正确
- 检查表头关键词是否匹配
- 查看浏览器控制台的映射日志

### 问题：旧数据显示异常
- 系统会自动转换，无需手动迁移
- 如有问题，重新编辑保存即可

## 更新日志

- 2026-04-16: 初始版本，支持多职位管理和两级联动选择
